// src/providers.ts
import * as import_obsidian2 from "obsidian";
import * as import_obsidian7 from "obsidian";
import { JOURNAL_VIEW_TYPE, JournalView, errorMessage } from "./journal-view";
import { renderPrivacyGate } from "./privacy";
import { mindTraceDocument, mindTraceWindow, mindTraceWorkspaceDocument, showMindTraceNotice } from "./runtime-preamble";
import { renderSession } from "./saved-journal";
import { regeneratedSessionValue } from "./storage";
import { parseObservationMarkdown } from "./weekly-report";

export { HttpLlmProvider, JournalRegenerationPreviewModal, MindTraceConfirmModal, OBSERVATION_VIEW_TYPE, ObservationFeedbackModal, SavedObservationView, attachLlmActivityStatus, captureMindTraceContext, confirmMindTraceFileDeletion, findMindTraceScroller, isChatCompletionsProvider, openMindTraceOperation, restoreMindTraceContext };
function requireRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} 返回了无法识别的数据格式`);
  }
  return value;
}
function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} 返回了无法识别的数据格式`);
  }
  return value;
}
function requireString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} 返回了无法识别的数据格式`);
  }
  return value;
}
function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
function authorizationHeaders(secret) {
  return secret.length > 0 ? {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`
  } : {
    "Content-Type": "application/json"
  };
}
function isChatCompletionsProvider(kind) {
  return kind === "kimi" || kind === "deepseek" || kind === "qwen" || kind === "openai-compatible";
}
function chatCompletionsProviderLabel(kind) {
  switch (kind) {
    case "kimi":
      return "Kimi";
    case "deepseek":
      return "DeepSeek";
    case "qwen":
      return "Qwen";
    default:
      return "OpenAI-compatible";
  }
}
function providerThinkingParams(kind, configuration) {
  const mode = configuration.thinkingMode ?? "auto";
  switch (kind) {
    case "openai":
      if (mode === "on") {
        return { reasoning: { effort: "high" } };
      }
      if (mode === "off") {
        return { reasoning: { effort: "low" } };
      }
      return {};
    case "anthropic":
      return mode === "on" ? { thinking: { type: "enabled", budget_tokens: 1600 } } : {};
    case "gemini":
      if (mode === "on") {
        return { thinkingConfig: { thinkingBudget: 2048 } };
      }
      if (mode === "off") {
        return { thinkingConfig: { thinkingBudget: 0 } };
      }
      return {};
    case "deepseek":
      if (mode === "on") {
        return { thinking: { type: "enabled" }, reasoning_effort: "high" };
      }
      if (mode === "off") {
        return { thinking: { type: "disabled" } };
      }
      return {};
    case "kimi":
    case "qwen":
      if (mode === "on") {
        return { enable_thinking: true };
      }
      if (mode === "off") {
        return { enable_thinking: false };
      }
      return {};
    default:
      return {};
  }
}
function buildProviderRequest(kind, settings, secret, messages) {
  const configuration = settings[kind];
  if (configuration.model.trim().length === 0) {
    throw new Error("请先在心迹设置中填写模型名称");
  }
  if (kind !== "openai-compatible" && secret.length === 0) {
    throw new Error("请先在心迹设置中选择 API Key");
  }
  switch (kind) {
    case "openai":
      return {
        url: "https://api.openai.com/v1/responses",
        headers: authorizationHeaders(secret),
        body: {
          model: configuration.model,
          input: messages,
          ...providerThinkingParams(kind, configuration)
        }
      };
    case "anthropic": {
      const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
      const conversation = messages.filter((message) => message.role !== "system").map((message) => ({
        role: message.role,
        content: message.content
      }));
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": secret,
          "anthropic-version": "2023-06-01"
        },
        body: {
          model: configuration.model,
          max_tokens: 1800,
          messages: conversation,
          ...providerThinkingParams(kind, configuration),
          ...system.length > 0 ? { system } : {}
        }
      };
    }
    case "gemini": {
      const systemText = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
      const contents = messages.filter((message) => message.role !== "system").map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      }));
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(configuration.model)}:generateContent`,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": secret
        },
        body: {
          contents,
          ...providerThinkingParams(kind, configuration),
          ...systemText.length > 0 ? {
            systemInstruction: {
              parts: [{ text: systemText }]
            }
          } : {}
        }
      };
    }
    case "kimi":
    case "deepseek":
    case "qwen":
    case "openai-compatible": {
      const compatible = configuration;
      if (compatible.baseUrl.trim().length === 0) {
        throw new Error("请先在心迹设置中填写 Base URL");
      }
      return {
        url: joinUrl(compatible.baseUrl, "chat/completions"),
        headers: authorizationHeaders(secret),
        body: {
          model: compatible.model,
          messages,
          ...providerThinkingParams(kind, compatible)
        }
      };
    }
  }
}
function parseProviderResponse(kind, payload) {
  const responseLabel = isChatCompletionsProvider(kind) ? chatCompletionsProviderLabel(kind) : kind;
  const root = requireRecord(payload, responseLabel);
  switch (kind) {
    case "openai": {
      if (typeof root.output_text === "string") {
        return root.output_text;
      }
      const output = requireArray(root.output, "OpenAI");
      const texts = [];
      for (const itemValue of output) {
        const item = requireRecord(itemValue, "OpenAI");
        if (!Array.isArray(item.content)) {
          continue;
        }
        for (const contentValue of item.content) {
          const content = requireRecord(contentValue, "OpenAI");
          if ((content.type === "output_text" || content.type === "text") && typeof content.text === "string") {
            texts.push(content.text);
          }
        }
      }
      if (texts.length === 0) {
        throw new Error("OpenAI 未返回文本内容");
      }
      return texts.join("");
    }
    case "anthropic": {
      const content = requireArray(root.content, "Anthropic");
      const texts = content.flatMap((value) => {
        const block = requireRecord(value, "Anthropic");
        return block.type === "text" && typeof block.text === "string" ? [block.text] : [];
      });
      if (texts.length === 0) {
        throw new Error("Anthropic 未返回文本内容");
      }
      return texts.join("");
    }
    case "gemini": {
      const candidates = requireArray(root.candidates, "Gemini");
      const candidate = requireRecord(candidates[0], "Gemini");
      const content = requireRecord(candidate.content, "Gemini");
      const parts = requireArray(content.parts, "Gemini");
      const texts = parts.flatMap((value) => {
        const part = requireRecord(value, "Gemini");
        return typeof part.text === "string" ? [part.text] : [];
      });
      if (texts.length === 0) {
        throw new Error("Gemini 未返回文本内容");
      }
      return texts.join("");
    }
    case "kimi":
    case "deepseek":
    case "qwen":
    case "openai-compatible": {
      const label = chatCompletionsProviderLabel(kind);
      const choices = requireArray(root.choices, label);
      const choice = requireRecord(choices[0], label);
      const message = requireRecord(choice.message, label);
      return requireString(message.content, label);
    }
  }
}
function statusError(status) {
  if (status === 401 || status === 403) {
    return new Error("模型服务拒绝了鉴权，请检查 API Key");
  }
  if (status === 429) {
    return new Error("模型服务请求过于频繁或额度不足，请稍后重试");
  }
  if (status >= 500) {
    return new Error("模型服务暂时不可用，请稍后重试");
  }
  if (status === 400 || status === 422) {
    return new Error("模型服务无法处理当前请求，请检查模型名称和服务配置");
  }
  if (status === 404) {
    return new Error("模型服务地址或模型不存在，请检查 Base URL 和模型名称");
  }
  return new Error(`模型请求失败（${status}）`);
}
var LLM_REQUEST_TIMEOUT_MS = 120 * 1e3;
async function requestUrlWithTimeout(request, timeoutMs, signal) {
  let timeout = null;
  let onAbort = null;
  const requestWindow = activeWindow;
  const pending: Promise<any>[] = [(0, import_obsidian2.requestUrl)(request)];
  pending.push(new Promise((_, reject) => {
    timeout = requestWindow.setTimeout(() => reject(new Error("模型请求超时，请稍后重试")), timeoutMs);
  }));
  if (signal !== null) {
    pending.push(new Promise((_, reject) => {
      onAbort = () => reject(new Error("模型请求已取消"));
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }));
  }
  try {
    return await Promise.race(pending);
  } finally {
    if (timeout !== null) requestWindow.clearTimeout(timeout);
    if (signal !== null && onAbort !== null) signal.removeEventListener("abort", onAbort);
  }
}
var HttpLlmProvider = class {
  declare kind: any;
  declare settings: any;
  declare secret: string;
  declare onActivityStart: any;
  declare signal: AbortSignal | null;
  declare timeoutMs: number;
  constructor(kind, settings, secret, onActivityStart = null, signal = null, timeoutMs = LLM_REQUEST_TIMEOUT_MS) {
    this.kind = kind;
    this.settings = settings;
    this.secret = secret;
    this.onActivityStart = onActivityStart;
    this.signal = signal;
    this.timeoutMs = timeoutMs;
  }
  async generate(messages, operation = "request") {
    const providerRequest = buildProviderRequest(
      this.kind,
      this.settings,
      this.secret,
      messages
    );
    const request = {
      url: providerRequest.url,
      method: "POST",
      headers: providerRequest.headers,
      body: JSON.stringify(providerRequest.body),
      throw: false
    };
    const finishActivity = this.onActivityStart?.(operation) ?? null;
    try {
      let response;
      try {
        const result = await requestUrlWithTimeout(request, this.timeoutMs, this.signal);
        response = {
          status: result.status,
          json: result.json,
          text: result.text
        };
      } catch (error) {
        if (error instanceof Error && (error.message === "模型请求已取消" || error.message === "模型请求超时，请稍后重试")) {
          throw error;
        }
        throw new Error("无法连接模型服务，请检查网络和服务地址");
      }
      if (response.status < 200 || response.status >= 300) {
        throw statusError(response.status);
      }
      return parseProviderResponse(this.kind, response.json);
    } finally {
      finishActivity?.();
    }
  }
};
function llmProviderLabel(kind) {
  switch (kind) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Gemini";
    case "kimi":
      return "Kimi";
    case "deepseek":
      return "DeepSeek";
    case "qwen":
      return "Qwen";
    default:
      return "OpenAI-compatible";
  }
}
function llmOperationLabel(operation) {
  switch (operation) {
    case "follow-up":
      return "准备追问";
    case "journal":
      return "整理日记";
    case "rating":
      return "评估状态";
    case "repair":
      return "修正返回格式";
    case "weekly-report":
      return "生成周报";
    case "monthly-report":
      return "生成月报";
    case "observation":
      return "生成观照";
    case "event-backfill":
      return "校准本周事件";
    case "test":
      return "测试连接";
    default:
      return "处理请求";
  }
}
function llmIdleDetail(fallback) {
  if (fallback.includes("保存")) {
    return "正在写入本地 Vault。";
  }
  if (fallback.includes("检查")) {
    return "正在读取并整理本地记录。";
  }
  return "正在准备发送给模型的内容。";
}
function attachLlmActivityStatus(container, activitySource, fallback) {
  const ownerWindow = mindTraceWindow(container);
  const primary = container.createSpan({ cls: "mind-trace-llm-status-primary" });
  const primaryText = primary.createSpan();
  const elapsed = primary.createSpan({ cls: "mind-trace-llm-status-elapsed", attr: { "aria-hidden": "true" } });
  const detail = container.createSpan({ cls: "mind-trace-llm-status-detail" });
  let timer = null;
  const setText = (element, value) => {
    if (element.textContent !== value) {
      element.textContent = value;
    }
  };
  const update = () => {
    if (!container.isConnected) {
      if (timer !== null) {
        ownerWindow.clearInterval(timer);
        timer = null;
      }
      return;
    }
    const activities = activitySource?.llmActivitySnapshot() ?? [];
    if (activities.length === 0) {
      setText(primaryText, fallback);
      setText(elapsed, "");
      setText(detail, llmIdleDetail(fallback));
      return;
    }
    const providers = [...new Set(activities.map((activity) => llmProviderLabel(activity.providerKind)))];
    const operations = [...new Set(activities.map((activity) => llmOperationLabel(activity.operation)))];
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Math.min(...activities.map((activity) => activity.startedAt))) / 1e3));
    const providerText = providers.join("、");
    setText(primaryText, activities.length === 1 ? `${providerText} · 正在${operations[0]}` : `${providerText} · 正在处理 ${activities.length} 个任务`);
    setText(elapsed, ` · 已等待 ${elapsedSeconds} 秒`);
    setText(detail, elapsedSeconds >= 15 ? `模型响应时间较长，仍在继续等待。当前任务：${operations.join("、")}。` : `请求已发送，正在等待模型返回${operations.length > 1 ? `：${operations.join("、")}` : ""}。`);
  };
  update();
  timer = ownerWindow.setInterval(update, 1e3);
  return () => {
    if (timer !== null) {
      ownerWindow.clearInterval(timer);
      timer = null;
    }
  };
}
function findMindTraceScroller(root) {
  const ownerWindow = mindTraceWindow(root);
  let current = root;
  while (current !== null) {
    const style = ownerWindow.getComputedStyle(current);
    if ((style.overflowY === "auto" || style.overflowY === "scroll") && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return root;
}
function captureMindTraceContext(root) {
  const ownerDocument = mindTraceDocument(root);
  const ownerWindow = mindTraceWindow(root);
  const scroller = findMindTraceScroller(root);
  const activeElement = ownerDocument.activeElement;
  const active = activeElement !== null && activeElement.instanceOf(ownerWindow.HTMLElement) && root.contains(activeElement) ? activeElement : null;
  const focusKey = active?.getAttribute("data-mind-trace-focus-key") ?? active?.getAttribute("aria-label") ?? active?.id ?? null;
  return {
    scroller,
    scrollTop: scroller.scrollTop,
    focusKey,
    selectionStart: active?.instanceOf(ownerWindow.HTMLInputElement) || active?.instanceOf(ownerWindow.HTMLTextAreaElement) ? active.selectionStart : null,
    selectionEnd: active?.instanceOf(ownerWindow.HTMLInputElement) || active?.instanceOf(ownerWindow.HTMLTextAreaElement) ? active.selectionEnd : null
  };
}
function restoreMindTraceContext(root, context) {
  const ownerWindow = mindTraceWindow(root);
  ownerWindow.requestAnimationFrame(() => {
    const scroller = findMindTraceScroller(root);
    if (scroller !== null) {
      scroller.scrollTop = context.scrollTop;
    } else if (context.scroller.isConnected) {
      context.scroller.scrollTop = context.scrollTop;
    }
    if (context.focusKey === null) {
      return;
    }
    const candidates = root.querySelectorAll("[data-mind-trace-focus-key], [aria-label], [id]");
    const target = [...candidates].find((element) => element.getAttribute("data-mind-trace-focus-key") === context.focusKey || element.getAttribute("aria-label") === context.focusKey || element.id === context.focusKey);
    if (!(target instanceof ownerWindow.HTMLElement)) {
      return;
    }
    target.focus({ preventScroll: true });
    if ((target.instanceOf(ownerWindow.HTMLInputElement) || target.instanceOf(ownerWindow.HTMLTextAreaElement)) && context.selectionStart !== null && context.selectionEnd !== null) {
      target.setSelectionRange(context.selectionStart, context.selectionEnd);
    }
    if (scroller !== null) {
      scroller.scrollTop = context.scrollTop;
    }
  });
}
var MindTraceConfirmModal = class extends import_obsidian7.Modal {
  declare plugin: any;
  declare configuration: any;
  declare onStart: (() => void) | null;
  constructor(app, plugin, configuration, onStart) {
    super(app);
    this.plugin = plugin;
    this.configuration = configuration;
    this.onStart = onStart;
  }
  onOpen() {
    if (this.plugin.trackOperation?.(this) === false) {
      this.close();
      return;
    }
    this.modalEl.addClass("mind-trace-confirm-modal-shell", "mind-trace-dialog-shell");
    this.contentEl.addClass("mind-trace-confirm-modal");
    this.render();
  }
  onClose() {
    this.contentEl.empty();
    this.plugin.untrackOperation?.(this);
  }
  cancelFromPlugin() {
    this.close();
  }
  render() {
    this.contentEl.empty();
    const eyebrow = this.contentEl.createDiv({ cls: "mind-trace-dialog-eyebrow", text: this.configuration.eyebrow ?? "心迹 · 操作确认" });
    eyebrow.setAttribute("aria-hidden", "true");
    this.contentEl.createDiv({ cls: "mind-trace-dialog-title", text: this.configuration.title });
    this.contentEl.createEl("p", { cls: "mind-trace-dialog-body", text: this.configuration.description ?? "确认后开始处理。" });
    if (this.configuration.stages?.length > 0) {
      const stages = this.contentEl.createEl("ol", { cls: "mind-trace-operation-stage-list" });
      for (const stage of this.configuration.stages) {
        stages.createEl("li", { text: stage });
      }
    }
    const actions = this.contentEl.createDiv({ cls: "mind-trace-actions mind-trace-dialog-actions" });
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { cls: this.configuration.warning ? "mod-warning" : "mod-cta", text: this.configuration.confirmLabel ?? "开始", attr: { type: "button" } });
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      this.close();
      this.onStart?.();
    });
    mindTraceWindow(this.contentEl).requestAnimationFrame(() => confirm.focus({ preventScroll: true }));
  }
};
var ObservationFeedbackModal = class extends import_obsidian7.Modal {
  declare plugin: any;
  declare item: any;
  declare feedback: any;
  declare onSave: any;
  constructor(app, plugin, item, feedback, onSave) {
    super(app);
    this.plugin = plugin;
    this.item = item;
    this.feedback = feedback ?? { status: "pending", correction: "" };
    this.onSave = onSave;
  }
  onOpen() {
    this.modalEl.addClass("mind-trace-observation-feedback-modal", "mind-trace-dialog-shell");
    this.contentEl.addClass("mind-trace-observation-feedback-content");
    this.render();
  }
  onClose() {
    this.contentEl.empty();
  }
  render() {
    this.contentEl.empty();
    this.contentEl.createDiv({ cls: "mind-trace-dialog-eyebrow", text: "观照 · 校准" });
    this.contentEl.createDiv({ cls: "mind-trace-dialog-title", text: "这条观察像你吗？" });
    this.contentEl.createEl("p", { cls: "mind-trace-dialog-body", text: this.item?.text ?? "你可以保留、确认或否认这条观察。" });
    const choices = this.contentEl.createDiv({ cls: "mind-trace-observation-feedback-choices", attr: { role: "radiogroup", "aria-label": "观照校准状态" } });
    const choiceLabels = [["confirmed", "符合"], ["partial", "部分符合"], ["rejected", "不符合"], ["uncertain", "暂时不确定"]];
    for (const [value, label] of choiceLabels) {
      const button = choices.createEl("button", { cls: `mind-trace-observation-feedback-choice${this.feedback.status === value ? " is-selected" : ""}`, text: label, attr: { type: "button", role: "radio", "aria-checked": String(this.feedback.status === value) } });
      button.addEventListener("click", () => {
        this.feedback.status = value;
        for (const candidate of choices.querySelectorAll("button")) {
          candidate.classList.toggle("is-selected", candidate === button);
          candidate.setAttribute("aria-checked", String(candidate === button));
        }
      });
    }
    const correction = this.contentEl.createEl("textarea", { attr: { rows: "3", placeholder: "可选：写下你的修正或补充" } });
    correction.value = this.feedback.correction ?? "";
    const actions = this.contentEl.createDiv({ cls: "mind-trace-actions mind-trace-dialog-actions" });
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", { cls: "mod-cta", text: "保存校准", attr: { type: "button" } });
    save.disabled = this.feedback.status === "pending";
    for (const button of choices.querySelectorAll("button")) {
      button.addEventListener("click", () => {
        save.disabled = false;
      });
    }
    save.addEventListener("click", () => {
      void (async () => {
        save.disabled = true;
        cancel.disabled = true;
        try {
          await this.onSave?.({ status: this.feedback.status, correction: correction.value.trim() });
          this.close();
        } catch (error) {
          save.disabled = false;
          cancel.disabled = false;
          showMindTraceNotice(errorMessage(error), 8e3);
        }
      })();
    });
    mindTraceWindow(this.contentEl).requestAnimationFrame(() => save.focus({ preventScroll: true }));
  }
};
var JournalRegenerationPreviewModal = class extends import_obsidian7.Modal {
  declare plugin: any;
  declare payload: any;
  declare onConfirm: any;
  constructor(app, plugin, payload, onConfirm) {
    super(app);
    this.plugin = plugin;
    this.payload = payload;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    this.modalEl.addClass("mind-trace-journal-regeneration-modal", "mind-trace-dialog-shell");
    this.contentEl.addClass("mind-trace-journal-regeneration-preview");
    this.contentEl.createDiv({ cls: "mind-trace-dialog-eyebrow", text: "心迹日记 · 最新版校样" });
    this.contentEl.createDiv({ cls: "mind-trace-dialog-title", text: this.payload.replacements.length > 1 ? `核对当天 ${this.payload.replacements.length} 次记录` : "核对这次记录" });
    this.contentEl.createEl("p", { cls: "mind-trace-dialog-body", text: `原始问答、自评、日期和时间保持不变。确认后将替换正文、事件、切片和本次轻反思${this.payload.reviewedEventCount > 0 ? `，包括 ${this.payload.reviewedEventCount} 件人工确认事件` : ""}。` });
    const preview = this.contentEl.createDiv({ cls: "mind-trace-journal-regeneration-preview-body" });
    for (const replacement of this.payload.replacements) {
      const session = regeneratedSessionValue(replacement.source, replacement.entry, replacement.assessment);
      renderSession(preview, session, {});
    }
    const actions = this.contentEl.createDiv({ cls: "mind-trace-actions mind-trace-dialog-actions" });
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { cls: "mod-warning", text: "确认替换", attr: { type: "button" } });
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      cancel.disabled = true;
      Promise.resolve(this.onConfirm?.(this.payload)).then(() => this.close()).catch((error) => {
        confirm.disabled = false;
        cancel.disabled = false;
        showMindTraceNotice(errorMessage(error), 8e3);
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var MindTraceOperationResultModal = class extends import_obsidian7.Modal {
  declare plugin: any;
  declare configuration: any;
  declare succeeded: boolean;
  declare result: any;
  declare error: any;
  constructor(app, plugin, configuration, succeeded, result, error) {
    super(app);
    this.plugin = plugin;
    this.configuration = configuration;
    this.succeeded = succeeded;
    this.result = result;
    this.error = error;
  }
  open() {
    if (this.plugin.trackOperation?.(this) === false) {
      return;
    }
    super.open();
  }
  cancelFromPlugin() {
    this.close();
  }
  onOpen() {
    this.modalEl.addClass("mind-trace-operation-result-modal", "mind-trace-dialog-shell");
    this.contentEl.addClass("mind-trace-operation-result");
    const eyebrow = this.contentEl.createDiv({ cls: "mind-trace-dialog-eyebrow", text: this.configuration.eyebrow ?? "心迹 · 任务" });
    eyebrow.setAttribute("aria-hidden", "true");
    this.contentEl.createDiv({
      cls: "mind-trace-dialog-title",
      text: this.succeeded ? this.configuration.successTitle ?? "处理完成" : this.configuration.errorTitle ?? "处理没有完成"
    });
    const successDetail = typeof this.configuration.successDetail === "function" ? this.configuration.successDetail(this.result) : this.configuration.successDetail;
    this.contentEl.createEl("p", {
      cls: "mind-trace-dialog-body",
      text: this.succeeded ? successDetail ?? "相关内容已经更新。" : this.error ?? "发生未知错误。"
    });
    const actions = this.contentEl.createDiv({ cls: "mind-trace-actions mind-trace-dialog-actions" });
    let primary;
    if (!this.succeeded) {
      const closeButton = actions.createEl("button", { text: "关闭", attr: { type: "button" } });
      closeButton.addEventListener("click", () => this.close());
      const retry = actions.createEl("button", { cls: "mod-cta", text: "重试", attr: { type: "button" } });
      retry.addEventListener("click", () => {
        this.close();
        new MindTraceTaskToast(this.app, this.plugin, this.configuration).open();
      });
      primary = retry;
    } else if (this.configuration.onViewResult !== void 0 || this.configuration.successLabel) {
      const view = actions.createEl("button", { cls: "mod-cta", text: this.configuration.successLabel ?? "查看结果", attr: { type: "button" } });
      view.addEventListener("click", () => {
        const result = this.result;
        this.close();
        this.configuration.onViewResult?.(result);
      });
      primary = view;
    } else {
      const done = actions.createEl("button", { cls: "mod-cta", text: "完成", attr: { type: "button" } });
      done.addEventListener("click", () => this.close());
      primary = done;
    }
    mindTraceWindow(this.contentEl).requestAnimationFrame(() => primary.focus({ preventScroll: true }));
  }
  onClose() {
    this.contentEl.empty();
    this.plugin.untrackOperation?.(this);
  }
};
var MindTraceTaskToast = class {
  declare app: any;
  declare plugin: any;
  declare configuration: any;
  declare ownerDocument: Document;
  declare ownerWindow: ReturnType<typeof mindTraceWindow>;
  constructor(app, plugin, configuration) {
    this.app = app;
    this.plugin = plugin;
    this.configuration = configuration;
    this.ownerDocument = mindTraceWorkspaceDocument(app);
    this.ownerWindow = mindTraceWindow(this.ownerDocument.body);
  }
  phase = "running";
  minimized = false;
  progress = null;
  settled = false;
  result = null;
  error = null;
  startedAt = 0;
  elapsedTimer = null;
  stopLlmStatus = null;
  host = null;
  card = null;
  autoCloseTimer = null;
  dockListener = null;
  resizeListener = null;
  eyebrowEl = null;
  titleEl = null;
  bodyEl = null;
  actionsEl = null;
  shellBuilt = false;
  cancelled = false;
  open() {
    if (this.plugin.trackOperation?.(this) === false) {
      this.cancelled = true;
      return this;
    }
    void this.start();
    return this;
  }
  buildDom() {
    if (this.host !== null) {
      return;
    }
    this.host = this.ownerDocument.body.createDiv({ cls: "mind-trace-toast-host" });
    this.card = this.host.createDiv({
      cls: "mind-trace-task-toast",
      attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" }
    });
    this.dockHost();
  }
  dockHost() {
    if (this.host === null) {
      return;
    }
    if (this.phase === "running") {
      const nav = this.ownerDocument.querySelector(".mind-trace-nav");
      if (nav !== null && nav.instanceOf(this.ownerWindow.HTMLElement)) {
        this.host.addClass("is-docked");
        this.host.setCssProps({ top: `${nav.getBoundingClientRect().bottom}px` });
        if (this.dockListener === null) {
          this.dockListener = () => this.dockHost();
          this.ownerWindow.addEventListener("scroll", this.dockListener, { capture: true, passive: true });
        }
        if (this.resizeListener === null) {
          this.resizeListener = () => this.dockHost();
          this.ownerWindow.addEventListener("resize", this.resizeListener);
        }
        return;
      }
    }
    this.host.removeClass("is-docked");
    this.host.setCssProps({ top: "" });
  }
  buildShell() {
    if (this.card === null) {
      return;
    }
    this.card.empty();
    this.eyebrowEl = this.card.createDiv({ cls: "mind-trace-dialog-eyebrow", text: this.configuration.eyebrow ?? "心迹 · 任务" });
    this.eyebrowEl.setAttribute("aria-hidden", "true");
    this.titleEl = this.card.createDiv({ cls: "mind-trace-dialog-title" });
    this.bodyEl = this.card.createDiv();
    this.actionsEl = this.card.createDiv({ cls: "mind-trace-actions mind-trace-dialog-actions" });
    this.shellBuilt = true;
  }
  close() {
    if (this.autoCloseTimer !== null) {
      this.ownerWindow.clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
    if (this.dockListener !== null) {
      this.ownerWindow.removeEventListener("scroll", this.dockListener, { capture: true });
      this.dockListener = null;
    }
    if (this.resizeListener !== null) {
      this.ownerWindow.removeEventListener("resize", this.resizeListener);
      this.resizeListener = null;
    }
    this.stopTimers();
    this.host?.remove();
    this.host = null;
    this.card = null;
    this.plugin.untrackOperation?.(this);
  }
  cancelFromPlugin() {
    this.cancelled = true;
    this.close();
  }
  minimize() {
    this.minimized = true;
    this.render();
  }
  expand() {
    this.minimized = false;
    this.render();
  }
  stopTimers() {
    this.stopLlmStatus?.();
    this.stopLlmStatus = null;
    if (this.elapsedTimer !== null) {
      this.ownerWindow.clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }
  async start() {
    if (this.phase === "running" && this.startedAt !== 0) {
      return;
    }
    if (this.autoCloseTimer !== null) {
      this.ownerWindow.clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
    this.phase = "running";
    this.settled = false;
    this.error = null;
    this.startedAt = Date.now();
    this.progress = {
      stage: 1,
      total: this.configuration.stages?.length ?? 1,
      title: this.configuration.stages?.[0] ?? this.configuration.runningTitle ?? "正在处理",
      detail: this.configuration.runningDetail ?? "正在准备所需内容。"
    };
    const slow = Symbol("slow");
    const task = Promise.resolve().then(() => this.configuration.run((progress) => this.updateProgress(progress)));
    const minimumDelay = new Promise((resolve) => this.ownerWindow.setTimeout(() => resolve(slow), 120));
    try {
      const winner = await Promise.race([task.then((value) => ({ value })), minimumDelay]);
      if (this.cancelled) return;
      if (winner === slow) {
        this.buildDom();
        this.render();
        const result = await task;
        if (!this.cancelled) await this.settleSuccess(result);
      } else {
        this.buildDom();
        await this.settleSuccess((winner as any).value);
      }
    } catch (error) {
      if (!this.cancelled) {
        this.buildDom();
        await this.settleError(error);
      }
    } finally {
      this.stopTimers();
    }
  }
  async settleSuccess(result) {
    if (this.cancelled) return;
    this.result = result;
    await this.configuration.onSuccess?.(result);
    this.settled = true;
    this.phase = "success";
    if (this.minimized) {
      showMindTraceNotice(this.configuration.backgroundSuccess ?? this.configuration.successTitle ?? "处理完成");
      this.close();
      return;
    }
    this.showResultModal(true);
  }
  async settleError(error) {
    if (this.cancelled) return;
    this.error = errorMessage(error);
    this.settled = true;
    this.phase = "error";
    await this.configuration.onError?.(error);
    if (this.minimized) {
      showMindTraceNotice(this.error, 8e3);
      this.close();
      return;
    }
    this.showResultModal(false);
  }
  showResultModal(succeeded) {
    const result = this.result;
    const error = this.error;
    this.close();
    new MindTraceOperationResultModal(this.app, this.plugin, this.configuration, succeeded, result, error).open();
  }
  updateProgress(progress) {
    if (this.cancelled) return;
    this.progress = { ...this.progress, ...progress };
    if (!this.minimized && this.phase === "running") {
      this.paintProgress();
    }
  }
  paintProgress() {
    if (this.card === null) {
      return;
    }
    const progress = this.progress;
    if (progress === null) {
      return;
    }
    const marker = this.card.querySelector(".mind-trace-operation-stage-marker");
    const title = this.card.querySelector(".mind-trace-operation-stage-title");
    const detail = this.card.querySelector(".mind-trace-operation-stage-detail");
    const elapsed = this.card.querySelector(".mind-trace-operation-elapsed");
    if (marker !== null) marker.textContent = `${String(progress.stage).padStart(2, "0")} / ${String(progress.total).padStart(2, "0")}`;
    if (title !== null) title.textContent = progress.title;
    if (detail !== null) detail.textContent = progress.current !== void 0 && progress.count !== void 0 ? `${progress.detail}（${progress.current}/${progress.count}）` : progress.detail;
    if (elapsed !== null) elapsed.textContent = `已进行 ${Math.max(0, Math.floor((Date.now() - this.startedAt) / 1e3))} 秒`;
    for (const [index, item] of [...this.card.querySelectorAll(".mind-trace-operation-stage")].entries()) {
      item.toggleClass("is-complete", index + 1 < progress.stage);
      item.toggleClass("is-active", index + 1 === progress.stage);
    }
    const pillElapsed = this.card.querySelector(".mind-trace-toast-pill-elapsed");
    if (pillElapsed !== null) {
      pillElapsed.textContent = `${Math.max(0, Math.floor((Date.now() - this.startedAt) / 1e3))}s`;
    }
  }
  render() {
    if (this.card === null || this.host === null) {
      return;
    }
    this.stopTimers();
    this.dockHost();
    if (this.minimized && this.phase === "running") {
      this.card.empty();
      this.shellBuilt = false;
      const pill = this.card.createDiv({ cls: "mind-trace-toast-pill" });
      pill.createSpan({ cls: "mind-trace-toast-pill-dot", attr: { "aria-hidden": "true" } });
      const copy = pill.createDiv();
      copy.createDiv({ cls: "mind-trace-toast-pill-title", text: this.configuration.runningHeading ?? this.configuration.title });
      copy.createSpan({ cls: "mind-trace-toast-pill-elapsed" });
      const expand = pill.createEl("button", { text: "展开", attr: { type: "button", "aria-label": "展开任务进度" } });
      expand.addEventListener("click", () => this.expand());
      this.paintProgress();
      this.elapsedTimer = this.ownerWindow.setInterval(() => this.paintProgress(), 1e3);
      return;
    }
    if (!this.shellBuilt) {
      this.buildShell();
    }
    this.titleEl.empty();
    this.bodyEl.empty();
    this.actionsEl.empty();
    if (this.phase === "running") {
      this.card.setAttribute("role", "status");
      this.titleEl.textContent = this.configuration.runningHeading ?? this.configuration.title;
      const progress = this.bodyEl.createDiv({ cls: "mind-trace-operation-progress", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
      progress.createDiv({ cls: "mind-trace-operation-stage-marker" });
      const copy = progress.createDiv({ cls: "mind-trace-operation-progress-copy" });
      copy.createDiv({ cls: "mind-trace-operation-stage-title" });
      copy.createEl("p", { cls: "mind-trace-operation-stage-detail" });
      copy.createEl("small", { cls: "mind-trace-operation-elapsed" });
      if (this.configuration.stages?.length > 0) {
        const rail = this.bodyEl.createDiv({ cls: "mind-trace-operation-stage-rail", attr: { "aria-label": "处理阶段" } });
        for (const [index, stage] of this.configuration.stages.entries()) {
          const item = rail.createDiv({ cls: "mind-trace-operation-stage" });
          item.createSpan({ text: String(index + 1).padStart(2, "0") });
          item.createDiv({ text: stage });
        }
      }
      const llm = this.bodyEl.createDiv({ cls: "mind-trace-operation-llm mind-trace-llm-inline-status" });
      this.stopLlmStatus = attachLlmActivityStatus(llm, this.plugin, this.progress?.title ?? "正在准备任务…");
      const background = this.actionsEl.createEl("button", { text: "后台继续", attr: { type: "button" } });
      background.addEventListener("click", () => this.minimize());
      this.paintProgress();
      this.elapsedTimer = this.ownerWindow.setInterval(() => this.paintProgress(), 1e3);
      return;
    }
  }
};
function openMindTraceOperation(app, plugin, configuration) {
  if (configuration.confirm === false) {
    return new MindTraceTaskToast(app, plugin, configuration).open();
  }
  new MindTraceConfirmModal(app, plugin, configuration, () => {
    new MindTraceTaskToast(app, plugin, configuration).open();
  }).open();
  return null;
}
async function trashMindTraceFile(view, file, label) {
  if (view.file?.path !== file.path) {
    showMindTraceNotice("页面已经切换，未执行删除");
    return;
  }
  const current = view.app.vault.getAbstractFileByPath(file.path);
  if (!(current instanceof import_obsidian7.TFile)) {
    showMindTraceNotice(`这篇${label}已经移动或删除`);
    return;
  }
  try {
    view.plugin.assertOperational?.();
    await view.app.fileManager.trashFile(current);
    view.plugin.historyIndex?.invalidate(file.path);
    view.plugin.emitMetricsChanged();
    showMindTraceNotice(`${label}已删除`);
    view.leaf.detach();
  } catch (error) {
    showMindTraceNotice(`无法删除${label}：${errorMessage(error)}`, 8e3);
  }
}
function confirmMindTraceFileDeletion(view, label) {
  const file = view.file;
  if (!(file instanceof import_obsidian7.TFile)) {
    showMindTraceNotice(`这篇${label}已经移动或删除`);
    return;
  }
  const description = label === "日记" ? "仅删除当前日记文件；已有周报和月报文件不会同时删除。文件将按照 Obsidian 当前的文件删除设置处理。" : `仅删除当前${label}文件；用于生成它的日记不会被删除。文件将按照 Obsidian 当前的文件删除设置处理。`;
  new MindTraceConfirmModal(view.app, view.plugin, {
    eyebrow: `心迹${label} · 删除确认`,
    title: `删除这篇${label}？`,
    description,
    confirmLabel: `删除${label}`,
    warning: true
  }, () => {
    void trashMindTraceFile(view, file, label);
  }).open();
}

var OBSERVATION_VIEW_TYPE = "mind-trace-observation-file-view";
var SavedObservationView = class extends import_obsidian7.TextFileView {
  declare plugin: any;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return OBSERVATION_VIEW_TYPE; }
  getDisplayText() { return this.file?.basename ?? "心迹观照"; }
  getIcon() { return "scan-eye"; }
  getViewData() { return this.data; }
  setViewData(data) { this.data = data; this.render(); }
  clear() { this.contentEl.empty(); }
  render() {
    this.contentEl.empty();
    this.contentEl.addClass("mind-trace-view", "mind-trace-saved-file-view", "mind-trace-observation-file-view");
    if (renderPrivacyGate(this.contentEl, this.plugin)) return;
    const shell = this.contentEl.createDiv({ cls: "mind-trace-page-shell mind-trace-observation-page" });
    try {
      const snapshot = parseObservationMarkdown(this.data, this.file?.path ?? "");
      const heading = shell.createDiv({ cls: "mind-trace-page-heading" });
      heading.createDiv({ cls: "mind-trace-eyebrow", text: snapshot.legacy ? "历史观照 · 旧版" : "观照 · Markdown" });
      heading.createDiv({ cls: "mind-trace-page-title", text: "最近的变化全景", attr: { role: "heading", "aria-level": "1" } });
      heading.createEl("p", { text: `${snapshot.generatedAt?.slice(0, 19).replace("T", " ") || "生成时间未记录"} · ${snapshot.sources?.length ?? 0} 份来源报告` });
      const actions = heading.createDiv({ cls: "mind-trace-actions" });
      const edit = actions.createEl("button", { text: "编辑 Markdown", attr: { type: "button" } });
      edit.addEventListener("click", () => { if (this.file) void this.plugin.openProtectedMarkdownSource(this.leaf, this.file); });
      const latest = actions.createEl("button", { cls: "mod-cta", text: "基于最新来源重新观照", attr: { type: "button" } });
      latest.addEventListener("click", () => {
        void this.plugin.openJournal().then(() => {
          const view = this.app.workspace.getLeavesOfType(JOURNAL_VIEW_TYPE)[0]?.view;
          if (view instanceof JournalView) view.setMode("observation");
        });
      });
      const remove = actions.createEl("button", { text: "删除", attr: { type: "button" } });
      remove.addEventListener("click", () => {
        if (!this.file) return;
        openMindTraceOperation(this.app, this.plugin, { eyebrow: "观照 · 删除确认", title: "删除这份观照？", description: "只删除当前 Markdown 文件，不影响来源报告、日记或其他历史版本。", confirmLabel: "删除", warning: true, run: async () => this.plugin.deleteSelfObservation(this.file.path), onSuccess: () => this.leaf.detach(), successTitle: "观照已移到废纸篓", successDetail: "其他内容仍然保留。", backgroundSuccess: "观照已删除" });
      });
      const hero = shell.createEl("section", { cls: "mind-trace-observation-hero" });
      hero.createDiv({ cls: "mind-trace-observation-summary", text: snapshot.analysis?.summary ?? "这份历史观照没有可解析概览。" });
      if (snapshot.analysis?.schemaVersion === 2) {
        for (const claim of snapshot.analysis.claims) {
          const card = shell.createEl("article", { cls: `mind-trace-observation-claim is-${claim.layer}` });
          const top = card.createDiv({ cls: "mind-trace-observation-item-top" });
          top.createSpan({ cls: "mind-trace-observation-dimension", text: claim.dimension });
          top.createSpan({ cls: "mind-trace-observation-layer", text: claim.layer === "fact" ? "事实" : claim.layer === "hypothesis" ? "假设" : "推断" });
          card.createDiv({ cls: "mind-trace-observation-item-copy", text: claim.statement });
          if (claim.before || claim.now) card.createDiv({ cls: "mind-trace-observation-change-copy", text: `${claim.before || "暂无明确对照"} → ${claim.now || "暂无明确对照"}` });
          if (claim.alternative) card.createDiv({ cls: "mind-trace-observation-alternative", text: `另一种解释：${claim.alternative}` });
          if (claim.missingInformation) card.createDiv({ cls: "mind-trace-observation-basis", text: `仍缺少的信息：${claim.missingInformation}` });
          if (claim.verificationQuestion) card.createDiv({ cls: "mind-trace-observation-question", text: `可以问自己：${claim.verificationQuestion}` });
        }
        const closing = shell.createEl("section", { cls: "mind-trace-observation-closing" });
        closing.createDiv({ cls: "mind-trace-observation-section-title", text: "接下来值得观察什么" });
        closing.createDiv({ cls: "mind-trace-observation-next-step", text: snapshot.analysis.nextObservation });
      } else {
        shell.createEl("p", { cls: "mind-trace-observation-section-note", text: "这是从旧版 data.json 迁移的观照。编辑 Markdown 可查看和保留原始旧栏目。" });
      }
    } catch (error) {
      const state = shell.createDiv({ cls: "mind-trace-observation-state", attr: { role: "alert" } });
      state.createDiv({ cls: "mind-trace-observation-state-title", text: "这份观照无法解析" });
      state.createEl("p", { text: `${this.file?.path ?? "未知路径"}：${errorMessage(error)}` });
      const edit = state.createEl("button", { text: "编辑 Markdown", attr: { type: "button" } });
      edit.addEventListener("click", () => { if (this.file) void this.plugin.openProtectedMarkdownSource(this.leaf, this.file); });
    }
  }
};
