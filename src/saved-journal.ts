// src/saved-journal-view.ts
import * as import_obsidian3 from "obsidian";
import { EVENT_KIND_LABELS, EVENT_LABEL_KINDS, EVENT_RELATION_LABEL_VALUES, EVENT_ROLES, EVENT_ROLE_LABELS, EVENT_ROLE_LABEL_VALUES, EVENT_SCHEMA_VERSION, EVENT_STATUSES, EVENT_STATUS_LABELS, EVENT_STATUS_LABEL_VALUES, EVENT_TRACE_CERTAINTIES, EVENT_TRACE_CERTAINTY_LABELS, EVENT_TRACE_KINDS, EVENT_TRACE_KIND_LABELS, EVENT_TRACE_KIND_LABEL_VALUES, EVENT_TRACE_KIND_LAYERS, EVENT_TRACE_LAYER_LABELS, EVENT_TYPE_LABELS, EVENT_TYPE_LABEL_VALUES, JOURNAL_SCHEMA_VERSION, MAX_SESSION_EVENTS, eventEntityKey, normalizeEvent, normalizeEventElementName, normalizeEventEntity, normalizeEventRelation, validateEvents } from "./conversation";
import { addLocalDays, localDateString, parseLocalDate } from "./date-utils";
import { EventEditor, generateEventBackfill, generateJournal, generateRatingAssessment } from "./generation";
import { errorMessage } from "./journal-view";
import { calculateStreaks } from "./metrics";
import { renderPrivacyGate } from "./privacy";
import { JournalRegenerationPreviewModal, captureMindTraceContext, confirmMindTraceFileDeletion, openMindTraceOperation, restoreMindTraceContext } from "./providers";
import { mindTraceDocument, mindTraceWindow, showMindTraceNotice } from "./runtime-preamble";
import { PROVIDER_LABELS } from "./settings";
import { parseEventMarkdownText } from "./storage";

export { JournalHistoryIndex, SAVED_JOURNAL_VIEW_TYPE, SavedJournalView, aggregateEventRecords, clearParsedJournalCaches, createHistoryQuery, createTrajectoryQuery, eventArgumentKey, eventElementKey, eventEntityDisambiguationProfiles, filterTrajectoryEventRecords, flattenHistoryEventRecords, historyExcerpt, historyQueryIsActive, historySearchTokens, invalidateParsedJournal, mapWithConcurrency, normalizeHistoryText, parseEventSectionMeta, parseEventTraces, parseFrontmatter, parseSavedJournal, queryHistorySessions, readParsedJournal, rediscoverHistorySessions, renderEventLedger, renderEventTraces, renderSession, trajectoryEntitySummaries, trajectoryEventStats };

// src/saved-journal.ts
var RATING_LABELS = {
  mood: "心情",
  energy: "精力",
  stress: "压力"
};
function sectionBlock(block, heading) {
  const marker = `### ${heading}`;
  const start = block.indexOf(marker);
  if (start === -1) {
    return "";
  }
  const contentStart = start + marker.length;
  const nextHeading = block.indexOf("\n### ", contentStart);
  return block.slice(contentStart, nextHeading === -1 ? block.length : nextHeading).trim();
}
function sectionText(block, heading) {
  const section = sectionBlock(block, heading);
  const callout = section.indexOf("\n> [!");
  return (callout === -1 ? section : section.slice(0, callout)).trim();
}
function frontmatterNumberArray(frontmatter, key) {
  const value = frontmatter[key];
  if (!Array.isArray(value)) {
    throw new Error(`日记属性 ${key} 已损坏`);
  }
  const ratings = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > 5) {
      throw new Error(`日记属性 ${key} 已损坏`);
    }
    ratings.push(item);
  }
  return ratings;
}
function frontmatterThemes(frontmatter) {
  const value = frontmatter.themes;
  if (!Array.isArray(value)) {
    throw new Error("日记属性 themes 已损坏");
  }
  const themes = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error("日记属性 themes 已损坏");
    }
    themes.push(item);
  }
  return themes;
}
function parseList(section) {
  return [...section.matchAll(/^- (.+)$/gm)].flatMap(
    (match) => match[1] === void 0 ? [] : [match[1]]
  );
}
function parseFacets(section) {
  return [...section.matchAll(/^- \*\*(.+?)\*\*：(.+)$/gm)].flatMap(
    (match) => match[1] === void 0 || match[2] === void 0 ? [] : [{ category: match[1], summary: match[2] }]
  );
}
function parseEventSectionMeta(section) {
  const raw = /<!--\s*mind-trace-events:\s*(\{[^\n]+\})\s*-->/.exec(section)?.[1];
  if (raw === void 0) {
    throw new Error("事件章节缺少版本标记");
  }
  const value = JSON.parse(raw);
  if (Number(value.schema) !== EVENT_SCHEMA_VERSION) {
    throw new Error(`事件结构版本不匹配（当前需要 ${EVENT_SCHEMA_VERSION}）`);
  }
  return {
    schema: EVENT_SCHEMA_VERSION,
    source: ["daily", "weekly", "manual"].includes(value.source) ? value.source : "daily",
    reviewed: value.reviewed === true
  };
}
function parseEventTraces(eventBlock) {
  const matches = [...eventBlock.matchAll(/^- 线索｜(.+?)｜(.+?)｜(.+?)：(.+)$/gm)];
  return matches.map((match, index) => {
    const kindText = parseEventMarkdownText(match[1] ?? "fact");
    const certaintyText = parseEventMarkdownText(match[2] ?? "stated");
    const kind = EVENT_TRACE_KINDS.includes(kindText) ? kindText : EVENT_TRACE_KIND_LABEL_VALUES[kindText] ?? "fact";
    const certainty = EVENT_TRACE_CERTAINTIES.includes(certaintyText) ? certaintyText : "stated";
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? eventBlock.length;
    const evidence = parseEventMarkdownText(/^ {2}- 依据：(.+)$/m.exec(eventBlock.slice(start, end))?.[1] ?? "");
    return {
      kind,
      layer: EVENT_TRACE_KIND_LAYERS[kind],
      certainty,
      text: parseEventMarkdownText(match[4] ?? ""),
      evidence
    };
  });
}
function parseSavedEvents(block) {
  if (!block.includes("### 今日事件")) {
    return { state: "missing", events: [] };
  }
  const section = sectionBlock(block, "今日事件");
  let meta;
  try {
    meta = parseEventSectionMeta(section);
  } catch (error) {
    return {
      state: "invalid",
      events: [],
      schema: EVENT_SCHEMA_VERSION,
      source: "daily",
      reviewed: false,
      error: error instanceof Error ? error.message : "事件章节版本无法识别"
    };
  }
  if (section.length === 0 || section.includes("今天没有提取到明确事件")) {
    return { state: "ready", events: [], ...meta };
  }
  try {
    const headings = [...section.matchAll(/^#### (.+?)\s*$/gm)];
    if (headings.length === 0) {
      throw new Error("没有可识别的事件标题");
    }
    const events = headings.map((heading, index) => {
      const rawHeading = parseEventMarkdownText(heading[1] ?? "");
      const typeLabel = rawHeading.includes("｜") ? rawHeading.slice(0, rawHeading.indexOf("｜")).trim() : "";
      const type = EVENT_TYPE_LABEL_VALUES[typeLabel] ?? "other";
      const title = typeLabel.length > 0 && EVENT_TYPE_LABEL_VALUES[typeLabel] !== void 0 ? rawHeading.slice(rawHeading.indexOf("｜") + 1).trim() : rawHeading;
      const start = heading.index + heading[0].length;
      const end = headings[index + 1]?.index ?? section.length;
      const eventBlock = section.slice(start, end);
      const id = parseEventMarkdownText(/<!--\s*mind-trace-event-id:\s*(.+?)\s*-->/.exec(eventBlock)?.[1] ?? "");
      const summary = parseEventMarkdownText(/^- 概要：(.+)$/m.exec(eventBlock)?.[1] ?? "");
      const rawStatus = parseEventMarkdownText(/^- 状态｜(.+?)：/m.exec(eventBlock)?.[1] ?? "");
      const status = EVENT_STATUSES.includes(rawStatus) ? rawStatus : EVENT_STATUS_LABEL_VALUES[rawStatus];
      const traces = parseEventTraces(eventBlock);
      const arguments2 = [];
      for (const match of eventBlock.matchAll(/^- 论元｜(.+?)｜(.+?)｜(.+?)：(.+)$/gm)) {
        const roleCode = parseEventMarkdownText(match[1] ?? "related");
        const roleLabel = parseEventMarkdownText(match[2] ?? "相关");
        const kindLabel = parseEventMarkdownText(match[3] ?? "主题/概念");
        const name = parseEventMarkdownText(match[4] ?? "");
        const role = EVENT_ROLES.includes(roleCode) ? roleCode : EVENT_ROLE_LABEL_VALUES[roleLabel] ?? "related";
        const kind = EVENT_LABEL_KINDS[kindLabel] ?? "topic";
        if (name.length > 0) {
          arguments2.push({ role, label: roleLabel, entity: { kind, name } });
        }
      }
      if (arguments2.length === 0) {
        for (const match of eventBlock.matchAll(/^- 论元｜(.+?)｜(.+?)：(.+)$/gm)) {
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
          for (const match of eventBlock.matchAll(new RegExp(`^- ${label}：(.+)$`, "gm"))) {
            const name = parseEventMarkdownText(match[1] ?? "");
            if (name.length > 0) {
              arguments2.push({ role: "related", label: "相关", entity: { kind, name } });
            }
          }
        }
      }
      const relations = [];
      for (const match of eventBlock.matchAll(/^- 关系｜(.+?)｜(.+?)｜(.+?)：(.+?)｜(.+?)：(.+)$/gm)) {
        const typeText = parseEventMarkdownText(match[1] ?? "其他");
        const label = parseEventMarkdownText(match[2] ?? typeText);
        const subjectKind = EVENT_LABEL_KINDS[parseEventMarkdownText(match[3] ?? "")] ?? "topic";
        const subjectName = parseEventMarkdownText(match[4] ?? "");
        const objectKind = EVENT_LABEL_KINDS[parseEventMarkdownText(match[5] ?? "")] ?? "topic";
        const objectName = parseEventMarkdownText(match[6] ?? "");
        if (subjectName.length > 0 && objectName.length > 0) {
          relations.push({
            type: EVENT_RELATION_LABEL_VALUES[typeText] ?? "other",
            label,
            subject: { kind: subjectKind, name: subjectName },
            object: { kind: objectKind, name: objectName }
          });
        }
      }
      return { id, type, status, title, summary, traces, arguments: arguments2, relations };
    });
    return { state: "ready", events: validateEvents(events), ...meta };
  } catch (error) {
    return {
      state: "invalid",
      events: [],
      ...meta,
      error: error instanceof Error ? error.message : "今日事件格式无法识别"
    };
  }
}
function parseTranscriptBlock(block) {
  const marker = "> [!info]- 原始问答";
  const start = block.indexOf(marker);
  if (start === -1) {
    return { text: "", markdown: "", answers: [], error: "这次记录没有可用的原始问答" };
  }
  const raw = block.slice(start);
  const separator = /\n\n---\s*$/.exec(raw);
  const markdown = (separator === null ? raw : raw.slice(0, separator.index)).replace(/\r?\n+$/, "");
  const quoted = markdown.slice(marker.length).split("\n").map((line) => line.replace(/^> ?/, ""));
  const answers = [];
  let current = null;
  let orphanContent = false;
  const questionMarkers = quoted.filter((line) => /^\*\*/.test(line.trim())).length;
  for (const line of quoted) {
    const question = /^\*\*(.+?)\*\*\s*$/.exec(line.trim());
    if (question !== null) {
      if (current !== null) answers.push(current);
      current = { question: (question[1] ?? "").trim(), lines: [] };
      continue;
    }
    if (current !== null) current.lines.push(line);
    else if (line.trim().length > 0) orphanContent = true;
  }
  if (current !== null) answers.push(current);
  const normalized = answers.map((answer) => ({
    question: answer.question,
    answer: answer.lines.join("\n").replace(/\n+$/g, "").trim(),
    kind: "legacy"
  })).filter((answer) => answer.question.length > 0 && answer.answer.length > 0);
  const text = quoted.join("\n").replace(/\*\*(.+?)\*\*/g, "$1").trim();
  return {
    text,
    markdown,
    answers: normalized,
    error: normalized.length === 0 ? "原始问答格式无法识别" : orphanContent || questionMarkers !== answers.length || normalized.length !== answers.length ? "原始问答包含空问题、空回答或无法识别的结构" : ""
  };
}
function parseSessionMeta(block, fallbackVersion = 3) {
  const raw = /<!--\s*mind-trace-session:\s*(\{[^\n]+\})\s*-->/.exec(block)?.[1];
  if (raw === void 0) return { schema: fallbackVersion, generatedAt: "", source: "legacy" };
  try {
    const value = JSON.parse(raw);
    return {
      schema: Number(value.schema) === JOURNAL_SCHEMA_VERSION ? JOURNAL_SCHEMA_VERSION : fallbackVersion,
      generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
      source: value.source === "regenerated" ? "regenerated" : "conversation"
    };
  } catch {
    return { schema: fallbackVersion, generatedAt: "", source: "legacy" };
  }
}
function parseRating(block, key, selfScore) {
  const section = sectionBlock(block, "状态对照");
  const label = RATING_LABELS[key];
  const row = new RegExp(
    `^\\| ${label} \\| (\\d)\\/5 \\| (\\d)\\/5 \\|`,
    "m"
  ).exec(section);
  const reason = new RegExp(
    `^> - \\*\\*${label}\\*\\*：(.+)$`,
    "m"
  ).exec(section)?.[1];
  if (row?.[2] === void 0) {
    return { selfScore };
  }
  const aiScore = Number(row[2]);
  if (aiScore < 1 || aiScore > 5) {
    return { selfScore };
  }
  return reason === void 0 ? { selfScore, aiScore } : { selfScore, aiScore, reason };
}
function parseSavedJournal(content, frontmatter) {
  if (typeof frontmatter.date !== "string") {
    throw new Error("日记日期已损坏");
  }
  const ratings = {
    mood: frontmatterNumberArray(frontmatter, "mood"),
    energy: frontmatterNumberArray(frontmatter, "energy"),
    stress: frontmatterNumberArray(frontmatter, "stress")
  };
  const dayThemes = frontmatterThemes(frontmatter);
  const fileVersion = Number(frontmatter["mind-trace-version"]) || 3;
  const headings = [...content.matchAll(/^## (\d{2}:\d{2})\s*$/gm)];
  const sessions = headings.map((heading, index) => {
    if (heading[1] === void 0) {
      throw new Error("日记记录时间已损坏");
    }
    const blockStart = heading.index + heading[0].length;
    const blockEnd = headings[index + 1]?.index ?? content.length;
    const block = content.slice(blockStart, blockEnd);
    const mood = ratings.mood[index];
    const energy = ratings.energy[index];
    const stress = ratings.stress[index];
    if (mood === void 0 || energy === void 0 || stress === void 0) {
      throw new Error("日记评分与记录次数不一致");
    }
    const savedThemes = parseList(sectionText(block, "今日主题"));
    const savedEvents = parseSavedEvents(block);
    const transcript = parseTranscriptBlock(block);
    const sessionMeta = parseSessionMeta(block, 3);
    return {
      version: sessionMeta.schema,
      generatedAt: sessionMeta.generatedAt,
      source: sessionMeta.source,
      time: heading[1],
      diary: sectionText(block, "日记"),
      events: savedEvents.events,
      eventState: savedEvents.state,
      eventSchema: savedEvents.schema ?? EVENT_SCHEMA_VERSION,
      eventSource: savedEvents.source ?? "daily",
      eventReviewed: savedEvents.reviewed === true,
      ...(savedEvents.error === void 0 ? {} : { eventError: savedEvents.error }),
      facets: parseFacets(sectionText(block, "今日切片")),
      ratings: {
        mood: parseRating(block, "mood", mood),
        energy: parseRating(block, "energy", energy),
        stress: parseRating(block, "stress", stress)
      },
      insights: parseList(sectionText(block, "本次轻反思") || sectionText(block, "反思洞察")),
      microAction: sectionText(block, "明日微行动"),
      selfQuestion: sectionText(block, "留给自己的问题"),
      themes: savedThemes.length > 0 ? savedThemes : dayThemes,
      transcript: transcript.text,
      transcriptMarkdown: transcript.markdown,
      transcriptAnswers: transcript.answers,
      transcriptError: transcript.error
    };
  });
  return {
    version: fileVersion,
    date: frontmatter.date,
    sessions
  };
}
const PARSED_JOURNAL_CACHE_LIMIT = 500;
const parsedJournalCache = /* @__PURE__ */ new Map();
const parsedJournalInFlight = /* @__PURE__ */ new Map();
let parsedJournalCacheGeneration = 0;
function invalidateParsedJournal(filePath) {
  parsedJournalCacheGeneration += 1;
  const prefix = `${filePath}@`;
  for (const key of parsedJournalCache.keys()) {
    if (key.startsWith(prefix)) parsedJournalCache.delete(key);
  }
  for (const key of parsedJournalInFlight.keys()) {
    if (key.startsWith(prefix)) parsedJournalInFlight.delete(key);
  }
}
function clearParsedJournalCaches() {
  parsedJournalCacheGeneration += 1;
  parsedJournalCache.clear();
  parsedJournalInFlight.clear();
}
async function readParsedJournal(app, file, frontmatter) {
  const key = `${file.path}@${file.stat.mtime}`;
  const generation = parsedJournalCacheGeneration;
  const cached = parsedJournalCache.get(key);
  if (cached !== void 0) {
    parsedJournalCache.delete(key);
    parsedJournalCache.set(key, cached);
    return cached;
  }
  const inFlight = parsedJournalInFlight.get(key);
  if (inFlight !== void 0) {
    return inFlight;
  }
  const task = (async () => {
    const content = await app.vault.cachedRead(file);
    const document = parseSavedJournal(content, frontmatter);
    if (generation === parsedJournalCacheGeneration) parsedJournalCache.set(key, document);
    if (generation === parsedJournalCacheGeneration && parsedJournalCache.size > PARSED_JOURNAL_CACHE_LIMIT) {
      const oldest = parsedJournalCache.keys().next().value;
      if (oldest !== void 0) {
        parsedJournalCache.delete(oldest);
      }
    }
    return document;
  })();
  parsedJournalInFlight.set(key, task);
  try {
    return await task;
  } finally {
    if (parsedJournalInFlight.get(key) === task) parsedJournalInFlight.delete(key);
  }
}
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}
function normalizeHistoryText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}
function historySearchTokens(value) {
  return [...new Set(normalizeHistoryText(value).split(" ").filter((token) => token.length > 0))];
}
function historySessionFields(session) {
  return [
    { key: "events", label: "今日事件", text: session.events.map((event) => `${EVENT_TYPE_LABELS[event.type]}｜${EVENT_STATUS_LABELS[event.status]}｜${event.title}：${event.summary}\n${event.traces.map((trace) => `${EVENT_TRACE_KIND_LABELS[trace.kind]}：${trace.text}${trace.evidence.length > 0 ? `（原话：${trace.evidence}）` : ""}`).join(" · ")}\n${event.arguments.map((argument) => `${argument.label}｜${EVENT_KIND_LABELS[argument.entity.kind]}：${argument.entity.name}`).join(" · ")}\n${event.relations.map((relation) => `${relation.subject.name}${relation.label}${relation.object.name}`).join(" · ")}`).join("\n"), weight: 6 },
    { key: "themes", label: "主题", text: session.themes.join(" · "), weight: 5 },
    { key: "facets", label: "切片", text: session.facets.map((facet) => `${facet.category}：${facet.summary}`).join("\n"), weight: 5 },
    { key: "diary", label: "日记正文", text: session.diary, weight: 4 },
    { key: "insights", label: "反思洞察", text: session.insights.join("\n"), weight: 3 },
    { key: "microAction", label: "微行动", text: session.microAction, weight: 3 },
    { key: "selfQuestion", label: "自我问题", text: session.selfQuestion, weight: 3 },
    { key: "transcript", label: "原始问答", text: session.transcript ?? "", weight: 1 }
  ].map((field) => ({ ...field, normalized: normalizeHistoryText(field.text) }));
}
function createHistorySession(filePath, document2, session, sessionIndex) {
  const fields = historySessionFields(session);
  return {
    id: `${filePath}#${sessionIndex}`,
    filePath,
    sessionIndex,
    date: document2.date,
    time: session.time,
    mood: session.ratings.mood.selfScore,
    energy: session.ratings.energy.selfScore,
    stress: session.ratings.stress.selfScore,
    themes: [...new Set(session.themes)],
    facets: [...new Set(session.facets.map((facet) => facet.category))],
    events: session.events,
    eventState: session.eventState === "invalid" ? "invalid" : session.eventState === "missing" ? "missing" : "ready",
    eventError: typeof session.eventError === "string" ? session.eventError : "",
    eventSchema: Number.isInteger(session.eventSchema) ? session.eventSchema : 0,
    eventReviewed: session.eventReviewed === true,
    diary: session.diary,
    fields
  };
}
function historyExcerpt(text, tokens, maximum = 150) {
  const compact = String(text ?? "").replace(/\s+/g, " ").trim();
  if (compact.length <= maximum) {
    return compact;
  }
  const normalized = normalizeHistoryText(compact);
  const firstMatch = tokens.map((token) => normalized.indexOf(token)).filter((index) => index >= 0).sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, Math.min(compact.length - maximum, firstMatch - Math.floor(maximum / 3)));
  return `${start > 0 ? "…" : ""}${compact.slice(start, start + maximum).trim()}${start + maximum < compact.length ? "…" : ""}`;
}
function historyQueryIsActive(query) {
  return historySearchTokens(query.text).length > 0 || query.datePreset !== "all" || query.themes.size > 0 || query.facets.size > 0 || ["mood", "energy", "stress"].some((key) => query.ratings[key].min !== 1 || query.ratings[key].max !== 5);
}
function createHistoryQuery() {
  return {
    text: "",
    datePreset: "all",
    dateStart: "",
    dateEnd: "",
    themes: /* @__PURE__ */ new Set(),
    facets: /* @__PURE__ */ new Set(),
    ratings: {
      mood: { min: 1, max: 5 },
      energy: { min: 1, max: 5 },
      stress: { min: 1, max: 5 }
    },
    sort: "latest"
  };
}
function historyDateBounds(query, now = /* @__PURE__ */ new Date()) {
  const today = localDateString(now);
  if (query.datePreset === "custom") {
    return { start: query.dateStart, end: query.dateEnd || today };
  }
  if (query.datePreset === "year") {
    return { start: `${now.getFullYear()}-01-01`, end: today };
  }
  const days = Number(query.datePreset);
  if (Number.isFinite(days) && days > 0) {
    return { start: localDateString(addLocalDays(now, -(days - 1))), end: today };
  }
  return { start: "", end: today };
}
function queryHistorySessions(entries, query, now = /* @__PURE__ */ new Date()) {
  const tokens = historySearchTokens(query.text);
  const bounds = historyDateBounds(query, now);
  const results = [];
  for (const entry of entries) {
    if (bounds.start.length > 0 && entry.date < bounds.start || bounds.end.length > 0 && entry.date > bounds.end) {
      continue;
    }
    if (query.themes.size > 0 && !entry.themes.some((theme) => query.themes.has(theme))) {
      continue;
    }
    if (query.facets.size > 0 && !entry.facets.some((facet) => query.facets.has(facet))) {
      continue;
    }
    if (["mood", "energy", "stress"].some((key) => entry[key] < query.ratings[key].min || entry[key] > query.ratings[key].max)) {
      continue;
    }
    let score = 0;
    let matchedField = null;
    let matched = true;
    for (const token of tokens) {
      const fields = entry.fields.filter((field) => field.normalized.includes(token));
      if (fields.length === 0) {
        matched = false;
        break;
      }
      fields.sort((left, right) => right.weight - left.weight);
      score += fields[0].weight;
      if (matchedField === null || fields[0].weight > matchedField.weight) {
        matchedField = fields[0];
      }
    }
    if (!matched) {
      continue;
    }
    const field = matchedField ?? entry.fields.find((candidate) => candidate.key === "diary");
    results.push({
      entry,
      score,
      matchLabel: tokens.length > 0 ? field?.label ?? "日记" : "日记正文",
      excerpt: historyExcerpt(field?.text ?? entry.diary, tokens),
      tokens
    });
  }
  results.sort((left, right) => query.sort === "relevance" && tokens.length > 0 && right.score !== left.score ? right.score - left.score : right.entry.date.localeCompare(left.entry.date) || right.entry.time.localeCompare(left.entry.time));
  return results;
}
function createTrajectoryQuery() {
  return { datePreset: "all", eventType: "all", entityKey: "", actionObstacle: false };
}
function trajectoryDateBounds(preset, now = /* @__PURE__ */ new Date()) {
  const today = localDateString(now);
  if (preset === "year") {
    return { start: `${now.getFullYear()}-01-01`, end: today };
  }
  const days = Number(preset);
  return Number.isFinite(days) && days > 0 ? { start: localDateString(addLocalDays(now, -(days - 1))), end: today } : { start: "", end: today };
}
function filterTrajectoryEventRecords(records, query = createTrajectoryQuery(), now = /* @__PURE__ */ new Date()) {
  const safeQuery = query ?? createTrajectoryQuery();
  const bounds = trajectoryDateBounds(safeQuery.datePreset, now);
  return (Array.isArray(records) ? records : []).filter((record) => {
    if (bounds.start.length > 0 && record.date < bounds.start || bounds.end.length > 0 && record.date > bounds.end) {
      return false;
    }
    if (safeQuery.eventType !== "all" && record.type !== safeQuery.eventType) {
      return false;
    }
    if (safeQuery.actionObstacle && !["action", "obstacle", "intention", "open_loop"].includes(record.type)) {
      return false;
    }
    if (typeof safeQuery.entityKey === "string" && safeQuery.entityKey.length > 0 && !(Array.isArray(record?.elements) ? record.elements : []).some((element) => {
      try {
        return eventElementKey(element) === safeQuery.entityKey;
      } catch {
        return false;
      }
    })) {
      return false;
    }
    return true;
  }).sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time) || left.sessionIndex - right.sessionIndex || left.eventIndex - right.eventIndex);
}
function trajectoryEntitySummaries(records) {
  const entities = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const seen = new Set();
    for (const element of Array.isArray(record?.elements) ? record.elements : []) {
      const name = String(element?.name ?? "").trim();
      if (name.length === 0) continue;
      const entity = normalizeEventEntity(element);
      const key = eventElementKey(entity);
      if (seen.has(key)) continue;
      seen.add(key);
      const current = entities.get(key) ?? { key, kind: entity.kind, name: entity.name, count: 0, firstDate: record.date, lastDate: record.date, eventIds: new Set() };
      current.count += 1;
      current.eventIds.add(record.id);
      if (record.date < current.firstDate) current.firstDate = record.date;
      if (record.date > current.lastDate) {
        current.lastDate = record.date;
        current.name = entity.name;
      }
      entities.set(key, current);
    }
  }
  return [...entities.values()].sort((left, right) => (right.count - left.count) || right.lastDate.localeCompare(left.lastDate) || left.name.localeCompare(right.name));
}
function trajectoryEventStats(entries, records) {
  const dates = [...new Set((Array.isArray(entries) ? entries : []).map((entry) => entry.date).filter(Boolean))].sort();
  const streaks = calculateStreaks(Array.isArray(entries) ? entries : []);
  return {
    firstDate: dates[0] ?? "",
    lastDate: dates[dates.length - 1] ?? "",
    days: dates.length,
    events: Array.isArray(records) ? records.length : 0,
    currentStreak: streaks.current,
    longestStreak: streaks.longest
  };
}
function stableHistoryHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function stableHistoryPick(items, seed) {
  return items.length === 0 ? null : items[stableHistoryHash(seed) % items.length] ?? null;
}
function rediscoverHistorySessions(entries, now = /* @__PURE__ */ new Date()) {
  const today = localDateString(now);
  const eligible = entries.filter((entry) => entry.date <= today).sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time));
  const latest = eligible[0];
  if (latest === void 0) {
    return [];
  }
  const used = /* @__PURE__ */ new Set([latest.id]);
  const discoveries = [];
  const add = (kind, label, reason, entry) => {
    if (entry === null || used.has(entry.id)) {
      return;
    }
    used.add(entry.id);
    discoveries.push({ kind, label, reason, entry });
  };
  const anniversary = eligible.filter((entry) => entry.date < today && entry.date.slice(5) === today.slice(5));
  add("anniversary", "往年今日", "同一个日期，不同的你", anniversary[0] ?? null);
  const cutoff = localDateString(addLocalDays(now, -30));
  const older = eligible.filter((entry) => entry.date <= cutoff && !used.has(entry.id));
  const themed = older.map((entry) => ({
    entry,
    overlap: entry.themes.filter((theme) => latest.themes.includes(theme)).length
  })).filter((candidate) => candidate.overlap > 0);
  const maxOverlap = Math.max(0, ...themed.map((candidate) => candidate.overlap));
  const themePick = stableHistoryPick(themed.filter((candidate) => candidate.overlap === maxOverlap).map((candidate) => candidate.entry), `${today}:theme`);
  const sharedThemes = themePick === null ? [] : themePick.themes.filter((theme) => latest.themes.includes(theme));
  add("theme", "相似主题", sharedThemes.length > 0 ? `再次遇到“${sharedThemes.slice(0, 2).join("、")}”` : "相似的线索", themePick);
  const comparable = older.filter((entry) => !used.has(entry.id)).map((entry) => ({
    entry,
    distance: Math.abs(entry.mood - latest.mood) + Math.abs(entry.energy - latest.energy) + Math.abs(entry.stress - latest.stress)
  }));
  const minimumDistance = Math.min(Infinity, ...comparable.map((candidate) => candidate.distance));
  const statePick = stableHistoryPick(comparable.filter((candidate) => candidate.distance === minimumDistance).map((candidate) => candidate.entry), `${today}:state`);
  add("state", "相似状态", "心情、精力与压力曾经靠得很近", statePick);
  return discoveries;
}
var JournalHistoryIndex = class {
  declare plugin: any;
  constructor(plugin) {
    this.plugin = plugin;
  }
  cache = /* @__PURE__ */ new Map();
  snapshot = null;
  buildPromise = null;
  progress = { done: 0, total: 0 };
  version = 0;
  hasPath(filePath) {
    if (this.cache.has(filePath)) return true;
    return this.snapshot?.entries?.some((entry) => entry.filePath === filePath) === true;
  }
  invalidate(filePath = null) {
    this.version += 1;
    this.snapshot = null;
    if (filePath === null) {
      this.cache.clear();
    } else {
      this.cache.delete(filePath);
    }
  }
  clear() {
    this.invalidate();
    this.buildPromise = null;
    this.progress = { done: 0, total: 0 };
  }
  async load(onProgress = null) {
    if (!this.plugin.isPrivacyUnlocked()) {
      return { entries: [], themes: [], facets: [], ignoredFiles: 0, eventRecords: [], eventStats: { ready: 0, missing: 0, invalid: 0, noEvents: 0, total: 0 } };
    }
    if (this.snapshot !== null) {
      return this.snapshot;
    }
    while (this.plugin.isPrivacyUnlocked()) {
      if (this.snapshot !== null) {
        return this.snapshot;
      }
      if (this.buildPromise === null) {
        const buildVersion = this.version;
        const listeners = /* @__PURE__ */ new Set<(progress: any) => void>();
        this.buildPromise = {
          version: buildVersion,
          listeners,
          promise: this.build(buildVersion, (progress) => {
            this.progress = progress;
            for (const listener of listeners) {
              listener(progress);
            }
          })
        };
      }
      const current = this.buildPromise;
      if (onProgress !== null) {
        current.listeners.add(onProgress);
        onProgress(this.progress);
      }
      let result;
      try {
        result = await current.promise;
      } finally {
        if (onProgress !== null) {
          current.listeners.delete(onProgress);
        }
        if (this.buildPromise === current) {
          this.buildPromise = null;
        }
      }
      if (current.version === this.version) {
        return result;
      }
    }
    return { entries: [], themes: [], facets: [], ignoredFiles: 0, eventRecords: [], eventStats: { ready: 0, missing: 0, invalid: 0, noEvents: 0, total: 0 } };
  }
  async build(buildVersion, onProgress) {
    const files = this.plugin.app.vault.getMarkdownFiles().filter((file) => this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.["mind-trace"] === true);
    let completedFiles = 0;
    onProgress({ done: completedFiles, total: files.length });
    const currentPaths = new Set(files.map((file) => file.path));
    for (const path of this.cache.keys()) {
      if (!currentPaths.has(path)) {
        this.cache.delete(path);
      }
    }
    const entries = [];
    let ignoredFiles = 0;
    for (const file of files) {
      if (!this.plugin.isPrivacyUnlocked()) {
        return { entries: [], themes: [], facets: [], ignoredFiles: 0, eventRecords: [], eventStats: { ready: 0, missing: 0, invalid: 0, noEvents: 0, total: 0 } };
      }
      const cached = this.cache.get(file.path);
      if (cached !== void 0 && cached.mtime === file.stat.mtime) {
        entries.push(...cached.entries);
        ignoredFiles += cached.ignored ? 1 : 0;
        completedFiles += 1;
        onProgress({ done: completedFiles, total: files.length });
        continue;
      }
      try {
        const content = await this.plugin.app.vault.cachedRead(file);
        if (!this.plugin.isPrivacyUnlocked() || buildVersion !== this.version) {
          return { entries: [], themes: [], facets: [], ignoredFiles: 0, eventRecords: [], eventStats: { ready: 0, missing: 0, invalid: 0, noEvents: 0, total: 0 } };
        }
        const frontmatter = parseFrontmatter(content);
        if (frontmatter["mind-trace"] !== true) {
          continue;
        }
        const document2 = parseSavedJournal(content, frontmatter);
        const fileEntries = document2.sessions.map((session, sessionIndex) => createHistorySession(file.path, document2, session, sessionIndex));
        this.cache.set(file.path, { mtime: file.stat.mtime, entries: fileEntries, ignored: false });
        entries.push(...fileEntries);
      } catch {
        this.cache.set(file.path, { mtime: file.stat.mtime, entries: [], ignored: true });
        ignoredFiles += 1;
      }
      completedFiles += 1;
      onProgress({ done: completedFiles, total: files.length });
    }
    entries.sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
    const frequency = (values) => {
      const counts = /* @__PURE__ */ new Map();
      for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([value]) => value);
    };
    const snapshot = {
      entries,
      themes: frequency(entries.flatMap((entry) => entry.themes)),
      facets: frequency(entries.flatMap((entry) => entry.facets)),
      ignoredFiles,
      eventRecords: flattenHistoryEventRecords(entries),
      eventStats: (() => {
        const stats = { ready: 0, missing: 0, invalid: 0, noEvents: 0, total: entries.length };
        for (const entry of entries) {
          if (entry.eventState === "missing") {
            stats.missing += 1;
          } else if (entry.eventState === "invalid") {
            stats.invalid += 1;
          } else {
            stats.ready += 1;
            if (!Array.isArray(entry.events) || entry.events.length === 0) {
              stats.noEvents += 1;
            }
          }
        }
        return {
          ...stats,
          readySessions: stats.ready,
          missingSessions: stats.missing,
          invalidSessions: stats.invalid,
          noEventSessions: stats.noEvents
        };
      })()
    };
    if (buildVersion === this.version && this.plugin.isPrivacyUnlocked()) {
      this.snapshot = snapshot;
    }
    return snapshot;
  }
};
var RATING_WORDS = {
  mood: ["低落", "偏低", "平稳", "不错", "明亮"],
  energy: ["耗尽", "疲惫", "尚可", "充足", "充沛"],
  stress: ["松弛", "轻松", "适中", "偏高", "紧绷"]
};
function ratingWord(key, score) {
  const word = RATING_WORDS[key][score - 1];
  if (word === void 0) {
    throw new Error("评分必须为 1–5");
  }
  return word;
}
function renderScale(container, score, className) {
  const scale = container.createDiv({
    cls: className,
    attr: {
      role: "img",
      "aria-label": `${score}/5`
    }
  });
  for (let value = 1; value <= 5; value += 1) {
    scale.createSpan({
      cls: value === score ? "mind-trace-rating-ai-point is-selected" : "mind-trace-rating-ai-point",
      text: String(value)
    });
  }
}
function renderRatings(container, ratings) {
  const section = container.createEl("section", {
    cls: "mind-trace-rating-comparison mind-trace-saved-ratings"
  });
  const hasAssessment = ["mood", "energy", "stress"].some(
    (key) => ratings[key].aiScore !== void 0
  );
  const heading = section.createDiv({
    cls: "mind-trace-rating-comparison-heading"
  });
  const copy = heading.createDiv();
  copy.createDiv({
    cls: "mind-trace-section-kicker",
    text: hasAssessment ? "状态对照 · AI 盲评" : "状态回看"
  });
  copy.createDiv({
    cls: "mind-trace-rating-comparison-title",
    text: hasAssessment ? "同一天，两种读法" : "这是我此刻的感受",
    attr: { role: "heading", "aria-level": "3" }
  });
  if (hasAssessment) {
    copy.createEl("p", {
      text: "你的分数来自内在感受；AI 没有看到它，只根据回答中的语言留下另一种观察。差异不是对错。"
    });
    heading.createSpan({
      cls: "mind-trace-rating-comparison-badge",
      text: "独立观察"
    });
  }
  const grid = section.createDiv({
    cls: "mind-trace-rating-comparison-grid"
  });
  for (const key of ["mood", "energy", "stress"]) {
    const rating = ratings[key];
    const card = grid.createEl("section", {
      cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${key}`
    });
    const cardHeading = card.createDiv({
      cls: "mind-trace-rating-card-heading"
    });
    cardHeading.createDiv({
      cls: "mind-trace-rating-card-title",
      text: RATING_LABELS[key]
    });
    cardHeading.createSpan({
      cls: "mind-trace-rating-difference",
      text: rating.aiScore === void 0 ? ratingWord(key, rating.selfScore) : rating.aiScore === rating.selfScore ? "两种读法一致" : `AI ${rating.aiScore > rating.selfScore ? "高" : "低"} ${Math.abs(rating.aiScore - rating.selfScore)} 分`
    });
    const selfHeading = card.createDiv({
      cls: "mind-trace-rating-ai-heading"
    });
    selfHeading.createSpan({ text: "我的感受" });
    selfHeading.createEl("output", {
      text: `${rating.selfScore}/5 \xB7 ${ratingWord(key, rating.selfScore)}`
    });
    renderScale(
      card,
      rating.selfScore,
      "mind-trace-rating-ai-scale mind-trace-saved-self-scale"
    );
    if (rating.aiScore !== void 0) {
      const ai = card.createDiv({ cls: "mind-trace-rating-ai" });
      const aiHeading = ai.createDiv({
        cls: "mind-trace-rating-ai-heading"
      });
      aiHeading.createSpan({ text: "AI 观察" });
      aiHeading.createEl("output", {
        text: `${rating.aiScore}/5 \xB7 ${ratingWord(key, rating.aiScore)}`
      });
      renderScale(ai, rating.aiScore, "mind-trace-rating-ai-scale");
      if (rating.reason !== void 0) {
        ai.createEl("p", { text: rating.reason });
      }
    }
  }
}
function eventElementKey(element) {
  return `${element.kind}:${normalizeEventElementName(element.name)}`;
}
function eventArgumentKey(argument) {
  return eventElementKey(argument.entity);
}
function normalizeTrajectoryEvent(raw) {
  const event = normalizeEvent(raw);
  const entities = new Map();
  const addEntity = (value) => {
    try {
      const entity = normalizeEventEntity(value);
      if (normalizeEventElementName(entity.name).length > 0) {
        entities.set(eventElementKey(entity), entity);
      }
    } catch {
    }
  };
  for (const element of event.elements) addEntity(element);
  for (const argument of Array.isArray(raw?.arguments) ? raw.arguments : []) addEntity(argument?.entity ?? argument);
  for (const element of Array.isArray(raw?.elements) ? raw.elements : []) addEntity(element);
  const relations = [];
  const relationKeys = new Set();
  for (const rawRelation of [...event.relations, ...(Array.isArray(raw?.relations) ? raw.relations : [])]) {
    try {
      const relation = normalizeEventRelation(rawRelation);
      addEntity(relation.subject);
      addEntity(relation.object);
      const key = `${relation.type}:${eventElementKey(relation.subject)}:${eventElementKey(relation.object)}:${relation.label.toLocaleLowerCase()}`;
      if (relation.subject.name.length > 0 && relation.object.name.length > 0 && !relationKeys.has(key)) {
        relationKeys.add(key);
        relations.push(relation);
      }
    } catch {
    }
  }
  return { ...event, elements: [...entities.values()], relations };
}
/*
 * Event records are deliberately flattened from the local history snapshot.
 * This keeps the trajectory layer evidence-only: no text generation, inferred
 * completion state, or cross-record causal links are introduced here.
 */
function flattenHistoryEventRecords(entries) {
  const records = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const events = Array.isArray(entry?.events) ? entry.events : [];
    for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
      try {
        const raw = events[eventIndex];
        const event = normalizeTrajectoryEvent(raw);
        if (event.title.length === 0 && event.summary.length === 0) {
          continue;
        }
        const filePath = typeof entry?.filePath === "string" ? entry.filePath : "";
        const sessionIndex = Number.isInteger(entry?.sessionIndex) ? entry.sessionIndex : 0;
        const id = typeof raw?.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : `${filePath || entry?.date || "journal"}#${sessionIndex}:${eventIndex}`;
        records.push({
          id,
          filePath,
          sessionIndex,
          eventIndex,
          date: typeof entry?.date === "string" ? entry.date : "",
          time: typeof entry?.time === "string" ? entry.time : "",
          themes: Array.isArray(entry?.themes) ? [...new Set(entry.themes.map((value) => String(value ?? "").trim()).filter(Boolean))] : [],
          facets: Array.isArray(entry?.facets) ? [...new Set(entry.facets.map((value) => String(value ?? "").trim()).filter(Boolean))] : [],
          type: event.type,
          status: event.status,
          title: event.title,
          summary: event.summary,
          traces: event.traces,
          arguments: event.arguments,
          relations: event.relations,
          elements: event.elements
        });
      } catch {
        // A malformed event must not prevent the rest of the trajectory from rendering.
      }
    }
  }
  records.sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time) || left.sessionIndex - right.sessionIndex || left.eventIndex - right.eventIndex);
  return records;
}
function aggregateEventRecords(records, nodeLimit = 10) {
  const elements = /* @__PURE__ */ new Map();
  for (const record of records) {
    for (const element of record.elements) {
      const key = eventElementKey(element);
      const current = elements.get(key) ?? {
        key,
        kind: element.kind,
        name: element.name,
        eventIds: /* @__PURE__ */ new Set(),
        dates: /* @__PURE__ */ new Set(),
        firstDate: record.date,
        lastDate: record.date,
        latestDate: record.date
      };
      current.eventIds.add(record.id);
      current.dates.add(record.date);
      if (record.date < current.firstDate) {
        current.firstDate = record.date;
      }
      if (record.date > current.lastDate) {
        current.lastDate = record.date;
      }
      if (record.date > current.latestDate) {
        current.latestDate = record.date;
        current.name = element.name;
      }
      elements.set(key, current);
    }
  }
  const nodes = [...elements.values()].sort((left, right) => right.eventIds.size - left.eventIds.size || right.dates.size - left.dates.size || right.latestDate.localeCompare(left.latestDate) || left.name.localeCompare(right.name));
  const visibleNodes = nodes.slice(0, nodeLimit);
  const visibleKeys = /* @__PURE__ */ new Set(visibleNodes.map((node) => node.key));
  const edgeMap = /* @__PURE__ */ new Map();
  const relationMap = /* @__PURE__ */ new Map();
  for (const record of records) {
    const keys = [...new Set(record.elements.map(eventElementKey).filter((key) => visibleKeys.has(key)))].sort();
    for (let leftIndex = 0; leftIndex < keys.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < keys.length; rightIndex += 1) {
        const left = keys[leftIndex];
        const right = keys[rightIndex];
        const key = `${left}|${right}`;
        const edge = edgeMap.get(key) ?? { key, left, right, count: 0, eventIds: /* @__PURE__ */ new Set() };
        edge.count += 1;
        edge.eventIds.add(record.id);
        edgeMap.set(key, edge);
      }
    }
  }
  for (const record of records) {
    for (const relation of Array.isArray(record.relations) ? record.relations : []) {
      const left = eventElementKey(relation.subject);
      const right = eventElementKey(relation.object);
      const key = `${relation.type}:${left}:${right}:${relation.label.toLocaleLowerCase()}`;
      const current = relationMap.get(key) ?? { key, type: relation.type, label: relation.label, left, right, eventIds: /* @__PURE__ */ new Set() };
      current.eventIds.add(record.id);
      relationMap.set(key, current);
    }
  }
  return {
    records,
    nodes,
    visibleNodes,
    edges: [...edgeMap.values()].sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)),
    relations: [...relationMap.values()].sort((left, right) => right.eventIds.size - left.eventIds.size || left.key.localeCompare(right.key))
  };
}
function eventEntityDisambiguationProfiles(records, limit = 60, focusSessions = []) {
  const profiles = /* @__PURE__ */ new Map();
  const ensureProfile = (rawEntity) => {
    const entity = normalizeEventEntity(rawEntity);
    if (normalizeEventElementName(entity.name).length === 0) {
      return null;
    }
    const key = eventEntityKey(entity);
    const profile = profiles.get(key) ?? {
      key,
      kind: entity.kind,
      name: entity.name,
      eventIds: /* @__PURE__ */ new Set(),
      dates: /* @__PURE__ */ new Set(),
      roles: /* @__PURE__ */ new Map(),
      related: /* @__PURE__ */ new Map(),
      relations: /* @__PURE__ */ new Map(),
      contexts: /* @__PURE__ */ new Map(),
      latestDate: ""
    };
    profiles.set(key, profile);
    return profile;
  };
  const increment = (map, key, value) => {
    const current = map.get(key) ?? { value, count: 0 };
    current.count += 1;
    map.set(key, current);
  };
  for (const record of Array.isArray(records) ? records : []) {
    const recordId = String(record?.id ?? `${record?.date ?? ""}:${record?.time ?? ""}:${record?.title ?? ""}`);
    const date = typeof record?.date === "string" ? record.date : "";
    const eventEntities = /* @__PURE__ */ new Map();
    for (const rawEntity of Array.isArray(record?.elements) ? record.elements : []) {
      const profile = ensureProfile(rawEntity);
      if (profile !== null) {
        eventEntities.set(profile.key, { kind: profile.kind, name: profile.name });
      }
    }
    for (const argument of Array.isArray(record?.arguments) ? record.arguments : []) {
      const profile = ensureProfile(argument?.entity ?? argument);
      if (profile === null) {
        continue;
      }
      eventEntities.set(profile.key, { kind: profile.kind, name: profile.name });
      const role = String(argument?.label ?? EVENT_ROLE_LABELS[argument?.role] ?? "相关").trim();
      if (role.length > 0) {
        increment(profile.roles, role, role);
      }
    }
    for (const [key, entity] of eventEntities) {
      const profile = profiles.get(key);
      if (profile === void 0) {
        continue;
      }
      profile.eventIds.add(recordId);
      if (date.length > 0) {
        profile.dates.add(date);
      }
      if (date >= profile.latestDate) {
        profile.latestDate = date;
        profile.name = entity.name;
      }
      const title = String(record?.title ?? "").trim();
      const summary = String(record?.summary ?? "").trim();
      const context = `${date}${date.length > 0 ? " " : ""}${title}${summary.length > 0 ? `｜${summary.slice(0, 72)}` : ""}`.trim();
      if (context.length > 0) {
        profile.contexts.set(recordId, { date, value: context });
      }
      for (const [relatedKey, relatedEntity] of eventEntities) {
        if (relatedKey !== key) {
          increment(profile.related, relatedKey, relatedEntity);
        }
      }
    }
    for (const rawRelation of Array.isArray(record?.relations) ? record.relations : []) {
      const relation = normalizeEventRelation(rawRelation);
      const subject = ensureProfile(relation.subject);
      const object = ensureProfile(relation.object);
      if (subject === null || object === null) {
        continue;
      }
      increment(subject.relations, `${relation.type}:${object.key}:${relation.label}:out`, `${relation.label}→${EVENT_KIND_LABELS[object.kind]}“${object.name}”`);
      increment(object.relations, `${relation.type}:${subject.key}:${relation.label}:in`, `${EVENT_KIND_LABELS[subject.kind]}“${subject.name}”→${relation.label}`);
    }
  }
  const focusText = normalizeEventElementName((Array.isArray(focusSessions) ? focusSessions : []).map((session) => [
    session?.diary,
    ...(Array.isArray(session?.facets) ? session.facets.flatMap((facet) => [facet?.category, facet?.summary]) : []),
    ...(Array.isArray(session?.events) ? session.events.flatMap((event) => [event?.title, event?.summary]) : [])
  ].filter((value) => typeof value === "string").join(" ")).join(" "));
  const topValues = (map, maximum) => [...map.values()].sort((left, right) => right.count - left.count || String(left.value?.name ?? left.value).localeCompare(String(right.value?.name ?? right.value))).slice(0, maximum).map((item) => item.value);
  const focusScore = (profile) => {
    const normalizedName = normalizeEventElementName(profile.name);
    return normalizedName.length >= 2 && focusText.includes(normalizedName) ? 1 : 0;
  };
  return [...profiles.values()].sort((left, right) => focusScore(right) - focusScore(left) || right.eventIds.size - left.eventIds.size || right.dates.size - left.dates.size || right.latestDate.localeCompare(left.latestDate) || left.name.localeCompare(right.name)).slice(0, Math.max(0, limit)).map((profile) => ({
    kind: profile.kind,
    name: profile.name,
    roles: topValues(profile.roles, 3),
    related: topValues(profile.related, 4),
    relations: topValues(profile.relations, 3),
    contexts: [...profile.contexts.values()].sort((left, right) => right.date.localeCompare(left.date) || right.value.localeCompare(left.value)).slice(0, 2).map((item) => item.value)
  }));
}
function renderEventTraces(container, traces, options: any = {}) {
  if (!Array.isArray(traces) || traces.length === 0) {
    return null;
  }
  const list = container.createDiv({ cls: "mind-trace-event-traces", attr: { "aria-label": "体验与方向线索" } });
  for (const trace of traces) {
    const item = list.createDiv({ cls: `mind-trace-event-trace is-${trace.layer} is-${trace.certainty}` });
    const heading = item.createDiv({ cls: "mind-trace-event-trace-heading" });
    heading.createSpan({ text: EVENT_TRACE_KIND_LABELS[trace.kind] ?? "线索" });
    heading.createSpan({ text: EVENT_TRACE_LAYER_LABELS[trace.layer] ?? "用户陈述" });
    if (trace.certainty === "uncertain") {
      heading.createSpan({ text: EVENT_TRACE_CERTAINTY_LABELS.uncertain });
    }
    item.createEl("p", { text: trace.text });
    if (options.showEvidence !== false && trace.evidence.length > 0) {
      item.createEl("small", { text: `原话：${trace.evidence}` });
    }
  }
  return list;
}
function renderEventLedger(container, events, options: any = {}) {
  const ledger = container.createDiv({ cls: "mind-trace-event-ledger" });
  events.forEach((event, index) => {
    const card = ledger.createEl("article", { cls: "mind-trace-event-ledger-item" });
    if (typeof event.id === "string" && event.id.length > 0) {
      card.setAttribute("data-event-id", event.id);
    }
    card.setAttribute("data-event-index", String(index));
    card.setAttribute("data-event-title", event.title ?? "");
    card.setAttribute("data-event-summary", event.summary ?? "");
    card.setAttribute("data-event-type", EVENT_TYPE_LABELS[event.type] ?? (typeof event.type === "string" ? event.type : ""));
    const heading = card.createDiv({ cls: "mind-trace-event-ledger-heading" });
    heading.createSpan({ cls: "mind-trace-event-ledger-index", text: String(index + 1).padStart(2, "0") });
    if (options.onOpenEvent === void 0 || typeof event.filePath !== "string" || event.filePath.length === 0) {
      heading.createDiv({ cls: "mind-trace-event-ledger-title", text: event.title });
    } else {
      const open = heading.createEl("button", { cls: "mind-trace-event-ledger-title", text: event.title, attr: { type: "button" } });
      open.addEventListener("click", () => options.onOpenEvent(event));
    }
    card.createEl("p", { text: event.summary });
    heading.createSpan({ cls: "mind-trace-event-type", text: EVENT_TYPE_LABELS[event.type] });
    heading.createSpan({ cls: "mind-trace-event-status", text: EVENT_STATUS_LABELS[event.status] });
    renderEventTraces(card, event.traces);
    const elements = card.createDiv({ cls: "mind-trace-event-ledger-elements", attr: { "aria-label": "事件论元" } });
    for (const argument of event.arguments) {
      const pill = elements.createSpan({ cls: `mind-trace-event-element is-${argument.entity.kind}` });
      pill.createSpan({ text: argument.label });
      pill.createEl("strong", { text: argument.entity.name });
    }
    if ((event.relations ?? []).length > 0) {
      const relations = card.createDiv({ cls: "mind-trace-event-ledger-relations", attr: { "aria-label": "明确关系" } });
      for (const relation of event.relations) {
        relations.createSpan({ text: `${relation.subject.name} —${relation.label}→ ${relation.object.name}` });
      }
    }
  });
  return ledger;
}
function renderDailyEvents(container, session, options: any = {}) {
  const section = container.createEl("section", { cls: "mind-trace-event-section mind-trace-saved-event-section" });
  const heading = section.createDiv({ cls: "mind-trace-card-heading" });
  const copy = heading.createDiv();
  copy.createDiv({ cls: "mind-trace-card-title", text: "今天发生了什么" });
  copy.createEl("p", { text: "查看发生了什么、当时的体验与仍在继续的方向；系统推测不会写入这里。" });
  const headingActions = heading.createDiv({ cls: "mind-trace-event-heading-actions" });
  headingActions.createSpan({ text: session.eventState === "ready" ? `${session.events.length} 件事件` : "事件" });
  if (!options.editing && session.eventState !== "invalid" && options.onEditEvents !== void 0) {
    const edit = headingActions.createEl("button", { text: session.eventState === "ready" ? "整理事件" : "补充事件", attr: { type: "button", "aria-label": "编辑今天的事件" } });
    edit.addEventListener("click", () => options.onEditEvents(null));
  }
  if (!options.editing && typeof options.error === "string" && options.error.length > 0) {
    section.createDiv({ cls: "mind-trace-event-inline-state is-error", text: options.error, attr: { role: "alert" } });
  }
  if (options.editing) {
    section.addClass("is-editing");
    const helper = copy.querySelector("p");
    if (helper !== null) {
      helper.textContent = "只展开需要修正的事件；保存后事件账会立即更新。";
    }
    if (typeof options.error === "string" && options.error.length > 0) {
      section.createDiv({ cls: "mind-trace-event-inline-state is-error", text: options.error, attr: { role: "alert" } });
    }
    const editorHost = section.createDiv({ cls: "mind-trace-event-editor mind-trace-saved-event-editor" });
    const editor = new EventEditor(editorHost, session.events, null, { collapsible: true, focusIndex: options.focusIndex });
    const actions = section.createDiv({ cls: "mind-trace-actions mind-trace-event-edit-actions" });
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.disabled = options.busy === true;
    cancel.addEventListener("click", () => options.onCancelEdit?.());
    const save = actions.createEl("button", { cls: "mod-cta", text: options.busy ? "正在保存…" : "保存事件修改", attr: { type: "button" } });
    save.disabled = options.busy === true;
    save.addEventListener("click", () => {
      try {
        options.onSaveEvents?.(editor.getValues());
      } catch (error) {
        showMindTraceNotice(errorMessage(error));
      }
    });
    return;
  }
  if (session.eventState === "missing") {
    const state = section.createDiv({ cls: "mind-trace-event-inline-state" });
    state.createDiv({ cls: "mind-trace-event-empty-title", text: "这篇旧记录还没有结构化事件" });
    state.createEl("p", { text: "可以在对应周报中按周提取，确认后再写回日记。" });
    return;
  }
  if (session.eventState === "invalid") {
    const state = section.createDiv({ cls: "mind-trace-event-inline-state is-error", attr: { role: "alert" } });
    state.createDiv({ cls: "mind-trace-event-empty-title", text: "事件结构需要重新生成" });
    state.createEl("p", { text: session.eventError ?? "原始 Markdown 未被修改。重新生成后会使用当前事件结构替换这一节。" });
    if (options.onRegenerateEvents !== void 0) {
      const regenerate = state.createEl("button", {
        cls: "mod-cta",
        text: options.busy ? "正在重新生成…" : "重新生成事件",
        attr: { type: "button", "aria-label": "根据这次日记重新生成事件" }
      });
      regenerate.disabled = options.busy === true;
      regenerate.addEventListener("click", () => options.onRegenerateEvents());
    }
    return;
  }
  if (session.events.length === 0) {
    const state = section.createDiv({ cls: "mind-trace-event-inline-state" });
    state.createDiv({ cls: "mind-trace-event-empty-title", text: "今天没有提取到明确事件" });
    state.createEl("p", { text: "没有为了凑数而虚构事件、体验来源或旧事的延续。" });
    return;
  }
  renderEventLedger(section, session.events);
}
function renderReviewMap(container, session) {
  const map = container.createDiv({
    cls: "mind-trace-review-map",
    attr: { role: "list", "aria-label": "日记内容概览" }
  });
  for (const [label, value] of [
    ["正文", "1 篇"],
    ["今日事件", session.eventState === "ready" ? `${session.events.length} 件` : "待整理"],
    ["今日切片", `${session.facets.length} 个`],
    ["本次轻反思", `${session.insights.length} 条`],
    ["明日行动", "1 步"]
  ]) {
    const item = map.createDiv({
      cls: "mind-trace-review-map-item",
      attr: { role: "listitem" }
    });
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
}
function renderSession(container, session, options: any = {}) {
  const article = container.createEl("article", {
    cls: "mind-trace-saved-session"
  });
  const sessionHeading = article.createDiv({
    cls: "mind-trace-saved-session-heading"
  });
  sessionHeading.createSpan({ text: "今日记录" });
  sessionHeading.createEl("time", { text: session.time });
  if (options.onRegenerateSession !== void 0) {
    const regenerate = sessionHeading.createEl("button", {
      cls: "mind-trace-session-regenerate",
      text: session.version >= JOURNAL_SCHEMA_VERSION ? "重新整理这次记录" : "更新这次记录",
      attr: { type: "button", title: session.transcriptError || "根据原始问答生成最新版" }
    });
    regenerate.disabled = options.regenerationBusy === true || session.transcriptAnswers?.length === 0 || Boolean(session.transcriptError);
    regenerate.addEventListener("click", options.onRegenerateSession);
  }
  renderRatings(article, session.ratings);
  renderReviewMap(article, session);
  const diarySection = article.createEl("section", {
    cls: "mind-trace-editor-card mind-trace-diary-card"
  });
  const diaryHeading = diarySection.createDiv({
    cls: "mind-trace-card-heading mind-trace-diary-heading"
  });
  const diaryTitle = diaryHeading.createDiv();
  diaryTitle.createDiv({
    cls: "mind-trace-diary-kicker",
    text: "今日 \xB7 已保存"
  });
  diaryTitle.createDiv({
    cls: "mind-trace-card-title mind-trace-diary-title",
    text: "今天的正文"
  });
  diaryHeading.createSpan({ text: "心迹日记" });
  const eventSession = options.events?.editing && Array.isArray(options.events.values) ? { ...session, events: options.events.values, eventState: "ready", eventError: void 0 } : session;
  const diaryWriting = diarySection.createDiv({
    cls: "mind-trace-diary-writing"
  });
  diaryWriting.createDiv({
    cls: "mind-trace-saved-copy mind-trace-saved-diary",
    text: session.diary
  });
  const marginEvents = (Array.isArray(eventSession.events) ? eventSession.events : []).map((event) => String(event?.title ?? event?.summary ?? "").trim()).filter((title) => title.length > 0).slice(0, 2);
  const marginThemes = (Array.isArray(session.themes) ? session.themes : []).map((theme) => String(theme ?? "").trim()).filter((theme) => theme.length > 0).slice(0, 3);
  if (marginEvents.length > 0 || marginThemes.length > 0) {
    const margin = diarySection.createDiv({ cls: "mind-trace-diary-margin mind-trace-diary-notes" });
    margin.createDiv({ cls: "mind-trace-diary-margin-title", text: "正文线索" });
    const list = margin.createEl("ul");
    for (const title of marginEvents) list.createEl("li", { cls: "is-event", text: `事件 · ${title}` });
    for (const theme of marginThemes) list.createEl("li", { cls: "is-theme", text: `主题 · ${theme}` });
  }
  renderDailyEvents(article, eventSession, options.events ?? {});
  const facetsSection = article.createEl("section", {
    cls: "mind-trace-facets-section"
  });
  const facetsHeading = facetsSection.createDiv({
    cls: "mind-trace-card-heading"
  });
  facetsHeading.createDiv({
    cls: "mind-trace-card-title",
    text: "今天由这些组成"
  });
  facetsHeading.createSpan({ text: "智能切片" });
  const facetsGrid = facetsSection.createDiv({
    cls: "mind-trace-facets-grid"
  });
  for (const facet of session.facets) {
    const card = facetsGrid.createDiv({
      cls: "mind-trace-facet-card"
    });
    const facetHeader = card.createDiv({
      cls: "mind-trace-facet-header"
    });
    facetHeader.createSpan({
      cls: "mind-trace-facet-kind",
      text: "今日切片"
    });
    card.createDiv({
      cls: "mind-trace-facet-category",
      text: facet.category
    });
    card.createDiv({
      cls: "mind-trace-facet-divider",
      attr: { "aria-hidden": "true" }
    });
    card.createDiv({
      cls: "mind-trace-saved-copy mind-trace-facet-summary",
      text: facet.summary
    });
  }
  const reflectionGrid = article.createDiv({
    cls: "mind-trace-reflection-grid"
  });
  const insightsSection = reflectionGrid.createEl("section", {
    cls: "mind-trace-editor-card mind-trace-insights-card"
  });
  const insightsHeading = insightsSection.createDiv({
    cls: "mind-trace-card-heading"
  });
  insightsHeading.createDiv({
    cls: "mind-trace-card-title",
    text: "本次轻反思"
  });
  insightsHeading.createSpan({ text: "只依据本次问答，不代表长期模式" });
  for (const [index, insight] of session.insights.entries()) {
    const row = insightsSection.createDiv({
      cls: "mind-trace-insight-row"
    });
    row.createSpan({
      cls: "mind-trace-insight-mark",
      text: `观察 ${index + 1}`
    });
    row.createDiv({
      cls: "mind-trace-saved-copy mind-trace-insight-editor",
      text: insight
    });
  }
  const nextColumn = reflectionGrid.createDiv({
    cls: "mind-trace-next-column"
  });
  const actionSection = nextColumn.createEl("section", {
    cls: "mind-trace-editor-card mind-trace-action-card"
  });
  const actionHeading = actionSection.createDiv({
    cls: "mind-trace-card-heading"
  });
  actionHeading.createDiv({
    cls: "mind-trace-card-title",
    text: "明天最小的一步"
  });
  actionHeading.createSpan({ text: "只做这一小步" });
  const actionBody = actionSection.createDiv({
    cls: "mind-trace-action-body"
  });
  actionBody.createDiv({
    cls: "mind-trace-saved-copy mind-trace-compact-editor",
    text: session.microAction
  });
  const questionSection = nextColumn.createEl("section", {
    cls: "mind-trace-editor-card mind-trace-question-card"
  });
  const questionHeading = questionSection.createDiv({
    cls: "mind-trace-card-heading"
  });
  questionHeading.createDiv({
    cls: "mind-trace-card-title",
    text: "留给明天的一个问题"
  });
  questionHeading.createSpan({ text: "不急着回答" });
  const questionBody = questionSection.createDiv({
    cls: "mind-trace-question-body"
  });
  questionBody.createSpan({
    cls: "mind-trace-question-mark",
    text: "？",
    attr: { "aria-hidden": "true" }
  });
  questionBody.createDiv({
    cls: "mind-trace-saved-copy mind-trace-compact-editor",
    text: session.selfQuestion
  });
  const themesSection = article.createEl("section", {
    cls: "mind-trace-themes-section"
  });
  const themesHeading = themesSection.createDiv({
    cls: "mind-trace-card-heading"
  });
  themesHeading.createDiv({
    cls: "mind-trace-card-title",
    text: "今天关于"
  });
  const themes = themesSection.createDiv({
    cls: "mind-trace-theme-editor"
  });
  for (const theme of session.themes) {
    themes.createSpan({
      cls: "mind-trace-theme-pill",
      text: theme
    });
  }
}
function renderSavedJournal(container, document2, options: any = {}) {
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-saved-journal");
  const shell = container.createDiv({
    cls: "mind-trace-journal-shell mind-trace-saved-shell"
  });
  const header = shell.createEl("header", {
    cls: "mind-trace-saved-header"
  });
  header.createDiv({
    cls: "mind-trace-eyebrow",
    text: "心迹日记 \xB7 已保存"
  });
  header.createEl("h1", {
    cls: "mind-trace-journal-title",
    text: document2.date
  });
  header.createEl("p", {
    text: `共 ${document2.sessions.length} 次记录`
  });
  if (options.onEditSource !== void 0 || options.onExportPdf !== void 0 || options.onDelete !== void 0 || options.onRegenerateDay !== void 0) {
    const actions = header.createDiv({
      cls: "mind-trace-saved-header-actions"
    });
    if (options.onRegenerateDay !== void 0 && document2.sessions.length > 1) {
      const canRegenerateDay = document2.sessions.every((session) => session.transcriptAnswers?.length > 0 && !session.transcriptError);
      const regenerateDay = actions.createEl("button", { cls: "mind-trace-journal-regenerate-day", text: document2.sessions.every((session) => session.version >= JOURNAL_SCHEMA_VERSION) ? "重新整理当天全部记录" : "更新当天全部记录", attr: { type: "button", title: canRegenerateDay ? "根据每次原始问答生成最新版" : "当天存在无法解析原始问答的记录" } });
      regenerateDay.disabled = options.regenerationBusy === true || !canRegenerateDay;
      regenerateDay.addEventListener("click", options.onRegenerateDay);
    }
    if (options.onExportPdf !== void 0) {
      const exportPdf = actions.createEl("button", {
        cls: "mind-trace-export-pdf",
        text: "导出 PDF",
        attr: {
          type: "button",
          "aria-label": "将这篇心迹日记导出为 PDF"
        }
      });
      exportPdf.addEventListener("click", options.onExportPdf);
    }
    if (options.onEditSource !== void 0) {
      const editSource = actions.createEl("button", {
        cls: "mind-trace-edit-source",
        text: "编辑 Markdown",
        attr: {
          type: "button",
          "aria-label": "编辑原始 Markdown"
        }
      });
      editSource.addEventListener("click", options.onEditSource);
    }
    if (options.onDelete !== void 0) {
      const deleteFile = actions.createEl("button", {
        cls: "mind-trace-delete-file",
        text: "删除",
        attr: {
          type: "button",
          "aria-label": "删除这篇心迹日记"
        }
      });
      deleteFile.disabled = options.deleteDisabled === true;
      deleteFile.addEventListener("click", options.onDelete);
    }
  }
  const selectedSessionIndex = Math.max(
    0,
    Math.min(
      document2.sessions.length - 1,
      options.selectedSessionIndex ?? document2.sessions.length - 1
    )
  );
  if (document2.sessions.length > 1) {
    const tabs = shell.createDiv({
      cls: "mind-trace-session-tabs",
      attr: { role: "tablist", "aria-label": `${document2.date} 的记录` }
    });
    const buttons = document2.sessions.map((session, index) => {
      const selected = index === selectedSessionIndex;
      const tabId = `mind-trace-session-tab-${document2.date}-${index}`;
      const panelId = `mind-trace-session-panel-${document2.date}-${index}`;
      const button = tabs.createEl("button", {
        cls: `mind-trace-session-tab${selected ? " is-active" : ""}`,
        text: `第 ${index + 1} 次 · ${session.time}`,
        attr: {
          type: "button",
          role: "tab",
          id: tabId,
          "aria-selected": String(selected),
          "aria-controls": panelId,
          tabindex: selected ? "0" : "-1"
        }
      });
      button.addEventListener("click", () => options.onSessionChange?.(index));
      return button;
    });
    for (const [index, button] of buttons.entries()) {
      button.addEventListener("keydown", (event) => {
        let nextIndex = null;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          nextIndex = (index - 1 + buttons.length) % buttons.length;
        } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          nextIndex = (index + 1) % buttons.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = buttons.length - 1;
        }
        if (nextIndex === null) {
          return;
        }
        event.preventDefault();
        options.onSessionChange?.(nextIndex);
        mindTraceWindow(container).requestAnimationFrame(() => {
          const activeTabs = container.querySelectorAll(".mind-trace-session-tab");
          activeTabs[nextIndex]?.focus();
        });
      });
    }
  }
  const session = document2.sessions[selectedSessionIndex];
  if (session !== void 0) {
    renderSession(shell, session, {
      regenerationBusy: options.regenerationBusy,
      onRegenerateSession: options.onRegenerateSession === void 0 ? void 0 : () => options.onRegenerateSession(selectedSessionIndex),
      events: {
        date: document2.date,
        editing: options.editingEventSessionIndex === selectedSessionIndex,
        focusIndex: options.editingEventFocusIndex,
        values: options.editingEventValues,
        busy: options.eventSaveBusy === true,
        error: options.eventSaveError,
        onEditEvents: options.onEditEvents === void 0 ? void 0 : (focusIndex) => options.onEditEvents(selectedSessionIndex, focusIndex),
        onRegenerateEvents: options.onRegenerateEvents === void 0 ? void 0 : () => options.onRegenerateEvents(selectedSessionIndex),
        onCancelEdit: options.onCancelEventEdit,
        onSaveEvents: options.onSaveEvents
      }
    });
    const panel = shell.querySelector(".mind-trace-saved-session");
    if (panel instanceof mindTraceWindow(container).HTMLElement && document2.sessions.length > 1) {
      const panelId = `mind-trace-session-panel-${document2.date}-${selectedSessionIndex}`;
      const tabId = `mind-trace-session-tab-${document2.date}-${selectedSessionIndex}`;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("id", panelId);
      panel.setAttribute("aria-labelledby", tabId);
      for (let index = 0; index < document2.sessions.length; index += 1) {
        if (index === selectedSessionIndex) continue;
        shell.createDiv({
          cls: "mind-trace-session-panel-placeholder",
          attr: {
            role: "tabpanel",
            id: `mind-trace-session-panel-${document2.date}-${index}`,
            "aria-labelledby": `mind-trace-session-tab-${document2.date}-${index}`,
            hidden: "true"
          }
        });
      }
    }
  }
}
function renderPrintableJournal(container, document2) {
  container.empty();
  const header = container.createEl("header", {
    cls: "mind-trace-print-header"
  });
  header.createDiv({
    cls: "mind-trace-print-eyebrow",
    text: "心迹日记"
  });
  header.createEl("h1", { text: document2.date });
  header.createEl("p", {
    text: `共 ${document2.sessions.length} 次记录`
  });
  for (const session of document2.sessions) {
    const article = container.createEl("article", {
      cls: "mind-trace-print-session"
    });
    const sessionHeading = article.createDiv({
      cls: "mind-trace-print-session-heading"
    });
    sessionHeading.createSpan({ text: "今日记录" });
    sessionHeading.createEl("time", { text: session.time });
    const ratings = article.createEl("section", {
      cls: "mind-trace-print-section"
    });
    ratings.createEl("h2", { text: "状态对照" });
    const ratingRow = ratings.createDiv({
      cls: "mind-trace-print-ratings"
    });
    for (const key of ["mood", "energy", "stress"]) {
      const rating = session.ratings[key];
      const card = ratingRow.createDiv({
        cls: `mind-trace-print-rating mind-trace-print-rating-${key}`
      });
      card.createEl("h3", { text: RATING_LABELS[key] });
      card.createEl("p", {
        text: `我的感受 \xB7 ${rating.selfScore}/5 \xB7 ${ratingWord(key, rating.selfScore)}`
      });
      if (rating.aiScore !== void 0) {
        card.createEl("p", {
          text: `AI 观察 \xB7 ${rating.aiScore}/5 \xB7 ${ratingWord(key, rating.aiScore)}`
        });
      }
      if (rating.reason !== void 0) {
        card.createDiv({
          cls: "mind-trace-print-rating-reason",
          text: rating.reason
        });
      }
    }
    const diary = article.createEl("section", {
      cls: "mind-trace-print-section mind-trace-print-diary"
    });
    diary.createEl("h2", { text: "今天的正文" });
    diary.createDiv({ text: session.diary });
    if (session.eventState === "ready" && session.events.length > 0) {
      const events = article.createEl("section", { cls: "mind-trace-print-section mind-trace-print-events" });
      events.createEl("h2", { text: "今天发生了什么" });
      for (const event of session.events) {
        const item = events.createDiv({ cls: "mind-trace-print-event" });
        item.createEl("h3", { text: `${EVENT_TYPE_LABELS[event.type]}｜${event.title}` });
        item.createEl("small", { text: `进展：${EVENT_STATUS_LABELS[event.status]}` });
        item.createEl("p", { text: event.summary });
        for (const trace of event.traces) {
          item.createEl("p", { text: `${EVENT_TRACE_KIND_LABELS[trace.kind]}：${trace.text}` });
        }
        item.createEl("small", { text: event.arguments.map((argument) => `${argument.label}｜${EVENT_KIND_LABELS[argument.entity.kind]}：${argument.entity.name}`).join(" · ") });
      }
    }
    if (session.facets.length > 0) {
      const facets = article.createEl("section", {
        cls: "mind-trace-print-section"
      });
      facets.createEl("h2", { text: "今天由这些组成" });
      const facetList = facets.createDiv({
        cls: "mind-trace-print-facets"
      });
      for (const facet of session.facets) {
        const facetItem = facetList.createDiv({
          cls: "mind-trace-print-facet"
        });
        facetItem.createEl("h3", { text: facet.category });
        facetItem.createEl("p", { text: facet.summary });
      }
    }
    if (session.insights.length > 0) {
      const insights = article.createEl("section", {
        cls: "mind-trace-print-section mind-trace-print-insights"
      });
      insights.createEl("h2", { text: "我从今天看见" });
      const list = insights.createEl("ol");
      for (const insight of session.insights) {
        list.createEl("li", { text: insight });
      }
    }
    const closing = article.createDiv({
      cls: "mind-trace-print-closing"
    });
    const action = closing.createEl("section", {
      cls: "mind-trace-print-note mind-trace-print-action"
    });
    action.createEl("h2", { text: "明天最小的一步" });
    action.createEl("p", { text: session.microAction });
    const question = closing.createEl("section", {
      cls: "mind-trace-print-note mind-trace-print-question"
    });
    question.createEl("h2", { text: "留给明天的一个问题" });
    question.createEl("p", { text: session.selfQuestion });
    if (session.themes.length > 0) {
      const themes = article.createDiv({
        cls: "mind-trace-print-themes"
      });
      themes.createEl("strong", { text: "今天关于" });
      themes.createSpan({ text: session.themes.join(" \xB7 ") });
    }
  }
}

// src/saved-journal-view.ts
var SAVED_JOURNAL_VIEW_TYPE = "mind-trace-saved-journal-view";
function parseFrontmatter(content, documentLabel = "心迹日记") {
  const info = (0, import_obsidian3.getFrontMatterInfo)(content);
  if (!info.exists) {
    throw new Error(`缺少${documentLabel}属性`);
  }
  const parsed = (0, import_obsidian3.parseYaml)(info.frontmatter);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${documentLabel}属性无法识别`);
  }
  return Object.fromEntries(Object.entries(parsed));
}
var SavedJournalView = class extends import_obsidian3.TextFileView {
  declare plugin: any;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  get ownerWindow() {
    return mindTraceWindow(this.contentEl);
  }
  selectedSessionIndex = null;
  pendingEventFocus = null;
  editingEventSessionIndex = null;
  editingEventFocusIndex = null;
  editingEventValues = null;
  eventEditMtime = null;
  eventSaveBusy = false;
  eventSaveError = "";
  journalRegenerationBusy = false;
  getViewType() {
    return SAVED_JOURNAL_VIEW_TYPE;
  }
  getDisplayText() {
    return this.file?.basename ?? "心迹日记";
  }
  getIcon() {
    return "notebook-pen";
  }
  getViewData() {
    return this.data;
  }
  setViewData(data, clear) {
    const changed = data !== this.data;
    this.data = data;
    if (clear) {
      this.clear();
      this.selectedSessionIndex = null;
      this.editingEventSessionIndex = null;
      this.editingEventFocusIndex = null;
      this.editingEventValues = null;
      this.eventEditMtime = null;
      this.eventSaveBusy = false;
      this.eventSaveError = "";
      this.journalRegenerationBusy = false;
    } else if (changed && this.editingEventSessionIndex !== null && !this.eventSaveBusy) {
      this.editingEventSessionIndex = null;
      this.editingEventFocusIndex = null;
      this.editingEventValues = null;
      this.eventEditMtime = null;
      this.eventSaveError = "日记已在其他位置更新，事件编辑已取消，请重新打开后修改。";
    }
    this.render(!clear);
  }
  clear() {
    this.contentEl.empty();
    this.pendingEventFocus = null;
  }
  focusEvent(event) {
    this.pendingEventFocus = event;
    this.ownerWindow.requestAnimationFrame(() => this.applyEventFocus());
  }
  applyEventFocus() {
    const focus = this.pendingEventFocus;
    if (focus === null) {
      return;
    }
    let target = null;
    for (const candidate of this.contentEl.querySelectorAll("article.mind-trace-event-ledger-item")) {
      if (Number.isInteger(focus.eventIndex) && candidate.getAttribute("data-event-index") === String(focus.eventIndex)) {
        target = candidate;
        break;
      }
      if (
        (typeof focus.id === "string" && focus.id.length > 0 && candidate.getAttribute("data-event-id") === focus.id || candidate.getAttribute("data-event-title") === focus.title) &&
        candidate.getAttribute("data-event-summary") === focus.summary &&
        (candidate.getAttribute("data-event-type") === focus.type || candidate.getAttribute("data-event-type") === EVENT_TYPE_LABELS[focus.type])
      ) {
        target = candidate;
        break;
      }
    }
    if (target === null) {
      return;
    }
    target.scrollIntoView({
      behavior: this.ownerWindow.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center"
    });
    target.addClass("is-focused");
    this.ownerWindow.setTimeout(() => {
      target.removeClass("is-focused");
    }, 2400);
  }
  selectSession(index) {
    if (!Number.isInteger(index) || index < 0) {
      return;
    }
    if (this.selectedSessionIndex !== index) {
      this.cancelEventEditing(false);
    }
    this.selectedSessionIndex = index;
    this.render(true);
  }
  render(preserveContext = false) {
    const context = preserveContext ? captureMindTraceContext(this.contentEl) : null;
    this.contentEl.empty();
    this.contentEl.addClass(
      "mind-trace-view",
      "mind-trace-saved-file-view"
    );
    if (renderPrivacyGate(this.contentEl, this.plugin)) {
      return;
    }
    const rendered = this.contentEl.createDiv({
      cls: "mind-trace-saved-render"
    });
    try {
      const frontmatter = parseFrontmatter(this.data);
      const document2 = parseSavedJournal(this.data, frontmatter);
      const selectedSessionIndex = this.selectedSessionIndex ?? Math.max(0, document2.sessions.length - 1);
      this.selectedSessionIndex = Math.min(selectedSessionIndex, Math.max(0, document2.sessions.length - 1));
      renderSavedJournal(rendered, document2, {
        selectedSessionIndex: this.selectedSessionIndex,
        regenerationBusy: this.journalRegenerationBusy,
        onRegenerateSession: (sessionIndex) => this.beginJournalRegeneration([sessionIndex]),
        onRegenerateDay: () => this.beginJournalRegeneration(document2.sessions.map((_, index) => index)),
        onSessionChange: (index) => {
          this.cancelEventEditing(false);
          this.selectedSessionIndex = index;
          this.render(true);
        },
        editingEventSessionIndex: this.editingEventSessionIndex,
        editingEventFocusIndex: this.editingEventFocusIndex,
        editingEventValues: this.editingEventValues,
        eventSaveBusy: this.eventSaveBusy,
        eventSaveError: this.eventSaveError,
        onEditEvents: (sessionIndex, focusIndex) => {
          this.beginEventEditing(sessionIndex, focusIndex);
        },
        onRegenerateEvents: (sessionIndex) => {
          this.regenerateSessionEvents(sessionIndex);
        },
        onCancelEventEdit: () => {
          this.cancelEventEditing();
        },
        onSaveEvents: (events) => {
          void this.saveEventChanges(events);
        },
        onEditSource: () => {
          void this.openMarkdownSource();
        },
        onExportPdf: () => {
          this.exportPdf(document2);
        },
        onDelete: () => {
          confirmMindTraceFileDeletion(this, "日记");
        },
        deleteDisabled: this.eventSaveBusy
      });
    } catch (error) {
      this.renderError(
        rendered,
        error instanceof Error ? error.message : "日记格式无法识别"
      );
    }
    if (context !== null) {
      restoreMindTraceContext(this.contentEl, context);
    }
    this.applyEventFocus();
  }
  beginJournalRegeneration(sessionIndexes) {
    if (this.file === null || this.journalRegenerationBusy || !Array.isArray(sessionIndexes) || sessionIndexes.length === 0) return;
    if (!this.plugin.isProviderConfigured()) {
      showMindTraceNotice("请先在心迹设置中配置模型与 API Key");
      return;
    }
    const file = this.file;
    let document2;
    try {
      document2 = parseSavedJournal(this.data, parseFrontmatter(this.data));
    } catch (error) {
      showMindTraceNotice(errorMessage(error));
      return;
    }
    const selected = [...new Set(sessionIndexes)].map((index) => ({ index, session: document2.sessions[index] })).filter((item) => item.session !== void 0);
    if (selected.length !== sessionIndexes.length || selected.some((item) => item.session.transcriptAnswers?.length === 0 || item.session.transcriptError)) {
      showMindTraceNotice("选中的记录缺少可解析的原始问答");
      return;
    }
    const reviewedEventCount = selected.reduce((sum, item) => sum + (item.session.eventReviewed ? item.session.events.length : 0), 0);
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹日记 · 更新到最新版",
      title: selected.length > 1 ? `更新当天 ${selected.length} 次记录？` : "更新这次记录？",
      description: `将根据原始问答重新生成正文、全部事件、切片和轻反思。日期、自评、时间和原始问答保持不变${reviewedEventCount > 0 ? `；${reviewedEventCount} 件人工确认事件也会被替换` : ""}。生成后先显示校样，不会立即写回。`,
      confirmLabel: "生成校样",
      warning: reviewedEventCount > 0,
      stages: ["读取原始问答", "生成最新版内容", "独立评估状态", "准备校样"],
      run: async (update) => {
        this.journalRegenerationBusy = true;
        this.render(true);
        const expectedMtime = file.stat.mtime;
        update({ stage: 1, total: 4, title: "读取原始问答", detail: `已确认 ${selected.length} 次记录可以安全恢复。` });
        const history = await this.plugin.repository.recentContext(this.plugin.settings, parseLocalDate(document2.date) ?? (/* @__PURE__ */ new Date()));
        update({ stage: 2, total: 4, title: "生成最新版内容", detail: "正在使用当前提示与事件结构重新整理。" });
        const replacements = await mapWithConcurrency(selected, 2, async ({ index, session }) => {
          const draft = {
            createdAt: `${document2.date}T${session.time}:00`,
            entryDate: document2.date,
            step: session.transcriptAnswers.length,
            coreQuestions: session.transcriptAnswers.map((answer) => answer.question),
            adaptiveQuestionLimit: 0,
            ratings: { mood: session.ratings.mood.selfScore, energy: session.ratings.energy.selfScore, stress: session.ratings.stress.selfScore },
            answers: session.transcriptAnswers,
            pendingQuestion: null,
            adaptiveCount: 0,
            generated: null
          };
          const [entry, assessment] = await Promise.all([
            generateJournal(this.plugin.createProvider(), draft, history, this.plugin.settings),
            generateRatingAssessment(this.plugin.createProvider(), draft)
          ]);
          return { sessionIndex: index, source: session, entry, assessment, generatedAt: (/* @__PURE__ */ new Date()).toISOString() };
        });
        update({ stage: 3, total: 4, title: "独立评估状态", detail: "已完成基于原始回答的状态对照。" });
        update({ stage: 4, total: 4, title: "准备校样", detail: "正在准备写回前的完整预览。" });
        return { file, expectedMtime, document: document2, replacements, reviewedEventCount };
      },
      onSuccess: (payload) => {
        this.journalRegenerationBusy = false;
        this.render(true);
        new JournalRegenerationPreviewModal(this.app, this.plugin, payload, (value) => this.commitJournalRegeneration(value)).open();
      },
      onError: () => {
        this.journalRegenerationBusy = false;
        this.render(true);
      },
      successTitle: "最新版校样已经生成",
      successDetail: "请核对后再确认替换原记录。",
      successLabel: "查看校样",
      backgroundSuccess: "日记校样已经生成"
    });
  }
  async commitJournalRegeneration(payload) {
    this.journalRegenerationBusy = true;
    this.render(true);
    try {
      this.data = await this.plugin.repository.updateJournalSessions(payload.file, payload.document, payload.replacements, payload.expectedMtime);
      invalidateParsedJournal(payload.file.path);
      this.plugin.historyIndex.invalidate(payload.file.path);
      this.plugin.emitMetricsChanged();
      this.plugin.refreshWeeklyEventViews();
      showMindTraceNotice(payload.replacements.length > 1 ? "当天记录已更新到最新版" : "这次记录已更新到最新版");
    } finally {
      this.journalRegenerationBusy = false;
      this.render(true);
    }
  }
  beginEventEditing(sessionIndex, focusIndex = null) {
    if (this.file === null || this.eventSaveBusy) {
      return;
    }
    this.editingEventSessionIndex = sessionIndex;
    this.editingEventFocusIndex = Number.isInteger(focusIndex) ? focusIndex : null;
    this.editingEventValues = null;
    this.eventEditMtime = this.file.stat.mtime;
    this.eventSaveError = "";
    this.render(true);
    this.ownerWindow.requestAnimationFrame(() => {
      this.contentEl.querySelector<HTMLInputElement>(".mind-trace-saved-event-editor .mind-trace-event-title-input")?.focus();
    });
  }
  cancelEventEditing(render = true) {
    this.editingEventSessionIndex = null;
    this.editingEventFocusIndex = null;
    this.editingEventValues = null;
    this.eventEditMtime = null;
    this.eventSaveError = "";
    if (render) {
      this.render(true);
    }
  }
  async saveEventChanges(events) {
    if (this.file === null || this.editingEventSessionIndex === null || this.eventSaveBusy) {
      return;
    }
    this.eventSaveBusy = true;
    this.eventSaveError = "";
    this.editingEventValues = events;
    this.render(true);
    try {
      const updated = await this.plugin.repository.updateSessionEvents(
        this.file,
        this.editingEventSessionIndex,
        events,
        this.eventEditMtime
      );
      this.data = updated;
      this.editingEventSessionIndex = null;
      this.editingEventFocusIndex = null;
      this.editingEventValues = null;
      this.eventEditMtime = null;
      showMindTraceNotice("事件修改已保存");
    } catch (error) {
      this.eventSaveError = errorMessage(error);
    } finally {
      this.eventSaveBusy = false;
      this.render(true);
    }
  }
  regenerateSessionEvents(sessionIndex) {
    if (this.file === null || this.eventSaveBusy || !Number.isInteger(sessionIndex)) {
      return;
    }
    if (!this.plugin.isProviderConfigured()) {
      showMindTraceNotice("请先在心迹设置中配置模型与 API Key");
      return;
    }
    let document2;
    try {
      document2 = parseSavedJournal(this.data, parseFrontmatter(this.data));
    } catch (error) {
      showMindTraceNotice(errorMessage(error));
      return;
    }
    const session = document2.sessions[sessionIndex];
    if (session === void 0) {
      showMindTraceNotice("要重新生成的日记会话已经不存在");
      return;
    }
    const file = this.file;
    const source = {
      filePath: file.path,
      fileMtime: file.stat.mtime,
      date: document2.date,
      time: session.time,
      sessionIndex,
      diary: session.diary,
      facets: session.facets,
      events: [],
      eventState: "invalid",
      eventSchema: EVENT_SCHEMA_VERSION,
      eventReviewed: false
    };
    const providerLabel = PROVIDER_LABELS[this.plugin.settings.activeProvider] ?? this.plugin.settings.activeProvider;
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹日记 · 事件重建",
      title: "重新生成这次记录的事件？",
      description: `将把这次记录的日记正文与切片发送给 ${providerLabel}，使用当前事件结构重新抽取；不会发送原始问答。原事件章节只在生成与校验成功后替换。`,
      confirmLabel: "重新生成",
      stages: ["读取这次记录", "重新抽取事件", "校验事件结构", "写回日记"],
      run: async (update) => {
        this.eventSaveBusy = true;
        this.eventSaveError = "";
        this.render(true);
        update({ stage: 1, total: 4, title: "读取这次记录", detail: "正在确认日记没有在任务开始后被修改。" });
        if (file.stat.mtime !== source.fileMtime) {
          throw new Error("日记已经发生修改，请重新打开后再生成事件");
        }
        update({ stage: 2, total: 4, title: "重新抽取事件", detail: "正在提取事件事实、主观体验、目标与未决事项。" });
        const results = await generateEventBackfill(this.plugin.createProvider(), [source], [], MAX_SESSION_EVENTS, []);
        update({ stage: 3, total: 4, title: "校验事件结构", detail: `已生成 ${results[0]?.events.length ?? 0} 件记录，正在验证字段与证据边界。` });
        update({ stage: 4, total: 4, title: "写回日记", detail: "正在替换不匹配的事件章节。" });
        const outcome = await this.plugin.repository.applyEventBackfill(results);
        if (outcome.failed.length > 0) {
          throw new Error(outcome.failed.map((failure) => failure.message).join("；"));
        }
        this.data = await this.app.vault.cachedRead(file);
        return results[0]?.events ?? [];
      },
      onSuccess: async () => {
        this.eventSaveBusy = false;
        this.eventSaveError = "";
        this.render(true);
      },
      onError: async () => {
        this.eventSaveBusy = false;
        this.render(true);
      },
      successTitle: "事件已经重新生成",
      successDetail: "新的事件结构已写回日记，并可继续手动校正。",
      successLabel: "查看事件",
      backgroundSuccess: "日记事件重新生成完成"
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
    state.createDiv({
      cls: "mind-trace-empty-title",
      text: message
    });
    state.createEl("p", {
      text: "原始 Markdown 没有被修改，可以切换到源码继续查看。"
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
  exportPdf(journal) {
    if (!this.plugin.isPrivacyUnlocked()) {
      this.render();
      return;
    }
    const ownerDocument = mindTraceDocument(this.contentEl);
    const ownerWindow = mindTraceWindow(this.contentEl);
    const previousTitle = ownerDocument.title;
    const documentElement = ownerDocument.documentElement;
    const body = ownerDocument.body;
    const printDocument = ownerDocument.createElement("main");
    printDocument.addClass("mind-trace-print-document");
    renderPrintableJournal(printDocument, journal);
    body.append(printDocument);
    const cleanup = () => {
      ownerDocument.title = previousTitle;
      documentElement.removeClass("mind-trace-printing");
      body.removeClass("mind-trace-printing");
      printDocument.remove();
      ownerWindow.removeEventListener("afterprint", cleanup);
      ownerWindow.removeEventListener("focus", restoreAfterFocus);
    };
    const restoreAfterFocus = () => {
      ownerWindow.setTimeout(cleanup, 0);
    };
    ownerDocument.title = `${journal.date}-心迹`;
    documentElement.addClass("mind-trace-printing");
    body.addClass("mind-trace-printing");
    ownerWindow.addEventListener("afterprint", cleanup, { once: true });
    ownerWindow.addEventListener("focus", restoreAfterFocus, { once: true });
    showMindTraceNotice("请在系统打印窗口中选择“存储为 PDF”");
    ownerWindow.setTimeout(() => {
      try {
        ownerWindow.print();
      } catch (error) {
        cleanup();
        showMindTraceNotice(
          error instanceof Error ? `无法打开 PDF 导出窗口：${error.message}` : "无法打开 PDF 导出窗口"
        );
      }
    }, 50);
  }
};
