// src/generation.ts
import * as obsidian from "obsidian";
import { EVENT_KINDS, EVENT_KIND_LABELS, EVENT_RELATION_LABELS, EVENT_RELATION_TYPES, EVENT_ROLES, EVENT_ROLE_LABELS, EVENT_STATUSES, EVENT_STATUS_LABELS, EVENT_TRACE_CERTAINTIES, EVENT_TRACE_CERTAINTY_LABELS, EVENT_TRACE_KINDS, EVENT_TRACE_KIND_LABELS, EVENT_TRACE_KIND_LAYERS, EVENT_TYPES, EVENT_TYPE_LABELS, MAX_EVENT_ARGUMENTS, MAX_EVENT_RELATIONS, MAX_EVENT_TRACES, MAX_SESSION_EVENTS, buildEventBackfillMessages, buildFollowUpMessages, buildJournalMessages, buildMonthlyReportMessages, buildObservationMessages, buildRatingMessages, buildRepairMessages, buildWeeklyReportMessages, computeObservationMaturity, eventEntityKey, normalizeEvent, observationEvidenceCatalog, parseEventBackfill, parseFollowUp, parseGeneratedEntry, parseMonthlyReport, parseObservation, parseRatingAssessment, parseWeeklyReport, validateEvents } from "./conversation";
import { autoGrow } from "./journal-view";

export { EventEditor, RatingScaleEditor, ThemeEditor, generateEventBackfill, generateFollowUp, generateJournal, generateMonthlyReport, generateObservation, generateRatingAssessment, generateWeeklyReport };

async function parseWithRepair(provider, raw, shape, parser) {
  try {
    return parser(raw);
  } catch {
    const repaired = await provider.generate(
      buildRepairMessages(raw, shape),
      "repair"
    );
    return parser(repaired);
  }
}
async function generateFollowUp(provider, draft, history = "") {
  const raw = await provider.generate(
    buildFollowUpMessages(draft, history),
    "follow-up"
  );
  return parseWithRepair(provider, raw, "follow-up", parseFollowUp);
}
async function generateJournal(provider, draft, history, settings) {
  const raw = await provider.generate(
    buildJournalMessages(
      draft,
      history,
      settings.reflectionTone,
      settings.customInstructions
    ),
    "journal"
  );
  return parseWithRepair(provider, raw, "journal", parseGeneratedEntry);
}
async function generateRatingAssessment(provider, draft) {
  const raw = await provider.generate(
    buildRatingMessages(draft),
    "rating"
  );
  return parseWithRepair(
    provider,
    raw,
    "rating",
    parseRatingAssessment
  );
}
async function generateWeeklyReport(provider, source, settings) {
  const raw = await provider.generate(buildWeeklyReportMessages(source, settings), "weekly-report");
  try {
    return parseWeeklyReport(raw, source.period, source, true);
  } catch {
    const repaired = await provider.generate(buildRepairMessages(raw, "weekly-report"), "repair");
    return parseWeeklyReport(repaired, source.period, source, false);
  }
}
async function generateMonthlyReport(provider, source, settings) {
  const raw = await provider.generate(buildMonthlyReportMessages(source, settings), "monthly-report");
  try {
    return parseMonthlyReport(raw, source.period, source, true);
  } catch {
    const repaired = await provider.generate(buildRepairMessages(raw, "monthly-report"), "repair");
    return parseMonthlyReport(repaired, source.period, source, false);
  }
}
async function generateObservation(provider, reports, feedback = {}, maturity = computeObservationMaturity(reports)) {
  if (observationEvidenceCatalog(reports).length === 0) {
    throw new Error("来源报告没有可引用的结构化事件，无法生成观照；请先重新生成带事件依据的周报或月报");
  }
  const raw = await provider.generate(buildObservationMessages(reports, feedback, maturity), "observation");
  return parseWithRepair(provider, raw, "observation", (value) => parseObservation(value, reports, maturity));
}
async function generateEventBackfill(provider, sessions, knownElements = [], maximum = 50, preservedSessions = []) {
  const messages = buildEventBackfillMessages(sessions, knownElements, maximum, preservedSessions);
  const inputLength = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (inputLength > 6e4) {
    throw new Error("本周事件上下文超过 60000 字符，未发送模型也未修改日记；请精简异常长的单篇日记后重试");
  }
  const raw = await provider.generate(messages, "event-backfill");
  return parseWithRepair(provider, raw, "event-backfill", (value) => parseEventBackfill(value, sessions, maximum));
}

// src/preview-controls.ts
var RatingScaleEditor = class {
  declare onChange: ((value: number) => void) | null;
  constructor(container, label, initialValue, onChange) {
    this.onChange = onChange;
    this.value = initialValue;
    const editor = container.createDiv({
      cls: "mind-trace-scale-editor"
    });
    const heading = editor.createDiv({
      cls: "mind-trace-scale-heading"
    });
    heading.createSpan({ text: label });
    this.output = heading.createEl("output", {
      text: `${initialValue}/5`,
      attr: {
        "aria-live": "polite"
      }
    });
    const scale = editor.createDiv({
      cls: "mind-trace-scale",
      attr: {
        role: "group",
        "aria-label": `${label}评分`
      }
    });
    for (let score = 1; score <= 5; score += 1) {
      const button = scale.createEl("button", {
        cls: "mind-trace-scale-point",
        text: String(score),
        attr: {
          type: "button",
          "aria-label": `${label} ${score} 分`,
          "aria-pressed": String(score === initialValue)
        }
      });
      button.addEventListener("click", () => {
        this.setValue(score);
      });
      this.buttons.push(button);
    }
    this.paint();
  }
  value;
  output;
  buttons = [];
  getValue() {
    return this.value;
  }
  setValue(value) {
    this.value = value;
    this.output.textContent = `${value}/5`;
    this.paint();
    this.onChange?.(value);
  }
  paint() {
    for (const [index, button] of this.buttons.entries()) {
      const score = index + 1;
      button.toggleClass("is-selected", score === this.value);
      button.setAttribute("aria-pressed", String(score === this.value));
    }
  }
};
var ThemeEditor = class {
  declare container: HTMLElement;
  constructor(container, initialValues) {
    this.container = container;
    this.values = [...new Set(initialValues)];
    this.render();
  }
  values;
  input;
  getValues() {
    this.commitInput();
    return [...this.values];
  }
  render() {
    this.container.empty();
    this.container.setAttribute("role", "group");
    this.container.setAttribute("aria-label", "日记主题");
    for (const theme of this.values) {
      const pill = this.container.createSpan({
        cls: "mind-trace-theme-pill"
      });
      pill.createSpan({ text: theme });
      const remove = pill.createEl("button", {
        text: "\xD7",
        attr: {
          type: "button",
          "aria-label": `移除主题 ${theme}`
        }
      });
      remove.addEventListener("click", () => {
        const index = this.values.indexOf(theme);
        if (index !== -1) {
          this.values.splice(index, 1);
          this.render();
          this.input.focus();
        }
      });
    }
    this.input = this.container.createEl("input", {
      cls: "mind-trace-theme-input",
      attr: {
        type: "text",
        placeholder: this.values.length < 5 ? "添加主题，按回车确认" : "最多 5 个主题",
        "aria-label": "添加主题"
      }
    });
    this.input.disabled = this.values.length >= 5;
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "," || event.key === "，") {
        event.preventDefault();
        if (this.commitInput()) {
          this.render();
          this.input.focus();
        }
      }
    });
    this.input.addEventListener("blur", () => {
      if (this.commitInput()) {
        this.render();
      }
    });
  }
  commitInput() {
    if (this.values.length >= 5) {
      return false;
    }
    const theme = this.input.value.trim().replace(/[,，]+$/, "");
    this.input.value = "";
    if (theme.length === 0 || this.values.includes(theme)) {
      return false;
    }
    this.values.push(theme);
    return true;
  }
};
var EventEditor = class {
  declare container: HTMLElement;
  declare onChange: ((count: number) => void) | null;
  constructor(container, initialEvents, onChange = null, options: { collapsible?: boolean; focusIndex?: number } = {}) {
    this.container = container;
    this.onChange = onChange;
    this.collapsible = options.collapsible === true;
    this.events = (Array.isArray(initialEvents) ? initialEvents : []).map((event) => normalizeEvent(event));
    if (this.collapsible && Number.isInteger(options.focusIndex) && options.focusIndex >= 0 && options.focusIndex < this.events.length) {
      this.expandedIndexes.add(options.focusIndex);
    }
    this.render();
  }
  events;
  collapsible = false;
  expandedIndexes = /* @__PURE__ */ new Set();
  getValues() {
    return validateEvents(this.events.map((event) => normalizeEvent(event)));
  }
  notify() {
    this.onChange?.(this.events.length);
  }
  addEvent() {
    if (this.events.length >= MAX_SESSION_EVENTS) {
      return;
    }
    this.events.push({
      id: "",
      type: "other",
      status: "occurred",
      title: "",
      summary: "",
      traces: [],
      arguments: [{ role: "related", label: "相关", entity: { kind: "topic", name: "" } }],
      relations: []
    });
    if (this.collapsible) {
      this.expandedIndexes.clear();
      this.expandedIndexes.add(this.events.length - 1);
    }
    this.render();
    this.notify();
    this.container.querySelector<HTMLElement>(".mind-trace-event-title-input:last-of-type")?.focus();
  }
  render() {
    this.container.empty();
    this.container.setAttribute("aria-live", "polite");
    if (this.events.length === 0) {
      const empty = this.container.createDiv({ cls: "mind-trace-event-editor-empty" });
      empty.createDiv({ cls: "mind-trace-event-empty-title", text: "今天没有提取到明确事件" });
      empty.createEl("p", { text: "如果有一件值得单独留下的事，可以手动添加。" });
    }
    const list = this.container.createDiv({ cls: "mind-trace-event-editor-list" });
    this.events.forEach((event, eventIndex) => {
      const expanded = !this.collapsible || this.expandedIndexes.has(eventIndex);
      const card = list.createEl("article", { cls: `mind-trace-event-editor-card${expanded ? " is-expanded" : " is-collapsed"}` });
      const heading = card.createDiv({ cls: "mind-trace-event-editor-heading" });
      const label = heading.createDiv({ cls: "mind-trace-event-editor-label" });
      label.createSpan({ text: `事件 ${eventIndex + 1}` });
      if (this.collapsible) {
        label.createEl("strong", { text: event.title.trim().length > 0 ? event.title : "未命名事件" });
      }
      const controls = heading.createDiv({ cls: "mind-trace-event-editor-controls" });
      if (this.collapsible) {
        const toggle = controls.createEl("button", {
          text: expanded ? "收起" : "编辑",
          attr: { type: "button", "aria-expanded": String(expanded), "aria-label": `${expanded ? "收起" : "编辑"}事件 ${eventIndex + 1}` }
        });
        toggle.addEventListener("click", () => {
          if (expanded) {
            this.expandedIndexes.delete(eventIndex);
          } else {
            this.expandedIndexes.clear();
            this.expandedIndexes.add(eventIndex);
          }
          this.render();
        });
      }
      if (!expanded) {
        card.createEl("p", { cls: "mind-trace-event-editor-collapsed-summary", text: event.summary });
        const compactStatus = card.createDiv({ cls: "mind-trace-event-ledger-status" });
        compactStatus.createSpan({ text: EVENT_STATUS_LABELS[event.status] });
        if (event.traces.length > 0) {
          compactStatus.createSpan({ text: `${event.traces.length} 条体验/方向线索` });
        }
        const compactElements = card.createDiv({ cls: "mind-trace-event-ledger-elements", attr: { "aria-label": "事件论元" } });
        for (const argument of event.arguments.slice(0, 6)) {
          const pill = compactElements.createSpan({ cls: `mind-trace-event-element is-${argument.entity.kind}` });
          pill.createSpan({ text: argument.label });
          pill.createEl("strong", { text: argument.entity.name });
        }
        return;
      }
      const remove = controls.createEl("button", {
        cls: "mind-trace-event-remove",
        text: "移除",
        attr: { type: "button", "aria-label": `移除事件 ${eventIndex + 1}` }
      });
      remove.addEventListener("click", () => {
        this.events.splice(eventIndex, 1);
        this.expandedIndexes.clear();
        if (this.collapsible && this.events.length > 0) {
          this.expandedIndexes.add(Math.min(eventIndex, this.events.length - 1));
        }
        this.render();
        this.notify();
      });
      const identity = card.createDiv({ cls: "mind-trace-event-identity-row" });
      const eventType = identity.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 类型` } });
      for (const value of EVENT_TYPES) {
        eventType.createEl("option", { value, text: EVENT_TYPE_LABELS[value] });
      }
      eventType.value = event.type;
      eventType.addEventListener("change", () => {
        event.type = EVENT_TYPES.includes(eventType.value) ? eventType.value : "other";
      });
      const eventStatus = identity.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 进展状态` } });
      for (const value of EVENT_STATUSES) {
        eventStatus.createEl("option", { value, text: EVENT_STATUS_LABELS[value] });
      }
      eventStatus.value = event.status;
      eventStatus.addEventListener("change", () => {
        event.status = EVENT_STATUSES.includes(eventStatus.value) ? eventStatus.value : "occurred";
      });
      const title = identity.createEl("input", {
        cls: "mind-trace-event-title-input",
        attr: {
          type: "text",
          value: event.title,
          maxlength: "60",
          placeholder: "这件事的短标题",
          "aria-label": `事件 ${eventIndex + 1} 标题`
        }
      });
      title.addEventListener("input", () => {
        event.title = title.value;
      });
      const summary = card.createEl("textarea", {
        cls: "mind-trace-event-summary-input",
        text: event.summary,
        attr: {
          rows: "2",
          maxlength: "240",
          placeholder: "发生了什么",
          "aria-label": `事件 ${eventIndex + 1} 概要`
        }
      });
      summary.addEventListener("input", () => {
        event.summary = summary.value;
      });
      autoGrow(summary);
      card.createDiv({ cls: "mind-trace-event-editor-subtitle", text: "体验与方向线索（只保留明确表达）" });
      const tracesHost = card.createDiv({ cls: "mind-trace-event-traces-editor" });
      const renderTraces = () => {
        tracesHost.empty();
        event.traces.forEach((trace, traceIndex) => {
          const row = tracesHost.createDiv({ cls: "mind-trace-event-trace-row" });
          const kind = row.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 线索 ${traceIndex + 1} 类型` } });
          for (const value of EVENT_TRACE_KINDS) {
            kind.createEl("option", { value, text: EVENT_TRACE_KIND_LABELS[value] });
          }
          kind.value = trace.kind;
          kind.addEventListener("change", () => {
            trace.kind = EVENT_TRACE_KINDS.includes(kind.value) ? kind.value : "fact";
            trace.layer = EVENT_TRACE_KIND_LAYERS[trace.kind];
          });
          const certainty = row.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 线索 ${traceIndex + 1} 确定性` } });
          for (const value of EVENT_TRACE_CERTAINTIES) {
            certainty.createEl("option", { value, text: EVENT_TRACE_CERTAINTY_LABELS[value] });
          }
          certainty.value = trace.certainty;
          certainty.addEventListener("change", () => {
            trace.certainty = EVENT_TRACE_CERTAINTIES.includes(certainty.value) ? certainty.value : "stated";
          });
          const textInput = row.createEl("input", {
            attr: { type: "text", value: trace.text, maxlength: "160", placeholder: "用户表达的体验、目标或未决事项", "aria-label": `事件 ${eventIndex + 1} 线索 ${traceIndex + 1} 内容` }
          });
          textInput.addEventListener("input", () => {
            trace.text = textInput.value;
          });
          const evidence = row.createEl("input", {
            attr: { type: "text", value: trace.evidence, maxlength: "160", placeholder: "对应的短原话（可留空）", "aria-label": `事件 ${eventIndex + 1} 线索 ${traceIndex + 1} 依据` }
          });
          evidence.addEventListener("input", () => {
            trace.evidence = evidence.value;
          });
          const removeTrace = row.createEl("button", { attr: { type: "button", "aria-label": `移除事件 ${eventIndex + 1} 的线索 ${traceIndex + 1}` } });
          (0, obsidian.setIcon)(removeTrace, "x");
          removeTrace.addEventListener("click", () => {
            event.traces.splice(traceIndex, 1);
            renderTraces();
          });
        });
        const addTrace = tracesHost.createEl("button", { cls: "mind-trace-event-add-element", text: "+ 添加体验或方向线索", attr: { type: "button" } });
        addTrace.disabled = event.traces.length >= MAX_EVENT_TRACES;
        addTrace.addEventListener("click", () => {
          event.traces.push({ kind: "emotion", layer: "self_report", certainty: "stated", text: "", evidence: "" });
          renderTraces();
          tracesHost.querySelector<HTMLInputElement>(".mind-trace-event-trace-row:last-of-type input")?.focus();
        });
      };
      card.createDiv({ cls: "mind-trace-event-editor-subtitle", text: "事件论元" });
      const argumentsHost = card.createDiv({ cls: "mind-trace-event-elements-editor" });
      const renderArguments = () => {
        argumentsHost.empty();
        event.arguments.forEach((argument, argumentIndex) => {
          const row = argumentsHost.createDiv({ cls: "mind-trace-event-element-row mind-trace-event-argument-row" });
          const role = row.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 论元角色` } });
          for (const value of EVENT_ROLES) {
            role.createEl("option", { value, text: EVENT_ROLE_LABELS[value] });
          }
          role.value = argument.role;
          role.addEventListener("change", () => {
            argument.role = EVENT_ROLES.includes(role.value) ? role.value : "related";
            argument.label = EVENT_ROLE_LABELS[argument.role];
          });
          const kind = row.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 实体类型` } });
          for (const value of EVENT_KINDS) {
            kind.createEl("option", { value, text: EVENT_KIND_LABELS[value] });
          }
          kind.value = argument.entity.kind;
          kind.addEventListener("change", () => {
            argument.entity.kind = EVENT_KINDS.includes(kind.value) ? kind.value : "topic";
            renderRelations();
          });
          const name = row.createEl("input", {
            attr: {
              type: "text",
              value: argument.entity.name,
              maxlength: "32",
              placeholder: "实体名称",
              "aria-label": `事件 ${eventIndex + 1} 论元 ${argumentIndex + 1} 名称`
            }
          });
          name.addEventListener("input", () => {
            argument.entity.name = name.value;
            renderRelations();
          });
          const removeElement = row.createEl("button", {
            attr: { type: "button", "aria-label": `移除事件 ${eventIndex + 1} 的论元 ${argumentIndex + 1}` }
          });
          (0, obsidian.setIcon)(removeElement, "x");
          removeElement.addEventListener("click", () => {
            event.arguments.splice(argumentIndex, 1);
            event.relations = [];
            renderArguments();
            renderRelations();
          });
        });
        const addElement = argumentsHost.createEl("button", {
          cls: "mind-trace-event-add-element",
          text: "+ 添加论元",
          attr: { type: "button" }
        });
        addElement.disabled = event.arguments.length >= MAX_EVENT_ARGUMENTS;
        addElement.addEventListener("click", () => {
          event.arguments.push({ role: "related", label: "相关", entity: { kind: "topic", name: "" } });
          renderArguments();
          argumentsHost.querySelector<HTMLInputElement>(".mind-trace-event-element-row:last-of-type input")?.focus();
        });
      };
      card.createDiv({ cls: "mind-trace-event-editor-subtitle", text: "明确关系（可选）" });
      const relationsHost = card.createDiv({ cls: "mind-trace-event-relations-editor" });
      const renderRelations = () => {
        relationsHost.empty();
        const available = event.arguments.filter((argument) => argument.entity.name.trim().length > 0);
        event.relations.forEach((relation, relationIndex) => {
          const row = relationsHost.createDiv({ cls: "mind-trace-event-relation-row" });
          const subject = row.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 关系主体` } });
          const object = row.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 关系客体` } });
          const relationKind = row.createEl("select", { attr: { "aria-label": `事件 ${eventIndex + 1} 关系类型` } });
          const relationLabel = row.createEl("input", { attr: { type: "text", value: relation.label, maxlength: "24", placeholder: "具体关系", "aria-label": `事件 ${eventIndex + 1} 关系标签` } });
          available.forEach((argument, index) => {
            const text2 = `${EVENT_KIND_LABELS[argument.entity.kind]} · ${argument.entity.name}`;
            subject.createEl("option", { value: String(index), text: text2 });
            object.createEl("option", { value: String(index), text: text2 });
          });
          const subjectIndex = Math.max(0, available.findIndex((argument) => eventEntityKey(argument.entity) === eventEntityKey(relation.subject)));
          const objectIndex = Math.max(0, available.findIndex((argument) => eventEntityKey(argument.entity) === eventEntityKey(relation.object)));
          subject.value = String(subjectIndex);
          object.value = String(objectIndex);
          for (const value of EVENT_RELATION_TYPES) {
            relationKind.createEl("option", { value, text: EVENT_RELATION_LABELS[value] });
          }
          relationKind.value = relation.type;
          const sync = () => {
            relation.subject = available[Number(subject.value)]?.entity ?? relation.subject;
            relation.object = available[Number(object.value)]?.entity ?? relation.object;
            relation.type = EVENT_RELATION_TYPES.includes(relationKind.value) ? relationKind.value : "other";
            relation.label = relationLabel.value;
          };
          subject.addEventListener("change", sync);
          object.addEventListener("change", sync);
          relationKind.addEventListener("change", () => {
            relationLabel.value = EVENT_RELATION_LABELS[relationKind.value];
            sync();
          });
          relationLabel.addEventListener("input", sync);
          const removeRelation = row.createEl("button", { attr: { type: "button", "aria-label": `移除事件 ${eventIndex + 1} 的关系 ${relationIndex + 1}` } });
          (0, obsidian.setIcon)(removeRelation, "x");
          removeRelation.addEventListener("click", () => {
            event.relations.splice(relationIndex, 1);
            renderRelations();
          });
        });
        const addRelation = relationsHost.createEl("button", { cls: "mind-trace-event-add-element", text: "+ 添加明确关系", attr: { type: "button" } });
        addRelation.disabled = available.length < 2 || event.relations.length >= MAX_EVENT_RELATIONS;
        addRelation.addEventListener("click", () => {
          event.relations.push({ type: "other", label: "相关于", subject: available[0].entity, object: available[1].entity });
          renderRelations();
        });
      };
      renderTraces();
      renderArguments();
      renderRelations();
    });
    const add = this.container.createEl("button", {
      cls: "mind-trace-event-add",
      text: "+ 添加一件事",
      attr: { type: "button" }
    });
    add.disabled = this.events.length >= MAX_SESSION_EVENTS;
    add.addEventListener("click", () => this.addEvent());
  }
};
