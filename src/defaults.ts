// src/defaults.ts
import { normalizeObservationAnalysis } from "./conversation";
import { localDateString } from "./date-utils";
import { PASSWORD_KDF_ITERATIONS } from "./privacy";
import { normalizeReportFolderValue } from "./weekly-report";

export { CORE_QUESTIONS, DEFAULT_SETTINGS, configuredAdaptiveQuestionLimit, configuredCoreQuestions, createDraft, draftAdaptiveQuestionLimit, draftCoreQuestions, emptySelfObservation, normalizePluginSettings, normalizeSelfObservation };
var CORE_QUESTIONS = [
  "把今天从早到晚扫一遍，你记得哪些片段？",
  "这些片段里，什么让你有感觉？为什么？",
  "今天还有什么没收尾、没说完，或想带到明天？"
];
var DEFAULT_ADAPTIVE_QUESTION_LIMIT = 2;
var DEFAULT_SETTINGS = {
  activeProvider: "openai",
  credentialInitialized: false,
  providers: {
    openai: {
      model: "gpt-5-mini",
      credentialSource: "secret-storage",
      secretId: "",
      thinkingMode: "auto"
    },
    anthropic: {
      model: "claude-sonnet-4-5",
      credentialSource: "secret-storage",
      secretId: "",
      thinkingMode: "auto"
    },
    gemini: {
      model: "gemini-3.1-flash",
      credentialSource: "secret-storage",
      secretId: "",
      thinkingMode: "auto"
    },
    kimi: {
      model: "kimi-k2.6",
      credentialSource: "secret-storage",
      secretId: "",
      baseUrl: "https://api.moonshot.cn/v1",
      thinkingMode: "auto"
    },
    deepseek: {
      model: "deepseek-v4-flash",
      credentialSource: "secret-storage",
      secretId: "",
      baseUrl: "https://api.deepseek.com",
      thinkingMode: "auto"
    },
    qwen: {
      model: "qwen3.7-plus",
      credentialSource: "secret-storage",
      secretId: "",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      thinkingMode: "auto"
    },
    "openai-compatible": {
      model: "",
      credentialSource: "none",
      secretId: "",
      baseUrl: "http://localhost:11434/v1",
      thinkingMode: "auto"
    }
  },
  coreQuestions: [...CORE_QUESTIONS],
  adaptiveQuestionLimit: DEFAULT_ADAPTIVE_QUESTION_LIMIT,
  journalFolder: "心迹日记",
  historyDays: 7,
  reflectionTone: "gentle",
  customInstructions: "",
  dashboardRange: 30,
  weeklyReportFolder: "",
  weeklyReportAutoGenerate: true,
  weeklyReportMinimumDays: 4,
  weeklyEventLimit: 50,
  weeklyGraphEventLimit: 20,
  monthlyReportFolder: "",
  monthlyReportAutoGenerate: true,
  monthlyReportMinimumWeeks: 4,
  monthlyGraphEventLimit: 100,
  observationFolder: "",
  security: {
    version: 1,
    salt: "",
    verifier: "",
    iterations: PASSWORD_KDF_ITERATIONS,
    enabled: true
  }
};
function normalizePluginSettings(value) {
  const source = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  const providerKinds = Object.keys(DEFAULT_SETTINGS.providers);
  const providers = {};
  for (const kind of providerKinds) {
    const defaults = DEFAULT_SETTINGS.providers[kind];
    const candidate = typeof source.providers?.[kind] === "object" && source.providers[kind] !== null && !Array.isArray(source.providers[kind]) ? source.providers[kind] : {};
    const credentialSources = kind === "openai-compatible" ? ["secret-storage", "none"] : ["secret-storage"];
    providers[kind] = {
      model: typeof candidate.model === "string" ? candidate.model.trim() : defaults.model,
      credentialSource: credentialSources.includes(candidate.credentialSource) ? candidate.credentialSource : defaults.credentialSource,
      secretId: typeof candidate.secretId === "string" ? candidate.secretId.trim() : "",
      ...Object.prototype.hasOwnProperty.call(defaults, "baseUrl") ? {
        baseUrl: typeof candidate.baseUrl === "string" ? candidate.baseUrl.trim() : defaults.baseUrl
      } : {},
      thinkingMode: ["auto", "on", "off"].includes(candidate.thinkingMode) ? candidate.thinkingMode : defaults.thinkingMode
    };
  }
  const questions = Array.isArray(source.coreQuestions) ? source.coreQuestions.filter((question) => typeof question === "string").map((question) => question.trim()).filter((question) => question.length > 0).slice(0, 8) : [];
  const activeProvider = providerKinds.includes(source.activeProvider) ? source.activeProvider : DEFAULT_SETTINGS.activeProvider;
  const rawHistoryDays = Number(source.historyDays);
  const historyDays = Number.isFinite(rawHistoryDays) ? Math.min(30, Math.max(0, Math.round(rawHistoryDays))) : DEFAULT_SETTINGS.historyDays;
  const dashboardRange = [7, 30, 90].includes(Number(source.dashboardRange)) ? Number(source.dashboardRange) : DEFAULT_SETTINGS.dashboardRange;
  const securitySource = typeof source.security === "object" && source.security !== null && !Array.isArray(source.security) ? source.security : {};
  const iterations = Number.isInteger(securitySource.iterations) && securitySource.iterations >= 1e5 && securitySource.iterations <= 2e6 ? securitySource.iterations : PASSWORD_KDF_ITERATIONS;
  const journalFolder = normalizeReportFolderValue(typeof source.journalFolder === "string" ? source.journalFolder : DEFAULT_SETTINGS.journalFolder);
  return {
    activeProvider,
    credentialInitialized: source.credentialInitialized === true,
    providers,
    coreQuestions: questions.length > 0 ? questions : [...CORE_QUESTIONS],
    adaptiveQuestionLimit: configuredAdaptiveQuestionLimit(source),
    journalFolder,
    historyDays,
    reflectionTone: ["gentle", "direct", "companion"].includes(source.reflectionTone) ? source.reflectionTone : DEFAULT_SETTINGS.reflectionTone,
    customInstructions: typeof source.customInstructions === "string" ? source.customInstructions.trim() : "",
    dashboardRange,
    weeklyReportFolder: normalizeReportFolderValue(source.weeklyReportFolder),
    weeklyReportAutoGenerate: source.weeklyReportAutoGenerate !== false,
    weeklyReportMinimumDays: Math.min(7, Math.max(4, Math.round(Number(source.weeklyReportMinimumDays) || 4))),
    weeklyEventLimit: Math.min(100, Math.max(10, Math.round((Number(source.weeklyEventLimit) || 50) / 5) * 5)),
    weeklyGraphEventLimit: Math.min(50, Math.max(5, Math.min(Number(source.weeklyEventLimit) || 50, Math.round(Number(source.weeklyGraphEventLimit) || 20)))),
    monthlyReportFolder: normalizeReportFolderValue(source.monthlyReportFolder),
    monthlyReportAutoGenerate: source.monthlyReportAutoGenerate !== false,
    monthlyReportMinimumWeeks: Math.min(5, Math.max(1, Math.round(Number(source.monthlyReportMinimumWeeks) || 4))),
    monthlyGraphEventLimit: Math.min(200, Math.max(50, Math.round((Number(source.monthlyGraphEventLimit) || 100) / 10) * 10)),
    observationFolder: normalizeReportFolderValue(source.observationFolder),
    security: {
      version: 1,
      salt: typeof securitySource.salt === "string" ? securitySource.salt : "",
      verifier: typeof securitySource.verifier === "string" ? securitySource.verifier : "",
      iterations,
      enabled: typeof securitySource.enabled === "boolean" ? securitySource.enabled : typeof securitySource.salt === "string" && securitySource.salt.length > 0 && typeof securitySource.verifier === "string" && securitySource.verifier.length > 0
    }
  };
}
function emptySelfObservation() {
  return {
    version: 1,
    generatedAt: "",
    sources: [],
    maturity: null,
    analysis: null,
    feedback: {}
  };
}
function normalizeSelfObservation(value) {
  const empty = emptySelfObservation();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return empty;
  }
  const generatedAt = typeof value.generatedAt === "string" && !Number.isNaN(new Date(value.generatedAt).getTime()) ? value.generatedAt : "";
  const sources = Array.isArray(value.sources) ? value.sources.map((source) => {
    if (typeof source !== "object" || source === null || Array.isArray(source)) {
      return null;
    }
    const type = source.type === "monthly" ? "monthly" : source.type === "weekly" ? "weekly" : "";
    const periodStart = typeof source.periodStart === "string" ? source.periodStart : "";
    const periodEnd = typeof source.periodEnd === "string" ? source.periodEnd : "";
    const filePath = typeof source.filePath === "string" ? source.filePath : "";
    if (type.length === 0 || periodStart.length === 0 || periodEnd.length === 0 || filePath.length === 0) {
      return null;
    }
    return {
      type,
      periodStart,
      periodEnd,
      filePath,
      generatedAt: typeof source.generatedAt === "string" ? source.generatedAt : "",
      periodStatus: source.periodStatus === "partial" ? "partial" : "complete"
    };
  }).filter((source) => source !== null).slice(0, 11) : [];
  const analysis = normalizeObservationAnalysis(value.analysis);
  if (analysis !== null && [...analysis.changes, ...analysis.perspectives, ...analysis.hypotheses, ...analysis.roles].some((item) => item.evidenceDates.length === 0)) {
    return empty;
  }
  const feedback = {};
  if (typeof value.feedback === "object" && value.feedback !== null && !Array.isArray(value.feedback)) {
    for (const [key, item] of Object.entries(value.feedback).slice(0, 120)) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }
      const feedbackItem = item as Record<string, unknown>;
      if (!["confirmed", "rejected", "pending"].includes(feedbackItem.status as string)) {
        continue;
      }
      const status = feedbackItem.status;
      feedback[key] = {
        status,
        correction: typeof feedbackItem.correction === "string" ? feedbackItem.correction.slice(0, 800) : "",
        updatedAt: typeof feedbackItem.updatedAt === "string" ? feedbackItem.updatedAt : ""
      };
    }
  }
  return {
    version: 1,
    generatedAt,
    sources,
    maturity: value.maturity && typeof value.maturity === "object" && ["initial", "cross_period", "continuous"].includes(value.maturity.stage) ? {
      stage: value.maturity.stage,
      eligibleReportCount: Number(value.maturity.eligibleReportCount) || 0,
      independentPeriodCount: Number(value.maturity.independentPeriodCount) || 0,
      uniqueEvidenceDateCount: Number(value.maturity.uniqueEvidenceDateCount) || 0,
      allUniqueEvidenceDateCount: Number(value.maturity.allUniqueEvidenceDateCount ?? value.maturity.uniqueEvidenceDateCount) || 0,
      evidenceSpanDays: Number(value.maturity.evidenceSpanDays) || 0,
      remaining: {
        crossPeriodPeriods: Number(value.maturity.remaining?.crossPeriodPeriods) || 0,
        crossPeriodEvidenceDates: Number(value.maturity.remaining?.crossPeriodEvidenceDates) || 0,
        continuousPeriods: Number(value.maturity.remaining?.continuousPeriods) || 0,
        continuousEvidenceDates: Number(value.maturity.remaining?.continuousEvidenceDates) || 0,
        continuousSpanDays: Number(value.maturity.remaining?.continuousSpanDays) || 0
      }
    } : null,
    analysis,
    feedback
  };
}
function configuredCoreQuestions(settings) {
  if (!Array.isArray(settings.coreQuestions) || settings.coreQuestions.length === 0) {
    return [...CORE_QUESTIONS];
  }
  return [...settings.coreQuestions];
}
function configuredAdaptiveQuestionLimit(settings) {
  const limit = settings.adaptiveQuestionLimit;
  if (!Number.isInteger(limit) || limit < 0 || limit > 5) {
    return DEFAULT_ADAPTIVE_QUESTION_LIMIT;
  }
  return limit;
}
function draftCoreQuestions(draft) {
  if (!Array.isArray(draft.coreQuestions) || draft.coreQuestions.length === 0) {
    return [...CORE_QUESTIONS];
  }
  return draft.coreQuestions;
}
function draftAdaptiveQuestionLimit(draft) {
  const limit = draft.adaptiveQuestionLimit;
  if (!Number.isInteger(limit) || limit < 0 || limit > 5) {
    return DEFAULT_ADAPTIVE_QUESTION_LIMIT;
  }
  return limit;
}
function createDraft(settings) {
  const coreQuestions = settings === void 0 ? [...CORE_QUESTIONS] : configuredCoreQuestions(settings);
  const adaptiveQuestionLimit = settings === void 0 ? DEFAULT_ADAPTIVE_QUESTION_LIMIT : configuredAdaptiveQuestionLimit(settings);
  const createdAt = /* @__PURE__ */ new Date();
  return {
    createdAt: createdAt.toISOString(),
    entryDate: localDateString(createdAt),
    step: 0,
    coreQuestions,
    adaptiveQuestionLimit,
    ratings: {
      mood: 3,
      energy: 3,
      stress: 3
    },
    answers: [],
    pendingQuestion: null,
    adaptiveCount: 0,
    generated: null
  };
}
