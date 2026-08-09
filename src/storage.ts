// src/storage.ts
import * as import_obsidian6 from "obsidian";
import { EVENT_KIND_LABELS, EVENT_RELATION_LABELS, EVENT_SCHEMA_VERSION, EVENT_STATUS_LABELS, EVENT_TRACE_KIND_LABELS, EVENT_TYPE_LABELS, JOURNAL_SCHEMA_VERSION, validateEvents } from "./conversation";
import { addLocalDays, localDateString, localTimeString, parseLocalDate } from "./date-utils";
import { errorMessage } from "./journal-view";
import { parseEventSectionMeta, parseFrontmatter, parseSavedJournal } from "./saved-journal";

export { JournalRepository, eventMarkdownText, inlineMarkdown, parseEventMarkdownText, regeneratedSessionValue, yamlString };
function yamlString(value) {
  return JSON.stringify(value);
}
function frontmatterText(frontmatter) {
  return [
    "---",
    "mind-trace: true",
    `mind-trace-version: ${frontmatter["mind-trace-version"] ?? 3}`,
    `date: ${frontmatter.date}`,
    `mood: [${frontmatter.mood.join(", ")}]`,
    `energy: [${frontmatter.energy.join(", ")}]`,
    `stress: [${frontmatter.stress.join(", ")}]`,
    `themes: [${frontmatter.themes.map(yamlString).join(", ")}]`,
    "---"
  ].join("\n");
}
function quoteCalloutLine(line) {
  return line.length > 0 ? `> ${line}` : ">";
}
function inlineMarkdown(value) {
  return value.replace(/\n/g, " ").replace(/\|/g, "\\|");
}
function eventMarkdownText(value) {
  return value.replace(/\n/g, " ").replace(/([\\`*_[\]{}<>#+.!|])/g, "\\$1");
}
function parseEventMarkdownText(value) {
  return value.replace(/\\([\\`*_[\]{}<>#+.!|])/g, "$1").trim();
}
function ratingDifferenceText2(selfScore, aiScore) {
  const difference = aiScore - selfScore;
  if (difference === 0) {
    return "一致";
  }
  return `AI ${difference > 0 ? "高" : "低"} ${Math.abs(difference)} 分`;
}
function ratingComparisonLines(draft) {
  const assessment = draft.aiAssessment;
  if (assessment === void 0) {
    return [];
  }
  const rows = [
    ["mood", "心情"],
    ["energy", "精力"],
    ["stress", "压力"]
  ].map(([key, label]) => {
    const selfScore = draft.ratings[key];
    const aiScore = assessment[key].score;
    return `| ${label} | ${selfScore}/5 | ${aiScore}/5 | ${ratingDifferenceText2(selfScore, aiScore)} |`;
  });
  const reasons = [
    ["mood", "心情"],
    ["energy", "精力"],
    ["stress", "压力"]
  ].map(
    ([key, label]) => `> - **${label}**：${inlineMarkdown(assessment[key].reason)}`
  );
  return [
    "### 状态对照",
    "",
    "| 维度 | 我的感受 | AI 观察 | 差异 |",
    "| --- | ---: | ---: | --- |",
    ...rows,
    "",
    "> [!note]- AI 判断依据",
    ...reasons,
    ""
  ];
}
function createEventId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function eventMarkdownBody(events) {
  const validated = validateEvents(Array.isArray(events) ? events : []);
  if (validated.length === 0) {
    return "_今天没有提取到明确事件。_";
  }
  return validated.flatMap((event) => {
    const id = event.id.length > 0 ? event.id : createEventId();
    const lines = [
      `#### ${EVENT_TYPE_LABELS[event.type]}｜${eventMarkdownText(event.title)}`,
      `<!-- mind-trace-event-id: ${eventMarkdownText(id)} -->`,
      `- 概要：${eventMarkdownText(event.summary)}`,
      `- 状态｜${event.status}：${EVENT_STATUS_LABELS[event.status]}`
    ];
    for (const trace of event.traces) {
      lines.push(`- 线索｜${trace.kind}｜${trace.certainty}｜${EVENT_TRACE_KIND_LABELS[trace.kind]}：${eventMarkdownText(trace.text)}`);
      if (trace.evidence.length > 0) {
        lines.push(`  - 依据：${eventMarkdownText(trace.evidence)}`);
      }
    }
    for (const argument of event.arguments) {
      lines.push(`- 论元｜${argument.role}｜${eventMarkdownText(argument.label)}｜${EVENT_KIND_LABELS[argument.entity.kind]}：${eventMarkdownText(argument.entity.name)}`);
    }
    for (const relation of event.relations) {
      lines.push(`- 关系｜${EVENT_RELATION_LABELS[relation.type]}｜${eventMarkdownText(relation.label)}｜${EVENT_KIND_LABELS[relation.subject.kind]}：${eventMarkdownText(relation.subject.name)}｜${EVENT_KIND_LABELS[relation.object.kind]}：${eventMarkdownText(relation.object.name)}`);
    }
    return [...lines, ""];
  }).join("\n").trimEnd();
}
function eventMarkdownSection(events, options: any = {}) {
  const meta = {
    schema: EVENT_SCHEMA_VERSION,
    source: ["daily", "weekly", "manual"].includes(options.source) ? options.source : "daily",
    reviewed: options.reviewed === true
  };
  return `### 今日事件\n\n<!-- mind-trace-events: ${JSON.stringify(meta)} -->\n\n${eventMarkdownBody(events)}`;
}
function renderJournalSection(date, draft, entry, options: any = {}) {
  const insights = entry.insights.map((insight) => `- ${insight}`).join("\n");
  const facets = entry.facets.map(
    (facet) => `- **${facet.category.replace(/\n/g, " ")}**：${facet.summary.replace(/\n/g, " ")}`
  ).join("\n");
  const themes = entry.themes.map((theme) => `- ${theme}`).join("\n");
  const transcript = draft.answers.flatMap((answer) => [
    `> **${answer.question}**`,
    ...answer.answer.split("\n").map(quoteCalloutLine),
    ">"
  ]).join("\n");
  const transcriptBlock = typeof options.transcriptMarkdown === "string" && options.transcriptMarkdown.trim().length > 0 ? options.transcriptMarkdown.replace(/\r?\n+$/, "") : ["> [!info]- 原始问答", transcript].join("\n");
  const sessionMeta = {
    schema: JOURNAL_SCHEMA_VERSION,
    generatedAt: options.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    source: options.source === "regenerated" ? "regenerated" : "conversation"
  };
  return [
    `## ${options.time ?? localTimeString(date)}`,
    `<!-- mind-trace-session: ${JSON.stringify(sessionMeta)} -->`,
    "",
    "### 日记",
    "",
    entry.diary,
    "",
    eventMarkdownSection(entry.events),
    "",
    "### 今日切片",
    "",
    facets,
    "",
    ...ratingComparisonLines(draft),
    "### 本次轻反思",
    "",
    insights,
    "",
    "### 明日微行动",
    "",
    entry.microAction,
    "",
    "### 留给自己的问题",
    "",
    entry.selfQuestion,
    "",
    "### 今日主题",
    "",
    themes,
    "",
    transcriptBlock
  ].join("\n");
}
function renderNewJournal(date, draft, entry) {
  const dateString = localDateString(date);
  const frontmatter = {
    "mind-trace": true,
    "mind-trace-version": JOURNAL_SCHEMA_VERSION,
    date: dateString,
    mood: [draft.ratings.mood],
    energy: [draft.ratings.energy],
    stress: [draft.ratings.stress],
    themes: [...new Set(entry.themes)]
  };
  return [
    frontmatterText(frontmatter),
    "",
    `# ${dateString} 心迹`,
    "",
    renderJournalSection(date, draft, entry),
    ""
  ].join("\n");
}
function isMindTraceFrontmatter(frontmatter, date = undefined) {
  return frontmatter?.["mind-trace"] === true && (date === void 0 || frontmatter.date === date);
}
function numberArray(value, key) {
  if (!Array.isArray(value) || value.some(
    (item) => typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > 5
  )) {
    throw new Error(`日记属性 ${key} 已损坏`);
  }
  return value.filter((item) => typeof item === "number");
}
function stringArray(value, key) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`日记属性 ${key} 已损坏`);
  }
  return value.filter((item) => typeof item === "string");
}
function updateJournalFrontmatter(frontmatterValue, ratings, themes) {
  if (typeof frontmatterValue !== "object" || frontmatterValue === null || Array.isArray(frontmatterValue)) {
    throw new Error("日记属性已损坏");
  }
  const frontmatter = frontmatterValue;
  frontmatter["mind-trace-version"] = JOURNAL_SCHEMA_VERSION;
  frontmatter.mood = [...numberArray(frontmatter.mood, "mood"), ratings.mood];
  frontmatter.energy = [
    ...numberArray(frontmatter.energy, "energy"),
    ratings.energy
  ];
  frontmatter.stress = [
    ...numberArray(frontmatter.stress, "stress"),
    ratings.stress
  ];
  frontmatter.themes = [
    .../* @__PURE__ */ new Set([...stringArray(frontmatter.themes, "themes"), ...themes])
  ];
}
function appendJournalSessionContent(content, date, draft, entry) {
  const info = (0, import_obsidian6.getFrontMatterInfo)(content);
  if (!info.exists) {
    throw new Error("日记属性已损坏");
  }
  const parsed = (0, import_obsidian6.parseYaml)(info.frontmatter);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) || parsed["mind-trace"] !== true) {
    throw new Error("日记属性已损坏");
  }
  updateJournalFrontmatter(parsed, draft.ratings, entry.themes);
  const yaml = (0, import_obsidian6.stringifyYaml)(parsed);
  const withFrontmatter = `${content.slice(0, info.from)}${yaml}${content.slice(info.to)}`.trimEnd();
  const updated = `${withFrontmatter}\n\n---\n\n${renderJournalSection(date, draft, entry)}\n`;
  const updatedInfo = (0, import_obsidian6.getFrontMatterInfo)(updated);
  const updatedFrontmatter = updatedInfo.exists ? (0, import_obsidian6.parseYaml)(updatedInfo.frontmatter) : null;
  if (typeof updatedFrontmatter !== "object" || updatedFrontmatter === null || Array.isArray(updatedFrontmatter)) {
    throw new Error("日记属性更新失败");
  }
  parseSavedJournal(updated, updatedFrontmatter);
  return updated;
}
function chooseJournalPath(folder, date, exists) {
  const preferred = `${folder}/${date}.md`;
  if (!exists(preferred)) {
    return preferred;
  }
  const fallback = `${folder}/${date}-心迹.md`;
  if (!exists(fallback)) {
    return fallback;
  }
  let suffix = 2;
  while (exists(`${folder}/${date}-心迹-${suffix}.md`)) {
    suffix += 1;
  }
  return `${folder}/${date}-心迹-${suffix}.md`;
}
function historyDateIncluded(date, historyDays, now) {
  if (historyDays === 0) {
    return false;
  }
  const threshold = localDateString(addLocalDays(now, -historyDays));
  const today = localDateString(now);
  return date >= threshold && date < today;
}
function extractSections(content) {
  const sessionBlocks = content.split(/^## \d{2}:\d{2}\s*$/m).slice(1);
  const excerpts = sessionBlocks.flatMap((block) => {
    const diary = /### 日记\s*\n+([\s\S]*?)(?=\n### |\n> \[!|$)/.exec(block);
    const events = /### 今日事件\s*\n+([\s\S]*?)(?=\n### |\n> \[!|$)/.exec(block);
    const action = /### 明日微行动\s*\n+([\s\S]*?)(?=\n### |\n> \[!|$)/.exec(
      block
    );
    if (diary?.[1] === void 0) {
      return [];
    }
    const parts = [`日记：${diary[1].trim()}`];
    if (events?.[1] !== void 0 && !events[1].includes("今天没有提取到明确事件")) {
      try {
        parseEventSectionMeta(events[1]);
        parts.push(`事件与元素：${events[1].trim()}`);
      } catch {
      }
    }
    if (action?.[1] !== void 0) {
      parts.push(`微行动：${action[1].trim()}`);
    }
    return [parts.join("\n")];
  });
  return excerpts.join("\n\n");
}
function insertSessionEventSection(content, sessionIndex, events, options: any = {}) {
  const headings = [...content.matchAll(/^## \d{2}:\d{2}\s*$/gm)];
  const heading = headings[sessionIndex];
  if (heading === void 0) {
    throw new Error("待补全的日记会话已经不存在");
  }
  const blockStart = heading.index + heading[0].length;
  const blockEnd = headings[sessionIndex + 1]?.index ?? content.length;
  const block = content.slice(blockStart, blockEnd);
  if (block.includes("### 今日事件")) {
    throw new Error("事件章节已经存在");
  }
  const nextSection = block.indexOf("\n### 今日切片");
  if (nextSection === -1) {
    throw new Error("找不到今日切片，无法安全插入事件章节");
  }
  const insertion = `\n\n${eventMarkdownSection(events, options)}\n`;
  const absolute = blockStart + nextSection;
  const updated = `${content.slice(0, absolute)}${insertion}${content.slice(absolute)}`;
  return updated;
}
function replaceSessionEventSection(content, sessionIndex, events, options: any = {}) {
  const validated = validateEvents(events);
  const headings = [...content.matchAll(/^## \d{2}:\d{2}\s*$/gm)];
  const heading = headings[sessionIndex];
  if (heading === void 0) {
    throw new Error("要修改的日记会话已经不存在");
  }
  const blockStart = heading.index + heading[0].length;
  const blockEnd = headings[sessionIndex + 1]?.index ?? content.length;
  const block = content.slice(blockStart, blockEnd);
  const eventHeading = /^### 今日事件\s*$/m.exec(block);
  if (eventHeading === null) {
    return insertSessionEventSection(content, sessionIndex, validated, options);
  }
  const following = /^### .+$/gm;
  following.lastIndex = eventHeading.index + eventHeading[0].length;
  const nextHeading = following.exec(block);
  if (nextHeading === null) {
    throw new Error("找不到事件章节后的内容，无法安全保存修改");
  }
  const replacement = `${eventMarkdownSection(validated, options)}\n\n`;
  const updatedBlock = `${block.slice(0, eventHeading.index)}${replacement}${block.slice(nextHeading.index)}`;
  return `${content.slice(0, blockStart)}${updatedBlock}${content.slice(blockEnd)}`;
}
function regeneratedSessionValue(source, entry, assessment) {
  return {
    ...source,
    version: JOURNAL_SCHEMA_VERSION,
    source: "regenerated",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    diary: entry.diary,
    events: entry.events,
    eventState: "ready",
    eventSchema: EVENT_SCHEMA_VERSION,
    eventSource: "daily",
    eventReviewed: false,
    facets: entry.facets,
    ratings: {
      mood: { selfScore: source.ratings.mood.selfScore, aiScore: assessment.mood.score, reason: assessment.mood.reason },
      energy: { selfScore: source.ratings.energy.selfScore, aiScore: assessment.energy.score, reason: assessment.energy.reason },
      stress: { selfScore: source.ratings.stress.selfScore, aiScore: assessment.stress.score, reason: assessment.stress.reason }
    },
    insights: entry.insights,
    microAction: entry.microAction,
    selfQuestion: entry.selfQuestion,
    themes: entry.themes
  };
}
function regeneratedSessionMarkdown(documentDate, replacement) {
  const draft = {
    entryDate: documentDate,
    ratings: {
      mood: replacement.source.ratings.mood.selfScore,
      energy: replacement.source.ratings.energy.selfScore,
      stress: replacement.source.ratings.stress.selfScore
    },
    answers: replacement.source.transcriptAnswers,
    aiAssessment: replacement.assessment
  };
  return renderJournalSection(parseLocalDate(documentDate) ?? (/* @__PURE__ */ new Date()), draft, replacement.entry, {
    time: replacement.source.time,
    source: "regenerated",
    generatedAt: replacement.generatedAt,
    transcriptMarkdown: replacement.source.transcriptMarkdown
  });
}
function updateJournalHeaderText(content, themes) {
  let updated = content.replace(/^(mind-trace-version:)\s*\d+\s*$/m, `$1 ${JOURNAL_SCHEMA_VERSION}`);
  if (updated === content && /^---\s*$/m.test(updated)) {
    updated = updated.replace(/^---\s*$/m, `---\nmind-trace-version: ${JOURNAL_SCHEMA_VERSION}`);
  }
  const themeLine = `themes: [${[...new Set(themes)].map(yamlString).join(", ")}]`;
  if (/^themes:\s*.*$/m.test(updated)) updated = updated.replace(/^themes:\s*.*$/m, themeLine);
  return updated;
}
function replaceJournalSessionsContent(content, document2, replacements) {
  const headings = [...content.matchAll(/^## \d{2}:\d{2}\s*$/gm)];
  let updated = content;
  for (const replacement of [...replacements].sort((left, right) => right.sessionIndex - left.sessionIndex)) {
    const heading = headings[replacement.sessionIndex];
    if (heading === void 0) throw new Error("要更新的日记会话已经不存在");
    const start = heading.index;
    const end = headings[replacement.sessionIndex + 1]?.index ?? content.length;
    const separator = replacement.sessionIndex + 1 < headings.length ? "\n\n---\n\n" : "\n";
    updated = `${updated.slice(0, start)}${regeneratedSessionMarkdown(document2.date, replacement)}${separator}${updated.slice(end)}`;
  }
  const parsed = parseSavedJournal(updated, parseFrontmatter(updated));
  return updateJournalHeaderText(updated, parsed.sessions.flatMap((session) => session.themes));
}
var JournalRepository = class {
  declare app: any;
  declare assertOperational: () => void;
  constructor(app, assertOperational = () => {}) {
    this.app = app;
    this.assertOperational = assertOperational;
  }
  saving = false;
  async save(draft, entry, settings, date = /* @__PURE__ */ new Date()) {
    if (this.saving) {
      throw new Error("日记正在保存，请稍候");
    }
    this.saving = true;
    try {
      const folder = (0, import_obsidian6.normalizePath)(settings.journalFolder.trim());
      if (folder.length === 0 || folder === "/") {
        throw new Error("日记目录不能为空");
      }
      await this.ensureFolder(folder);
      const dateString = localDateString(date);
      const existing = this.findDateFile(folder, dateString);
      if (existing !== null) {
        const filePath = existing.path;
        const expectedMtime = existing.stat.mtime;
        this.assertOperational();
        await this.app.vault.process(existing, (content) => {
          this.assertOperational();
          const current = this.app.vault.getAbstractFileByPath(filePath);
          if (!(current instanceof import_obsidian6.TFile) || current.stat.mtime !== expectedMtime) {
            throw new Error("日记在保存期间发生了修改，未追加新记录");
          }
          return appendJournalSessionContent(content, date, draft, entry);
        });
        return existing;
      }
      const path = chooseJournalPath(
        folder,
        dateString,
        (candidate) => this.app.vault.getAbstractFileByPath(candidate) !== null
      );
      this.assertOperational();
      return await this.app.vault.create(
        path,
        renderNewJournal(date, draft, entry)
      );
    } finally {
      this.saving = false;
    }
  }
  async recentContext(settings, now = /* @__PURE__ */ new Date()) {
    if (settings.historyDays === 0) {
      return "";
    }
    const candidates = this.app.vault.getMarkdownFiles().flatMap((file) => {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontmatter === void 0 || !isMindTraceFrontmatter(frontmatter) || typeof frontmatter.date !== "string" || !historyDateIncluded(
        frontmatter.date,
        settings.historyDays,
        now
      )) {
        return [];
      }
      return [{ file, date: frontmatter.date }];
    }).sort((left, right) => left.date.localeCompare(right.date));
    const excerpts = [];
    for (const candidate of candidates) {
      const content = await this.app.vault.cachedRead(candidate.file);
      const sections = extractSections(content);
      if (sections.length > 0) {
        excerpts.push(`【${candidate.date}】
${sections}`);
      }
    }
    return excerpts.join("\n\n");
  }
  async updateSessionEvents(file, sessionIndex, events, expectedMtime) {
    if (!(file instanceof import_obsidian6.TFile)) {
      throw new Error("日记文件已经移动或删除");
    }
    if (typeof expectedMtime !== "number" || file.stat.mtime !== expectedMtime) {
      throw new Error("日记在编辑期间发生了修改，请重新检查后再保存");
    }
    const filePath = file.path;
    let updated = "";
    this.assertOperational();
    await this.app.vault.process(file, (content) => {
      this.assertOperational();
      const current = this.app.vault.getAbstractFileByPath(filePath);
      if (!(current instanceof import_obsidian6.TFile) || current.stat.mtime !== expectedMtime) {
        throw new Error("日记在编辑期间发生了修改，请重新检查后再保存");
      }
      updated = replaceSessionEventSection(content, sessionIndex, events, { source: "manual", reviewed: true });
      return updated;
    });
    return updated;
  }
  async updateJournalSessions(file, document2, replacements, expectedMtime) {
    if (!(file instanceof import_obsidian6.TFile) || file.stat.mtime !== expectedMtime) {
      throw new Error("日记在生成校样后发生了修改，请重新生成后再保存");
    }
    const filePath = file.path;
    let updated = "";
    this.assertOperational();
    await this.app.vault.process(file, (content) => {
      this.assertOperational();
      const current = this.app.vault.getAbstractFileByPath(filePath);
      if (!(current instanceof import_obsidian6.TFile) || current.stat.mtime !== expectedMtime) {
        throw new Error("日记在读取期间发生了修改，请重新生成后再保存");
      }
      updated = replaceJournalSessionsContent(content, document2, replacements);
      parseSavedJournal(updated, parseFrontmatter(updated));
      return updated;
    });
    return updated;
  }
  async applyEventBackfill(results, onProgress = null) {
    const grouped = /* @__PURE__ */ new Map();
    for (const result of results) {
      const values = grouped.get(result.source.filePath) ?? [];
      values.push(result);
      grouped.set(result.source.filePath, values);
    }
    const blocked = /* @__PURE__ */ new Map();
    for (const [filePath, fileResults] of grouped) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof import_obsidian6.TFile)) {
        blocked.set(filePath, `日记文件已经移动或删除：${filePath}`);
        continue;
      }
      const expectedMtime = fileResults[0]?.source.fileMtime;
      if (typeof expectedMtime !== "number" || file.stat.mtime !== expectedMtime) {
        blocked.set(filePath, `日记在校准期间发生了修改：${filePath}`);
      }
    }
    const succeeded = [];
    const failed = [];
    let processed = 0;
    for (const [filePath, fileResults] of grouped) {
      const blockedMessage = blocked.get(filePath);
      if (blockedMessage !== void 0) {
        failed.push(...fileResults.map((result) => ({ date: result.source.date, time: result.source.time, filePath, message: blockedMessage })));
        processed += 1;
        onProgress?.(processed, grouped.size, filePath);
        continue;
      }
      try {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof import_obsidian6.TFile)) {
          throw new Error("日记文件已经移动或删除");
        }
        const expectedMtime = fileResults[0]?.source.fileMtime;
        if (typeof expectedMtime !== "number" || file.stat.mtime !== expectedMtime) {
          throw new Error("日记在提取后发生了修改，已跳过以避免覆盖");
        }
        this.assertOperational();
        await this.app.vault.process(file, (currentContent) => {
          this.assertOperational();
          const current = this.app.vault.getAbstractFileByPath(filePath);
          if (!(current instanceof import_obsidian6.TFile) || current.stat.mtime !== expectedMtime) {
            throw new Error("日记在读取期间发生了修改，已跳过以避免覆盖");
          }
          let updated = currentContent;
          for (const result of [...fileResults].sort((left, right) => right.source.sessionIndex - left.source.sessionIndex)) {
            updated = result.source.eventState === "missing" ? insertSessionEventSection(updated, result.source.sessionIndex, result.events, { source: "weekly", reviewed: false }) : replaceSessionEventSection(updated, result.source.sessionIndex, result.events, { source: "weekly", reviewed: false });
          }
          return updated;
        });
        succeeded.push(...fileResults.map((result) => ({ date: result.source.date, time: result.source.time, filePath })));
      } catch (error) {
        failed.push(...fileResults.map((result) => ({ date: result.source.date, time: result.source.time, filePath, message: errorMessage(error) })));
      } finally {
        processed += 1;
        onProgress?.(processed, grouped.size, filePath);
      }
    }
    return { succeeded, failed };
  }
  findDateFile(folder, date) {
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(`${folder}/`)) {
        continue;
      }
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (isMindTraceFrontmatter(frontmatter, date)) {
        return file;
      }
    }
    return null;
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
      } else if (!(existing instanceof import_obsidian6.TFolder)) {
        throw new Error(`无法创建日记目录：${current} 已经是文件`);
      }
    }
  }
};
