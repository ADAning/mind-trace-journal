// src/weekly-report.ts
import * as obsidian from "obsidian";
import { EVENT_KIND_LABELS, EVENT_RELATION_LABELS, EVENT_STATUS_LABELS, EVENT_TRACE_KIND_LABELS, EVENT_TYPE_LABELS, OBSERVATION_DIMENSIONS, metricSnapshot, observationClaimMetrics, observationDimension, observationItemKey } from "./conversation";
import { activeWeekStats, addLocalDays, comparisonPeriod, localDateString, parseLocalDate, periodEntries, periodWeekStart } from "./date-utils";
import { normalizeSelfObservation } from "./defaults";
import { errorMessage } from "./journal-view";
import { collectMetrics, metricsFromFrontmatter } from "./metrics";
import { aggregateEventRecords, parseFrontmatter, readParsedJournal } from "./saved-journal";
import { v4ReportEnumLabel, weeklyReportSection } from "./saved-weekly-report-view";
import { eventMarkdownText, inlineMarkdown, yamlString } from "./storage";

export { MonthlyReportRepository, ObservationRepository, WeeklyReportRepository, legacyObservationMarkdown, normalizeReportFolderValue, observationEvidenceMarkdown, observationFolder, parseObservationMarkdown, reportSummaryFromMarkdown, resolveReportFolder, weeklyReportFrontmatterStatus };

function normalizeReportFolderValue(value) {
  const normalized = typeof value === "string" ? (0, obsidian.normalizePath)(value.trim()) : "";
  if (normalized.length === 0 || normalized === "/" || normalized === ".") {
    return "";
  }
  return normalized.replace(/^\/+/, "").replace(/\/+$/, "");
}
function resolveReportFolder(settings, type = "weekly") {
  const journalFolder = normalizeReportFolderValue(settings?.journalFolder);
  if (journalFolder.length === 0) {
    throw new Error("日记目录不能为空");
  }
  const reportType = type === "monthly" ? "monthly" : "weekly";
  const settingKey = reportType === "monthly" ? "monthlyReportFolder" : "weeklyReportFolder";
  const configured = normalizeReportFolderValue(settings?.[settingKey]);
  if (configured.length > 0) {
    return configured;
  }
  const label = reportType === "monthly" ? "月报" : "周报";
  return (0, obsidian.normalizePath)(`${journalFolder}/报告/${label}`);
}
function weeklyReportFolder(settings) {
  return resolveReportFolder(settings, "weekly");
}
function weeklyPeriodStatus(period) {
  if (period?.status === "partial") {
    return "partial";
  }
  if (period?.status === "complete") {
    return "complete";
  }
  const start = parseLocalDate(period?.start ?? "");
  const end = parseLocalDate(period?.end ?? "");
  if (start !== null && end !== null && localDateString(addLocalDays(start, 6)) === localDateString(end)) {
    return "complete";
  }
  return "partial";
}
function weeklyReportFrontmatterStatus(frontmatter) {
  const start = typeof frontmatter?.["period-start"] === "string" ? frontmatter["period-start"] : "";
  const end = typeof frontmatter?.["period-end"] === "string" ? frontmatter["period-end"] : "";
  const inferred = weeklyPeriodStatus({ start, end });
  if (inferred === "complete") {
    return "complete";
  }
  return frontmatter?.["period-status"] === "complete" ? "complete" : "partial";
}
function generatedWeeklyReportCount(app, period) {
  const periods = new Set();
  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter?.["mind-trace-report"] !== true || frontmatter?.["report-type"] !== "weekly" || weeklyReportFrontmatterStatus(frontmatter) !== "complete") {
      continue;
    }
    const start = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
    const end = typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "";
    if (parseLocalDate(start) === null || parseLocalDate(end) === null || start > period.end || end < period.start) {
      continue;
    }
    periods.add(`${start}--${end}`);
  }
  return periods.size;
}
function weeklyReportPath(settings, period) {
  return (0, obsidian.normalizePath)(`${weeklyReportFolder(settings)}/${period.start}--${period.end}.md`);
}
function monthlyReportFolder(settings) {
  return resolveReportFolder(settings, "monthly");
}
function monthlyReportPath(settings, period) {
  return (0, obsidian.normalizePath)(`${monthlyReportFolder(settings)}/${period.start.slice(0, 7)}.md`);
}
function scoreCell(value) {
  return value === null ? "—" : value.toFixed(1);
}
function scoreDelta(current, previous, key) {
  if (current[key] === null || previous[key] === null) {
    return "—";
  }
  const value = current[key] - previous[key];
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}
function evidenceSuffix(dates) {
  return dates.length > 0 ? ` _（${dates.join("、")}）_` : "";
}
function weeklyEventSnapshotLines(source, options: any = {}) {
  const scope = options.scope ?? "本周";
  const aggregate = source.events ?? aggregateEventRecords([]);
  if (aggregate.records.length === 0) {
    return [`_${scope}尚没有可用的结构化事件。_`];
  }
  const hubs = aggregate.nodes.slice(0, 10).map((node) => `- **${EVENT_KIND_LABELS[node.kind]}｜${eventMarkdownText(node.name)}**：${node.eventIds.size} 个事件，${node.dates.size} 天`);
  const records = [...aggregate.records].sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time) || left.eventIndex - right.eventIndex).flatMap((record) => {
    const lines = [
      `#### ${record.date} ${record.time} · ${EVENT_TYPE_LABELS[record.type] ?? EVENT_TYPE_LABELS.other}｜${eventMarkdownText(record.title)}`,
      `- 概要：${eventMarkdownText(record.summary)}`,
      `- 状态｜${record.status}：${EVENT_STATUS_LABELS[record.status]}`
    ];
    for (const trace of record.traces ?? []) {
      lines.push(`- 线索｜${trace.kind}｜${trace.certainty}｜${EVENT_TRACE_KIND_LABELS[trace.kind]}：${eventMarkdownText(trace.text)}`);
      if (trace.evidence.length > 0) {
        lines.push(`  - 依据：${eventMarkdownText(trace.evidence)}`);
      }
    }
    for (const argument of record.arguments ?? []) {
      lines.push(`- 论元｜${argument.role}｜${eventMarkdownText(argument.label)}｜${EVENT_KIND_LABELS[argument.entity.kind]}：${eventMarkdownText(argument.entity.name)}`);
    }
    for (const relation of record.relations ?? []) {
      lines.push(`- 关系｜${EVENT_RELATION_LABELS[relation.type]}｜${eventMarkdownText(relation.label)}｜${EVENT_KIND_LABELS[relation.subject.kind]}：${eventMarkdownText(relation.subject.name)}｜${EVENT_KIND_LABELS[relation.object.kind]}：${eventMarkdownText(relation.object.name)}`);
    }
    return [...lines, ""];
  });
  return ["### 核心元素", "", ...hubs, "", "### 事件索引", "", ...records];
}
function weeklyReportMarkdown(source, report) {
  const stats = source.stats;
  const previous = source.previousStats;
  const line = (text, item) => `- ${text}${evidenceSuffix(item.evidenceDates)}${item.eventRefs?.length > 0 ? ` <!-- mind-trace-event-refs: ${item.eventRefs.join(",")} -->` : ""}`;
  const highlights = report.highlights.map((item) => line(item.text, item)).join("\n") || "_本周没有足够的重点记录。_";
  const progress = report.progress.map((item) => line(`**${inlineMarkdown(item.subject)}｜${v4ReportEnumLabel(item.status)}**：${item.text}`, item)).join("\n") || "_本周没有可确认的状态变化。_";
  const openLoops = report.openLoops.map((item) => line(`**${v4ReportEnumLabel(item.status)}**：${item.text}`, item)).join("\n") || "_本周没有明确的未决事项。_";
  const themes = report.themes.map((item) => line(`**${inlineMarkdown(item.name)}**：${item.observation}`, item)).join("\n") || "_本周没有足够的重复主题。_";
  const carryForward = report.carryForward.map((item) => line(item.text, item)).join("\n") || "_没有记录到用户明确带往下周的事项。_";
  return [
    "---",
    "mind-trace-report: true",
    "mind-trace-report-version: 4",
    "report-type: weekly",
    `period-start: ${source.period.start}`,
    `period-end: ${source.period.end}`,
    `period-status: ${weeklyPeriodStatus(source.period)}`,
    `generated-at: ${new Date().toISOString()}`,
    `source-days: ${stats.days}`,
    `source-sessions: ${stats.sessions}`,
    `event-count: ${source.events?.records.length ?? 0}`,
    `event-covered-sessions: ${source.eventCoveredSessions ?? 0}`,
    `event-source-sessions: ${source.eventSourceSessions ?? stats.sessions}`,
    "---",
    "",
    `# ${source.period.start} 至 ${source.period.end} · 心迹周报`,
    "",
    "## 一周概览",
    "",
    report.summary,
    "",
    "## 本周数字",
    "",
    "| 维度 | 本周 | 较前一周 |",
    "| --- | ---: | ---: |",
    `| 记录日 | ${stats.days} 天 | ${stats.days - previous.days >= 0 ? "+" : ""}${stats.days - previous.days} 天 |`,
    `| 心情 | ${scoreCell(stats.mood)} | ${scoreDelta(stats, previous, "mood")} |`,
    `| 精力 | ${scoreCell(stats.energy)} | ${scoreDelta(stats, previous, "energy")} |`,
    `| 压力 | ${scoreCell(stats.stress)} | ${scoreDelta(stats, previous, "stress")} |`,
    "",
    "## 本周事件图谱",
    "",
    ...weeklyEventSnapshotLines(source),
    "",
    "## 本周发生",
    "",
    highlights,
    "",
    "## 进展与状态",
    "",
    progress,
    "",
    "## 尚未结束",
    "",
    openLoops,
    "",
    "## 本周反复出现",
    "",
    themes,
    "",
    "## 明确带到下周",
    "",
    carryForward,
    source.truncated ? "\n> [!info] 本周日记较长，AI 分析使用了截取后的摘录。" : "",
    ""
  ].join("\n");
}
function monthlyRhythmLines(source, report) {
  const rows = source.weekStats.map((week) => [
    `| ${week.start.slice(5)}–${week.end.slice(5)} | ${week.days} | ${week.sessions} | ${scoreCell(week.mood)} | ${scoreCell(week.energy)} | ${scoreCell(week.stress)} |`
  ]).flat();
  const observations = report.rhythm.map((item) => `- ${item.observation}${evidenceSuffix(item.evidenceDates)}`).join("\n");
  return [
    "| 自然周 | 记录日 | 篇数 | 心情 | 精力 | 压力 |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    observations
  ];
}
function monthlyReportMarkdown(source, report) {
  const stats = source.stats;
  const previous = source.previousStats;
  const comparisonLabel = source.period.status === "partial" ? "较上月同期" : "较上月";
  const line = (text, item) => `- ${text}${evidenceSuffix(item.evidenceDates)}${item.eventRefs?.length > 0 ? ` <!-- mind-trace-event-refs: ${item.eventRefs.join(",")} -->` : ""}`;
  const turningPoints = report.turningPoints.map((item) => line(item.text, item)).join("\n") || "_本月没有足够证据标记跨周转折。_";
  const evolution = report.themeEvolution.map((item) => line(`**${inlineMarkdown(item.name)}｜${v4ReportEnumLabel(item.trajectory)}**：${item.observation}`, item)).join("\n") || "_本月没有足够的跨周主题演变。_";
  const threads = report.threads.map((item) => line(`**${v4ReportEnumLabel(item.type)}｜${inlineMarkdown(item.name)}｜${v4ReportEnumLabel(item.trajectory)}**：${item.observation}`, item)).join("\n") || "_本月没有可确认的持续事项变化。_";
  const carryForward = report.carryForward.map((item) => line(item.text, item)).join("\n") || "_没有记录到明确带入下月的事项。_";
  return [
    "---",
    "mind-trace-report: true",
    "mind-trace-report-version: 4",
    "report-type: monthly",
    `period-start: ${source.period.start}`,
    `period-end: ${source.period.end}`,
    `period-status: ${source.period.status === "partial" ? "partial" : "complete"}`,
    `comparison-start: ${source.comparisonPeriod.start}`,
    `comparison-end: ${source.comparisonPeriod.end}`,
    `generated-at: ${new Date().toISOString()}`,
    `source-days: ${stats.days}`,
    `source-sessions: ${stats.sessions}`,
    `source-active-weeks: ${stats.activeWeeks}`,
    `event-count: ${source.events?.records.length ?? 0}`,
    `event-covered-sessions: ${source.eventCoveredSessions ?? 0}`,
    `event-source-sessions: ${source.eventSourceSessions ?? stats.sessions}`,
    "---",
    "",
    `# ${source.period.start} 至 ${source.period.end} · 心迹月报${source.period.status === "partial" ? "（截至今天）" : ""}`,
    "",
    "## 本月概览",
    "",
    report.summary,
    "",
    "## 本月数字",
    "",
    `| 维度 | 本月 | ${comparisonLabel} |`,
    "| --- | ---: | ---: |",
    `| 记录日 | ${stats.days} 天 | ${stats.days - previous.days >= 0 ? "+" : ""}${stats.days - previous.days} 天 |`,
    `| 已生成周报 | ${stats.activeWeeks} 份 | ${stats.activeWeeks - previous.activeWeeks >= 0 ? "+" : ""}${stats.activeWeeks - previous.activeWeeks} 份 |`,
    `| 心情 | ${scoreCell(stats.mood)} | ${scoreDelta(stats, previous, "mood")} |`,
    `| 精力 | ${scoreCell(stats.energy)} | ${scoreDelta(stats, previous, "energy")} |`,
    `| 压力 | ${scoreCell(stats.stress)} | ${scoreDelta(stats, previous, "stress")} |`,
    "",
    "## 月内节奏",
    "",
    ...monthlyRhythmLines(source, report),
    "",
    "## 本月事件图谱",
    "",
    ...weeklyEventSnapshotLines(source, { scope: "本月" }),
    "",
    "## 跨周转折",
    "",
    turningPoints,
    "",
    "## 主题如何演变",
    "",
    evolution,
    "",
    "## 持续推进与停滞",
    "",
    threads,
    "",
    "## 带入下月的未决事项",
    "",
    carryForward,
    source.truncated ? "\n> [!info] 本月日记较长，AI 分析使用了截取后的摘录。" : "",
    ""
  ].join("\n");
}
function reportSummaryFromMarkdown(content, heading = "一周概览") {
  return new RegExp(`^## ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n## |$)`, "m").exec(content)?.[1]?.trim() ?? (heading === "本月概览" ? "打开月报，回看这个月的变化。" : "打开周报，回看这一周的变化。");
}
var WeeklyReportRepository = class {
  declare app: any;
  declare assertOperational: () => void;
  constructor(app, assertOperational = () => {}) {
    this.app = app;
    this.assertOperational = assertOperational;
  }
  async collect(period) {
    const indexedEntries = collectMetrics(this.app).entries;
    const allEntries = [...indexedEntries];
    const indexedPaths = new Set(indexedEntries.map((entry) => entry.filePath));
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (indexedPaths.has(file.path)) {
        continue;
      }
      const cachedFrontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (cachedFrontmatter !== void 0) {
        if (cachedFrontmatter?.["mind-trace"] === true) {
          const metrics = metricsFromFrontmatter(cachedFrontmatter, file.path);
          if (metrics !== null) allEntries.push(metrics);
        }
        continue;
      }
      try {
        const content = await this.app.vault.cachedRead(file);
        const info = (0, obsidian.getFrontMatterInfo)(content);
        if (!info.exists) {
          continue;
        }
        const parsed = (0, obsidian.parseYaml)(info.frontmatter);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed) || parsed["mind-trace"] !== true) {
          continue;
        }
        const metrics = metricsFromFrontmatter(parsed, file.path);
        if (metrics !== null) {
          allEntries.push(metrics);
        }
      } catch {
      }
    }
    allEntries.sort((left, right) => left.date.localeCompare(right.date));
    const entries = periodEntries(allEntries, period);
    const comparison = comparisonPeriod(period);
    const previousStats: any = metricSnapshot(periodEntries(allEntries, comparison));
    const excerpts = [];
    const sourceFiles = [];
    const successfulDays = /* @__PURE__ */ new Set();
    const monthlyExcerptBlocks = new Map();
    let sessions = 0;
    let length = 0;
    let truncated = false;
    let acceptingExcerpts = true;
    const eventRecords = [];
    const eventMissingSessions = [];
    const eventCalibrationSessions = [];
    const eventReviewedSessions = [];
    const eventInvalidSessions = [];
    let eventSourceSessions = 0;
    let eventCoveredSessions = 0;
    for (const entry of entries) {
      try {
        const file = this.app.vault.getAbstractFileByPath(entry.filePath);
        if (!(file instanceof obsidian.TFile)) {
          continue;
        }
        let frontmatter = {};
        const cachedFrontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (cachedFrontmatter !== null && typeof cachedFrontmatter === "object" && !Array.isArray(cachedFrontmatter)) {
          frontmatter = cachedFrontmatter;
        } else {
          const content = await this.app.vault.cachedRead(file);
          try {
            const info = (0, obsidian.getFrontMatterInfo)(content);
            const parsed = info.exists ? (0, obsidian.parseYaml)(info.frontmatter) : {};
            frontmatter = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
          } catch {
          }
        }
        const journal = await readParsedJournal(this.app, file, frontmatter);
        sourceFiles.push(file);
        for (const [sessionIndex, session] of journal.sessions.entries()) {
          eventSourceSessions += 1;
          if (session.eventState === "ready") {
            eventCoveredSessions += 1;
            eventRecords.push(...session.events.map((event, eventIndex) => ({
              id: event.id || `${file.path}#${sessionIndex}:${eventIndex}`,
              filePath: file.path,
              sessionIndex,
              eventIndex,
              date: journal.date,
              time: session.time,
              type: event.type,
              status: event.status,
              title: event.title,
              summary: event.summary,
              traces: event.traces,
              arguments: event.arguments,
              relations: event.relations,
              elements: event.elements
            })));
            const sourceSession = {
              filePath: file.path,
              fileMtime: file.stat.mtime,
              date: journal.date,
              time: session.time,
              sessionIndex,
              diary: session.diary,
              facets: session.facets,
              events: session.events,
              eventState: "ready",
              eventSchema: session.eventSchema,
              eventReviewed: session.eventReviewed
            };
            if (session.eventReviewed) {
              eventReviewedSessions.push(sourceSession);
            } else {
              eventCalibrationSessions.push(sourceSession);
            }
          } else if (session.eventState === "missing") {
            const sourceSession = {
              filePath: file.path,
              fileMtime: file.stat.mtime,
              date: journal.date,
              time: session.time,
              sessionIndex,
              diary: session.diary,
              facets: session.facets,
              events: [],
              eventState: "missing",
              eventSchema: 0,
              eventReviewed: false
            };
            eventMissingSessions.push(sourceSession);
            eventCalibrationSessions.push(sourceSession);
          } else {
            eventInvalidSessions.push({
              filePath: file.path,
              fileMtime: file.stat.mtime,
              date: journal.date,
              time: session.time,
              sessionIndex,
              diary: session.diary,
              facets: session.facets,
              events: [],
              eventState: "invalid",
              eventSchema: session.eventSchema,
              eventReviewed: false,
              error: session.eventError ?? "格式无法识别"
            });
          }
          const rawBlock = [
            `【${journal.date} ${session.time}】`,
            `自评：心情 ${session.ratings.mood.selfScore}/5，精力 ${session.ratings.energy.selfScore}/5，压力 ${session.ratings.stress.selfScore}/5`,
            `日记：${session.diary}`,
            session.events.length > 0 ? `事件：${session.events.map((event) => `${EVENT_TYPE_LABELS[event.type]}｜${EVENT_STATUS_LABELS[event.status]}｜${event.title}（${event.arguments.map((argument) => `${argument.label}：${argument.entity.name}`).join("、")}；${event.traces.map((trace) => `${EVENT_TRACE_KIND_LABELS[trace.kind]}：${trace.text}`).join("、")}）`).join("；")}` : "",
            session.facets.length > 0 ? `记录切片：${session.facets.map((item) => `${item.category}：${item.summary}`).join("；")}` : ""
          ].filter((line) => line.length > 0).join("\n");
          const block = rawBlock.slice(0, 3e3);
          if (rawBlock.length > block.length) {
            truncated = true;
          }
          sessions += 1;
          successfulDays.add(journal.date);
          if (period.type === "monthly") {
            const week = periodWeekStart(journal.date) ?? journal.date;
            const blocks = monthlyExcerptBlocks.get(week) ?? [];
            blocks.push(block);
            monthlyExcerptBlocks.set(week, blocks);
          } else if (acceptingExcerpts && length + block.length <= 24e3) {
            excerpts.push(block);
            length += block.length;
          } else {
            truncated = true;
            acceptingExcerpts = false;
          }
        }
      } catch {
      }
    }
    const stats: any = metricSnapshot(entries.filter((entry) => successfulDays.has(entry.date)));
    stats.days = successfulDays.size;
    stats.sessions = sessions;
    if (period.type === "monthly") {
      const activeWeeks = [...monthlyExcerptBlocks.keys()].sort();
      const weekBudget = activeWeeks.length > 0 ? Math.floor(24e3 / activeWeeks.length) : 0;
      let monthlyLength = 0;
      for (const week of activeWeeks) {
        const blocks = monthlyExcerptBlocks.get(week) ?? [];
        const sessionBudget = blocks.length > 0 ? Math.max(1, Math.floor(weekBudget / blocks.length)) : 0;
        for (const block of blocks) {
          if (monthlyLength >= 24e3 || sessionBudget <= 0) {
            truncated = true;
            continue;
          }
          const remaining = Math.min(sessionBudget, 24e3 - monthlyLength);
          const excerpt = block.slice(0, remaining);
          excerpts.push(excerpt);
          monthlyLength += excerpt.length;
          if (excerpt.length < block.length) {
            truncated = true;
          }
        }
      }
    }
    const weekStats = activeWeekStats(entries.filter((entry) => successfulDays.has(entry.date)), period);
    stats.activeWeeks = period.type === "monthly" ? generatedWeeklyReportCount(this.app, period) : weekStats.length;
    previousStats.activeWeeks = period.type === "monthly" ? generatedWeeklyReportCount(this.app, comparison) : activeWeekStats(periodEntries(allEntries, comparison), comparison).length;
    const excerptText = excerpts.join("\n\n");
    if (period.type === "monthly" && excerptText.length > 24e3) {
      truncated = true;
    }
    return {
      period,
      comparisonPeriod: comparison,
      entries,
      sourceFiles,
      excerpts: period.type === "monthly" ? excerptText.slice(0, 24e3) : excerptText,
      stats,
      previousStats,
      weekStats,
      truncated,
      events: aggregateEventRecords(eventRecords),
      eventSourceSessions,
      eventCoveredSessions,
      eventMissingSessions,
      eventCalibrationSessions,
      eventReviewedSessions,
      eventInvalidSessions
    };
  }
  find(settings, period) {
    const targetStatus = weeklyPeriodStatus(period);
    const exact = this.app.vault.getAbstractFileByPath(weeklyReportPath(settings, period));
    if (exact instanceof obsidian.TFile) {
      const frontmatter = this.app.metadataCache.getFileCache(exact)?.frontmatter;
      if (frontmatter?.["mind-trace-report"] === true && frontmatter?.["report-type"] === "weekly" && weeklyReportFrontmatterStatus(frontmatter) === targetStatus) {
        return exact;
      }
    }
    const targetWeek = periodWeekStart(period.start) ?? period.start;
    const folder = weeklyReportFolder(settings);
    const candidates = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(`${folder}/`)) {
        continue;
      }
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontmatter?.["mind-trace-report"] !== true || frontmatter?.["report-type"] !== "weekly") {
        continue;
      }
      const start = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
      const end = typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "";
      if (periodWeekStart(start) !== targetWeek) {
        continue;
      }
      const status = weeklyReportFrontmatterStatus(frontmatter);
      if (status !== targetStatus) {
        continue;
      }
      candidates.push({ file, end });
    }
    candidates.sort((left, right) => right.end.localeCompare(left.end) || right.file.path.localeCompare(left.file.path));
    return candidates[0]?.file ?? null;
  }
  isStale(file, source) {
    return source.sourceFiles.some((candidate) => candidate.stat.mtime > file.stat.mtime);
  }
  resolveWriteTarget(settings, period) {
    const path = weeklyReportPath(settings, period);
    let file = this.find(settings, period);
    let completingPreview = false;
    if (file === null && weeklyPeriodStatus(period) === "complete") {
      const exact = this.app.vault.getAbstractFileByPath(path);
      const frontmatter = exact instanceof obsidian.TFile ? this.app.metadataCache.getFileCache(exact)?.frontmatter : null;
      if (exact instanceof obsidian.TFile && frontmatter?.["mind-trace-report"] === true && frontmatter?.["report-type"] === "weekly" && frontmatter?.["period-start"] === period.start && frontmatter?.["period-end"] === period.end && weeklyReportFrontmatterStatus(frontmatter) === "partial") {
        file = exact;
        completingPreview = true;
      }
    }
    return { file, completingPreview };
  }
  captureWriteVersion(settings, period) {
    const { file } = this.resolveWriteTarget(settings, period);
    return file instanceof obsidian.TFile ? { path: file.path, mtime: file.stat.mtime } : null;
  }
  async replaceExisting(file, content, expectedVersion, label) {
    if (expectedVersion === null || file.path !== expectedVersion.path || file.stat.mtime !== expectedVersion.mtime) {
      throw new Error(`${label}在生成期间发生了修改，未覆盖新内容`);
    }
    this.assertOperational();
    await this.app.vault.process(file, () => {
      this.assertOperational();
      const current = this.app.vault.getAbstractFileByPath(file.path);
      if (!(current instanceof obsidian.TFile) || current.stat.mtime !== expectedVersion.mtime) {
        throw new Error(`${label}在保存前发生了修改，未覆盖新内容`);
      }
      return content;
    });
  }
  async save(settings, source, report, overwrite = false, expectedVersion = null) {
    const path = weeklyReportPath(settings, source.period);
    let { file: existing, completingPreview } = this.resolveWriteTarget(settings, source.period);
    const content = weeklyReportMarkdown(source, report);
    if (existing instanceof obsidian.TFile) {
      if (!overwrite && !completingPreview) {
        return existing;
      }
      if (expectedVersion === null || existing.path !== expectedVersion.path || existing.stat.mtime !== expectedVersion.mtime) {
        throw new Error("周报在生成期间发生了修改，未覆盖新内容");
      }
      if (existing.path !== path && this.app.vault.getAbstractFileByPath(path) === null && typeof this.app.vault.rename === "function") {
        try {
          this.assertOperational();
          await this.app.vault.rename(existing, path);
          existing = this.app.vault.getAbstractFileByPath(path) ?? existing;
        } catch {
        }
      }
      await this.replaceExisting(existing, content, { path: existing.path, mtime: expectedVersion.mtime }, "周报");
      return existing;
    }
    await this.ensureFolder(weeklyReportFolder(settings));
    this.assertOperational();
    return await this.app.vault.create(path, content);
  }
  async ensureFolder(folder) {
    const parts = folder.split("/");
    let current = "";
    for (const part of parts) {
      current = current.length > 0 ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing === null) {
        this.assertOperational();
        await this.app.vault.createFolder(current);
      } else if (!(existing instanceof obsidian.TFolder)) {
        throw new Error(`无法创建报告目录：${current} 已经是文件`);
      }
    }
  }
};
var MonthlyReportRepository = class extends WeeklyReportRepository {
  find(settings, period) {
    const file = this.app.vault.getAbstractFileByPath(monthlyReportPath(settings, period));
    return file instanceof obsidian.TFile ? file : null;
  }
  resolveWriteTarget(settings, period) {
    return { file: this.find(settings, period), completingPreview: false };
  }
  async save(settings, source, report, overwrite = false, expectedVersion = null) {
    const path = monthlyReportPath(settings, source.period);
    const existing = this.app.vault.getAbstractFileByPath(path);
    const content = monthlyReportMarkdown(source, report);
    if (existing instanceof obsidian.TFile) {
      if (!overwrite) {
        return existing;
      }
      await this.replaceExisting(existing, content, expectedVersion, "月报");
      return existing;
    }
    await this.ensureFolder(monthlyReportFolder(settings));
    this.assertOperational();
    return await this.app.vault.create(path, content);
  }
};
function observationFolder(settings) {
  const configured = normalizeReportFolderValue(settings?.observationFolder);
  if (configured.length > 0) return configured;
  const journalFolder = normalizeReportFolderValue(settings?.journalFolder);
  if (journalFolder.length === 0) throw new Error("日记目录不能为空");
  return (0, obsidian.normalizePath)(`${journalFolder}/观照`);
}
function observationStatusLabel(status) {
  return status === "confirmed" ? "确认" : status === "partial" ? "部分符合" : status === "rejected" ? "否认" : status === "uncertain" ? "不确定" : "待校准";
}
function observationStatusValue(label) {
  return label === "确认" ? "confirmed" : label === "部分符合" ? "partial" : label === "否认" ? "rejected" : label === "不确定" ? "uncertain" : "pending";
}
function observationFrontmatter(snapshot) {
  const sources = Array.isArray(snapshot.sources) ? snapshot.sources : [];
  const starts = sources.map((source) => source.periodStart).filter(Boolean).sort();
  const ends = sources.map((source) => source.periodEnd).filter(Boolean).sort();
  return [
    "---",
    "mind-trace-observation: true",
    "mind-trace-observation-version: 2",
    `observation-id: ${yamlString(snapshot.id)}`,
    `generated-at: ${snapshot.generatedAt}`,
    `period-start: ${starts[0] ?? ""}`,
    `period-end: ${ends[ends.length - 1] ?? ""}`,
    `stage: ${snapshot.maturity?.stage ?? "initial"}`,
    `source-report-count: ${sources.length}`,
    "---"
  ].join("\n");
}
function observationEvidenceMarkdown(item) {
  const time = item.time ? ` ${item.time}` : "";
  const quote = item.quote ? `；“${inlineMarkdown(item.quote)}”` : "";
  return `${item.date}${time}｜${inlineMarkdown(item.title || "未命名事件")}：${inlineMarkdown(item.summary || "无摘要")}${quote}`;
}
function observationSubsection(block, heading) {
  const marker = `#### ${heading}`;
  const start = block.indexOf(marker);
  if (start === -1) return "";
  const contentStart = start + marker.length;
  const next = block.indexOf("\n#### ", contentStart);
  return block.slice(contentStart, next === -1 ? block.length : next).trim();
}
function observationMarkdown(snapshot) {
  const analysis = snapshot.analysis;
  const lines = [observationFrontmatter(snapshot), "", "# 最近的变化全景", "", "## 概览", "", analysis.summary, ""];
  for (const dimension of OBSERVATION_DIMENSIONS) {
    const claims = analysis.claims.filter((claim) => claim.dimension === dimension);
    if (claims.length === 0) continue;
    lines.push(`## ${dimension}`, "");
    for (const claim of claims) {
      const metrics = observationClaimMetrics(claim, snapshot.evidence ?? [], snapshot.sources ?? []);
      const metadata = { id: claim.key, dimension: claim.dimension, layer: claim.layer, support: claim.supportEvidenceRefs, counter: claim.counterEvidenceRefs };
      const feedback = snapshot.feedback?.[claim.key] ?? { status: "pending", correction: "" };
      lines.push(`### ${claim.statement}`, `<!-- mind-trace-observation-claim: ${JSON.stringify(metadata)} -->`, "");
      lines.push(`**此前：**${claim.before || "暂无明确对照"}`, `**现在：**${claim.now || "暂无明确对照"}`, `**线索阶段：**${metrics.signal}`, `**依据充分度：**${metrics.sufficiency}`, `**依据统计：**支持 ${metrics.support.length} · 反例 ${metrics.counter.length} · 独立周期 ${metrics.independentPeriods} · 跨度 ${metrics.spanDays} 天`, "");
      lines.push("#### 支持记录", "", ...(metrics.support.length > 0 ? metrics.support.map((item) => `- [${item.id}] ${observationEvidenceMarkdown(item)}`) : ["_暂无可用支持记录。_"]), "");
      lines.push("#### 反例", "", ...(metrics.counter.length > 0 ? metrics.counter.map((item) => `- [${item.id}] ${observationEvidenceMarkdown(item)}`) : ["_暂未找到反例，不等于不存在反例。_"]), "");
      lines.push("#### 另一种解释", "", claim.alternative || "这条事实性观察暂不需要替代解释。", "", "#### 仍缺少的信息", "", claim.missingInformation || "暂无。", "", "#### 可以问自己", "", claim.verificationQuestion || "这条记录与你的实际体验一致吗？", "", "#### 我的校准", "", `- 状态：${observationStatusLabel(feedback.status)}`, `- 修正：${String(feedback.correction ?? "").replace(/\n/g, " ")}`, "", `<!-- mind-trace-observation-claim-end: ${claim.key} -->`, "");
    }
  }
  lines.push("## 接下来值得观察", "", analysis.nextObservation, "", "## 证据索引", "");
  for (const item of snapshot.evidence ?? []) {
    lines.push(`<!-- mind-trace-observation-evidence: ${JSON.stringify(item)} -->`, `- [${item.id}] ${observationEvidenceMarkdown(item)}`);
  }
  lines.push("", "## 来源报告", "");
  for (const source of snapshot.sources ?? []) {
    lines.push(`<!-- mind-trace-observation-source: ${JSON.stringify(source)} -->`, `- [[${source.filePath}|${source.type === "monthly" ? "月报" : "周报"} ${source.periodStart} — ${source.periodEnd}]]`);
  }
  return `${lines.join("\n").trim()}\n`;
}
function parseObservationMarkdown(content, filePath = "") {
  const frontmatter = parseFrontmatter(content, "观照");
  if (frontmatter["mind-trace-observation"] !== true) throw new Error("不是心迹观照文件");
  const legacyMatch = content.match(/<!-- mind-trace-observation-legacy: (\{[^\n]+\}) -->/);
  if (legacyMatch !== null) {
    const legacy = JSON.parse(legacyMatch[1]);
    return { ...normalizeSelfObservation(legacy), id: String(frontmatter["observation-id"] ?? ""), filePath, legacy: true };
  }
  if (Number(frontmatter["mind-trace-observation-version"]) !== 2) throw new Error("不支持的观照格式版本");
  const summary = weeklyReportSection(content, "概览");
  const nextObservation = weeklyReportSection(content, "接下来值得观察");
  const evidence = [];
  const sources = [];
  for (const match of content.matchAll(/<!-- mind-trace-observation-evidence: (\{[^\n]+\}) -->/g)) {
    try { evidence.push(JSON.parse(match[1])); } catch { throw new Error("证据索引格式损坏"); }
  }
  for (const match of content.matchAll(/<!-- mind-trace-observation-source: (\{[^\n]+\}) -->/g)) {
    try { sources.push(JSON.parse(match[1])); } catch { throw new Error("来源报告索引格式损坏"); }
  }
  const claims = [];
  const feedback = {};
  const claimPattern = /### ([^\n]+)\n<!-- mind-trace-observation-claim: (\{[^\n]+\}) -->\n([\s\S]*?)<!-- mind-trace-observation-claim-end: ([^>]+) -->/g;
  for (const match of content.matchAll(claimPattern)) {
    let metadata;
    try { metadata = JSON.parse(match[2]); } catch { throw new Error(`观察“${match[1]}”的隐藏引用格式损坏`); }
    const id = String(metadata.id || match[4]).trim() || observationItemKey("claim", { dimension: metadata.dimension, observation: match[1] }, claims.length);
    const block = match[3];
    const field = (label) => block.match(new RegExp(`\\*\\*${label}：\\*\\*([^\\n]*)`))?.[1]?.trim() ?? "";
    const calibration = observationSubsection(block, "我的校准");
    const status = observationStatusValue(calibration.match(/^- 状态：([^\n]+)/m)?.[1]?.trim() ?? "暂存");
    const correction = calibration.match(/^- 修正：([^\n]*)/m)?.[1]?.trim() ?? "";
    const claim = {
      key: id,
      dimension: observationDimension(metadata.dimension),
      layer: ["fact", "inference", "hypothesis"].includes(metadata.layer) ? metadata.layer : "inference",
      statement: match[1].trim(), before: field("此前"), now: field("现在"),
      supportEvidenceRefs: Array.isArray(metadata.support) ? metadata.support : [],
      counterEvidenceRefs: Array.isArray(metadata.counter) ? metadata.counter : [],
      alternative: observationSubsection(block, "另一种解释"),
      missingInformation: observationSubsection(block, "仍缺少的信息"),
      verificationQuestion: observationSubsection(block, "可以问自己")
    };
    claims.push(claim);
    feedback[id] = { status, correction, updatedAt: "" };
  }
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const broken = claims.find((claim) => [...claim.supportEvidenceRefs, ...claim.counterEvidenceRefs].some((id) => !evidenceIds.has(id)));
  if (broken !== void 0) throw new Error(`观察“${broken.statement}”的证据引用已经断裂`);
  if (summary.length === 0 || nextObservation.length === 0 || claims.length === 0) throw new Error("观照正文缺少概览、观察条目或后续观察");
  return {
    version: 2,
    id: String(frontmatter["observation-id"] ?? ""),
    generatedAt: String(frontmatter["generated-at"] ?? ""),
    maturity: { stage: String(frontmatter.stage ?? "initial") },
    sources,
    evidence,
    analysis: { schemaVersion: 2, summary, claims, nextObservation },
    feedback,
    filePath,
    legacy: false
  };
}
function legacyObservationMarkdown(snapshot) {
  const normalized = normalizeSelfObservation(snapshot);
  const generatedAt = normalized.generatedAt || (/* @__PURE__ */ new Date()).toISOString();
  const id = `obs-legacy-${generatedAt.replace(/[^0-9]/g, "").slice(0, 17)}`;
  const starts = normalized.sources.map((source) => source.periodStart).filter(Boolean).sort();
  const ends = normalized.sources.map((source) => source.periodEnd).filter(Boolean).sort();
  const payload = JSON.stringify({ ...normalized, generatedAt }).replace(/-->/g, "--\\u003e");
  const summary = normalized.analysis?.summary ?? "由旧版 data.json 迁移的历史观照。";
  const analysis = normalized.analysis ?? {};
  const lines = ["---", "mind-trace-observation: true", "mind-trace-observation-version: 1", `observation-id: ${yamlString(id)}`, `generated-at: ${generatedAt}`, `period-start: ${starts[0] ?? ""}`, `period-end: ${ends[ends.length - 1] ?? ""}`, `stage: ${normalized.maturity?.stage ?? "initial"}`, `source-report-count: ${normalized.sources.length}`, "---", "", "# 历史观照", "", "## 概览", "", summary, "", `<!-- mind-trace-observation-legacy: ${payload} -->`, "", "> 此文件由旧版 data.json 迁移，保留旧栏目语义；下一次观照会使用新版统一观察格式。", ""];
  if (analysis.changes?.length) lines.push("## 变化描线", "", ...analysis.changes.map((item) => `- **${item.dimension}｜${item.signal ?? item.level ?? "线索"}**：${item.before} → ${item.now}`), "");
  if (analysis.perspectives?.length) lines.push("## 从不同角度看", "", ...analysis.perspectives.map((item) => `- **${item.perspective}｜${item.layer}**：${item.observation}`), "");
  if (analysis.hypotheses?.length) lines.push("## 值得验证的假设", "", ...analysis.hypotheses.flatMap((item) => [`### ${item.statement}`, "", `- 另一种解释：${item.alternative}`, `- 可以问自己：${item.question}`, ""]));
  if (analysis.roles?.length) lines.push("## 最近承担的角色", "", ...analysis.roles.map((item) => `- **${item.label}**：${item.observation}`), "");
  if (analysis.nextStep || analysis.selfQuestion) lines.push("## 旧版后续", "", analysis.nextStep ? `- 下一小步：${analysis.nextStep}` : "", analysis.selfQuestion ? `- 留给自己：${analysis.selfQuestion}` : "", "");
  return `${lines.join("\n").trim()}\n`;
}
function observationFileStem(date = /* @__PURE__ */ new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}--${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
var ObservationRepository = class extends WeeklyReportRepository {
  observationPaths: Set<string> | null = null;
  invalidatePath(path: string, isObservation: boolean | null = null) {
    if (this.observationPaths === null) return;
    if (isObservation === false) {
      this.observationPaths.delete(path);
      return;
    }
    this.observationPaths.add(path);
  }
  async list() {
    const results = [];
    const indexReady = this.observationPaths !== null;
    if (!indexReady) this.observationPaths = new Set();
    const files = indexReady
      ? [...this.observationPaths].map((path) => this.app.vault.getAbstractFileByPath(path)).filter((file) => file instanceof obsidian.TFile)
      : this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const cached = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (cached !== void 0 && cached?.["mind-trace-observation"] !== true) {
        this.observationPaths.delete(file.path);
        continue;
      }
      let content;
      try {
        content = await this.app.vault.cachedRead(file);
        const info = (0, obsidian.getFrontMatterInfo)(content);
        if (!info.exists) continue;
        const parsed = (0, obsidian.parseYaml)(info.frontmatter);
        if (parsed?.["mind-trace-observation"] !== true) {
          this.observationPaths.delete(file.path);
          continue;
        }
        this.observationPaths.add(file.path);
        const snapshot = parseObservationMarkdown(content, file.path);
        results.push({ file, snapshot, error: "" });
      } catch (error) {
        if (cached?.["mind-trace-observation"] === true || content?.includes("mind-trace-observation: true")) {
          this.observationPaths.add(file.path);
          results.push({ file, snapshot: null, error: errorMessage(error) });
        }
      }
    }
    results.sort((left, right) => String(right.snapshot?.generatedAt ?? "").localeCompare(String(left.snapshot?.generatedAt ?? "")) || right.file.stat.mtime - left.file.stat.mtime);
    return results;
  }
  async save(settings, snapshot, content = null) {
    const folder = observationFolder(settings);
    await this.ensureFolder(folder);
    const generated = new Date(snapshot.generatedAt || Date.now());
    const stem = observationFileStem(Number.isNaN(generated.getTime()) ? /* @__PURE__ */ new Date() : generated);
    let suffix = 1;
    let path = (0, obsidian.normalizePath)(`${folder}/${stem}.md`);
    while (this.app.vault.getAbstractFileByPath(path) !== null) {
      suffix += 1;
      path = (0, obsidian.normalizePath)(`${folder}/${stem}-${suffix}.md`);
    }
    this.assertOperational();
    const file = await this.app.vault.create(path, content ?? observationMarkdown(snapshot));
    this.observationPaths?.add(file.path);
    const verified = parseObservationMarkdown(await this.app.vault.cachedRead(file), file.path);
    return { file, snapshot: verified };
  }
  async updateFeedback(filePath, claimId, value, expectedMtime = null) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof obsidian.TFile)) throw new Error("观照文件已不存在");
    if (expectedMtime !== null && file.stat.mtime !== expectedMtime) throw new Error("观照文件已在其他位置修改，请重新打开后再校准");
    const startingMtime = file.stat.mtime;
    let updated = "";
    this.assertOperational();
    await this.app.vault.process(file, (content) => {
      this.assertOperational();
      const current = this.app.vault.getAbstractFileByPath(filePath);
      if (!(current instanceof obsidian.TFile) || current.stat.mtime !== startingMtime) {
        throw new Error("观照文件在校准期间发生了修改，请重新打开后再保存");
      }
      const snapshot = parseObservationMarkdown(content, file.path);
      if (!snapshot.analysis?.claims?.some((claim) => claim.key === claimId)) throw new Error("找不到要校准的观察条目");
      snapshot.feedback[claimId] = { status: ["confirmed", "partial", "rejected", "uncertain", "pending"].includes(value?.status) ? value.status : "pending", correction: String(value?.correction ?? "").slice(0, 800), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      updated = observationMarkdown(snapshot);
      return updated;
    });
    return parseObservationMarkdown(updated, file.path);
  }
};
