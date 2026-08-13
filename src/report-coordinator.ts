import { TFile } from "obsidian";
import { completedPeriod, periodWeekStart } from "./date-utils";
import { generateEventBackfill, generateMonthlyReport, generateWeeklyReport } from "./generation";
import { showMindTraceNotice } from "./runtime-preamble";
import { eventEntityDisambiguationProfiles, parseFrontmatter } from "./saved-journal";
import { reportSummaryFromMarkdown } from "./weekly-report";

type ProgressCallback = ((progress: any) => void) | null;

function throwIfAborted(signal: AbortSignal | null) {
  if (signal?.aborted) throw new Error("任务已取消");
}

export class ReportCoordinator {
  private readonly weeklyReportAttempts = new Set<string>();
  private readonly weeklyReportInFlight = new Map<string, Promise<any>>();
  private readonly weeklyReportSourceCache = new Map<string, any>();
  private readonly monthlyReportAttempts = new Set<string>();
  private readonly monthlyReportInFlight = new Map<string, Promise<any>>();
  private readonly monthlyReportSourceCache = new Map<string, any>();

  constructor(private readonly host: any) {}

  clearSourceCaches() {
    this.weeklyReportSourceCache.clear();
    this.monthlyReportSourceCache.clear();
  }

  invalidateSourceCaches(changedPaths: string[]) {
    const changed = new Set(changedPaths);
    const invalidate = (cache: Map<string, any>) => {
      for (const [key, source] of cache) {
        if (source.sourceFiles?.some((file: TFile) => changed.has(file.path))) {
          cache.delete(key);
        }
      }
    };
    invalidate(this.weeklyReportSourceCache);
    invalidate(this.monthlyReportSourceCache);
  }

  async weeklyReportStatus(period = completedPeriod("weekly")) {
    const key = `${period.start}--${period.end}`;
    let source = this.weeklyReportSourceCache.get(key);
    if (source === undefined) {
      source = await this.host.weeklyReportRepository.collect(period);
      this.weeklyReportSourceCache.set(key, source);
    }
    const { file, completingPreview } = this.host.weeklyReportRepository.resolveWriteTarget(this.host.settings, period);
    if (file !== null) {
      const content = await this.host.app.vault.cachedRead(file);
      let metadata: Record<string, any> = {};
      try {
        metadata = parseFrontmatter(content);
      } catch {
      }
      const sourceChanged = Number(metadata["source-days"]) !== source.stats.days || Number(metadata["source-sessions"]) !== source.stats.sessions;
      return {
        kind: completingPreview || sourceChanged || this.host.weeklyReportRepository.isStale(file, source) ? "stale" : "ready",
        period,
        source,
        file,
        preview: completingPreview,
        summary: reportSummaryFromMarkdown(content)
      };
    }
    const minimum = Math.min(7, Math.max(4, Number(this.host.settings.weeklyReportMinimumDays) || 5));
    if (source.stats.days < minimum) return { kind: "insufficient", period, source, minimum };
    if (!this.host.isProviderConfigured()) return { kind: "unconfigured", period, source };
    return { kind: "missing", period, source };
  }

  async generateWeeklyReport(period = completedPeriod("weekly"), overwrite = false, automatic = false, onProgress: ProgressCallback = null, signal: AbortSignal | null = null) {
    const key = `${period.start}--${period.end}`;
    if (automatic && this.weeklyReportAttempts.has(key)) return await this.weeklyReportStatus(period);
    const existingFlight = this.weeklyReportInFlight.get(key);
    if (existingFlight !== undefined) return await existingFlight;
    if (automatic) this.weeklyReportAttempts.add(key);
    const task = (async () => {
      onProgress?.({ stage: 1, total: 8, title: "读取本周记录", detail: "正在收集日记、已有事件和周报状态。" });
      const status = await this.weeklyReportStatus(period);
      if ((status.kind === "ready" || status.kind === "stale") && !overwrite) return status;
      if (status.kind === "insufficient") throw new Error(`至少需要 ${status.minimum} 个记录日才能生成周报`);
      if (status.kind === "unconfigured") throw new Error("请先在心迹设置中配置模型与 API Key");
      throwIfAborted(signal);
      const expectedReportVersion = this.host.weeklyReportRepository.captureWriteVersion(this.host.settings, period);
      let source = status.source;
      const calibrationCount = source.eventCalibrationSessions.length;
      onProgress?.({ stage: 2, total: 8, title: "整理图谱事件", detail: calibrationCount > 0 ? `发现 ${calibrationCount} 篇记录需要整周校准。` : "现有事件已经可以直接用于本周图谱。" });
      if (calibrationCount > 0) source = await this.calibrateWeeklyEvents(source, onProgress, { model: 3, write: 4, reload: 7, total: 8 }, signal);
      onProgress?.({ stage: 5, total: 8, title: "生成周报内容", detail: "正在根据整理后的日记和图谱事件生成本周回顾。" });
      throwIfAborted(signal);
      const report = await generateWeeklyReport(this.host.createProvider(signal), source, this.host.settings);
      onProgress?.({ stage: 6, total: 8, title: "保存周报", detail: "正在把周报写入本地 Vault。" });
      throwIfAborted(signal);
      const file = await this.host.weeklyReportRepository.save(this.host.settings, source, report, overwrite, expectedReportVersion);
      onProgress?.({ stage: 7, total: 8, title: "构建图谱数据", detail: "正在重新汇总事件进展、体验/方向线索、实体和明确关系。" });
      this.host.emitMetricsChanged(source.sourceFiles?.map((file: TFile) => file.path) ?? []);
      return { kind: "ready", period, source, file, summary: report.summary };
    })();
    this.weeklyReportInFlight.set(key, task);
    try {
      return await task;
    } finally {
      this.weeklyReportInFlight.delete(key);
    }
  }

  async monthlyReportStatus(period = completedPeriod("monthly")) {
    const key = `${period.start}--${period.end}--${period.status ?? "complete"}`;
    let source = this.monthlyReportSourceCache.get(key);
    if (source === undefined) {
      source = await this.host.monthlyReportRepository.collect(period);
      this.monthlyReportSourceCache.set(key, source);
    }
    const file = this.host.monthlyReportRepository.find(this.host.settings, period);
    if (file !== null) {
      const content = await this.host.app.vault.cachedRead(file);
      let metadata: Record<string, any> = {};
      try {
        metadata = parseFrontmatter(content);
      } catch {
      }
      const sourceChanged = Number(metadata["source-days"]) !== source.stats.days || Number(metadata["source-sessions"]) !== source.stats.sessions || Number(metadata["source-active-weeks"]) !== source.stats.activeWeeks || metadata["period-status"] !== (period.status ?? "complete") || metadata["comparison-start"] !== source.comparisonPeriod.start || metadata["comparison-end"] !== source.comparisonPeriod.end;
      return {
        kind: sourceChanged || this.host.monthlyReportRepository.isStale(file, source) ? "stale" : "ready",
        period,
        source,
        file,
        summary: reportSummaryFromMarkdown(content, "本月概览")
      };
    }
    const minimum = period.status === "partial" ? 1 : Math.min(5, Math.max(1, Number(this.host.settings.monthlyReportMinimumWeeks) || 4));
    if (period.status === "partial" ? source.stats.days < minimum : source.stats.activeWeeks < minimum) return { kind: "insufficient", period, source, minimum };
    if (!this.host.isProviderConfigured()) return { kind: "unconfigured", period, source };
    return { kind: "missing", period, source };
  }

  async generateMonthlyReport(period = completedPeriod("monthly"), overwrite = false, automatic = false, onProgress: ProgressCallback = null, signal: AbortSignal | null = null) {
    const key = `${period.start}--${period.end}--${period.status ?? "complete"}`;
    if (automatic && this.monthlyReportAttempts.has(key)) return await this.monthlyReportStatus(period);
    const existingFlight = this.monthlyReportInFlight.get(key);
    if (existingFlight !== undefined) return await existingFlight;
    if (automatic) this.monthlyReportAttempts.add(key);
    const task = (async () => {
      onProgress?.({ stage: 1, total: 8, title: "读取本月记录", detail: "正在收集日记、已有事件和月报状态。" });
      const status = await this.monthlyReportStatus(period);
      if ((status.kind === "ready" || status.kind === "stale") && !overwrite) return status;
      if (status.kind === "insufficient") throw new Error(period.status === "partial" ? "本月至少需要 1 个记录日才能生成预览" : `至少需要 ${status.minimum} 份已生成周报才能生成正式月报`);
      if (status.kind === "unconfigured") throw new Error("请先在心迹设置中配置模型与 API Key");
      throwIfAborted(signal);
      const expectedReportVersion = this.host.monthlyReportRepository.captureWriteVersion(this.host.settings, period);
      let source = status.source;
      const calibrationCount = source.eventCalibrationSessions.length;
      onProgress?.({ stage: 2, total: 8, title: "整理月度事件", detail: calibrationCount > 0 ? `发现 ${calibrationCount} 篇记录需要按自然周校准。` : "现有事件已经可以直接用于本月图谱。" });
      if (calibrationCount > 0) source = await this.calibrateMonthlyEvents(source, onProgress, { model: 3, write: 4, reload: 7, total: 8 }, signal);
      onProgress?.({ stage: 5, total: 8, title: "生成月报内容", detail: "正在根据整月日记、节奏和图谱事件生成回顾。" });
      throwIfAborted(signal);
      const report = await generateMonthlyReport(this.host.createProvider(signal), source, this.host.settings);
      onProgress?.({ stage: 6, total: 8, title: "保存月报", detail: "正在把月报写入本地 Vault。" });
      throwIfAborted(signal);
      const file = await this.host.monthlyReportRepository.save(this.host.settings, source, report, overwrite, expectedReportVersion);
      onProgress?.({ stage: 7, total: 8, title: "构建月度图谱", detail: "正在重新汇总整月事件进展、体验/方向线索、实体和明确关系。" });
      this.host.emitMetricsChanged(source.sourceFiles?.map((file: TFile) => file.path) ?? []);
      return { kind: "ready", period, source, file, summary: report.summary };
    })();
    this.monthlyReportInFlight.set(key, task);
    try {
      return await task;
    } finally {
      this.monthlyReportInFlight.delete(key);
    }
  }

  async regenerateInvalidEvents(source: any, onProgress: ProgressCallback = null, progressPlan = { model: 2, write: 3, reload: 4, total: 4 }, signal: AbortSignal | null = null) {
    const mutable = source.eventInvalidSessions;
    if (mutable.length === 0) return source;
    const monthly = source.period.type === "monthly";
    const grouped = new Map<string, any[]>();
    for (const session of mutable) {
      const week = periodWeekStart(session.date) ?? session.date;
      const values = grouped.get(week) ?? [];
      values.push(session);
      grouped.set(week, values);
    }
    const readySessions = [...source.eventReviewedSessions, ...source.eventCalibrationSessions.filter((session: any) => session.eventState === "ready")];
    const weeklyLimit = Number(this.host.settings.weeklyEventLimit) || 50;
    const plans = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([week, sessions]) => {
      const preservedSessions = readySessions.filter((session: any) => (periodWeekStart(session.date) ?? session.date) === week);
      const preservedCount = preservedSessions.reduce((sum: number, session: any) => sum + session.events.length, 0);
      return { week, sessions, preservedSessions, preservedCount, maximum: Math.max(0, weeklyLimit - preservedCount) };
    });
    const fullWeek = plans.find((plan) => plan.maximum === 0);
    if (fullWeek !== undefined) throw new Error(`${fullWeek.week} 已有 ${fullWeek.preservedCount} 件有效事件，达到每周上限；未改写结构不匹配的记录。请提高每周事件上限后重试。`);
    const results: any[] = [];
    onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: monthly ? "按自然周重新抽取" : "重新抽取事件", detail: monthly ? `正在依次处理 ${plans.length} 个自然周中的 ${mutable.length} 篇记录。` : `正在从 ${mutable.length} 篇记录的正文与切片重新抽取详细事件。` });
    let segment = 0;
    for (const plan of plans) {
      throwIfAborted(signal);
      segment += 1;
      const knownElements = eventEntityDisambiguationProfiles(source.events.records, monthly ? 60 : 50, plan.sessions);
      const generated = await generateEventBackfill(this.host.createProvider(signal), plan.sessions, knownElements, plan.maximum, plan.preservedSessions);
      results.push(...generated);
      onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: monthly ? "按自然周重新抽取" : "重新抽取事件", detail: monthly ? `已完成 ${segment}/${plans.length} 个自然周。` : `已完成 ${plan.sessions.length} 篇记录的模型抽取。` });
    }
    throwIfAborted(signal);
    onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "校验并逐篇写回", detail: "正在校验新事件并替换对应章节；已有效事件保持不变。", current: 0, count: new Set(results.map((result) => result.source.filePath)).size });
    const outcome = await this.host.repository.applyEventBackfill(results, (current: number, count: number) => onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "校验并逐篇写回", detail: "正在保存通过校验的新事件。", current, count }));
    if (outcome.failed.length > 0) {
      const succeededFiles = new Set(outcome.succeeded.map((item: any) => item.filePath)).size;
      const failedFiles = new Set(outcome.failed.map((item: any) => item.filePath)).size;
      throw new Error(`批量重新生成部分完成：已写回 ${succeededFiles} 篇文件，${failedFiles} 篇未写回。${[...new Set<string>(outcome.failed.map((failure: any) => failure.message))].join("；")}`);
    }
    onProgress?.({ stage: progressPlan.reload, total: progressPlan.total, title: "重新汇总图谱", detail: "正在读取写回后的事件并更新图谱数据。" });
    return await (monthly ? this.host.monthlyReportRepository : this.host.weeklyReportRepository).collect(source.period);
  }

  async calibrateWeeklyEvents(source: any, onProgress: ProgressCallback = null, progressPlan = { model: 2, write: 3, reload: 4, total: 5 }, signal: AbortSignal | null = null) {
    const mutable = source.eventCalibrationSessions;
    if (mutable.length === 0) return source;
    const preserved = source.eventReviewedSessions.reduce((sum: number, session: any) => sum + session.events.length, 0);
    const maximum = Math.max(0, (Number(this.host.settings.weeklyEventLimit) || 50) - preserved);
    if (maximum === 0) {
      showMindTraceNotice(`本周已有 ${preserved} 件保留事件，已达到设置上限；未改写其他事件。`, 8e3);
      return source;
    }
    const knownElements = eventEntityDisambiguationProfiles(source.events.records, 60, mutable);
    const preservedSessions = source.eventReviewedSessions;
    onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: "校准图谱事件", detail: `正在统一 ${mutable.length} 篇记录中的事件、实体和关系。` });
    throwIfAborted(signal);
    const results = await generateEventBackfill(this.host.createProvider(signal), mutable, knownElements, maximum, preservedSessions);
    throwIfAborted(signal);
    onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "写回日记事件", detail: "正在逐篇保存校准结果。", current: 0, count: new Set(results.map((result) => result.source.filePath)).size });
    const outcome = await this.host.repository.applyEventBackfill(results, (current: number, count: number) => onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "写回日记事件", detail: "正在逐篇保存校准结果。", current, count }));
    if (outcome.failed.length > 0) {
      const succeededFiles = new Set(outcome.succeeded.map((item: any) => item.filePath)).size;
      const failedFiles = new Set(outcome.failed.map((item: any) => item.filePath)).size;
      throw new Error(`周级校准部分完成：已写回 ${succeededFiles} 篇，${failedFiles} 篇未写回。${[...new Set<string>(outcome.failed.map((failure: any) => failure.message))].join("；")}`);
    }
    onProgress?.({ stage: progressPlan.reload, total: progressPlan.total, title: "重新汇总图谱", detail: "正在读取写回后的事件并重建图谱数据。" });
    return await this.host.weeklyReportRepository.collect(source.period);
  }

  async calibrateMonthlyEvents(source: any, onProgress: ProgressCallback = null, progressPlan = { model: 2, write: 3, reload: 4, total: 5 }, signal: AbortSignal | null = null) {
    const mutable = source.eventCalibrationSessions;
    if (mutable.length === 0) return source;
    const grouped = new Map<string, any[]>();
    for (const session of mutable) {
      const week = periodWeekStart(session.date) ?? session.date;
      const values = grouped.get(week) ?? [];
      values.push(session);
      grouped.set(week, values);
    }
    const preserved = source.eventReviewedSessions;
    const results: any[] = [];
    const expectedMtimes = new Map(source.sourceFiles.map((file: TFile) => [file.path, file.stat.mtime]));
    onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: "按周校准月度事件", detail: `正在依次整理 ${grouped.size} 个自然周片段。` });
    let segment = 0;
    for (const [week, sessions] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      throwIfAborted(signal);
      segment += 1;
      const preservedSessions = preserved.filter((item: any) => (periodWeekStart(item.date) ?? item.date) === week);
      const preservedCount = preservedSessions.reduce((sum: number, session: any) => sum + session.events.length, 0);
      const maximum = Math.max(0, (Number(this.host.settings.weeklyEventLimit) || 50) - preservedCount);
      if (maximum === 0) {
        onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: "按周校准月度事件", detail: `${week} 已有 ${preservedCount} 件人工保留事件，达到每周上限，跳过模型校准。` });
        continue;
      }
      const knownElements = eventEntityDisambiguationProfiles(source.events.records, 60, sessions);
      const generated = await generateEventBackfill(this.host.createProvider(signal), sessions, knownElements, maximum, preservedSessions);
      results.push(...generated);
      onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: "按周校准月度事件", detail: `已完成 ${segment}/${grouped.size} 个自然周片段。` });
    }
    if (results.length === 0) return source;
    throwIfAborted(signal);
    const changed = source.sourceFiles.find((file: TFile) => {
      const current = this.host.app.vault.getAbstractFileByPath(file.path);
      return !(current instanceof TFile) || current.stat.mtime !== expectedMtimes.get(file.path);
    });
    if (changed !== undefined) throw new Error(`月度校准期间日记发生了修改，已停止写回：${changed.path}`);
    onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "写回月度事件", detail: "正在逐篇保存各自然周校准结果。", current: 0, count: new Set(results.map((result) => result.source.filePath)).size });
    const outcome = await this.host.repository.applyEventBackfill(results, (current: number, count: number) => onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "写回月度事件", detail: "正在逐篇保存各自然周校准结果。", current, count }));
    if (outcome.failed.length > 0) {
      const succeededFiles = new Set(outcome.succeeded.map((item: any) => item.filePath)).size;
      const failedFiles = new Set(outcome.failed.map((failure: any) => failure.filePath)).size;
      throw new Error(`月度校准部分完成：已写回 ${succeededFiles} 篇文件，${failedFiles} 篇未写回。${[...new Set<string>(outcome.failed.map((failure: any) => failure.message))].join("；")}`);
    }
    onProgress?.({ stage: progressPlan.reload, total: progressPlan.total, title: "重新汇总月度图谱", detail: "正在读取写回后的事件并重建月度图谱数据。" });
    return await this.host.monthlyReportRepository.collect(source.period);
  }
}
