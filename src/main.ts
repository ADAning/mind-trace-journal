// src/main.ts
import * as import_obsidian7 from "obsidian";
import { computeObservationMaturity, observationEvidenceCatalog, observationFeedbackContext } from "./conversation";
import { credentialAvailable, resolveCredential } from "./credentials";
import { completedPeriod, draftEntryDate } from "./date-utils";
import { DEFAULT_SETTINGS, emptySelfObservation, normalizePluginSettings, normalizeSelfObservation } from "./defaults";
import { generateObservation } from "./generation";
import { JOURNAL_VIEW_TYPE, JournalView, errorMessage } from "./journal-view";
import { clearMetricsIndex, collectMetrics, metricsFileTracked, removeMetricsFile, renameMetricsFile, updateMetricsFile } from "./metrics";
import { PrivacyController } from "./privacy-controller";
import { HttpLlmProvider, OBSERVATION_VIEW_TYPE, SavedObservationView, isChatCompletionsProvider } from "./providers";
import { ReportCoordinator } from "./report-coordinator";
import { mindTraceWorkspaceDocument, showMindTraceNotice } from "./runtime-preamble";
import { JournalHistoryIndex, SAVED_JOURNAL_VIEW_TYPE, SavedJournalView, clearParsedJournalCaches, invalidateParsedJournal } from "./saved-journal";
import { SavedWeeklyReportView, WEEKLY_REPORT_VIEW_TYPE } from "./saved-weekly-report-view";
import { MindTraceSettingTab } from "./settings";
import { JournalRepository } from "./storage";
import { MonthlyReportRepository, ObservationRepository, WeeklyReportRepository, legacyObservationMarkdown } from "./weekly-report";

var MindTracePlugin = class extends import_obsidian7.Plugin {
  settings: any = structuredClone(DEFAULT_SETTINGS);
  draft: any = null;
  repository;
  weeklyReportRepository;
  monthlyReportRepository;
  observationRepository;
  legacySelfObservation = emptySelfObservation();
  historyIndex;
  reportCoordinator;
  sourceEditLeaves = /* @__PURE__ */ new WeakMap();
  privacyController;
  metricsListeners = /* @__PURE__ */ new Set<() => void>();
  draftListeners = /* @__PURE__ */ new Set<() => void>();
  llmActivities = /* @__PURE__ */ new Map();
  llmActivitySequence = 0;
  unloading = false;
  lifecycleAbortController = new AbortController();
  activeOperations = /* @__PURE__ */ new Set<{ cancelFromPlugin?: () => void }>();
  pendingTimeouts = /* @__PURE__ */ new Set();
  get ownerWindow() {
    return mindTraceWorkspaceDocument(this.app).defaultView ?? globalThis.window;
  }
  async onload() {
    this.unloading = false;
    this.lifecycleAbortController = new AbortController();
    await this.loadPluginData();
    const assertOperational = () => this.assertOperational();
    this.repository = new JournalRepository(this.app, assertOperational);
    this.weeklyReportRepository = new WeeklyReportRepository(this.app, assertOperational);
    this.monthlyReportRepository = new MonthlyReportRepository(this.app, assertOperational);
    this.observationRepository = new ObservationRepository(this.app, assertOperational);
    this.historyIndex = new JournalHistoryIndex(this);
    this.reportCoordinator = new ReportCoordinator(this);
    this.privacyController = new PrivacyController(this);
    this.registerView(
      JOURNAL_VIEW_TYPE,
      (leaf) => new JournalView(leaf, this)
    );
    this.registerView(
      SAVED_JOURNAL_VIEW_TYPE,
      (leaf) => new SavedJournalView(leaf, this)
    );
    this.registerView(
      WEEKLY_REPORT_VIEW_TYPE,
      (leaf) => new SavedWeeklyReportView(leaf, this)
    );
    this.registerView(
      OBSERVATION_VIEW_TYPE,
      (leaf) => new SavedObservationView(leaf, this)
    );
    this.addRibbonIcon("notebook-pen", "打开心迹记录", () => {
      void this.openJournal();
    });
    this.addCommand({
      id: "open-mind-trace-journal",
      name: "打开心迹记录",
      callback: () => {
        void this.openJournal();
      }
    });
    this.addCommand({
      id: "lock-mind-trace",
      name: "立即锁定心迹",
      callback: () => {
        this.lockPrivacy(true);
      }
    });
    this.addSettingTab(new MindTraceSettingTab(this.app, this));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.extension === "md") {
          const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
          const tracked = metricsFileTracked(this.app, file.path);
          const mindTraceFile = frontmatter?.["mind-trace"] === true || frontmatter?.["mind-trace-report"] === true || frontmatter?.["mind-trace-observation"] === true;
          if (!tracked && !mindTraceFile && !this.historyIndex.hasPath(file.path)) return;
          updateMetricsFile(this.app, file);
          invalidateParsedJournal(file.path);
          this.historyIndex.invalidate(file.path);
          this.emitMetricsChanged();
          this.refreshWeeklyEventViews();
          void this.openMindTraceFile(file);
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        void this.openMindTraceFile(file);
        this.scheduleTimeout(() => void this.openMindTraceFile(file), 50);
        this.scheduleTimeout(() => void this.openMindTraceFile(file), 250);
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        const view = leaf?.view;
        if (view instanceof import_obsidian7.MarkdownView) {
          if (!(view.file instanceof import_obsidian7.TFile) || this.sourceEditLeaves.get(leaf) !== view.file.path) {
            this.sourceEditLeaves.delete(leaf);
          }
          void this.openMindTraceFile(view.file);
        } else if (leaf !== null) {
          this.sourceEditLeaves.delete(leaf);
        }
      })
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.unloading) return;
      void this.migrateLegacyObservation();
      void this.normalizeRestoredViews();
      void this.protectOpenMindTraceFiles();
    });
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof import_obsidian7.TFile && file.extension === "md") {
          const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
          const relevant = metricsFileTracked(this.app, file.path) || this.historyIndex.hasPath(file.path) || frontmatter?.["mind-trace"] === true || frontmatter?.["mind-trace-report"] === true || frontmatter?.["mind-trace-observation"] === true;
          if (!relevant) return;
          removeMetricsFile(this.app, file.path);
          invalidateParsedJournal(file.path);
          this.historyIndex.invalidate(file.path);
          this.emitMetricsChanged();
          this.refreshWeeklyEventViews();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof import_obsidian7.TFile && file.extension === "md") {
          const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
          const relevant = metricsFileTracked(this.app, oldPath) || metricsFileTracked(this.app, file.path) || this.historyIndex.hasPath(oldPath) || this.historyIndex.hasPath(file.path) || frontmatter?.["mind-trace"] === true || frontmatter?.["mind-trace-report"] === true || frontmatter?.["mind-trace-observation"] === true;
          if (!relevant) return;
          renameMetricsFile(this.app, oldPath, file);
          invalidateParsedJournal(oldPath);
          invalidateParsedJournal(file.path);
          this.historyIndex.invalidate(oldPath);
          this.historyIndex.invalidate(file.path);
          this.emitMetricsChanged();
          this.refreshWeeklyEventViews();
        }
      })
    );
  }
  onunload() {
    this.unloading = true;
    this.lifecycleAbortController.abort();
    for (const operation of [...this.activeOperations]) operation.cancelFromPlugin?.();
    this.activeOperations.clear();
    const ownerWindow = mindTraceWorkspaceDocument(this.app).defaultView ?? globalThis.window;
    for (const timeout of this.pendingTimeouts) ownerWindow.clearTimeout(timeout);
    this.pendingTimeouts.clear();
    this.privacyController?.dispose();
    this.historyIndex?.clear();
    this.reportCoordinator?.clearSourceCaches();
    clearParsedJournalCaches();
    clearMetricsIndex(this.app);
    this.metricsListeners.clear();
    this.draftListeners.clear();
    this.llmActivities.clear();
    this.sourceEditLeaves = /* @__PURE__ */ new WeakMap();
  }
  assertOperational() {
    if (this.unloading || this.lifecycleAbortController.signal.aborted) {
      throw new Error("心迹插件已停止，未继续写入数据");
    }
  }
  trackOperation(operation) {
    if (this.unloading) return false;
    this.activeOperations.add(operation);
    return true;
  }
  untrackOperation(operation) {
    this.activeOperations.delete(operation);
  }
  scheduleTimeout(callback, delay) {
    if (this.unloading) return null;
    const ownerWindow = mindTraceWorkspaceDocument(this.app).defaultView ?? globalThis.window;
    const timeout = ownerWindow.setTimeout(() => {
      this.pendingTimeouts.delete(timeout);
      if (!this.unloading) callback();
    }, delay);
    this.pendingTimeouts.add(timeout);
    return timeout;
  }
  async saveSettings() {
    await this.persist();
  }
  async saveObservationFeedback(filePath, key, feedback) {
    if (typeof filePath !== "string" || filePath.length === 0 || typeof key !== "string" || key.length === 0) return null;
    const snapshot = await this.observationRepository.updateFeedback(filePath, key, feedback);
    this.emitMetricsChanged();
    this.refreshJournalViews();
    return snapshot;
  }
  async deleteSelfObservation(filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian7.TFile)) throw new Error("观照文件已不存在");
    this.assertOperational();
    await this.app.fileManager.trashFile(file);
    this.emitMetricsChanged();
    this.refreshJournalViews();
  }
  async generateSelfObservation(reports) {
    if (!Array.isArray(reports) || reports.length === 0) {
      throw new Error("至少需要 1 份可解析回顾才能生成观照");
    }
    const maturity = computeObservationMaturity(reports);
    const existing = await this.observationRepository.list();
    const current = existing.find((item) => item.snapshot !== null)?.snapshot ?? emptySelfObservation();
    const feedbackContext = current.analysis?.schemaVersion === 2 ? Object.fromEntries((current.analysis.claims ?? []).flatMap((claim) => {
      const value = current.feedback?.[claim.key];
      return value === void 0 ? [] : [[claim.key, { type: "claim", text: claim.statement, status: value.status, correction: value.correction ?? "" }]];
    })) : observationFeedbackContext(current.analysis, current.feedback);
    const analysis = await generateObservation(this.createProvider(), reports, feedbackContext, maturity);
    const catalog = observationEvidenceCatalog(reports, 60);
    const referenced = new Set(analysis.claims.flatMap((claim) => [...claim.supportEvidenceRefs, ...claim.counterEvidenceRefs]));
    const evidence = catalog.filter((item) => referenced.has(item.id)).slice(0, 80);
    const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const snapshot = {
      version: 2,
      id: `obs-${generatedAt.replace(/[^0-9]/g, "").slice(0, 17)}-${Math.random().toString(36).slice(2, 8)}`,
      generatedAt,
      sources: reports.map((item) => {
        const file = this.app.vault.getAbstractFileByPath(item.filePath);
        return { type: item.type, periodStart: item.periodStart, periodEnd: item.periodEnd, periodStatus: item.periodStatus === "partial" ? "partial" : "complete", filePath: item.filePath, generatedAt: item.generatedAt, modifiedAt: file instanceof import_obsidian7.TFile ? file.stat.mtime : 0 };
      }),
      maturity,
      analysis,
      evidence,
      feedback: {}
    };
    const saved = await this.observationRepository.save(this.settings, snapshot);
    this.emitMetricsChanged();
    this.refreshJournalViews();
    return saved.snapshot;
  }
  async migrateLegacyObservation() {
    const legacy = normalizeSelfObservation(this.legacySelfObservation);
    if (legacy.analysis === null) return;
    try {
      const existing = await this.observationRepository.list();
      const sameTime = existing.some((item) => item.snapshot?.generatedAt === legacy.generatedAt && item.snapshot?.legacy === true);
      if (!sameTime) await this.observationRepository.save(this.settings, { generatedAt: legacy.generatedAt || (/* @__PURE__ */ new Date()).toISOString() }, legacyObservationMarkdown(legacy));
      this.legacySelfObservation = emptySelfObservation();
      await this.persist();
      this.emitMetricsChanged();
      this.refreshJournalViews();
    } catch (error) {
      showMindTraceNotice(`旧观照迁移失败：${errorMessage(error)}。旧数据仍保留，重载后会重试。`);
    }
  }
  async saveProviderSettings() {
    this.settings.credentialInitialized = true;
    await this.persist();
    this.refreshJournalViews();
  }
  async setDraft(draft) {
    this.draft = draft;
    await this.persist();
    for (const listener of this.draftListeners) {
      listener();
    }
  }
  async saveDraftSilently(draft) {
    this.draft = draft;
    await this.persist();
  }
  createProvider() {
    this.assertOperational();
    const kind = this.settings.activeProvider;
    const configuration = this.settings.providers[kind];
    const secret = resolveCredential(
      configuration,
      (secretId) => this.app.secretStorage.getSecret(secretId)
    );
    return new HttpLlmProvider(
      kind,
      this.settings.providers,
      secret,
      (operation) => this.beginLlmActivity(kind, operation),
      this.lifecycleAbortController.signal
    );
  }
  beginLlmActivity(providerKind, operation) {
    if (this.unloading) return () => {};
    const id = ++this.llmActivitySequence;
    this.llmActivities.set(id, {
      providerKind,
      operation,
      startedAt: Date.now()
    });
    let finished = false;
    return () => {
      if (finished) {
        return;
      }
      finished = true;
      this.llmActivities.delete(id);
    };
  }
  llmActivitySnapshot() {
    return [...this.llmActivities.values()];
  }
  isProviderConfigured() {
    const kind = this.settings.activeProvider;
    const configuration = this.settings.providers[kind];
    if (configuration.model.trim().length === 0) {
      return false;
    }
    if (isChatCompletionsProvider(kind)) {
      if (configuration.baseUrl.trim().length === 0) {
        return false;
      }
    }
    return credentialAvailable(
      configuration,
      (secretId) => this.app.secretStorage.getSecret(secretId)
    );
  }
  activeCredentialStatus() {
    const configuration = this.settings.providers[this.settings.activeProvider];
    switch (configuration.credentialSource) {
      case "secret-storage":
        return credentialAvailable(
          configuration,
          (secretId) => this.app.secretStorage.getSecret(secretId)
        ) ? "已选择可用密钥" : "尚未选择可用密钥";
      case "none":
        return "不使用鉴权";
      default:
        return "尚未选择可用密钥";
    }
  }
  openSettings() {
    const app = this.app as any;
    app.setting.open();
    app.setting.openTabById(this.manifest.id);
  }
  async openProtectedMarkdownSource(leaf, file) {
    if (!this.isPrivacyUnlocked()) {
      return;
    }
    this.sourceEditLeaves.set(leaf, file.path);
    try {
      await leaf.setViewState({
        type: "markdown",
        state: {
          file: file.path,
          mode: "source"
        },
        active: true
      });
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) {
      this.sourceEditLeaves.delete(leaf);
      throw error;
    }
  }
  async saveEntry(draft, entry, date = /* @__PURE__ */ new Date()) {
    const file = await this.repository.save(draft, entry, this.settings, date);
    this.historyIndex.invalidate(file.path);
    this.emitMetricsChanged();
    return file;
  }
  weeklyReportStatus(period = completedPeriod("weekly")) {
    return this.reportCoordinator.weeklyReportStatus(period);
  }
  generateWeeklyReport(period = completedPeriod("weekly"), overwrite = false, automatic = false, onProgress = null) {
    return this.reportCoordinator.generateWeeklyReport(period, overwrite, automatic, onProgress);
  }
  monthlyReportStatus(period = completedPeriod("monthly")) {
    return this.reportCoordinator.monthlyReportStatus(period);
  }
  generateMonthlyReport(period = completedPeriod("monthly"), overwrite = false, automatic = false, onProgress = null) {
    return this.reportCoordinator.generateMonthlyReport(period, overwrite, automatic, onProgress);
  }
  regenerateInvalidEvents(source, onProgress = null, progressPlan = { model: 2, write: 3, reload: 4, total: 4 }) {
    return this.reportCoordinator.regenerateInvalidEvents(source, onProgress, progressPlan);
  }
  calibrateWeeklyEvents(source, onProgress = null, progressPlan = { model: 2, write: 3, reload: 4, total: 5 }) {
    return this.reportCoordinator.calibrateWeeklyEvents(source, onProgress, progressPlan);
  }
  calibrateMonthlyEvents(source, onProgress = null, progressPlan = { model: 2, write: 3, reload: 4, total: 5 }) {
    return this.reportCoordinator.calibrateMonthlyEvents(source, onProgress, progressPlan);
  }
  onMetricsChanged(callback) {
    this.metricsListeners.add(callback);
    return () => {
      this.metricsListeners.delete(callback);
    };
  }
  onDraftChanged(callback) {
    this.draftListeners.add(callback);
    return () => {
      this.draftListeners.delete(callback);
    };
  }
  isPasswordConfigured() {
    return this.privacyController.isPasswordConfigured();
  }
  isPrivacyGateEnabled() {
    return this.privacyController.isGateEnabled();
  }
  isPrivacyUnlocked() {
    return this.privacyController.isUnlocked();
  }
  verifyPrivacyPassword(password) {
    return this.privacyController.verifyPassword(password);
  }
  configurePrivacyPassword(password) {
    return this.privacyController.configurePassword(password);
  }
  skipPrivacySetup() {
    return this.privacyController.skipSetup();
  }
  unlockPrivacy(password) {
    return this.privacyController.unlock(password);
  }
  changePrivacyPassword(currentPassword, newPassword) {
    return this.privacyController.changePassword(currentPassword, newPassword);
  }
  removePrivacyPassword(currentPassword) {
    return this.privacyController.removePassword(currentPassword);
  }
  activatePrivacyUnlock() {
    this.privacyController.activateUnlock();
  }
  lockPrivacy(showNotice = false) {
    this.privacyController.lock(showNotice);
  }
  handlePrivacyLock(showNotice = false) {
    for (const leaf of this.app.workspace.getLeavesOfType(WEEKLY_REPORT_VIEW_TYPE)) {
      if (leaf.view instanceof SavedWeeklyReportView) leaf.view.clearEventState();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(OBSERVATION_VIEW_TYPE)) {
      if (leaf.view instanceof SavedObservationView) leaf.view.render();
    }
    this.refreshProtectedViews();
    void this.closeProtectedSources();
    if (showNotice) showMindTraceNotice("心迹已锁定");
  }
  refreshJournalViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(JOURNAL_VIEW_TYPE)) {
      if (leaf.view instanceof JournalView) {
        leaf.view.weeklyReportState = null;
        if (!this.isPrivacyUnlocked()) {
          leaf.view.clearHistoryState();
        }
        leaf.view.render(true);
      }
    }
  }
  refreshWeeklyEventViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(WEEKLY_REPORT_VIEW_TYPE)) {
      if (leaf.view instanceof SavedWeeklyReportView) {
        leaf.view.invalidateEventSource();
      }
    }
  }
  refreshProtectedViews() {
    this.refreshJournalViews();
    for (const leaf of this.app.workspace.getLeavesOfType(SAVED_JOURNAL_VIEW_TYPE)) {
      if (leaf.view instanceof SavedJournalView) {
        leaf.view.render(true);
      }
    }
    for (const leaf of this.app.workspace.getLeavesOfType(WEEKLY_REPORT_VIEW_TYPE)) {
      if (leaf.view instanceof SavedWeeklyReportView) {
        leaf.view.render(true);
      }
    }
    for (const leaf of this.app.workspace.getLeavesOfType(OBSERVATION_VIEW_TYPE)) {
      if (leaf.view instanceof SavedObservationView) leaf.view.render();
    }
  }
  async closeProtectedSources() {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian7.MarkdownView) || !(view.file instanceof import_obsidian7.TFile) || !await this.isMindTraceFile(view.file)) {
        continue;
      }
      this.sourceEditLeaves.delete(leaf);
      await leaf.setViewState({
        type: await this.protectedViewType(view.file),
        state: { file: view.file.path },
        active: leaf === this.app.workspace.getMostRecentLeaf()
      });
    }
  }
  async openSavedJournalFile(filePath, sessionIndex = null, focusEvent = null) {
    if (!this.isPrivacyUnlocked() || filePath.length === 0) {
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian7.TFile)) {
      showMindTraceNotice("对应的心迹日记已经移动或删除");
      return;
    }
    const existing = this.app.workspace.getLeavesOfType(SAVED_JOURNAL_VIEW_TYPE).find((leaf) => {
      const currentPath = leaf.view instanceof SavedJournalView ? leaf.view.file?.path : leaf.getViewState()?.state?.file;
      return currentPath === file.path;
    });
    if (existing !== void 0) {
      await this.app.workspace.revealLeaf(existing);
      if (sessionIndex !== null && existing.view instanceof SavedJournalView) {
        existing.view.selectSession(Math.max(0, sessionIndex));
        if (focusEvent !== null) {
          existing.view.focusEvent(focusEvent);
        }
      }
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: SAVED_JOURNAL_VIEW_TYPE,
      state: { file: file.path },
      active: true
    });
    await this.app.workspace.revealLeaf(leaf);
    if (sessionIndex !== null && leaf.view instanceof SavedJournalView) {
      leaf.view.selectSession(Math.max(0, sessionIndex));
      if (focusEvent !== null) {
        leaf.view.focusEvent(focusEvent);
      }
    }
  }
  async openWeeklyReportFile(filePath) {
    if (filePath.length === 0) {
      return;
    }
    const existing = this.app.workspace.getLeavesOfType(WEEKLY_REPORT_VIEW_TYPE).find((leaf) => {
      const currentPath = leaf.view instanceof SavedWeeklyReportView ? leaf.view.file?.path : leaf.getViewState()?.state?.file;
      return currentPath === filePath;
    });
    if (existing !== void 0) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: WEEKLY_REPORT_VIEW_TYPE,
      state: { file: filePath },
      active: true
    });
    await this.app.workspace.revealLeaf(leaf);
  }
  async openJournalDate(date) {
    if (!this.isPrivacyUnlocked()) {
      return;
    }
    const match = collectMetrics(this.app).entries.find((entry) => entry.date === date);
    if (match === void 0) {
      showMindTraceNotice(`未找到 ${date} 的心迹日记`);
      return;
    }
    await this.openSavedJournalFile(match.filePath, Math.max(0, match.sessions - 1));
  }
  async openJournalSession(filePath, sessionIndex = 0, focusEvent = null) {
    if (!this.isPrivacyUnlocked() || filePath.length === 0) {
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian7.TFile)) {
      showMindTraceNotice("对应的心迹日记已经移动或删除");
      return;
    }
    await this.openSavedJournalFile(file.path, sessionIndex, focusEvent);
  }
  async openJournal() {
    const journalLeaves = this.app.workspace.getLeavesOfType(JOURNAL_VIEW_TYPE);
    let leaf = journalLeaves.find(
      (candidate) => this.isMainLeaf(candidate)
    );
    for (const candidate of journalLeaves) {
      if (!this.isMainLeaf(candidate)) {
        candidate.detach();
      }
    }
    if (leaf === void 0) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({
        type: JOURNAL_VIEW_TYPE,
        active: true
      });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
  async normalizeRestoredViews() {
    const misplacedJournal = this.app.workspace.getLeavesOfType(JOURNAL_VIEW_TYPE).some((leaf) => !this.isMainLeaf(leaf));
    if (misplacedJournal) {
      await this.openJournal();
    }
  }
  async openMindTraceFile(file) {
    if (!(file instanceof import_obsidian7.TFile)) {
      return;
    }
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof import_obsidian7.MarkdownView && view.file === file && this.sourceEditLeaves.get(leaf) !== file.path) {
        this.sourceEditLeaves.delete(leaf);
      }
    }
    if (!await this.isMindTraceFile(file)) {
      return;
    }
    const viewType = await this.protectedViewType(file);
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian7.MarkdownView) || view.file !== file) {
        continue;
      }
      const explicitlyEditing = this.sourceEditLeaves.get(leaf) === file.path;
      if (explicitlyEditing && this.isPrivacyUnlocked()) {
        continue;
      }
      this.sourceEditLeaves.delete(leaf);
      await leaf.setViewState({
        type: viewType,
        state: { file: file.path },
        active: leaf === this.app.workspace.getMostRecentLeaf()
      });
    }
  }
  async protectOpenMindTraceFiles() {
    const files = /* @__PURE__ */ new Set();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof import_obsidian7.MarkdownView && view.file instanceof import_obsidian7.TFile) {
        files.add(view.file);
      }
    }
    for (const file of files) {
      await this.openMindTraceFile(file);
    }
  }
  async isMindTraceFile(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter !== void 0) {
      return frontmatter["mind-trace"] === true || frontmatter["mind-trace-report"] === true || frontmatter["mind-trace-observation"] === true;
    }
    const content = await this.app.vault.cachedRead(file);
    const info = (0, import_obsidian7.getFrontMatterInfo)(content);
    if (!info.exists) {
      return false;
    }
    const parsed = (0, import_obsidian7.parseYaml)(info.frontmatter);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return false;
    }
    return Reflect.get(parsed, "mind-trace") === true || Reflect.get(parsed, "mind-trace-report") === true || Reflect.get(parsed, "mind-trace-observation") === true;
  }
  async protectedViewType(file) {
    const cached = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (cached?.["mind-trace-observation"] === true) {
      return OBSERVATION_VIEW_TYPE;
    }
    if (cached?.["mind-trace-report"] === true) {
      return WEEKLY_REPORT_VIEW_TYPE;
    }
    if (cached !== void 0) {
      return SAVED_JOURNAL_VIEW_TYPE;
    }
    try {
      const content = await this.app.vault.cachedRead(file);
      const info = (0, import_obsidian7.getFrontMatterInfo)(content);
      const parsed = info.exists ? (0, import_obsidian7.parseYaml)(info.frontmatter) : null;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (Reflect.get(parsed, "mind-trace-observation") === true) return OBSERVATION_VIEW_TYPE;
        if (Reflect.get(parsed, "mind-trace-report") === true) return WEEKLY_REPORT_VIEW_TYPE;
      }
      return SAVED_JOURNAL_VIEW_TYPE;
    } catch {
      return SAVED_JOURNAL_VIEW_TYPE;
    }
  }
  isMainLeaf(leaf) {
    let isMain = false;
    this.app.workspace.iterateRootLeaves((candidate) => {
      if (candidate === leaf) {
        isMain = true;
      }
    });
    return isMain;
  }
  emitMetricsChanged() {
    this.reportCoordinator?.clearSourceCaches();
    for (const listener of this.metricsListeners) {
      listener();
    }
  }
  async loadPluginData() {
    const loaded = await this.loadData();
    if (loaded === null) {
      this.settings = structuredClone(DEFAULT_SETTINGS);
      this.draft = null;
      await this.applyCredentialInitialization(true, false);
      await this.persist();
      return;
    }
    if (typeof loaded !== "object" || Array.isArray(loaded) || !("settings" in loaded) || !("draft" in loaded)) {
      throw new Error("心迹插件数据格式无效");
    }
    const data = loaded;
    const loadedSettings = typeof data.settings === "object" && data.settings !== null && !Array.isArray(data.settings) ? data.settings : {};
    const providers = structuredClone(DEFAULT_SETTINGS.providers);
    if (typeof loadedSettings.providers === "object" && loadedSettings.providers !== null && !Array.isArray(loadedSettings.providers)) {
      for (const kind of Object.keys(providers)) {
        const provider = loadedSettings.providers[kind];
        if (typeof provider === "object" && provider !== null && !Array.isArray(provider)) {
          providers[kind] = { ...providers[kind], ...provider };
        }
      }
    }
    this.settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      ...loadedSettings,
      providers
    };
    this.migrateLegacyCredentials();
    this.settings = normalizePluginSettings(this.settings);
    this.legacySelfObservation = normalizeSelfObservation(loadedSettings.selfObservation);
    this.draft = data.draft;
    if (typeof this.draft === "object" && this.draft !== null && !Array.isArray(this.draft)) {
      this.draft.entryDate = draftEntryDate(this.draft);
    }
    await this.applyCredentialInitialization(false, false);
    const normalizedData = this.durableData();
    if (JSON.stringify(normalizedData) !== JSON.stringify(loaded)) await this.saveData(normalizedData);
  }
  listSecretIds() {
    try {
      const secrets = this.app.secretStorage.listSecrets();
      return Array.isArray(secrets) ? [...secrets] : [];
    } catch {
      return [];
    }
  }
  migrateLegacyCredentials() {
    let changed = false;
    const secrets = this.listSecretIds();
    for (const value of Object.values(this.settings.providers)) {
      const provider = value as Record<string, any>;
      if (typeof provider !== "object" || provider === null || provider.credentialSource !== "environment") {
        continue;
      }
      provider.credentialSource = "secret-storage";
      changed = true;
      if (typeof provider.secretId !== "string" || provider.secretId.length === 0) {
        const legacyName = typeof provider.environmentVariable === "string" ? provider.environmentVariable.trim() : "";
        if (legacyName.length > 0 && secrets.includes(legacyName)) {
          provider.secretId = legacyName;
        }
      }
    }
    return changed;
  }
  isPristineProviderConfiguration() {
    if (this.settings.activeProvider !== DEFAULT_SETTINGS.activeProvider) {
      return false;
    }
    for (const [kind, defaults] of Object.entries(DEFAULT_SETTINGS.providers)) {
      const provider = this.settings.providers[kind];
      const defaultProvider = defaults as Record<string, any>;
      if (typeof provider !== "object" || provider === null) {
        return false;
      }
      const legacyDefaultModel = kind === "gemini" && provider.model === "gemini-2.5-flash";
      if ((provider.model !== defaultProvider.model && !legacyDefaultModel) || provider.baseUrl !== defaultProvider.baseUrl || provider.credentialSource !== defaultProvider.credentialSource) {
        return false;
      }
      if (typeof provider.secretId === "string" && provider.secretId.length > 0) {
        return false;
      }
    }
    return true;
  }
  async applyCredentialInitialization(fresh, persistChanges = true) {
    const secrets = this.listSecretIds();
    if (secrets.length === 0) {
      return false;
    }
    const firstKey = secrets.sort((a, b) => a.localeCompare(b, void 0, { numeric: true, sensitivity: "base" }))[0];
    if (fresh || this.settings.credentialInitialized !== true && this.isPristineProviderConfiguration()) {
      this.settings.activeProvider = "gemini";
      const gemini = this.settings.providers.gemini;
      gemini.model = DEFAULT_SETTINGS.providers.gemini.model;
      gemini.credentialSource = "secret-storage";
      gemini.secretId = firstKey;
      this.settings.credentialInitialized = true;
      if (persistChanges) {
        await this.persist();
      }
      return true;
    }
    const active = this.settings.providers[this.settings.activeProvider];
    if (active === void 0 || active === null || active.credentialSource !== "secret-storage") {
      return false;
    }
    const currentId = typeof active.secretId === "string" ? active.secretId.trim() : "";
    if (currentId.length > 0 && secrets.includes(currentId)) {
      return false;
    }
    active.secretId = firstKey;
    this.settings.credentialInitialized = true;
    if (persistChanges) {
      await this.persist();
    }
    return true;
  }
  durableData() {
    const settings: any = { ...this.settings };
    delete settings.selfObservation;
    if (this.legacySelfObservation?.analysis !== null) settings.selfObservation = this.legacySelfObservation;
    return {
      settings,
      draft: this.draft
    };
  }
  async persist() {
    this.assertOperational();
    await this.saveData(this.durableData());
  }
};

export default MindTracePlugin;
