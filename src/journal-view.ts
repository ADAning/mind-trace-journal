// src/journal-view.ts
import * as import_obsidian4 from "obsidian";
import { EVENT_KIND_LABELS, EVENT_STATUS_LABELS, EVENT_TYPES, EVENT_TYPE_LABELS, OBSERVATION_DIMENSIONS, computeObservationMaturity, constrainObservationAnalysisForMaturity, dedupeObservationReports, deriveObservationFreshness, metricSnapshot, observationClaimMetrics, observationConstrainedLevel, observationItemKey, observationSignal, observationSnapshotMaturity, recordAnswer, validateEvents } from "./conversation";
import { DashboardComponent } from "./dashboard";
import { addLocalDays, completedPeriod, currentMonthPeriod, currentWeekPeriod, draftEntryDate, entryDateWithCurrentTime, formationCaption, formationProgress, localDateString, monthlyWeekSegments, parseLocalDate, periodEntries, periodLabel, startOfLocalWeek } from "./date-utils";
import { createDraft, draftAdaptiveQuestionLimit, draftCoreQuestions, normalizeSelfObservation } from "./defaults";
import { RatingScaleEditor, ThemeEditor, generateFollowUp, generateJournal, generateRatingAssessment } from "./generation";
import { collectMetrics, filterMetrics } from "./metrics";
import { renderPrivacyGate } from "./privacy";
import { ObservationFeedbackModal, attachLlmActivityStatus, captureMindTraceContext, findMindTraceScroller, openMindTraceOperation, restoreMindTraceContext } from "./providers";
import { mindTraceDocument, mindTraceWindow, showMindTraceNotice } from "./runtime-preamble";
import { SAVED_JOURNAL_VIEW_TYPE, createHistoryQuery, createTrajectoryQuery, eventElementKey, filterTrajectoryEventRecords, flattenHistoryEventRecords, historyExcerpt, historyQueryIsActive, historySearchTokens, mapWithConcurrency, normalizeHistoryText, parseFrontmatter, queryHistorySessions, readParsedJournal, rediscoverHistorySessions, renderEventTraces, trajectoryEntitySummaries, trajectoryEventStats } from "./saved-journal";
import { parseSavedReport, weeklyGeneratedAtText } from "./saved-weekly-report-view";
import { observationEvidenceMarkdown, reportSummaryFromMarkdown, weeklyReportFrontmatterStatus } from "./weekly-report";

export { JOURNAL_VIEW_TYPE, JournalView, autoGrow, errorMessage, showMindTraceFieldError };

var JOURNAL_VIEW_TYPE = "mind-trace-journal-view";
function errorMessage(error) {
  return error instanceof Error ? error.message : "发生了未知错误";
}
var RATING_STATE_WORDS = {
  mood: ["低落", "偏低", "平稳", "不错", "明亮"],
  energy: ["耗尽", "疲惫", "尚可", "充足", "充沛"],
  stress: ["松弛", "轻松", "适中", "偏高", "紧绷"]
};
function ratingStateWord(key, score) {
  const word = RATING_STATE_WORDS[key][score - 1];
  if (word === void 0) {
    throw new Error("评分必须为 1–5");
  }
  return word;
}
function ratingDifferenceText(selfScore, aiScore) {
  const difference = aiScore - selfScore;
  if (difference === 0) {
    return "两种读法一致";
  }
  return `AI ${difference > 0 ? "高" : "低"} ${Math.abs(difference)} 分`;
}
function showMindTraceFieldError(target, message) {
  const ownerWindow = mindTraceWindow(target);
  if (!(target instanceof ownerWindow.HTMLElement)) {
    return;
  }
  const scope = target.closest(".mind-trace-journal-shell, .mind-trace-settings-section, form") ?? target.parentElement;
  scope?.querySelectorAll(".mind-trace-field-error").forEach((element) => element.remove());
  scope?.querySelectorAll(".is-invalid").forEach((element) => {
    element.removeClass("is-invalid");
    element.removeAttribute("aria-invalid");
  });
  target.addClass("is-invalid");
  target.setAttribute("aria-invalid", "true");
  const error = target.parentElement?.createEl("p", { cls: "mind-trace-field-error", text: message, attr: { role: "alert" } });
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center", behavior: ownerWindow.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const clear = () => {
    target.removeClass("is-invalid");
    target.removeAttribute("aria-invalid");
    error?.remove();
  };
  target.addEventListener("input", clear, { once: true });
  target.addEventListener("change", clear, { once: true });
}
function autoGrow(textarea) {
  const ownerDocument = mindTraceDocument(textarea);
  const ownerWindow = mindTraceWindow(textarea);
  const keepCaretVisible = () => {
    if (ownerDocument.activeElement !== textarea || textarea.selectionEnd !== textarea.value.length) {
      return;
    }
    let parent = textarea.parentElement;
    let scroller = null;
    while (parent !== null) {
      const overflowY = ownerWindow.getComputedStyle(parent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scroller = parent;
        if (parent.scrollHeight > parent.clientHeight) {
          break;
        }
      }
      parent = parent.parentElement;
    }
    if (scroller === null) {
      return;
    }
    const textareaRect = textarea.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const safeBottom = Math.min(scrollerRect.bottom, ownerWindow.innerHeight) - 72;
    if (textareaRect.bottom > safeBottom) {
      scroller.scrollTop += textareaRect.bottom - safeBottom;
    }
  };
  const resize = (followCaret) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (followCaret) {
      ownerWindow.requestAnimationFrame(keepCaretVisible);
    }
  };
  textarea.addEventListener("input", () => resize(true));
  ownerWindow.requestAnimationFrame(() => resize(false));
}
function weekdayText(dateString) {
  const date = parseLocalDate(dateString);
  if (date === null) {
    return "";
  }
  return `周${"日一二三四五六"[date.getDay()]}`;
}
function monthDayText(dateString) {
  const date = parseLocalDate(dateString);
  if (date === null) {
    return dateString;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
function monthLabelText(dateString) {
  const date = parseLocalDate(dateString);
  if (date === null) {
    return dateString;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}
function draftProgressText(draft) {
  if (draft.generated !== null) {
    return "日记已生成，还差最后一步保存。";
  }
  if (draft.step === 0) {
    return "状态自评还没有完成。";
  }
  const answered = draft.answers.length;
  return answered === 0 ? "自评已完成，问答还没有开始。" : `已回答 ${answered} 个问题。`;
}
function homeWeekSummary(current, previous) {
  if (current.days === 0) {
    return "这周还没有留下记录。从今天开始，让这条轨迹有第一个落点。";
  }
  const parts = [`已记录 ${current.days} 天`];
  if (current.mood !== null && previous.mood !== null) {
    const delta = current.mood - previous.mood;
    parts.push(Math.abs(delta) < 0.15 ? "心情与上周接近" : `心情较上周${delta > 0 ? "上升" : "下降"} ${Math.abs(delta).toFixed(1)}`);
  }
  if (current.stress !== null && previous.stress !== null) {
    const delta = current.stress - previous.stress;
    if (Math.abs(delta) >= 0.15) {
      parts.push(`压力${delta > 0 ? "上升" : "下降"} ${Math.abs(delta).toFixed(1)}`);
    }
  }
  return `${parts.join("，")}。`;
}
var MIND_TRACE_MODES = [
  { id: "home", label: "主页", icon: "home" },
  { id: "trajectory", label: "轨迹", icon: "route" },
  { id: "record", label: "记录", icon: "notebook-pen", accent: true },
  { id: "reports", label: "回顾", icon: "file-text" },
  { id: "observation", label: "观照", icon: "scan-eye" }
];
function collectWeeklyReportFiles(app) {
  const files = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter?.["mind-trace-report"] !== true || frontmatter?.["report-type"] !== "weekly") {
      continue;
    }
    const start = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
    if (start.length === 0) {
      continue;
    }
    files.push({
      file,
      start,
      end: typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "",
      status: weeklyReportFrontmatterStatus(frontmatter),
      generatedAt: typeof frontmatter["generated-at"] === "string" ? frontmatter["generated-at"] : "",
      days: Number(frontmatter["source-days"]) || 0,
      sessions: Number(frontmatter["source-sessions"]) || 0
    });
  }
  files.sort((left, right) => right.start.localeCompare(left.start) || right.end.localeCompare(left.end));
  return files;
}
function collectMonthlyReportFiles(app) {
  const files = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter?.["mind-trace-report"] !== true || frontmatter?.["report-type"] !== "monthly") {
      continue;
    }
    const start = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
    if (start.length === 0) {
      continue;
    }
    files.push({
      file,
      start,
      end: typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "",
      status: frontmatter["period-status"] === "partial" ? "partial" : "complete",
      generatedAt: typeof frontmatter["generated-at"] === "string" ? frontmatter["generated-at"] : "",
      days: Number(frontmatter["source-days"]) || 0,
      sessions: Number(frontmatter["source-sessions"]) || 0,
      activeWeeks: Number(frontmatter["source-active-weeks"]) || 0
    });
  }
  files.sort((left, right) => right.start.localeCompare(left.start) || right.end.localeCompare(left.end));
  return files;
}
var JournalView = class extends import_obsidian4.ItemView {
  declare plugin: any;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  get ownerWindow() {
    return mindTraceWindow(this.containerEl);
  }
  get ownerDocument() {
    return mindTraceDocument(this.containerEl);
  }
  busy = false;
  busyText = "";
  mode = "home";
  unsubscribeDraft = null;
  unsubscribeMetrics = null;
  insightsCache = null;
  weeklyReportState = null;
  weeklyReportLoading = false;
  weeklyReportProgress = null;
  weeklyReportCardEl = null;
  monthlyReportState = null;
  monthlyReportLoading = false;
  monthlyReportProgress = null;
  monthlyReportCardEl = null;
  reportTab = "weekly";
  renderToken = 0;
  homeDashboard = null;
  historySnapshot = null;
  historyLoading = false;
  historyError = "";
  historyProgress = { done: 0, total: 0 };
  historyQuery = createHistoryQuery();
  historyVisibleCount = 30;
  historySectionEl = null;
  historyProgressEl = null;
  historySearchTimer = null;
  metricsRenderTimer = null;
  historyLoadToken = 0;
  trajectoryView = "events";
  trajectoryQuery = createTrajectoryQuery();
  trajectoryVisibleCount = 40;
  trajectoryEventPanelEl = null;
  trajectoryEntityExpanded = false;
  observationState = null;
  observationLoading = false;
  observationReports = null;
  observationFiles = [];
  observationSelectedPath = "";
  observationError = "";
  observationLoadToken = 0;
  observationDashboardCardEl = null;
  getViewType() {
    return JOURNAL_VIEW_TYPE;
  }
  getDisplayText() {
    return "心迹";
  }
  getIcon() {
    return "notebook-pen";
  }
  onOpen() {
    this.unsubscribeDraft = this.plugin.onDraftChanged(() => {
      if (!this.busy) {
        this.render(true);
      }
    });
    this.unsubscribeMetrics = this.plugin.onMetricsChanged(() => {
      this.insightsCache = null;
      this.historyLoadToken += 1;
      this.historySnapshot = null;
      this.historyLoading = false;
      this.historyProgress = { done: 0, total: 0 };
      if (!this.weeklyReportLoading) {
        this.weeklyReportState = null;
      }
      if (!this.monthlyReportLoading) {
        this.monthlyReportState = null;
      }
      this.observationReports = null;
      this.observationFiles = [];
      if (!this.busy && !this.weeklyReportLoading && !this.monthlyReportLoading && (this.mode === "home" || this.mode === "reports" || this.mode === "trajectory" || this.mode === "observation")) {
        if (this.metricsRenderTimer !== null) {
          this.ownerWindow.clearTimeout(this.metricsRenderTimer);
        }
        this.metricsRenderTimer = this.ownerWindow.setTimeout(() => {
          this.metricsRenderTimer = null;
          this.render(true);
        }, 150);
      }
    });
    this.render();
    return Promise.resolve();
  }
  onClose() {
    this.unsubscribeDraft?.();
    this.unsubscribeDraft = null;
    this.unsubscribeMetrics?.();
    this.unsubscribeMetrics = null;
    this.historyLoadToken += 1;
    this.historyLoading = false;
    if (this.historySearchTimer !== null) {
      this.ownerWindow.clearTimeout(this.historySearchTimer);
      this.historySearchTimer = null;
    }
    if (this.metricsRenderTimer !== null) {
      this.ownerWindow.clearTimeout(this.metricsRenderTimer);
      this.metricsRenderTimer = null;
    }
    return Promise.resolve();
  }
  clearHistoryState() {
    this.historyLoadToken += 1;
    this.historySnapshot = null;
    this.historyLoading = false;
    this.historyError = "";
    this.historyProgress = { done: 0, total: 0 };
    this.historyQuery = createHistoryQuery();
    this.historyVisibleCount = 30;
    this.trajectoryQuery = createTrajectoryQuery();
    this.trajectoryVisibleCount = 40;
    this.trajectoryEntityExpanded = false;
    this.historySectionEl = null;
    this.historyProgressEl = null;
    if (this.historySearchTimer !== null) {
      this.ownerWindow.clearTimeout(this.historySearchTimer);
      this.historySearchTimer = null;
    }
  }
  render(preserveContext = false) {
    const existing = this.containerEl.children[1];
    const context = preserveContext && existing instanceof this.ownerWindow.HTMLElement ? captureMindTraceContext(existing) : null;
    this.renderToken += 1;
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mind-trace-view");
    if (renderPrivacyGate(container, this.plugin)) {
      return;
    }
    const shell = container.createDiv({ cls: "mind-trace-app" });
    shell.appendChild(this.ownerDocument.createComment(`
THESIS: Mind Trace is one connected instrument for recording and inspecting evidence; it refuses the rounded dashboard card wall.
OWN-WORLD: Mature Obsidian structure on cool neutral surfaces; Record indigo, Trajectory cobalt, mood coral, energy teal, stress amber, Observation orchid; broad horizontal bands, fine keylines, tabular metadata.
STORY: The user sees today, records, scans state, follows events, then opens bounded Review or evidence-led Observation.
FIRST VIEWPORT: 56px destination bar; wide date + Record band; three state channels; 2:1 trend/events workspace; Review and Observation below.
FORM: Horizontal instrument, approved comp A; user-pinned category standard; seed 3a34c5d6.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md`));
    this.renderNav(shell);
    const mode = MIND_TRACE_MODES.find((item) => item.id === this.mode) ?? MIND_TRACE_MODES[0];
    const panel = shell.createDiv({
      cls: "mind-trace-tabpanel",
      attr: {
        role: "tabpanel",
        "aria-labelledby": `mind-trace-tab-${mode.id}`,
        id: `mind-trace-panel-${mode.id}`
      }
    });
    switch (mode.id) {
      case "record":
        this.renderJournal(panel);
        break;
      case "reports":
        this.renderReports(panel);
        break;
      case "trajectory":
        this.renderTrajectory(panel);
        break;
      case "observation":
        this.renderObservation(panel);
        break;
      default:
        this.renderHome(panel);
        break;
    }
    for (const item of MIND_TRACE_MODES) {
      if (item.id === mode.id) {
        continue;
      }
      shell.createDiv({
        cls: "mind-trace-tabpanel mind-trace-tabpanel-placeholder",
        attr: {
          role: "tabpanel",
          id: `mind-trace-panel-${item.id}`,
          "aria-labelledby": `mind-trace-tab-${item.id}`,
          hidden: "true"
        }
      });
    }
    if (context !== null) {
      restoreMindTraceContext(container, context);
    }
  }
  renderNav(shell) {
    const nav = shell.createEl("nav", {
      cls: "mind-trace-nav",
      attr: { "aria-label": "心迹模块导航" }
    });
    const brand = nav.createDiv({ cls: "mind-trace-nav-brand" });
    (0, import_obsidian4.setIcon)(brand.createSpan({ cls: "mind-trace-nav-brand-mark", attr: { "aria-hidden": "true" } }), "notebook-pen");
    const brandCopy = brand.createSpan({ cls: "mind-trace-nav-brand-copy" });
    brandCopy.createSpan({ cls: "mind-trace-nav-brand-name", text: "心迹" });
    brandCopy.createSpan({ cls: "mind-trace-nav-brand-subtitle", text: "Mind Trace" });
    const items = nav.createDiv({ cls: "mind-trace-nav-items", attr: { role: "tablist", "aria-label": "心迹模块" } });
    for (const [index, mode] of MIND_TRACE_MODES.entries()) {
      const active = this.mode === mode.id;
      const button = items.createEl("button", {
        cls: `mind-trace-nav-item${active ? " is-active" : ""}${mode.accent ? " is-record" : ""}`,
        attr: {
          id: `mind-trace-tab-${mode.id}`,
          type: "button",
          role: "tab",
          "aria-selected": String(active),
          "aria-controls": `mind-trace-panel-${mode.id}`,
          "aria-label": mode.label,
          "data-mind-trace-focus-key": `mind-trace-mode-${mode.id}`,
          tabindex: active ? "0" : "-1"
        }
      });
      (0, import_obsidian4.setIcon)(button.createSpan({ cls: "mind-trace-nav-icon", attr: { "aria-hidden": "true" } }), mode.icon);
      button.createSpan({ text: mode.label });
      button.addEventListener("click", () => {
        this.setMode(mode.id);
        this.ownerWindow.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`[data-mind-trace-focus-key="mind-trace-mode-${mode.id}"]`);
          if (target instanceof this.ownerWindow.HTMLElement) {
            target.focus();
          }
        });
      });
      button.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
          return;
        }
        event.preventDefault();
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? MIND_TRACE_MODES.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + MIND_TRACE_MODES.length) % MIND_TRACE_MODES.length;
        const next = MIND_TRACE_MODES[nextIndex];
        this.setMode(next.id);
        this.ownerWindow.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`[data-mind-trace-focus-key="mind-trace-mode-${next.id}"]`);
          if (target instanceof this.ownerWindow.HTMLElement) {
            target.focus();
          }
        });
      });
    }
  }
  setMode(mode) {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.render();
  }
  startWizard() {
    this.mode = "record";
    this.render();
  }
  async openJournalFile(filePath, sessionIndex = null, focusEvent = null) {
    await this.plugin.openSavedJournalFile(filePath, sessionIndex, focusEvent);
  }
  async openWeeklyReportFile(filePath) {
    await this.plugin.openWeeklyReportFile(filePath);
  }
  async loadInsights(range, entries = null) {
    const allEntries = entries ?? collectMetrics(this.app).entries;
    const filtered = filterMetrics(allEntries, range);
    const facetCounts = new Map();
    const aiByDate = /* @__PURE__ */ new Map();
    const recentEvents = [];
    const results = await mapWithConcurrency(filtered, 4, async (entry) => {
      try {
        const file = this.app.vault.getAbstractFileByPath(entry.filePath);
        if (!(file instanceof import_obsidian4.TFile)) {
          return null;
        }
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const document2 = await readParsedJournal(this.app, file, frontmatter);
        const localFacets = /* @__PURE__ */ new Map();
        const localEvents = [];
        const localAi = /* @__PURE__ */ new Map();
        let sessions = 0;
        for (const [sessionIndex, session] of document2.sessions.entries()) {
          sessions += 1;
          for (const facet of session.facets) {
            localFacets.set(facet.category, (localFacets.get(facet.category) ?? 0) + 1);
          }
          for (const event of session.events) {
            localEvents.push({
              date: document2.date,
              time: session.time,
              type: EVENT_TYPE_LABELS[event.type] ?? EVENT_TYPE_LABELS.other,
              status: EVENT_STATUS_LABELS[event.status] ?? EVENT_STATUS_LABELS.uncertain,
              title: event.title,
              summary: event.summary,
              filePath: entry.filePath,
              sessionIndex
            });
          }
          for (const key of ["mood", "energy", "stress"]) {
            const rating = session.ratings[key];
            if (rating.aiScore !== void 0) {
              let day = localAi.get(document2.date);
              if (day === void 0) {
                day = {
                  mood: { sum: 0, count: 0 },
                  energy: { sum: 0, count: 0 },
                  stress: { sum: 0, count: 0 }
                };
                localAi.set(document2.date, day);
              }
              day[key].sum += rating.aiScore;
              day[key].count += 1;
            }
          }
        }
        return { localFacets, localEvents, localAi, sessions };
      } catch (error) {
        return null;
      }
    });
    let sessionCount = 0;
    for (const result of results) {
      if (result === null) {
        continue;
      }
      sessionCount += result.sessions;
      for (const [category, count] of result.localFacets) {
        facetCounts.set(category, (facetCounts.get(category) ?? 0) + count);
      }
      recentEvents.push(...result.localEvents);
      for (const [date, day] of result.localAi) {
        const target = aiByDate.get(date);
        if (target === void 0) {
          aiByDate.set(date, day);
          continue;
        }
        for (const key of ["mood", "energy", "stress"]) {
          target[key].sum += day[key].sum;
          target[key].count += day[key].count;
        }
      }
    }
    recentEvents.sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time));
    return {
      facets: [...facetCounts.entries()].map(([category, count]) => ({ category, count })).sort(
        (left, right) => right.count - left.count || left.category.localeCompare(right.category)
      ).slice(0, 8),
      recentEvents: recentEvents.slice(0, 24),
      series: filtered.map((entry) => {
        const aiDay = aiByDate.get(entry.date);
        const ai = { mood: null, energy: null, stress: null };
        for (const key of ["mood", "energy", "stress"]) {
          const aggregate = aiDay?.[key];
          if (aggregate !== void 0 && aggregate.count > 0) {
            ai[key] = aggregate.sum / aggregate.count;
          }
        }
        return {
          date: entry.date,
          self: {
            mood: entry.mood,
            energy: entry.energy,
            stress: entry.stress
          },
          ai
        };
      }),
      sessionCount
    };
  }
  async loadAndRenderInsights(range, entries = null) {
    const token = this.renderToken;
    if (this.insightsCache === null || this.insightsCache.range !== range) {
      this.insightsCache = { range, data: await this.loadInsights(range, entries) };
    }
    if (token !== this.renderToken || this.mode !== "home" || this.plugin.settings.dashboardRange !== range) {
      return;
    }
    this.homeDashboard?.renderInsights(this.insightsCache.data);
  }
  async loadWeeklyReportCard() {
    if (this.weeklyReportLoading || (this.mode !== "home" && this.mode !== "reports")) {
      return;
    }
    const period = completedPeriod("weekly");
    const key = `${period.start}--${period.end}`;
    if (this.weeklyReportState !== null && this.weeklyReportState.key === key && this.weeklyReportState.kind !== "loading") {
      return;
    }
    this.weeklyReportLoading = true;
    this.weeklyReportState = { kind: "loading", key, period };
    try {
      let status = await this.plugin.weeklyReportStatus(period);
      if (status.kind === "missing" && this.plugin.settings.weeklyReportAutoGenerate !== false) {
        if (!this.plugin.weeklyReportAttempts.has(key)) {
          this.weeklyReportLoading = false;
          this.retryWeeklyReport(false, true);
          return;
        }
      }
      this.weeklyReportState = { ...status, key };
    } catch (error) {
      this.weeklyReportState = { kind: "error", key, period, message: errorMessage(error) };
    } finally {
      this.weeklyReportLoading = false;
      this.weeklyReportProgress = null;
      if ((this.mode === "home" || this.mode === "reports") && this.leaf.view === this) {
        this.refreshWeeklyReportCard();
      }
      if (this.mode === "reports" && this.leaf.view === this) {
        this.render(true);
      }
      if (this.weeklyReportState?.kind !== "loading") {
        void this.loadMonthlyReportCard();
      }
    }
  }
  retryWeeklyReport(overwrite = false, automatic = false) {
    if (this.weeklyReportLoading) {
      return;
    }
    const period = completedPeriod("weekly");
    const key = `${period.start}--${period.end}`;
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹 · 上周回顾",
      title: overwrite ? "更新上一周的周报？" : "生成上一周的周报？",
      description: "会先整理需要校准的图谱事件，再生成周报并构建更新后的事件图谱。",
      confirm: overwrite,
      confirmLabel: overwrite ? "更新周报" : "开始生成",
      warning: overwrite,
      stages: ["读取本周记录", "整理图谱事件", "模型校准事件", "逐篇写回日记", "生成周报内容", "保存周报", "构建图谱数据", "更新周报与图谱"],
      run: async (update) => {
        this.weeklyReportLoading = true;
        this.weeklyReportState = { kind: "loading", key, period };
        const reportProgress = (progress) => {
          this.weeklyReportProgress = progress;
          update(progress);
          this.refreshWeeklyReportCard();
        };
        this.refreshWeeklyReportCard();
        const status = await this.plugin.generateWeeklyReport(period, overwrite, automatic, reportProgress);
        reportProgress({ stage: 8, total: 8, title: "更新周报与图谱", detail: "正在更新首页周报卡和图谱入口。" });
        this.weeklyReportState = { ...status, key };
        return status;
      },
      onSuccess: async () => {
        this.weeklyReportLoading = false;
        this.weeklyReportProgress = null;
        this.refreshWeeklyReportCard();
        await new Promise((resolve) => this.ownerWindow.requestAnimationFrame(resolve));
        if (this.mode === "reports" && this.leaf.view === this) {
          this.render(true);
        }
        void this.loadMonthlyReportCard();
      },
      onError: (error) => {
        this.weeklyReportLoading = false;
        this.weeklyReportState = { kind: "error", key, period, message: errorMessage(error) };
        this.refreshWeeklyReportCard();
        void this.loadMonthlyReportCard();
      },
      successTitle: "周报和图谱已经生成",
      successDetail: "事件已按整周上下文整理，周报与图谱均已保存。",
      successLabel: "查看报告",
      backgroundSuccess: "上一周的周报和图谱已经生成",
      onViewResult: () => {
        if (this.mode !== "reports") {
          this.setMode("reports");
        }
      }
    });
  }
  async loadMonthlyReportCard() {
    if (this.monthlyReportLoading || (this.mode !== "home" && this.mode !== "reports")) {
      return;
    }
    if (this.weeklyReportLoading || this.weeklyReportState === null) {
      void this.loadWeeklyReportCard();
      return;
    }
    const period = completedPeriod("monthly");
    const key = `${period.start}--${period.end}--${period.status}`;
    if (this.monthlyReportState !== null && this.monthlyReportState.key === key && this.monthlyReportState.kind !== "loading") {
      return;
    }
    this.monthlyReportLoading = true;
    this.monthlyReportState = { kind: "loading", key, period };
    try {
      const status = await this.plugin.monthlyReportStatus(period);
      if (status.kind === "missing" && this.plugin.settings.monthlyReportAutoGenerate !== false && !this.plugin.monthlyReportAttempts.has(key)) {
        this.monthlyReportLoading = false;
        this.retryMonthlyReport(false, true);
        return;
      }
      this.monthlyReportState = { ...status, key };
    } catch (error) {
      this.monthlyReportState = { kind: "error", key, period, message: errorMessage(error) };
    } finally {
      this.monthlyReportLoading = false;
      this.monthlyReportProgress = null;
      if ((this.mode === "home" || this.mode === "reports") && this.leaf.view === this) {
        this.refreshMonthlyReportCard();
      }
      if (this.mode === "reports" && this.leaf.view === this && this.reportTab === "monthly") {
        this.render(true);
      }
    }
  }
  retryMonthlyReport(overwrite = false, automatic = false) {
    if (this.monthlyReportLoading) {
      return;
    }
    const period = completedPeriod("monthly");
    const key = `${period.start}--${period.end}--${period.status}`;
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹 · 上月回顾",
      title: overwrite ? "更新上一月的月报？" : "生成上一月的月报？",
      description: "按自然周分段整理整月记录，校准事件后生成月报；已有文件不会被自动覆盖。",
      confirm: overwrite,
      confirmLabel: overwrite ? "更新月报" : "开始生成",
      warning: overwrite,
      stages: ["读取本月记录", "整理月度事件", "按周校准事件", "逐段写回日记", "生成月报内容", "保存月报", "构建月度图谱", "更新月报页面"],
      run: async (update) => {
        this.monthlyReportLoading = true;
        this.monthlyReportState = { kind: "loading", key, period };
        const reportProgress = (progress) => {
          this.monthlyReportProgress = progress;
          update(progress);
          this.refreshMonthlyReportCard();
        };
        this.refreshMonthlyReportCard();
        const status = await this.plugin.generateMonthlyReport(period, overwrite, automatic, reportProgress);
        reportProgress({ stage: 8, total: 8, title: "更新月报页面", detail: "正在更新月报入口和图谱。" });
        this.monthlyReportState = { ...status, key };
        return status;
      },
      onSuccess: async () => {
        this.monthlyReportLoading = false;
        this.monthlyReportProgress = null;
        this.refreshMonthlyReportCard();
        await new Promise((resolve) => this.ownerWindow.requestAnimationFrame(resolve));
        if (this.mode === "reports" && this.leaf.view === this) {
          this.render(true);
        }
      },
      onError: (error) => {
        this.monthlyReportLoading = false;
        this.monthlyReportState = { kind: "error", key, period, message: errorMessage(error) };
        this.refreshMonthlyReportCard();
      },
      successTitle: "月报和图谱已经生成",
      successDetail: "事件已按自然周片段整理，月报与图谱均已保存。",
      successLabel: "查看月报",
      backgroundSuccess: "上一月的月报和图谱已经生成",
      onViewResult: () => {
        this.reportTab = "monthly";
        if (this.mode !== "reports") {
          this.setMode("reports");
        }
      }
    });
  }
  generateCurrentMonthReport(existingPreview = null) {
    const period = currentMonthPeriod();
    const currentFile = existingPreview ?? this.plugin.monthlyReportRepository.find(this.plugin.settings, period);
    const hasExisting = currentFile !== null;
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹 · 本月预览",
      title: hasExisting ? "更新本月预览？" : "生成本月预览？",
      description: hasExisting ? "将用当前自然月截至今天的最新记录替换现有预览 Markdown；至少有 1 个记录日即可。" : "将当前自然月截至今天的记录生成一份月报预览；至少有 1 个记录日即可。",
      confirm: hasExisting,
      confirmLabel: hasExisting ? "更新预览" : "开始生成",
      warning: hasExisting,
      stages: ["读取本月记录", "整理月度事件", "按周校准事件", "逐段写回日记", "生成月报内容", "保存月报", "构建月度图谱", "更新月报页面"],
      run: async (update) => await this.plugin.generateMonthlyReport(period, true, false, update),
      successTitle: "本月预览已生成",
      successDetail: "月报标记为截至今天，月底后可再生成完整月报。",
      successLabel: "查看月报",
      backgroundSuccess: "本月预览已经生成",
      onViewResult: async () => {
        const status = await this.plugin.monthlyReportStatus(period);
        if ((status.kind === "ready" || status.kind === "stale") && status.file !== null) {
          await this.plugin.openWeeklyReportFile(status.file.path);
        } else {
          showMindTraceNotice("本月预览暂时无法打开");
        }
      }
    });
  }
  generateCurrentWeekReport() {
    const period = currentWeekPeriod();
    const existingPreview = this.plugin.weeklyReportRepository.find(this.plugin.settings, period);
    const hasExisting = existingPreview !== null;
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹 · 本周周报",
      title: hasExisting ? "更新本周周报？" : "生成本周周报？",
      description: hasExisting ? "把当前自然周新增的日记纳入统计，替换现有本周预览；完整周结束后仍会单独生成。" : "把当前自然周尚未结束的日记也纳入统计，生成本周版本；完整周结束后仍会单独生成。",
      confirm: hasExisting,
      confirmLabel: hasExisting ? "更新周报" : "开始生成",
      warning: hasExisting,
      stages: ["读取本周记录", "整理图谱事件", "模型校准事件", "逐篇写回日记", "生成周报内容", "保存周报", "构建图谱数据", "更新周报与图谱"],
      run: async (update) => {
        return await this.plugin.generateWeeklyReport(period, hasExisting, false, update);
      },
      successTitle: "本周周报已生成",
      successDetail: "当前自然周已生成一份周报版本。",
      successLabel: "查看周报",
      backgroundSuccess: "本周周报已经生成",
      onViewResult: async () => {
        const status = await this.plugin.weeklyReportStatus(period);
        if ((status.kind === "ready" || status.kind === "stale") && status.file !== null) {
          await this.plugin.openWeeklyReportFile(status.file.path);
        } else {
          showMindTraceNotice("本周周报暂时无法打开");
        }
      }
    });
  }
  renderHome(container) {
    const shell = container.createDiv({ cls: "mind-trace-home-shell" });
    const result = collectMetrics(this.app);
    const allEntries = result.entries;
    const now = /* @__PURE__ */ new Date();
    const today = localDateString(now);
    const weekStart = localDateString(startOfLocalWeek(now));
    const currentWeekEntries = allEntries.filter((entry) => entry.date >= weekStart && entry.date <= today);
    const currentWeek = metricSnapshot(currentWeekEntries);
    const lastWeekPeriod = completedPeriod("weekly");
    const lastWeek = metricSnapshot(periodEntries(allEntries, lastWeekPeriod));
    const header = shell.createDiv({ cls: "mind-trace-home-header" });
    const heading = header.createDiv({ cls: "mind-trace-home-header-copy" });
    heading.createDiv({ cls: "mind-trace-eyebrow", text: "心迹" });
    const dateBand = heading.createDiv({ cls: "mind-trace-home-date-band" });
    dateBand.createSpan({ cls: "mind-trace-home-date-label", text: "今天" });
    dateBand.createEl("time", {
      cls: "mind-trace-home-date-value",
      text: today,
      attr: { datetime: today }
    });
    dateBand.createSpan({ cls: "mind-trace-home-date-weekday", text: weekdayText(today) });
    heading.createDiv({
      cls: "mind-trace-home-title",
      text: currentWeek.days > 0 ? `这周留下了 ${currentWeek.days} 个落点` : "从今天留下一个落点",
      attr: { role: "heading", "aria-level": "1" }
    });
    heading.createEl("p", {
      text: homeWeekSummary(currentWeek, lastWeek)
    });
    const startButton = header.createEl("button", {
      cls: "mod-cta mind-trace-home-cta",
      text: "开始记录",
      attr: { type: "button" }
    });
    startButton.addEventListener("click", () => {
      this.startWizard();
    });
    const draft = this.plugin.draft;
    if (draft !== null) {
      const card = shell.createDiv({ cls: "mind-trace-home-draft" });
      const copy = card.createDiv({ cls: "mind-trace-home-draft-copy" });
      copy.createDiv({
        cls: "mind-trace-home-draft-title",
        text: `${monthDayText(draftEntryDate(draft))}的记录还未完成`
      });
      copy.createEl("p", { text: draftProgressText(draft) });
      const actions = card.createDiv({ cls: "mind-trace-home-draft-actions" });
      const resumeButton = actions.createEl("button", {
        cls: "mod-cta",
        text: "继续",
        attr: { type: "button" }
      });
      resumeButton.addEventListener("click", () => {
        this.startWizard();
      });
      const clearButton = actions.createEl("button", {
        cls: "mind-trace-clear-button",
        text: "清除草稿",
        attr: { type: "button", "aria-label": "清除未完成草稿" }
      });
      clearButton.disabled = this.busy;
      clearButton.addEventListener("click", () => {
        void this.clearDraft();
      });
    }
    const dashboard = new DashboardComponent(
      this.app,
      shell,
      this.plugin.settings.dashboardRange,
      async (range) => {
        this.plugin.settings.dashboardRange = range;
        await this.plugin.saveSettings();
        this.render(true);
      },
      (filePath) => {
        if (filePath) {
          void this.openJournalFile(filePath);
        } else {
          this.startWizard();
        }
      },
      (theme) => {
        this.historyQuery.themes.add(theme);
        this.historyVisibleCount = 30;
        this.setMode("trajectory");
      },
      (event) => {
        void this.openJournalFile(event.filePath, event.sessionIndex, event);
      }
    );
    const latestEntry = [...allEntries].reverse().find((entry) => entry.date <= today) ?? null;
    this.renderHomeStateBand(shell, latestEntry);
    const filtered = filterMetrics(allEntries, this.plugin.settings.dashboardRange);
    const currentStart = addLocalDays(new Date(), -(this.plugin.settings.dashboardRange - 1));
    const previousEnd = localDateString(addLocalDays(currentStart, -1));
    const previousStart = localDateString(addLocalDays(currentStart, -this.plugin.settings.dashboardRange));
    const previousFiltered = allEntries.filter((entry) => entry.date >= previousStart && entry.date <= previousEnd);
    const overview = shell.createDiv({ cls: "mind-trace-home-overview" });
    const calendarCell = overview.createDiv({ cls: "mind-trace-home-overview-calendar" });
    const trendCell = overview.createDiv({ cls: "mind-trace-home-overview-trend" });
    dashboard.renderCalendar(result.entries, calendarCell);
    dashboard.renderTrend(trendCell, filtered, this.plugin.settings.dashboardRange, previousFiltered);
    const secondary = shell.createDiv({ cls: "mind-trace-home-secondary" });
    const eventsCell = secondary.createDiv({ cls: "mind-trace-home-workspace-events" });
    dashboard.renderEventsCard(eventsCell);
    const eventsLink = eventsCell.createEl("button", {
      cls: "mind-trace-home-support-link",
      text: "查看完整事件脉络",
      attr: { type: "button" }
    });
    eventsLink.addEventListener("click", () => {
      this.trajectoryView = "events";
      this.setMode("trajectory");
    });
    const reviewCell = secondary.createDiv({ cls: "mind-trace-home-support-review" });
    this.renderWeeklyReportCard(reviewCell);
    const observationCell = secondary.createDiv({ cls: "mind-trace-home-support-observation" });
    this.renderObservationDashboardCard(observationCell);
    const archive = shell.createDiv({ cls: "mind-trace-home-archive" });
    const archiveHeading = archive.createDiv({ cls: "mind-trace-home-archive-heading" });
    archiveHeading.createDiv({ cls: "mind-trace-home-section-title", text: "继续检视", attr: { role: "heading", "aria-level": "2" } });
    archiveHeading.createEl("p", { text: "主题与切片是原始记录的入口，不替代轨迹中的事实脉络。" });
    const archiveGrid = archive.createDiv({ cls: "mind-trace-home-archive-grid" });
    const themesCell = archiveGrid.createDiv({ cls: "mind-trace-home-cell" });
    const facetsCell = archiveGrid.createDiv({ cls: "mind-trace-home-cell" });
    dashboard.renderThemesCard(themesCell, filtered);
    dashboard.renderFacetsCard(facetsCell);
    if (result.entries.length === 0) {
      const emptySection = archive.createDiv({ cls: "mind-trace-home-section mind-trace-home-empty-section" });
      dashboard.renderEmpty(emptySection);
    }
    if (result.ignoredFiles > 0) {
      shell.createEl("p", {
        cls: "mind-trace-warning",
        text: `有 ${result.ignoredFiles} 篇心迹日记的属性格式无效，已忽略。`
      });
    }
    this.homeDashboard = dashboard;
    void this.loadAndRenderInsights(this.plugin.settings.dashboardRange, result.entries);
    this.ownerWindow.setTimeout(() => {
      void this.loadWeeklyReportCard();
      void this.loadObservationReports();
    }, 0);
  }
  renderHomeStateBand(container, entry) {
    const band = container.createEl("section", {
      cls: "mind-trace-home-state-band",
      attr: { "aria-labelledby": "mind-trace-home-state-title" }
    });
    const heading = band.createDiv({ cls: "mind-trace-home-state-heading" });
    heading.createDiv({ cls: "mind-trace-home-section-title", text: "今天的状态", attr: { id: "mind-trace-home-state-title", role: "heading", "aria-level": "2" } });
    heading.createSpan({ cls: "mind-trace-home-state-source", text: entry === null ? "等待第一条记录" : `来自 ${entry.date} 的自评` });
    const channels = band.createDiv({ cls: "mind-trace-home-state-channels" });
    for (const [key, label, icon] of [["mood", "心情", "heart"], ["energy", "精力", "zap"], ["stress", "压力", "alert-circle"]]) {
      const channel = channels.createDiv({ cls: `mind-trace-home-state-channel is-${key}` });
      const channelLabel = channel.createDiv({ cls: "mind-trace-home-state-label" });
      (0, import_obsidian4.setIcon)(channelLabel.createSpan({ cls: "mind-trace-home-state-icon", attr: { "aria-hidden": "true" } }), icon);
      channelLabel.createSpan({ text: label });
      const score = entry === null ? null : entry[key];
      const value = channel.createDiv({ cls: "mind-trace-home-state-value" });
      value.createEl("strong", { text: score === null ? "—" : score.toFixed(1) });
      value.createSpan({ text: score === null ? "尚无记录" : ratingStateWord(key, Math.round(score)) });
      const track = channel.createDiv({ cls: "mind-trace-home-state-track", attr: { "aria-hidden": "true" } });
      for (let level = 1; level <= 5; level += 1) {
        track.createSpan({ cls: `mind-trace-home-state-segment${score !== null && level <= Math.round(score) ? " is-filled" : ""}` });
      }
    }
  }
  renderFormationStrip(container, entries) {
    const settings = this.plugin.settings;
    const strip = container.createDiv({ cls: "mind-trace-formation-strip" });
    const weekProgress = formationProgress(entries, currentWeekPeriod(), settings.weeklyReportMinimumDays);
    this.renderFormationBlock(strip, {
      kind: "weekly",
      kicker: "本周正在形成",
      label: "周报",
      periodLabel: periodLabel(currentWeekPeriod()),
      days: weekProgress.days,
      minimum: weekProgress.minimum,
      countText: `${weekProgress.days} / ${weekProgress.minimum} 个记录日`,
      percent: weekProgress.percent,
      cells: weekProgress.minimum,
      overflow: weekProgress.overflow
    });
    const monthSegments = monthlyWeekSegments(entries, currentMonthPeriod(), settings.weeklyReportMinimumDays);
    const reachedCount = monthSegments.filter((segment) => segment.reached).length;
    this.renderMonthlyFormationBlock(strip, {
      kicker: "本月正在形成",
      label: "月报",
      periodLabel: periodLabel(currentMonthPeriod()),
      segments: monthSegments,
      reachedCount,
      total: monthSegments.length,
      totalDays: monthSegments.reduce((sum, segment) => sum + segment.days, 0)
    });
  }
  renderFormationBlock(container, view) {
    const { kind, kicker, label, periodLabel, days, minimum, countText, percent, cells, overflow } = view;
    const block = container.createDiv({ cls: `mind-trace-formation-block is-${kind}` });
    const head = block.createDiv({ cls: "mind-trace-formation-head" });
    const meta = head.createDiv({ cls: "mind-trace-formation-meta" });
    meta.createSpan({ cls: "mind-trace-formation-kicker", text: `${kicker} · ${label}` });
    meta.createSpan({ cls: "mind-trace-formation-period", text: periodLabel });
    const total = head.createDiv({ cls: "mind-trace-formation-total" });
    total.createSpan({ cls: "mind-trace-formation-count", text: countText });
    total.createSpan({ cls: "mind-trace-formation-percent", text: `${Math.round(percent)}%` });
    const shown = overflow > 0 ? days : (minimum > 0 ? minimum : 1);
    const fillWidth = minimum > 0 && overflow > 0 ? (minimum / days) * 100 : Math.min(100, percent);
    const spillWidth = overflow > 0 ? (overflow / days) * 100 : 0;
    const bar = block.createDiv({ cls: "mind-trace-formation-bar" });
    const track = bar.createDiv({
      cls: "mind-trace-formation-track",
      attr: {
        role: "progressbar",
        "aria-label": `${label}形成进度`,
        "aria-valuemin": "0",
        "aria-valuemax": "100",
        "aria-valuenow": String(Math.min(100, Math.round(percent))),
        "aria-valuetext": countText
      }
    });
    track.createDiv({ cls: "mind-trace-formation-fill", attr: { style: `width: ${fillWidth}%` } });
    for (let index = 1; index < shown; index += 1) {
      track.createDiv({ cls: "mind-trace-formation-pip", attr: { style: `left: ${(index / shown) * 100}%`, "aria-hidden": "true" } });
    }
    if (cells > 0) {
      const thresholdStyle = overflow > 0 ? `left: ${fillWidth}%; transform: translateX(-50%);` : "";
      track.createDiv({ cls: "mind-trace-formation-threshold", attr: { title: "最低生成门槛", "aria-hidden": "true", style: thresholdStyle } });
    }
    if (overflow > 0) {
      block.addClass("is-overflow");
      track.createDiv({
        cls: "mind-trace-formation-spill",
        attr: {
          style: `left: ${fillWidth}%; width: ${spillWidth}%`,
          "aria-hidden": "true",
          title: `超过${label}最低门槛 ${overflow} 天`
        }
      });
    }
    const caption = block.createDiv({ cls: "mind-trace-formation-caption", text: formationCaption(label, { days, minimum, overflow }) });
    if (overflow > 0) {
      caption.addClass("is-overflow");
      caption.setAttribute("role", "status");
    }
  }
  renderMonthlyFormationBlock(container, view) {
    const { kicker, label, periodLabel, segments, reachedCount, total, totalDays } = view;
    const block = container.createDiv({ cls: "mind-trace-formation-block is-monthly" });
    const head = block.createDiv({ cls: "mind-trace-formation-head" });
    const meta = head.createDiv({ cls: "mind-trace-formation-meta" });
    meta.createSpan({ cls: "mind-trace-formation-kicker", text: `${kicker} · ${label}` });
    meta.createSpan({ cls: "mind-trace-formation-period", text: periodLabel });
    const totalEl = head.createDiv({ cls: "mind-trace-formation-total" });
    const count = totalEl.createSpan({ cls: "mind-trace-formation-count", text: `已达成 ${reachedCount}/${total} 周` });
    if (reachedCount === total) {
      count.addClass("is-complete");
    }
    const hasOverflow = segments.some((segment) => segment.overflow > 0);
    const overflowSegments = segments.filter((segment) => segment.overflow > 0);
    const overflowDays = overflowSegments.reduce((sum, segment) => sum + segment.overflow, 0);
    if (hasOverflow) {
      block.addClass("is-overflow");
    }
    const labels = block.createDiv({ cls: "mind-trace-formation-seg-labels" });
    for (const segment of segments) {
      const label = labels.createSpan({ cls: "mind-trace-formation-seg-label" });
      if (segment.reached) {
        label.addClass("is-reached");
        label.textContent = "达成";
        label.setAttribute("title", `已达成 ${Math.round(segment.percent)}%`);
      } else {
        label.textContent = `${Math.round(segment.percent)}%`;
      }
    }
    const bar = block.createDiv({ cls: "mind-trace-formation-bar" });
    const track = bar.createDiv({
      cls: "mind-trace-formation-segments",
      attr: {
        role: "progressbar",
        "aria-label": `${label}各周进度`,
        "aria-valuemin": "0",
        "aria-valuemax": String(total),
        "aria-valuenow": String(reachedCount),
        "aria-valuetext": `已达成 ${reachedCount}/${total} 周`
      }
    });
    for (const segment of segments) {
      const cell = track.createDiv({ cls: `mind-trace-formation-segment${segment.reached ? " is-reached" : ""}${segment.overflow > 0 ? " is-overflow" : ""}` });
      const fillWidth = segment.overflow > 0 ? (segment.minimum / segment.days) * 100 : Math.min(100, segment.percent);
      const spillWidth = segment.overflow > 0 ? (segment.overflow / segment.days) * 100 : 0;
      cell.createDiv({ cls: "mind-trace-formation-seg-fill", attr: { style: `width: ${fillWidth}%`, "aria-hidden": "true" } });
      if (segment.overflow > 0) {
        cell.createDiv({ cls: "mind-trace-formation-seg-spill", attr: { style: `left: ${fillWidth}%; width: ${spillWidth}%`, "aria-hidden": "true", title: `超过最低门槛 ${segment.overflow} 天` } });
      }
      const overflowText = segment.overflow > 0 ? ` · 超过门槛 ${segment.overflow} 天` : "";
      cell.setAttribute("title", `${segment.start.slice(5).replace("-", "/")}—${segment.end.slice(5).replace("-", "/")} · ${segment.days}/${segment.minimum} 天${overflowText}`);
      cell.setAttribute("aria-label", `${segment.start.slice(5).replace("-", "/")}到${segment.end.slice(5).replace("-", "/")}，${segment.days}/${segment.minimum} 天${segment.overflow > 0 ? `，超过门槛 ${segment.overflow} 天` : ""}`);
    }
    let captionText;
    if (totalDays === 0) {
      captionText = "写下今天的落点，进度就会点亮。";
    } else if (reachedCount === total) {
      captionText = hasOverflow ? `本月 ${total} 段全部达成，其中 ${overflowSegments.length} 段超过门槛 ${overflowDays} 天。` : `本月 ${total} 段全部达成，可以准备月报。`;
    } else if (reachedCount > 0) {
      captionText = hasOverflow ? `已达成 ${reachedCount}/${total} 段，其中 ${overflowSegments.length} 段超过门槛 ${overflowDays} 天。` : `已达成 ${reachedCount}/${total} 段，继续点亮更多周。`;
    } else {
      captionText = "本月还没有达成任何周，继续记录即可点亮。";
    }
    const caption = block.createDiv({ cls: `mind-trace-formation-caption${hasOverflow ? " is-overflow" : ""}`, text: captionText });
    if (hasOverflow) {
      caption.setAttribute("role", "status");
    }
  }
  renderWeeklyReportCard(container, existing = null) {
    const state = this.weeklyReportState;
    const period = state?.period ?? completedPeriod("weekly");
    const card = existing ?? container.createEl("section", { cls: "mind-trace-weekly-card" });
    card.empty();
    card.classList.remove("is-copy-roomy", "is-copy-compact");
    this.weeklyReportCardEl = card;
    const header = card.createDiv({ cls: "mind-trace-lead-card-header" });
    const title = header.createDiv();
    title.createDiv({ cls: "mind-trace-home-section-title", text: "上一周回顾", attr: { role: "heading", "aria-level": "2" } });
    title.createSpan({ cls: "mind-trace-period-label", text: periodLabel(period) });
    const body = card.createDiv({ cls: "mind-trace-weekly-card-body", attr: { "aria-live": "polite", "aria-busy": this.weeklyReportLoading ? "true" : "false" } });
    const actions = card.createDiv({ cls: "mind-trace-weekly-card-actions" });
    const action = (label, handler, primary = false) => {
      const button = actions.createEl("button", { cls: primary ? "mod-cta" : "", text: label, attr: { type: "button" } });
      button.addEventListener("click", handler);
      return button;
    };
    const isReady = state?.kind === "ready" || state?.kind === "stale";
    if (!isReady) {
      body.classList.add("is-state");
    }
    if (state === null || state.kind === "loading") {
      const status = body.createDiv({ cls: "mind-trace-report-status mind-trace-llm-inline-status", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
      if (this.weeklyReportProgress !== null) {
        status.createSpan({ cls: "mind-trace-llm-status-primary", text: `${this.weeklyReportProgress.stage}/${this.weeklyReportProgress.total} · ${this.weeklyReportProgress.title}` });
        status.createSpan({ cls: "mind-trace-llm-status-detail", text: this.weeklyReportProgress.detail });
      } else {
        attachLlmActivityStatus(status, this.plugin, "正在检查上一周的记录与周报…");
      }
      return;
    }
    if (state.kind === "ready" || state.kind === "stale") {
      if (state.kind === "stale") {
        header.createSpan({ cls: "mind-trace-report-badge", text: "日记有更新" });
      }
      const summary = typeof state.summary === "string" ? state.summary : "";
      if (summary.length < 90) {
        card.classList.add("is-copy-roomy");
      } else if (summary.length > 180) {
        card.classList.add("is-copy-compact");
      }
      body.createEl("p", { text: summary });
      const stats = state.source?.stats ?? {};
      const facts = body.createDiv({ cls: "mind-trace-home-support-facts" });
      facts.createSpan({ text: `记录日 ${Number(stats.days) || 0} 天` });
      facts.createSpan({ text: `${Number(stats.sessions) || 0} 篇日记` });
      facts.createSpan({ text: state.kind === "stale" ? "待更新" : "已同步" });
      action("打开完整周报", () => void this.openWeeklyReportFile(state.file.path), true);
      if (state.kind === "stale") {
        action("更新周报", () => {
          this.retryWeeklyReport(true);
        });
      }
      return;
    }
    if (state.kind === "insufficient") {
      body.createDiv({ cls: "mind-trace-report-status-title", text: "这周的线索还不够" });
      body.createEl("p", { text: `已有 ${state.source.stats.days} 个记录日，达到 ${state.minimum} 天后才会调用模型。` });
      return;
    }
    if (state.kind === "unconfigured") {
      body.createDiv({ cls: "mind-trace-report-status-title", text: "配置模型后即可生成周报" });
      body.createEl("p", { text: "周报沿用当前日记模型与表达偏好。" });
      action("打开设置", () => this.plugin.openSettings(), true);
      return;
    }
    if (state.kind === "missing") {
      body.createDiv({ cls: "mind-trace-report-status-title", text: "上一周可以开始回顾了" });
      body.createEl("p", {
        text: this.plugin.settings.weeklyReportAutoGenerate === false ? "自动生成已关闭；点击后才会向当前模型发送周内日记摘要。" : "本次会话已经尝试过自动生成；你可以在这里手动重试。"
      });
      action("生成周报", () => this.retryWeeklyReport(false), true);
      return;
    }
    body.createDiv({ cls: "mind-trace-report-status-title", text: "周报暂时没有生成" });
    body.createEl("p", { text: state.message });
    action("重试生成", () => this.retryWeeklyReport(false), true);
    action("打开设置", () => this.plugin.openSettings());
  }
  refreshWeeklyReportCard() {
    if ((this.mode !== "home" && this.mode !== "reports") || this.weeklyReportCardEl === null || !this.weeklyReportCardEl.isConnected) {
      return;
    }
    this.renderWeeklyReportCard(this.weeklyReportCardEl.parentElement, this.weeklyReportCardEl);
  }
  renderMonthlyReportCard(container, existing = null) {
    const state = this.monthlyReportState;
    const period = state?.period ?? completedPeriod("monthly");
    const card = existing ?? container.createEl("section", { cls: "mind-trace-weekly-card mind-trace-monthly-card" });
    card.empty();
    this.monthlyReportCardEl = card;
    const header = card.createDiv({ cls: "mind-trace-lead-card-header" });
    const title = header.createDiv();
    title.createDiv({ cls: "mind-trace-home-section-title", text: "上一月回顾", attr: { role: "heading", "aria-level": "2" } });
    title.createSpan({ cls: "mind-trace-period-label", text: periodLabel(period) });
    const body = card.createDiv({ cls: "mind-trace-weekly-card-body", attr: { "aria-live": "polite", "aria-busy": this.monthlyReportLoading ? "true" : "false" } });
    const actions = card.createDiv({ cls: "mind-trace-weekly-card-actions" });
    const action = (label, handler, primary = false) => {
      const button = actions.createEl("button", { cls: primary ? "mod-cta" : "", text: label, attr: { type: "button" } });
      button.addEventListener("click", handler);
      return button;
    };
    if (state === null || state.kind === "loading") {
      const status = body.createDiv({ cls: "mind-trace-report-status mind-trace-llm-inline-status", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
      if (this.monthlyReportProgress !== null) {
        status.createSpan({ cls: "mind-trace-llm-status-primary", text: `${this.monthlyReportProgress.stage}/${this.monthlyReportProgress.total} · ${this.monthlyReportProgress.title}` });
        status.createSpan({ cls: "mind-trace-llm-status-detail", text: this.monthlyReportProgress.detail });
      } else {
        attachLlmActivityStatus(status, this.plugin, "正在检查上一月的记录与月报…");
      }
      return;
    }
    if (state.kind === "ready" || state.kind === "stale") {
      if (state.kind === "stale") header.createSpan({ cls: "mind-trace-report-badge", text: "日记有更新" });
      body.createEl("p", { text: state.summary });
      action("打开完整月报", () => void this.openWeeklyReportFile(state.file.path), true);
      if (state.kind === "stale") action("更新月报", () => this.retryMonthlyReport(true));
      return;
    }
    if (state.kind === "insufficient") {
      body.createDiv({ cls: "mind-trace-report-status-title", text: "这个月的线索还不够" });
      body.createEl("p", { text: `已有 ${state.source.stats.activeWeeks} 个活跃自然周，达到 ${state.minimum} 周后才会调用模型。` });
      return;
    }
    if (state.kind === "unconfigured") {
      body.createDiv({ cls: "mind-trace-report-status-title", text: "配置模型后即可生成月报" });
      body.createEl("p", { text: "月报沿用当前日记模型与表达偏好。" });
      action("打开设置", () => this.plugin.openSettings(), true);
      return;
    }
    if (state.kind === "missing") {
      body.createDiv({ cls: "mind-trace-report-status-title", text: "上一月可以开始回顾了" });
      body.createEl("p", { text: this.plugin.settings.monthlyReportAutoGenerate === false ? "自动生成已关闭；点击后才会向当前模型发送月内日记摘要。" : "本次会话已经尝试过自动生成；你可以在这里手动重试。" });
      action("生成月报", () => this.retryMonthlyReport(false), true);
      return;
    }
    body.createDiv({ cls: "mind-trace-report-status-title", text: "月报暂时没有生成" });
    body.createEl("p", { text: state.message });
    action("重试生成", () => this.retryMonthlyReport(false), true);
    action("打开设置", () => this.plugin.openSettings());
  }
  refreshMonthlyReportCard() {
    if ((this.mode !== "home" && this.mode !== "reports") || this.monthlyReportCardEl === null || !this.monthlyReportCardEl.isConnected) {
      return;
    }
    this.renderMonthlyReportCard(this.monthlyReportCardEl.parentElement, this.monthlyReportCardEl);
  }
  renderHistoryCenter(container) {
    const section = container.createEl("section", {
      cls: "mind-trace-home-section mind-trace-history-center",
      attr: { "aria-labelledby": "mind-trace-history-title" }
    });
    this.historySectionEl = section;
    this.renderHistoryContent();
  }
  async loadAndRenderHistory() {
    if (this.historyLoading || (this.mode !== "home" && this.mode !== "trajectory") || !this.plugin.isPrivacyUnlocked()) {
      return;
    }
    if (this.historySnapshot !== null) {
      if (this.mode === "trajectory" && this.trajectoryView === "events" && this.trajectoryEventPanelEl !== null && this.trajectoryEventPanelEl.isConnected) {
        this.renderTrajectoryEvents(this.trajectoryEventPanelEl);
      }
      return;
    }
    const token = ++this.historyLoadToken;
    this.historyLoading = true;
    this.historyError = "";
    this.historyProgress = { done: 0, total: 0 };
    this.renderHistoryContent();
    try {
      const snapshot = await this.plugin.historyIndex.load((progress) => {
        if (token !== this.historyLoadToken || this.historySectionEl === null || !this.historySectionEl.isConnected) {
          return;
        }
        this.historyProgress = progress;
        if (this.historyProgressEl !== null && this.historyProgressEl.isConnected) {
          this.historyProgressEl.textContent = progress.total > 0 ? `正在整理历史记录 ${progress.done}/${progress.total}…` : "正在整理你的历史记录…";
        }
      });
      if (token !== this.historyLoadToken || (this.mode !== "home" && this.mode !== "trajectory") || !this.plugin.isPrivacyUnlocked()) {
        return;
      }
      this.historySnapshot = snapshot;
    } catch (error) {
      if (token === this.historyLoadToken) {
        this.historyError = errorMessage(error);
      }
    } finally {
      if (token === this.historyLoadToken) {
        this.historyLoading = false;
        this.renderHistoryContent();
        if (this.mode === "trajectory" && this.trajectoryView === "events" && this.trajectoryEventPanelEl !== null && this.trajectoryEventPanelEl.isConnected) {
          this.renderTrajectoryEvents(this.trajectoryEventPanelEl);
        }
      }
    }
  }
  renderHistoryContent(focusSearch = false, alignHistory = false) {
    const section = this.historySectionEl;
    if (section === null || !section.isConnected) {
      return;
    }
    section.empty();
    this.historyProgressEl = null;
    const heading = section.createDiv({ cls: "mind-trace-history-heading" });
    const headingCopy = heading.createDiv();
    headingCopy.createDiv({
      cls: "mind-trace-home-section-title",
      text: "历史与回望",
      attr: { id: "mind-trace-history-title", role: "heading", "aria-level": "2" }
    });
    headingCopy.createEl("p", { text: "在正文、事件、实体、主题、问答和反思中找回过去的线索。全部检索只在本地进行。" });
    if (this.historyLoading && this.historySnapshot === null) {
      const progressText = this.historyProgress.total > 0 ? `正在整理历史记录 ${this.historyProgress.done}/${this.historyProgress.total}…` : "正在整理你的历史记录…";
      this.historyProgressEl = section.createDiv({ cls: "mind-trace-history-loading", text: progressText, attr: { role: "status" } });
      return;
    }
    if (this.historyError.length > 0) {
      const error = section.createDiv({ cls: "mind-trace-history-empty", attr: { role: "alert" } });
      error.createDiv({ cls: "mind-trace-empty-title", text: "历史记录暂时无法整理" });
      error.createEl("p", { text: this.historyError });
      const retry = error.createEl("button", { text: "重试", attr: { type: "button" } });
      retry.addEventListener("click", () => void this.loadAndRenderHistory());
      return;
    }
    const snapshot = this.historySnapshot;
    if (snapshot === null) {
      section.createDiv({ cls: "mind-trace-history-loading", text: "正在准备历史索引…", attr: { role: "status" } });
      return;
    }
    if (snapshot.entries.length === 0) {
      const empty = section.createDiv({ cls: "mind-trace-empty-state mind-trace-home-empty" });
      empty.createDiv({ cls: "mind-trace-empty-mark", text: "第一篇" });
      empty.createDiv({ cls: "mind-trace-empty-title", text: "从第一篇心迹日记开始" });
      empty.createEl("p", { text: "写完之后，这里会慢慢长出可以翻找和重新遇见的轨迹。" });
      const button = empty.createEl("button", { cls: "mod-cta", text: "开始记录", attr: { type: "button" } });
      button.addEventListener("click", () => this.startWizard());
      return;
    }
    if (!historyQueryIsActive(this.historyQuery)) {
      this.renderHistoryDiscoveries(section, snapshot.entries);
    }
    this.renderHistoryControls(section, snapshot);
    this.renderHistoryResults(section, snapshot);
    if (focusSearch || alignHistory) {
      this.ownerWindow.requestAnimationFrame(() => {
        const input = section.querySelector(".mind-trace-history-search-input");
        if (input instanceof this.ownerWindow.HTMLInputElement) {
          if (focusSearch) {
            input.focus({ preventScroll: true });
          }
          input.setSelectionRange(input.value.length, input.value.length);
        }
        if (alignHistory) {
          section.scrollIntoView({ behavior: "auto", block: "start" });
        }
      });
    }
  }
  renderHistoryDiscoveries(section, entries) {
    const discoveries = rediscoverHistorySessions(entries);
    if (discoveries.length === 0) {
      return;
    }
    const wrap = section.createDiv({ cls: "mind-trace-history-discoveries" });
    const label = wrap.createDiv({ cls: "mind-trace-history-discovery-label" });
    label.createSpan({ text: "今日回望" });
    label.createEl("small", { text: "从日期、主题和状态中找回几个旧坐标" });
    const grid = wrap.createDiv({ cls: "mind-trace-history-discovery-grid" });
    for (const discovery of discoveries) {
      const card = grid.createEl("button", {
        cls: `mind-trace-history-discovery-card is-${discovery.kind}`,
        attr: { type: "button", "aria-label": `打开 ${discovery.entry.date} ${discovery.entry.time} 的记录` }
      });
      const cardHeading = card.createDiv({ cls: "mind-trace-history-discovery-card-heading" });
      cardHeading.createSpan({ text: discovery.label });
      cardHeading.createEl("time", { text: discovery.entry.date.slice(0, 7).replace("-", "."), attr: { datetime: discovery.entry.date } });
      card.createDiv({ cls: "mind-trace-history-discovery-reason", text: discovery.reason });
      card.createEl("p", { text: historyExcerpt(discovery.entry.diary, [], 88) });
      card.addEventListener("click", () => void this.openJournalFile(discovery.entry.filePath, discovery.entry.sessionIndex));
    }
  }
  renderHistoryControls(section, snapshot) {
    const controls = section.createDiv({ cls: "mind-trace-history-controls" });
    const searchRow = controls.createDiv({ cls: "mind-trace-history-search-row" });
    const searchWrap = searchRow.createDiv({ cls: "mind-trace-history-search" });
    (0, import_obsidian4.setIcon)(searchWrap.createSpan({ cls: "mind-trace-history-search-icon", attr: { "aria-hidden": "true" } }), "search");
    const search = searchWrap.createEl("input", {
      cls: "mind-trace-history-search-input",
      attr: {
        type: "search",
        placeholder: "搜索正文、事件、实体、主题、问题、行动…",
        "aria-label": "搜索历史记录"
      }
    });
    search.value = this.historyQuery.text;
    search.addEventListener("input", () => {
      const wasEmpty = historySearchTokens(this.historyQuery.text).length === 0;
      this.historyQuery.text = search.value;
      const isEmpty = historySearchTokens(this.historyQuery.text).length === 0;
      if (wasEmpty && !isEmpty) {
        this.historyQuery.sort = "relevance";
      } else if (isEmpty) {
        this.historyQuery.sort = "latest";
      }
      this.historyVisibleCount = 30;
      if (this.historySearchTimer !== null) {
        this.ownerWindow.clearTimeout(this.historySearchTimer);
      }
      this.historySearchTimer = this.ownerWindow.setTimeout(() => {
        this.historySearchTimer = null;
        this.renderHistoryContent(true, true);
      }, 200);
    });
    const sort = searchRow.createEl("select", { cls: "mind-trace-history-sort", attr: { "aria-label": "历史结果排序" } });
    sort.createEl("option", { text: "最新优先", value: "latest" });
    sort.createEl("option", { text: "相关度优先", value: "relevance" });
    sort.value = this.historyQuery.sort;
    sort.disabled = historySearchTokens(this.historyQuery.text).length === 0;
    sort.addEventListener("change", () => {
      this.historyQuery.sort = sort.value === "relevance" ? "relevance" : "latest";
      this.historyVisibleCount = 30;
      this.renderHistoryContent();
    });
    const filters = controls.createEl("details", { cls: "mind-trace-history-filters" });
    const filterSummary = filters.createEl("summary");
    filterSummary.createSpan({ text: "筛选历史" });
    const activeCount = this.historyFilterCount();
    if (activeCount > 0) {
      filterSummary.createSpan({ cls: "mind-trace-history-filter-count", text: String(activeCount) });
      filters.open = true;
    }
    const filterBody = filters.createDiv({ cls: "mind-trace-history-filter-body" });
    this.renderHistoryDateFilter(filterBody);
    this.renderHistoryValueFilter(filterBody, "主题", snapshot.themes, this.historyQuery.themes);
    this.renderHistoryValueFilter(filterBody, "切片类别", snapshot.facets, this.historyQuery.facets);
    this.renderHistoryRatingFilters(filterBody);
    this.renderHistoryActiveFilters(controls);
  }
  renderHistoryDateFilter(container) {
    const group = container.createDiv({ cls: "mind-trace-history-filter-group" });
    group.createEl("label", { text: "日期" });
    const select = group.createEl("select", { attr: { "aria-label": "日期范围" } });
    for (const [value, label] of [["all", "全部时间"], ["7", "最近 7 天"], ["30", "最近 30 天"], ["90", "最近 90 天"], ["year", "本年"], ["custom", "自定义"]]) {
      select.createEl("option", { value, text: label });
    }
    select.value = this.historyQuery.datePreset;
    select.addEventListener("change", () => {
      this.historyQuery.datePreset = select.value;
      this.historyVisibleCount = 30;
      this.renderHistoryContent();
    });
    if (this.historyQuery.datePreset === "custom") {
      const dates = group.createDiv({ cls: "mind-trace-history-date-range" });
      for (const [key, label] of [["dateStart", "开始日期"], ["dateEnd", "结束日期"]]) {
        const input = dates.createEl("input", { attr: { type: "date", "aria-label": label, max: localDateString(new Date()) } });
        input.value = this.historyQuery[key];
        input.addEventListener("change", () => {
          this.historyQuery[key] = input.value;
          if (this.historyQuery.dateStart.length > 0 && this.historyQuery.dateEnd.length > 0 && this.historyQuery.dateStart > this.historyQuery.dateEnd) {
            if (key === "dateStart") {
              this.historyQuery.dateEnd = input.value;
            } else {
              this.historyQuery.dateStart = input.value;
            }
          }
          this.historyVisibleCount = 30;
          this.renderHistoryContent();
        });
      }
    }
  }
  renderHistoryValueFilter(container, label, values, selected) {
    const group = container.createDiv({ cls: "mind-trace-history-filter-group" });
    group.createEl("label", { text: label });
    const select = group.createEl("select", { attr: { "aria-label": `添加${label}筛选` } });
    select.createEl("option", { value: "", text: `添加${label}…` });
    for (const value of values) {
      if (!selected.has(value)) {
        select.createEl("option", { value, text: value });
      }
    }
    select.addEventListener("change", () => {
      if (select.value.length > 0) {
        selected.add(select.value);
        this.historyVisibleCount = 30;
        this.renderHistoryContent();
      }
    });
    if (selected.size > 0) {
      const selectedValues = group.createDiv({ cls: "mind-trace-history-selected-values" });
      for (const value of selected) {
        const chip = selectedValues.createEl("button", { text: value, attr: { type: "button", "aria-label": `移除${label}筛选 ${value}` } });
        (0, import_obsidian4.setIcon)(chip.createSpan({ cls: "mind-trace-chip-remove-icon", attr: { "aria-hidden": "true" } }), "x");
        chip.addEventListener("click", () => {
          selected.delete(value);
          this.historyVisibleCount = 30;
          this.renderHistoryContent();
        });
      }
    }
  }
  renderHistoryRatingFilters(container) {
    const group = container.createDiv({ cls: "mind-trace-history-filter-group mind-trace-history-rating-filters" });
    group.createEl("label", { text: "状态范围" });
    for (const [key, label] of [["mood", "心情"], ["energy", "精力"], ["stress", "压力"]]) {
      const row = group.createDiv({ cls: `mind-trace-history-rating-range is-${key}` });
      row.createSpan({ text: label });
      for (const bound of ["min", "max"]) {
        const select = row.createEl("select", { attr: { "aria-label": `${label}${bound === "min" ? "最低" : "最高"}` } });
        for (let score = 1; score <= 5; score += 1) {
          select.createEl("option", { value: String(score), text: String(score) });
        }
        select.value = String(this.historyQuery.ratings[key][bound]);
        select.addEventListener("change", () => {
          const value = Number(select.value);
          this.historyQuery.ratings[key][bound] = value;
          if (bound === "min" && value > this.historyQuery.ratings[key].max) {
            this.historyQuery.ratings[key].max = value;
          }
          if (bound === "max" && value < this.historyQuery.ratings[key].min) {
            this.historyQuery.ratings[key].min = value;
          }
          this.historyVisibleCount = 30;
          this.renderHistoryContent();
        });
        if (bound === "min") {
          row.createSpan({ cls: "mind-trace-history-rating-separator", text: "—" });
        }
      }
    }
  }
  historyFilterCount() {
    let count = this.historyQuery.datePreset === "all" ? 0 : 1;
    count += this.historyQuery.themes.size + this.historyQuery.facets.size;
    count += ["mood", "energy", "stress"].filter((key) => this.historyQuery.ratings[key].min !== 1 || this.historyQuery.ratings[key].max !== 5).length;
    return count;
  }
  renderHistoryActiveFilters(container) {
    if (!historyQueryIsActive(this.historyQuery)) {
      return;
    }
    const row = container.createDiv({ cls: "mind-trace-history-active-filters" });
    const chips = row.createDiv({ cls: "mind-trace-history-active-filter-chips" });
    const addChip = (label, onRemove) => {
      const chip = chips.createEl("button", { cls: "mind-trace-history-active-filter-chip", text: label, attr: { type: "button", "aria-label": `移除筛选 ${label}` } });
      (0, import_obsidian4.setIcon)(chip.createSpan({ cls: "mind-trace-chip-remove-icon", attr: { "aria-hidden": "true" } }), "x");
      chip.addEventListener("click", () => {
        onRemove();
        this.historyVisibleCount = 30;
        this.renderHistoryContent();
      });
    };
    if (historySearchTokens(this.historyQuery.text).length > 0) {
      addChip(`关键词：${this.historyQuery.text.trim()}`, () => {
        this.historyQuery.text = "";
        this.historyQuery.sort = "latest";
      });
    }
    if (this.historyQuery.datePreset !== "all") {
      const dateLabels = { "7": "最近 7 天", "30": "最近 30 天", "90": "最近 90 天", year: "本年", custom: "自定义日期" };
      addChip(dateLabels[this.historyQuery.datePreset] ?? "日期", () => {
        this.historyQuery.datePreset = "all";
        this.historyQuery.dateStart = "";
        this.historyQuery.dateEnd = "";
      });
    }
    for (const theme of this.historyQuery.themes) {
      addChip(`主题：${theme}`, () => this.historyQuery.themes.delete(theme));
    }
    for (const facet of this.historyQuery.facets) {
      addChip(`切片：${facet}`, () => this.historyQuery.facets.delete(facet));
    }
    for (const [key, label] of [["mood", "心情"], ["energy", "精力"], ["stress", "压力"]]) {
      const range = this.historyQuery.ratings[key];
      if (range.min !== 1 || range.max !== 5) {
        addChip(`${label} ${range.min}–${range.max}`, () => {
          range.min = 1;
          range.max = 5;
        });
      }
    }
    const clear = row.createEl("button", { text: "全部清除", attr: { type: "button" } });
    clear.addEventListener("click", () => {
      this.historyQuery = createHistoryQuery();
      this.historyVisibleCount = 30;
      this.renderHistoryContent(true, true);
    });
  }
  renderHistoryResults(section, snapshot) {
    const results = queryHistorySessions(snapshot.entries, this.historyQuery);
    const head = section.createDiv({ cls: "mind-trace-history-results-heading", attr: { "aria-live": "polite" } });
    head.createSpan({ text: `${results.length} 次记录` });
    if (snapshot.ignoredFiles > 0) {
      head.createEl("small", { text: `${snapshot.ignoredFiles} 篇格式异常已跳过` });
    }
    if (results.length === 0) {
      const empty = section.createDiv({ cls: "mind-trace-history-empty" });
      empty.createDiv({ cls: "mind-trace-empty-title", text: "没有找到匹配的记录" });
      empty.createEl("p", { text: "试试减少关键词，或清除一些筛选条件。" });
      return;
    }
    const list = section.createDiv({ cls: "mind-trace-history-results" });
    for (const result of results.slice(0, this.historyVisibleCount)) {
      this.renderHistoryResult(list, result);
    }
    if (results.length > this.historyVisibleCount) {
      const more = section.createEl("button", { cls: "mind-trace-history-load-more", text: `再显示 ${Math.min(30, results.length - this.historyVisibleCount)} 条`, attr: { type: "button" } });
      more.addEventListener("click", () => {
        this.historyVisibleCount += 30;
        this.renderHistoryContent();
      });
    }
  }
  renderHistoryResult(container, result) {
    const { entry } = result;
    const card = container.createEl("article", { cls: "mind-trace-history-result" });
    const open = card.createEl("button", {
      cls: "mind-trace-history-result-open",
      attr: { type: "button", "aria-label": `打开 ${entry.date} ${entry.time} 的记录` }
    });
    const top = open.createDiv({ cls: "mind-trace-history-result-top" });
    const date = top.createDiv({ cls: "mind-trace-history-result-date" });
    date.createEl("time", { text: entry.date, attr: { datetime: entry.date } });
    date.createSpan({ text: `${weekdayText(entry.date)} · ${entry.time}` });
    const scores = top.createDiv({ cls: "mind-trace-home-scores" });
    for (const [key, label] of [["mood", "心"], ["energy", "精"], ["stress", "压"]]) {
      const score = scores.createSpan({ cls: `mind-trace-home-score mind-trace-home-score-${key}` });
      score.createSpan({ cls: "mind-trace-home-score-label", text: label });
      score.createSpan({ cls: "mind-trace-home-score-value", text: String(entry[key]) });
    }
    open.createSpan({ cls: "mind-trace-history-match-label", text: result.matchLabel });
    const excerpt = open.createEl("p", { cls: "mind-trace-history-result-excerpt" });
    this.appendHistoryHighlight(excerpt, result.excerpt, result.tokens);
    (0, import_obsidian4.setIcon)(open.createSpan({ cls: "mind-trace-history-result-arrow", attr: { "aria-hidden": "true" } }), "arrow-right");
    open.addEventListener("click", () => void this.openJournalFile(entry.filePath, entry.sessionIndex));
    if (entry.themes.length > 0) {
      const themes = card.createDiv({ cls: "mind-trace-history-result-themes", attr: { "aria-label": "记录主题" } });
      for (const theme of entry.themes.slice(0, 5)) {
        const chip = themes.createEl("button", { cls: "mind-trace-home-chip", text: theme, attr: { type: "button", "aria-label": `查看主题“${theme}”的历史` } });
        chip.addEventListener("click", () => this.selectHistoryTheme(theme));
      }
    }
  }
  appendHistoryHighlight(container, text, tokens) {
    if (tokens.length === 0 || text.length === 0) {
      container.appendText(text);
      return;
    }
    const normalized = normalizeHistoryText(text);
    const ranges = [];
    for (const token of tokens) {
      let offset = 0;
      while (offset < normalized.length) {
        const index = normalized.indexOf(token, offset);
        if (index === -1) {
          break;
        }
        ranges.push([index, index + token.length]);
        offset = index + Math.max(1, token.length);
      }
    }
    ranges.sort((left, right) => left[0] - right[0]);
    const merged = [];
    for (const range of ranges) {
      const previous = merged[merged.length - 1];
      if (previous !== void 0 && range[0] <= previous[1]) {
        previous[1] = Math.max(previous[1], range[1]);
      } else {
        merged.push([...range]);
      }
    }
    let cursor = 0;
    for (const [start, end] of merged) {
      container.appendText(text.slice(cursor, start));
      container.createEl("mark", { text: text.slice(start, end) });
      cursor = end;
    }
    container.appendText(text.slice(cursor));
  }
  selectHistoryTheme(theme) {
    this.historyQuery.themes.add(theme);
    this.historyVisibleCount = 30;
    this.renderHistoryContent();
    this.ownerWindow.requestAnimationFrame(() => {
      const reducedMotion = this.ownerWindow.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const section = this.historySectionEl;
      const input = section?.querySelector(".mind-trace-history-search-input");
      if (input instanceof this.ownerWindow.HTMLInputElement) {
        input.focus({ preventScroll: true });
      }
      section?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  }
  renderHomeList(container) {
    const section = container.createDiv({ cls: "mind-trace-home-section" });
    section.createDiv({
      cls: "mind-trace-home-section-title",
      text: "日记",
      attr: { role: "heading", "aria-level": "2" }
    });
    const entries = [...collectMetrics(this.app).entries].reverse();
    if (entries.length === 0) {
      const empty = section.createDiv({
        cls: "mind-trace-empty-state mind-trace-home-empty"
      });
      empty.createDiv({ cls: "mind-trace-empty-mark", text: "第一篇" });
      empty.createDiv({
        cls: "mind-trace-empty-title",
        text: "从第一篇心迹日记开始",
        attr: { role: "heading", "aria-level": "2" }
      });
      empty.createEl("p", {
        text: "两三分钟的引导对话，就能把今天收好。写完之后，这里会长出一条属于你的心迹线。"
      });
      const button = empty.createEl("button", {
        cls: "mod-cta",
        text: "开始记录",
        attr: { type: "button" }
      });
      button.addEventListener("click", () => {
        this.startWizard();
      });
      return;
    }
    let monthKey = "";
    let rows = null;
    for (const entry of entries) {
      const entryMonth = entry.date.slice(0, 7);
      if (entryMonth !== monthKey) {
        monthKey = entryMonth;
        const group = section.createDiv({ cls: "mind-trace-home-month" });
        group.createDiv({
          cls: "mind-trace-home-month-label",
          text: monthLabelText(entry.date),
          attr: { role: "heading", "aria-level": "3" }
        });
        rows = group.createDiv({ cls: "mind-trace-home-rows" });
      }
      this.renderHomeRow(rows, entry);
    }
  }
  renderHomeRow(rows, entry) {
    const row = rows.createDiv({
      cls: "mind-trace-home-row",
      attr: {
        role: "button",
        tabindex: "0",
        "aria-label": `打开 ${entry.date} 的日记`
      }
    });
    const rail = row.createDiv({
      cls: "mind-trace-home-rail",
      attr: { "aria-hidden": "true" }
    });
    const heatLevel = Math.max(1, Math.min(4, Math.round(entry.mood) - 1));
    rail.createSpan({
      cls: `mind-trace-home-dot mind-trace-heat-${heatLevel}`
    });
    const main = row.createDiv({ cls: "mind-trace-home-row-main" });
    const date = main.createSpan({ cls: "mind-trace-home-date" });
    date.createSpan({ cls: "mind-trace-home-date-day", text: entry.date.slice(5) });
    date.createSpan({ cls: "mind-trace-home-date-week", text: weekdayText(entry.date) });
    const scores = main.createSpan({ cls: "mind-trace-home-scores" });
    for (const [key, label] of [["mood", "心"], ["energy", "精"], ["stress", "压"]]) {
      const score = scores.createSpan({
        cls: `mind-trace-home-score mind-trace-home-score-${key}`
      });
      score.createSpan({ cls: "mind-trace-home-score-label", text: label });
      score.createSpan({ cls: "mind-trace-home-score-value", text: entry[key].toFixed(1) });
    }
    if (entry.themes.length > 0) {
      const themes = main.createSpan({ cls: "mind-trace-home-themes" });
      for (const theme of entry.themes.slice(0, 3)) {
        themes.createSpan({ cls: "mind-trace-home-chip", text: theme });
      }
      if (entry.themes.length > 3) {
        themes.createSpan({
          cls: "mind-trace-home-chip is-more",
          text: `+${entry.themes.length - 3} 个`,
          attr: {
            title: entry.themes.join("、"),
            "aria-label": `还有 ${entry.themes.length - 3} 个主题：${entry.themes.slice(3).join("、")}`
          }
        });
      }
    }
    main.createSpan({
      cls: "mind-trace-home-sessions",
      text: `${entry.sessions} 篇`
    });
    (0, import_obsidian4.setIcon)(main.createSpan({ cls: "mind-trace-home-row-arrow", attr: { "aria-hidden": "true" } }), "arrow-right");
    const open = () => {
      void this.openJournalFile(entry.filePath);
    };
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  }
  async collectObservationReports() {
    const weekly = collectWeeklyReportFiles(this.app).map((item) => ({ ...item, type: "weekly" }));
    const monthly = collectMonthlyReportFiles(this.app).map((item) => ({ ...item, type: "monthly" }));
    const candidates = [...weekly, ...monthly].sort((left, right) => right.end.localeCompare(left.end) || right.start.localeCompare(left.start) || (right.type === "monthly" ? 1 : -1));
    const reports = [];
    for (const item of candidates) {
      try {
        const content = await this.app.vault.cachedRead(item.file);
        const frontmatter = parseFrontmatter(content, "心迹报告");
        const report = parseSavedReport(content, frontmatter);
        reports.push({
          type: item.type,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          periodStatus: report.periodStatus === "partial" ? "partial" : "complete",
          generatedAt: report.generatedAt,
          modifiedAt: item.file.stat.mtime,
          filePath: item.file.path,
          report
        });
      } catch {
      }
    }
    if (candidates.length > 0 && reports.length === 0) {
      throw new Error(`找到 ${candidates.length} 份候选报告，但全部无法解析；请先修复报告格式后重试。`);
    }
    const deduped = dedupeObservationReports(reports);
    const counts = { weekly: 0, monthly: 0 };
    return deduped.filter((item) => {
      const limit = item.type === "monthly" ? 3 : 8;
      if (counts[item.type] >= limit) return false;
      counts[item.type] += 1;
      return true;
    });
  }
  async loadObservationReports() {
    if (this.observationLoading || this.observationReports !== null) {
      return;
    }
    const token = ++this.observationLoadToken;
    this.observationLoading = true;
    this.observationError = "";
    this.render(true);
    try {
      const [reports, observations] = await Promise.all([this.collectObservationReports(), this.plugin.observationRepository.list()]);
      this.observationReports = reports;
      this.observationFiles = observations;
      if (this.observationSelectedPath.length === 0 || !observations.some((item) => item.file.path === this.observationSelectedPath && item.snapshot !== null)) {
        this.observationSelectedPath = observations.find((item) => item.snapshot !== null)?.file.path ?? "";
      }
    } catch (error) {
      this.observationReports = [];
      this.observationError = errorMessage(error);
    } finally {
      this.observationLoading = false;
      if (token === this.observationLoadToken && (this.mode === "home" || this.mode === "observation") && this.leaf.view === this) {
        this.render(true);
      }
    }
  }
  renderObservationStatus(container, kind) {
    const status = container.createDiv({ cls: "mind-trace-observation-state", attr: { role: kind === "error" ? "alert" : "status", "aria-live": "polite" } });
    const mark = kind === "loading" ? "读取" : kind === "error" ? "重试" : kind === "unconfigured" ? "连接" : "等待";
    const title = kind === "loading" ? "正在读取可解析的回顾" : kind === "error" ? "观照来源暂时无法读取" : kind === "unconfigured" ? "先选择一个模型服务" : kind === "missing" ? "还没有可用的回顾" : "还没有这次观照";
    const body = kind === "loading" ? "将整理最近 8 份周报与 3 份月报中的报告字段、结构化事件摘要和短证据片段，不读取完整历史日记。" : kind === "error" ? this.observationError || "读取回顾时遇到问题。" : kind === "unconfigured" ? "配置模型名称和 API Key 后，才能生成新的观照；已有观照仍可继续查看。" : kind === "missing" ? "至少需要 1 份能成功解析且包含结构化事件的周报或月报。先生成一份回顾，再回来观照。" : "从最近的周报与月报开始，整理一张可验证的变化描线。";
    status.createDiv({ cls: "mind-trace-observation-state-mark", text: mark, attr: { "aria-hidden": "true" } });
    status.createDiv({ cls: "mind-trace-observation-state-title", text: title, attr: { role: "heading", "aria-level": "2" } });
    status.createEl("p", { text: body });
    const actions = status.createDiv({ cls: "mind-trace-actions" });
    if (kind === "loading") {
      return;
    }
    if (kind === "missing") {
      const reports = actions.createEl("button", { cls: "mod-cta", text: "前往回顾", attr: { type: "button" } });
      reports.addEventListener("click", () => this.setMode("reports"));
      return;
    }
    if (kind === "unconfigured") {
      const setup = actions.createEl("button", { cls: "mod-cta", text: "打开设置", attr: { type: "button" } });
      setup.addEventListener("click", () => this.plugin.openSettings());
      return;
    }
    const retry = actions.createEl("button", { cls: "mod-cta", text: kind === "error" ? "重试读取" : "开始观照", attr: { type: "button" } });
    retry.addEventListener("click", () => {
      if (kind === "error") {
        this.observationReports = null;
        void this.loadObservationReports();
      } else {
        this.regenerateObservation(false);
      }
    });
  }
  observationSourceDescriptors(reports) {
    return reports.map((item) => ({ type: item.type, periodStart: item.periodStart, periodEnd: item.periodEnd, periodStatus: item.periodStatus === "partial" ? "partial" : "complete", filePath: item.filePath, generatedAt: item.generatedAt, modifiedAt: item.modifiedAt ?? 0 }));
  }
  observationGeneratedText(value) {
    return value ? weeklyGeneratedAtText(value) : "生成时间未记录";
  }
  currentObservationSnapshot() {
    const selected = this.observationFiles.find((item) => item.file.path === this.observationSelectedPath && item.snapshot !== null)?.snapshot;
    if (selected !== void 0) return selected;
    const latest = this.observationFiles.find((item) => item.snapshot !== null)?.snapshot;
    if (latest !== void 0) return latest;
    return normalizeSelfObservation(this.plugin.legacySelfObservation);
  }
  observationFeedback(key) {
    const feedback = this.currentObservationSnapshot()?.feedback?.[key];
    return feedback === void 0 ? { status: "pending", correction: "" } : { status: feedback.status, correction: feedback.correction ?? "" };
  }
  observationFeedbackLabel(status) {
    return status === "confirmed" ? "你已确认" : status === "rejected" ? "你已否认" : "待你验证";
  }
  openObservationFeedback(type, item) {
    const key = item.key || observationItemKey(type, item);
    const text = type === "claim" ? `${item.dimension}：${item.statement}` : type === "change" ? `${item.dimension}：${item.before} → ${item.now}` : type === "perspective" ? `${item.perspective}：${item.observation}` : type === "hypothesis" ? item.statement : `${item.label}：${item.observation}`;
    new ObservationFeedbackModal(this.app, this.plugin, { text }, this.observationFeedback(key), async (feedback) => {
      const current = this.currentObservationSnapshot();
      if (!current.filePath) throw new Error("当前观照不是可写的 Markdown 文件");
      const updated = await this.plugin.saveObservationFeedback(current.filePath, key, feedback);
      const entry = this.observationFiles.find((item) => item.file.path === current.filePath);
      if (entry !== void 0 && updated !== null) entry.snapshot = updated;
      this.render(true);
    }).open();
  }
  renderObservationFeedback(container, type, item, host = null) {
    const feedback = this.observationFeedback(item.key);
    const feedbackHost = host ?? container.parentElement;
    if (feedbackHost instanceof this.ownerWindow.HTMLElement) {
      feedbackHost.classList.add("has-observation-feedback", `is-feedback-${feedback.status}`);
    }
    const status = container.createSpan({ cls: `mind-trace-observation-feedback-status is-${feedback.status}`, text: this.observationFeedbackLabel(feedback.status) });
    if (feedback.correction.length > 0 && feedbackHost instanceof this.ownerWindow.HTMLElement) {
      feedbackHost.createDiv({ cls: "mind-trace-observation-correction", text: `你的修正：${feedback.correction}` });
    }
    const button = container.createEl("button", { cls: "mind-trace-observation-calibrate", text: "校准", attr: { type: "button" } });
    button.addEventListener("click", () => this.openObservationFeedback(type, item));
  }
  renderObservationEvidenceDates(container, dates) {
    if (!Array.isArray(dates) || dates.length === 0) return;
    const evidence = container.createDiv({ cls: "mind-trace-observation-evidence", attr: { "aria-label": "证据日期" } });
    evidence.createSpan({ cls: "mind-trace-observation-evidence-label", text: "证据" });
    const entries = collectMetrics(this.app).entries;
    for (const date of dates.slice(-8)) {
      const match = entries.find((entry) => entry.date === date);
      if (match !== void 0) {
        const button = evidence.createEl("button", { text: date, attr: { type: "button", title: `打开 ${date} 的日记`, "aria-label": `打开 ${date} 的日记` } });
        button.addEventListener("click", () => void this.plugin.openJournalDate(date));
      } else {
        evidence.createEl("time", { text: date, attr: { datetime: date, title: "对应日记不可用" } });
      }
    }
  }
  renderObservationSourceDetails(container, sources) {
    const details = container.createEl("details", { cls: "mind-trace-observation-sources" });
    details.createEl("summary", { text: "来源与边界" });
    details.createEl("p", { text: "将发送报告字段、结构化事件摘要和短证据片段，不发送完整历史日记。重叠的周报与月报会按事件去重；依据充分度由本地计算，不等于真相概率。" });
    const list = details.createEl("ul");
    for (const source of sources) {
      const item = list.createEl("li");
      const statusLabel = source.periodStatus === "partial" ? "（周期尚未结束）" : "";
      const label = `${source.type === "monthly" ? "月报" : "周报"} ${source.periodStart} — ${source.periodEnd}${statusLabel}`;
      const file = this.app.vault.getAbstractFileByPath(source.filePath);
      if (file instanceof import_obsidian4.TFile) {
        const button = item.createEl("button", { cls: "mind-trace-observation-source-link", text: label, attr: { type: "button" } });
        button.addEventListener("click", () => void this.openWeeklyReportFile(source.filePath));
      } else {
        item.createSpan({ cls: "mind-trace-observation-source-link is-missing", text: `${label}（文件不可用）` });
      }
      item.createSpan({ cls: "mind-trace-observation-source-generated", text: ` · ${this.observationGeneratedText(source.generatedAt)}` });
    }
  }
  renderObservationGrowthTrace(shell, maturity) {
    const growth = shell.createEl("section", { cls: "mind-trace-observation-growth", attr: { "aria-labelledby": "mind-trace-observation-growth-title" } });
    growth.createDiv({ cls: "mind-trace-observation-section-title", text: "观照成长描线", attr: { id: "mind-trace-observation-growth-title", role: "heading", "aria-level": "2" } });
    growth.createEl("p", { cls: "mind-trace-observation-section-note", text: `客观累计：${maturity.eligibleReportCount} 份可解析回顾 · ${maturity.independentPeriodCount} 个互不重叠的完整周期 · ${maturity.allUniqueEvidenceDateCount} 个证据日期（高阶段计 ${maturity.uniqueEvidenceDateCount} 个）· 证据跨度 ${maturity.evidenceSpanDays} 天。` });
    const list = growth.createDiv({ cls: "mind-trace-observation-growth-list" });
    const stages = [
      { id: "initial", label: "初次观照", title: "摘要、初现线索与三种基础视角", copy: "摘要、初现线索、事实 / 情绪 / 行为视角、证据日期、自我问题和下一小步。" },
      { id: "cross_period", label: "跨周期观照", title: "跨周期变化与待验证假设", copy: "在互不重叠的完整周期之间描出变化，加入替代解释与可继续追问的问题。" },
      { id: "continuous", label: "持续观照", title: "持续变化与近期角色", copy: "在更长时间跨度上标出持续出现的变化与近期承担的生活角色线索，仍不定义身份。" }
    ];
    const rank = { initial: 0, cross_period: 1, continuous: 2 };
    const currentRank = rank[maturity.stage] ?? 0;
    for (const stage of stages) {
      const stageRank = rank[stage.id];
      const hasInitialEvidence = Number(maturity.eligibleReportCount) > 0;
      const unlocked = stage.id === "initial" ? hasInitialEvidence && stageRank <= currentRank : stageRank <= currentRank;
      const current = stage.id === "initial" ? hasInitialEvidence && stageRank === currentRank : stageRank === currentRank;
      const stateClass = current ? "is-current" : unlocked ? "is-complete" : "is-next";
      const card = list.createEl("article", { cls: `mind-trace-observation-growth-card ${unlocked ? "is-unlocked" : "is-locked"} ${stateClass}` });
      const top = card.createDiv({ cls: "mind-trace-observation-growth-top" });
      top.createSpan({ cls: "mind-trace-observation-growth-mark", text: unlocked ? (current ? "现在" : "已达") : "下一步", attr: { "aria-hidden": "true" } });
      top.createSpan({ cls: "mind-trace-observation-growth-label", text: stage.label });
      card.createDiv({ cls: "mind-trace-observation-growth-title", text: stage.title });
      card.createEl("p", { cls: "mind-trace-observation-growth-copy", text: stage.copy });
      let requirement = "已解锁";
      if (!unlocked) {
        if (stage.id === "cross_period") {
          const periods = Math.max(0, Number(maturity.remaining.crossPeriodPeriods) || 0);
          const evidenceDates = Math.max(0, Number(maturity.remaining.crossPeriodEvidenceDates) || 0);
          const conditions = [];
          if (periods > 0) conditions.push(`${periods} 个互不重叠的完整周期`);
          if (evidenceDates > 0) conditions.push(`${evidenceDates} 个选中来源证据日期`);
          requirement = `再积累 ${conditions.length > 0 ? conditions.join("与") : "所需的完整周期与证据日期"}即可解锁跨周期观照`;
        } else if (stage.id === "continuous") {
          const periods = Math.max(0, Number(maturity.remaining.continuousPeriods) || 0);
          const evidenceDates = Math.max(0, Number(maturity.remaining.continuousEvidenceDates) || 0);
          const spanDays = Math.max(0, Number(maturity.remaining.continuousSpanDays) || 0);
          const conditions = [];
          if (periods > 0) conditions.push(`${periods} 个完整周期`);
          if (evidenceDates > 0) conditions.push(`${evidenceDates} 个证据日期`);
          if (spanDays > 0) conditions.push(`${spanDays} 天跨度`);
          requirement = `再积累 ${conditions.length > 0 ? conditions.join("、") : "所需的完整周期、证据日期与时间跨度"}即可解锁持续观照`;
        } else {
          requirement = maturity.eligibleReportCount > 0 ? "继续保留可解析回顾即可解锁初次观照" : "再积累 1 份可解析回顾即可解锁初次观照";
        }
      } else if (stage.id === "cross_period") {
        requirement = "已满足：至少 2 个互不重叠的完整周期与 2 个选中来源证据日期";
      } else if (stage.id === "continuous") {
        requirement = maturity.stage === "continuous" ? "已满足：至少 4 个互不重叠的完整周期、4 个证据日期与 28 天跨度" : "已满足：持续观照条件";
      } else if (maturity.stage === "initial") {
        requirement = maturity.eligibleReportCount > 0 ? "已满足：至少 1 份可解析回顾（部分周期可以作为初次观照来源）" : "已满足：初次观照条件";
      }
      card.createDiv({ cls: "mind-trace-observation-growth-requirement", text: requirement });
    }
  }
  renderObservationFreshness(hero, snapshot, reports) {
    const paths = new Set(this.app.vault.getMarkdownFiles().map((file) => file.path));
    const freshness = deriveObservationFreshness(snapshot, reports, paths);
    if (!freshness.stale) return freshness;
    const notice = hero.createDiv({ cls: "mind-trace-observation-freshness", attr: { role: "status", "aria-live": "polite" } });
    notice.createDiv({ cls: "mind-trace-observation-freshness-title", text: freshness.hasNewEvidence ? "有新的依据" : "来源有变化" });
    notice.createEl("p", { text: freshness.reason || "观照来源发生了变化。已保存的观照仍可查看。" });
    const update = notice.createEl("button", { cls: "mod-cta", text: "手动更新观照", attr: { type: "button" } });
    update.disabled = !this.plugin.isProviderConfigured() || reports.length === 0;
    update.addEventListener("click", () => this.regenerateObservation(true));
    return freshness;
  }
  renderObservation(container) {
    const shell = container.createDiv({ cls: "mind-trace-page-shell mind-trace-observation-page" });
    const heading = shell.createDiv({ cls: "mind-trace-page-heading" });
    heading.createDiv({ cls: "mind-trace-eyebrow", text: "观照 · 不是定论" });
    heading.createDiv({ cls: "mind-trace-page-title", text: "最近的我，出现了哪些值得我自己验证的变化？", attr: { role: "heading", "aria-level": "1" } });
    heading.createEl("p", { text: "把近期回顾里的线索描出来，保留复杂性，也把最后的判断交还给你。" });
    if (this.observationLoading) {
      this.renderObservationStatus(shell, "loading");
      return;
    }
    if (this.observationReports === null) {
      this.renderObservationStatus(shell, "loading");
      if (!this.observationLoading) void this.loadObservationReports();
      return;
    }
    this.renderObservationHistory(shell);
    if (this.plugin.legacySelfObservation?.analysis !== null && !this.observationFiles.some((item) => item.snapshot?.legacy === true)) {
      const migration = shell.createDiv({ cls: "mind-trace-observation-freshness", attr: { role: "status" } });
      migration.createDiv({ cls: "mind-trace-observation-freshness-title", text: "旧观照尚未迁移" });
      migration.createEl("p", { text: "旧数据仍保留在 data.json；只有 Markdown 写入并重新验证成功后才会清除。" });
      const retry = migration.createEl("button", { text: "重试迁移", attr: { type: "button" } });
      retry.addEventListener("click", () => void this.plugin.migrateLegacyObservation());
    }
    const snapshot = this.currentObservationSnapshot();
    const maturity = snapshot.analysis !== null ? observationSnapshotMaturity(snapshot) : computeObservationMaturity(this.observationReports);
    if (this.observationReports.length === 0) {
      if (snapshot.analysis !== null) {
        this.renderObservationSnapshot(shell, snapshot, [], maturity);
      } else if (this.observationError.length > 0) {
        this.renderObservationStatus(shell, "error");
      } else {
        this.renderObservationStatus(shell, "missing");
      }
      return;
    }
    if (snapshot.analysis === null) {
      if (this.observationError.length > 0) {
        this.renderObservationStatus(shell, "error");
      } else if (!this.plugin.isProviderConfigured()) {
        this.renderObservationStatus(shell, "unconfigured");
      } else {
        this.renderObservationStatus(shell, "empty");
      }
      this.renderObservationGrowthTrace(shell, maturity);
      this.renderObservationSourceDetails(shell, this.observationSourceDescriptors(this.observationReports));
      return;
    }
    this.renderObservationSnapshot(shell, snapshot, this.observationReports, maturity);
  }
  renderObservationSnapshot(shell, snapshot, reports, maturity = observationSnapshotMaturity(snapshot)) {
    if (snapshot.analysis?.schemaVersion === 2) {
      this.renderObservationSnapshotV2(shell, snapshot, reports, maturity);
      return;
    }
    const sources = snapshot.sources.length > 0 ? snapshot.sources : this.observationSourceDescriptors(reports);
    const analysis = constrainObservationAnalysisForMaturity(snapshot.analysis, maturity);
    const hero = shell.createEl("section", { cls: "mind-trace-observation-hero" });
    const heroMeta = hero.createDiv({ cls: "mind-trace-observation-meta" });
    const starts = sources.map((source) => source.periodStart).filter(Boolean).sort();
    const ends = sources.map((source) => source.periodEnd).filter(Boolean).sort();
    heroMeta.createSpan({ text: starts.length > 0 && ends.length > 0 ? `${starts[0]} — ${ends[ends.length - 1]}` : "来源周期未记录" });
    heroMeta.createSpan({ text: `${sources.filter((source) => source.type === "weekly").length} 份周报 · ${sources.filter((source) => source.type === "monthly").length} 份月报` });
    heroMeta.createSpan({ text: this.observationGeneratedText(snapshot.generatedAt) });
    hero.createDiv({ cls: "mind-trace-observation-summary", text: analysis.summary, attr: { role: "heading", "aria-level": "2" } });
    this.renderObservationFreshness(hero, snapshot, reports);
    const heroActions = hero.createDiv({ cls: "mind-trace-actions mind-trace-observation-actions" });
    const regenerate = heroActions.createEl("button", { cls: "mod-cta", text: "重新观照", attr: { type: "button" } });
    regenerate.disabled = !this.plugin.isProviderConfigured();
    regenerate.addEventListener("click", () => this.regenerateObservation(true));
    const remove = heroActions.createEl("button", { text: "删除这次观照", attr: { type: "button" } });
    remove.addEventListener("click", () => {
      openMindTraceOperation(this.app, this.plugin, {
        eyebrow: "观照 · 删除确认",
        title: "删除这次观照？",
        description: "只删除本地保存的观照与校准反馈，不删除任何来源报告。",
        confirmLabel: "删除观照",
        warning: true,
        run: async () => {
          await this.plugin.deleteSelfObservation(snapshot.filePath);
          this.observationReports = null;
          this.observationFiles = [];
          this.observationSelectedPath = "";
          this.observationState = null;
        },
        onSuccess: () => this.render(true),
        successTitle: "这次观照已删除",
        successDetail: "来源报告仍然保留。",
        backgroundSuccess: "这次观照已删除"
      });
    });
    this.renderObservationGrowthTrace(shell, maturity);
    const trace = shell.createEl("section", { cls: "mind-trace-observation-trace" });
    trace.createDiv({ cls: "mind-trace-observation-section-title", text: "变化描线", attr: { role: "heading", "aria-level": "2" } });
    trace.createEl("p", { cls: "mind-trace-observation-section-note", text: "按单次差异、重复变化、稳定变化排列。线索强度由证据日期本地计算，不代表结论。" });
    const stages = trace.createDiv({ cls: "mind-trace-observation-stages", attr: { "aria-hidden": "true" } });
    for (const label of ["单次差异", "重复变化", "稳定变化"]) stages.createSpan({ text: label });
    const traceList = trace.createDiv({ cls: "mind-trace-observation-trace-list" });
    if (analysis.changes.length === 0) traceList.createDiv({ cls: "mind-trace-observation-muted", text: "这次没有足够的变化线索，先从回顾中继续记录。" });
    for (const item of analysis.changes) {
      const signal = observationSignal(item.evidenceDates);
      item.level = observationConstrainedLevel(item.level, item.evidenceDates);
      item.signal = signal.label;
      const row = traceList.createDiv({ cls: `mind-trace-observation-change is-${item.level}` });
      row.createDiv({ cls: "mind-trace-observation-change-rail", attr: { "aria-hidden": "true" } }).createSpan({ cls: "mind-trace-observation-change-node" });
      const body = row.createDiv({ cls: "mind-trace-observation-change-body" });
      const top = body.createDiv({ cls: "mind-trace-observation-change-top" });
      top.createSpan({ cls: "mind-trace-observation-dimension", text: item.dimension });
      top.createSpan({ cls: "mind-trace-observation-signal", text: signal.label });
      body.createDiv({ cls: "mind-trace-observation-change-copy", text: `${item.before} → ${item.now}` });
      this.renderObservationEvidenceDates(body, item.evidenceDates);
      this.renderObservationFeedback(top, "change", item, body);
    }
    const perspectiveSection = shell.createEl("section", { cls: "mind-trace-observation-section" });
    perspectiveSection.createDiv({ cls: "mind-trace-observation-section-title", text: "从不同角度看", attr: { role: "heading", "aria-level": "2" } });
    const perspectiveGrid = perspectiveSection.createDiv({ cls: "mind-trace-observation-perspective-grid" });
    for (const item of analysis.perspectives) {
      const card = perspectiveGrid.createEl("article", { cls: "mind-trace-observation-perspective" });
      const title = card.createDiv({ cls: "mind-trace-observation-item-top" });
      title.createSpan({ cls: "mind-trace-observation-perspective-name", text: item.perspective });
      title.createSpan({ cls: `mind-trace-observation-layer is-${item.layer}`, text: item.layer });
      card.createDiv({ cls: "mind-trace-observation-item-copy", text: item.observation });
      card.createDiv({ cls: "mind-trace-observation-basis", text: `依据：${item.basis}` });
      this.renderObservationEvidenceDates(card, item.evidenceDates);
      this.renderObservationFeedback(title, "perspective", item, card);
    }
    if (analysis.hypotheses.length > 0) {
      const hypothesisSection = shell.createEl("section", { cls: "mind-trace-observation-section" });
      hypothesisSection.createDiv({ cls: "mind-trace-observation-section-title", text: "值得验证的假设", attr: { role: "heading", "aria-level": "2" } });
      for (const item of analysis.hypotheses) {
        const card = hypothesisSection.createEl("article", { cls: "mind-trace-observation-hypothesis" });
        const top = card.createDiv({ cls: "mind-trace-observation-item-top" });
        top.createSpan({ cls: "mind-trace-observation-hypothesis-label", text: item.level });
        card.createDiv({ cls: "mind-trace-observation-item-copy", text: item.statement });
        this.renderObservationEvidenceDates(card, item.evidenceDates);
        card.createDiv({ cls: "mind-trace-observation-alternative", text: `另一种解释：${item.alternative}` });
        card.createDiv({ cls: "mind-trace-observation-question", text: `可以问自己：${item.question}` });
        this.renderObservationFeedback(top, "hypothesis", item, card);
      }
    }
    if (analysis.roles.length > 0) {
      const roleSection = shell.createEl("section", { cls: "mind-trace-observation-section" });
      roleSection.createDiv({ cls: "mind-trace-observation-section-title", text: "最近承担的角色", attr: { role: "heading", "aria-level": "2" } });
      roleSection.createEl("p", { cls: "mind-trace-observation-section-note", text: "这是根据记录措辞推测的生活角色线索，不是身份定义。" });
      for (const item of analysis.roles) {
        const row = roleSection.createDiv({ cls: "mind-trace-observation-role" });
        const top = row.createDiv({ cls: "mind-trace-observation-item-top" });
        top.createSpan({ cls: "mind-trace-observation-role-label", text: item.label });
        row.createDiv({ cls: "mind-trace-observation-item-copy", text: item.observation });
        this.renderObservationEvidenceDates(row, item.evidenceDates);
        this.renderObservationFeedback(top, "role", item, row);
      }
    }
    const closing = shell.createEl("section", { cls: "mind-trace-observation-closing" });
    closing.createDiv({ cls: "mind-trace-observation-section-title", text: "接下来的一小步", attr: { role: "heading", "aria-level": "2" } });
    closing.createDiv({ cls: "mind-trace-observation-next-step", text: analysis.nextStep });
    closing.createDiv({ cls: "mind-trace-observation-self-question", text: `留给自己：${analysis.selfQuestion}` });
    this.renderObservationSourceDetails(shell, sources);
  }
  renderObservationHistory(shell) {
    if (this.observationFiles.length === 0) return;
    const bar = shell.createDiv({ cls: "mind-trace-observation-history" });
    bar.createSpan({ text: "历史版本" });
    const select = bar.createEl("select", { attr: { "aria-label": "选择观照历史版本" } });
    for (const item of this.observationFiles) {
      const label = item.snapshot !== null ? `${item.snapshot.generatedAt?.slice(0, 19).replace("T", " ") || item.file.basename}${item.snapshot.legacy ? " · 旧版" : ""}` : `${item.file.basename} · 格式异常`;
      select.createEl("option", { value: item.file.path, text: label });
    }
    select.value = this.observationSelectedPath || this.observationFiles[0].file.path;
    select.addEventListener("change", () => {
      this.observationSelectedPath = select.value;
      this.render(true);
    });
    const selected = this.observationFiles.find((item) => item.file.path === select.value);
    const edit = bar.createEl("button", { text: "编辑 Markdown", attr: { type: "button" } });
    edit.addEventListener("click", () => {
      const target = this.app.vault.getAbstractFileByPath(this.observationSelectedPath);
      if (target instanceof import_obsidian4.TFile) void this.plugin.openProtectedMarkdownSource(this.leaf, target);
    });
    if (selected?.error) bar.createDiv({ cls: "mind-trace-observation-format-error", text: `${selected.file.path}：${selected.error}` });
  }
  renderObservationSnapshotV2(shell, snapshot, reports, maturity) {
    const sources = snapshot.sources?.length > 0 ? snapshot.sources : this.observationSourceDescriptors(reports);
    const analysis = snapshot.analysis;
    const hero = shell.createEl("section", { cls: "mind-trace-observation-hero" });
    const meta = hero.createDiv({ cls: "mind-trace-observation-meta" });
    const starts = sources.map((source) => source.periodStart).filter(Boolean).sort();
    const ends = sources.map((source) => source.periodEnd).filter(Boolean).sort();
    meta.createSpan({ text: starts.length && ends.length ? `${starts[0]} — ${ends[ends.length - 1]}` : "来源周期未记录" });
    meta.createSpan({ text: `${sources.length} 份来源报告` });
    meta.createSpan({ text: this.observationGeneratedText(snapshot.generatedAt) });
    hero.createDiv({ cls: "mind-trace-observation-summary", text: analysis.summary, attr: { role: "heading", "aria-level": "2" } });
    this.renderObservationFreshness(hero, snapshot, reports);
    const actions = hero.createDiv({ cls: "mind-trace-actions mind-trace-observation-actions" });
    const regenerate = actions.createEl("button", { cls: "mod-cta", text: "基于最新来源重新观照", attr: { type: "button" } });
    regenerate.disabled = !this.plugin.isProviderConfigured() || reports.length === 0;
    regenerate.addEventListener("click", () => this.regenerateObservation(true));
    const edit = actions.createEl("button", { text: "编辑 Markdown", attr: { type: "button" } });
    edit.addEventListener("click", () => {
      const file = this.app.vault.getAbstractFileByPath(snapshot.filePath);
      if (file instanceof import_obsidian4.TFile) void this.plugin.openProtectedMarkdownSource(this.leaf, file);
    });
    const remove = actions.createEl("button", { text: "删除", attr: { type: "button" } });
    remove.addEventListener("click", () => {
      openMindTraceOperation(this.app, this.plugin, {
        eyebrow: "观照 · 删除确认", title: "删除这个历史版本？", description: "只删除当前观照 Markdown，不影响其他版本、来源报告或日记。", confirmLabel: "删除", warning: true,
        run: async () => this.plugin.deleteSelfObservation(snapshot.filePath),
        onSuccess: () => { this.observationSelectedPath = ""; this.observationReports = null; this.observationFiles = []; this.render(true); },
        successTitle: "观照已移到废纸篓", successDetail: "其他观照版本和来源仍然保留。", backgroundSuccess: "观照已删除"
      });
    });
    const panorama = shell.createEl("section", { cls: "mind-trace-observation-panorama" });
    panorama.createDiv({ cls: "mind-trace-observation-section-title", text: "六维变化全景", attr: { role: "heading", "aria-level": "2" } });
    panorama.createEl("p", { cls: "mind-trace-observation-section-note", text: "依据充分度由本地代码按支持日期、独立周期、跨度与反例计算，不是真相概率。" });
    const grid = panorama.createDiv({ cls: "mind-trace-observation-panorama-grid" });
    for (const dimension of OBSERVATION_DIMENSIONS) {
      const claim = analysis.claims.find((item) => item.dimension === dimension);
      const card = grid.createEl(claim ? "button" : "article", { cls: `mind-trace-observation-dimension-card${claim ? " has-evidence" : " is-empty"}`, attr: claim ? { type: "button" } : {} });
      card.createSpan({ cls: "mind-trace-observation-dimension", text: dimension });
      if (!claim) {
        card.createDiv({ cls: "mind-trace-observation-muted", text: "暂无足够依据" });
        continue;
      }
      const metrics = observationClaimMetrics(claim, snapshot.evidence ?? [], sources);
      card.createDiv({ cls: "mind-trace-observation-dimension-copy", text: claim.statement });
      const badges = card.createDiv({ cls: "mind-trace-observation-dimension-badges" });
      badges.createSpan({ text: metrics.signal });
      badges.createSpan({ text: `依据${metrics.sufficiency}` });
      card.addEventListener("click", () => shell.querySelector(`[data-observation-claim="${claim.key}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    const details = shell.createEl("section", { cls: "mind-trace-observation-section" });
    details.createDiv({ cls: "mind-trace-observation-section-title", text: "观察详情", attr: { role: "heading", "aria-level": "2" } });
    for (const claim of analysis.claims) {
      const metrics = observationClaimMetrics(claim, snapshot.evidence ?? [], sources);
      const card = details.createEl("article", { cls: `mind-trace-observation-claim is-${claim.layer}`, attr: { "data-observation-claim": claim.key } });
      const top = card.createDiv({ cls: "mind-trace-observation-item-top" });
      top.createSpan({ cls: "mind-trace-observation-dimension", text: claim.dimension });
      top.createSpan({ cls: "mind-trace-observation-signal", text: `${metrics.signal} · 依据${metrics.sufficiency}` });
      card.createDiv({ cls: "mind-trace-observation-item-copy", text: claim.statement });
      if (claim.before || claim.now) card.createDiv({ cls: "mind-trace-observation-change-copy", text: `${claim.before || "暂无明确对照"} → ${claim.now || "暂无明确对照"}` });
      card.createDiv({ cls: "mind-trace-observation-basis", text: `支持 ${metrics.support.length} · 反例 ${metrics.counter.length} · 独立周期 ${metrics.independentPeriods} · 跨度 ${metrics.spanDays} 天` });
      const renderEvidence = (title, items, empty) => {
        const block = card.createDiv({ cls: "mind-trace-observation-evidence-block" });
        block.createDiv({ cls: "mind-trace-observation-evidence-label", text: title });
        if (items.length === 0) block.createDiv({ cls: "mind-trace-observation-muted", text: empty });
        for (const item of items) {
          const button = block.createEl("button", { cls: "mind-trace-observation-evidence-record", text: observationEvidenceMarkdown(item), attr: { type: "button" } });
          button.addEventListener("click", () => {
            const journal = collectMetrics(this.app).entries.find((entry) => entry.date === item.date);
            if (journal !== void 0) void this.plugin.openJournalDate(item.date);
            else {
              const sourcePath = item.sourceReports?.find((path) => this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian4.TFile);
              if (sourcePath) void this.openWeeklyReportFile(sourcePath);
            }
          });
        }
      };
      renderEvidence("支持记录", metrics.support, "暂无可用支持记录");
      renderEvidence("反例", metrics.counter, "暂未找到反例，不等于不存在反例");
      if (claim.alternative) card.createDiv({ cls: "mind-trace-observation-alternative", text: `另一种解释：${claim.alternative}` });
      if (claim.missingInformation) card.createDiv({ cls: "mind-trace-observation-basis", text: `仍缺少的信息：${claim.missingInformation}` });
      if (claim.verificationQuestion) card.createDiv({ cls: "mind-trace-observation-question", text: `可以问自己：${claim.verificationQuestion}` });
      this.renderObservationFeedback(top, "claim", claim, card);
    }
    const closing = shell.createEl("section", { cls: "mind-trace-observation-closing" });
    closing.createDiv({ cls: "mind-trace-observation-section-title", text: "接下来值得观察什么", attr: { role: "heading", "aria-level": "2" } });
    closing.createDiv({ cls: "mind-trace-observation-next-step", text: analysis.nextObservation });
    this.renderObservationSourceDetails(shell, sources);
  }
  regenerateObservation(overwrite = false) {
    if (this.observationReports === null || this.observationReports.length === 0) {
      return;
    }
    if (!this.plugin.isProviderConfigured()) {
      this.plugin.openSettings();
      return;
    }
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹 · 观照",
      title: overwrite ? "重新观照？" : "开始观照？",
      description: "将发送报告字段、结构化事件摘要和短证据片段，不发送完整历史日记。每次都会新建一个 Markdown 版本，现有观照不会被覆盖。",
      confirm: overwrite,
      confirmLabel: overwrite ? "重新观照" : "开始观照",
      warning: overwrite,
      run: async () => {
        this.observationLoading = true;
        this.observationError = "";
        this.render(true);
        const snapshot = await this.plugin.generateSelfObservation(this.observationReports);
        this.observationLoading = false;
        return snapshot;
      },
      onSuccess: (snapshot) => {
        this.observationLoading = false;
        this.observationReports = this.observationReports ?? [];
        this.observationSelectedPath = snapshot.filePath ?? "";
        this.observationFiles = [];
        void this.plugin.observationRepository.list().then((items) => {
          this.observationFiles = items;
          this.render(true);
        });
        this.render(true);
        return snapshot;
      },
      onError: (error) => {
        this.observationLoading = false;
        this.observationError = errorMessage(error);
        this.render(true);
      },
      successTitle: "观照已经生成",
      successDetail: "你可以逐条确认、修正或否认这些线索。",
      backgroundSuccess: "观照已经生成"
    });
  }
  observationPendingCount(snapshot, maturity = observationSnapshotMaturity(snapshot)) {
    if (snapshot?.analysis?.schemaVersion === 2) {
      return (snapshot.analysis.claims ?? []).filter((claim) => this.observationFeedback(claim.key).status === "pending").length;
    }
    const analysis = snapshot?.analysis ? constrainObservationAnalysisForMaturity(snapshot.analysis, maturity) : null;
    if (analysis === null || typeof analysis !== "object") return 0;
    return ["changes", "perspectives", "hypotheses", "roles"].reduce((sum, section) => {
      for (const item of Array.isArray(analysis[section]) ? analysis[section] : []) {
        const key = typeof item?.key === "string" ? item.key : "";
        if (key.length === 0 || this.observationFeedback(key).status === "pending") sum += 1;
      }
      return sum;
    }, 0);
  }
  renderObservationDashboardCard(container) {
    const card = container.createEl("section", { cls: "mind-trace-home-section mind-trace-observation-dashboard-card", attr: { "aria-labelledby": "mind-trace-observation-dashboard-title" } });
    this.observationDashboardCardEl = card;
    card.classList.remove("is-copy-roomy", "is-copy-compact");
    const header = card.createDiv({ cls: "mind-trace-observation-dashboard-head" });
    header.createDiv({ cls: "mind-trace-home-section-title", text: "观照", attr: { id: "mind-trace-observation-dashboard-title", role: "heading", "aria-level": "2" } });
    header.createSpan({ cls: "mind-trace-observation-dashboard-eyebrow", text: "证据成长描线" });
    const body = card.createDiv({ cls: "mind-trace-observation-dashboard-body" });
    const snapshot = this.currentObservationSnapshot();
    const reportState = this.observationLoading || this.observationReports === null ? "loading" : this.observationError.length > 0 ? "error" : this.observationReports.length === 0 ? "missing" : snapshot.analysis === null ? "empty" : "ready";
    if (reportState !== "ready") {
      body.classList.add("is-state");
    }
    if (reportState === "loading") {
      body.createDiv({ cls: "mind-trace-observation-dashboard-status", text: "正在读取回顾来源…", attr: { role: "status", "aria-live": "polite" } });
      return card;
    }
    if (reportState === "error") {
      body.createDiv({ cls: "mind-trace-observation-dashboard-status", text: "回顾来源暂时无法读取。", attr: { role: "alert" } });
      body.createEl("p", { text: this.observationError });
      const retry = body.createEl("button", { text: "重试读取", attr: { type: "button" } });
      retry.addEventListener("click", () => { this.observationReports = null; void this.loadObservationReports(); });
      return card;
    }
    if (reportState === "missing" && snapshot.analysis === null) {
      body.createDiv({ cls: "mind-trace-observation-dashboard-status is-locked", text: "还没有可用的回顾" });
      body.createEl("p", { text: "至少 1 份可解析周报或月报后，才能开始初次观照。" });
      const go = body.createEl("button", { text: "前往回顾", attr: { type: "button" } });
      go.addEventListener("click", () => this.setMode("reports"));
      return card;
    }
    if (reportState === "empty") {
      if (!this.plugin.isProviderConfigured()) {
        body.createDiv({ cls: "mind-trace-observation-dashboard-status", text: "模型未配置" });
        body.createEl("p", { text: "配置模型后，点击观照页中的按钮开始初次观照。" });
        const setup = body.createEl("button", { text: "打开设置", attr: { type: "button" } });
        setup.addEventListener("click", () => this.plugin.openSettings());
      } else {
        body.createDiv({ cls: "mind-trace-observation-dashboard-status", text: "有报告，尚未生成观照" });
        body.createEl("p", { text: "已有可解析回顾，可以开始初次观照。" });
        const start = body.createEl("button", { cls: "mod-cta", text: "开始初次观照", attr: { type: "button" } });
        start.addEventListener("click", () => this.setMode("observation"));
      }
      return card;
    }
    const maturity = snapshot.analysis !== null ? observationSnapshotMaturity(snapshot) : computeObservationMaturity(this.observationReports);
    const visibleAnalysis = snapshot.analysis === null ? null : snapshot.analysis.schemaVersion === 2 ? snapshot.analysis : constrainObservationAnalysisForMaturity(snapshot.analysis, maturity);
    const paths = new Set(this.app.vault.getMarkdownFiles().map((file) => file.path));
    const freshness = deriveObservationFreshness(snapshot, this.observationReports, paths);
    body.createDiv({ cls: `mind-trace-observation-dashboard-status${freshness.stale ? " is-stale" : ""}`, text: freshness.stale ? "有新的依据" : "观照已生成" });
    const rawSummary = visibleAnalysis?.summary ?? snapshot.analysis.summary;
    const summary = typeof rawSummary === "string" ? rawSummary : "";
    if (summary.length < 90) {
      card.classList.add("is-copy-roomy");
    } else if (summary.length > 180) {
      card.classList.add("is-copy-compact");
    }
    body.createDiv({ cls: "mind-trace-observation-dashboard-summary", text: summary });
    const changes = visibleAnalysis?.schemaVersion === 2 ? visibleAnalysis.claims ?? [] : Array.isArray(visibleAnalysis?.changes) ? visibleAnalysis.changes : [];
    if (changes.length > 0) {
      const clues = body.createDiv({ cls: "mind-trace-observation-dashboard-clues", attr: { "aria-label": "观照变化线索" } });
      for (const item of changes.slice(0, 2)) {
        const clue = clues.createDiv({ cls: "mind-trace-observation-dashboard-clue" });
        clue.createSpan({ cls: "mind-trace-observation-dashboard-clue-dimension", text: item.dimension ?? "变化" });
        clue.createSpan({ cls: "mind-trace-observation-dashboard-clue-value", text: visibleAnalysis?.schemaVersion === 2 ? item.statement : `${item.before ?? "—"} → ${item.now ?? "—"}` });
      }
    }
    const meta = body.createDiv({ cls: "mind-trace-observation-dashboard-meta" });
    meta.createSpan({ text: `阶段：${maturity.stage === "continuous" ? "持续观照" : maturity.stage === "cross_period" ? "跨周期观照" : "初次观照"}` });
    meta.createSpan({ text: `待校准 ${this.observationPendingCount(snapshot, maturity)} 项` });
    const actions = body.createDiv({ cls: "mind-trace-observation-dashboard-actions" });
    const view = actions.createEl("button", { cls: "mod-cta", text: "查看观照", attr: { type: "button" } });
    view.addEventListener("click", () => this.setMode("observation"));
    if (freshness.stale && this.plugin.isProviderConfigured() && this.observationReports.length > 0) {
      const update = actions.createEl("button", { text: "手动更新", attr: { type: "button" } });
      update.addEventListener("click", () => this.regenerateObservation(true));
    }
    return card;
  }
  renderReports(container) {
    const shell = container.createDiv({ cls: "mind-trace-page-shell mind-trace-reports-page" });
    const heading = shell.createDiv({ cls: "mind-trace-page-heading" });
    heading.createDiv({ cls: "mind-trace-eyebrow", text: "回顾" });
    heading.createDiv({
      cls: "mind-trace-page-title",
      text: "把一段时间收拢成一张图景",
      attr: { role: "heading", "aria-level": "1" }
    });
    heading.createEl("p", { text: "这里按自然周或自然月整理变化；要查看事件如何发生，前往轨迹。" });
    const trajectoryButton = heading.createEl("button", { cls: "mind-trace-report-trajectory-link", text: "查看事件轨迹", attr: { type: "button" } });
    trajectoryButton.addEventListener("click", () => this.setMode("trajectory"));
    this.renderFormationStrip(shell, collectMetrics(this.app).entries);
    const reportTabs = shell.createDiv({ cls: "mind-trace-report-tabs", attr: { role: "tablist", "aria-label": "回顾周期" } });
    const reportTabOptions = [["weekly", "周报"], ["monthly", "月报"]];
    const reportTabButtons = [];
    for (const [id, label] of reportTabOptions) {
      const active = this.reportTab === id;
      const tab = reportTabs.createEl("button", { cls: `mind-trace-report-tab${active ? " is-active" : ""}`, text: label, attr: { type: "button", role: "tab", id: `mind-trace-report-tab-${id}`, "aria-selected": String(active), "aria-controls": `mind-trace-report-panel-${id}`, tabindex: active ? "0" : "-1" } });
      reportTabButtons.push(tab);
      tab.addEventListener("click", () => {
        this.reportTab = id;
        this.render(true);
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
          return;
        }
        event.preventDefault();
        const currentIndex = reportTabButtons.indexOf(tab);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? reportTabButtons.length - 1 : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + reportTabButtons.length) % reportTabButtons.length;
        const next = reportTabButtons[nextIndex];
        this.reportTab = reportTabOptions[nextIndex][0];
        this.render(true);
        this.ownerWindow.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`#mind-trace-report-tab-${reportTabOptions[nextIndex][0]}`);
          if (target instanceof this.ownerWindow.HTMLElement) target.focus();
        });
      });
    }
    const reportPanel = shell.createDiv({
      cls: "mind-trace-report-panel",
      attr: {
        role: "tabpanel",
        id: `mind-trace-report-panel-${this.reportTab}`,
        "aria-labelledby": `mind-trace-report-tab-${this.reportTab}`
      }
    });
    for (const [id] of reportTabOptions) {
      if (id === this.reportTab) continue;
      shell.createDiv({
        cls: "mind-trace-report-panel is-inactive",
        attr: {
          role: "tabpanel",
          id: `mind-trace-report-panel-${id}`,
          "aria-labelledby": `mind-trace-report-tab-${id}`,
          hidden: "true"
        }
      });
    }
    if (this.reportTab === "monthly") {
      this.renderMonthlyReports(reportPanel);
      return;
    }
    const current = currentWeekPeriod();
    const currentWeek = reportPanel.createDiv({ cls: "mind-trace-current-week-report" });
    const currentCopy = currentWeek.createDiv();
    currentCopy.createDiv({ cls: "mind-trace-home-section-title", text: "本周周报", attr: { role: "heading", "aria-level": "2" } });
    currentCopy.createEl("p", { text: `${current.start.slice(5).replace("-", "/")} — ${current.end.slice(5).replace("-", "/")} · 把当前周尚未结束的日记也纳入统计，生成本周版本。` });
    const currentButton = currentWeek.createEl("button", {
      cls: "mod-cta",
      text: "生成本周周报",
      attr: { type: "button" }
    });
    currentButton.addEventListener("click", () => this.generateCurrentWeekReport());
    const lead = reportPanel.createDiv({ cls: "mind-trace-home-lead-grid" });
    this.renderWeeklyReportCard(lead);
    void this.loadWeeklyReportCard();
    const section = reportPanel.createEl("section", { cls: "mind-trace-reports-list-section" });
    section.createDiv({
      cls: "mind-trace-home-section-title",
      text: "全部周报",
      attr: { role: "heading", "aria-level": "2" }
    });
    const files = collectWeeklyReportFiles(this.app);
    if (files.length === 0) {
      const empty = section.createDiv({ cls: "mind-trace-empty-state" });
      empty.createDiv({ cls: "mind-trace-empty-mark", text: "等待" });
      empty.createDiv({ cls: "mind-trace-empty-title", text: "还没有周报" });
      empty.createEl("p", { text: "达到最低记录日后，心迹会为最近一个完整自然周生成周报。" });
      const button = empty.createEl("button", { cls: "mod-cta", text: "前往生成", attr: { type: "button" } });
      button.addEventListener("click", () => this.retryWeeklyReport(false));
      return;
    }
    const list = section.createDiv({ cls: "mind-trace-home-rows" });
    for (const item of files) {
      const row = list.createDiv({
        cls: "mind-trace-home-row",
        attr: {
          role: "button",
          tabindex: "0",
          "data-report-path": item.file.path,
          "aria-label": `打开 ${item.start} 至 ${item.end} 的周报`,
          title: item.generatedAt.length > 0 ? `${item.start} 至 ${item.end} · ${weeklyGeneratedAtText(item.generatedAt)}` : `${item.start} 至 ${item.end}`
        }
      });
      const rail = row.createDiv({
        cls: "mind-trace-home-rail",
        attr: { "aria-hidden": "true" }
      });
      rail.createSpan({ cls: "mind-trace-home-dot mind-trace-report-dot" });
      const main = row.createDiv({ cls: "mind-trace-home-row-main" });
      const period = main.createSpan({ cls: "mind-trace-home-date" });
      period.createSpan({ cls: "mind-trace-home-date-day", text: `${item.start.slice(5)}–${item.end.slice(5)}` });
      period.createSpan({ cls: "mind-trace-home-date-week", text: "周报" });
      if (item.end === completedPeriod("weekly").end) {
        main.createSpan({ cls: "mind-trace-report-badge", text: "最近一周" });
      }
      main.createSpan({
        cls: "mind-trace-report-row-summary mind-trace-report-list-summary",
        text: "正在读取摘要…"
      });
      main.createSpan({
        cls: "mind-trace-home-sessions",
        text: `${item.days} 天 · ${item.sessions} 篇`
      });
      (0, import_obsidian4.setIcon)(main.createSpan({ cls: "mind-trace-home-row-arrow", attr: { "aria-hidden": "true" } }), "arrow-right");
      const open = () => void this.openWeeklyReportFile(item.file.path);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    }
    void this.loadReportListSummaries(list, files);
  }
  renderMonthlyReports(shell) {
    const current = currentMonthPeriod();
    const currentMonth = shell.createDiv({ cls: "mind-trace-current-week-report mind-trace-current-month-report" });
    const currentCopy = currentMonth.createDiv();
    currentCopy.createDiv({ cls: "mind-trace-home-section-title", text: "本月预览", attr: { role: "heading", "aria-level": "2" } });
    currentCopy.createEl("p", { text: `${current.start.slice(5).replace("-", "/")} — ${current.end.slice(5).replace("-", "/")} · 截至今天，有至少 1 个记录日即可生成。` });
    const currentPreviewFile = this.plugin.monthlyReportRepository.find(this.plugin.settings, current);
    const currentButton = currentMonth.createEl("button", { cls: "mod-cta", text: currentPreviewFile === null ? "生成本月预览" : "更新本月预览", attr: { type: "button" } });
    currentButton.addEventListener("click", () => this.generateCurrentMonthReport(currentPreviewFile));
    const lead = shell.createDiv({ cls: "mind-trace-home-lead-grid" });
    this.renderMonthlyReportCard(lead);
    void this.loadMonthlyReportCard();
    const section = shell.createEl("section", { cls: "mind-trace-reports-list-section" });
    section.createDiv({ cls: "mind-trace-home-section-title", text: "全部月报", attr: { role: "heading", "aria-level": "2" } });
    const files = collectMonthlyReportFiles(this.app);
    if (files.length === 0) {
      const empty = section.createDiv({ cls: "mind-trace-empty-state" });
      empty.createDiv({ cls: "mind-trace-empty-mark", text: "等待" });
      empty.createDiv({ cls: "mind-trace-empty-title", text: "还没有月报" });
      empty.createEl("p", { text: "达到最低活跃周后，心迹会为最近一个完整自然月生成月报；本月预览不受正式门槛限制。" });
      return;
    }
    const list = section.createDiv({ cls: "mind-trace-home-rows" });
    for (const item of files) {
      const row = list.createDiv({ cls: "mind-trace-home-row", attr: { role: "button", tabindex: "0", "data-report-path": item.file.path, "aria-label": `打开 ${item.start} 至 ${item.end} 的月报`, title: item.generatedAt.length > 0 ? `${item.start} 至 ${item.end} · ${weeklyGeneratedAtText(item.generatedAt)}` : `${item.start} 至 ${item.end}` } });
      const rail = row.createDiv({ cls: "mind-trace-home-rail", attr: { "aria-hidden": "true" } });
      rail.createSpan({ cls: "mind-trace-home-dot mind-trace-report-dot mind-trace-monthly-report-dot" });
      const main = row.createDiv({ cls: "mind-trace-home-row-main" });
      const period = main.createSpan({ cls: "mind-trace-home-date" });
      period.createSpan({ cls: "mind-trace-home-date-day", text: `${item.start.slice(0, 7)}` });
      period.createSpan({ cls: "mind-trace-home-date-week", text: item.status === "partial" ? "预览" : "月报" });
      if (item.status === "partial") main.createSpan({ cls: "mind-trace-report-badge", text: "截至今天" });
      main.createSpan({ cls: "mind-trace-report-row-summary mind-trace-report-list-summary", text: "正在读取摘要…" });
      main.createSpan({ cls: "mind-trace-home-sessions", text: `${item.days} 天 · ${item.sessions} 篇 · ${item.activeWeeks} 周` });
      (0, import_obsidian4.setIcon)(main.createSpan({ cls: "mind-trace-home-row-arrow", attr: { "aria-hidden": "true" } }), "arrow-right");
      const open = () => void this.openWeeklyReportFile(item.file.path);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    }
    void this.loadReportListSummaries(list, files, "本月概览");
  }
  async loadReportListSummaries(list, files, heading = "一周概览") {
    for (const item of files) {
      const row = [...list.querySelectorAll(".mind-trace-home-row")].find((candidate) => candidate.getAttribute("data-report-path") === item.file.path);
      const summary = row?.querySelector(".mind-trace-report-list-summary");
      if (!(summary instanceof this.ownerWindow.HTMLElement) || !summary.isConnected) {
        continue;
      }
      try {
        const content = await this.app.vault.cachedRead(item.file);
        summary.textContent = reportSummaryFromMarkdown(content, heading);
      } catch {
        summary.textContent = "摘要暂时无法读取。";
      }
    }
  }
  renderTrajectory(container) {
    const shell = container.createDiv({ cls: "mind-trace-page-shell mind-trace-trajectory-page" });
    const heading = shell.createDiv({ cls: "mind-trace-page-heading" });
    heading.createDiv({ cls: "mind-trace-eyebrow", text: "轨迹" });
    heading.createDiv({
      cls: "mind-trace-page-title",
      text: "沿着事件找回事情如何发生",
      attr: { role: "heading", "aria-level": "1" }
    });
    heading.createEl("p", { text: "轨迹只呈现可核验的事件、日期与实体线索；需要回看一个周期如何理解，请前往回顾。" });
    const tabs = shell.createDiv({ cls: "mind-trace-trajectory-tabs", attr: { role: "tablist", "aria-label": "轨迹视图" } });
    const panels = [];
    const trajectoryTabs = [["events", "事件脉络"], ["journal", "日记与搜索"]];
    for (const [index, [view, label]] of trajectoryTabs.entries()) {
      const active = this.trajectoryView === view;
      const tab = tabs.createEl("button", {
        cls: `mind-trace-trajectory-tab${active ? " is-active" : ""}`,
        text: label,
        attr: { type: "button", role: "tab", id: `mind-trace-trajectory-tab-${view}`, "aria-selected": String(active), "aria-controls": `mind-trace-trajectory-panel-${view}`, tabindex: active ? "0" : "-1" }
      });
      const activate = (nextView) => {
        if (this.trajectoryView === nextView) return;
        this.trajectoryView = nextView;
        this.render(true);
        this.ownerWindow.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`#mind-trace-trajectory-tab-${nextView}`);
          if (target instanceof this.ownerWindow.HTMLElement) target.focus();
        });
      };
      tab.addEventListener("click", () => activate(view));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? trajectoryTabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + trajectoryTabs.length) % trajectoryTabs.length;
        activate(trajectoryTabs[nextIndex][0]);
      });
      const panel = shell.createDiv({
        cls: `mind-trace-trajectory-panel${active ? " is-active" : ""}`,
        attr: { role: "tabpanel", id: `mind-trace-trajectory-panel-${view}`, "aria-labelledby": `mind-trace-trajectory-tab-${view}` }
      });
      panel.hidden = !active;
      panels.push([view, panel]);
    }
    for (const [view, panel] of panels) {
      if (panel.hidden) {
        continue;
      }
      if (view === "events") {
        this.trajectoryEventPanelEl = panel;
        this.renderTrajectoryEvents(panel);
      } else {
        this.renderTrajectoryJournalSearch(panel);
      }
    }
    if (this.historySnapshot === null) {
      void this.loadAndRenderHistory();
    }
  }
  renderTrajectoryJournalSearch(panel) {
    const entries = collectMetrics(this.app).entries;
    if (entries.length === 0) {
      const empty = panel.createDiv({ cls: "mind-trace-empty-state" });
      empty.createDiv({ cls: "mind-trace-empty-mark", text: "第一篇" });
      empty.createDiv({ cls: "mind-trace-empty-title", text: "从第一篇心迹日记开始" });
      empty.createEl("p", { text: "写完之后，这里会长出可以翻找的日历、日记和检索结果。" });
      const button = empty.createEl("button", { cls: "mod-cta", text: "开始记录", attr: { type: "button" } });
      button.addEventListener("click", () => this.startWizard());
      return;
    }
    const calendarSection = panel.createEl("section", { cls: "mind-trace-home-section mind-trace-trajectory-calendar" });
    calendarSection.createDiv({
      cls: "mind-trace-home-section-title",
      text: "日历",
      attr: { role: "heading", "aria-level": "2" }
    });
    const calendarContainer = calendarSection.createDiv();
    const calendar = new DashboardComponent(
      this.app,
      calendarContainer,
      this.plugin.settings.dashboardRange,
      async (range) => {
        this.plugin.settings.dashboardRange = range;
        await this.plugin.saveSettings();
      },
      (filePath) => {
        if (filePath) {
          void this.openJournalFile(filePath);
        } else {
          this.startWizard();
        }
      }
    );
    calendar.renderYearHeatmap(entries, calendarContainer);
    this.renderHomeList(panel);
    this.renderHistoryCenter(panel);
  }
  renderTrajectoryEvents(panel) {
    panel.empty();
    panel.toggleClass("is-entity-filtered", this.trajectoryQuery.entityKey.length > 0);
    const snapshot = this.historySnapshot;
    if (snapshot === null) {
      if (this.historyError.length > 0 && !this.historyLoading) {
        const error = panel.createDiv({ cls: "mind-trace-trajectory-loading", attr: { role: "alert" } });
        error.createDiv({ cls: "mind-trace-empty-title", text: "事件脉络暂时无法整理" });
        error.createEl("p", { text: this.historyError });
        const retry = error.createEl("button", { text: "重试", attr: { type: "button" } });
        retry.addEventListener("click", () => { this.historyError = ""; this.historySnapshot = null; void this.loadAndRenderHistory(); });
        return;
      }
      panel.createDiv({ cls: "mind-trace-trajectory-loading", text: this.historyLoading ? "正在整理事件脉络…" : "正在准备事件脉络…", attr: { role: "status", "aria-live": "polite" } });
      return;
    }
    const records = Array.isArray(snapshot.eventRecords) ? snapshot.eventRecords : flattenHistoryEventRecords(snapshot.entries);
    const stats = trajectoryEventStats(snapshot.entries, records);
    const ruler = panel.createDiv({ cls: "mind-trace-trajectory-ruler", attr: { "aria-label": "轨迹概览" } });
    const rulerItems = [
      ["记录跨度", stats.firstDate.length > 0 ? `${stats.firstDate} — ${stats.lastDate}` : "—"],
      ["记录日", String(stats.days)],
      ["结构化事件", String(stats.events)],
      ["当前连续记录", `${stats.currentStreak} 天`]
    ];
    for (const [label, value] of rulerItems) {
      const item = ruler.createDiv({ cls: "mind-trace-trajectory-ruler-item" });
      item.createSpan({ cls: "mind-trace-trajectory-ruler-label", text: label });
      item.createEl("strong", { cls: "mind-trace-trajectory-ruler-value", text: value });
    }
    if (stats.longestStreak > 0) {
      ruler.createSpan({ cls: "mind-trace-trajectory-ruler-note", text: `最长连续 ${stats.longestStreak} 天` });
    }
    const eventStats = snapshot.eventStats ?? { ready: 0, missing: 0, invalid: 0, noEvents: 0, total: snapshot.entries.length };
    const incompleteSessions = Number(eventStats.missing ?? 0) + Number(eventStats.invalid ?? 0) + Number(eventStats.noEvents ?? 0);
    if (incompleteSessions > 0) {
      const quiet = panel.createDiv({ cls: "mind-trace-trajectory-quiet-note", attr: { role: "status" } });
      quiet.createSpan({ text: "部分记录还没有结构化事件。" });
      quiet.createEl("small", { text: `已整理 ${eventStats.ready ?? 0} · 待整理 ${eventStats.missing ?? 0} · 格式异常 ${eventStats.invalid ?? 0} · 无事件 ${eventStats.noEvents ?? 0}` });
      const jump = quiet.createEl("button", { text: "切到日记与搜索", attr: { type: "button" } });
      jump.addEventListener("click", () => { this.trajectoryView = "journal"; this.render(true); });
    }
    if (records.length === 0) {
      const empty = panel.createDiv({ cls: "mind-trace-empty-state mind-trace-trajectory-empty" });
      empty.createDiv({ cls: "mind-trace-empty-mark", text: "暂无事件" });
      empty.createDiv({ cls: "mind-trace-empty-title", text: "还没有可核验的结构化事件" });
      empty.createEl("p", { text: "可以先在日记与搜索中回看原始记录；这里不会自动补写事件。" });
      const button = empty.createEl("button", { cls: "mod-cta", text: "前往日记与搜索", attr: { type: "button" } });
      button.addEventListener("click", () => { this.trajectoryView = "journal"; this.render(true); });
      return;
    }
    const layout = panel.createDiv({ cls: "mind-trace-trajectory-layout" });
    this.renderTrajectoryFilters(layout, records);
    const filtered = filterTrajectoryEventRecords(records, this.trajectoryQuery);
    const results = layout.createDiv({ cls: "mind-trace-trajectory-results" });
    const resultHeading = results.createDiv({ cls: "mind-trace-trajectory-results-heading", attr: { "aria-live": "polite" } });
    const resultContext = resultHeading.createSpan({ cls: "mind-trace-trajectory-results-context", text: "按日期与时间展开" });
    if (this.trajectoryQuery.entityKey.length > 0) {
      const entity = trajectoryEntitySummaries(records).find((item) => item.key === this.trajectoryQuery.entityKey);
      if (entity !== void 0) {
        resultContext.textContent = `${entity.name} · ${entity.count} 次出现 · ${entity.firstDate} — ${entity.lastDate}`;
      }
    }
    resultHeading.createEl("strong", { cls: "mind-trace-trajectory-results-count", text: `${filtered.length} 件事件` });
    if (filtered.length === 0) {
      const empty = results.createDiv({ cls: "mind-trace-trajectory-filter-empty" });
      empty.createDiv({ cls: "mind-trace-empty-title", text: "没有符合这些筛选的事件" });
      empty.createEl("p", { text: "清除筛选后继续沿时间脉带查看。" });
      const clear = empty.createEl("button", { text: "清除筛选", attr: { type: "button" } });
      clear.addEventListener("click", () => { this.trajectoryQuery = createTrajectoryQuery(); this.trajectoryVisibleCount = 40; this.render(true); });
      return;
    }
    const visible = filtered.slice(0, this.trajectoryVisibleCount);
    let monthKey = "";
    let dayKey = "";
    let month = null;
    let day = null;
    for (const record of visible) {
      const nextMonth = record.date.slice(0, 7);
      if (nextMonth !== monthKey) {
        monthKey = nextMonth;
        dayKey = "";
        month = results.createEl("section", { cls: "mind-trace-trajectory-month" });
        month.createDiv({ cls: "mind-trace-trajectory-month-label", text: monthLabelText(record.date), attr: { role: "heading", "aria-level": "3" } });
        month.createDiv({ cls: "mind-trace-trajectory-ribbon" });
      }
      if (record.date !== dayKey) {
        dayKey = record.date;
        day = month.createEl("section", { cls: "mind-trace-trajectory-day" });
        day.createDiv({ cls: "mind-trace-trajectory-day-label", text: record.date, attr: { role: "heading", "aria-level": "4" } });
      }
      this.renderTrajectoryEventCard(day, record, this.trajectoryQuery.entityKey);
    }
    if (filtered.length > this.trajectoryVisibleCount) {
      const more = results.createEl("button", { cls: "mind-trace-trajectory-more", text: `再显示 ${Math.min(40, filtered.length - this.trajectoryVisibleCount)} 件`, attr: { type: "button" } });
      more.addEventListener("click", () => { this.trajectoryVisibleCount += 40; this.render(true); });
    }
  }
  renderTrajectoryFilters(panel, records) {
    const controls = panel.createDiv({ cls: "mind-trace-trajectory-controls" });
    const dateRow = controls.createDiv({ cls: "mind-trace-trajectory-filter-row" });
    dateRow.createSpan({ cls: "mind-trace-trajectory-filter-label", text: "时间" });
    for (const [value, label] of [["all", "全部"], ["30", "近30天"], ["90", "近90天"], ["year", "本年"]]) {
      const chip = dateRow.createEl("button", { cls: `mind-trace-trajectory-chip${this.trajectoryQuery.datePreset === value ? " is-active" : ""}`, text: label, attr: { type: "button", "aria-pressed": String(this.trajectoryQuery.datePreset === value) } });
      chip.addEventListener("click", () => { this.trajectoryQuery.datePreset = value; this.trajectoryVisibleCount = 40; this.render(true); });
    }
    const typeRow = controls.createDiv({ cls: "mind-trace-trajectory-filter-row" });
    typeRow.createSpan({ cls: "mind-trace-trajectory-filter-label", text: "类型" });
    const types = [...new Set(records.map((record) => record.type).filter((type) => EVENT_TYPES.includes(type)))];
    const allTypeActive = this.trajectoryQuery.eventType === "all" && !this.trajectoryQuery.actionObstacle;
    const allType = typeRow.createEl("button", { cls: `mind-trace-trajectory-chip${allTypeActive ? " is-active" : ""}`, text: "全部", attr: { type: "button", "aria-pressed": String(allTypeActive) } });
    allType.addEventListener("click", () => { this.trajectoryQuery.eventType = "all"; this.trajectoryQuery.actionObstacle = false; this.trajectoryVisibleCount = 40; this.render(true); });
    for (const type of EVENT_TYPES.filter((item) => types.includes(item))) {
      const active = this.trajectoryQuery.eventType === type;
      const chip = typeRow.createEl("button", { cls: `mind-trace-trajectory-chip is-event-${type}${active ? " is-active" : ""}`, text: EVENT_TYPE_LABELS[type], attr: { type: "button", "aria-pressed": String(active) } });
      chip.addEventListener("click", () => { this.trajectoryQuery.eventType = type; this.trajectoryQuery.actionObstacle = false; this.trajectoryVisibleCount = 40; this.render(true); });
    }
    const quick = typeRow.createEl("button", { cls: `mind-trace-trajectory-chip is-action-obstacle${this.trajectoryQuery.actionObstacle ? " is-active" : ""}`, text: "行动与未决", attr: { type: "button", "aria-pressed": String(this.trajectoryQuery.actionObstacle) } });
    quick.addEventListener("click", () => { this.trajectoryQuery.actionObstacle = !this.trajectoryQuery.actionObstacle; this.trajectoryQuery.eventType = "all"; this.trajectoryVisibleCount = 40; this.render(true); });
    const entities = trajectoryEntitySummaries(records).filter((entity) => entity.count >= 2);
    if (entities.length > 0) {
      const entityWrap = controls.createDiv({ cls: "mind-trace-trajectory-entities" });
      const entityLabel = entityWrap.createDiv({ cls: "mind-trace-trajectory-filter-label", text: "沿线索查看" });
      entityLabel.setAttribute("id", "mind-trace-trajectory-entities-label");
      const list = entityWrap.createDiv({ cls: "mind-trace-trajectory-entity-chips", attr: { role: "group", "aria-labelledby": "mind-trace-trajectory-entities-label" } });
      const ordered = this.trajectoryEntityExpanded ? entities : entities.slice(0, 16);
      for (const entity of ordered) {
        const active = this.trajectoryQuery.entityKey === entity.key;
        const chip = list.createEl("button", { cls: `mind-trace-trajectory-entity-chip${active ? " is-active" : ""}${entity.count >= 2 ? " is-recurring" : ""}`, text: `${EVENT_KIND_LABELS[entity.kind]} · ${entity.name} · ${entity.count}`, attr: { type: "button", "aria-pressed": String(active), title: `${entity.count} 件事件 · ${entity.firstDate} — ${entity.lastDate}` } });
        chip.addEventListener("click", () => { this.trajectoryQuery.entityKey = active ? "" : entity.key; this.trajectoryVisibleCount = 40; this.render(true); });
      }
      if (entities.length > 16) {
        const moreEntities = entityWrap.createEl("button", { cls: "mind-trace-trajectory-entities-more", text: this.trajectoryEntityExpanded ? "收起实体线索" : `更多实体（${entities.length - 16}）`, attr: { type: "button" } });
        moreEntities.addEventListener("click", () => { this.trajectoryEntityExpanded = !this.trajectoryEntityExpanded; this.render(true); });
      }
    }
    const active = this.trajectoryQuery.datePreset !== "all" || this.trajectoryQuery.eventType !== "all" || this.trajectoryQuery.entityKey.length > 0 || this.trajectoryQuery.actionObstacle;
    if (active) {
      const clear = controls.createEl("button", { cls: "mind-trace-trajectory-clear", text: "清除筛选", attr: { type: "button" } });
      clear.addEventListener("click", () => { this.trajectoryQuery = createTrajectoryQuery(); this.trajectoryVisibleCount = 40; this.render(true); });
    }
  }
  renderTrajectoryEventCard(container, record, selectedEntityKey = "") {
    const card = container.createEl("article", { cls: `mind-trace-trajectory-event-card is-${record.type}`, attr: { role: "button", tabindex: "0", "aria-label": `打开 ${record.date} ${record.time} 的${EVENT_TYPE_LABELS[record.type] ?? "事件"}：${record.title}`, title: `${record.filePath} · session ${record.sessionIndex} · event ${record.eventIndex} · ${record.id}` } });
    const marker = card.createDiv({ cls: "mind-trace-trajectory-event-marker", attr: { "aria-hidden": "true" } });
    marker.createSpan({ text: record.time || "—" });
    const body = card.createDiv({ cls: "mind-trace-trajectory-event-body" });
    const meta = body.createDiv({ cls: "mind-trace-trajectory-event-meta" });
    meta.createSpan({ cls: `mind-trace-trajectory-event-type is-${record.type}`, text: EVENT_TYPE_LABELS[record.type] ?? EVENT_TYPE_LABELS.other });
    meta.createSpan({ text: EVENT_STATUS_LABELS[record.status] ?? "待确认" });
    meta.createSpan({ text: `记录 ${record.sessionIndex + 1} · 事件 ${record.eventIndex + 1}` });
    body.createDiv({ cls: "mind-trace-trajectory-event-title", text: record.title });
    body.createEl("p", { cls: "mind-trace-trajectory-event-summary", text: record.summary });
    renderEventTraces(body, record.traces, { showEvidence: false });
    if (record.elements.length > 0) {
      const elements = body.createDiv({ cls: "mind-trace-trajectory-event-elements", attr: { "aria-label": "事件实体" } });
      for (const element of record.elements) {
        const chip = elements.createSpan({ cls: `mind-trace-trajectory-event-entity is-${element.kind}${eventElementKey(element) === selectedEntityKey ? " is-selected" : ""}` });
        chip.createSpan({ cls: "mind-trace-trajectory-event-entity-kind", text: EVENT_KIND_LABELS[element.kind] ?? EVENT_KIND_LABELS.topic });
        chip.createSpan({ text: element.name });
      }
    }
    if (record.relations.length > 0) {
      const relations = body.createDiv({ cls: "mind-trace-trajectory-event-relations", attr: { "aria-label": "明确关系" } });
      for (const relation of record.relations) {
        relations.createSpan({ text: `${relation.subject.name} —${relation.label}→ ${relation.object.name}` });
      }
    }
    const open = () => void this.openJournalFile(record.filePath, record.sessionIndex, record);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  }
  renderJournal(container) {
    const draft = this.plugin.draft ?? createDraft(this.plugin.settings);
    draft.entryDate = draftEntryDate(draft);
    const shell = container.createDiv({
      cls: `mind-trace-journal-shell ${draft.generated !== null ? "is-preview" : draft.step === 0 ? "is-checkin" : "is-question"}`,
      attr: { "aria-busy": this.busy ? "true" : "false" }
    });
    const header = shell.createDiv({ cls: "mind-trace-journal-header" });
    const heading = header.createDiv();
    const headerCopy = this.headerCopy(draft);
    heading.createDiv({
      cls: "mind-trace-eyebrow",
      text: headerCopy.eyebrow
    });
    heading.createDiv({
      cls: "mind-trace-journal-title",
      text: headerCopy.title,
      attr: { role: "heading", "aria-level": "1" }
    });
    heading.createEl("p", { text: headerCopy.description });
    this.renderEntryDate(heading, draft);
    if (this.plugin.draft !== null) {
      const clearButton = header.createEl("button", {
        cls: "mind-trace-clear-button",
        text: "清除草稿",
        attr: { type: "button", "aria-label": "清除未完成草稿" }
      });
      clearButton.disabled = this.busy;
      clearButton.addEventListener("click", () => {
        void this.clearDraft();
      });
    }
    if (!this.plugin.isProviderConfigured()) {
      const setup = shell.createDiv({ cls: "mind-trace-empty-state" });
      setup.createDiv({
        cls: "mind-trace-empty-mark",
        text: "连接"
      });
      setup.createDiv({
        cls: "mind-trace-empty-title",
        text: "先选择一个模型服务",
        attr: { role: "heading", "aria-level": "2" }
      });
      setup.createEl("p", {
        text: "配置模型名称和 API Key 后，就可以开始第一篇心迹日记。"
      });
      const button = setup.createEl("button", {
        cls: "mod-cta",
        text: "打开设置",
        attr: { type: "button" }
      });
      button.addEventListener("click", () => {
        this.plugin.openSettings();
      });
      return;
    }
    if (this.busy) {
      const loading = shell.createDiv({
        cls: "mind-trace-loading",
        attr: { role: "status" }
      });
      loading.createSpan({
        cls: "mind-trace-loading-ink",
        attr: { "aria-hidden": "true" }
      });
      const statusCopy = loading.createSpan({ cls: "mind-trace-llm-status-copy" });
      attachLlmActivityStatus(statusCopy, this.plugin, this.busyText);
    }
    if (draft.generated !== null) {
      this.renderPreview(shell, draft);
    } else if (draft.step === 0) {
      this.renderRatings(shell, draft);
    } else {
      this.renderQuestion(shell, draft);
    }
  }
  renderEntryDate(container, draft) {
    const entryDate = draftEntryDate(draft);
    const dateRow = container.createDiv({ cls: "mind-trace-entry-date" });
    dateRow.createSpan({ text: draft.step === 0 && draft.generated === null ? "记录日期" : "归属日期" });
    if (draft.step === 0 && draft.generated === null) {
      const input = dateRow.createEl("input", {
        attr: {
          type: "date",
          value: entryDate,
          max: localDateString(/* @__PURE__ */ new Date()),
          "aria-label": "日记归属日期"
        }
      });
      input.disabled = this.busy;
      input.addEventListener("change", () => {
        const selected = parseLocalDate(input.value);
        const today = localDateString(/* @__PURE__ */ new Date());
        if (selected === null || input.value > today) {
          input.value = entryDate;
          showMindTraceFieldError(input, "只能选择今天或过去的日期");
          return;
        }
        draft.entryDate = input.value;
        void this.plugin.setDraft(draft);
      });
    } else {
      dateRow.createEl("strong", { text: entryDate });
    }
    if (entryDate < localDateString(/* @__PURE__ */ new Date())) {
      dateRow.createSpan({
        cls: "mind-trace-entry-date-note",
        text: "补记 · 问题里的“今天”指这一天"
      });
    }
  }
  headerCopy(draft) {
    if (draft.generated !== null) {
      return {
        eyebrow: "今日心迹 \xB7 定稿前校样",
        title: "把今天收好",
        description: "锁定前再读一遍；这里仍然可以修改，保存后会变成安静的阅读版式。"
      };
    }
    if (draft.step === 0) {
      return {
        eyebrow: "两三分钟的日记",
        title: "给今天留一点位置",
        description: "先标记此刻的状态，再把今天从早到晚轻轻扫一遍。"
      };
    }
    return {
      eyebrow: "今日心迹 \xB7 正在记录",
      title: "慢一点，听听今天",
      description: "不需要写得完整，只写下此刻真实想到的内容。"
    };
  }
  renderRatings(container, draft) {
    const checkIn = container.createDiv({
      cls: "mind-trace-checkin"
    });
    const lead = checkIn.createDiv({
      cls: "mind-trace-checkin-lead"
    });
    lead.createDiv({
      cls: "mind-trace-section-kicker",
      text: "此刻的状态"
    });
    lead.createEl("p", {
      text: "不必解释，也不必判断。点一下最接近你的数字。"
    });
    const ratingValues = { ...draft.ratings };
    const ratingContainer = checkIn.createDiv({
      cls: "mind-trace-checkin-grid"
    });
    const summary = checkIn.createEl("p", {
      cls: "mind-trace-checkin-summary"
    });
    const updateSummary = () => {
      summary.textContent = [
        `心情${ratingStateWord("mood", ratingValues.mood)}`,
        `精力${ratingStateWord("energy", ratingValues.energy)}`,
        `压力${ratingStateWord("stress", ratingValues.stress)}`
      ].join(" \xB7 ");
    };
    for (const [key, label, metaphor, low, high] of [
      ["mood", "心情", "内在天气", "低落", "明亮"],
      ["energy", "精力", "可用电量", "耗尽", "充沛"],
      ["stress", "压力", "肩上重量", "松弛", "紧绷"]
    ]) {
      const card = ratingContainer.createEl("section", {
        cls: `mind-trace-checkin-card mind-trace-checkin-${key}`
      });
      const cardHeading = card.createDiv({
        cls: "mind-trace-checkin-card-heading"
      });
      const cardCopy = cardHeading.createDiv();
      cardCopy.createDiv({
        cls: "mind-trace-checkin-card-title",
        text: label,
        attr: { role: "heading", "aria-level": "2" }
      });
      cardCopy.createSpan({ text: metaphor });
      const value = cardHeading.createEl("output", {
        attr: { "aria-live": "polite" }
      });
      const wordDisplay = value.createSpan({
        cls: "mind-trace-checkin-word",
        text: ratingStateWord(key, ratingValues[key])
      });
      const valueDisplay = value.createSpan({
        cls: "mind-trace-checkin-value",
        text: String(ratingValues[key])
      });
      value.createSpan({
        cls: "mind-trace-checkin-total",
        text: "/ 5"
      });
      const strip = card.createDiv({
        cls: "mind-trace-checkin-strip",
        attr: { "aria-hidden": "true" }
      });
      const stripThumb = strip.createDiv({
        cls: "mind-trace-checkin-strip-thumb"
      });
      const positionThumb = (score) => {
        stripThumb.style.left = `calc(${(score - 1) * 25}% - ${(score - 1) * 3}px)`;
      };
      positionThumb(ratingValues[key]);
      const scale = card.createDiv({
        cls: "mind-trace-checkin-scale",
        attr: {
          role: "group",
          "aria-label": `${label}评分`
        }
      });
      const buttons = [];
      for (let score = 1; score <= 5; score += 1) {
        const button2 = scale.createEl("button", {
          text: String(score),
          attr: {
            type: "button",
            "aria-label": `${label} ${score} 分，${ratingStateWord(key, score)}`,
            "aria-pressed": String(score === ratingValues[key])
          }
        });
        button2.addEventListener("click", () => {
          ratingValues[key] = score;
          valueDisplay.textContent = String(score);
          wordDisplay.textContent = ratingStateWord(key, score);
          positionThumb(score);
          for (const [index, scaleButton] of buttons.entries()) {
            const active = index + 1 === score;
            scaleButton.toggleClass("is-selected", active);
            scaleButton.setAttribute("aria-pressed", String(active));
          }
          updateSummary();
        });
        buttons.push(button2);
      }
      buttons[ratingValues[key] - 1]?.addClass("is-selected");
      const anchors = card.createDiv({
        cls: "mind-trace-checkin-anchors"
      });
      anchors.createSpan({ text: low });
      anchors.createSpan({ text: high });
    }
    updateSummary();
    const footer = checkIn.createDiv({
      cls: "mind-trace-checkin-footer"
    });
    footer.appendChild(summary);
    const button = footer.createEl("button", {
      cls: "mod-cta mind-trace-primary-button",
      text: "开始回看今天",
      attr: { type: "button" }
    });
    button.disabled = this.busy;
    button.addEventListener("click", () => {
      draft.ratings = ratingValues;
      draft.step = 1;
      void this.plugin.setDraft(draft);
    });
  }
  renderQuestion(container, draft) {
    const coreQuestions = draftCoreQuestions(draft);
    const adaptiveQuestionLimit = draftAdaptiveQuestionLimit(draft);
    const coreQuestion = draft.step <= coreQuestions.length ? coreQuestions[draft.step - 1] : void 0;
    const question = coreQuestion ?? draft.pendingQuestion;
    const conversation = container.createEl("section", {
      cls: `mind-trace-conversation is-timeline ${draft.answers.length > 0 ? "has-history" : ""}`
    });
    const contextRail = conversation.createEl("aside", {
      cls: "mind-trace-record-context",
      attr: {
        "aria-label": "本次记录进度和状态"
      }
    });
    this.renderRecordContext(contextRail, draft, coreQuestions, adaptiveQuestionLimit);
    const flow = conversation.createDiv({
      cls: "mind-trace-record-flow"
    });
    this.renderTimelineHistory(flow, draft);
    if (question === null) {
      const recovery = flow.createDiv({
        cls: "mind-trace-decision-card mind-trace-record-decision"
      });
      const decisionMark = recovery.createDiv({ cls: "mind-trace-decision-mark", attr: { "aria-hidden": "true" } });
      (0, import_obsidian4.setIcon)(decisionMark, "check");
      recovery.createDiv({
        cls: "mind-trace-section-kicker",
        text: "核心记录已经完成"
      });
      recovery.createDiv({
        cls: "mind-trace-decision-title",
        text: draft.adaptiveCount >= adaptiveQuestionLimit ? "这些内容，已经足够写成今天" : "要不要再往里看一点？",
        attr: { role: "heading", "aria-level": "2" }
      });
      recovery.createEl("p", {
        text: draft.adaptiveCount >= adaptiveQuestionLimit ? "接下来会整理成日记、反思洞察和一个明日微行动。" : "心迹可以根据刚才的内容再问一个问题；如果此刻已经足够，也可以直接整理。"
      });
      const actions2 = recovery.createDiv({ cls: "mind-trace-actions" });
      if (draft.adaptiveCount < adaptiveQuestionLimit) {
        const continueButton = actions2.createEl("button", {
          cls: "mod-cta",
          text: "再问我一个问题",
          attr: { type: "button" }
        });
        continueButton.disabled = this.busy;
        continueButton.addEventListener("click", () => {
          void this.decideFollowUp(draft);
        });
      }
      const generateButton = actions2.createEl("button", {
        cls: draft.adaptiveCount >= adaptiveQuestionLimit ? "mod-cta" : "",
        text: draft.adaptiveCount >= adaptiveQuestionLimit ? "整理成日记" : "现在就整理",
        attr: { type: "button" }
      });
      generateButton.disabled = this.busy;
      generateButton.addEventListener("click", () => {
        void this.generateEntry(draft);
      });
      if (draft.answers.length > 0) {
        this.scrollTimelineTo(recovery);
      }
      return;
    }
    const isAdaptiveQuestion = coreQuestion === void 0;
    const progress = isAdaptiveQuestion ? `个性化追问 · 第 ${draft.adaptiveCount + 1} 个` : `核心问题 ${draft.step}/${coreQuestions.length}`;
    const activeStep = isAdaptiveQuestion ? draft.adaptiveCount + 1 : draft.step;
    const writingStage = flow.createDiv({
      cls: "mind-trace-writing-stage"
    });
    const margin = writingStage.createDiv({
      cls: "mind-trace-writing-margin",
      attr: { "aria-hidden": "true" }
    });
    const index = margin.createDiv({
      cls: "mind-trace-writing-index"
    });
    index.createSpan({
      text: String(activeStep).padStart(2, "0")
    });
    if (!isAdaptiveQuestion) {
      index.createSpan({
        text: `/${String(coreQuestions.length).padStart(2, "0")}`
      });
    }
    margin.createDiv({
      cls: "mind-trace-writing-rule"
    });
    const sheet = writingStage.createDiv({
      cls: "mind-trace-writing-sheet"
    });
    sheet.createDiv({
      cls: "mind-trace-progress",
      text: progress
    });
    sheet.createDiv({
      cls: "mind-trace-question",
      text: question,
      attr: {
        role: "heading",
        "aria-level": "2"
      }
    });
    sheet.createEl("p", {
      cls: "mind-trace-question-hint",
      text: isAdaptiveQuestion ? "AI 会结合本次回答，并在相关时参考近期日记；信息足够就会提前结束。" : "写下第一反应就好；几个片段、关键词或一句完整的话都可以。"
    });
    const answer = sheet.createEl("textarea", {
      cls: "mind-trace-question-editor",
      attr: {
        rows: "8",
        placeholder: "从这里开始写…",
        "data-mind-trace-focus-key": "journal-answer"
      }
    });
    autoGrow(answer);
    answer.disabled = this.busy;
    const footer = sheet.createDiv({
      cls: "mind-trace-question-footer"
    });
    footer.createSpan({
      text: "写到能认出今天，就够了"
    });
    const actions = footer.createDiv({ cls: "mind-trace-actions" });
    const submit = actions.createEl("button", {
      cls: "mod-cta",
      text: coreQuestion === void 0 ? "继续" : "下一题",
      attr: { type: "button" }
    });
    submit.disabled = this.busy;
    submit.addEventListener("click", () => {
      const value = answer.value.trim();
      if (value.length === 0) {
        showMindTraceFieldError(answer, "先写下一点内容再继续");
        return;
      }
      this.leaveQuestionCard(
        writingStage,
        answer,
        actions,
        () => this.submitAnswer(
          draft,
          question,
          value,
          coreQuestion !== void 0
        )
      );
    });
    if (coreQuestion === void 0) {
      const skip = actions.createEl("button", {
        text: "跳过并生成日记",
        attr: { type: "button" }
      });
      skip.disabled = this.busy;
      skip.addEventListener("click", () => {
        draft.pendingQuestion = null;
        this.leaveQuestionCard(
          writingStage,
          answer,
          actions,
          () => this.persistAndGenerate(draft)
        );
      });
    }
    answer.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submit.click();
      }
    });
    if (draft.answers.length > 0) {
      this.scrollTimelineTo(writingStage, answer);
    }
  }
  renderRecordContext(container, draft, coreQuestions, adaptiveQuestionLimit) {
    const answered = Array.isArray(draft.answers) ? draft.answers.length : 0;
    const coreTotal = Math.max(1, coreQuestions.length);
    const coreAnswered = Math.min(
      coreTotal,
      Array.isArray(draft.answers) ? draft.answers.filter((answer) => answer?.kind === "core").length : 0
    );
    const activeCore = draft.step > 0 && draft.step <= coreTotal ? draft.step : Math.min(coreTotal, draft.step || 1);
    const answeredLabel = `${answered} 个回答已保存`;
    const heading = container.createDiv({ cls: "mind-trace-record-context-heading" });
    heading.createDiv({
      cls: "mind-trace-record-context-kicker",
      text: "本次记录"
    });
    heading.createEl("h2", {
      cls: "mind-trace-record-context-title",
      text: "进度与状态"
    });
    const progressList = container.createEl("ol", {
      cls: "mind-trace-record-context-progress",
      attr: {
        "aria-label": "记录进度"
      }
    });
    const coreItem = progressList.createEl("li", {
      cls: "mind-trace-record-context-progress-item"
    });
    const coreLabel = coreItem.createDiv({ cls: "mind-trace-record-context-progress-label" });
    coreLabel.createSpan({ text: "核心问题" });
    coreLabel.createEl("strong", { text: `${coreAnswered}/${coreTotal}` });
    const coreProgress = coreItem.createEl("progress", {
      attr: {
        value: String(coreAnswered),
        max: String(coreTotal),
        "aria-label": `核心问题已完成 ${coreAnswered}/${coreTotal}`
      }
    });
    coreProgress.createSpan({ text: `${coreAnswered}/${coreTotal}` });
    const adaptiveItem = progressList.createEl("li", {
      cls: "mind-trace-record-context-progress-item"
    });
    const adaptiveLabel = adaptiveItem.createDiv({ cls: "mind-trace-record-context-progress-label" });
    const adaptiveCount = Math.max(0, Number(draft.adaptiveCount) || 0);
    adaptiveLabel.createSpan({ text: "按需追问" });
    adaptiveLabel.createEl("strong", { text: `${adaptiveCount} / 最多 ${adaptiveQuestionLimit}` });
    const adaptiveProgress = adaptiveItem.createEl("progress", {
      attr: {
        value: String(Math.min(adaptiveQuestionLimit, adaptiveCount)),
        max: String(Math.max(1, adaptiveQuestionLimit)),
        "aria-label": `按需追问已完成 ${adaptiveCount} 个，最多 ${adaptiveQuestionLimit} 个`
      }
    });
    adaptiveProgress.createSpan({ text: `${adaptiveCount} / 最多 ${adaptiveQuestionLimit}` });
    const stateList = container.createEl("dl", {
      cls: "mind-trace-record-context-state"
    });
    for (const [key, label] of [["mood", "心情"], ["energy", "精力"], ["stress", "压力"]]) {
      const row = stateList.createDiv({ cls: `mind-trace-record-context-state-row is-${key}` });
      row.createEl("dt", { text: label });
      const score = Number.isFinite(draft.ratings?.[key]) ? draft.ratings[key] : "—";
      row.createEl("dd", { text: score === "—" ? "—" : `${score}/5 · ${ratingStateWord(key, score)}` });
    }
    const answerCount = container.createDiv({
      cls: "mind-trace-record-context-answer-count",
      attr: { "aria-live": "polite" }
    });
    answerCount.createSpan({ text: "已保存回答" });
    answerCount.createEl("strong", { text: String(answered) });
    answerCount.createEl("small", { text: answeredLabel });
    const current = container.createEl("p", {
      cls: "mind-trace-record-context-current"
    });
    if (draft.pendingQuestion !== null) {
      current.textContent = `当前为个性化追问 · 第 ${draft.adaptiveCount + 1} 个`;
    } else if (draft.step > coreTotal) {
      current.textContent = "核心问题已完成";
    } else {
      current.textContent = `当前核心问题 · 第 ${activeCore} 个`;
    }
  }
  renderTimelineHistory(container, draft) {
    if (draft.answers.length === 0) {
      return;
    }
    const history = container.createDiv({
      cls: "mind-trace-conversation-history",
      attr: {
        role: "list",
        "aria-label": "已经完成的问答"
      }
    });
    for (const [index, answer] of draft.answers.entries()) {
      const item = history.createEl("article", {
        cls: "mind-trace-conversation-history-item",
        attr: { role: "listitem" }
      });
      const rail = item.createDiv({
        cls: "mind-trace-conversation-history-rail",
        attr: { "aria-hidden": "true" }
      });
      rail.createSpan({
        cls: "mind-trace-conversation-history-index",
        text: String(index + 1).padStart(2, "0")
      });
      const copy = item.createDiv({
        cls: "mind-trace-conversation-history-copy"
      });
      const meta = copy.createDiv({
        cls: "mind-trace-conversation-history-meta"
      });
      meta.createDiv({
        cls: "mind-trace-conversation-history-kind",
        text: answer.kind === "core" ? "核心问题 \xB7 已完成" : "个性化追问 \xB7 已完成"
      });
      const edit = meta.createEl("button", {
        cls: "mind-trace-history-edit",
        text: "修改",
        attr: {
          type: "button",
          "aria-label": `修改第 ${index + 1} 个回答`
        }
      });
      copy.createDiv({
        cls: "mind-trace-conversation-history-question",
        text: answer.question,
        attr: { role: "heading", "aria-level": "3" }
      });
      const answerCopy = copy.createEl("p", {
        text: answer.answer
      });
      edit.addEventListener("click", () => {
        if (copy.querySelector(".mind-trace-history-edit-form") !== null) {
          return;
        }
        edit.disabled = true;
        answerCopy.style.display = "none";
        const form = copy.createEl("form", {
          cls: "mind-trace-history-edit-form"
        });
        const input = form.createEl("textarea", {
          cls: "mind-trace-history-edit-input",
          text: answer.answer,
          attr: {
            rows: "4",
            "aria-label": `第 ${index + 1} 个回答`
          }
        });
        autoGrow(input);
        const actions = form.createDiv({ cls: "mind-trace-actions" });
        const cancel = actions.createEl("button", {
          text: "取消",
          attr: { type: "button" }
        });
        const save = actions.createEl("button", {
          cls: "mod-cta",
          text: "保存修改",
          attr: { type: "submit" }
        });
        const finish = () => {
          form.remove();
          answerCopy.style.display = "";
          edit.disabled = false;
        };
        cancel.addEventListener("click", finish);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            finish();
          } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            form.requestSubmit();
          }
        });
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const value = input.value.trim();
          if (value.length === 0) {
            showMindTraceFieldError(input, "回答不能留空");
            return;
          }
          const previous = answer.answer;
          answer.answer = value;
          save.disabled = true;
          save.textContent = "保存中…";
          void this.plugin.saveDraftSilently(draft).then(() => {
            answerCopy.textContent = value;
            finish();
            showMindTraceNotice("回答已更新");
          }).catch((reason) => {
            answer.answer = previous;
            save.disabled = false;
            save.textContent = "保存修改";
            showMindTraceNotice(errorMessage(reason));
          });
        });
        this.ownerWindow.requestAnimationFrame(() => {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        });
      });
    }
  }
  scrollTimelineTo(element, focusTarget = null) {
    this.ownerWindow.requestAnimationFrame(() => {
      this.ownerWindow.requestAnimationFrame(() => {
        const scroller = this.findScrollContainer(element);
        const scrollerRect = scroller.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const visibleElementHeight = Math.min(
          elementRect.height,
          Math.max(0, scroller.clientHeight - 48)
        );
        const top = scroller.scrollTop + elementRect.top - scrollerRect.top - (scroller.clientHeight - visibleElementHeight) / 2;
        scroller.scrollTo({
          top: Math.max(0, top),
          behavior: this.ownerWindow.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches ? "auto" : "smooth"
        });
        focusTarget?.focus({ preventScroll: true });
      });
    });
  }
  findScrollContainer(element) {
    let parent = element.parentElement;
    while (parent !== null) {
      const overflowY = this.ownerWindow.getComputedStyle(parent).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return this.containerEl.children[1];
  }
  leaveQuestionCard(stage, answer, actions, next) {
    answer.disabled = true;
    for (const button of actions.querySelectorAll("button")) {
      button.disabled = true;
    }
    if (this.ownerWindow.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void next();
      return;
    }
    stage.addClass("is-leaving");
    this.ownerWindow.setTimeout(() => {
      void next();
    }, 180);
  }
  renderPreview(container, draft) {
    const generated = draft.generated;
    if (generated === null) {
      return;
    }
    const generatedEvents = Array.isArray(generated.events) ? generated.events : [];
    container.addClass("is-preview");
    const ratingEditors = this.renderRatingComparison(container, draft);
    const reviewMap = container.createDiv({
      cls: "mind-trace-review-map",
      attr: {
        role: "list",
        "aria-label": "日记内容概览"
      }
    });
    for (const [label, value] of [
      ["正文", "1 篇"],
      ["今日事件", `${generatedEvents.length} 件`],
      ["今日切片", `${generated.facets.length} 个`],
      ["反思洞察", `${generated.insights.length} 条`],
      ["明日行动", "1 步"]
    ]) {
      const item = reviewMap.createDiv({
        cls: "mind-trace-review-map-item",
        attr: { role: "listitem" }
      });
      item.createSpan({ text: label });
      item.createEl("strong", { text: value });
    }
    const diarySection = container.createEl("section", {
      cls: "mind-trace-editor-card mind-trace-diary-card"
    });
    const diaryHeading = diarySection.createDiv({
      cls: "mind-trace-card-heading mind-trace-diary-heading"
    });
    const diaryTitle = diaryHeading.createDiv();
    diaryTitle.createDiv({
      cls: "mind-trace-diary-kicker",
      text: "今日 \xB7 未保存"
    });
    diaryTitle.createDiv({
      cls: "mind-trace-card-title mind-trace-diary-title",
      text: "今天的正文",
      attr: { role: "heading", "aria-level": "2" }
    });
    const diaryMeta = diaryHeading.createDiv({
      cls: "mind-trace-diary-meta"
    });
    diaryMeta.createSpan({ text: "日记校样" });
    diaryMeta.createSpan({ text: "可直接修改" });
    const diaryWriting = diarySection.createDiv({
      cls: "mind-trace-diary-writing"
    });
    const diary = diaryWriting.createEl("textarea", {
      cls: "mind-trace-editor-area mind-trace-diary-editor",
      text: generated.diary,
      attr: {
        rows: "9",
        "aria-label": "日记正文"
      }
    });
    autoGrow(diary);
    const eventsSection = container.createEl("section", {
      cls: "mind-trace-event-section mind-trace-event-section-editing"
    });
    const eventsHeading = eventsSection.createDiv({ cls: "mind-trace-card-heading" });
    const eventsTitle = eventsHeading.createDiv();
    eventsTitle.createDiv({ cls: "mind-trace-card-title", text: "今天发生了什么", attr: { role: "heading", "aria-level": "2" } });
    eventsTitle.createEl("p", { text: "已提取事件事实、进展、明确体验与未决方向；保存后仍可逐条校正。" });
    eventsHeading.createSpan({ text: `${generatedEvents.length} 件事件 · 自动采用` });
    const eventDigest = eventsSection.createDiv({ cls: "mind-trace-event-preview-digest" });
    if (generatedEvents.length === 0) {
      eventDigest.createEl("p", { text: "今天没有提取到明确事件。" });
    } else {
      const list = eventDigest.createEl("ul");
      for (const event of generatedEvents.slice(0, 6)) {
        const item = list.createEl("li");
        item.createEl("strong", { text: `${event.title} · ${EVENT_STATUS_LABELS[event.status]}` });
        const argumentText = event.arguments.slice(0, 3).map((argument) => `${argument.label}：${argument.entity.name}`).join(" · ");
        const traceText = event.traces.length > 0 ? `${event.traces.length} 条体验/方向线索` : "无附加体验线索";
        item.createSpan({ text: [argumentText, traceText].filter(Boolean).join(" · ") });
      }
      if (generatedEvents.length > 6) {
        eventDigest.createEl("p", { cls: "mind-trace-event-preview-more", text: `另有 ${generatedEvents.length - 6} 件事件，将一并保存。` });
      }
    }
    const facetsSection = container.createEl("section", {
      cls: "mind-trace-facets-section"
    });
    const facetsHeading = facetsSection.createDiv({
      cls: "mind-trace-card-heading"
    });
    facetsHeading.createDiv({
      cls: "mind-trace-card-title",
      text: "今天由这些组成",
      attr: { role: "heading", "aria-level": "2" }
    });
    facetsHeading.createSpan({ text: "智能切片 \xB7 可编辑" });
    const facetsGrid = facetsSection.createDiv({
      cls: "mind-trace-facets-grid"
    });
    const facetInputs = generated.facets.map((facet, index) => {
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
      facetHeader.createSpan({
        cls: "mind-trace-facet-edit-hint",
        text: "点标题可修改"
      });
      const category = card.createEl("input", {
        cls: "mind-trace-facet-category",
        attr: {
          type: "text",
          value: facet.category,
          maxlength: "12",
          "aria-label": `智能切片 ${index + 1} 类别`
        }
      });
      card.createDiv({
        cls: "mind-trace-facet-divider",
        attr: { "aria-hidden": "true" }
      });
      const summary = card.createEl("textarea", {
        cls: "mind-trace-facet-summary",
        text: facet.summary,
        attr: {
          rows: "2",
          "aria-label": `智能切片 ${facet.category} 总结`
        }
      });
      autoGrow(summary);
      return { category, summary };
    });
    const reflectionGrid = container.createDiv({
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
      text: "我从今天看见",
      attr: { role: "heading", "aria-level": "2" }
    });
    insightsHeading.createSpan({ text: "像页边批注一样，留下一层理解" });
    const insightInputs = generated.insights.map((insight, index) => {
      const row = insightsSection.createDiv({
        cls: "mind-trace-insight-row"
      });
      row.createSpan({
        cls: "mind-trace-insight-mark",
        text: `观察 ${index + 1}`,
        attr: { "aria-hidden": "true" }
      });
      const input = row.createEl("textarea", {
        cls: "mind-trace-editor-area mind-trace-insight-editor",
        text: insight,
        attr: {
          rows: "2",
          "aria-label": "反思洞察"
        }
      });
      autoGrow(input);
      return input;
    });
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
      text: "明天最小的一步",
      attr: { role: "heading", "aria-level": "2" }
    });
    actionHeading.createSpan({ text: "只做这一小步" });
    const actionBody = actionSection.createDiv({
      cls: "mind-trace-action-body"
    });
    const action = actionBody.createEl("textarea", {
      cls: "mind-trace-editor-area mind-trace-compact-editor",
      text: generated.microAction,
      attr: {
        rows: "3",
        "aria-label": "明日微行动"
      }
    });
    autoGrow(action);
    const questionSection = nextColumn.createEl("section", {
      cls: "mind-trace-editor-card mind-trace-question-card"
    });
    const questionHeading = questionSection.createDiv({
      cls: "mind-trace-card-heading"
    });
    questionHeading.createDiv({
      cls: "mind-trace-card-title",
      text: "留给明天的一个问题",
      attr: { role: "heading", "aria-level": "2" }
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
    const selfQuestion = questionBody.createEl("textarea", {
      cls: "mind-trace-editor-area mind-trace-compact-editor",
      text: generated.selfQuestion,
      attr: {
        rows: "3",
        "aria-label": "留给自己的问题"
      }
    });
    autoGrow(selfQuestion);
    const themesSection = container.createEl("section", {
      cls: "mind-trace-themes-section"
    });
    const themesHeading = themesSection.createDiv({
      cls: "mind-trace-card-heading"
    });
    themesHeading.createDiv({
      cls: "mind-trace-card-title",
      text: "今天关于",
      attr: { role: "heading", "aria-level": "2" }
    });
    themesHeading.createSpan({ text: "最多 5 个主题" });
    const themeContainer = themesSection.createDiv({
      cls: "mind-trace-theme-editor"
    });
    const themeEditor = new ThemeEditor(themeContainer, generated.themes);
    const footer = container.createDiv({
      cls: "mind-trace-preview-footer"
    });
    const footerCopy = footer.createDiv();
    footerCopy.createDiv({
      cls: "mind-trace-preview-ready",
      text: "准备定稿了吗？"
    });
    footerCopy.createEl("p", {
      text: "保存后会进入阅读版式；事件将自动写入，并可直接从关系图旁逐条校正。"
    });
    const actions = footer.createDiv({ cls: "mind-trace-actions" });
    const regenerate = actions.createEl("button", {
      cls: "mind-trace-secondary-button",
      text: "重新整理",
      attr: { type: "button" }
    });
    regenerate.disabled = this.busy;
    regenerate.addEventListener("click", () => {
      this.generateEntry(draft, true);
    });
    const save = actions.createEl("button", {
      cls: "mod-cta mind-trace-save-button",
      text: "锁定并保存",
      attr: { type: "button" }
    });
    save.disabled = this.busy;
    save.addEventListener("click", () => {
      const entry = this.previewEntry(
        diary,
        generatedEvents,
        facetInputs,
        insightInputs,
        action,
        selfQuestion,
        themeEditor
      );
      if (entry === null) {
        return;
      }
      draft.generated = entry;
      draft.ratings = {
        mood: ratingEditors.mood.getValue(),
        energy: ratingEditors.energy.getValue(),
        stress: ratingEditors.stress.getValue()
      };
      void this.saveDraftEntry(draft, entry);
    });
  }
  renderRatingComparison(container, draft) {
    const assessment = draft.aiAssessment;
    const hasAssessment = assessment !== void 0;
    const section = container.createEl("section", {
      cls: "mind-trace-rating-comparison"
    });
    const heading = section.createDiv({
      cls: "mind-trace-rating-comparison-heading"
    });
    const copy = heading.createDiv();
    copy.createDiv({
      cls: "mind-trace-section-kicker",
      text: hasAssessment ? "状态对照 \xB7 AI 盲评" : "状态回看"
    });
    copy.createDiv({
      cls: "mind-trace-rating-comparison-title",
      text: hasAssessment ? "同一天，两种读法" : "这是我此刻的感受",
      attr: { role: "heading", "aria-level": "2" }
    });
    copy.createEl("p", {
      text: hasAssessment ? "你的分数来自内在感受；AI 没有看到它，只根据回答中的语言留下另一种观察。差异不是对错。" : "可以在保存前微调。重新整理后，AI 会在看不到自评的情况下留下另一种观察。"
    });
    heading.createSpan({
      cls: "mind-trace-rating-comparison-badge",
      text: hasAssessment ? "独立观察" : "等待 AI 观察"
    });
    const grid = section.createDiv({
      cls: "mind-trace-rating-comparison-grid"
    });
    const editors: Record<string, any> = {};
    for (const [key, label] of [
      ["mood", "心情"],
      ["energy", "精力"],
      ["stress", "压力"]
    ]) {
      const detail = assessment?.[key];
      const card = grid.createEl("section", {
        cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${key}`
      });
      const cardHeading = card.createDiv({
        cls: "mind-trace-rating-card-heading"
      });
      cardHeading.createDiv({
        cls: "mind-trace-rating-card-title",
        text: label,
        attr: { role: "heading", "aria-level": "3" }
      });
      const difference = cardHeading.createSpan({
        cls: "mind-trace-rating-difference",
        text: detail === void 0 ? "等待对照" : ratingDifferenceText(draft.ratings[key], detail.score)
      });
      const selfEditor = card.createDiv({
        cls: "mind-trace-rating-self"
      });
      const selfState = card.createDiv({
        cls: "mind-trace-rating-state"
      });
      const updateSelf = (value) => {
        selfState.textContent = ratingStateWord(key, value);
        if (detail !== void 0) {
          difference.textContent = ratingDifferenceText(
            value,
            detail.score
          );
          difference.toggleClass(
            "is-aligned",
            value === detail.score
          );
        }
      };
      editors[key] = new RatingScaleEditor(
        selfEditor,
        "我的感受",
        draft.ratings[key],
        updateSelf
      );
      updateSelf(draft.ratings[key]);
      const aiReading = card.createDiv({
        cls: "mind-trace-rating-ai"
      });
      const aiHeading = aiReading.createDiv({
        cls: "mind-trace-rating-ai-heading"
      });
      aiHeading.createSpan({ text: "AI 观察" });
      aiHeading.createEl("output", {
        text: detail === void 0 ? "—" : `${detail.score}/5 \xB7 ${ratingStateWord(key, detail.score)}`
      });
      const aiScale = aiReading.createDiv({
        cls: "mind-trace-rating-ai-scale",
        attr: { "aria-hidden": "true" }
      });
      for (let score = 1; score <= 5; score += 1) {
        aiScale.createSpan({
          cls: detail?.score === score ? "mind-trace-rating-ai-point is-selected" : "mind-trace-rating-ai-point",
          text: String(score)
        });
      }
      aiReading.createEl("p", {
        text: detail === void 0 ? "完成一次新的整理后，这里会显示 AI 的独立判断依据。" : detail.reason
      });
    }
    return editors;
  }
  previewEntry(diary, events, facets, insights, action, selfQuestion, themes) {
    const facetValues = facets.map((facet) => ({
      category: facet.category.value.trim(),
      summary: facet.summary.value.trim()
    }));
    const insightValues = insights.map((value) => value.value.trim()).filter((value) => value.length > 0);
    const themeValues = themes.getValues();
    let eventValues;
    try {
      eventValues = validateEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      const eventTarget = diary.closest(".mind-trace-journal-shell")?.querySelector(".mind-trace-event-preview-digest") ?? diary;
      if (eventTarget instanceof this.ownerWindow.HTMLElement) eventTarget.tabIndex = -1;
      showMindTraceFieldError(eventTarget, error instanceof Error ? error.message : "今日事件格式不正确");
      return null;
    }
    const emptyPrimary = [diary, action, selfQuestion].find((input) => input.value.trim().length === 0);
    if (emptyPrimary !== void 0) {
      showMindTraceFieldError(emptyPrimary, emptyPrimary === diary ? "日记正文不能为空" : emptyPrimary === action ? "明日微行动不能为空" : "留给自己的问题不能为空");
      return null;
    }
    const invalidFacetIndex = facetValues.findIndex((facet) => facet.category.length === 0 || facet.summary.length === 0);
    if (invalidFacetIndex !== -1) {
      const facet = facets[invalidFacetIndex];
      showMindTraceFieldError(facetValues[invalidFacetIndex].category.length === 0 ? facet.category : facet.summary, "智能切片的类别和总结不能为空");
      return null;
    }
    if (facetValues.length < 2 || facetValues.length > 6) {
      showMindTraceFieldError(facets[0]?.category ?? diary, "智能切片需要保留 2–6 条");
      return null;
    }
    if (new Set(facetValues.map((facet) => facet.category)).size !== facetValues.length) {
      const duplicate = facetValues.findIndex((facet, index) => facetValues.findIndex((candidate) => candidate.category === facet.category) !== index);
      showMindTraceFieldError(facets[Math.max(0, duplicate)]?.category ?? diary, "智能切片的类别不能重复");
      return null;
    }
    if (insightValues.length < 2 || insightValues.length > 4) {
      showMindTraceFieldError(insights.find((input) => input.value.trim().length === 0) ?? insights[0] ?? diary, "反思洞察需要保留 2–4 条");
      return null;
    }
    if (themeValues.length < 1 || themeValues.length > 5) {
      showMindTraceFieldError(themes.input ?? diary, "主题需要保留 1–5 个");
      return null;
    }
    return {
      diary: diary.value.trim(),
      events: eventValues,
      facets: facetValues,
      insights: insightValues,
      microAction: action.value.trim(),
      selfQuestion: selfQuestion.value.trim(),
      themes: [...new Set(themeValues)]
    };
  }
  async submitAnswer(draft, question, answer, core) {
    recordAnswer(draft, question, answer, core);
    await this.plugin.setDraft(draft);
    if (draft.step <= draftCoreQuestions(draft).length) {
      return;
    }
    if (draft.adaptiveCount >= draftAdaptiveQuestionLimit(draft)) {
      await this.generateEntry(draft);
    } else {
      await this.decideFollowUp(draft);
    }
  }
  async decideFollowUp(draft) {
    let shouldGenerate = false;
    await this.runBusy("正在准备一个贴合你的追问…", async () => {
      const history = await this.plugin.repository.recentContext(
        this.plugin.settings,
        parseLocalDate(draftEntryDate(draft)) ?? /* @__PURE__ */ new Date()
      );
      const decision = await generateFollowUp(
        this.plugin.createProvider(),
        draft,
        history
      );
      if (decision.continue && draft.adaptiveCount < draftAdaptiveQuestionLimit(draft)) {
        draft.pendingQuestion = decision.question;
        await this.plugin.setDraft(draft);
      } else {
        shouldGenerate = true;
      }
    });
    if (shouldGenerate) {
      this.generateEntry(draft);
    }
  }
  generateEntry(draft, regenerate = false) {
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "今日心迹 · 整理",
      title: regenerate ? "重新整理这篇日记？" : "把这些回答整理成日记",
      description: regenerate ? "当前校样中的未保存修改会被新的整理结果替换。原始问答和自评仍会保留。" : "心迹会参考本次回答和设置中的近期记录，生成日记、反思与状态对照。",
      confirm: regenerate,
      confirmLabel: regenerate ? "重新整理" : "开始整理",
      warning: regenerate,
      stages: ["读取记录上下文", "整理日记与反思", "评估状态对照", "生成校样"],
      run: async (update) => {
        this.busy = true;
        this.render(true);
        await this.generateEntryContent(draft, update);
        update({ stage: 4, total: 4, title: "生成校样", detail: "正在准备可以继续修改的日记校样。" });
        return draft;
      },
      onSuccess: async () => {
        this.busy = false;
        this.render(true);
        await new Promise((resolve) => this.ownerWindow.requestAnimationFrame(resolve));
      },
      onError: () => {
        this.busy = false;
        this.render(true);
      },
      onViewResult: () => {
        const container = this.containerEl.children[1];
        findMindTraceScroller(container).scrollTo({ top: 0, behavior: this.ownerWindow.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      },
      successTitle: "日记校样已经整理好",
      successDetail: "可以继续修改正文、事件、反思和主题，确认后再保存。",
      successLabel: "查看校样",
      backgroundSuccess: "日记校样已经整理好"
    });
  }
  async persistAndGenerate(draft) {
    await this.plugin.setDraft(draft);
    await this.generateEntry(draft);
  }
  async generateEntryContent(draft, onProgress = null) {
    this.busyText = "正在独立评估状态并整理日记…";
    onProgress?.({ stage: 1, total: 4, title: "读取记录上下文", detail: "正在读取与本次记录相关的近期日记。" });
    const provider = this.plugin.createProvider();
    const history = await this.plugin.repository.recentContext(
      this.plugin.settings,
      parseLocalDate(draftEntryDate(draft)) ?? /* @__PURE__ */ new Date()
    );
    onProgress?.({ stage: 2, total: 4, title: "整理日记与反思", detail: "正在生成日记、事件、洞察和下一步。" });
    const journalTask = generateJournal(
        provider,
        draft,
        history,
        this.plugin.settings
      );
    const ratingTask = generateRatingAssessment(provider, draft).then((value) => {
      onProgress?.({ stage: 3, total: 4, title: "评估状态对照", detail: "正在完成独立状态观察并等待日记整理结果。" });
      return value;
    });
    const [generated, assessment] = await Promise.all([journalTask, ratingTask]);
    draft.generated = generated;
    draft.aiAssessment = assessment;
    await this.plugin.setDraft(draft);
  }
  async saveDraftEntry(draft, entry) {
    await this.runBusy("正在保存日记…", async () => {
      await this.plugin.setDraft(draft);
      const file = await this.plugin.saveEntry(
        draft,
        entry,
        entryDateWithCurrentTime(draftEntryDate(draft))
      );
      await this.plugin.setDraft(null);
      showMindTraceNotice(`心迹已保存：${file.path}`);
      await this.leaf.setViewState({
        type: SAVED_JOURNAL_VIEW_TYPE,
        state: { file: file.path },
        active: true
      });
    });
  }
  async clearDraft() {
    if (this.plugin.draft === null) {
      return;
    }
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹 · 草稿",
      title: "清除未完成草稿？",
      description: "评分、问答和尚未保存的生成结果都会被清除，此操作无法撤销。",
      confirmLabel: "清除草稿",
      warning: true,
      stages: ["清除未完成内容"],
      run: async (update) => {
        update({ stage: 1, total: 1, title: "清除未完成内容", detail: "正在更新本地草稿状态。" });
        await this.plugin.saveDraftSilently(null);
      },
      onSuccess: () => {
        this.mode = "home";
        this.render();
      },
      successTitle: "草稿已清除",
      successDetail: "未完成的评分、问答和校样已经清除。",
      successLabel: "返回首页",
      backgroundSuccess: "心迹草稿已清除"
    });
  }
  async runBusy(text, action) {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.busyText = text;
    this.render(true);
    try {
      await action();
    } catch (error) {
      showMindTraceNotice(errorMessage(error), 8e3);
    } finally {
      this.busy = false;
      this.busyText = "";
      if (this.leaf.view === this) {
        this.render(true);
      }
    }
  }
};
