// src/journal-view.ts
import { draftEntryDate, localDayOrdinal, parseLocalDate, periodWeekStart } from "./date-utils";
import { average, themeFrequency } from "./metrics";

export { EVENT_KINDS, EVENT_KIND_LABELS, EVENT_LABEL_KINDS, EVENT_RELATION_LABELS, EVENT_RELATION_LABEL_VALUES, EVENT_RELATION_TYPES, EVENT_ROLES, EVENT_ROLE_LABELS, EVENT_ROLE_LABEL_VALUES, EVENT_SCHEMA_VERSION, EVENT_STATUSES, EVENT_STATUS_LABELS, EVENT_STATUS_LABEL_VALUES, EVENT_TRACE_CERTAINTIES, EVENT_TRACE_CERTAINTY_LABELS, EVENT_TRACE_KINDS, EVENT_TRACE_KIND_LABELS, EVENT_TRACE_KIND_LABEL_VALUES, EVENT_TRACE_KIND_LAYERS, EVENT_TRACE_LAYER_LABELS, EVENT_TYPES, EVENT_TYPE_LABELS, EVENT_TYPE_LABEL_VALUES, JOURNAL_SCHEMA_VERSION, MAX_EVENT_ARGUMENTS, MAX_EVENT_RELATIONS, MAX_EVENT_TRACES, MAX_SESSION_EVENTS, OBSERVATION_DIMENSIONS, buildEventBackfillMessages, buildFollowUpMessages, buildJournalMessages, buildMonthlyReportMessages, buildObservationMessages, buildRatingMessages, buildRepairMessages, buildWeeklyReportMessages, computeObservationMaturity, constrainObservationAnalysisForMaturity, dedupeObservationReports, deriveObservationFreshness, eventEntityKey, metricSnapshot, normalizeEvent, normalizeEventElementName, normalizeEventEntity, normalizeEventRelation, normalizeObservationAnalysis, observationClaimMetrics, observationConstrainedLevel, observationDimension, observationEvidenceCatalog, observationFeedbackContext, observationItemKey, observationSignal, observationSnapshotMaturity, parseEventBackfill, parseFollowUp, parseGeneratedEntry, parseMonthlyReport, parseObservation, parseRatingAssessment, parseWeeklyReport, recordAnswer, validateEvents };

// src/conversation.ts
function recordAnswer(draft, question, answer, core) {
  draft.answers.push({
    question,
    answer,
    kind: core ? "core" : "adaptive"
  });
  if (core) {
    draft.step += 1;
  } else {
    draft.adaptiveCount += 1;
    draft.pendingQuestion = null;
  }
}

// src/prompts.ts
var TONE_INSTRUCTIONS = {
  gentle: "语气温和但具体：先承认感受，再指出可能的模式并给出可执行建议。",
  direct: "使用直接的教练式语气：清楚指出盲点、责任和下一步，但不要羞辱或武断。",
  companion: "使用陪伴式语气：以共情和开放问题为主，减少命令式建议。"
};
var SAFETY_INSTRUCTION = "不要进行心理或医学诊断，不要把推测表达成事实，不提供高风险医疗建议。如果内容显示用户可能处于严重危险中，停止一般成长建议，鼓励用户尽快联系可信任的人或专业支持。";
function answersText(draft) {
  return draft.answers.map(
    (answer, index) => `${index + 1}. 问：${answer.question}
答：${answer.answer}`
  ).join("\n\n");
}
function ratingsText(draft) {
  const { mood, energy, stress } = draft.ratings;
  return `心情 ${mood}/5，精力 ${energy}/5，压力 ${stress}/5`;
}
var EVENT_TYPE_LABELS = {
  interaction: "互动",
  decision: "决定",
  action: "行动",
  progress: "进展",
  obstacle: "受阻",
  change: "变化",
  experience: "经历",
  intention: "意向",
  open_loop: "未决",
  other: "其他"
};
var EVENT_TYPE_LABEL_VALUES = Object.fromEntries(
  Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => [label, type])
);
var EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);
var EVENT_SCHEMA_VERSION = 4;
var JOURNAL_SCHEMA_VERSION = 4;
var EVENT_STATUS_LABELS = {
  occurred: "已发生",
  ongoing: "进行中",
  planned: "计划中",
  blocked: "受阻",
  resolved: "已收尾",
  uncertain: "待确认"
};
var EVENT_STATUS_LABEL_VALUES = Object.fromEntries(
  Object.entries(EVENT_STATUS_LABELS).map(([status, label]) => [label, status])
);
var EVENT_STATUSES = Object.keys(EVENT_STATUS_LABELS);
var EVENT_TRACE_KIND_LABELS = {
  fact: "事实",
  emotion: "情绪",
  body: "身体感受",
  thought: "想法",
  judgment: "判断",
  intention: "意图",
  goal: "目标",
  outcome: "结果",
  open_loop: "未决事项"
};
var EVENT_TRACE_KIND_LABEL_VALUES = Object.fromEntries(
  Object.entries(EVENT_TRACE_KIND_LABELS).map(([kind, label]) => [label, kind])
);
var EVENT_TRACE_KINDS = Object.keys(EVENT_TRACE_KIND_LABELS);
var EVENT_TRACE_LAYER_LABELS = {
  fact: "明确事实",
  self_report: "主观自述",
  direction: "目标/未决"
};
var EVENT_TRACE_CERTAINTY_LABELS = {
  stated: "明确表达",
  uncertain: "带有不确定"
};
var EVENT_TRACE_CERTAINTIES = Object.keys(EVENT_TRACE_CERTAINTY_LABELS);
var EVENT_TRACE_KIND_LAYERS = {
  fact: "fact",
  emotion: "self_report",
  body: "self_report",
  thought: "self_report",
  judgment: "self_report",
  intention: "direction",
  goal: "direction",
  outcome: "fact",
  open_loop: "direction"
};
var EVENT_KIND_LABELS = {
  person: "人物",
  group: "群体",
  organization: "组织",
  project: "项目",
  product: "产品",
  place: "地点",
  activity: "活动",
  object: "物件/工具",
  topic: "主题/概念"
};
var EVENT_LABEL_KINDS = Object.fromEntries(
  Object.entries(EVENT_KIND_LABELS).map(([kind, label]) => [label, kind])
);
EVENT_LABEL_KINDS["主题"] = "topic";
var EVENT_KINDS = Object.keys(EVENT_KIND_LABELS);
var EVENT_ROLE_LABELS = {
  actor: "行动者",
  participant: "参与者",
  counterparty: "对方",
  recipient: "接收者",
  target: "目标",
  object: "对象",
  context: "背景",
  location: "地点",
  cause: "原因",
  outcome: "结果",
  related: "相关"
};
var EVENT_ROLE_LABEL_VALUES = Object.fromEntries(
  Object.entries(EVENT_ROLE_LABELS).map(([role, label]) => [label, role])
);
var EVENT_ROLES = Object.keys(EVENT_ROLE_LABELS);
var EVENT_RELATION_LABELS = {
  affiliation: "隶属/任职",
  social: "人际",
  ownership: "拥有",
  part_of: "组成",
  dependency: "依赖",
  collaboration: "协作",
  located_in: "位于",
  other: "其他"
};
var EVENT_RELATION_LABEL_VALUES = Object.fromEntries(
  Object.entries(EVENT_RELATION_LABELS).map(([type, label]) => [label, type])
);
var EVENT_RELATION_TYPES = Object.keys(EVENT_RELATION_LABELS);
var MAX_SESSION_EVENTS = 20;
var MAX_EVENT_ARGUMENTS = 16;
var MAX_EVENT_RELATIONS = 12;
var MAX_EVENT_TRACES = 12;
function normalizeEventElementName(value) {
  return String(value ?? "").normalize("NFKC").replace(/^[\s,，、;；:：.。]+|[\s,，、;；:：.。]+$/g, "").replace(/\s+/g, " ").toLocaleLowerCase();
}
function normalizeEventEntity(value, fallbackKind = "topic") {
  const kind = EVENT_KINDS.includes(value?.kind) ? value.kind : EVENT_KINDS.includes(value?.type) ? value.type : fallbackKind;
  const rawName = String(value?.name ?? "").trim();
  const name = kind === "person" && rawName === "用户" ? "我" : rawName;
  return { kind, name };
}
function normalizeEventArgument(argument) {
  const entity = normalizeEventEntity(argument?.entity ?? argument, typeof argument?.kind === "string" ? argument.kind : "topic");
  const role = EVENT_ROLES.includes(argument?.role) ? argument.role : "related";
  const label = String(argument?.label ?? EVENT_ROLE_LABELS[role]).trim().slice(0, 16) || EVENT_ROLE_LABELS[role];
  return { role, label, entity };
}
function eventEntityKey(entity) {
  return `${entity.kind}:${normalizeEventElementName(entity.name)}`;
}
function normalizeEventRelation(relation) {
  const type = EVENT_RELATION_TYPES.includes(relation?.type) ? relation.type : "other";
  const label = String(relation?.label ?? EVENT_RELATION_LABELS[type]).trim().slice(0, 24) || EVENT_RELATION_LABELS[type];
  return {
    type,
    label,
    subject: normalizeEventEntity(relation?.subject),
    object: normalizeEventEntity(relation?.object)
  };
}
function normalizeEventTrace(trace) {
  const kind = EVENT_TRACE_KINDS.includes(trace?.kind) ? trace.kind : "fact";
  const layer = EVENT_TRACE_KIND_LAYERS[kind];
  const certainty = EVENT_TRACE_CERTAINTIES.includes(trace?.certainty) ? trace.certainty : "stated";
  return {
    kind,
    layer,
    certainty,
    text: String(trace?.text ?? "").trim(),
    evidence: String(trace?.evidence ?? "").trim()
  };
}
function normalizeEvent(event) {
  const id = typeof event?.id === "string" ? event.id.trim() : "";
  const type = EVENT_TYPES.includes(event?.type) ? event.type : "other";
  const status = EVENT_STATUSES.includes(event?.status) ? event.status : "occurred";
  const title = String(event?.title ?? "").trim();
  const summary = String(event?.summary ?? "").trim();
  const arguments2 = [];
  const seen = /* @__PURE__ */ new Set();
  const rawArguments = Array.isArray(event?.arguments) ? event.arguments : (Array.isArray(event?.elements) ? event.elements.map((element) => ({ role: "related", label: "相关", entity: element })) : []);
  for (const raw of rawArguments) {
    const argument = normalizeEventArgument(raw);
    const key = `${argument.role}:${eventEntityKey(argument.entity)}`;
    if (normalizeEventElementName(argument.entity.name).length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    arguments2.push(argument);
  }
  const entityMap = new Map(arguments2.map((argument) => [eventEntityKey(argument.entity), argument.entity]));
  const relations = [];
  const seenRelations = /* @__PURE__ */ new Set();
  for (const raw of Array.isArray(event?.relations) ? event.relations : []) {
    const relation = normalizeEventRelation(raw);
    const subjectKey = eventEntityKey(relation.subject);
    const objectKey = eventEntityKey(relation.object);
    const key = `${relation.type}:${subjectKey}:${objectKey}:${relation.label.toLocaleLowerCase()}`;
    if (!entityMap.has(subjectKey) || !entityMap.has(objectKey) || subjectKey === objectKey || seenRelations.has(key)) {
      continue;
    }
    seenRelations.add(key);
    relations.push({ ...relation, subject: entityMap.get(subjectKey), object: entityMap.get(objectKey) });
  }
  const traces = [];
  const seenTraces = /* @__PURE__ */ new Set();
  for (const raw of Array.isArray(event?.traces) ? event.traces : []) {
    const trace = normalizeEventTrace(raw);
    const key = `${trace.kind}:${trace.certainty}:${normalizeEventElementName(trace.text)}:${normalizeEventElementName(trace.evidence)}`;
    if (normalizeEventElementName(trace.text).length === 0 || seenTraces.has(key)) {
      continue;
    }
    seenTraces.add(key);
    traces.push(trace);
  }
  const elements = [...new Map(arguments2.map((argument) => [eventEntityKey(argument.entity), argument.entity])).values()];
  return { id, type, status, title, summary, traces, arguments: arguments2, relations, elements };
}
function validateEvents(events, allowEmpty = true) {
  if (!Array.isArray(events) || events.length > MAX_SESSION_EVENTS || !allowEmpty && events.length === 0) {
    throw new Error(`今日事件需要保留 0–${MAX_SESSION_EVENTS} 条`);
  }
  return events.map((raw, index) => {
    const event = normalizeEvent(raw);
    const rawArgumentCount = Array.isArray(raw?.arguments) ? raw.arguments.length : Array.isArray(raw?.elements) ? raw.elements.length : 0;
    const rawRelationCount = Array.isArray(raw?.relations) ? raw.relations.length : 0;
    const rawTraceCount = Array.isArray(raw?.traces) ? raw.traces.length : 0;
    if (!EVENT_STATUSES.includes(raw?.status)) {
      throw new Error(`事件 ${index + 1} 缺少合法的进展状态`);
    }
    if (event.title.length === 0 || event.title.length > 60) {
      throw new Error(`事件 ${index + 1} 的标题需要为 1–60 个字符`);
    }
    if (event.summary.length === 0 || event.summary.length > 240) {
      throw new Error(`事件 ${index + 1} 的概要需要为 1–240 个字符`);
    }
    if (event.arguments.length === 0 || event.arguments.length > MAX_EVENT_ARGUMENTS) {
      throw new Error(`事件 ${index + 1} 需要保留 1–${MAX_EVENT_ARGUMENTS} 个论元`);
    }
    if (Array.isArray(raw?.arguments) && event.arguments.length !== rawArgumentCount) {
      throw new Error(`事件 ${index + 1} 存在空白、重复或无效论元`);
    }
    if (event.arguments.some((argument) => argument.entity.name.length > 32)) {
      throw new Error(`事件 ${index + 1} 的实体名称不能超过 32 个字符`);
    }
    if (event.relations.length > MAX_EVENT_RELATIONS) {
      throw new Error(`事件 ${index + 1} 最多保留 ${MAX_EVENT_RELATIONS} 条显式关系`);
    }
    if (event.relations.length !== rawRelationCount) {
      throw new Error(`事件 ${index + 1} 的关系端点必须是该事件中两个不同的论元`);
    }
    if (event.traces.length > MAX_EVENT_TRACES) {
      throw new Error(`事件 ${index + 1} 最多保留 ${MAX_EVENT_TRACES} 条体验与方向线索`);
    }
    if (Array.isArray(raw?.traces) && event.traces.length !== rawTraceCount) {
      throw new Error(`事件 ${index + 1} 存在空白或重复的体验与方向线索`);
    }
    if (Array.isArray(raw?.traces) && raw.traces.some((trace) => !EVENT_TRACE_KINDS.includes(trace?.kind) || trace?.layer !== EVENT_TRACE_KIND_LAYERS[trace?.kind] || !EVENT_TRACE_CERTAINTIES.includes(trace?.certainty))) {
      throw new Error(`事件 ${index + 1} 的线索类型、信息层或确定性不匹配`);
    }
    if (event.traces.some((trace) => trace.text.length > 160 || trace.evidence.length > 160)) {
      throw new Error(`事件 ${index + 1} 的线索正文与依据不能超过 160 个字符`);
    }
    return event;
  });
}
function buildFollowUpMessages(draft, history = "") {
  const historySection = history.length > 0 ? `

近期日记摘录（只作为连续性线索，不代表今天仍然如此）：
${history}` : "";
  return [
    {
      role: "system",
      content: [
        "你是一个帮助用户完成短日记的提问者。",
        "用户的日记可以同时包含多个人物、工作进展、生活小事、情绪变化和未解决的问题，不要强行把一天收窄成一件事。",
        "先检查已有回答是否缺少能让日记更完整的具体信息，例如人物关系、场景细节、情绪来源、生活质感或悬而未决的线索。",
        "本次回答始终优先。近期日记只用于识别与今天明确相关的延续、变化或未收尾线索；无关时不要引用，也不要为了表现记忆而强行提起旧事。",
        "如果追问承接了近期日记，要用具体日期或“昨天”“前几天”等自然提示说明来源，并保持试探性，不要假设旧状态今天仍然成立。",
        "需要补充时，只选择信息价值最高的一处，提出一个简短、具体、一次只问一件事且不重复已有问题的中文追问。",
        "如果信息已经足够生成有意义的日记，将 continue 设为 false；否则设为 true。",
        SAFETY_INSTRUCTION,
        '只输出 JSON：{"question":"...","continue":true}'
      ].join("\n")
    },
    {
      role: "user",
      content: `记录归属日期：${draftEntryDate(draft)}

今日自评：${ratingsText(draft)}

已有问答：
${answersText(draft)}${historySection}`
    }
  ];
}
function buildJournalMessages(draft, history, tone, customInstructions) {
  const historySection = history.length > 0 ? `

近期日记摘录（只用于发现温和、非绝对化的模式）：
${history}` : "";
  const customSection = customInstructions.trim().length > 0 ? `
用户的个人偏好：${customInstructions.trim()}` : "";
  return [
    {
      role: "system",
      content: [
        "你是一位中文日记整理与个人成长反思助手。",
        "忠实保留用户事实和情绪，不虚构细节，不把日记写成鸡汤。",
        "日记正文要容纳当天出现的多个片段，不要强行归纳成单一事件、单一情绪或单一成长主题。",
        "优先保留用户原本的口吻、人物称呼、具体物件、技术名词、感官细节和带情绪的短句；不要把鲜活细节全部改写成抽象总结。",
        "片段有自然时间顺序时按时间推进，否则用轻微过渡连接；不同片段之间允许保留情绪反差。",
        "正文通常写成 250–600 个中文字符；信息较少时忠实简写，不为凑长度添加内容。",
        "从当天实际内容中动态提取 2–6 个互不重复的智能切片，每个切片包含一个简短类别和一句事实性总结；例如工作、人际、生活、情绪、学习或未解决，但不要输出没有内容的类别。",
        "同时尽量完整提取当天明确发生的互动、决定、行动、进展、受阻、变化和具体经历，以及用户明确表达的意向与未决事项为 events。近期日记中的旧事不能写成今天的事件；没有当天内容时返回空数组。",
        "抽取粒度以可独立核对的生活片段为准。时间、参与者、动作、决定、障碍、结果或未决事项任一明显不同，通常应拆成不同事件；只有拆开会失去原意时才合并。不得把一天里的多件具体事情压缩成一个宽泛主题或笼统总结。",
        "title 要指出具体动作或变化；summary 尽量保留谁在什么情境下对什么对象做了什么，以及明确结果或当前进展。保留正文中的人物称呼、项目、产品、地点、工具和具体对象，不用“处理了一些事情”“有所进展”等抽象措辞替代已有细节。",
        "只有情绪、身体感受或想法而没有外部事件时，只在用户今天明确表达且对保留当下体验有意义时建立 experience 事件，并把“我”作为论元；不得为它补造原因。抽象洞察、人格判断和模型推测不能进入 events。",
        "每个事件包含 type、status、简短 title、事实性 summary、0–12 个 traces、1–16 个 arguments，以及 0–12 个 relations。type 只能是 interaction、decision、action、progress、obstacle、change、experience、intention、open_loop、other。",
        "status 只能是 occurred、ongoing、planned、blocked、resolved、uncertain，且只能依据用户明确描述的进展；不得自行判断事情已完成。旧事的后续只有在今天被明确提及时才能作为今天的进展或未决线索。",
        "trace 只保存用户今天明确表达、与该事件直接相关且值得回看的内容，包含 kind、layer、certainty、text、evidence。kind 只能是 fact、emotion、body、thought、judgment、intention、goal、outcome、open_loop；普通事件事实无需在 trace 中重复。",
        "trace.layer 必须按内容固定：fact/outcome 为 fact，emotion/body/thought/judgment 为 self_report，intention/goal/open_loop 为 direction。certainty 只能是 stated 或 uncertain；用户使用“可能、好像、还不确定”等措辞时用 uncertain。evidence 使用本次问答中的短原话，不得引用近期记录或生成后的日记措辞。",
        "trace.text 必须保留体验或方向的主体；第一人称内容写清“我”。他人的情绪、想法和意图只有在用户明确转述其原话或可观察表达时才能记录，不得声称知道他人的内心。",
        "argument 包含 role、label 和 entity；role 只能是 actor、participant、counterparty、recipient、target、object、context、location、cause、outcome、related；entity.kind 只能是 person、group、organization、project、product、place、activity、object、topic。",
        "日记叙述者本人必须使用 person 实体“我”，不得命名为“用户”。若内容讨论产品或服务的用户，应提取为带有具体名称的 group 实体，例如“插件用户”。",
        "只要正文明确支持，就完整保留人物、群体、组织、项目、产品、地点、活动、工具、对象、原因和结果。不要因为某个事件只有一个论元而删除它，也不要为了产生连线虚构论元。",
        "根据本次问答和近期记录中的类型、称呼、角色、所属组织/项目、共同参与者、明确关系及相邻事件完成实体消歧。简称、全称、代称或不同写法只有在这些上下文一致且能唯一对应时，才统一为近期记录中更具体、稳定的名称；不能只凭字面相似合并。",
        "同名实体若类型不同必须分开；类型相同但角色、组织/项目、关系或参与事件明显冲突时也不得合并，使用正文能够支持的最短限定名称区分，例如“小王（设计同事）”与“小王（客户）”。限定信息不得凭空补造，实体名称最多 32 个字符。",
        "“他、她、对方、那个项目、公司”等代称只有在当前上下文能唯一指向某个实体时才改成其稳定名称；指向不唯一时保持保守，不猜测身份，也不把多个候选实体连在一起。近期记录只用于消歧和命名，不能把其中的旧事实写成今天的事件。",
        "relation 只保存正文明确陈述的实体间事实，包含 type、label、subject、object；type 只能是 affiliation、social、ownership、part_of、dependency、collaboration、located_in、other，且 subject 与 object 必须也出现在该事件 arguments 中。普通共同出现不写成 relation。",
        "近期记录出现过同一实体时尽量复用原名称。最多返回 20 个互不重复的事件。",
        "切片总结回答该维度今天具体发生了什么，不写建议，不重复空泛评价。",
        "日记正文使用自然的第一人称；洞察根据当天信息量动态给出 2–4 条，不为凑数重复同一观察；微行动必须小而具体；主题为 1–5 个简短中文名词。",
        "反思洞察与正文分开：不要把模型推测混入日记事实。微行动优先回应用户尚未收尾的事项或疑问，避免泛泛建议。",
        "近期日记只作为背景，不能把旧事实写成今天发生的事。若它与今天有明确联系，可在洞察或微行动中温和指出延续、变化或未收尾线索；无关时不要为了表现记忆而强行引用。",
        TONE_INSTRUCTIONS[tone],
        customSection,
        SAFETY_INSTRUCTION,
        '只输出 JSON：{"diary":"...","events":[{"type":"interaction","status":"occurred","title":"...","summary":"...","traces":[{"kind":"emotion","layer":"self_report","certainty":"stated","text":"...","evidence":"用户短原话"}],"arguments":[{"role":"actor","label":"行动者","entity":{"kind":"person","name":"..."}}],"relations":[{"type":"affiliation","label":"任职于","subject":{"kind":"person","name":"..."},"object":{"kind":"organization","name":"..."}}]}],"facets":[{"category":"工作","summary":"..."},{"category":"生活","summary":"..."}],"insights":["..."],"microAction":"...","selfQuestion":"...","themes":["..."]}'
      ].join("\n")
    },
    {
      role: "user",
      content: `记录归属日期：${draftEntryDate(draft)}

今日自评：${ratingsText(draft)}

本次问答：
${answersText(draft)}${historySection}`
    }
  ];
}
function buildRatingMessages(draft) {
  return [
    {
      role: "system",
      content: [
        "你是一位谨慎的中文日记状态观察者。",
        "只根据用户在本次问答中使用的语言和描述，独立估计心情、精力和压力；你看不到用户的自评分数，也不要假设哪一方更正确。",
        "评分均为 1–5 的整数：心情 1 表示明显低落、3 表示平稳、5 表示明亮；精力 1 表示耗尽、3 表示尚可、5 表示充沛；压力 1 表示松弛、3 表示适中、5 表示紧绷。",
        "每项用一句简短中文说明文本依据。证据不足时选择 3，并明确说明信息有限，不要虚构。",
        "这只是对文字呈现出的状态进行观察，不进行心理或医学诊断，不判断用户是否填错。",
        '只输出 JSON：{"mood":{"score":3,"reason":"..."},"energy":{"score":3,"reason":"..."},"stress":{"score":3,"reason":"..."}}'
      ].join("\n")
    },
    {
      role: "user",
      content: `本次完整问答：
${answersText(draft)}`
    }
  ];
}
function metricSnapshot(entries) {
  const days = new Set(entries.map((entry) => entry.date)).size;
  const sessions = entries.reduce((sum, entry) => sum + entry.sessions, 0);
  const mean = (key) => entries.length > 0 ? average(entries.map((entry) => entry[key])) : null;
  return {
    days,
    sessions,
    mood: mean("mood"),
    energy: mean("energy"),
    stress: mean("stress"),
    themes: themeFrequency(entries).slice(0, 6)
  };
}
function weeklyStatsText(current, previous) {
  const score = (value) => value === null ? "无数据" : value.toFixed(1);
  const delta = (key) => current[key] === null || previous[key] === null ? "无法对比" : `${current[key] - previous[key] >= 0 ? "+" : ""}${(current[key] - previous[key]).toFixed(1)}`;
  return [
    `记录 ${current.days} 天、${current.sessions} 篇`,
    `心情 ${score(current.mood)}（较前一周 ${delta("mood")}）`,
    `精力 ${score(current.energy)}（较前一周 ${delta("energy")}）`,
    `压力 ${score(current.stress)}（较前一周 ${delta("stress")}）`,
    `常见主题：${current.themes.length > 0 ? current.themes.map((item) => `${item.theme}（${item.days}天）`).join("、") : "无"}`
  ].join("\n");
}
function reportEventCatalog(source) {
  return (source.events?.records ?? []).map((record, index) => ({ ...record, ref: `E${String(index + 1).padStart(3, "0")}` }));
}
function reportEventCatalogText(source) {
  const catalog = reportEventCatalog(source);
  return catalog.length > 0 ? catalog.map((event) => `${event.ref}｜${event.date} ${event.time}｜${EVENT_TYPE_LABELS[event.type]}｜${EVENT_STATUS_LABELS[event.status]}｜${event.title}：${event.summary}`).join("\n") : "无结构化事件";
}
function buildWeeklyReportMessages(source, settings) {
  const custom = settings.customInstructions.trim().length > 0 ? `\n用户表达偏好：${settings.customInstructions.trim()}` : "";
  return [
    {
      role: "system",
      content: [
        "你是一位谨慎、具体的中文个人周报分析助手。",
        "只使用给定的日记和本地统计；不虚构数字、日期、原因或完成情况。",
        "这是一份记录型周报：整理本周明确发生的事情、进展、未决事项和用户明确表达的后续意向，不解释内在原因，不生成情绪假设或建议。",
        "highlights、progress、openLoops、themes、carryForward 的 evidenceDates 只能使用本周日期，eventRefs 只能使用输入事件目录中的 E 编号。",
        "carryForward 只能来自用户明确表达的计划、意向或未决事项；不能替用户制定行动。",
        TONE_INSTRUCTIONS[settings.reflectionTone],
        custom,
        SAFETY_INSTRUCTION,
        '只输出 JSON：{"summary":"...","highlights":[{"text":"...","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"progress":[{"subject":"...","status":"started|advanced|blocked|completed|unchanged","text":"...","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"openLoops":[{"text":"...","status":"ongoing|planned|blocked|uncertain","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"themes":[{"name":"...","observation":"...","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"carryForward":[{"text":"...","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}]}'
      ].join("\n")
    },
    {
      role: "user",
      content: `报告周期：${source.period.start} 至 ${source.period.end}\n\n本地确定性统计：\n${weeklyStatsText(source.stats, source.previousStats)}\n\n事件目录：\n${reportEventCatalogText(source)}\n\n日记事实摘录：\n${source.excerpts}${source.truncated ? "\n\n注：输入过长，已截取部分较早内容。" : ""}`
    }
  ];
}
function monthlyStatsText(current, comparison, periodStatus = "complete") {
  const comparisonLabel = periodStatus === "partial" ? "上月同期" : "上月";
  const score = (value) => value === null ? "无数据" : value.toFixed(1);
  const delta = (key) => current[key] === null || comparison[key] === null ? "无法对比" : `${current[key] - comparison[key] >= 0 ? "+" : ""}${(current[key] - comparison[key]).toFixed(1)}`;
  return [
    `记录 ${current.days} 天、${current.sessions} 篇，已生成完整周报 ${current.activeWeeks} 份`,
    `心情 ${score(current.mood)}（较${comparisonLabel} ${delta("mood")}）`,
    `精力 ${score(current.energy)}（较${comparisonLabel} ${delta("energy")}）`,
    `压力 ${score(current.stress)}（较${comparisonLabel} ${delta("stress")}）`,
    `常见主题：${current.themes.length > 0 ? current.themes.map((item) => `${item.theme}（${item.days}天）`).join("、") : "无"}`
  ].join("\n");
}
function buildMonthlyReportMessages(source, settings) {
  const custom = settings.customInstructions.trim().length > 0 ? `\n用户表达偏好：${settings.customInstructions.trim()}` : "";
  const rhythm = source.weekStats.map((week) => `${week.start} 至 ${week.end}：${week.days} 天、${week.sessions} 篇；心情 ${week.mood === null ? "无" : week.mood.toFixed(1)}，精力 ${week.energy === null ? "无" : week.energy.toFixed(1)}，压力 ${week.stress === null ? "无" : week.stress.toFixed(1)}`).join("\n");
  return [
    {
      role: "system",
      content: [
        "你是一位谨慎、具体的中文个人月报分析助手。",
        "只使用给定的日记和本地统计；不虚构数字、日期、原因或完成情况。",
        "这是一份跨周结构记录：呈现自然周之间的节奏、转折、主题演变、推进与停滞，不解释内在原因，不生成情绪假设或建议。",
        "rhythm 可以只引用日期；turningPoints、themeEvolution、threads、carryForward 必须同时引用本月日期和事件目录中的 E 编号。",
        "turningPoints 和演变类内容必须跨至少两个日期或自然周；单周现象不能写成月度演变。",
        TONE_INSTRUCTIONS[settings.reflectionTone],
        custom,
        SAFETY_INSTRUCTION,
        '只输出 JSON：{"summary":"...","rhythm":[{"observation":"...","evidenceDates":["YYYY-MM-DD"]}],"turningPoints":[{"text":"...","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"themeEvolution":[{"name":"...","trajectory":"appeared|strengthened|weakened|continued|shifted|ended","observation":"...","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"threads":[{"type":"goal|relationship|project|habit|other","name":"...","trajectory":"advanced|stalled|repeated|resolved|uncertain","observation":"...","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"carryForward":[{"text":"...","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}]}'
      ].join("\n")
    },
    {
      role: "user",
      content: `报告周期：${source.period.start} 至 ${source.period.end}（${source.period.status === "partial" ? "截至今天的部分预览" : "完整自然月"}）\n\n本地确定性统计：\n${monthlyStatsText(source.stats, source.previousStats, source.period.status)}\n\n月度节律轴：\n${rhythm || "暂无可用周记录"}\n\n事件目录：\n${reportEventCatalogText(source)}\n\n日记事实摘录：\n${source.excerpts}${source.truncated ? "\n\n注：输入过长，已截取部分较早内容。" : ""}`
    }
  ];
}
function buildEventBackfillMessages(sessions, knownElements = [], maximum = 50, preservedSessions = []) {
  return [
    {
      role: "system",
      content: [
        "你是中文日记事件整理助手。把所有给定会话当作同一个自然周联合整理，只从每个会话当天的正文与切片中提取明确发生的互动、决定、行动、进展、受阻、变化、经历、意向和未决事项。",
        "纯抽象洞察、建议、系统推测或其他日期的旧事不能作为当天事件；没有当天内容时返回空数组，不要为了填满而虚构。只有当天明确表达的情绪、身体感受或想法时，可以建立 experience 事件，但不得补造原因。",
        "校准是逐条整理，不是周摘要。时间、参与者、动作、决定、障碍、结果或未决事项任一明显不同，通常应拆成可独立核对的不同事件；不同会话中的事件不得因为主题相似而合并。只有同一会话对同一动作或结果的重复表述才去重。",
        "title 要指出具体动作或变化；summary 尽量保留谁在什么情境下对什么对象做了什么，以及明确结果或当前进展。保留人物称呼、项目、产品、地点、工具和具体对象，不用宽泛主题替代正文已有细节。",
        "事件包含 type、status、title、summary、traces、arguments、relations。type 可为 interaction、decision、action、progress、obstacle、change、experience、intention、open_loop、other；status 可为 occurred、ongoing、planned、blocked、resolved、uncertain，且不得自行推断完成状态。",
        "traces 最多 12 条，只保存正文明确支持的体验与方向线索。kind 可为 fact、emotion、body、thought、judgment、intention、goal、outcome、open_loop；layer 按 kind 固定为 fact、self_report 或 direction；certainty 为 stated 或 uncertain；evidence 必须是该会话正文中的短原话。",
        "trace.text 必须保留主体。第一人称内容写清“我”；他人的内在体验只有在正文明确转述其原话或可观察表达时才能记录，不得替他人推断内心。",
        "论元包含 role、label、entity；实体 kind 只能是 person、group、organization、project、product、place、activity、object、topic。",
        "日记叙述者本人必须统一为 person 实体“我”，不得命名为“用户”。产品或服务的用户应使用带具体名称的 group 实体，例如“插件用户”。",
        "relation 只能保存正文明确支持的实体事实，subject 和 object 必须同时是该事件的论元；普通共同出现不是 relation。每个会话最多 20 个事件。",
        `所有返回会话合计最多 ${maximum} 个事件；额度内逐条保留每个会话的明确事件，不因事情日常、影响较小或主题相似而删除。只有确实超过额度时，才优先保留事实明确、论元充分、包含进展或未决事项的事件。`,
        "必须根据实体类型、称呼、角色、所属组织/项目、共同参与者、明确关系、日期与相邻事件联合完成实体消歧。简称、全称、代称或不同写法只有在上下文一致且能唯一对应时，才统一为历史候选中更具体、稳定的名称；不能只凭字符串相似或共同出现合并。",
        "同名实体若类型不同必须分开；类型相同但角色、组织/项目、关系或参与事件明显冲突时也不得合并，使用正文或给定上下文能够支持的最短限定名称区分，例如“小王（设计同事）”与“小王（客户）”。限定信息不得凭空补造，实体名称最多 32 个字符。",
        "“他、她、对方、那个项目、公司”等代称只有在当前会话与相邻内容能唯一指向某个候选时才改成稳定名称；有多个合理候选时不得猜测。历史实体候选只用于消歧与命名，不能把候选上下文中的事实补进待整理事件。",
        "完成消歧后再跨会话去除真正重复的事件；不同实体参与的相似事件不是重复事件。",
        '只输出 JSON：{"sessions":[{"id":"输入中的会话 ID","date":"YYYY-MM-DD","time":"HH:mm","events":[{"type":"interaction","status":"occurred","title":"...","summary":"...","traces":[{"kind":"emotion","layer":"self_report","certainty":"stated","text":"...","evidence":"正文短原话"}],"arguments":[{"role":"actor","label":"行动者","entity":{"kind":"person","name":"..."}}],"relations":[]}]}]}'
      ].join("\n")
    },
    {
      role: "user",
      content: `历史实体候选（括号内是消歧上下文，不是待抽取事实）：\n${knownElements.length > 0 ? knownElements.map(eventEntityDisambiguationText).join("\n") : "无"}\n\n必须保留且仅作为命名与连续性上下文的事件：\n${preservedSessions.length > 0 ? preservedSessions.map((session) => `【${session.date} ${session.time}】${JSON.stringify(session.events.map((event) => ({ type: event.type, status: event.status, title: event.title, summary: event.summary, traces: event.traces, arguments: event.arguments, relations: event.relations }))).slice(0, 6e3)}`).join("\n") : "无"}\n\n待整理会话：\n${sessions.map((session) => eventBackfillSessionText(session)).join("\n\n")}`
    }
  ];
}
function eventBackfillSessionText(session) {
  const facets = session.facets.map((facet) => `${facet.category}：${facet.summary}`).join("；").slice(0, 2500) || "无";
  const diary = session.diary.slice(0, 6e3);
  const candidates = Array.isArray(session.events) && session.events.length > 0 ? JSON.stringify(session.events.map((event) => ({ type: event.type, status: event.status, title: event.title, summary: event.summary, traces: event.traces, arguments: event.arguments, relations: event.relations }))).slice(0, 4e3) : "无";
  return `【ID ${session.date}#${session.sessionIndex}｜${session.date} ${session.time}】\n日记：${diary}\n切片：${facets}\n日级候选：${candidates}`;
}
function eventEntityDisambiguationText(entity) {
  const details = [];
  if (Array.isArray(entity.roles) && entity.roles.length > 0) {
    details.push(`角色：${entity.roles.join("、")}`);
  }
  if (Array.isArray(entity.related) && entity.related.length > 0) {
    details.push(`相关实体：${entity.related.map((item) => `${EVENT_KIND_LABELS[item.kind]}“${item.name}”`).join("、")}`);
  }
  if (Array.isArray(entity.relations) && entity.relations.length > 0) {
    details.push(`明确关系：${entity.relations.join("、")}`);
  }
  if (Array.isArray(entity.contexts) && entity.contexts.length > 0) {
    details.push(`近期事件：${entity.contexts.join("；")}`);
  }
  return `- ${EVENT_KIND_LABELS[entity.kind]}“${entity.name}”${details.length > 0 ? `（${details.join("；")}）` : ""}`.slice(0, 320);
}
function buildRepairMessages(raw, shape) {
  const eventSchema = '{"type":"interaction|decision|action|progress|obstacle|change|experience|intention|open_loop|other","status":"occurred|ongoing|planned|blocked|resolved|uncertain","title":"string","summary":"string","traces":[{"kind":"fact|emotion|body|thought|judgment|intention|goal|outcome|open_loop","layer":"fact|self_report|direction","certainty":"stated|uncertain","text":"string","evidence":"string"}],"arguments":[{"role":"actor|participant|counterparty|recipient|target|object|context|location|cause|outcome|related","label":"string","entity":{"kind":"person|group|organization|project|product|place|activity|object|topic","name":"string"}}],"relations":[{"type":"affiliation|social|ownership|part_of|dependency|collaboration|located_in|other","label":"string","subject":{"kind":"...","name":"string"},"object":{"kind":"...","name":"string"}}]}';
  const schema = shape === "follow-up" ? '{"question":"string","continue":boolean}' : shape === "journal" ? `{"diary":"string","events":[${eventSchema}],"facets":[{"category":"string","summary":"string"}],"insights":["string"],"microAction":"string","selfQuestion":"string","themes":["string"]}` : shape === "event-backfill" ? `{"sessions":[{"id":"string","date":"YYYY-MM-DD","time":"HH:mm","events":[${eventSchema}]}]}` : shape === "weekly-report" ? '{"summary":"string","highlights":[{"text":"string","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"progress":[{"subject":"string","status":"started|advanced|blocked|completed|unchanged","text":"string","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"openLoops":[{"text":"string","status":"ongoing|planned|blocked|uncertain","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"themes":[{"name":"string","observation":"string","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"carryForward":[{"text":"string","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}]}' : shape === "monthly-report" ? '{"summary":"string","rhythm":[{"observation":"string","evidenceDates":["YYYY-MM-DD"]}],"turningPoints":[{"text":"string","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"themeEvolution":[{"name":"string","trajectory":"appeared|strengthened|weakened|continued|shifted|ended","observation":"string","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"threads":[{"type":"goal|relationship|project|habit|other","name":"string","trajectory":"advanced|stalled|repeated|resolved|uncertain","observation":"string","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}],"carryForward":[{"text":"string","evidenceDates":["YYYY-MM-DD"],"eventRefs":["E001"]}]}' : shape === "observation" ? '{"summary":"string","claims":[{"dimension":"想法|行为|认知|情绪|关系|目标","layer":"fact|inference|hypothesis","statement":"string","before":"string","now":"string","supportEvidenceRefs":["EV001"],"counterEvidenceRefs":["EV009"],"alternative":"string","missingInformation":"string","verificationQuestion":"string"}],"nextObservation":"string"}' : '{"mood":{"score":3,"reason":"string"},"energy":{"score":3,"reason":"string"},"stress":{"score":3,"reason":"string"}}';
  const constraints = shape === "journal" ? "events 需为 0–20 个，事件各含合法 status、0–12 个 traces、1–16 个合法 arguments 和 0–12 个 relations；trace.layer 必须与 kind 对应；facets 需有 2–6 个且 category 互不重复，insights 需根据信息量动态给出 2–4 条，themes 需有 1–5 个。只修复结构，保留原结果中的事件事实和实体命名，不在缺少上下文时重新猜测或合并实体。" : shape === "event-backfill" ? "保留 sessions 的 date 和 time，每个 events 为 0–20 个；每个事件含合法 status 与 0–12 个 traces，所有关系端点必须属于同一事件的论元。只修复结构，保留原结果中的事件事实和实体命名，不在缺少上下文时重新猜测或合并实体。" : shape === "weekly-report" ? "保留 summary，并确保 highlights、progress、openLoops、themes、carryForward 都是带 evidenceDates 与 eventRefs 的数组；不要添加原因、情绪假设、自我问题或建议。" : shape === "monthly-report" ? "rhythm 需有 evidenceDates；turningPoints、themeEvolution、threads、carryForward 需有 evidenceDates 与 eventRefs；不要添加原因、情绪假设、自我问题或建议。" : shape === "observation" ? "claims 最多 8 条，每条必须包含至少一个 supportEvidenceRefs；只允许六个 dimension 和 fact、inference、hypothesis 三个 layer；inference 与 hypothesis 的 alternative、missingInformation、verificationQuestion 不得为空；不得输出人格、疾病、受保护属性、身份定义或置信百分比。" : shape === "rating" ? "三个 score 均需为 1–5 的整数，每项 reason 均不能为空。" : "";
  return [
    {
      role: "system",
      content: `把用户提供的内容整理为严格有效的 JSON。不要增加解释或 Markdown。目标结构：${schema}${constraints}`
    },
    {
      role: "user",
      content: raw
    }
  ];
}
function reportObjectArray(value, key, fields) {
  const raw = value[key];
  if (!Array.isArray(raw)) {
    throw new Error(`模型结果中的 ${key} 格式不正确`);
  }
  return raw.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`模型结果中的 ${key} 格式不正确`);
    }
    const parsed: Record<string, any> = {};
    for (const field of fields) {
      parsed[field] = stringField(item, field);
    }
    if ("evidenceDates" in item) {
      parsed.evidenceDates = stringArrayField(item, "evidenceDates");
    }
    if ("eventRefs" in item) {
      parsed.eventRefs = stringArrayField(item, "eventRefs");
    }
    return parsed;
  });
}
function parseReportV4Items(value, key, fields, period, validRefs, options: any = {}) {
  const items = reportObjectArray(value, key, fields);
  const result = [];
  for (const item of items) {
    if (!Array.isArray(item.evidenceDates)) throw new Error(`${key} 的 evidenceDates 格式不正确`);
    const originalDates = item.evidenceDates;
    const originalRefs = Array.isArray(item.eventRefs) ? item.eventRefs : [];
    item.evidenceDates = [...new Set(originalDates.filter((date) => parseLocalDate(date) !== null && date >= period.start && date <= period.end))];
    item.eventRefs = [...new Set(originalRefs.filter((ref) => typeof ref === "string" && validRefs.has(ref)))];
    if (options.strict === true && (item.evidenceDates.length !== new Set(originalDates).size || options.allowDateOnly !== true && item.eventRefs.length !== new Set(originalRefs).size)) {
      throw new Error(`${key} 含有周期外日期或未知事件 ID`);
    }
    if (item.evidenceDates.length === 0 || options.allowDateOnly !== true && item.eventRefs.length === 0) continue;
    result.push(item);
  }
  return result;
}
function parseWeeklyReport(raw, period, source, strict = false) {
  const value = objectValue(raw);
  const catalog = reportEventCatalog(source);
  const validRefs = new Set(catalog.map((event) => event.ref));
  const byRef = new Map<string, any>(catalog.map((event) => [event.ref, event]));
  const options = { strict };
  const highlights = parseReportV4Items(value, "highlights", ["text"], period, validRefs, options);
  const progress = parseReportV4Items(value, "progress", ["subject", "status", "text"], period, validRefs, options).filter((item) => ["started", "advanced", "blocked", "completed", "unchanged"].includes(item.status));
  const openLoops = parseReportV4Items(value, "openLoops", ["text", "status"], period, validRefs, options).filter((item) => ["ongoing", "planned", "blocked", "uncertain"].includes(item.status));
  const themes = parseReportV4Items(value, "themes", ["name", "observation"], period, validRefs, options);
  const carryForward = parseReportV4Items(value, "carryForward", ["text"], period, validRefs, options).filter((item) => item.eventRefs.some((ref) => {
    const event = byRef.get(ref);
    return event !== void 0 && (["ongoing", "planned", "blocked", "uncertain"].includes(event.status) || ["intention", "open_loop"].includes(event.type) || event.traces?.some((trace) => ["intention", "goal", "open_loop"].includes(trace.kind)));
  }));
  if ([highlights, progress, openLoops, themes, carryForward].every((items) => items.length === 0)) throw new Error("模型结果没有可验证的周报条目");
  return {
    summary: stringField(value, "summary"),
    highlights,
    progress,
    openLoops,
    themes,
    carryForward
  };
}
function parseMonthlyReport(raw, period, source, strict = false) {
  const value = objectValue(raw);
  const catalog = reportEventCatalog(source);
  const validRefs = new Set(catalog.map((event) => event.ref));
  const byRef = new Map<string, any>(catalog.map((event) => [event.ref, event]));
  const rhythmValue = typeof value.rhythm === "object" && value.rhythm !== null && !Array.isArray(value.rhythm) ? { ...value, rhythm: [value.rhythm] } : value;
  const options = { strict };
  const rhythm = parseReportV4Items(rhythmValue, "rhythm", ["observation"], period, validRefs, { allowDateOnly: true, strict });
  const turningPoints = parseReportV4Items(value, "turningPoints", ["text"], period, validRefs, options).filter((item) => new Set(item.evidenceDates.map((date) => periodWeekStart(date) ?? date)).size >= 2);
  const themeEvolution = parseReportV4Items(value, "themeEvolution", ["name", "trajectory", "observation"], period, validRefs, options).filter((item) => ["appeared", "strengthened", "weakened", "continued", "shifted", "ended"].includes(item.trajectory) && new Set(item.evidenceDates.map((date) => periodWeekStart(date) ?? date)).size >= 2);
  const threads = parseReportV4Items(value, "threads", ["type", "name", "trajectory", "observation"], period, validRefs, options).filter((item) => ["goal", "relationship", "project", "habit", "other"].includes(item.type) && ["advanced", "stalled", "repeated", "resolved", "uncertain"].includes(item.trajectory) && new Set(item.evidenceDates.map((date) => periodWeekStart(date) ?? date)).size >= 2);
  const carryForward = parseReportV4Items(value, "carryForward", ["text"], period, validRefs, options).filter((item) => item.eventRefs.some((ref) => {
    const event = byRef.get(ref);
    return event !== void 0 && (["ongoing", "planned", "blocked", "uncertain"].includes(event.status) || ["intention", "open_loop"].includes(event.type));
  }));
  if ([rhythm, turningPoints, themeEvolution, threads, carryForward].every((items) => items.length === 0)) throw new Error("模型结果没有可验证的月报条目");
  return {
    summary: stringField(value, "summary"),
    rhythm,
    turningPoints,
    themeEvolution,
    threads,
    carryForward
  };
}
var OBSERVATION_DIMENSIONS = ["想法", "行为", "认知", "情绪", "关系", "目标"];
var OBSERVATION_PERSPECTIVES = ["事实", "情绪", "行为", "关系", "目标", "旁观者"];
var OBSERVATION_LAYERS = ["事实", "归纳", "假设"];
function observationDateValue(value) {
  return typeof value === "string" && parseLocalDate(value) !== null ? value : "";
}
function observationEvidenceDates(value, allowedDates = new Set()) {
  const dates = Array.isArray(value) ? value.map(observationDateValue).filter((date) => date.length > 0) : [];
  const filtered = dates.filter((date) => allowedDates.size === 0 || allowedDates.has(date));
  const unique = [...new Set(filtered)].sort();
  return unique.slice(-12);
}
function observationSignal(evidenceDates) {
  const dates = [...new Set((evidenceDates ?? []).map(observationDateValue).filter((date) => date.length > 0))].sort();
  if (dates.length >= 4) {
    const first = parseLocalDate(dates[0]);
    const last = parseLocalDate(dates[dates.length - 1]);
    if (first !== null && last !== null && localDayOrdinal(last) - localDayOrdinal(first) >= 28) {
      return { level: "stable", label: "持续出现" };
    }
  }
  if (dates.length >= 2) {
    return { level: "recurring", label: "多次出现" };
  }
  return { level: "single", label: "初现线索" };
}
function observationConstrainedLevel(level, evidenceDates) {
  const signal = observationSignal(evidenceDates);
  if (level === "stable" && signal.level !== "stable") {
    return signal.level === "recurring" ? "recurring" : "single";
  }
  if (level === "recurring" && signal.level === "single") {
    return "single";
  }
  return ["single", "recurring", "stable"].includes(level) ? level : signal.level;
}
function observationLayer(value) {
  return OBSERVATION_LAYERS.includes(value) ? value : "归纳";
}
function observationDimension(value) {
  return OBSERVATION_DIMENSIONS.includes(value) ? value : "认知";
}
function observationPerspective(value) {
  return OBSERVATION_PERSPECTIVES.includes(value) ? value : "旁观者";
}
function observationItemKey(type, item, index = 0) {
  const source = [type, item?.dimension, item?.before, item?.now, item?.observation, item?.statement, item?.label, index].filter((part) => typeof part === "string" || Number.isInteger(part)).join("|");
  let hash = 2166136261;
  for (const char of source) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${type}-${(hash >>> 0).toString(16)}`;
}
function normalizeObservationAnalysis(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  if (summary.length === 0) {
    return null;
  }
  const changes = Array.isArray(value.changes) ? value.changes.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const evidenceDates = observationEvidenceDates(item.evidenceDates);
    const level = observationConstrainedLevel(typeof item.level === "string" ? item.level : "single", evidenceDates);
    return {
      key: typeof item.key === "string" && item.key.length > 0 ? item.key : observationItemKey("change", item, index),
      dimension: observationDimension(item.dimension),
      before: typeof item.before === "string" && item.before.trim().length > 0 ? item.before.trim() : "暂无明确对照",
      now: typeof item.now === "string" && item.now.trim().length > 0 ? item.now.trim() : "暂无明确对照",
      level,
      signal: observationSignal(evidenceDates).label,
      evidenceDates
    };
  }).filter((item) => item !== null).slice(0, 8) : [];
  const perspectives = Array.isArray(value.perspectives) ? value.perspectives.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const evidenceDates = observationEvidenceDates(item.evidenceDates);
    const observation = typeof item.observation === "string" ? item.observation.trim() : typeof item.basis === "string" ? item.basis.trim() : "";
    if (observation.length === 0) return null;
    return {
      key: typeof item.key === "string" && item.key.length > 0 ? item.key : observationItemKey("perspective", item, index),
      perspective: observationPerspective(item.perspective),
      observation,
      basis: typeof item.basis === "string" ? item.basis.trim() : observation,
      layer: observationLayer(item.layer),
      evidenceDates
    };
  }).filter((item) => item !== null).slice(0, 8) : [];
  const hypotheses = Array.isArray(value.hypotheses) ? value.hypotheses.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const statement = typeof item.statement === "string" ? item.statement.trim() : "";
    const alternative = typeof item.alternative === "string" ? item.alternative.trim() : "";
    const question = typeof item.question === "string" ? item.question.trim() : "";
    if (statement.length === 0 || alternative.length === 0 || question.length === 0) return null;
    const evidenceDates = observationEvidenceDates(item.evidenceDates);
    return {
      key: typeof item.key === "string" && item.key.length > 0 ? item.key : observationItemKey("hypothesis", item, index),
      statement,
      level: observationSignal(evidenceDates).label,
      evidenceDates,
      alternative,
      question
    };
  }).filter((item) => item !== null).slice(0, 6) : [];
  const roles = Array.isArray(value.roles) ? value.roles.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const observation = typeof item.observation === "string" ? item.observation.trim() : "";
    if (label.length === 0 || observation.length === 0 || /MBTI|人格|性格|星座|九型|依恋型|依戀型|高敏感|内向|內向|外向|性别|性別|年龄|年齡|种族|種族|民族|国籍|國籍|宗教|政治|性取向|残疾|殘疾|心理|医学|醫學|诊断|診斷|障碍|障礙|抑郁|憂鬱|焦虑|焦慮|躁郁|躁鬱|双相|雙相|强迫症|強迫症|创伤后|創傷後|精神分裂|自闭症|自閉症/i.test(label + observation)) return null;
    const evidenceDates = observationEvidenceDates(item.evidenceDates);
    return {
      key: typeof item.key === "string" && item.key.length > 0 ? item.key : observationItemKey("role", item, index),
      label,
      observation,
      evidenceDates
    };
  }).filter((item) => item !== null).slice(0, 5) : [];
  const nextStep = typeof value.nextStep === "string" ? value.nextStep.trim() : typeof value.nextStep?.action === "string" ? value.nextStep.action.trim() : "";
  const selfQuestion = typeof value.selfQuestion === "string" ? value.selfQuestion.trim() : "";
  if (nextStep.length === 0 || selfQuestion.length === 0) {
    return null;
  }
  return { summary, changes, perspectives, hypotheses, roles, nextStep, selfQuestion };
}
function observationReportEvidenceDates(reports) {
  const dates = new Set();
  for (const descriptor of reports) {
    const report = descriptor.report ?? {};
    const descriptorDates = Array.isArray(descriptor.evidenceDates) ? descriptor.evidenceDates : [];
    for (const date of descriptorDates) {
      if (observationDateValue(date).length > 0) dates.add(date);
    }
    for (const item of [...(report.changes ?? []), ...(report.possibleCauses ?? []), ...(report.rhythm ?? []), ...(report.highlights ?? []), ...(report.progress ?? []), ...(report.openLoops ?? []), ...(report.carryForward ?? []), ...(report.turningPoints ?? []), ...(report.themeEvolution ?? []), ...(report.threads ?? [])]) {
      for (const date of item.evidenceDates ?? []) {
        if (observationDateValue(date).length > 0) dates.add(date);
      }
    }
  }
  return dates;
}
function observationEvidenceId(record) {
  return observationItemKey("evidence", { dimension: `${record.date}|${record.type ?? "other"}`, before: record.time, now: record.title, observation: record.summary }).replace("evidence-", "EV-");
}
function observationEvidenceCatalog(reports, limit = 60) {
  const unique = new Map();
  for (const descriptor of reports) {
    const eventRecords = descriptor.report?.eventSnapshot?.records ?? [];
    for (const record of eventRecords) {
      const id = observationEvidenceId(record);
      const current = unique.get(id);
      const value = {
        id,
        date: record.date,
        time: record.time,
        type: record.type,
        status: record.status,
        title: String(record.title ?? "").slice(0, 120),
        summary: String(record.summary ?? "").slice(0, 240),
        quote: String(record.traces?.find((trace) => trace.evidence?.length > 0)?.evidence ?? "").slice(0, 160),
        sourceReports: [...new Set([...(current?.sourceReports ?? []), descriptor.filePath])]
      };
      unique.set(id, value);
    }
    if (eventRecords.length === 0) {
      const report = descriptor.report ?? {};
      const historical = [...(report.highlights ?? []), ...(report.changes ?? []), ...(report.progress ?? []), ...(report.openLoops ?? []), ...(report.turningPoints ?? []), ...(report.themeEvolution ?? []), ...(report.threads ?? [])];
      for (const item of historical) {
        const date = item.evidenceDates?.find((candidate) => observationDateValue(candidate).length > 0);
        const summary = String(item.text ?? item.observation ?? item.now ?? item.summary ?? "").trim();
        if (!date || !summary) continue;
        const record = { date, time: "", type: "report", title: `${descriptor.type === "monthly" ? "月报" : "周报"}线索`, summary };
        const id = observationEvidenceId(record);
        const current = unique.get(id);
        unique.set(id, { id, date, time: "", type: "report", status: "occurred", title: record.title, summary: summary.slice(0, 240), quote: "", sourceReports: [...new Set([...(current?.sourceReports ?? []), descriptor.filePath])], reportLevel: true });
      }
    }
  }
  const priority = { blocked: 0, ongoing: 1, planned: 2, uncertain: 3, resolved: 4, occurred: 5 };
  const ordered = [...unique.values()].sort((left, right) => (priority[left.status] ?? 9) - (priority[right.status] ?? 9) || right.date.localeCompare(left.date) || right.time.localeCompare(left.time));
  const selected = [];
  const seen = new Set();
  for (const descriptor of reports) {
    const item = ordered.find((candidate) => !seen.has(candidate.id) && candidate.sourceReports.includes(descriptor.filePath));
    if (item !== void 0) { selected.push(item); seen.add(item.id); }
    if (selected.length >= limit) return selected;
  }
  for (const item of ordered) {
    if (!seen.has(item.id)) { selected.push(item); seen.add(item.id); }
    if (selected.length >= limit) break;
  }
  return selected;
}
function normalizeObservationV2(value, evidenceCatalog = []) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  const nextObservation = typeof value.nextObservation === "string" ? value.nextObservation.trim() : "";
  const allowed = new Set(evidenceCatalog.map((item) => item.id));
  const claims = Array.isArray(value.claims) ? value.claims.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const dimension = observationDimension(item.dimension);
    const layer = ["fact", "inference", "hypothesis"].includes(item.layer) ? item.layer : "inference";
    const statement = typeof item.statement === "string" ? item.statement.trim() : "";
    const sensitiveText = [statement, item.before, item.now, item.alternative].filter((part) => typeof part === "string").join(" ");
    if (/MBTI|人格|性格|星座|九型|依恋型|依戀型|高敏感|性别|性別|年龄|年齡|种族|種族|民族|国籍|國籍|宗教|政治立场|政治立場|性取向|残疾|殘疾|心理疾病|精神疾病|诊断|診斷|抑郁症|憂鬱症|焦虑症|焦慮症|躁郁|躁鬱|双相|雙相|强迫症|強迫症|创伤后|創傷後|精神分裂|自闭症|自閉症|\d+(?:\.\d+)?\s*%|百分之/i.test(sensitiveText)) return null;
    const supportEvidenceRefs = Array.isArray(item.supportEvidenceRefs) ? [...new Set(item.supportEvidenceRefs.filter((id) => allowed.has(id)))].slice(0, 12) : [];
    const counterEvidenceRefs = Array.isArray(item.counterEvidenceRefs) ? [...new Set(item.counterEvidenceRefs.filter((id) => allowed.has(id) && !supportEvidenceRefs.includes(id)))].slice(0, 8) : [];
    const alternative = typeof item.alternative === "string" ? item.alternative.trim() : "";
    const missingInformation = typeof item.missingInformation === "string" ? item.missingInformation.trim() : "";
    const verificationQuestion = typeof item.verificationQuestion === "string" ? item.verificationQuestion.trim() : "";
    if (statement.length === 0 || supportEvidenceRefs.length === 0) return null;
    if (layer !== "fact" && (alternative.length === 0 || missingInformation.length === 0 || verificationQuestion.length === 0)) return null;
    return {
      key: typeof item.key === "string" && item.key.length > 0 ? item.key : observationItemKey("claim", { dimension, observation: statement }, index),
      dimension, layer, statement,
      before: typeof item.before === "string" ? item.before.trim() : "",
      now: typeof item.now === "string" ? item.now.trim() : "",
      supportEvidenceRefs, counterEvidenceRefs, alternative, missingInformation, verificationQuestion
    };
  }).filter(Boolean).slice(0, 8) : [];
  if (summary.length === 0 || nextObservation.length === 0 || claims.length === 0) return null;
  return { schemaVersion: 2, summary, claims, nextObservation };
}
function observationClaimMetrics(claim, evidence, sources) {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const support = claim.supportEvidenceRefs.map((id) => byId.get(id)).filter(Boolean);
  const counter = claim.counterEvidenceRefs.map((id) => byId.get(id)).filter(Boolean);
  const dates = [...new Set(support.map((item) => item.date))].sort();
  const first = parseLocalDate(dates[0] ?? "");
  const last = parseLocalDate(dates[dates.length - 1] ?? "");
  const spanDays = first !== null && last !== null ? localDayOrdinal(last) - localDayOrdinal(first) : 0;
  const independentPeriods = selectIndependentObservationSources(sources).filter((source) => dates.some((date) => date >= source.periodStart && date <= source.periodEnd)).length;
  const signal = dates.length >= 4 && spanDays >= 28 ? "持续出现" : dates.length >= 2 ? "多次出现" : "初现线索";
  const supportSourcePaths = new Set(support.flatMap((item) => item.sourceReports ?? []));
  const supportSources = sources.filter((source) => supportSourcePaths.has(observationDescriptorPath(source)));
  const partialOnly = supportSources.length > 0 && supportSources.every((source) => observationDescriptorStatus(source) === "partial");
  let sufficiency = independentPeriods >= 3 && dates.length >= 4 && spanDays >= 28 ? "较充分" : independentPeriods >= 2 && dates.length >= 2 ? "中等" : "有限";
  if (counter.length > 0 && sufficiency === "较充分") sufficiency = "中等";
  if (partialOnly) sufficiency = "有限";
  if (support.some((item) => item.reportLevel === true)) sufficiency = "有限";
  return { support, counter, dates, spanDays, independentPeriods, signal, sufficiency };
}
function observationFeedbackContext(analysis, feedback = {}) {
  const context = {};
  if (typeof analysis !== "object" || analysis === null || typeof feedback !== "object" || feedback === null || Array.isArray(feedback)) {
    return context;
  }
  const sections = [
    ["change", analysis.changes ?? [], (item) => `${item.dimension}：${item.before} → ${item.now}`],
    ["perspective", analysis.perspectives ?? [], (item) => `${item.perspective}：${item.observation}`],
    ["hypothesis", analysis.hypotheses ?? [], (item) => item.statement],
    ["role", analysis.roles ?? [], (item) => `${item.label}：${item.observation}`]
  ];
  for (const [type, items, text] of sections) {
    for (const item of items) {
      const key = typeof item.key === "string" ? item.key : "";
      const itemFeedback = key.length > 0 ? feedback[key] : null;
      if (itemFeedback === null || typeof itemFeedback !== "object" || !["confirmed", "partial", "rejected", "uncertain", "pending"].includes(itemFeedback.status)) {
        continue;
      }
      context[key] = {
        type,
        text: text(item),
        status: itemFeedback.status,
        correction: typeof itemFeedback.correction === "string" ? itemFeedback.correction.slice(0, 800) : ""
      };
    }
  }
  return context;
}
function observationInterval(descriptor) {
  const start = typeof descriptor?.periodStart === "string" ? descriptor.periodStart : typeof descriptor?.start === "string" ? descriptor.start : "";
  const end = typeof descriptor?.periodEnd === "string" ? descriptor.periodEnd : typeof descriptor?.end === "string" ? descriptor.end : "";
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  if (startDate === null || endDate === null || start > end) {
    return null;
  }
  return { start, end, startOrdinal: localDayOrdinal(startDate), endOrdinal: localDayOrdinal(endDate) };
}
function observationDescriptorStatus(descriptor) {
  return descriptor?.periodStatus === "partial" || descriptor?.status === "partial" ? "partial" : "complete";
}
function observationDescriptorPath(descriptor) {
  return typeof descriptor?.filePath === "string" && descriptor.filePath.length > 0 ? descriptor.filePath : typeof descriptor?.path === "string" ? descriptor.path : "";
}
function observationDescriptorKey(descriptor) {
  const interval = observationInterval(descriptor);
  if (interval === null) return "";
  const type = descriptor?.type === "monthly" ? "monthly" : "weekly";
  return `${type}|${interval.start}`;
}
function observationEvidenceDateSet(reports) {
  return observationReportEvidenceDates(Array.isArray(reports) ? reports : []);
}
function compareObservationSourcePreference(left, right) {
  const leftStatus = observationDescriptorStatus(left);
  const rightStatus = observationDescriptorStatus(right);
  if (leftStatus !== rightStatus) return leftStatus === "complete" ? -1 : 1;
  const leftGenerated = typeof left?.generatedAt === "string" ? Date.parse(left.generatedAt) : Number.NaN;
  const rightGenerated = typeof right?.generatedAt === "string" ? Date.parse(right.generatedAt) : Number.NaN;
  if (Number.isFinite(leftGenerated) || Number.isFinite(rightGenerated)) {
    if (!Number.isFinite(leftGenerated)) return 1;
    if (!Number.isFinite(rightGenerated)) return -1;
    if (leftGenerated !== rightGenerated) return rightGenerated - leftGenerated;
  }
  const leftFine = left?.type === "weekly" ? 1 : 0;
  const rightFine = right?.type === "weekly" ? 1 : 0;
  return rightFine - leftFine;
}
function dedupeObservationReports(reports) {
  const byCycle = new Map();
  for (const descriptor of Array.isArray(reports) ? reports : []) {
    const interval = observationInterval(descriptor);
    const path = observationDescriptorPath(descriptor);
    if (interval === null || path.length === 0) continue;
    const key = observationDescriptorKey(descriptor) || `${path}|${interval.start}|${interval.end}`;
    const current = byCycle.get(key);
    if (current === void 0 || compareObservationSourcePreference(descriptor, current) < 0) {
      byCycle.set(key, descriptor);
    }
  }
  return [...byCycle.values()].sort((left, right) => {
    const leftInterval = observationInterval(left);
    const rightInterval = observationInterval(right);
    return (rightInterval?.end ?? "").localeCompare(leftInterval?.end ?? "") || (rightInterval?.start ?? "").localeCompare(leftInterval?.start ?? "") || compareObservationSourcePreference(left, right);
  });
}
function observationSourceSelectionScore(selection) {
  const values = Array.isArray(selection) ? selection : [];
  return {
    count: values.length,
    weekly: values.filter((item) => item?.type === "weekly").length,
    totalSpan: values.reduce((sum, item) => {
      const interval = observationInterval(item);
      return sum + (interval === null ? 0 : interval.endOrdinal - interval.startOrdinal + 1);
    }, 0),
    key: values.map((item) => `${item?.type ?? ""}:${item?.periodStart ?? ""}:${item?.periodEnd ?? ""}`).sort().join(",")
  };
}
function betterObservationSourceSelection(left, right) {
  const a = observationSourceSelectionScore(left);
  const b = observationSourceSelectionScore(right);
  if (a.count !== b.count) return a.count > b.count ? left : right;
  if (a.weekly !== b.weekly) return a.weekly > b.weekly ? left : right;
  if (a.totalSpan !== b.totalSpan) return a.totalSpan < b.totalSpan ? left : right;
  return a.key <= b.key ? left : right;
}
function selectIndependentObservationSources(reports) {
  const complete = dedupeObservationReports(reports).filter((item) => observationDescriptorStatus(item) === "complete" && observationInterval(item) !== null);
  const ordered = [...complete].sort((left, right) => {
    const a = observationInterval(left);
    const b = observationInterval(right);
    return (a?.endOrdinal ?? 0) - (b?.endOrdinal ?? 0) || (a?.startOrdinal ?? 0) - (b?.startOrdinal ?? 0) || (left?.type === "weekly" ? -1 : 1);
  });
  const memo = new Map();
  const solve = (index, lastEndOrdinal) => {
    const key = `${index}|${lastEndOrdinal}`;
    const cached = memo.get(key);
    if (cached !== void 0) return cached;
    if (index >= ordered.length) return [];
    const skipped = solve(index + 1, lastEndOrdinal);
    const interval = observationInterval(ordered[index]);
    const taken = interval !== null && interval.startOrdinal > lastEndOrdinal ? [ordered[index], ...solve(index + 1, interval.endOrdinal)] : null;
    const result = taken === null ? skipped : betterObservationSourceSelection(taken, skipped);
    memo.set(key, result);
    return result;
  };
  return solve(0, Number.NEGATIVE_INFINITY).sort((left, right) => (left.periodStart ?? "").localeCompare(right.periodStart ?? ""));
}
function observationMaturityExplanation(maturity) {
  if (maturity.stage === "continuous") return "持续观照已解锁：可以检视更长期的变化与近期承担的角色。";
  if (maturity.stage === "cross_period") return `跨周期观照已解锁：已找到 ${maturity.independentPeriodCount} 个互不重叠的完整周期。再积累 ${maturity.remaining.continuousPeriods} 个完整周期、${maturity.remaining.continuousEvidenceDates} 个证据日期，并达到 28 天跨度，可解锁持续观照。`;
  if (maturity.independentPeriodCount > 0) return `初次观照可用：已读取 ${maturity.eligibleReportCount} 份可解析回顾。跨周期还差 ${maturity.remaining.crossPeriodPeriods} 个互不重叠的完整周期和 ${maturity.remaining.crossPeriodEvidenceDates} 个证据日期。`;
  return "初次观照可用：至少 1 份可解析回顾即可开始；完整周期完成后才会计入更高阶段。";
}
function computeObservationMaturity(reports) {
  const eligible = dedupeObservationReports(reports);
  const completeIndependentSources = selectIndependentObservationSources(eligible);
  const allEvidenceDates = [...observationEvidenceDateSet(eligible)].sort();
  const independentEvidenceDates = [...observationEvidenceDateSet(completeIndependentSources)].sort();
  const first = parseLocalDate(independentEvidenceDates[0] ?? "");
  const last = parseLocalDate(independentEvidenceDates[independentEvidenceDates.length - 1] ?? "");
  const spanDays = first !== null && last !== null ? localDayOrdinal(last) - localDayOrdinal(first) : 0;
  const periodCount = completeIndependentSources.length;
  const crossReady = periodCount >= 2 && independentEvidenceDates.length >= 2;
  const continuousReady = periodCount >= 4 && independentEvidenceDates.length >= 4 && spanDays >= 28;
  const stage = continuousReady ? "continuous" : crossReady ? "cross_period" : "initial";
  const maturity: any = {
    stage,
    eligibleReportCount: eligible.length,
    completeReportCount: eligible.filter((item) => observationDescriptorStatus(item) === "complete").length,
    independentPeriodCount: periodCount,
    uniqueEvidenceDateCount: independentEvidenceDates.length,
    allUniqueEvidenceDateCount: allEvidenceDates.length,
    evidenceSpanDays: spanDays,
    completeIndependentSources,
    remaining: {
      crossPeriodPeriods: Math.max(0, 2 - periodCount),
      crossPeriodEvidenceDates: Math.max(0, 2 - independentEvidenceDates.length),
      continuousPeriods: Math.max(0, 4 - periodCount),
      continuousEvidenceDates: Math.max(0, 4 - independentEvidenceDates.length),
      continuousSpanDays: Math.max(0, 28 - spanDays)
    }
  };
  maturity.description = observationMaturityExplanation(maturity);
  return maturity;
}
function observationSnapshotMaturity(snapshot) {
  const saved = snapshot?.maturity;
  const completeSaved = saved && ["initial", "cross_period", "continuous"].includes(saved.stage) && [
    saved.eligibleReportCount,
    saved.independentPeriodCount,
    saved.uniqueEvidenceDateCount,
    saved.allUniqueEvidenceDateCount,
    saved.evidenceSpanDays,
    saved.remaining?.crossPeriodPeriods,
    saved.remaining?.crossPeriodEvidenceDates,
    saved.remaining?.continuousPeriods,
    saved.remaining?.continuousEvidenceDates,
    saved.remaining?.continuousSpanDays
  ].every((value) => Number.isFinite(Number(value)));
  if (completeSaved) {
    return saved;
  }
  const evidence = Array.isArray(snapshot?.evidence) ? snapshot.evidence : [];
  const sources = (Array.isArray(snapshot?.sources) ? snapshot.sources : []).map((source) => {
    const path = observationDescriptorPath(source);
    const interval = observationInterval(source);
    const evidenceDates = [...new Set(evidence.filter((item) => {
      const date = observationDateValue(item?.date);
      if (date.length === 0 || interval === null || date < interval.start || date > interval.end) return false;
      const linked = Array.isArray(item?.sourceReports) ? item.sourceReports : [];
      return linked.length === 0 || linked.includes(path);
    }).map((item) => item.date))];
    return { ...source, evidenceDates };
  });
  return computeObservationMaturity(sources);
}
function observationSourceSignature(source) {
  return `${source?.type ?? ""}|${source?.periodStart ?? ""}|${source?.periodEnd ?? ""}|${source?.periodStatus === "partial" ? "partial" : "complete"}`;
}
function deriveObservationFreshness(snapshot, reports, availablePaths = null) {
  const current = dedupeObservationReports(reports);
  const savedSources = Array.isArray(snapshot?.sources) ? snapshot.sources : [];
  const currentByPath = new Map<string, any>(current.map((source) => [observationDescriptorPath(source), source]));
  const savedByPath = new Map<string, any>(savedSources.map((source) => [observationDescriptorPath(source), source]));
  const reasons = [];
  const newEvidence = current.filter((source) => {
    const saved = savedByPath.get(observationDescriptorPath(source));
    return saved === void 0 || observationSourceSignature(saved) !== observationSourceSignature(source) || (source.generatedAt && source.generatedAt !== saved.generatedAt) || Number(source.modifiedAt || 0) > Number(saved.modifiedAt || 0);
  });
  if (newEvidence.length > 0) reasons.push(`有 ${newEvidence.length} 份新回顾或更新的回顾`);
  const missing = savedSources.filter((source) => {
    const path = observationDescriptorPath(source);
    if (availablePaths instanceof Set && !availablePaths.has(path)) return true;
    return !currentByPath.has(path);
  });
  if (missing.length > 0) reasons.push(`有 ${missing.length} 个来源文件暂时不可用`);
  return {
    stale: reasons.length > 0,
    hasNewEvidence: newEvidence.length > 0,
    missingSources: missing,
    newEvidence,
    reasons,
    reason: reasons.join("；")
  };
}
function observationStageRules(stage) {
  if (stage === "continuous") return "当前阶段 continuous：允许 stable（持续出现）和有证据的近期生活角色线索；仍禁止人格、身份、诊断或确定性结论。";
  if (stage === "cross_period") return "当前阶段 cross_period：允许 recurring（多次出现）、全部六种视角、待验证假设、替代解释和自我问题；禁止 stable 和生活角色。不得把重叠周报/月报当成独立证据。";
  return "当前阶段 initial：只生成 single（初现线索）；perspectives 只可用事实、情绪、行为；hypotheses 最多 2 条且必须低风险、带替代解释和问题；禁止 recurring、stable、跨周期措辞和生活角色。";
}
function observationContainsCrossPeriodLanguage(value) {
  return /recurring|stable|多次|反复|持续|稳定|跨周期|长期|一直|一贯|越来越|反复出现/i.test(String(value ?? ""));
}
function observationSafeHypothesis(item) {
  const text = `${item?.statement ?? ""}${item?.alternative ?? ""}${item?.question ?? ""}`;
  return !/人格|性格|MBTI|星座|九型|依恋|高敏感|内向|外向|身份|性别|年龄|种族|民族|国籍|宗教|政治|性取向|残疾|疾病|诊断|抑郁|焦虑|躁郁|双相|强迫症|创伤|精神分裂|自闭症/i.test(text);
}
function constrainObservationAnalysisForMaturity(analysis, maturity) {
  const stage = maturity?.stage ?? "initial";
  const next = {
    ...analysis,
    changes: (analysis?.changes ?? []).map((item) => ({ ...item })),
    perspectives: (analysis?.perspectives ?? []).map((item) => ({ ...item })),
    hypotheses: (analysis?.hypotheses ?? []).map((item) => ({ ...item })),
    roles: (analysis?.roles ?? []).map((item) => ({ ...item }))
  };
  next.hypotheses = next.hypotheses.filter((item) => observationSafeHypothesis(item));
  if (stage === "initial") {
    next.changes = next.changes.filter((item) => !observationContainsCrossPeriodLanguage(`${item.before} ${item.now}`)).map((item) => ({ ...item, level: "single", signal: "初现线索" }));
    next.perspectives = next.perspectives.filter((item) => ["事实", "情绪", "行为"].includes(item.perspective)).slice(0, 6);
    next.hypotheses = next.hypotheses.filter((item) => !observationContainsCrossPeriodLanguage(`${item.statement} ${item.alternative}`)).slice(0, 2);
    next.roles = [];
  } else if (stage === "cross_period") {
    next.changes = next.changes.filter((item) => item.level !== "stable").map((item) => ({ ...item, level: item.level === "single" ? "single" : "recurring" }));
    next.roles = [];
  }
  return next;
}
function buildObservationMessages(reports, feedback: Record<string, any> = {}, maturity = computeObservationMaturity(reports)) {
  const selected = maturity?.completeIndependentSources?.length > 0 ? maturity.completeIndependentSources : [];
  const sourceLines = reports.map((descriptor) => {
    const report = descriptor.report;
    const changes = [...(report.changes ?? []), ...(report.highlights ?? []), ...(report.progress ?? []), ...(report.openLoops ?? []), ...(report.turningPoints ?? []), ...(report.themeEvolution ?? []), ...(report.threads ?? [])].slice(0, 10).map((item) => `${item.observation ?? item.text ?? ""}（${(item.evidenceDates ?? []).join("、") || "未提供证据日期"}）`).join("；") || "无";
    const causes = (report.possibleCauses ?? []).slice(0, 4).map((item) => `${item.hypothesis ?? item.text ?? ""}（旧版分析，仅作背景）`).join("；") || "无";
    const themes = (report.themes ?? []).slice(0, 5).map((item) => `${item.name}：${item.observation}`).join("；") || "无";
    const emotion = report.emotion?.hypothesis ?? report.emotionReading?.hypothesis ?? "无";
    const rhythm = (report.rhythm ?? []).slice(0, 4).map((item) => `${item.observation ?? item.text ?? ""}（${(item.evidenceDates ?? []).join("、") || "未提供证据日期"}）`).join("；") || "无";
    const metrics = (report.metrics ?? []).slice(0, 6).map((metric) => `${metric.label ?? metric.key ?? "指标"}：本期 ${metric.current ?? "—"}；对照 ${metric.delta ?? "—"}`).join("；") || "无";
    const status = descriptor.periodStatus === "partial" ? "；周期尚未结束" : "";
    const independent = selected.some((source) => source.filePath === descriptor.filePath && source.periodStart === descriptor.periodStart && source.periodEnd === descriptor.periodEnd) ? "；可计入独立完整周期" : "";
    return [`【${descriptor.type === "monthly" ? "月报" : "周报"} ${descriptor.periodStart} 至 ${descriptor.periodEnd}${status}${independent}】`, `摘要：${report.summary}`, `定量指标：${metrics}`, `事实与结构：${changes}`, `旧版分析背景：${causes}`, `旧版情绪背景：${emotion}`, `主题：${themes}`, `节奏：${rhythm}`].join("\n");
  }).join("\n\n");
  const evidence = observationEvidenceCatalog(reports);
  const evidenceLines = evidence.map((item) => `${item.id}｜${item.date} ${item.time}｜${EVENT_TYPE_LABELS[item.type] ?? "事件"}｜${EVENT_STATUS_LABELS[item.status] ?? item.status}｜${item.title}：${item.summary}${item.quote ? `｜短原话：${item.quote}` : ""}`).join("\n");
  const feedbackLines = Object.entries(feedback ?? {}).slice(0, 60).map(([key, item]) => `${item.type ?? "item"}｜${item.text ?? ""}｜${item.status}｜${item.correction ?? ""}｜key=${key}`).join("\n");
  return [
    {
      role: "system",
      content: [
        "你是 Mind Trace 的观照助手。只根据给定报告字段、结构化事件摘要和短证据片段做可验证观察，不读取完整历史日记。",
        "不要定义人格、疾病、受保护属性或身份。事实、归纳和待验证假设必须分层；不把变化评价为好或坏。",
        "dimension 只能是 想法、行为、认知、情绪、关系、目标；layer 只能是 fact、inference、hypothesis。每条 claim 必须引用证据目录中的 supportEvidenceRefs。",
        "inference 与 hypothesis 必须同时提供 alternative、missingInformation、verificationQuestion；counterEvidenceRefs 用于引用合理反例，没有时返回空数组。",
        "反馈语义：confirmed 表示用户确认符合，partial 表示部分符合，rejected 表示明确不符合，uncertain 表示暂时不确定，pending 表示尚未校准；请尊重 rejected、partial 与 correction，避免重复被否认的说法。",
        `成熟度统计：stage=${maturity.stage}；可解析回顾 ${maturity.eligibleReportCount} 份；选中的互不重叠完整周期 ${maturity.independentPeriodCount} 个；选中来源证据日期 ${maturity.uniqueEvidenceDateCount} 个；证据跨度 ${maturity.evidenceSpanDays} 天。周报和月报可能覆盖同一段时间，重叠不等于独立证据，报告数量不等于置信度。${observationStageRules(maturity.stage)}`,
        "最多返回 8 条 claims。不要输出置信百分比；依据充分度由本地计算。",
        '只输出 JSON：{"summary":"string","claims":[{"dimension":"想法|行为|认知|情绪|关系|目标","layer":"fact|inference|hypothesis","statement":"string","before":"string","now":"string","supportEvidenceRefs":["EV-..."],"counterEvidenceRefs":[],"alternative":"string","missingInformation":"string","verificationQuestion":"string"}],"nextObservation":"string"}'
      ].join("\n")
    },
    {
      role: "user",
      content: `可用报告（不含完整日记）：\n${sourceLines}\n\n结构化证据目录：\n${evidenceLines || "无"}\n\n用户之前的校准反馈：\n${feedbackLines || "无"}`
    }
  ];
}
function parseObservation(raw, reports, maturity = computeObservationMaturity(reports)) {
  const value = objectValue(raw);
  const evidence = observationEvidenceCatalog(reports);
  if (evidence.length === 0) throw new Error("来源报告没有结构化事件证据，无法生成新版观照");
  const normalized = normalizeObservationV2(value, evidence);
  if (normalized === null) throw new Error("模型结果缺少有效的观照 claims 或证据引用");
  return normalized;
}
function extractJson(raw) {
  const trimmed = raw.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("模型没有返回有效 JSON");
    }
    return JSON.parse(withoutFence.slice(start, end + 1));
  }
}
function objectValue(raw) {
  const value = extractJson(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("模型没有返回 JSON 对象");
  }
  return value;
}
function stringField(value, key) {
  const field = value[key];
  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(`模型结果缺少 ${key}`);
  }
  return field.trim();
}
function stringArrayField(value, key) {
  const field = value[key];
  if (!Array.isArray(field) || field.some((item) => typeof item !== "string")) {
    throw new Error(`模型结果中的 ${key} 格式不正确`);
  }
  return field.filter((item) => typeof item === "string").map((item) => item.trim()).filter((item) => item.length > 0);
}
function facetArrayField(value) {
  const field = value.facets;
  if (!Array.isArray(field)) {
    throw new Error("模型结果中的 facets 格式不正确");
  }
  const facets = field.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("模型结果中的 facets 格式不正确");
    }
    const facet = item;
    return {
      category: stringField(facet, "category"),
      summary: stringField(facet, "summary")
    };
  });
  if (facets.length < 2 || facets.length > 6) {
    throw new Error("智能切片必须为 2–6 条");
  }
  if (new Set(facets.map((facet) => facet.category)).size !== facets.length) {
    throw new Error("智能切片类别不能重复");
  }
  return facets;
}
function eventArrayField(value, key = "events") {
  const field = value[key];
  if (!Array.isArray(field)) {
    throw new Error(`模型结果中的 ${key} 格式不正确`);
  }
  return validateEvents(field);
}
function parseFollowUp(raw) {
  const value = objectValue(raw);
  if (typeof value.continue !== "boolean") {
    throw new Error("模型结果缺少 continue");
  }
  return {
    question: value.continue ? stringField(value, "question") : "",
    continue: value.continue
  };
}
function ratingDetailField(value, key) {
  const field = value[key];
  if (typeof field !== "object" || field === null || Array.isArray(field)) {
    throw new Error(`模型结果中的 ${key} 评分格式不正确`);
  }
  const detail = field;
  if (typeof detail.score !== "number" || !Number.isInteger(detail.score) || detail.score < 1 || detail.score > 5) {
    throw new Error(`${key} 的 AI 评分必须为 1–5 的整数`);
  }
  return {
    score: detail.score,
    reason: stringField(detail, "reason")
  };
}
function parseGeneratedEntry(raw) {
  const value = objectValue(raw);
  const insights = stringArrayField(value, "insights");
  const themes = stringArrayField(value, "themes");
  const facets = facetArrayField(value);
  const events = eventArrayField(value);
  if (insights.length < 2 || insights.length > 4) {
    throw new Error("反思洞察必须为 2–4 条");
  }
  if (themes.length < 1 || themes.length > 5) {
    throw new Error("主题必须为 1–5 个");
  }
  return {
    diary: stringField(value, "diary"),
    events,
    facets,
    insights,
    microAction: stringField(value, "microAction"),
    selfQuestion: stringField(value, "selfQuestion"),
    themes: [...new Set(themes)]
  };
}
function parseRatingAssessment(raw) {
  const value = objectValue(raw);
  return {
    mood: ratingDetailField(value, "mood"),
    energy: ratingDetailField(value, "energy"),
    stress: ratingDetailField(value, "stress")
  };
}
function parseEventBackfill(raw, requestedSessions, maximum = Number.POSITIVE_INFINITY) {
  const value = objectValue(raw);
  if (!Array.isArray(value.sessions)) {
    throw new Error("模型结果缺少待补全会话");
  }
  const requested = new Map<string, any>(requestedSessions.map((session) => [`${session.date}#${session.sessionIndex}`, session]));
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of value.sessions) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("补全会话格式不正确");
    }
    const id = stringField(item, "id");
    const date = stringField(item, "date");
    const time = stringField(item, "time");
    const key = id;
    if (!requested.has(key) || seen.has(key)) {
      throw new Error("模型返回了无法对应的日记会话");
    }
    const source = requested.get(key);
    if (source.date !== date || source.time !== time) {
      throw new Error("模型改变了待补全会话的日期或时间");
    }
    seen.add(key);
    const previousIds = new Map((source.events ?? []).filter((event) => event.id?.length > 0).map((event) => [`${event.type}:${normalizeEventElementName(event.title)}`, event.id]));
    const events = eventArrayField(item).map((event) => ({
      ...event,
      id: previousIds.get(`${event.type}:${normalizeEventElementName(event.title)}`) ?? event.id
    }));
    results.push({ source, events });
  }
  if (seen.size !== requested.size) {
    throw new Error("模型没有返回全部待补全会话");
  }
  if (results.reduce((sum, result) => sum + result.events.length, 0) > maximum) {
    throw new Error(`模型返回的事件超过本周剩余额度 ${maximum}`);
  }
  return results;
}
