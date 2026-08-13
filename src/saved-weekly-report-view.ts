// src/saved-weekly-report-view.ts
import * as obsidian from "obsidian";
import { EVENT_KINDS, EVENT_KIND_LABELS, EVENT_LABEL_KINDS, EVENT_RELATION_LABEL_VALUES, EVENT_ROLES, EVENT_ROLE_LABEL_VALUES, EVENT_STATUSES, EVENT_STATUS_LABELS, EVENT_STATUS_LABEL_VALUES, EVENT_TYPE_LABELS, EVENT_TYPE_LABEL_VALUES, validateEvents } from "./conversation";
import { svgElement } from "./dashboard";
import { localDateString, localDayOrdinal, parseLocalDate } from "./date-utils";
import { errorMessage } from "./journal-view";
import { renderPrivacyGate } from "./privacy";
import { attachLlmActivityStatus, captureMindTraceContext, confirmMindTraceFileDeletion, openMindTraceOperation, restoreMindTraceContext } from "./providers";
import { mindTraceWindow } from "./runtime-preamble";
import { aggregateEventRecords, eventArgumentKey, eventElementKey, parseEventTraces, parseFrontmatter, renderEventLedger, renderEventTraces } from "./saved-journal";
import { PROVIDER_LABELS } from "./settings";
import { parseEventMarkdownText } from "./storage";
import { weeklyReportFrontmatterStatus } from "./weekly-report";

export { SavedWeeklyReportView, WEEKLY_REPORT_VIEW_TYPE, parseSavedReport, v4ReportEnumLabel, weeklyGeneratedAtText, weeklyReportSection };

var WEEKLY_REPORT_VIEW_TYPE = "mind-trace-weekly-report-view";
function weeklyReportSection(content, heading) {
  const marker = `## ${heading}`;
  const start = content.indexOf(marker);
  if (start === -1) {
    return "";
  }
  const contentStart = start + marker.length;
  const nextHeading = content.indexOf("\n## ", contentStart);
  return content.slice(contentStart, nextHeading === -1 ? content.length : nextHeading).trim();
}
function requiredWeeklyReportSection(content, heading) {
  const section = weeklyReportSection(content, heading);
  if (section.length === 0) {
    throw new Error(`周报缺少“${heading}”部分`);
  }
  return section;
}
function stripWeeklyInlineMarkdown(value) {
  return value.replace(/\*\*(.+?)\*\*/g, "$1").replace(/_(.+?)_/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}
function parseWeeklyEvidenceItems(section, label) {
  const items = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("- ")) {
      continue;
    }
    let text = line.slice(2).trim();
    let evidenceDates = [];
    const evidence = /\s*_（((?:\d{4}-\d{2}-\d{2})(?:、\d{4}-\d{2}-\d{2})*)）_\s*$/.exec(text);
    if (evidence !== null && evidence[1] !== void 0) {
      evidenceDates = evidence[1].split("、").filter((date) => parseLocalDate(date) !== null);
      text = text.slice(0, evidence.index).trim();
    }
    text = stripWeeklyInlineMarkdown(text);
    if (text.length > 0) {
      items.push({ text, evidenceDates });
    }
  }
  if (items.length === 0) {
    throw new Error(`周报的“${label}”没有可识别内容`);
  }
  return items;
}
function parseReportV4MarkdownItems(section) {
  const items = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("- ")) continue;
    let text = line.slice(2).trim();
    const refsMatch = /\s*<!--\s*mind-trace-event-refs:\s*([^>]+)-->\s*$/.exec(text);
    const eventRefs = refsMatch === null ? [] : refsMatch[1].split(",").map((value) => value.trim()).filter(Boolean);
    if (refsMatch !== null) text = text.slice(0, refsMatch.index).trim();
    const evidence = /\s*_（((?:\d{4}-\d{2}-\d{2})(?:、\d{4}-\d{2}-\d{2})*)）_\s*$/.exec(text);
    const evidenceDates = evidence === null ? [] : evidence[1].split("、").filter((date) => parseLocalDate(date) !== null);
    if (evidence !== null) text = text.slice(0, evidence.index).trim();
    text = stripWeeklyInlineMarkdown(text);
    if (text.length > 0) items.push({ text, evidenceDates, eventRefs });
  }
  return items;
}
function validWeeklyMetricValue(value, unit = null) {
  const normalized = stripWeeklyInlineMarkdown(value).replace(/\s+/g, " ");
  if (normalized === "—") {
    return normalized;
  }
  const unitPattern = unit === "天" || unit === "周" || unit === "份" ? `(?:\\s*${unit})?` : "";
  const pattern = new RegExp(`^[+-]?\\d+(?:\\.\\d+)?${unitPattern}$`);
  if (!pattern.test(normalized)) {
    throw new Error(`报告数字格式无法识别：${normalized}`);
  }
  return normalized;
}
function parseWeeklyMetrics(section) {
  const labels = {
    "记录日": "days",
    "心情": "mood",
    "精力": "energy",
    "压力": "stress"
  };
  const parsed: Record<string, any> = {};
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) {
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 3 || !(cells[0] in labels)) {
      continue;
    }
    const key = labels[cells[0]];
    const unit = key === "days" ? "天" : null;
    parsed[key] = {
      key,
      label: cells[0],
      current: validWeeklyMetricValue(cells[1], unit),
      delta: validWeeklyMetricValue(cells[2], unit)
    };
  }
  for (const key of ["mood", "energy", "stress"]) {
    if (parsed[key] === void 0) {
      throw new Error(`周报缺少${key === "mood" ? "心情" : key === "energy" ? "精力" : "压力"}对照数据`);
    }
    const currentValue = Number.parseFloat(parsed[key].current);
    const deltaValue = Number.parseFloat(parsed[key].delta);
    if (parsed[key].current !== "—" && (!Number.isFinite(currentValue) || currentValue < 1 || currentValue > 5)) {
      throw new Error(`周报${parsed[key].label}本周值应为 1–5`);
    }
    if (parsed[key].delta !== "—" && (!Number.isFinite(deltaValue) || Math.abs(deltaValue) > 4)) {
      throw new Error(`周报${parsed[key].label}变化量无法识别`);
    }
  }
  return [parsed.mood, parsed.energy, parsed.stress];
}
function parseWeeklyEmotion(section) {
  const lines = section.split("\n").map((line) => line.replace(/^>\s?/, "").trim());
  const clues = lines.filter((line) => line.startsWith("- ")).map((line) => stripWeeklyInlineMarkdown(line.slice(2))).filter((line) => line.length > 0);
  const alternativeLine = lines.find((line) => /^\*\*另一种可能：\*\*/.test(line));
  const alternative = alternativeLine === void 0 ? "" : stripWeeklyInlineMarkdown(alternativeLine.replace(/^\*\*另一种可能：\*\*/, ""));
  const hypothesis = lines.find((line) => line.length > 0 && !line.startsWith("[!note]") && !line.startsWith("- ") && !line.startsWith("**另一种可能")) ?? "";
  if (hypothesis.length === 0 || clues.length === 0 || alternative.length === 0) {
    throw new Error("AI 情绪假设格式无法识别");
  }
  return {
    hypothesis: stripWeeklyInlineMarkdown(hypothesis),
    clues,
    alternative
  };
}
function parseWeeklyThemes(section) {
  const themes = [...section.matchAll(/^- \*\*(.+?)\*\*：(.+)$/gm)].map((match) => ({
    name: stripWeeklyInlineMarkdown(match[1] ?? ""),
    observation: stripWeeklyInlineMarkdown(match[2] ?? "")
  })).filter((theme) => theme.name.length > 0 && theme.observation.length > 0);
  if (themes.length === 0) {
    throw new Error("周报主题格式无法识别");
  }
  return themes;
}
function parseWeeklyNextStep(section) {
  const actionMatch = /^\*\*(.+?)\*\*\s*$/m.exec(section);
  if (actionMatch === null || actionMatch[1] === void 0) {
    throw new Error("周报缺少下周行动");
  }
  const reason = stripWeeklyInlineMarkdown(section.slice(actionMatch.index + actionMatch[0].length));
  if (reason.length === 0) {
    throw new Error("周报缺少行动理由");
  }
  return {
    action: stripWeeklyInlineMarkdown(actionMatch[1]),
    reason
  };
}
function parseWeeklyEventSnapshot(section) {
  if (section.length === 0) {
    return null;
  }
  if (section.includes("本周尚没有可用的结构化事件") || section.includes("本月尚没有可用的结构化事件")) {
    return aggregateEventRecords([]);
  }
  const indexMarker = "### 事件索引";
  const indexStart = section.indexOf(indexMarker);
  if (indexStart === -1) {
    return null;
  }
  const eventSection = section.slice(indexStart + indexMarker.length).trim();
  const headings = [...eventSection.matchAll(/^#### (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · (.+?)\s*$/gm)];
  const records = [];
  for (const [index, heading] of headings.entries()) {
    const date = heading[1] ?? "";
    const time = heading[2] ?? "";
    const rawTitle = parseEventMarkdownText(heading[3] ?? "");
    const typeLabel = rawTitle.includes("｜") ? rawTitle.slice(0, rawTitle.indexOf("｜")).trim() : "";
    const type = EVENT_TYPE_LABEL_VALUES[typeLabel] ?? "other";
    const title = EVENT_TYPE_LABEL_VALUES[typeLabel] === void 0 ? rawTitle : rawTitle.slice(rawTitle.indexOf("｜") + 1).trim();
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? eventSection.length;
    const block = eventSection.slice(start, end);
    const summary = parseEventMarkdownText(/^- 概要：(.+)$/m.exec(block)?.[1] ?? "");
    const rawStatus = parseEventMarkdownText(/^- 状态｜(.+?)：/m.exec(block)?.[1] ?? "");
    const status = EVENT_STATUSES.includes(rawStatus) ? rawStatus : EVENT_STATUS_LABEL_VALUES[rawStatus];
    const traces = parseEventTraces(block);
    const arguments2 = [];
    for (const match of block.matchAll(/^- 论元｜(.+?)｜(.+?)｜(.+?)：(.+)$/gm)) {
      const roleCode = parseEventMarkdownText(match[1] ?? "related");
      const roleLabel = parseEventMarkdownText(match[2] ?? "相关");
      const kind = EVENT_LABEL_KINDS[parseEventMarkdownText(match[3] ?? "")] ?? "topic";
      const name = parseEventMarkdownText(match[4] ?? "");
      if (name.length > 0) {
        arguments2.push({ role: EVENT_ROLES.includes(roleCode) ? roleCode : EVENT_ROLE_LABEL_VALUES[roleLabel] ?? "related", label: roleLabel, entity: { kind, name } });
      }
    }
    if (arguments2.length === 0) {
      for (const match of block.matchAll(/^- 论元｜(.+?)｜(.+?)：(.+)$/gm)) {
        const roleLabel = parseEventMarkdownText(match[1] ?? "相关");
        const kind = EVENT_LABEL_KINDS[parseEventMarkdownText(match[2] ?? "")] ?? "topic";
        const name = parseEventMarkdownText(match[3] ?? "");
        if (name.length > 0) {
          arguments2.push({ role: EVENT_ROLE_LABEL_VALUES[roleLabel] ?? "related", label: roleLabel, entity: { kind, name } });
        }
      }
    }
    if (arguments2.length === 0) {
      for (const [label, kind] of Object.entries(EVENT_LABEL_KINDS)) {
        for (const match of block.matchAll(new RegExp(`^- ${label}：(.+)$`, "gm"))) {
          const name = parseEventMarkdownText(match[1] ?? "");
          if (name.length > 0) {
            arguments2.push({ role: "related", label: "相关", entity: { kind, name } });
          }
        }
      }
    }
    const relations = [];
    for (const match of block.matchAll(/^- 关系｜(.+?)｜(.+?)｜(.+?)：(.+?)｜(.+?)：(.+)$/gm)) {
      relations.push({
        type: EVENT_RELATION_LABEL_VALUES[parseEventMarkdownText(match[1] ?? "")] ?? "other",
        label: parseEventMarkdownText(match[2] ?? "相关"),
        subject: { kind: EVENT_LABEL_KINDS[parseEventMarkdownText(match[3] ?? "")] ?? "topic", name: parseEventMarkdownText(match[4] ?? "") },
        object: { kind: EVENT_LABEL_KINDS[parseEventMarkdownText(match[5] ?? "")] ?? "topic", name: parseEventMarkdownText(match[6] ?? "") }
      });
    }
    try {
      const event = validateEvents([{ type, status, title, summary, traces, arguments: arguments2, relations }])[0];
      records.push({ id: `snapshot#${index}`, filePath: "", sessionIndex: -1, eventIndex: index, date, time, ...event });
    } catch {
    }
  }
  return headings.length > 0 && records.length === 0 ? null : aggregateEventRecords(records);
}
function parseSavedWeeklyReport(content, frontmatter) {
  if (frontmatter["mind-trace-report"] !== true || frontmatter["report-type"] !== "weekly") {
    throw new Error("这不是可识别的心迹周报");
  }
  const reportVersion = Number(frontmatter["mind-trace-report-version"]);
  if (![3, 4].includes(reportVersion)) {
    throw new Error("周报版本无法识别");
  }
  const periodStart = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
  const periodEnd = typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "";
  if (parseLocalDate(periodStart) === null || parseLocalDate(periodEnd) === null || periodStart > periodEnd) {
    throw new Error("周报周期日期无法识别");
  }
  const sourceDays = Number(frontmatter["source-days"]);
  const sourceSessions = Number(frontmatter["source-sessions"]);
  if (!Number.isInteger(sourceDays) || sourceDays < 0 || !Number.isInteger(sourceSessions) || sourceSessions < 0) {
    throw new Error("周报记录数量无法识别");
  }
  const generatedAt = typeof frontmatter["generated-at"] === "string" ? frontmatter["generated-at"] : "";
  if (generatedAt.length === 0 || Number.isNaN(new Date(generatedAt).getTime())) {
    throw new Error("周报生成时间无法识别");
  }
  if (reportVersion === 4) {
    const eventSnapshot = parseWeeklyEventSnapshot(weeklyReportSection(content, "本周事件图谱"));
    const highlights = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "本周发生"));
    const progress = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "进展与状态"));
    const openLoops = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "尚未结束"));
    const themes = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "本周反复出现"));
    const carryForward = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "明确带到下周"));
    return {
      reportType: "weekly", reportVersion, periodStart, periodEnd,
      periodStatus: weeklyReportFrontmatterStatus(frontmatter), generatedAt, sourceDays, sourceSessions,
      eventCount: Number(frontmatter["event-count"] ?? eventSnapshot?.records.length ?? 0) || 0,
      eventCoveredSessions: Number(frontmatter["event-covered-sessions"] ?? 0) || 0,
      eventSourceSessions: Number(frontmatter["event-source-sessions"] ?? sourceSessions) || sourceSessions,
      eventSnapshot,
      summary: stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "一周概览")),
      metrics: parseWeeklyMetrics(requiredWeeklyReportSection(content, "本周数字")),
      highlights, progress, openLoops,
      themes: themes.map((item) => ({ ...item, name: item.text.split("：")[0] ?? "主题", observation: item.text.split("：").slice(1).join("：") || item.text })),
      carryForward,
      truncated: content.includes("> [!info] 本周日记较长")
    };
  }
  const summary = stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "一周概览"));
  const questionSection = requiredWeeklyReportSection(content, "留给自己的问题");
  const question = stripWeeklyInlineMarkdown(questionSection.split("\n> [!info]")[0] ?? "");
  if (summary.length === 0 || question.length === 0) {
    throw new Error("周报摘要或自我问题为空");
  }
  const keepPeriodDates = (items) => items.map((item) => ({
    ...item,
    evidenceDates: item.evidenceDates.filter((date) => date >= periodStart && date <= periodEnd)
  }));
  const eventSnapshot = parseWeeklyEventSnapshot(weeklyReportSection(content, "本周事件图谱"));
  const eventCount = Number(frontmatter["event-count"] ?? eventSnapshot?.records.length ?? 0);
  const eventCoveredSessions = Number(frontmatter["event-covered-sessions"] ?? 0);
  const eventSourceSessions = Number(frontmatter["event-source-sessions"] ?? sourceSessions);
  return {
    reportVersion,
    periodStart,
    periodEnd,
    periodStatus: weeklyReportFrontmatterStatus(frontmatter),
    generatedAt,
    sourceDays,
    sourceSessions,
    eventCount: Number.isInteger(eventCount) && eventCount >= 0 ? eventCount : 0,
    eventCoveredSessions: Number.isInteger(eventCoveredSessions) && eventCoveredSessions >= 0 ? eventCoveredSessions : 0,
    eventSourceSessions: Number.isInteger(eventSourceSessions) && eventSourceSessions >= 0 ? eventSourceSessions : sourceSessions,
    eventSnapshot,
    summary,
    metrics: parseWeeklyMetrics(requiredWeeklyReportSection(content, "本周数字")),
    changes: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "发生的变化"), "发生的变化")),
    possibleCauses: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "可能的原因"), "可能的原因")),
    emotion: parseWeeklyEmotion(requiredWeeklyReportSection(content, "AI 情绪假设")),
    themes: parseWeeklyThemes(requiredWeeklyReportSection(content, "反复出现的主题")),
    nextStep: parseWeeklyNextStep(requiredWeeklyReportSection(content, "下周最小的一步")),
    selfQuestion: question,
    truncated: content.includes("> [!info] 本周日记较长")
  };
}
function parseMonthlyMetrics(section) {
  const parsed: Record<string, any> = {};
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) {
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 3) {
      continue;
    }
    const labels = { "记录日": "days", "活跃周": "activeWeeks", "已生成周报": "activeWeeks", "心情": "mood", "精力": "energy", "压力": "stress" };
    const key = labels[cells[0]];
    if (key === void 0) {
      continue;
    }
    const unit = key === "days" ? "天" : key === "activeWeeks" ? cells[0] === "已生成周报" ? "份" : "周" : null;
    parsed[key] = { key, label: cells[0], current: validWeeklyMetricValue(cells[1], unit), delta: validWeeklyMetricValue(cells[2], unit) };
  }
  for (const key of ["mood", "energy", "stress"]) {
    if (parsed[key] === void 0) {
      throw new Error(`月报缺少${key === "mood" ? "心情" : key === "energy" ? "精力" : "压力"}对照数据`);
    }
  }
  return [parsed.mood, parsed.energy, parsed.stress];
}
function parseMonthlyRhythm(section, periodStart = "") {
  const weeks = [];
  for (const line of section.split("\n")) {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 6 || !/^\d{2}-\d{2}–\d{2}-\d{2}$/.test(cells[0])) {
      continue;
    }
    const [startLabel, endLabel] = cells[0].split("–");
    const anchor = parseLocalDate(periodStart) ?? new Date();
    const toDate = (value) => {
      const [month, day] = value.split("-").map(Number);
      const candidates = [-1, 0, 1].map((offset) => new Date(anchor.getFullYear() + offset, month - 1, day));
      candidates.sort((left, right) => Math.abs(localDayOrdinal(left) - localDayOrdinal(anchor)) - Math.abs(localDayOrdinal(right) - localDayOrdinal(anchor)));
      return localDateString(candidates[0]);
    };
    weeks.push({
      startLabel,
      endLabel,
      days: Number.parseInt(cells[1], 10) || 0,
      sessions: Number.parseInt(cells[2], 10) || 0,
      mood: cells[3] === "—" ? null : Number.parseFloat(cells[3]),
      energy: cells[4] === "—" ? null : Number.parseFloat(cells[4]),
      stress: cells[5] === "—" ? null : Number.parseFloat(cells[5]),
      start: toDate(startLabel),
      end: toDate(endLabel)
    });
  }
  let rhythm = [];
  try {
    rhythm = parseWeeklyEvidenceItems(section, "月内节奏");
  } catch {
    // v4 的确定性自然周表可以独立存在；模型没有额外节奏文字时不应让整份月报失效。
    rhythm = [];
  }
  return { weeks, rhythm };
}
function parseSavedMonthlyReport(content, frontmatter) {
  if (frontmatter["mind-trace-report"] !== true || frontmatter["report-type"] !== "monthly") {
    throw new Error("这不是可识别的心迹月报");
  }
  const reportVersion = Number(frontmatter["mind-trace-report-version"]);
  if (![3, 4].includes(reportVersion)) {
    throw new Error("月报版本无法识别");
  }
  const periodStart = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
  const periodEnd = typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "";
  if (parseLocalDate(periodStart) === null || parseLocalDate(periodEnd) === null || periodStart > periodEnd) {
    throw new Error("月报周期日期无法识别");
  }
  const periodStatus = frontmatter["period-status"] === "partial" ? "partial" : "complete";
  const comparisonStart = typeof frontmatter["comparison-start"] === "string" ? frontmatter["comparison-start"] : "";
  const comparisonEnd = typeof frontmatter["comparison-end"] === "string" ? frontmatter["comparison-end"] : "";
  if (parseLocalDate(comparisonStart) === null || parseLocalDate(comparisonEnd) === null || comparisonStart > comparisonEnd) {
    throw new Error("月报对照周期日期无法识别");
  }
  const sourceDays = Number(frontmatter["source-days"]);
  const sourceSessions = Number(frontmatter["source-sessions"]);
  const activeWeeks = Number(frontmatter["source-active-weeks"]);
  if (![sourceDays, sourceSessions, activeWeeks].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("月报记录数量无法识别");
  }
  const generatedAt = typeof frontmatter["generated-at"] === "string" ? frontmatter["generated-at"] : "";
  if (generatedAt.length === 0 || Number.isNaN(new Date(generatedAt).getTime())) {
    throw new Error("月报生成时间无法识别");
  }
  if (reportVersion === 4) {
    const rhythmSection = requiredWeeklyReportSection(content, "月内节奏");
    const parsedRhythm = parseMonthlyRhythm(rhythmSection, periodStart);
    const eventSnapshot = parseWeeklyEventSnapshot(weeklyReportSection(content, "本月事件图谱"));
    const turningPoints = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "跨周转折"));
    const themeEvolution = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "主题如何演变"));
    const threads = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "持续推进与停滞"));
    const carryForward = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "带入下月的未决事项"));
    return {
      reportType: "monthly", reportVersion, periodStart, periodEnd, periodStatus, comparisonStart, comparisonEnd, generatedAt,
      sourceDays, sourceSessions, activeWeeks,
      eventCount: Number(frontmatter["event-count"] ?? eventSnapshot?.records.length ?? 0) || 0,
      eventCoveredSessions: Number(frontmatter["event-covered-sessions"] ?? 0) || 0,
      eventSourceSessions: Number(frontmatter["event-source-sessions"] ?? sourceSessions) || sourceSessions,
      eventSnapshot,
      summary: stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "本月概览")),
      metrics: parseMonthlyMetrics(requiredWeeklyReportSection(content, "本月数字")),
      weekStats: parsedRhythm.weeks, rhythm: parsedRhythm.rhythm,
      turningPoints, themeEvolution, threads, carryForward,
      truncated: content.includes("> [!info] 本月日记较长")
    };
  }
  const summary = stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "本月概览"));
  const question = stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "留给自己的问题"));
  const rhythmSection = requiredWeeklyReportSection(content, "月内节奏");
  const parsedRhythm = parseMonthlyRhythm(rhythmSection, periodStart);
  const keepPeriodDates = (items) => items.map((item) => ({ ...item, evidenceDates: item.evidenceDates.filter((date) => date >= periodStart && date <= periodEnd) }));
  const eventSnapshot = parseWeeklyEventSnapshot(weeklyReportSection(content, "本月事件图谱"));
  const eventCount = Number(frontmatter["event-count"] ?? eventSnapshot?.records.length ?? 0);
  const eventCoveredSessions = Number(frontmatter["event-covered-sessions"] ?? 0);
  const eventSourceSessions = Number(frontmatter["event-source-sessions"] ?? sourceSessions);
  return {
    reportType: "monthly",
    reportVersion,
    periodStart,
    periodEnd,
    periodStatus,
    comparisonStart,
    comparisonEnd,
    generatedAt,
    sourceDays,
    sourceSessions,
    activeWeeks,
    eventCount: Number.isInteger(eventCount) && eventCount >= 0 ? eventCount : 0,
    eventCoveredSessions: Number.isInteger(eventCoveredSessions) && eventCoveredSessions >= 0 ? eventCoveredSessions : 0,
    eventSourceSessions: Number.isInteger(eventSourceSessions) && eventSourceSessions >= 0 ? eventSourceSessions : sourceSessions,
    eventSnapshot,
    summary,
    metrics: parseMonthlyMetrics(requiredWeeklyReportSection(content, "本月数字")),
    weekStats: parsedRhythm.weeks,
    rhythm: parsedRhythm.rhythm,
    changes: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "发生的变化"), "发生的变化")),
    possibleCauses: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "可能的原因"), "可能的原因")),
    emotion: parseWeeklyEmotion(requiredWeeklyReportSection(content, "AI 情绪假设")),
    themes: parseWeeklyThemes(requiredWeeklyReportSection(content, "反复出现的主题")),
    nextStep: parseWeeklyNextStep(requiredWeeklyReportSection(content, "下月最小的一步")),
    selfQuestion: question,
    truncated: content.includes("> [!info] 本月日记较长")
  };
}
function parseSavedReport(content, frontmatter) {
  return frontmatter["report-type"] === "monthly" ? parseSavedMonthlyReport(content, frontmatter) : parseSavedWeeklyReport(content, frontmatter);
}
function weeklyGeneratedAtText(value) {
  const date = new Date(value);
  if (value.length === 0 || Number.isNaN(date.getTime())) {
    return "生成时间未记录";
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} 生成`;
}
function weeklyMetricDeltaClass(metric) {
  const value = Number.parseFloat(metric.delta);
  if (!Number.isFinite(value) || value === 0) {
    return "is-neutral";
  }
  const favorable = metric.key === "stress" ? value < 0 : value > 0;
  return favorable ? "is-favorable" : "is-unfavorable";
}
function renderWeeklyEvidenceRows(container, items, kind, onOpenEvidenceDate = null) {
  for (const item of items) {
    const row = container.createDiv({ cls: "mind-trace-weekly-evidence-row" });
    row.createSpan({ cls: "mind-trace-weekly-evidence-mark", text: kind });
    const copy = row.createDiv();
    copy.createDiv({ cls: "mind-trace-saved-copy", text: item.text });
    if (item.evidenceDates.length > 0) {
      const dates = copy.createDiv({ cls: "mind-trace-weekly-evidence-dates", attr: { "aria-label": "文字证据日期" } });
      for (const date of item.evidenceDates) {
        if (onOpenEvidenceDate === null) {
          dates.createEl("time", { text: date.slice(5).replace("-", "/"), attr: { datetime: date, title: date } });
        } else {
          const button = dates.createEl("button", {
            text: date.slice(5).replace("-", "/"),
            attr: { type: "button", title: date, "aria-label": `打开 ${date} 的日记` }
          });
          button.addEventListener("click", () => onOpenEvidenceDate(date));
        }
      }
    }
  }
}
function eventAggregateSignature(aggregate) {
  if (aggregate === null || aggregate === void 0) {
    return "";
  }
  return aggregate.records.map((record) => `${record.date}|${record.time}|${record.type}|${record.title}|${record.summary}|${eventRecordArguments(record).map((argument) => `${argument.role}:${eventArgumentKey(argument)}`).sort().join(",")}|${(record.relations ?? []).map((relation) => `${relation.type}:${eventElementKey(relation.subject)}:${eventElementKey(relation.object)}:${relation.label}`).sort().join(",")}`).sort().join("\n");
}
function eventRecordArguments(record) {
  if (Array.isArray(record.arguments) && record.arguments.length > 0) {
    return record.arguments;
  }
  return (record.elements ?? []).map((entity) => ({ role: "related", label: "相关", entity }));
}
function memoryStarHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function memoryStarClamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
function memoryStarCurve(left, right, seed) {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = memoryStarHash(seed) % 31 - 15;
  const middleX = (left.x + right.x) / 2 - dy / distance * bend;
  const middleY = (left.y + right.y) / 2 + dx / distance * bend;
  return {
    path: `M ${left.x.toFixed(1)} ${left.y.toFixed(1)} Q ${middleX.toFixed(1)} ${middleY.toFixed(1)} ${right.x.toFixed(1)} ${right.y.toFixed(1)}`,
    label: { x: middleX, y: middleY - 6 }
  };
}
function layoutMemoryStarGraph(records, entities, argumentLinks, relationLinks, targetWidth) {
  const nodes = [];
  for (const record of records) {
    nodes.push({
      key: `event:${record.id}`,
      nodeKind: "event",
      eventId: record.id,
      collisionRadius: 72,
      degree: 0
    });
  }
  for (const entity of entities.values()) {
    const radius = Math.min(27, 16 + entity.eventIds.size * 2);
    const labelWidth = Math.min(112, Math.max(48, entity.name.length * 11 + 14));
    nodes.push({
      key: `entity:${entity.key}`,
      nodeKind: "entity",
      entityKey: entity.key,
      radius,
      collisionRadius: Math.max(radius + 12, labelWidth / 2),
      degree: 0
    });
  }
  const nodeMap = new Map(nodes.map((node) => [node.key, node]));
  const adjacency = new Map(nodes.map((node) => [node.key, /* @__PURE__ */ new Set()]));
  const springs = [];
  const addSpring = (leftKey, rightKey, length, strength) => {
    if (!nodeMap.has(leftKey) || !nodeMap.has(rightKey)) return;
    adjacency.get(leftKey)?.add(rightKey);
    adjacency.get(rightKey)?.add(leftKey);
    nodeMap.get(leftKey).degree += 1;
    nodeMap.get(rightKey).degree += 1;
    springs.push({ leftKey, rightKey, length, strength });
  };
  for (const link of argumentLinks) {
    addSpring(`event:${link.eventId}`, `entity:${link.entityKey}`, 142, 0.034);
  }
  for (const link of relationLinks) {
    addSpring(`entity:${link.leftKey}`, `entity:${link.rightKey}`, 112, 0.018);
  }
  const components = [];
  const visited = /* @__PURE__ */ new Set();
  for (const start of [...nodes].sort((left, right) => left.key.localeCompare(right.key))) {
    if (visited.has(start.key)) continue;
    const queue = [start.key];
    const componentNodes = [];
    visited.add(start.key);
    while (queue.length > 0) {
      const key = queue.shift();
      const node = nodeMap.get(key);
      if (node !== void 0) componentNodes.push(node);
      for (const neighbor of [...(adjacency.get(key) ?? [])].sort()) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(componentNodes);
  }
  const positionedComponents = components.map((componentNodes) => {
    const componentKeys = new Set(componentNodes.map((node) => node.key));
    const componentSprings = springs.filter((spring) => componentKeys.has(spring.leftKey) && componentKeys.has(spring.rightKey));
    const estimatedArea = componentNodes.reduce((sum, node) => sum + Math.PI * (node.collisionRadius + 16) ** 2, 0);
    const naturalSide = Math.sqrt(Math.max(1, estimatedArea) * 1.62);
    const boxWidth = memoryStarClamp(naturalSide * 1.22, 270, 1880);
    const boxHeight = Math.max(230, estimatedArea * 1.62 / boxWidth);
    const centerX = boxWidth / 2;
    const centerY = boxHeight / 2;
    const positions = new Map();
    [...componentNodes].sort((left, right) => right.degree - left.degree || left.key.localeCompare(right.key)).forEach((node, index) => {
      const seed = memoryStarHash(node.key);
      const angle = (seed % 360 + index * 137.508) * Math.PI / 180;
      const spread = Math.min(boxWidth, boxHeight) * (0.08 + 0.32 * Math.sqrt(index / Math.max(1, componentNodes.length - 1)));
      positions.set(node.key, {
        x: centerX + Math.cos(angle) * spread,
        y: centerY + Math.sin(angle) * spread,
        vx: 0,
        vy: 0,
        node
      });
    });
    const iterations = componentNodes.length > 180 ? 105 : componentNodes.length > 80 ? 135 : 175;
    const cellSize = 190;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const force = new Map<string, { x: number; y: number }>(componentNodes.map((node) => [node.key, { x: 0, y: 0 }]));
      const grid = /* @__PURE__ */ new Map();
      for (const position of positions.values()) {
        const cellX = Math.floor(position.x / cellSize);
        const cellY = Math.floor(position.y / cellSize);
        const key = `${cellX}:${cellY}`;
        const bucket = grid.get(key) ?? [];
        bucket.push(position);
        grid.set(key, bucket);
      }
      const ordered = [...positions.values()].sort((left, right) => left.node.key.localeCompare(right.node.key));
      const orderIndex = new Map(ordered.map((position, index) => [position.node.key, index]));
      ordered.forEach((left, leftIndex) => {
        const cellX = Math.floor(left.x / cellSize);
        const cellY = Math.floor(left.y / cellSize);
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (const right of grid.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
              const rightIndex = orderIndex.get(right.node.key) ?? -1;
              if (rightIndex <= leftIndex) continue;
              let dx = right.x - left.x;
              let dy = right.y - left.y;
              let distance = Math.hypot(dx, dy);
              if (distance < 0.01) {
                const seed = memoryStarHash(`${left.node.key}|${right.node.key}`);
                dx = seed % 2 === 0 ? 0.1 : -0.1;
                dy = seed % 3 === 0 ? 0.1 : -0.1;
                distance = Math.hypot(dx, dy);
              }
              if (distance > 230) continue;
              const minimumDistance = left.node.collisionRadius + right.node.collisionRadius + 13;
              const push = 5200 / Math.max(900, distance * distance) + Math.max(0, minimumDistance - distance) * 0.115;
              const unitX = dx / distance;
              const unitY = dy / distance;
              force.get(left.node.key).x -= unitX * push;
              force.get(left.node.key).y -= unitY * push;
              force.get(right.node.key).x += unitX * push;
              force.get(right.node.key).y += unitY * push;
            }
          }
        }
      });
      for (const spring of componentSprings) {
        const left = positions.get(spring.leftKey);
        const right = positions.get(spring.rightKey);
        if (left === void 0 || right === void 0) continue;
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.max(0.01, Math.hypot(dx, dy));
        const pull = (distance - spring.length) * spring.strength;
        const unitX = dx / distance;
        const unitY = dy / distance;
        force.get(left.node.key).x += unitX * pull;
        force.get(left.node.key).y += unitY * pull;
        force.get(right.node.key).x -= unitX * pull;
        force.get(right.node.key).y -= unitY * pull;
      }
      for (const position of positions.values()) {
        const centering = 0.0045 + Math.min(0.008, position.node.degree * 8e-4);
        const currentForce = force.get(position.node.key);
        currentForce.x += (centerX - position.x) * centering;
        currentForce.y += (centerY - position.y) * centering;
        position.vx = (position.vx + currentForce.x) * 0.76;
        position.vy = (position.vy + currentForce.y) * 0.76;
        const speed = Math.hypot(position.vx, position.vy);
        if (speed > 9) {
          position.vx = position.vx / speed * 9;
          position.vy = position.vy / speed * 9;
        }
        position.x = memoryStarClamp(position.x + position.vx, position.node.collisionRadius + 24, boxWidth - position.node.collisionRadius - 24);
        position.y = memoryStarClamp(position.y + position.vy, position.node.collisionRadius + 24, boxHeight - position.node.collisionRadius - 24);
      }
    }
    const collisionOrder = [...positions.values()].sort((left, right) => left.node.key.localeCompare(right.node.key));
    const collisionIndex = new Map(collisionOrder.map((position, index) => [position.node.key, index]));
    const collisionPasses = Math.min(180, 64 + Math.ceil(Math.sqrt(componentNodes.length) * 5));
    for (let pass = 0; pass < collisionPasses; pass += 1) {
      const grid = /* @__PURE__ */ new Map();
      for (const position of collisionOrder) {
        const cellX = Math.floor(position.x / cellSize);
        const cellY = Math.floor(position.y / cellSize);
        const key = `${cellX}:${cellY}`;
        const bucket = grid.get(key) ?? [];
        bucket.push(position);
        grid.set(key, bucket);
      }
      let maximumOverlap = 0;
      collisionOrder.forEach((left, leftIndex) => {
        const cellX = Math.floor(left.x / cellSize);
        const cellY = Math.floor(left.y / cellSize);
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (const right of grid.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
              if ((collisionIndex.get(right.node.key) ?? -1) <= leftIndex) continue;
              let dx = right.x - left.x;
              let dy = right.y - left.y;
              let distance = Math.hypot(dx, dy);
              const minimumDistance = left.node.collisionRadius + right.node.collisionRadius + 14;
              if (distance >= minimumDistance) continue;
              if (distance < 0.01) {
                const seed = memoryStarHash(`collision:${left.node.key}|${right.node.key}`);
                const angle = seed % 360 * Math.PI / 180;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
                distance = 1;
              }
              const overlap = minimumDistance - distance;
              maximumOverlap = Math.max(maximumOverlap, overlap);
              const shift = overlap * 0.7;
              const unitX = dx / distance;
              const unitY = dy / distance;
              left.x -= unitX * shift;
              left.y -= unitY * shift;
              right.x += unitX * shift;
              right.y += unitY * shift;
            }
          }
        }
      });
      if (maximumOverlap < 0.45) break;
    }
    const values = [...positions.values()];
    const minimumX = Math.min(...values.map((position) => position.x - position.node.collisionRadius)) - 30;
    const maximumX = Math.max(...values.map((position) => position.x + position.node.collisionRadius)) + 30;
    const minimumY = Math.min(...values.map((position) => position.y - position.node.collisionRadius)) - 30;
    const maximumY = Math.max(...values.map((position) => position.y + position.node.collisionRadius)) + 38;
    return {
      positions,
      minimumX,
      minimumY,
      width: Math.max(190, maximumX - minimumX),
      height: Math.max(170, maximumY - minimumY)
    };
  }).sort((left, right) => right.width * right.height - left.width * left.height);
  const padding = 34;
  const gap = 24;
  const packComponents = (shelfWidth) => {
    let cursorX = padding;
    let cursorY = padding;
    let rowHeight = 0;
    let maximumX = 0;
    const eventPositions = /* @__PURE__ */ new Map();
    const entityPositions = /* @__PURE__ */ new Map();
    for (const component of positionedComponents) {
      if (cursorX > padding && cursorX + component.width > shelfWidth) {
        cursorX = padding;
        cursorY += rowHeight + gap;
        rowHeight = 0;
      }
      const offsetX = cursorX - component.minimumX;
      const offsetY = cursorY - component.minimumY;
      for (const position of component.positions.values()) {
        const point = { x: position.x + offsetX, y: position.y + offsetY };
        if (position.node.nodeKind === "event") eventPositions.set(position.node.eventId, point);
        else entityPositions.set(position.node.entityKey, point);
      }
      cursorX += component.width + gap;
      rowHeight = Math.max(rowHeight, component.height);
      maximumX = Math.max(maximumX, cursorX - gap);
    }
    return {
      eventPositions,
      entityPositions,
      width: Math.max(680, maximumX + padding),
      height: Math.max(460, cursorY + rowHeight + padding)
    };
  };
  let shelfWidth = Math.max(680, targetWidth);
  let packed = packComponents(shelfWidth);
  for (let attempt = 0; attempt < 10 && packed.height > packed.width * 1.4; attempt += 1) {
    shelfWidth = Math.ceil(shelfWidth * 1.5);
    packed = packComponents(shelfWidth);
  }
  return {
    eventPositions: packed.eventPositions,
    entityPositions: packed.entityPositions,
    width: packed.width,
    height: packed.height
  };
}
function renderMemoryStarGraph(container, aggregate, options: any = {}) {
  const idCounts = /* @__PURE__ */ new Map();
  const allRecords = aggregate.records.map((record, index) => {
    const baseId = typeof record.id === "string" && record.id.length > 0 ? record.id : `record-${index}`;
    const count = idCounts.get(baseId) ?? 0;
    idCounts.set(baseId, count + 1);
    return count === 0 ? { ...record, id: baseId } : { ...record, id: `${baseId}#${count}` };
  });
  const eventLimit = Math.max(1, Math.min(allRecords.length, Number(options.eventLimit) || allRecords.length));
  const entityFrequency = /* @__PURE__ */ new Map();
  for (const record of allRecords) {
    for (const key of new Set(eventRecordArguments(record).map(eventArgumentKey))) {
      entityFrequency.set(key, (entityFrequency.get(key) ?? 0) + 1);
    }
  }
  const visibleRecords = [...allRecords].sort((left, right) => {
    const score = (record) => eventRecordArguments(record).reduce((sum, argument) => sum + (entityFrequency.get(eventArgumentKey(argument)) ?? 0), 0) + (record.relations?.length ?? 0) * 2 + eventRecordArguments(record).length;
    return score(right) - score(left) || left.date.localeCompare(right.date) || left.time.localeCompare(right.time);
  }).slice(0, eventLimit).sort((left, right) => left.id.localeCompare(right.id));
  const visibleEventIds = new Set(visibleRecords.map((record) => record.id));
  const entities = /* @__PURE__ */ new Map();
  const argumentLinks = [];
  const relationLinks = [];
  for (const record of visibleRecords) {
    for (const argument of eventRecordArguments(record)) {
      const key = eventArgumentKey(argument);
      const current = entities.get(key) ?? { key, ...argument.entity, eventIds: /* @__PURE__ */ new Set(), roles: /* @__PURE__ */ new Map() };
      current.eventIds.add(record.id);
      current.roles.set(record.id, argument.label);
      entities.set(key, current);
      argumentLinks.push({ eventId: record.id, entityKey: key, label: argument.label });
    }
    for (const relation of record.relations ?? []) {
      relationLinks.push({
        eventId: record.id,
        leftKey: eventElementKey(relation.subject),
        rightKey: eventElementKey(relation.object),
        label: relation.label
      });
    }
  }
  const layout = layoutMemoryStarGraph(visibleRecords, entities, argumentLinks, relationLinks, Math.max(680, Math.min(1180, (container.clientWidth || 880) * 1.3)));
  const { eventPositions, entityPositions, width, height } = layout;
  container.empty();
  const shell = container.createDiv({ cls: "mind-trace-memory-layout" });
  const stage = shell.createDiv({ cls: "mind-trace-memory-stage" });
  const inspector = shell.createEl("aside", { cls: "mind-trace-memory-inspector", attr: { "aria-live": "polite", "aria-label": "图谱节点详情" } });
  const toolbar = stage.createDiv({ cls: "mind-trace-memory-toolbar", attr: { "aria-label": "图谱缩放工具" } });
  const zoomOut = toolbar.createEl("button", { attr: { type: "button", "aria-label": "缩小图谱", title: "缩小" } });
  (0, obsidian.setIcon)(zoomOut, "minus");
  const zoomReset = toolbar.createEl("button", { text: "适合", attr: { type: "button", "aria-label": "重置图谱视图", title: "适合画布" } });
  const zoomIn = toolbar.createEl("button", { attr: { type: "button", "aria-label": "放大图谱", title: "放大" } });
  (0, obsidian.setIcon)(zoomIn, "plus");
  const svg = svgElement(container, "svg", { viewBox: `0 0 ${width} ${height}`, role: "group", "aria-label": options.ariaLabel ?? "事件与论元记忆星图" });
  svg.classList.add("mind-trace-memory-star");
  const viewport = svgElement(container, "g", { class: "mind-trace-memory-viewport" });
  const edgeLayer = svgElement(container, "g", { class: "mind-trace-memory-edge-layer" });
  const relationLayer = svgElement(container, "g", { class: "mind-trace-memory-relation-layer" });
  for (const link of argumentLinks) {
      const eventPoint = eventPositions.get(link.eventId);
      const entityPoint = entityPositions.get(link.entityKey);
      if (eventPoint === void 0 || entityPoint === void 0) continue;
      const curve = memoryStarCurve(eventPoint, entityPoint, `${link.eventId}|${link.entityKey}`);
      const path = svgElement(container, "path", { d: curve.path, class: "mind-trace-memory-argument-edge", "data-event": link.eventId, "data-entity": link.entityKey });
      edgeLayer.append(path);
      const role = svgElement(container, "text", { x: String(curve.label.x), y: String(curve.label.y), "text-anchor": "middle", class: "mind-trace-memory-role-label", "data-event": link.eventId, "data-entity": link.entityKey });
      role.textContent = link.label;
      edgeLayer.append(role);
  }
  for (const link of relationLinks) {
      const left = entityPositions.get(link.leftKey);
      const right = entityPositions.get(link.rightKey);
      if (left === void 0 || right === void 0) continue;
      const curve = memoryStarCurve(left, right, `relation:${link.eventId}|${link.leftKey}|${link.rightKey}`);
      relationLayer.append(svgElement(container, "path", { d: curve.path, class: "mind-trace-memory-relation-edge", "data-event": link.eventId, "data-left": link.leftKey, "data-right": link.rightKey }));
      const label = svgElement(container, "text", { x: String(curve.label.x), y: String(curve.label.y), "text-anchor": "middle", class: "mind-trace-memory-relation-label", "data-event": link.eventId });
      label.textContent = link.label;
      relationLayer.append(label);
  }
  viewport.append(edgeLayer, relationLayer);
  const eventNodes = [];
  for (const record of visibleRecords) {
    const point = eventPositions.get(record.id);
    if (point === void 0) continue;
    const node = svgElement(container, "g", { class: `mind-trace-memory-event-node is-${record.type ?? "other"}`, "data-event": record.id, tabindex: "-1", role: "button", "aria-pressed": "false", "aria-label": `${EVENT_TYPE_LABELS[record.type] ?? "事件"}：${record.title}` });
    node.append(svgElement(container, "rect", { x: String(point.x - 68), y: String(point.y - 27), width: "136", height: "54", rx: "17" }));
    const type = svgElement(container, "text", { x: String(point.x), y: String(point.y - 7), "text-anchor": "middle", class: "mind-trace-memory-event-type" });
    type.textContent = EVENT_TYPE_LABELS[record.type] ?? "事件";
    const title = svgElement(container, "text", { x: String(point.x), y: String(point.y + 12), "text-anchor": "middle", class: "mind-trace-memory-event-title" });
    title.textContent = record.title.length > 11 ? `${record.title.slice(0, 11)}…` : record.title;
    node.append(type, title);
    viewport.append(node);
    eventNodes.push(node);
  }
  const entityNodes = [];
  for (const entity of entities.values()) {
    const point = entityPositions.get(entity.key);
    if (point === void 0) continue;
    const node = svgElement(container, "g", { class: `mind-trace-memory-entity-node is-${entity.kind}`, "data-entity": entity.key, tabindex: "-1", role: "button", "aria-pressed": "false", "aria-label": `${EVENT_KIND_LABELS[entity.kind]} ${entity.name}，参与 ${entity.eventIds.size} 件事件` });
    const radius = Math.min(25, 15 + entity.eventIds.size * 2);
    if (["organization", "project", "product"].includes(entity.kind)) {
      node.append(svgElement(container, "rect", { x: String(point.x - radius), y: String(point.y - radius), width: String(radius * 2), height: String(radius * 2), rx: entity.kind === "organization" ? "5" : "10" }));
    } else if (["place", "activity"].includes(entity.kind)) {
      node.append(svgElement(container, "polygon", { points: `${point.x},${point.y - radius} ${point.x + radius},${point.y} ${point.x},${point.y + radius} ${point.x - radius},${point.y}` }));
    } else {
      node.append(svgElement(container, "circle", { cx: String(point.x), cy: String(point.y), r: String(radius) }));
    }
    const glyph = svgElement(container, "text", { x: String(point.x), y: String(point.y + 4), "text-anchor": "middle", class: "mind-trace-memory-entity-glyph" });
    glyph.textContent = EVENT_KIND_LABELS[entity.kind].slice(0, 1);
    const label = svgElement(container, "text", { x: String(point.x), y: String(point.y + radius + 16), "text-anchor": "middle", class: "mind-trace-memory-entity-label" });
    label.textContent = entity.name.length > 9 ? `${entity.name.slice(0, 9)}…` : entity.name;
    node.append(glyph, label);
    viewport.append(node);
    entityNodes.push(node);
  }
  svg.append(viewport);
  stage.append(svg);
  let activeEvent = visibleRecords.some((record) => record.id === options.initialState?.activeEvent) ? options.initialState.activeEvent : null;
  let activeEntity = entities.has(options.initialState?.activeEntity) ? options.initialState.activeEntity : null;
  const interactiveNodes = [...eventNodes, ...entityNodes];
  const rovingStart = interactiveNodes.find((node) => node.getAttribute("data-event") === activeEvent || node.getAttribute("data-entity") === activeEntity) ?? interactiveNodes[0];
  rovingStart?.setAttribute("tabindex", "0");
  const setRovingNode = (node, focus = false) => {
    for (const candidate of interactiveNodes) candidate.setAttribute("tabindex", candidate === node ? "0" : "-1");
    if (focus) node.focus();
  };
  const moveNodeFocus = (node, offset) => {
    const index = interactiveNodes.indexOf(node);
    if (index < 0 || interactiveNodes.length === 0) return;
    const target = interactiveNodes[(index + offset + interactiveNodes.length) % interactiveNodes.length];
    setRovingNode(target, true);
  };
  const timeText = (record) => typeof record.time === "string" && /^\d{2}:\d{2}/.test(record.time) ? record.time.slice(0, 5) : "未记录具体时间";
  const renderInspector = () => {
    inspector.empty();
    if (activeEvent === null && activeEntity === null) {
      inspector.createDiv({ cls: "mind-trace-memory-inspector-kicker", text: "节点详情" });
      inspector.createEl("h3", { text: "从一颗星开始" });
      inspector.createEl("p", { cls: "mind-trace-memory-inspector-empty", text: "选择事件查看发生时间、概要和论元；选择实体查看它连接的全部事件。" });
      return;
    }
    if (activeEvent !== null) {
      const record = allRecords.find((candidate) => candidate.id === activeEvent);
      if (record === void 0) return;
      inspector.createDiv({ cls: "mind-trace-memory-inspector-kicker", text: EVENT_TYPE_LABELS[record.type] ?? "事件" });
      inspector.createEl("h3", { text: record.title });
      const when = inspector.createEl("time", {
        cls: "mind-trace-memory-inspector-time",
        text: `${record.date} · ${timeText(record)}`,
        attr: { datetime: timeText(record) === "未记录具体时间" ? record.date : `${record.date}T${timeText(record)}` }
      });
      when.setAttribute("title", "事件发生时间");
      inspector.createEl("p", { cls: "mind-trace-memory-inspector-summary", text: record.summary });
      inspector.createDiv({ cls: "mind-trace-memory-inspector-count", text: `进展 · ${EVENT_STATUS_LABELS[record.status] ?? "待确认"}` });
      renderEventTraces(inspector, record.traces);
      const argumentTitle = inspector.createDiv({ cls: "mind-trace-memory-inspector-label", text: `论元 · ${eventRecordArguments(record).length}` });
      argumentTitle.setAttribute("role", "heading");
      argumentTitle.setAttribute("aria-level", "4");
      const argumentsList = inspector.createDiv({ cls: "mind-trace-memory-inspector-arguments" });
      for (const argument of eventRecordArguments(record)) {
        const item = argumentsList.createDiv({ cls: `mind-trace-memory-inspector-argument is-${argument.entity.kind}` });
        item.createSpan({ text: argument.label });
        item.createEl("strong", { text: argument.entity.name });
        item.createEl("small", { text: EVENT_KIND_LABELS[argument.entity.kind] });
      }
      if ((record.relations ?? []).length > 0) {
        inspector.createDiv({ cls: "mind-trace-memory-inspector-label", text: `明确关系 · ${record.relations.length}` });
        const relations = inspector.createDiv({ cls: "mind-trace-memory-inspector-relations" });
        for (const relation of record.relations) {
          relations.createDiv({ text: `${relation.subject.name} —${relation.label}→ ${relation.object.name}` });
        }
      }
      return;
    }
    const entity = entities.get(activeEntity) ?? aggregate.nodes.find((node) => node.key === activeEntity);
    const related = allRecords.filter((record) => eventRecordArguments(record).some((argument) => eventArgumentKey(argument) === activeEntity)).sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time));
    inspector.createDiv({ cls: "mind-trace-memory-inspector-kicker", text: entity === void 0 ? "实体" : EVENT_KIND_LABELS[entity.kind] });
    inspector.createEl("h3", { text: entity?.name ?? "论元" });
    inspector.createDiv({ cls: "mind-trace-memory-inspector-count", text: `连接 ${related.length} 件事件` });
    const relatedList = inspector.createDiv({ cls: "mind-trace-memory-inspector-events" });
    for (const record of related) {
      const item = relatedList.createDiv({ cls: "mind-trace-memory-inspector-event" });
      item.createEl("time", { text: `${record.date} · ${timeText(record)}`, attr: { datetime: timeText(record) === "未记录具体时间" ? record.date : `${record.date}T${timeText(record)}` } });
      item.createEl("strong", { text: record.title });
      item.createSpan({ text: EVENT_TYPE_LABELS[record.type] ?? "事件" });
    }
  };
  const paint = () => {
    const activeEvents = /* @__PURE__ */ new Set();
    const activeEntities = /* @__PURE__ */ new Set();
    if (activeEvent !== null) {
      activeEvents.add(activeEvent);
      const record = visibleRecords.find((candidate) => candidate.id === activeEvent);
      for (const argument of record === void 0 ? [] : eventRecordArguments(record)) activeEntities.add(eventArgumentKey(argument));
    } else if (activeEntity !== null) {
      activeEntities.add(activeEntity);
      for (const record of visibleRecords) {
        if (eventRecordArguments(record).some((argument) => eventArgumentKey(argument) === activeEntity)) {
          activeEvents.add(record.id);
          for (const argument of eventRecordArguments(record)) activeEntities.add(eventArgumentKey(argument));
        }
      }
    }
    const selecting = activeEvent !== null || activeEntity !== null;
    for (const node of eventNodes) {
      const id = node.getAttribute("data-event") ?? "";
      node.classList.toggle("is-active", selecting && activeEvents.has(id));
      node.classList.toggle("is-dimmed", selecting && !activeEvents.has(id));
      node.setAttribute("aria-pressed", String(activeEvent === id));
    }
    for (const node of entityNodes) {
      const key = node.getAttribute("data-entity") ?? "";
      node.classList.toggle("is-active", selecting && activeEntities.has(key));
      node.classList.toggle("is-dimmed", selecting && !activeEntities.has(key));
      node.setAttribute("aria-pressed", String(activeEntity === key));
    }
    for (const edge of svg.querySelectorAll(".mind-trace-memory-argument-edge, .mind-trace-memory-role-label")) {
      const connected = activeEvents.has(edge.getAttribute("data-event") ?? "") && activeEntities.has(edge.getAttribute("data-entity") ?? "");
      edge.classList.toggle("is-active", selecting && connected);
      edge.classList.toggle("is-dimmed", selecting && !connected);
    }
    for (const edge of svg.querySelectorAll(".mind-trace-memory-relation-edge, .mind-trace-memory-relation-label")) {
      const connected = activeEvents.has(edge.getAttribute("data-event") ?? "");
      edge.classList.toggle("is-active", selecting && connected);
      edge.classList.toggle("is-dimmed", selecting && !connected);
    }
    const filtered = activeEvent !== null ? allRecords.filter((record) => record.id === activeEvent) : activeEntity !== null ? allRecords.filter((record) => eventRecordArguments(record).some((argument) => eventArgumentKey(argument) === activeEntity)) : allRecords;
    renderInspector();
    inspector.toggleClass("is-visible", selecting);
    options.onSelection?.(filtered, activeEvent, activeEntity);
    options.onStateChange?.({ activeEvent, activeEntity });
  };
  const activateNode = (node, kind) => {
    const activate = () => {
      if (kind === "event") {
        const id = node.getAttribute("data-event");
        activeEvent = activeEvent === id ? null : id;
        activeEntity = null;
      } else {
        const key = node.getAttribute("data-entity");
        activeEntity = activeEntity === key ? null : key;
        activeEvent = null;
      }
      paint();
    };
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      setRovingNode(node);
      activate();
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      } else if (event.key === "Escape") {
        activeEvent = null;
        activeEntity = null;
        paint();
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        moveNodeFocus(node, 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        moveNodeFocus(node, -1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        setRovingNode(event.key === "Home" ? interactiveNodes[0] : interactiveNodes[interactiveNodes.length - 1], true);
      }
    });
  };
  eventNodes.forEach((node) => activateNode(node, "event"));
  entityNodes.forEach((node) => activateNode(node, "entity"));
  const view = {
    scale: Number.isFinite(options.initialState?.scale) ? memoryStarClamp(options.initialState.scale, 0.65, 3) : 1,
    x: Number.isFinite(options.initialState?.x) ? options.initialState.x : 0,
    y: Number.isFinite(options.initialState?.y) ? options.initialState.y : 0
  };
  const emitState = () => options.onStateChange?.({ activeEvent, activeEntity, scale: view.scale, x: view.x, y: view.y });
  const applyView = () => {
    viewport.setAttribute("transform", `translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.scale.toFixed(3)})`);
    emitState();
  };
  const zoomAround = (factor, centerX = width / 2, centerY = height / 2) => {
    const nextScale = memoryStarClamp(view.scale * factor, 0.65, 3);
    const worldX = (centerX - view.x) / view.scale;
    const worldY = (centerY - view.y) / view.scale;
    view.x = centerX - worldX * nextScale;
    view.y = centerY - worldY * nextScale;
    view.scale = nextScale;
    applyView();
  };
  zoomOut.addEventListener("click", () => zoomAround(0.82));
  zoomIn.addEventListener("click", () => zoomAround(1.22));
  zoomReset.addEventListener("click", () => {
    view.scale = 1;
    view.x = 0;
    view.y = 0;
    applyView();
  });
  const svgPointFromClient = (clientX, clientY) => {
    const matrix = svg.getScreenCTM?.();
    if (matrix !== null && matrix !== void 0) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    const bounds = svg.getBoundingClientRect();
    return {
      x: (clientX - bounds.left) / Math.max(1, bounds.width) * width,
      y: (clientY - bounds.top) / Math.max(1, bounds.height) * height
    };
  };
  svg.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const point = svgPointFromClient(event.clientX, event.clientY);
    zoomAround(event.deltaY < 0 ? 1.12 : 0.89, point.x, point.y);
  }, { passive: false });
  let pan = null;
  let suppressBackgroundClick = false;
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest?.(".mind-trace-memory-event-node, .mind-trace-memory-entity-node")) return;
    const point = svgPointFromClient(event.clientX, event.clientY);
    pan = { x: point.x, y: point.y, clientX: event.clientX, clientY: event.clientY, viewX: view.x, viewY: view.y, moved: false };
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add("is-panning");
  });
  svg.addEventListener("pointermove", (event) => {
    if (pan === null) return;
    const point = svgPointFromClient(event.clientX, event.clientY);
    const deltaX = point.x - pan.x;
    const deltaY = point.y - pan.y;
    pan.moved = pan.moved || Math.hypot(event.clientX - pan.clientX, event.clientY - pan.clientY) > 4;
    view.x = pan.viewX + deltaX;
    view.y = pan.viewY + deltaY;
    applyView();
  });
  const endPan = (event) => {
    if (pan === null) return;
    suppressBackgroundClick = pan.moved;
    pan = null;
    svg.releasePointerCapture?.(event.pointerId);
    svg.classList.remove("is-panning");
  };
  svg.addEventListener("pointerup", endPan);
  svg.addEventListener("pointercancel", endPan);
  svg.addEventListener("click", () => {
    if (suppressBackgroundClick) {
      suppressBackgroundClick = false;
      return;
    }
    activeEvent = null;
    activeEntity = null;
    paint();
  });
  svg.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      activeEvent = null;
      activeEntity = null;
      paint();
    }
  });
  applyView();
  paint();
  emitState();
  return { visibleRecords, visibleEventIds, getState: () => ({ activeEvent, activeEntity, scale: view.scale, x: view.x, y: view.y }) };
}
function renderWeeklyEventCenter(container, report, options: any = {}) {
  const scope = options.scope ?? "本周";
  const monthly = options.reportType === "monthly";
  const section = options.existingSection ?? container.createEl("section", { cls: `mind-trace-event-section mind-trace-weekly-event-center${monthly ? " mind-trace-monthly-event-center" : ""}` });
  section.empty();
  section.addClass("mind-trace-event-section", "mind-trace-weekly-event-center");
  if (monthly) {
    section.addClass("mind-trace-monthly-event-center");
  }
  options.onEventCenter?.(section);
  const heading = section.createDiv({ cls: "mind-trace-card-heading" });
  const copy = heading.createDiv();
  copy.createDiv({ cls: "mind-trace-card-title", text: `${scope}围绕什么展开` });
  copy.createEl("p", { text: "位置只由事件与论元的连接关系决定；选择节点后查看发生时间与完整上下文。" });
  const liveSource = options.eventSource ?? null;
  const candidateAggregate = liveSource?.events ?? report.eventSnapshot;
  const aggregate = candidateAggregate !== null && typeof candidateAggregate === "object" && Array.isArray(candidateAggregate.records) && Array.isArray(candidateAggregate.nodes) ? candidateAggregate : aggregateEventRecords([]);
  const coverage = liveSource === null ? { covered: Number(report.eventCoveredSessions) || 0, source: Number(report.eventSourceSessions) || Number(report.sourceSessions) || 0 } : { covered: Number(liveSource.eventCoveredSessions) || 0, source: Number(liveSource.eventSourceSessions) || Number(report.sourceSessions) || 0 };
  const graphStatus = heading.createSpan({ text: options.eventLoading ? "正在读取日记…" : `${aggregate.records.length} 件事件 · ${coverage.covered}/${coverage.source} 篇已覆盖` });
  if (typeof options.eventError === "string" && options.eventError.length > 0) {
    section.createDiv({ cls: "mind-trace-event-inline-state is-error", text: options.eventError, attr: { role: "alert" } });
  }
  const eventLimit = Number(options.eventLimit ?? options.weeklyEventLimit) || (monthly ? 100 : 50);
  const graphLimit = Number(options.graphEventLimit ?? (monthly ? options.monthlyGraphEventLimit : 20)) || (monthly ? 100 : 20);
  if (aggregate.records.length > eventLimit) {
    section.createDiv({ cls: "mind-trace-event-inline-state", text: `${scope}有 ${aggregate.records.length} 件事件，超过当前显示上限；人工确认内容仍被完整保留。`, attr: { role: "status" } });
  }
  if (liveSource !== null && report.eventSnapshot !== null && eventAggregateSignature(liveSource.events) !== eventAggregateSignature(report.eventSnapshot)) {
    const stale = section.createDiv({ cls: "mind-trace-event-snapshot-status" });
    stale.createEl("strong", { text: "当前图谱已根据日记更新" });
    stale.createSpan({ text: `Markdown 快照仍是上次生成${monthly ? "月报" : "周报"}时的版本。` });
  }
  if ((liveSource?.eventInvalidSessions?.length ?? 0) > 0) {
    const invalidState = section.createDiv({ cls: "mind-trace-event-inline-state is-error", attr: { role: "alert" } });
    invalidState.createDiv({ cls: "mind-trace-event-empty-title", text: `${liveSource.eventInvalidSessions.length} 篇记录的事件结构不匹配` });
    invalidState.createEl("p", { text: `可以逐篇打开处理，也可以确认后批量重新生成${monthly ? "；月报会按自然周分组" : ""}。原事件章节在新结果校验成功前不会改写。` });
    if (options.onOpenEvent !== void 0 || options.onRegenerateInvalidEvents !== void 0) {
      const invalidActions = invalidState.createDiv({ cls: "mind-trace-actions" });
      if (options.onRegenerateInvalidEvents !== void 0) {
        const regenerate = invalidActions.createEl("button", { cls: "mod-cta", text: `批量重新生成 ${liveSource.eventInvalidSessions.length} 篇`, attr: { type: "button" } });
        regenerate.disabled = options.backfillBusy === true;
        regenerate.addEventListener("click", options.onRegenerateInvalidEvents);
      }
      if (options.onOpenEvent !== void 0) {
        for (const item of liveSource.eventInvalidSessions.slice(0, 8)) {
          const open = invalidActions.createEl("button", { text: `打开 ${item.date} ${item.time}`, attr: { type: "button" } });
          open.addEventListener("click", () => options.onOpenEvent(item));
        }
      }
    }
  }
  const calibrationCount = liveSource?.eventCalibrationSessions?.length ?? 0;
  if (calibrationCount > 0 && options.onBackfillEvents !== void 0) {
    const missing = section.createDiv({ cls: "mind-trace-event-coverage-card" });
    const missingCopy = missing.createDiv();
    missingCopy.createEl("strong", { text: `${calibrationCount} 篇记录可以进行${monthly ? "按周" : "周级"}校准` });
    missingCopy.createEl("p", { text: "确认后将统一事件进展、体验/方向线索、论元、关系与实体名称，人工确认内容保持不变。" });
    const button = missing.createEl("button", { text: `校准${scope}事件`, attr: { type: "button" } });
    button.disabled = options.backfillBusy === true;
    button.addEventListener("click", options.onBackfillEvents);
  }
  if (typeof options.backfillMessage === "string" && options.backfillMessage.length > 0) {
    const status = section.createDiv({ cls: `mind-trace-event-backfill-message${options.backfillBusy === true ? " mind-trace-llm-inline-status" : ""}`, attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
    if (options.backfillBusy === true) {
      attachLlmActivityStatus(status, options.llmActivitySource, options.backfillMessage);
    } else {
      status.textContent = options.backfillMessage;
    }
  }
  if (options.eventLoading && liveSource === null) {
    section.createDiv({ cls: "mind-trace-event-inline-state", text: `正在从${scope}日记整理事件与元素…`, attr: { role: "status" } });
    return;
  }
  if (aggregate.records.length === 0) {
    const empty = section.createDiv({ cls: "mind-trace-event-inline-state" });
    empty.createDiv({ cls: "mind-trace-event-empty-title", text: coverage.source > 0 && coverage.covered === coverage.source ? `${scope}没有提取到明确事件` : `${scope}事件图谱还没有足够数据` });
    empty.createEl("p", { text: "图谱不会写入系统推测；主观体验只在用户明确表达时保留。" });
    return;
  }
  let graphWrap;
  let graphDisclosure = null;
  if (monthly) {
    graphDisclosure = section.createEl("details", { cls: "mind-trace-monthly-graph-disclosure" });
    graphDisclosure.open = options.graphExpanded === true;
    const summary = graphDisclosure.createEl("summary", { text: "展开本月互动图谱" });
    summary.setAttribute("aria-label", "展开本月互动图谱");
    graphDisclosure.addEventListener("toggle", () => {
      if (graphDisclosure.open) {
        summary.textContent = "收起本月互动图谱";
      } else {
        summary.textContent = "展开本月互动图谱";
      }
      options.onGraphToggle?.(graphDisclosure.open);
    });
    graphWrap = graphDisclosure.createDiv({ cls: "mind-trace-weekly-element-graph mind-trace-monthly-element-graph" });
  } else {
    graphWrap = section.createDiv({ cls: "mind-trace-weekly-element-graph" });
  }
  const ledgerDetails = section.createEl("details", { cls: "mind-trace-event-ledger-disclosure mind-trace-weekly-event-ledger-disclosure" });
  ledgerDetails.open = options.ledgerOpen === true;
  ledgerDetails.addEventListener("toggle", () => options.onLedgerToggle?.(ledgerDetails.open));
  const ledgerSummary = ledgerDetails.createEl("summary");
  (0, obsidian.setIcon)(ledgerSummary.createSpan({ cls: "mind-trace-event-ledger-disclosure-chevron", attr: { "aria-hidden": "true" } }), "chevron-right");
  const ledgerSummaryTitle = ledgerSummary.createSpan({ cls: "mind-trace-event-ledger-disclosure-title", text: "完整事件账" });
  const ledgerSummaryCount = ledgerSummary.createSpan({ cls: "mind-trace-event-ledger-disclosure-count", text: `${aggregate.records.length} 件` });
  const ledgerHost = ledgerDetails.createDiv({ cls: "mind-trace-weekly-event-ledger-host" });
  const renderLedger = (filtered, activeEvent, activeEntity) => {
    const entityName = activeEntity === null ? "" : aggregate.nodes.find((node) => node.key === activeEntity)?.name ?? "论元";
    ledgerSummaryTitle.textContent = activeEvent !== null ? `${filtered[0]?.title ?? "事件"} · 所选事件` : activeEntity !== null ? `${entityName} · 相关事件` : "完整事件账";
    ledgerSummaryCount.textContent = `${filtered.length} 件`;
    ledgerHost.empty();
    const grouped = new Map();
    for (const record of [...filtered].sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time))) {
      const group = grouped.get(record.date) ?? [];
      group.push(record);
      grouped.set(record.date, group);
    }
    for (const [date, records] of grouped) {
      const day = ledgerHost.createEl("section", { cls: "mind-trace-weekly-event-day" });
      day.createEl("time", { text: date, attr: { datetime: date } });
      renderEventLedger(day, records, {
        onOpenEvent: (record) => options.onOpenEvent?.(record)
      });
    }
  };
  if (monthly && graphDisclosure?.open !== true) {
    renderLedger(aggregate.records, null, null);
    graphStatus.textContent = `展开后显示图谱 · ${aggregate.records.length} 件 · ${coverage.covered}/${coverage.source} 篇已覆盖`;
    return;
  }
  const result = renderMemoryStarGraph(graphWrap, aggregate, {
    eventLimit: graphLimit,
    ariaLabel: `${scope}事件与论元记忆星图`,
    initialState: options.graphState,
    onStateChange: options.onGraphStateChange,
    onSelection: renderLedger
  });
  graphStatus.textContent = `图中 ${result.visibleRecords.length}/${aggregate.records.length} 件 · ${coverage.covered}/${coverage.source} 篇已覆盖`;
  const legend = graphWrap.createDiv({ cls: "mind-trace-event-kind-legend" });
  for (const kind of EVENT_KINDS) {
    legend.createSpan({ cls: `is-${kind}`, text: EVENT_KIND_LABELS[kind] });
  }
}
function renderWeeklyMetricScale(card, metric) {
  const value = Number.parseFloat(metric?.current);
  const filled = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.round(value))) : 0;
  const scale = card.createDiv({
    cls: "mind-trace-weekly-metric-scale",
    attr: {
      role: "img",
      "aria-label": Number.isFinite(value) ? `${metric.label} 当前 ${value.toFixed(1)} / 5` : `${metric.label} 暂无当前分值`
    }
  });
  for (let level = 1; level <= 5; level += 1) {
    scale.createSpan({ cls: `mind-trace-weekly-metric-scale-cell${level <= filled ? " is-filled" : ""}`, attr: { "aria-hidden": "true" } });
  }
}
var V4_REPORT_ENUM_LABELS = {
  started: "开始",
  advanced: "推进",
  blocked: "受阻",
  completed: "完成",
  unchanged: "无变化",
  ongoing: "进行中",
  planned: "计划中",
  uncertain: "不确定",
  appeared: "出现",
  strengthened: "增强",
  weakened: "减弱",
  continued: "延续",
  shifted: "转向",
  ended: "结束",
  stalled: "停滞",
  repeated: "反复",
  resolved: "解决",
  goal: "目标",
  relationship: "关系",
  project: "项目",
  habit: "习惯",
  other: "其他"
};
function v4ReportEnumLabel(value) {
  return V4_REPORT_ENUM_LABELS[value] ?? value;
}
function localizeV4ReportText(value) {
  return String(value ?? "").replace(/\b(started|advanced|blocked|completed|unchanged|ongoing|planned|uncertain|appeared|strengthened|weakened|continued|shifted|ended|stalled|repeated|resolved|goal|relationship|project|habit|other)\b/g, (match) => v4ReportEnumLabel(match));
}
function v4ReportDisplayText(item) {
  if (typeof item?.subject === "string" && item.subject.length > 0) {
    return `${item.subject}${item.status ? `｜${v4ReportEnumLabel(item.status)}` : ""}：${localizeV4ReportText(item.text)}`;
  }
  if (typeof item?.name === "string" && item.name.length > 0 && typeof item?.observation === "string") {
    const qualifiers = [item.type, item.trajectory].filter((value) => typeof value === "string" && value.length > 0).map(v4ReportEnumLabel);
    return `${[item.name, ...qualifiers].join("｜")}：${item.observation}`;
  }
  return localizeV4ReportText(item?.text ?? item?.observation ?? item?.name ?? "记录");
}
function renderSavedV4Report(container, report, options: any = {}) {
  const monthly = report.reportType === "monthly";
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-saved-weekly-report", "mind-trace-saved-weekly-report-v4");
  if (monthly) container.addClass("mind-trace-saved-monthly-report");
  const shell = container.createDiv({ cls: `mind-trace-journal-shell mind-trace-saved-shell mind-trace-weekly-shell mind-trace-v4-report-shell${monthly ? " mind-trace-monthly-shell" : ""}`, attr: { "aria-busy": options.busy === true ? "true" : "false" } });
  const header = shell.createEl("header", { cls: "mind-trace-saved-header mind-trace-weekly-header" });
  header.createDiv({ cls: "mind-trace-eyebrow", text: `心迹${monthly ? "月报" : "周报"} · 记录版 v4` });
  header.createEl("h1", { cls: "mind-trace-journal-title", text: `${report.periodStart} — ${report.periodEnd}` });
  header.createEl("p", { text: `${report.sourceDays} 个记录日 · ${report.sourceSessions} 篇记录 · ${weeklyGeneratedAtText(report.generatedAt)}` });
  const actions = header.createDiv({ cls: "mind-trace-saved-header-actions" });
  if (options.onRegenerate !== void 0) {
    const button = actions.createEl("button", { cls: "mind-trace-report-regenerate", text: options.busy ? "正在生成…" : "重新生成", attr: { type: "button" } });
    button.disabled = options.busy === true;
    button.addEventListener("click", options.onRegenerate);
  }
  if (options.onEditSource !== void 0) actions.createEl("button", { cls: "mind-trace-edit-source", text: "编辑 Markdown", attr: { type: "button" } }).addEventListener("click", options.onEditSource);
  if (options.onDelete !== void 0) actions.createEl("button", { cls: "mind-trace-delete-file", text: "删除", attr: { type: "button" } }).addEventListener("click", options.onDelete);
  if (options.busy === true) {
    const status = shell.createDiv({ cls: "mind-trace-report-inline-status", attr: { role: "status", "aria-live": "polite" } });
    attachLlmActivityStatus(status, options.llmActivitySource, `正在重新整理这份${monthly ? "月报" : "周报"}…`);
  }
  if (options.error) shell.createDiv({ cls: "mind-trace-report-inline-error", text: options.error, attr: { role: "alert" } });
  const fold = shell.createEl("section", { cls: `mind-trace-editor-card mind-trace-weekly-fold${monthly ? " mind-trace-monthly-overview" : ""}` });
  const ledger = fold.createDiv({ cls: "mind-trace-weekly-ledger" });
  ledger.createDiv({ cls: "mind-trace-section-kicker", text: monthly ? report.periodStatus === "partial" ? "本月预览 · 截至今天" : "整月账页" : "一周账页" });
  ledger.createEl("time", { text: `${report.periodStart.slice(5).replace("-", ".")}\n—\n${report.periodEnd.slice(5).replace("-", ".")}` });
  const ledgerStats = ledger.createDiv({ cls: "mind-trace-weekly-ledger-stats" });
  const stats = [["记录日", String(report.sourceDays)], ["总篇数", String(report.sourceSessions)]];
  if (monthly) stats.push(["已生成周报", String(report.activeWeeks ?? 0)]);
  for (const [label, value] of stats) {
    const item = ledgerStats.createDiv();
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
  const foldBody = fold.createDiv({ cls: "mind-trace-weekly-fold-body" });
  foldBody.createDiv({ cls: "mind-trace-diary-kicker", text: `${monthly ? "本月" : "一周"}概览 · 已归档` });
  foldBody.createDiv({ cls: "mind-trace-card-title mind-trace-diary-title", text: monthly ? "这个月的正文" : "这一周的正文" });
  foldBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-summary", text: report.summary });
  const overviewIndex = foldBody.createDiv({ cls: "mind-trace-weekly-overview-index", attr: { role: "list", "aria-label": monthly ? "本月回顾索引" : "本周回顾索引" } });
  if (monthly) {
    overviewIndex.createSpan({ text: `${report.turningPoints?.length ?? 0} 个跨周转折` });
    overviewIndex.createSpan({ text: `${report.themeEvolution?.length ?? 0} 条主题演变` });
    overviewIndex.createSpan({ text: `${report.activeWeeks ?? 0} 份已生成周报` });
  } else {
    overviewIndex.createSpan({ text: `${report.highlights?.length ?? 0} 件本周发生` });
    overviewIndex.createSpan({ text: `${report.openLoops?.length ?? 0} 个未决事项` });
    overviewIndex.createSpan({ text: `${report.carryForward?.length ?? 0} 项带到下周` });
  }
  const metricsSection = shell.createEl("section", { cls: `mind-trace-rating-comparison mind-trace-weekly-metrics${monthly ? " mind-trace-monthly-metrics" : ""}` });
  const metricsHeading = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-heading" });
  const metricsCopy = metricsHeading.createDiv();
  const comparisonLabel = monthly ? report.periodStatus === "partial" ? "上月同期" : "上月" : "前一周";
  metricsCopy.createDiv({ cls: "mind-trace-section-kicker", text: `状态对照 · ${comparisonLabel}` });
  metricsCopy.createDiv({ cls: "mind-trace-rating-comparison-title", text: monthly ? "一个月，状态如何移动" : "这一周，状态如何移动", attr: { role: "heading", "aria-level": "2" } });
  metricsCopy.createEl("p", { text: `${monthly ? "本月" : "本周"}值来自日记自评平均；变化量用${comparisonLabel}作对照。` });
  const metricGrid = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-grid" });
  for (const metric of report.metrics ?? []) {
    const card = metricGrid.createEl("section", { cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${metric.key} mind-trace-weekly-metric-card` });
    const cardHeading = card.createDiv({ cls: "mind-trace-rating-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-rating-card-title", text: metric.label });
    cardHeading.createSpan({ cls: `mind-trace-rating-difference ${weeklyMetricDeltaClass(metric)}`, text: metric.delta === "—" ? "暂无对照" : `较${comparisonLabel} ${metric.delta}` });
    const value = card.createDiv({ cls: "mind-trace-weekly-metric-value" });
    value.createEl("output", { text: metric.current });
    value.createSpan({ text: metric.current === "—" ? "" : "/ 5" });
    renderWeeklyMetricScale(card, metric);
  }
  if (monthly && Array.isArray(report.weekStats)) {
    const rhythm = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-monthly-rhythm" });
    const rhythmHeading = rhythm.createDiv({ cls: "mind-trace-card-heading" });
    rhythmHeading.createDiv({ cls: "mind-trace-card-title", text: "月内节奏" });
    rhythmHeading.createSpan({ text: "自然周轴" });
    const axis = rhythm.createDiv({ cls: "mind-trace-monthly-rhythm-axis", attr: { role: "list", "aria-label": "月度节律轴" } });
    for (const week of report.weekStats) {
      const item = axis.createDiv({ cls: "mind-trace-monthly-rhythm-week", attr: { role: "listitem" } });
      item.createDiv({ cls: "mind-trace-monthly-rhythm-label", text: `${week.startLabel ?? week.start?.slice(5) ?? ""}–${week.endLabel ?? week.end?.slice(5) ?? ""}` });
      const bars = item.createDiv({ cls: "mind-trace-monthly-rhythm-bars" });
      for (const [key, label] of [["mood", "心"], ["energy", "精"], ["stress", "压"]]) {
        const score = week[key];
        const bar = bars.createDiv({ cls: `mind-trace-monthly-rhythm-bar is-${key}`, attr: { title: `${label} ${score === null ? "无数据" : Number(score).toFixed(1)}` } });
        bar.setCssProps({ "--mind-trace-rhythm-value": score === null ? "0" : String(score) });
      }
      item.createDiv({ cls: "mind-trace-monthly-rhythm-meta", text: `${week.days} 天 · ${week.sessions} 篇` });
    }
    if (Array.isArray(report.rhythm) && report.rhythm.length > 0) {
      const observations = rhythm.createDiv({ cls: "mind-trace-v4-rhythm-observations" });
      renderWeeklyEvidenceRows(observations, report.rhythm.map((item) => ({ ...item, text: v4ReportDisplayText(item) })), "节奏", options.onOpenEvidenceDate ?? null);
    }
  }
  const eventHost = shell.createDiv({ cls: "mind-trace-v4-event-host" });
  try {
    renderWeeklyEventCenter(eventHost, report, { ...options, reportType: monthly ? "monthly" : "weekly", scope: monthly ? "本月" : "本周", eventLimit: monthly ? options.monthlyGraphEventLimit ?? 100 : options.weeklyGraphEventLimit ?? 20 });
  } catch (error) {
    eventHost.empty();
    const fallback = eventHost.createEl("section", { cls: "mind-trace-event-section mind-trace-weekly-event-center" });
    options.onEventCenter?.(fallback);
    fallback.createDiv({ cls: "mind-trace-event-empty-title", text: `${monthly ? "本月" : "本周"}事件图谱暂时无法显示` });
    fallback.createEl("p", { text: `报告正文和统计仍可阅读。图谱错误：${errorMessage(error)}` });
  }
  const sections = monthly ? [["跨周转折", "跨自然周确认", report.turningPoints, "转折"], ["主题如何演变", "只记录跨周变化", report.themeEvolution, "主题"], ["持续推进与停滞", "事项状态轨迹", report.threads, "轨迹"], ["带入下月的未决事项", "明确延续", report.carryForward, "延续"]] : [["本周发生", "明确发生的重点", report.highlights, "发生"], ["进展与状态", "开始、推进与受阻", report.progress, "进展"], ["尚未结束", "仍在进行或待确认", report.openLoops, "未决"], ["本周反复出现", "只描述出现方式", report.themes, "主题"], ["明确带到下周", "来自已表达的意向", report.carryForward, "延续"]];
  for (let index = 0; index < sections.length; index += 2) {
    const group = sections.slice(index, index + 2);
    const analysisGrid = shell.createDiv({ cls: `mind-trace-weekly-analysis-grid mind-trace-v4-analysis-grid${group.length === 1 ? " is-single" : ""}` });
    for (const [title, label, items, mark] of group) {
      const section = analysisGrid.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-analysis-card" });
      const cardHeading = section.createDiv({ cls: "mind-trace-card-heading" });
      cardHeading.createDiv({ cls: "mind-trace-card-title", text: title });
      cardHeading.createSpan({ text: label });
      if (!Array.isArray(items) || items.length === 0) {
        section.createDiv({ cls: "mind-trace-saved-copy mind-trace-v4-report-empty", text: "暂无足够记录。" });
      } else {
        renderWeeklyEvidenceRows(section, items.map((item) => ({ ...item, text: v4ReportDisplayText(item) })), mark, options.onOpenEvidenceDate ?? null);
      }
    }
  }
  if (report.truncated) shell.createEl("p", { cls: "mind-trace-weekly-truncated", text: `${monthly ? "本月" : "本周"}日记较长，AI 整理使用了截取后的事实摘录。` });
}
function renderSavedWeeklyReport(container, report, options: any = {}) {
  if (report.reportVersion === 4) return renderSavedV4Report(container, report, options);
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-saved-weekly-report");
  const shell = container.createDiv({
    cls: `mind-trace-journal-shell mind-trace-saved-shell mind-trace-weekly-shell${options.animate ? " is-entering" : ""}`,
    attr: { "aria-busy": options.busy === true ? "true" : "false" }
  });
  const header = shell.createEl("header", { cls: "mind-trace-saved-header mind-trace-weekly-header" });
  header.createDiv({ cls: "mind-trace-eyebrow", text: "心迹周报 \xB7 已生成" });
  header.createEl("h1", { cls: "mind-trace-journal-title", text: `${report.periodStart} — ${report.periodEnd}` });
  header.createEl("p", { text: `${report.sourceDays} 个记录日 \xB7 ${report.sourceSessions} 篇记录 \xB7 ${weeklyGeneratedAtText(report.generatedAt)}` });
  const actions = header.createDiv({ cls: "mind-trace-saved-header-actions" });
  if (options.onRegenerate !== void 0) {
    const regenerate = actions.createEl("button", {
      cls: "mind-trace-export-pdf mind-trace-report-regenerate",
      text: options.busy ? "正在生成…" : "重新生成",
      attr: { type: "button" }
    });
    regenerate.disabled = options.busy === true;
    regenerate.addEventListener("click", options.onRegenerate);
  }
  if (options.onEditSource !== void 0) {
    const edit = actions.createEl("button", { cls: "mind-trace-edit-source", text: "编辑 Markdown", attr: { type: "button" } });
    edit.disabled = options.busy === true;
    edit.addEventListener("click", options.onEditSource);
  }
  if (options.onDelete !== void 0) {
    const deleteFile = actions.createEl("button", { cls: "mind-trace-delete-file", text: "删除", attr: { type: "button", "aria-label": "删除这篇心迹周报" } });
    deleteFile.disabled = options.deleteDisabled === true;
    deleteFile.addEventListener("click", options.onDelete);
  }
  if (options.busy === true) {
    const status = shell.createDiv({ cls: "mind-trace-report-inline-status", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
    attachLlmActivityStatus(status, options.llmActivitySource, "正在根据当前日记重新整理这一周…");
  }
  if (typeof options.error === "string" && options.error.length > 0) {
    shell.createDiv({ cls: "mind-trace-report-inline-error", text: options.error, attr: { role: "alert" } });
  }
  const fold = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-fold" });
  const ledger = fold.createDiv({ cls: "mind-trace-weekly-ledger" });
  ledger.createDiv({ cls: "mind-trace-section-kicker", text: "一周账页" });
  ledger.createEl("time", { text: `${report.periodStart.slice(5).replace("-", ".")}\n—\n${report.periodEnd.slice(5).replace("-", ".")}` });
  const ledgerStats = ledger.createDiv({ cls: "mind-trace-weekly-ledger-stats" });
  for (const [label, value] of [["记录日", String(report.sourceDays)], ["总篇数", String(report.sourceSessions)]]) {
    const item = ledgerStats.createDiv();
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
  const foldBody = fold.createDiv({ cls: "mind-trace-weekly-fold-body" });
  foldBody.createDiv({ cls: "mind-trace-diary-kicker", text: "一周概览 \xB7 已归档" });
  foldBody.createDiv({ cls: "mind-trace-card-title mind-trace-diary-title", text: "这一周的正文" });
  foldBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-summary", text: report.summary });
  const weeklyIndex = foldBody.createDiv({ cls: "mind-trace-weekly-overview-index", attr: { role: "list", "aria-label": "本周回顾索引" } });
  weeklyIndex.createSpan({ text: `${Array.isArray(report.changes) ? report.changes.length : 0} 条变化` });
  weeklyIndex.createSpan({ text: `${Array.isArray(report.themes) ? report.themes.length : 0} 个主题` });
  const metricsSection = shell.createEl("section", { cls: "mind-trace-rating-comparison mind-trace-weekly-metrics" });
  const metricsHeading = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-heading" });
  const metricsCopy = metricsHeading.createDiv();
  metricsCopy.createDiv({ cls: "mind-trace-section-kicker", text: "状态对照 \xB7 前一周" });
  metricsCopy.createDiv({ cls: "mind-trace-rating-comparison-title", text: "这一周，状态如何移动", attr: { role: "heading", "aria-level": "2" } });
  metricsCopy.createEl("p", { text: "本周值来自日记自评平均；变化量用前一完整周作对照。" });
  const metricGrid = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-grid" });
  for (const metric of report.metrics) {
    const card = metricGrid.createEl("section", { cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${metric.key} mind-trace-weekly-metric-card` });
    const cardHeading = card.createDiv({ cls: "mind-trace-rating-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-rating-card-title", text: metric.label });
    cardHeading.createSpan({ cls: `mind-trace-rating-difference ${weeklyMetricDeltaClass(metric)}`, text: metric.delta === "—" ? "暂无对照" : `较上周 ${metric.delta}` });
    const value = card.createDiv({ cls: "mind-trace-weekly-metric-value" });
    value.createEl("output", { text: metric.current });
    value.createSpan({ text: metric.current === "—" ? "" : "/ 5" });
    renderWeeklyMetricScale(card, metric);
  }
  renderWeeklyEventCenter(shell, report, options);
  const analysisGrid = shell.createDiv({ cls: "mind-trace-weekly-analysis-grid" });
  for (const [title, label, items, mark] of [["发生的变化", "从这一周看见", report.changes, "变化"], ["可能的原因", "保留推测的边界", report.possibleCauses, "线索"]]) {
    const card = analysisGrid.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-analysis-card" });
    const cardHeading = card.createDiv({ cls: "mind-trace-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-card-title", text: title });
    cardHeading.createSpan({ text: label });
    renderWeeklyEvidenceRows(card, items, mark, options.onOpenEvidenceDate ?? null);
  }
  const emotion = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-emotion-card" });
  const emotionHeading = emotion.createDiv({ cls: "mind-trace-card-heading" });
  emotionHeading.createDiv({ cls: "mind-trace-card-title", text: "AI 对这一周的情绪假设" });
  emotionHeading.createSpan({ text: "双重读法" });
  emotion.createEl("p", { cls: "mind-trace-weekly-emotion-note", text: "这是根据文字线索的假设性解读，不是心理或医学诊断。" });
  const emotionGrid = emotion.createDiv({ cls: "mind-trace-weekly-emotion-grid" });
  const primary = emotionGrid.createDiv({ cls: "mind-trace-weekly-emotion-primary" });
  primary.createSpan({ text: "主要假设" });
  primary.createDiv({ cls: "mind-trace-saved-copy", text: report.emotion.hypothesis });
  const alternative = emotionGrid.createDiv({ cls: "mind-trace-weekly-emotion-alternative" });
  alternative.createSpan({ text: "另一种可能" });
  alternative.createDiv({ cls: "mind-trace-saved-copy", text: report.emotion.alternative });
  const clues = emotion.createDiv({ cls: "mind-trace-weekly-clues" });
  clues.createSpan({ text: "文字线索" });
  const clueList = clues.createEl("ul");
  for (const clue of report.emotion.clues) {
    clueList.createEl("li", { text: clue });
  }
  const themesSection = shell.createEl("section", { cls: "mind-trace-facets-section mind-trace-weekly-themes" });
  const themesHeading = themesSection.createDiv({ cls: "mind-trace-card-heading" });
  themesHeading.createDiv({ cls: "mind-trace-card-title", text: "反复出现的主题" });
  themesHeading.createSpan({ text: "一周切片" });
  const themesGrid = themesSection.createDiv({ cls: "mind-trace-facets-grid" });
  for (const theme of report.themes) {
    const card = themesGrid.createDiv({ cls: "mind-trace-facet-card" });
    const themeHeader = card.createDiv({ cls: "mind-trace-facet-header" });
    themeHeader.createSpan({ cls: "mind-trace-facet-kind", text: "周内主题" });
    card.createDiv({ cls: "mind-trace-facet-category", text: theme.name });
    card.createDiv({ cls: "mind-trace-facet-divider", attr: { "aria-hidden": "true" } });
    card.createDiv({ cls: "mind-trace-saved-copy mind-trace-facet-summary", text: theme.observation });
  }
  const closing = shell.createDiv({ cls: "mind-trace-reflection-grid mind-trace-weekly-closing" });
  const actionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-action-card" });
  const actionHeading = actionSection.createDiv({ cls: "mind-trace-card-heading" });
  actionHeading.createDiv({ cls: "mind-trace-card-title", text: "下周最小的一步" });
  actionHeading.createSpan({ text: "只做这一小步" });
  const actionBody = actionSection.createDiv({ cls: "mind-trace-action-body" });
  actionBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-action", text: report.nextStep.action });
  actionBody.createEl("p", { cls: "mind-trace-weekly-action-reason", text: report.nextStep.reason });
  const questionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-question-card" });
  const questionHeading = questionSection.createDiv({ cls: "mind-trace-card-heading" });
  questionHeading.createDiv({ cls: "mind-trace-card-title", text: "留给自己的问题" });
  questionHeading.createSpan({ text: "不急着回答" });
  const questionBody = questionSection.createDiv({ cls: "mind-trace-question-body" });
  questionBody.createSpan({ cls: "mind-trace-question-mark", text: "？", attr: { "aria-hidden": "true" } });
  questionBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-compact-editor", text: report.selfQuestion });
  if (report.truncated) {
    shell.createEl("p", { cls: "mind-trace-weekly-truncated", text: "本周日记较长，AI 分析使用了截取后的摘录。" });
  }
}
function renderSavedMonthlyReport(container, report, options: any = {}) {
  if (report.reportVersion === 4) return renderSavedV4Report(container, report, options);
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-saved-monthly-report", "mind-trace-saved-weekly-report");
  const shell = container.createDiv({
    cls: `mind-trace-journal-shell mind-trace-saved-shell mind-trace-weekly-shell mind-trace-monthly-shell${options.animate ? " is-entering" : ""}`,
    attr: { "aria-busy": options.busy === true ? "true" : "false" }
  });
  const header = shell.createEl("header", { cls: "mind-trace-saved-header mind-trace-weekly-header mind-trace-monthly-header" });
  header.createDiv({ cls: "mind-trace-eyebrow", text: `心迹月报 · ${report.periodStatus === "partial" ? "截至今天" : "已生成"}` });
  header.createEl("h1", { cls: "mind-trace-journal-title", text: `${report.periodStart} — ${report.periodEnd}` });
  header.createEl("p", { text: `${report.sourceDays} 个记录日 · ${report.sourceSessions} 篇记录 · ${report.activeWeeks} 份已生成周报 · ${weeklyGeneratedAtText(report.generatedAt)}` });
  const actions = header.createDiv({ cls: "mind-trace-saved-header-actions" });
  if (options.onRegenerate !== void 0) {
    const regenerate = actions.createEl("button", { cls: "mind-trace-export-pdf mind-trace-report-regenerate", text: options.busy ? "正在生成…" : "重新生成", attr: { type: "button" } });
    regenerate.disabled = options.busy === true;
    regenerate.addEventListener("click", options.onRegenerate);
  }
  if (options.onEditSource !== void 0) {
    const edit = actions.createEl("button", { cls: "mind-trace-edit-source", text: "编辑 Markdown", attr: { type: "button" } });
    edit.disabled = options.busy === true;
    edit.addEventListener("click", options.onEditSource);
  }
  if (options.onDelete !== void 0) {
    const deleteFile = actions.createEl("button", { cls: "mind-trace-delete-file", text: "删除", attr: { type: "button", "aria-label": "删除这篇心迹月报" } });
    deleteFile.disabled = options.deleteDisabled === true;
    deleteFile.addEventListener("click", options.onDelete);
  }
  if (options.busy === true) {
    const status = shell.createDiv({ cls: "mind-trace-report-inline-status", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
    attachLlmActivityStatus(status, options.llmActivitySource, "正在根据当前日记重新整理这个月…");
  }
  if (typeof options.error === "string" && options.error.length > 0) {
    shell.createDiv({ cls: "mind-trace-report-inline-error", text: options.error, attr: { role: "alert" } });
  }
  const fold = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-fold mind-trace-monthly-overview" });
  const ledger = fold.createDiv({ cls: "mind-trace-weekly-ledger" });
  ledger.createDiv({ cls: "mind-trace-section-kicker", text: report.periodStatus === "partial" ? "本月预览 · 截至今天" : "整月账页" });
  ledger.createEl("time", { text: `${report.periodStart.slice(5).replace("-", ".")}\n—\n${report.periodEnd.slice(5).replace("-", ".")}` });
  const ledgerStats = ledger.createDiv({ cls: "mind-trace-weekly-ledger-stats" });
  for (const [label, value] of [["记录日", String(report.sourceDays)], ["总篇数", String(report.sourceSessions)], ["已生成周报", String(report.activeWeeks)]]) {
    const item = ledgerStats.createDiv();
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
  const foldBody = fold.createDiv({ cls: "mind-trace-weekly-fold-body" });
  foldBody.createDiv({ cls: "mind-trace-diary-kicker", text: "本月概览 · 已归档" });
  foldBody.createDiv({ cls: "mind-trace-card-title mind-trace-diary-title", text: "这个月的正文" });
  foldBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-summary", text: report.summary });
  const monthlyIndex = foldBody.createDiv({ cls: "mind-trace-weekly-overview-index", attr: { role: "list", "aria-label": "本月回顾索引" } });
  monthlyIndex.createSpan({ text: `${Array.isArray(report.changes) ? report.changes.length : 0} 条变化` });
  monthlyIndex.createSpan({ text: `${Array.isArray(report.themes) ? report.themes.length : 0} 个主题` });
  monthlyIndex.createSpan({ text: `${Number(report.activeWeeks) || 0} 份已生成周报` });
  const metricsSection = shell.createEl("section", { cls: "mind-trace-rating-comparison mind-trace-weekly-metrics mind-trace-monthly-metrics" });
  const metricsHeading = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-heading" });
  const metricsCopy = metricsHeading.createDiv();
  metricsCopy.createDiv({ cls: "mind-trace-section-kicker", text: `状态对照 · ${report.periodStatus === "partial" ? "上月同期" : "上月"}` });
  metricsCopy.createDiv({ cls: "mind-trace-rating-comparison-title", text: "一个月，状态如何移动", attr: { role: "heading", "aria-level": "2" } });
  metricsCopy.createEl("p", { text: `本月值来自日记自评平均；变化量用${report.periodStatus === "partial" ? "上月同期" : "上月"}作对照。` });
  const metricGrid = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-grid" });
  for (const metric of report.metrics) {
    const card = metricGrid.createEl("section", { cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${metric.key} mind-trace-weekly-metric-card` });
    const cardHeading = card.createDiv({ cls: "mind-trace-rating-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-rating-card-title", text: metric.label });
    cardHeading.createSpan({ cls: `mind-trace-rating-difference ${weeklyMetricDeltaClass(metric)}`, text: metric.delta === "—" ? "暂无对照" : `较${report.periodStatus === "partial" ? "上月同期" : "上月"} ${metric.delta}` });
    const value = card.createDiv({ cls: "mind-trace-weekly-metric-value" });
    value.createEl("output", { text: metric.current });
    value.createSpan({ text: metric.current === "—" ? "" : "/ 5" });
    renderWeeklyMetricScale(card, metric);
  }
  const rhythm = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-monthly-rhythm" });
  const rhythmHeading = rhythm.createDiv({ cls: "mind-trace-card-heading" });
  rhythmHeading.createDiv({ cls: "mind-trace-card-title", text: "月内节奏" });
  rhythmHeading.createSpan({ text: "自然周轴" });
  const axis = rhythm.createDiv({ cls: "mind-trace-monthly-rhythm-axis", attr: { role: "list", "aria-label": "月度节律轴" } });
  for (const week of report.weekStats ?? []) {
    const item = axis.createDiv({ cls: "mind-trace-monthly-rhythm-week", attr: { role: "listitem" } });
    item.createDiv({ cls: "mind-trace-monthly-rhythm-label", text: `${week.startLabel ?? week.start?.slice(5) ?? ""}–${week.endLabel ?? week.end?.slice(5) ?? ""}` });
    const bars = item.createDiv({ cls: "mind-trace-monthly-rhythm-bars" });
    for (const [key, label] of [["mood", "心"], ["energy", "精"], ["stress", "压"]]) {
      const value = week[key];
      const bar = bars.createDiv({ cls: `mind-trace-monthly-rhythm-bar is-${key}`, attr: { title: `${label} ${value === null ? "无数据" : value.toFixed(1)}` } });
      bar.setCssProps({ "--mind-trace-rhythm-value": value === null ? "0" : String(value) });
    }
    item.createDiv({ cls: "mind-trace-monthly-rhythm-meta", text: `${week.days} 天 · ${week.sessions} 篇` });
  }
  renderWeeklyEventCenter(shell, report, { ...options, reportType: "monthly", scope: "本月", eventLimit: options.monthlyGraphEventLimit ?? 100 });
  const analysisGrid = shell.createDiv({ cls: "mind-trace-weekly-analysis-grid mind-trace-monthly-analysis-grid" });
  for (const [title, label, items, mark] of [["发生的变化", "从这个月看见", report.changes, "变化"], ["可能的原因", "保留推测的边界", report.possibleCauses, "线索"]]) {
    const card = analysisGrid.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-analysis-card" });
    const cardHeading = card.createDiv({ cls: "mind-trace-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-card-title", text: title });
    cardHeading.createSpan({ text: label });
    renderWeeklyEvidenceRows(card, items, mark, options.onOpenEvidenceDate ?? null);
  }
  const emotion = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-emotion-card" });
  const emotionHeading = emotion.createDiv({ cls: "mind-trace-card-heading" });
  emotionHeading.createDiv({ cls: "mind-trace-card-title", text: "AI 对这个月的情绪假设" });
  emotionHeading.createSpan({ text: "双重读法" });
  emotion.createEl("p", { cls: "mind-trace-weekly-emotion-note", text: "这是根据文字线索的假设性解读，不是心理或医学诊断。" });
  const emotionGrid = emotion.createDiv({ cls: "mind-trace-weekly-emotion-grid" });
  const primary = emotionGrid.createDiv({ cls: "mind-trace-weekly-emotion-primary" });
  primary.createSpan({ text: "主要假设" });
  primary.createDiv({ cls: "mind-trace-saved-copy", text: report.emotion.hypothesis });
  const alternative = emotionGrid.createDiv({ cls: "mind-trace-weekly-emotion-alternative" });
  alternative.createSpan({ text: "另一种可能" });
  alternative.createDiv({ cls: "mind-trace-saved-copy", text: report.emotion.alternative });
  const clues = emotion.createDiv({ cls: "mind-trace-weekly-clues" });
  clues.createSpan({ text: "文字线索" });
  const clueList = clues.createEl("ul");
  for (const clue of report.emotion.clues) clueList.createEl("li", { text: clue });
  const themesSection = shell.createEl("section", { cls: "mind-trace-facets-section mind-trace-weekly-themes" });
  const themesHeading = themesSection.createDiv({ cls: "mind-trace-card-heading" });
  themesHeading.createDiv({ cls: "mind-trace-card-title", text: "反复出现的主题" });
  themesHeading.createSpan({ text: "月内切片" });
  const themesGrid = themesSection.createDiv({ cls: "mind-trace-facets-grid" });
  for (const theme of report.themes) {
    const card = themesGrid.createDiv({ cls: "mind-trace-facet-card" });
    const themeHeader = card.createDiv({ cls: "mind-trace-facet-header" });
    themeHeader.createSpan({ cls: "mind-trace-facet-kind", text: "月内主题" });
    card.createDiv({ cls: "mind-trace-facet-category", text: theme.name });
    card.createDiv({ cls: "mind-trace-facet-divider", attr: { "aria-hidden": "true" } });
    card.createDiv({ cls: "mind-trace-saved-copy mind-trace-facet-summary", text: theme.observation });
  }
  const closing = shell.createDiv({ cls: "mind-trace-reflection-grid mind-trace-weekly-closing" });
  const actionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-action-card" });
  const actionHeading = actionSection.createDiv({ cls: "mind-trace-card-heading" });
  actionHeading.createDiv({ cls: "mind-trace-card-title", text: "下月最小的一步" });
  actionHeading.createSpan({ text: "只做这一小步" });
  const actionBody = actionSection.createDiv({ cls: "mind-trace-action-body" });
  actionBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-action", text: report.nextStep.action });
  actionBody.createEl("p", { cls: "mind-trace-weekly-action-reason", text: report.nextStep.reason });
  const questionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-question-card" });
  const questionHeading = questionSection.createDiv({ cls: "mind-trace-card-heading" });
  questionHeading.createDiv({ cls: "mind-trace-card-title", text: "留给自己的问题" });
  questionHeading.createSpan({ text: "不急着回答" });
  const questionBody = questionSection.createDiv({ cls: "mind-trace-question-body" });
  questionBody.createSpan({ cls: "mind-trace-question-mark", text: "？", attr: { "aria-hidden": "true" } });
  questionBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-compact-editor", text: report.selfQuestion });
  if (report.truncated) shell.createEl("p", { cls: "mind-trace-weekly-truncated", text: "本月日记较长，AI 分析使用了截取后的摘录。" });
}
var SavedWeeklyReportView = class extends obsidian.TextFileView {
  declare plugin: any;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  get ownerWindow() {
    return mindTraceWindow(this.contentEl);
  }
  busy = false;
  inlineError = "";
  hasRendered = false;
  eventSource = null;
  eventSourceKey = "";
  eventLoading = false;
  eventError = "";
  eventLoadToken = 0;
  backfillBusy = false;
  backfillMessage = "";
  currentReport = null;
  graphState = { activeEvent: null, activeEntity: null, scale: 1, x: 0, y: 0 };
  ledgerOpen = false;
  graphExpanded = false;
  eventCenterEl = null;
  getViewType() {
    return WEEKLY_REPORT_VIEW_TYPE;
  }
  getDisplayText() {
    return this.file?.basename ?? "心迹周报";
  }
  getIcon() {
    return "chart-no-axes-combined";
  }
  getViewData() {
    return this.data;
  }
  setViewData(data, clear) {
    this.data = data;
    if (clear) {
      this.clear();
      this.eventSource = null;
      this.eventSourceKey = "";
      this.eventError = "";
      this.eventLoadToken += 1;
      this.backfillMessage = "";
    }
    this.render(!clear);
  }
  clear() {
    this.contentEl.empty();
  }
  render(preserveContext = false) {
    const context = preserveContext ? captureMindTraceContext(this.contentEl) : null;
    this.contentEl.empty();
    this.contentEl.addClass("mind-trace-view", "mind-trace-saved-file-view", "mind-trace-report-file-view");
    if (renderPrivacyGate(this.contentEl, this.plugin)) {
      return;
    }
    const rendered = this.contentEl.createDiv({ cls: "mind-trace-saved-render" });
    try {
      const frontmatter = parseFrontmatter(this.data, "心迹报告");
      const report = parseSavedReport(this.data, frontmatter);
      this.currentReport = report;
      const periodKey = `${report.reportType ?? "weekly"}--${report.periodStart}--${report.periodEnd}`;
      if (this.eventSourceKey !== periodKey) {
        this.eventSourceKey = periodKey;
        this.eventSource = null;
        this.eventError = "";
        this.graphState = { activeEvent: null, activeEntity: null, scale: 1, x: 0, y: 0 };
        this.ledgerOpen = false;
        this.graphExpanded = false;
      }
      const renderOptions = {
        animate: !this.hasRendered,
        busy: this.busy,
        error: this.inlineError,
        ...this.eventRenderOptions(report),
        onRegenerate: () => this.beginReportRegeneration(report),
        onEditSource: () => {
          void this.openMarkdownSource();
        },
        onDelete: () => {
          confirmMindTraceFileDeletion(this, report.reportType === "monthly" ? "月报" : "周报");
        },
        deleteDisabled: this.busy || this.backfillBusy,
        onOpenEvidenceDate: (date) => {
          void this.plugin.openJournalDate(date);
        },
        onOpenEvent: (record) => {
          void this.plugin.openJournalSession(record.filePath, record.sessionIndex);
        },
        onBackfillEvents: () => {
          void this.beginEventBackfill(report);
        }
      };
      if (report.reportType === "monthly") {
        renderSavedMonthlyReport(rendered, report, renderOptions);
      } else {
        renderSavedWeeklyReport(rendered, report, renderOptions);
      }
      this.hasRendered = true;
      if (!this.eventLoading && this.eventSource === null && this.eventError.length === 0) {
        void this.loadEventSource(report);
      }
    } catch (error) {
      this.renderError(rendered, errorMessage(error));
    }
    if (context !== null) {
      restoreMindTraceContext(this.contentEl, context);
    }
  }
  eventRenderOptions(report, existingSection = null) {
    const monthly = report.reportType === "monthly";
    return {
      eventSource: this.eventSource,
      eventLoading: this.eventLoading,
      eventError: this.eventError,
      graphEventLimit: monthly ? this.plugin.settings.monthlyGraphEventLimit : this.plugin.settings.weeklyGraphEventLimit,
      weeklyEventLimit: this.plugin.settings.weeklyEventLimit,
      eventLimit: monthly ? this.plugin.settings.monthlyGraphEventLimit : this.plugin.settings.weeklyEventLimit,
      monthlyGraphEventLimit: this.plugin.settings.monthlyGraphEventLimit,
      reportType: monthly ? "monthly" : "weekly",
      scope: monthly ? "本月" : "本周",
      llmActivitySource: this.plugin,
      backfillBusy: this.backfillBusy,
      backfillMessage: this.backfillMessage,
      graphState: this.graphState,
      ledgerOpen: this.ledgerOpen,
      graphExpanded: this.graphExpanded,
      existingSection,
      onEventCenter: (section) => {
        this.eventCenterEl = section;
      },
      onGraphStateChange: (state) => {
        this.graphState = { ...this.graphState, ...state };
      },
      onLedgerToggle: (open) => {
        this.ledgerOpen = open;
      },
      onGraphToggle: (open) => {
        this.graphExpanded = open;
        if (open && report.reportType === "monthly") {
          this.ownerWindow.requestAnimationFrame(() => this.refreshEventCenter(report));
        }
      },
      onOpenEvent: (record) => {
        void this.plugin.openJournalSession(record.filePath, record.sessionIndex);
      },
      onBackfillEvents: () => {
        void this.beginEventBackfill(report);
      },
      onRegenerateInvalidEvents: () => {
        void this.beginInvalidEventRegeneration(report);
      }
    };
  }
  refreshEventCenter(report = this.currentReport) {
    if (report === null || this.eventCenterEl === null || !this.eventCenterEl.isConnected || this.eventCenterEl.parentElement === null) {
      this.render(true);
      return;
    }
    const context = captureMindTraceContext(this.contentEl);
    try {
      renderWeeklyEventCenter(this.eventCenterEl.parentElement, report, this.eventRenderOptions(report, this.eventCenterEl));
    } catch (error) {
      const host = this.eventCenterEl.parentElement;
      this.eventCenterEl = null;
      host.empty();
      const fallback = host.createEl("section", { cls: "mind-trace-event-section mind-trace-weekly-event-center" });
      this.eventCenterEl = fallback;
      fallback.createDiv({ cls: "mind-trace-event-empty-title", text: "事件图谱暂时无法显示" });
      fallback.createEl("p", { text: `报告正文和统计不受影响。图谱错误：${errorMessage(error)}` });
    }
    restoreMindTraceContext(this.contentEl, context);
  }
  async loadEventSource(report, force = false) {
    if (this.eventLoading || !this.plugin.isPrivacyUnlocked()) {
      return;
    }
    if (!force && this.eventSource !== null) {
      return;
    }
    const token = ++this.eventLoadToken;
    this.eventLoading = true;
    this.eventError = "";
    this.refreshEventCenter(report);
    try {
      const period = { type: report.reportType === "monthly" ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
      const repository = report.reportType === "monthly" ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository;
      const source = await repository.collect(period);
      if (token === this.eventLoadToken) {
        this.eventSource = source;
      }
    } catch (error) {
      if (token === this.eventLoadToken) {
        this.eventError = errorMessage(error);
      }
    } finally {
      if (token === this.eventLoadToken) {
        this.eventLoading = false;
        this.refreshEventCenter(report);
      }
    }
  }
  invalidateEventSource() {
    this.eventLoadToken += 1;
    this.eventLoading = false;
    this.eventSource = null;
    this.eventError = "";
    if (!this.backfillBusy && !this.busy) {
      this.refreshEventCenter();
    }
  }
  clearEventState() {
    this.eventLoadToken += 1;
    this.eventLoading = false;
    this.eventSource = null;
    this.eventError = "";
    this.backfillBusy = false;
    this.backfillMessage = "";
  }
  async beginEventBackfill(report) {
    const candidates = this.eventSource?.eventCalibrationSessions ?? [];
    if (candidates.length === 0 || this.backfillBusy || this.eventSource === null) {
      return;
    }
    const providerLabel = PROVIDER_LABELS[this.plugin.settings.activeProvider] ?? this.plugin.settings.activeProvider;
    const monthly = report.reportType === "monthly";
    const scope = monthly ? "本月" : "本周";
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: `心迹${monthly ? "月报" : "周报"} · 图谱整理`,
      title: `校准${scope}图谱事件？`,
      description: `将把 ${candidates.length} 篇记录的日记正文、切片和已有事件发送给 ${providerLabel}，统一进展、体验/方向线索、实体与关系；不会发送原始问答。`,
      confirmLabel: "开始整理",
      stages: [`收集${scope}事件`, "校准图谱事件", "逐篇写回日记", "重新读取事件", "生成并更新图谱"],
      run: async (update, { signal }) => {
        this.backfillBusy = true;
        this.backfillMessage = `正在后台用${monthly ? "自然周片段" : "整周上下文"}整理 ${candidates.length} 篇记录。`;
        this.refreshEventCenter(report);
        update({ stage: 1, total: 5, title: `收集${scope}事件`, detail: "正在读取最新日记，避免覆盖任务期间发生的修改。" });
        const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
        const repository = monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository;
        const latestSource = await repository.collect(period);
        const calibrated = monthly ? await this.plugin.calibrateMonthlyEvents(latestSource, update, void 0, signal) : await this.plugin.calibrateWeeklyEvents(latestSource, update, void 0, signal);
        update({ stage: 5, total: 5, title: "生成并更新图谱", detail: "正在构建新的图谱布局并恢复当前浏览位置。" });
        this.eventSource = calibrated;
        this.eventError = "";
        return calibrated;
      },
      onSuccess: async () => {
        this.backfillBusy = false;
        this.backfillMessage = "";
        this.refreshEventCenter(report);
        await new Promise((resolve) => this.ownerWindow.requestAnimationFrame(() => this.ownerWindow.requestAnimationFrame(resolve)));
      },
      onError: async () => {
        this.backfillBusy = false;
        this.backfillMessage = "";
        try {
          const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
          this.eventSource = await (monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository).collect(period);
          this.eventError = "";
        } catch (error) {
          this.eventError = errorMessage(error);
        }
        this.refreshEventCenter(report);
      },
      onCancel: () => {
        this.backfillBusy = false;
        this.backfillMessage = "";
        this.refreshEventCenter(report);
      },
      successTitle: `${scope}图谱已经整理完成`,
      successDetail: `已校准 ${candidates.length} 篇记录，并根据写回后的事件重新生成图谱。`,
      successLabel: "查看图谱",
      backgroundSuccess: `${scope}图谱整理完成`
    });
  }
  async beginInvalidEventRegeneration(report) {
    const candidates = this.eventSource?.eventInvalidSessions ?? [];
    if (candidates.length === 0 || this.backfillBusy || this.eventSource === null) {
      return;
    }
    const providerLabel = PROVIDER_LABELS[this.plugin.settings.activeProvider] ?? this.plugin.settings.activeProvider;
    const monthly = report.reportType === "monthly";
    const scope = monthly ? "本月" : "本周";
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: `心迹${monthly ? "月报" : "周报"} · 事件修复`,
      title: `批量重新生成 ${candidates.length} 篇事件？`,
      description: `将把结构不匹配记录的日记正文与切片发送给 ${providerLabel}${monthly ? "，并按自然周分组抽取" : ""}；已有效的事件只用于统一命名和控制每周数量，不会被改写，也不会发送原始问答。`,
      confirmLabel: "批量重新生成",
      stages: [`收集${scope}异常记录`, monthly ? "按自然周重新抽取" : "重新抽取事件", "校验并逐篇写回", "重新汇总图谱"],
      run: async (update, { signal }) => {
        this.backfillBusy = true;
        this.backfillMessage = `正在批量重新生成 ${candidates.length} 篇结构不匹配的事件。`;
        this.refreshEventCenter(report);
        update({ stage: 1, total: 4, title: `收集${scope}异常记录`, detail: "正在读取最新日记，避免覆盖任务期间发生的修改。" });
        const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
        const repository = monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository;
        const latestSource = await repository.collect(period);
        const regenerated = await this.plugin.regenerateInvalidEvents(latestSource, update, void 0, signal);
        this.eventSource = regenerated;
        this.eventError = "";
        return regenerated;
      },
      onSuccess: async () => {
        this.backfillBusy = false;
        this.backfillMessage = "";
        this.refreshEventCenter(report);
        await new Promise((resolve) => this.ownerWindow.requestAnimationFrame(() => this.ownerWindow.requestAnimationFrame(resolve)));
      },
      onError: async () => {
        this.backfillBusy = false;
        this.backfillMessage = "";
        try {
          const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
          this.eventSource = await (monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository).collect(period);
          this.eventError = "";
        } catch (error) {
          this.eventError = errorMessage(error);
        }
        this.refreshEventCenter(report);
      },
      onCancel: () => {
        this.backfillBusy = false;
        this.backfillMessage = "";
        this.refreshEventCenter(report);
      },
      successTitle: `${scope}不匹配事件已经重新生成`,
      successDetail: `已重新生成 ${candidates.length} 篇记录，并根据写回后的事件更新图谱。`,
      successLabel: "查看图谱",
      backgroundSuccess: `${scope}事件批量重新生成完成`
    });
  }
  beginReportRegeneration(report) {
    const monthly = report.reportType === "monthly";
    const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: `心迹${monthly ? "月报" : "周报"} · 长任务`,
      title: `重新整理这份${monthly ? "月报" : "周报"}？`,
      description: `将重新整理${monthly ? "本月" : "本周"}图谱事件、写回未人工确认的日记事件，并替换现有${monthly ? "月报" : "周报"} Markdown。`,
      confirmLabel: "重新整理",
      warning: true,
      stages: [`读取${monthly ? "本月" : "本周"}记录`, "整理图谱事件", "模型校准事件", "逐篇写回日记", `生成${monthly ? "月报" : "周报"}内容`, `保存${monthly ? "月报" : "周报"}`, "构建图谱数据", `更新${monthly ? "月报" : "周报"}与图谱`],
      run: async (update, { signal }) => {
        this.busy = true;
        this.render(true);
        const result = monthly ? await this.plugin.generateMonthlyReport(period, true, false, update, signal) : await this.plugin.generateWeeklyReport(period, true, false, update, signal);
        update({ stage: 8, total: 8, title: `更新${monthly ? "月报" : "周报"}与图谱`, detail: `正在载入新${monthly ? "月报" : "周报"}并恢复当前浏览位置。` });
        this.data = await this.app.vault.cachedRead(result.file);
        this.eventSource = result.source;
        return result;
      },
      onSuccess: async () => {
        this.busy = false;
        this.inlineError = "";
        this.render(true);
        await new Promise((resolve) => this.ownerWindow.requestAnimationFrame(() => this.ownerWindow.requestAnimationFrame(resolve)));
      },
      onError: async () => {
        this.busy = false;
        try {
          this.eventSource = await (monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository).collect(period);
          this.eventError = "";
        } catch (error) {
          this.eventError = errorMessage(error);
        }
        this.render(true);
      },
      onCancel: () => {
        this.busy = false;
        this.render(true);
      },
      successTitle: `${monthly ? "月报" : "周报"}和图谱已经重新整理`,
      successDetail: `事件已按${monthly ? "自然周片段" : "整周"}上下文校准，${monthly ? "月报" : "周报"}与图谱均已更新。`,
      successLabel: `查看新${monthly ? "月报" : "周报"}`,
      backgroundSuccess: `${monthly ? "月报" : "周报"}和图谱重新整理完成`
    });
  }
  renderError(container, message) {
    const state = container.createDiv({
      cls: "mind-trace-empty-state mind-trace-saved-error"
    });
    state.createDiv({
      cls: "mind-trace-empty-mark",
      text: "无法恢复布局"
    });
    state.createDiv({ cls: "mind-trace-empty-title", text: message });
    state.createEl("p", {
      text: "原始 Markdown 没有被修改，可以切换到源码继续查看和修复。"
    });
    const button = state.createEl("button", {
      text: "编辑原始 Markdown",
      attr: { type: "button" }
    });
    button.addEventListener("click", () => {
      void this.openMarkdownSource();
    });
  }
  async openMarkdownSource() {
    if (this.file === null || !this.plugin.isPrivacyUnlocked()) {
      return;
    }
    await this.plugin.openProtectedMarkdownSource(this.leaf, this.file);
  }
};
