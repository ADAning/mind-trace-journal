var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MindTracePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian7 = require("obsidian");

// src/credentials.ts
function resolveCredential(configuration, resolveSecret, environment) {
  switch (configuration.credentialSource) {
    case "environment": {
      const name = configuration.environmentVariable.trim();
      if (name.length === 0) {
        throw new Error("\u8BF7\u5148\u586B\u5199\u73AF\u5883\u53D8\u91CF\u540D\u79F0");
      }
      if (environment === null) {
        throw new Error("\u73AF\u5883\u53D8\u91CF\u9274\u6743\u4EC5\u652F\u6301 Obsidian \u684C\u9762\u7AEF");
      }
      const value = environment[name];
      if (value === void 0 || value.length === 0) {
        throw new Error(
          `\u5F53\u524D Obsidian \u8FDB\u7A0B\u672A\u8BFB\u53D6\u5230\u73AF\u5883\u53D8\u91CF ${name}`
        );
      }
      return value;
    }
    case "secret-storage": {
      if (configuration.secretId.length === 0) {
        throw new Error("\u8BF7\u5148\u5728\u5FC3\u8FF9\u8BBE\u7F6E\u4E2D\u9009\u62E9 API Key");
      }
      const value = resolveSecret(configuration.secretId);
      if (value === null || value.length === 0) {
        throw new Error("Secret Storage \u4E2D\u6CA1\u6709\u627E\u5230\u6240\u9009 API Key");
      }
      return value;
    }
    case "none":
      return "";
  }
}
function credentialAvailable(configuration, resolveSecret, environment) {
  try {
    resolveCredential(configuration, resolveSecret, environment);
    return true;
  } catch {
    return false;
  }
}

// src/dashboard-view.ts
var import_obsidian = require("obsidian");

// src/date-utils.ts
function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function localTimeString(date) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}
function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function localDayOrdinal(date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1e3)
  );
}
function addLocalDays(date, days) {
  const result = startOfLocalDay(date);
  result.setDate(result.getDate() + days);
  return result;
}
function startOfLocalWeek(date) {
  const day = startOfLocalDay(date);
  const mondayOffset = (day.getDay() + 6) % 7;
  return addLocalDays(day, -mondayOffset);
}
function completedPeriod(type = "weekly", now = /* @__PURE__ */ new Date()) {
  if (type !== "weekly") {
    throw new Error(`\u6682\u4E0D\u652F\u6301 ${type} \u5468\u671F`);
  }
  const end = addLocalDays(startOfLocalWeek(now), -1);
  const start = addLocalDays(end, -6);
  return {
    type,
    start: localDateString(start),
    end: localDateString(end)
  };
}
function previousPeriod(period) {
  const start = parseLocalDate(period.start);
  if (start === null) {
    throw new Error("\u62A5\u544A\u5468\u671F\u65E5\u671F\u65E0\u6548");
  }
  const end = addLocalDays(start, -1);
  return {
    type: period.type,
    start: localDateString(addLocalDays(end, -6)),
    end: localDateString(end)
  };
}
function periodEntries(entries, period) {
  return entries.filter((entry) => entry.date >= period.start && entry.date <= period.end);
}
function periodLabel(period) {
  return `${period.start.slice(5).replace("-", ".")} — ${period.end.slice(5).replace("-", ".")}`;
}
function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = new Date(year, month - 1, day);
  if (localDateString(result) !== value) {
    return null;
  }
  return result;
}
function draftEntryDate(draft) {
  if (typeof draft.entryDate === "string" && parseLocalDate(draft.entryDate) !== null) {
    return draft.entryDate;
  }
  if (typeof draft.createdAt === "string") {
    const createdAt = new Date(draft.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      return localDateString(createdAt);
    }
  }
  return localDateString(/* @__PURE__ */ new Date());
}
function entryDateWithCurrentTime(dateString, now = /* @__PURE__ */ new Date()) {
  const date = parseLocalDate(dateString);
  if (date === null) {
    throw new Error("日记日期无效");
  }
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return date;
}

// src/privacy.ts
var PRIVACY_UNLOCK_DURATION_MS = 2 * 60 * 60 * 1e3;
var PASSWORD_KDF_ITERATIONS = 21e4;
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function derivePasswordVerifier(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations
    },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}
function constantTimeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
function renderPrivacyGate(container, plugin) {
  if (plugin.isPrivacyUnlocked()) {
    container.removeClass("mind-trace-locked-view");
    return false;
  }
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-locked-view");
  const shell = container.createDiv({ cls: "mind-trace-lock-shell" });
  shell.createDiv({ cls: "mind-trace-empty-mark", text: "私密" });
  const configured = plugin.isPasswordConfigured();
  shell.createDiv({
    cls: "mind-trace-lock-title",
    text: configured ? "解锁心迹" : "先为心迹设置密码",
    attr: { role: "heading", "aria-level": "2" }
  });
  shell.createEl("p", {
    text: configured ? "解锁后两小时内，可以记录、阅读、查看成长看板、导出和编辑日记。" : "密码至少 8 个字符。心迹会保存加盐验证值，不会保存明文密码。"
  });
  const form = shell.createEl("form", { cls: "mind-trace-lock-form" });
  const password = form.createEl("input", {
    attr: {
      type: "password",
      placeholder: configured ? "输入心迹密码" : "设置心迹密码",
      autocomplete: configured ? "current-password" : "new-password",
      "aria-label": configured ? "心迹密码" : "设置心迹密码"
    }
  });
  let confirmation = null;
  if (!configured) {
    confirmation = form.createEl("input", {
      attr: {
        type: "password",
        placeholder: "再次输入密码",
        autocomplete: "new-password",
        "aria-label": "确认心迹密码"
      }
    });
  }
  const error = form.createEl("p", {
    cls: "mind-trace-lock-error",
    attr: { role: "alert", "aria-live": "polite" }
  });
  const submit = form.createEl("button", {
    cls: "mod-cta",
    text: configured ? "解锁两小时" : "设置并解锁",
    attr: { type: "submit" }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (submit.disabled) {
      return;
    }
    error.textContent = "";
    const value = password.value;
    if (value.length < 8) {
      error.textContent = "密码至少需要 8 个字符";
      password.focus();
      return;
    }
    if (confirmation !== null && value !== confirmation.value) {
      error.textContent = "两次输入的密码不一致";
      confirmation.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = configured ? "正在解锁…" : "正在设置…";
    void (configured ? plugin.unlockPrivacy(value) : plugin.configurePrivacyPassword(value)).catch((reason) => {
      error.textContent = reason instanceof Error ? reason.message : "无法解锁心迹";
      password.select();
    }).finally(() => {
      submit.disabled = false;
      submit.textContent = configured ? "解锁两小时" : "设置并解锁";
    });
  });
  window.requestAnimationFrame(() => password.focus());
  return true;
}

// src/metrics.ts
function validScores(value) {
  if (!Array.isArray(value) || value.length === 0 || value.some(
    (item) => typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > 5
  )) {
    return null;
  }
  return value.filter((item) => typeof item === "number");
}
function validThemes(value) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  return value.filter((item) => typeof item === "string");
}
function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function metricsFromFrontmatter(frontmatter, filePath) {
  if (frontmatter["mind-trace"] !== true || typeof frontmatter.date !== "string" || parseLocalDate(frontmatter.date) === null) {
    return null;
  }
  const mood = validScores(frontmatter.mood);
  const energy = validScores(frontmatter.energy);
  const stress = validScores(frontmatter.stress);
  const themes = validThemes(frontmatter.themes);
  if (mood === null || energy === null || stress === null || themes === null || mood.length !== energy.length || energy.length !== stress.length) {
    return null;
  }
  return {
    date: frontmatter.date,
    mood: average(mood),
    energy: average(energy),
    stress: average(stress),
    sessions: mood.length,
    themes: [...new Set(themes)],
    filePath
  };
}
function collectMetrics(app) {
  const entries = [];
  let ignoredFiles = 0;
  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter?.["mind-trace"] !== true) {
      continue;
    }
    const metrics = metricsFromFrontmatter(frontmatter, file.path);
    if (metrics === null) {
      ignoredFiles += 1;
    } else {
      entries.push(metrics);
    }
  }
  entries.sort((left, right) => left.date.localeCompare(right.date));
  return { entries, ignoredFiles };
}
function filterMetrics(entries, days, now = /* @__PURE__ */ new Date()) {
  const threshold = localDateString(addLocalDays(now, -(days - 1)));
  const today = localDateString(now);
  return entries.filter(
    (entry) => entry.date >= threshold && entry.date <= today
  );
}
function calculateStreaks(entries, now = /* @__PURE__ */ new Date()) {
  const todayString = localDateString(now);
  const dateSet = new Set(
    entries.filter((entry) => entry.date <= todayString).map((entry) => entry.date)
  );
  const sortedDates = [...dateSet].sort();
  let longest = 0;
  let running = 0;
  let previous = null;
  for (const dateString of sortedDates) {
    const date = parseLocalDate(dateString);
    if (date === null) {
      continue;
    }
    if (previous !== null && localDayOrdinal(date) - localDayOrdinal(previous) === 1) {
      running += 1;
    } else {
      running = 1;
    }
    longest = Math.max(longest, running);
    previous = date;
  }
  const today = startOfLocalDay(now);
  const start = dateSet.has(localDateString(today)) || dateSet.has(localDateString(addLocalDays(today, -1))) ? dateSet.has(localDateString(today)) ? today : addLocalDays(today, -1) : null;
  let current = 0;
  if (start !== null) {
    let cursor = start;
    while (dateSet.has(localDateString(cursor))) {
      current += 1;
      cursor = addLocalDays(cursor, -1);
    }
  }
  return { current, longest };
}
function themeFrequency(entries) {
  const counts = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    for (const theme of new Set(entry.themes)) {
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([theme, days]) => ({ theme, days })).sort(
    (left, right) => right.days - left.days || left.theme.localeCompare(right.theme)
  );
}

// src/dashboard.ts
var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
function svgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}
function lineSegments(entries, key, range) {
  if (entries.length === 0) {
    return [];
  }
  const width = 560;
  const height = 170;
  const today = /* @__PURE__ */ new Date();
  const startDate = addLocalDays(today, -(range - 1));
  const points = entries.map((entry) => {
    const dateParts = entry.date.split("-").map(Number);
    const date = new Date(
      dateParts[0] ?? 0,
      (dateParts[1] ?? 1) - 1,
      dateParts[2] ?? 1
    );
    const dayOffset = localDayOrdinal(date) - localDayOrdinal(startDate);
    return {
      dayOffset,
      x: 24 + dayOffset / Math.max(range - 1, 1) * width,
      y: 14 + (5 - entry[key]) / 4 * height
    };
  });
  const segments = [];
  let current = [];
  let previousOffset = null;
  for (const point of points) {
    if (previousOffset !== null && point.dayOffset - previousOffset > 1 && current.length > 0) {
      segments.push(current.join(" "));
      current = [];
    }
    current.push(
      `${current.length === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    );
    previousOffset = point.dayOffset;
  }
  if (current.length > 0) {
    segments.push(current.join(" "));
  }
  return segments;
}
function renderLineChart(container, entries, range, onSelectRange = null, previousEntries = []) {
  const section = container.createDiv({ cls: "mind-trace-chart-section" });
  const heading = section.createDiv({
    cls: "mind-trace-chart-heading mind-trace-chart-heading-row"
  });
  const headingCopy = heading.createDiv();
  headingCopy.createDiv({
    cls: "mind-trace-chart-title",
    text: "状态趋势",
    attr: { role: "heading", "aria-level": "3" }
  });
  headingCopy.createEl("p", { text: `${range} 天内每日平均评分，空白表示当天没有记录` });
  if (onSelectRange !== null) {
    const controls = heading.createDiv({ cls: "mind-trace-range-controls" });
    for (const option of [7, 30, 90]) {
      const button = controls.createEl("button", {
        cls: `clickable-icon mind-trace-range-button${option === range ? " is-active" : ""}`,
        text: `${option} 天`,
        attr: {
          type: "button",
          "aria-pressed": String(option === range)
        }
      });
      button.addEventListener("click", () => {
        onSelectRange(option);
      });
    }
  }
  const currentStats = metricSnapshot(entries);
  const previousStats = metricSnapshot(previousEntries);
  const summary = section.createDiv({ cls: "mind-trace-trend-summary" });
  for (const [key, label] of [["mood", "\u5FC3\u60C5"], ["energy", "\u7CBE\u529B"], ["stress", "\u538B\u529B"]]) {
    const item = summary.createDiv({ cls: `mind-trace-trend-stat mind-trace-trend-stat-${key}` });
    item.createSpan({ text: label });
    item.createEl("strong", { text: currentStats[key] === null ? "\u2014" : currentStats[key].toFixed(1) });
    if (currentStats[key] !== null && previousStats[key] !== null) {
      const change = currentStats[key] - previousStats[key];
      item.createEl("small", { text: `${change >= 0 ? "+" : ""}${change.toFixed(1)}`, attr: { title: `\u8F83\u524D ${range} \u5929` } });
    }
  }
  const legend = section.createDiv({ cls: "mind-trace-legend" });
  for (const [key, label] of [
    ["mood", "心情"],
    ["energy", "精力"],
    ["stress", "压力"]
  ]) {
    const item = legend.createSpan({ cls: `mind-trace-legend-${key}` });
    item.createSpan({ cls: "mind-trace-legend-dot" });
    item.appendText(label);
  }
  const svg = svgElement("svg", {
    viewBox: "0 0 608 220",
    role: "img",
    "aria-label": `${range} 天心情、精力与压力趋势，评分范围 1 到 5`
  });
  svg.classList.add("mind-trace-line-chart");
  for (let score = 1; score <= 5; score += 1) {
    const y = 14 + (5 - score) / 4 * 170;
    svg.append(
      svgElement("line", {
        x1: "24",
        x2: "584",
        y1: String(y),
        y2: String(y),
        class: "mind-trace-grid-line"
      })
    );
    const label = svgElement("text", {
      x: "6",
      y: String(y + 4),
      class: "mind-trace-axis-label"
    });
    label.textContent = String(score);
    svg.append(label);
  }
  const trendStart = addLocalDays(new Date(), -(range - 1));
  for (let offset = 0; offset < range; offset += 7) {
    const tickDate = addLocalDays(trendStart, offset);
    const x = 24 + offset / Math.max(range - 1, 1) * 560;
    const tick = svgElement("text", {
      x: x.toFixed(1),
      y: "208",
      "text-anchor": offset === 0 ? "start" : x > 540 ? "end" : "middle",
      class: "mind-trace-axis-label"
    });
    tick.textContent = `${tickDate.getMonth() + 1}/${tickDate.getDate()}`;
    svg.append(tick);
  }
  for (const segment of lineSegments(entries, "mood", range)) {
    const firstX = /^M ([\d.]+)/.exec(segment)?.[1];
    const lastX = /([\d.]+) [\d.]+$/.exec(segment)?.[1];
    if (firstX !== void 0 && lastX !== void 0) {
      svg.append(
        svgElement("path", {
          d: `${segment} L ${lastX} 184 L ${firstX} 184 Z`,
          class: "mind-trace-area-mood"
        })
      );
    }
  }
  for (const key of ["mood", "energy", "stress"]) {
    for (const pathData of lineSegments(entries, key, range)) {
      svg.append(
        svgElement("path", {
          d: pathData,
          class: `mind-trace-series mind-trace-series-${key}`,
          fill: "none"
        })
      );
    }
    for (const entry of entries) {
      const dateParts = entry.date.split("-").map(Number);
      const date = new Date(
        dateParts[0] ?? 0,
        (dateParts[1] ?? 1) - 1,
        dateParts[2] ?? 1
      );
      const start = addLocalDays(new Date(), -(range - 1));
      const offset = localDayOrdinal(date) - localDayOrdinal(start);
      const x = 24 + offset / Math.max(range - 1, 1) * 560;
      const y = 14 + (5 - entry[key]) / 4 * 170;
      const point = svgElement("circle", {
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: "3",
        class: `mind-trace-point mind-trace-series-${key}`,
        tabindex: "0",
        role: "img",
        "aria-label": `${entry.date} ${key === "mood" ? "\u5FC3\u60C5" : key === "energy" ? "\u7CBE\u529B" : "\u538B\u529B"} ${entry[key].toFixed(1)}`
      });
      const title = svgElement("title", {});
      title.textContent = `${entry.date} ${key === "mood" ? "心情" : key === "energy" ? "精力" : "压力"} ${entry[key].toFixed(1)}`;
      point.append(title);
      svg.append(point);
    }
  }
  section.append(svg);
  return section;
}
function renderThemes(container, entries) {
  const themes = themeFrequency(entries).slice(0, 8);
  if (themes.length === 0) {
    container.createEl("p", {
      cls: "mind-trace-empty",
      text: "还没有足够的主题数据。"
    });
    return;
  }
  const max = themes[0]?.days ?? 1;
  for (const item of themes) {
    const row = container.createDiv({ cls: "mind-trace-theme-row" });
    row.createSpan({ cls: "mind-trace-theme-label", text: item.theme });
    const track = row.createDiv({
      cls: "mind-trace-theme-track",
      attr: {
        role: "img",
        "aria-label": `${item.theme}，出现 ${item.days} 天`
      }
    });
    track.createDiv({
      cls: "mind-trace-theme-bar",
      attr: {
        style: `width: ${item.days / max * 100}%`
      }
    });
    row.createSpan({ cls: "mind-trace-theme-count", text: `${item.days} 天` });
  }
}
function weekdayCounts(entries) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of entries) {
    const date = parseLocalDate(entry.date);
    if (date !== null) {
      counts[(date.getDay() + 6) % 7] += 1;
    }
  }
  return ["一", "二", "三", "四", "五", "六", "日"].map((label, index) => ({
    label,
    count: counts[index] ?? 0
  }));
}
function renderHabitBars(container, items) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const chart = container.createDiv({ cls: "mind-trace-habit-bars" });
  for (const item of items) {
    const bar = chart.createDiv({
      cls: "mind-trace-habit-bar",
      attr: { title: `${item.label}：${item.count}` }
    });
    bar.createDiv({
      cls: "mind-trace-habit-bar-fill",
      attr: {
        style: `height: ${Math.max(item.count / max * 100, item.count > 0 ? 6 : 2)}%`
      }
    });
    bar.createSpan({ cls: "mind-trace-habit-bar-label", text: item.label });
  }
}
var DashboardComponent = class {
  constructor(app, container, range, onRangeChange, onOpenEntry = null) {
    this.app = app;
    this.container = container;
    this.range = range;
    this.onRangeChange = onRangeChange;
    this.onOpenEntry = onOpenEntry;
    const now = new Date();
    this.calendarCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    this.calendarSection = null;
    this.calendarEntries = [];
    this.facetsContainer = null;
    this.timeContainer = null;
    this.compareContainer = null;
    this.wordsContainer = null;
  }
  render() {
    this.container.empty();
    this.container.addClass("mind-trace-dashboard");
    const result = collectMetrics(this.app);
    if (result.entries.length === 0) {
      const empty = this.container.createDiv({
        cls: "mind-trace-empty-state"
      });
      empty.createDiv({ cls: "mind-trace-empty-mark", text: "第一天" });
      empty.createDiv({
        cls: "mind-trace-empty-title",
        text: "趋势从一篇日记开始",
        attr: { role: "heading", "aria-level": "2" }
      });
      empty.createEl("p", {
        text: "完成第一篇心迹日记后，这里会慢慢长出状态、连续记录和主题变化。"
      });
      return;
    }
    const filtered = filterMetrics(result.entries, this.range);
    const currentStart = addLocalDays(new Date(), -(this.range - 1));
    const previousEnd = localDateString(addLocalDays(currentStart, -1));
    const previousStart = localDateString(addLocalDays(currentStart, -this.range));
    const previousFiltered = result.entries.filter((entry) => entry.date >= previousStart && entry.date <= previousEnd);
    renderLineChart(this.container, filtered, this.range, (nextRange) => {
      void this.setRange(nextRange);
    }, previousFiltered);
    const map = this.container.createDiv({ cls: "mind-trace-analysis-map" });
    this.renderCalendar(result.entries, map);
    this.renderTopicsSection(filtered, map);
    const details = this.container.createEl("details", { cls: "mind-trace-analysis-details" });
    details.createEl("summary", { text: "\u8BB0\u5F55\u4E60\u60EF\u4E0E AI \u5BF9\u7167" });
    const detailsBody = details.createDiv({ cls: "mind-trace-analysis-details-body" });
    this.renderHabits(filtered, detailsBody);
    if (result.ignoredFiles > 0) {
      this.container.createEl("p", {
        cls: "mind-trace-warning",
        text: `有 ${result.ignoredFiles} 篇心迹日记的属性格式无效，已忽略。`
      });
    }
  }
  renderOverview(entries) {
    const strip = this.container.createDiv({ cls: "mind-trace-overview" });
    const recordedDates = new Set(entries.map((entry) => entry.date));
    const fileByDate = new Map();
    for (const entry of entries) {
      if (!fileByDate.has(entry.date)) {
        fileByDate.set(entry.date, entry.filePath);
      }
    }
    const streaks = calculateStreaks(entries);
    const totalSessions = entries.reduce((sum, entry) => sum + entry.sessions, 0);
    const moodAverage = average(entries.map((entry) => entry.mood));
    const addItem = (label, value) => {
      const item = strip.createDiv({ cls: "mind-trace-overview-item" });
      item.createSpan({ cls: "mind-trace-overview-label", text: label });
      item.createSpan({ cls: "mind-trace-overview-value", text: value });
      return item;
    };
    addItem("记录天数", `${recordedDates.size} 天`);
    addItem("总篇数", `${totalSessions} 篇`);
    const streakItem = addItem("当前连续", `${streaks.current} 天`);
    const today = startOfLocalDay(new Date());
    const dots = streakItem.createDiv({
      cls: "mind-trace-streak-dots",
      attr: {
        role: "img",
        "aria-label": `最近 14 天的记录情况，当前连续 ${streaks.current} 天`
      }
    });
    for (let offset = 13; offset >= 0; offset -= 1) {
      const day = addLocalDays(today, -offset);
      const dateString = localDateString(day);
      const recorded = recordedDates.has(dateString);
      const filePath = recorded ? fileByDate.get(dateString) : void 0;
      const openable = filePath !== void 0 && this.onOpenEntry !== null;
      const dot = dots.createSpan({
        cls: `mind-trace-streak-dot${recorded ? " is-recorded" : ""}${openable ? " is-openable" : ""}`,
        attr: openable ? {
          title: `${dateString} 有记录`,
          role: "button",
          tabindex: "0",
          "aria-label": `打开 ${dateString} 的日记`
        } : { title: recorded ? `${dateString} 有记录` : dateString }
      });
      if (openable) {
        const open = () => this.onOpenEntry(filePath);
        dot.addEventListener("click", open);
        dot.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        });
      }
    }
    addItem("最长连续", `${streaks.longest} 天`);
    addItem("平均心情", moodAverage.toFixed(1));
  }
  renderCalendar(entries, container = this.container) {
    this.calendarEntries = entries;
    this.calendarSection = container.createDiv({ cls: "mind-trace-chart-section mind-trace-calendar-section" });
    this.renderCalendarContent();
  }
  renderCalendarContent() {
    const section = this.calendarSection;
    if (section === null) {
      return;
    }
    section.empty();
    const heading = section.createDiv({
      cls: "mind-trace-chart-heading mind-trace-chart-heading-row"
    });
    heading.createDiv({
      cls: "mind-trace-chart-title",
      text: "心情日历",
      attr: { role: "heading", "aria-level": "3" }
    });
    const nav = heading.createDiv({ cls: "mind-trace-cal-nav" });
    const previous = nav.createEl("button", {
      cls: "clickable-icon mind-trace-cal-nav-button",
      text: "‹",
      attr: { type: "button", "aria-label": "上一个月" }
    });
    nav.createSpan({
      cls: "mind-trace-cal-month",
      text: `${this.calendarCursor.getFullYear()}年${this.calendarCursor.getMonth() + 1}月`
    });
    const next = nav.createEl("button", {
      cls: "clickable-icon mind-trace-cal-nav-button",
      text: "›",
      attr: { type: "button", "aria-label": "下一个月" }
    });
    previous.addEventListener("click", () => {
      this.shiftCalendar(-1);
    });
    next.addEventListener("click", () => {
      this.shiftCalendar(1);
    });
    const moodByDate = new Map();
    const fileByDate = new Map();
    for (const entry of this.calendarEntries) {
      if (!moodByDate.has(entry.date)) {
        moodByDate.set(entry.date, entry.mood);
        fileByDate.set(entry.date, entry.filePath);
      }
    }
    const grid = section.createDiv({ cls: "mind-trace-cal-grid" });
    for (const label of ["一", "二", "三", "四", "五", "六", "日"]) {
      grid.createSpan({ cls: "mind-trace-cal-weekday", text: label });
    }
    const year = this.calendarCursor.getFullYear();
    const month = this.calendarCursor.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayString = localDateString(new Date());
    for (let blank = 0; blank < firstWeekday; blank += 1) {
      grid.createSpan({
        cls: "mind-trace-cal-cell is-blank",
        attr: { "aria-hidden": "true" }
      });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateString = localDateString(new Date(year, month, day));
      const mood = moodByDate.get(dateString);
      const filePath = fileByDate.get(dateString);
      const openable = filePath !== void 0 && this.onOpenEntry !== null;
      const classes = ["mind-trace-cal-cell"];
      if (mood !== void 0) {
        classes.push(`mind-trace-cal-day-${Math.min(5, Math.max(1, Math.round(mood)))}`);
      }
      if (dateString === todayString) {
        classes.push("is-today");
      }
      if (openable) {
        classes.push("is-openable");
      }
      const cell = grid.createSpan({
        cls: classes.join(" "),
        text: String(day),
        attr: openable ? {
          role: "button",
          tabindex: "0",
          "aria-label": `打开 ${dateString} 的日记`,
          title: `${dateString} 心情 ${mood.toFixed(1)}`
        } : { title: mood !== void 0 ? `${dateString} 心情 ${mood.toFixed(1)}` : dateString }
      });
      if (openable) {
        const open = () => this.onOpenEntry(filePath);
        cell.addEventListener("click", open);
        cell.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        });
      }
    }
  }
  shiftCalendar(offset) {
    this.calendarCursor = new Date(
      this.calendarCursor.getFullYear(),
      this.calendarCursor.getMonth() + offset,
      1
    );
    this.renderCalendarContent();
  }
  renderTopicsSection(filtered, container = this.container) {
    const section = container.createDiv({ cls: "mind-trace-chart-section mind-trace-topics-section" });
    const heading = section.createDiv({ cls: "mind-trace-chart-heading" });
    heading.createDiv({
      cls: "mind-trace-chart-title",
      text: "主题与切片",
      attr: { role: "heading", "aria-level": "3" }
    });
    heading.createEl("p", { text: "主题按出现天数统计，切片类别来自日记正文解析。" });
    const cols = section.createDiv({ cls: "mind-trace-two-col" });
    const themesCol = cols.createDiv();
    themesCol.createDiv({ cls: "mind-trace-col-label", text: "主题" });
    renderThemes(themesCol, filtered);
    this.facetsContainer = cols.createDiv();
    this.facetsContainer.createEl("p", {
      cls: "mind-trace-empty",
      text: "正在解析日记切片…"
    });
  }
  renderHabits(filtered, container = this.container) {
    const section = container.createDiv({ cls: "mind-trace-chart-section mind-trace-habits-section" });
    const heading = section.createDiv({ cls: "mind-trace-chart-heading" });
    heading.createDiv({
      cls: "mind-trace-chart-title",
      text: "记录习惯",
      attr: { role: "heading", "aria-level": "3" }
    });
    heading.createEl("p", { text: "星期分布按日期统计，时段与对照来自日记正文解析。" });
    const grid = section.createDiv({ cls: "mind-trace-habits-grid" });
    const weekdayCol = grid.createDiv({ cls: "mind-trace-habit" });
    weekdayCol.createDiv({ cls: "mind-trace-habit-title", text: "星期分布" });
    renderHabitBars(weekdayCol, weekdayCounts(filtered));
    this.timeContainer = grid.createDiv({ cls: "mind-trace-habit" });
    this.timeContainer.createEl("p", {
      cls: "mind-trace-empty",
      text: "正在解析记录时段…"
    });
    this.compareContainer = grid.createDiv({ cls: "mind-trace-habit" });
    this.compareContainer.createEl("p", {
      cls: "mind-trace-empty",
      text: "正在解析自评与 AI 对照…"
    });
    this.wordsContainer = section.createEl("p", { cls: "mind-trace-habit-words" });
  }
  renderInsights(insights) {
    if (this.facetsContainer !== null && this.facetsContainer.isConnected) {
      this.facetsContainer.empty();
      this.facetsContainer.createDiv({ cls: "mind-trace-col-label", text: "切片类别" });
      if (insights.facets.length === 0) {
        this.facetsContainer.createEl("p", {
          cls: "mind-trace-empty",
          text: "还没有解析到切片。"
        });
      } else {
        const max = insights.facets[0]?.count ?? 1;
        for (const facet of insights.facets) {
          const row = this.facetsContainer.createDiv({ cls: "mind-trace-theme-row" });
          row.createSpan({ cls: "mind-trace-theme-label", text: facet.category });
          const track = row.createDiv({
            cls: "mind-trace-theme-track",
            attr: {
              role: "img",
              "aria-label": `${facet.category}，出现 ${facet.count} 次`
            }
          });
          track.createDiv({
            cls: "mind-trace-theme-bar",
            attr: {
              style: `width: ${facet.count / max * 100}%`
            }
          });
          row.createSpan({ cls: "mind-trace-theme-count", text: `${facet.count} 次` });
        }
      }
    }
    if (this.timeContainer !== null && this.timeContainer.isConnected) {
      this.timeContainer.empty();
      this.timeContainer.createDiv({ cls: "mind-trace-habit-title", text: "时段分布" });
      if (insights.sessionCount === 0) {
        this.timeContainer.createEl("p", {
          cls: "mind-trace-empty",
          text: "没有可解析的记录。"
        });
      } else {
        renderHabitBars(this.timeContainer, insights.timeBuckets);
      }
    }
    if (this.compareContainer !== null && this.compareContainer.isConnected) {
      this.compareContainer.empty();
      if (insights.aiSamples < 3) {
        this.compareContainer.remove();
        this.compareContainer = null;
      } else {
        this.compareContainer.createDiv({ cls: "mind-trace-habit-title", text: "自评 vs AI" });
        for (const item of insights.compare) {
          const row = this.compareContainer.createDiv({ cls: "mind-trace-compare-row" });
          row.createSpan({ cls: "mind-trace-compare-label", text: item.label });
          const tracks = row.createDiv({ cls: "mind-trace-compare-tracks" });
          const selfTrack = tracks.createDiv({ cls: "mind-trace-compare-track" });
          selfTrack.createDiv({
            cls: `mind-trace-compare-fill mind-trace-compare-self-${item.key}`,
            attr: { style: `width: ${item.self / 5 * 100}%` }
          });
          const aiTrack = tracks.createDiv({ cls: "mind-trace-compare-track" });
          aiTrack.createDiv({
            cls: "mind-trace-compare-fill mind-trace-compare-ai",
            attr: { style: `width: ${item.ai / 5 * 100}%` }
          });
          row.createSpan({
            cls: "mind-trace-compare-value",
            text: `${item.self.toFixed(1)}/${item.ai.toFixed(1)}`
          });
        }
        this.compareContainer.createEl("p", {
          cls: "mind-trace-compare-note",
          text: "每行上条为自评，下条为 AI 盲评，满分 5。"
        });
      }
    }
    if (this.wordsContainer !== null && this.wordsContainer.isConnected) {
      const skippedNote = insights.skipped > 0 ? `；${insights.skipped} 篇解析失败已跳过` : "";
      this.wordsContainer.textContent = insights.sessionCount > 0 ? `本范围 ${insights.sessionCount} 篇记录共 ${insights.totalWords} 字，篇均 ${insights.avgWords} 字${skippedNote}。` : "";
    }
  }
  async setRange(range) {
    if (range === this.range) {
      return;
    }
    this.range = range;
    await this.onRangeChange(range);
    this.render();
  }
};

// src/defaults.ts
var CORE_QUESTIONS = [
  "\u628A\u4ECA\u5929\u4ECE\u65E9\u5230\u665A\u626B\u4E00\u904D\uFF0C\u4F60\u8BB0\u5F97\u54EA\u4E9B\u7247\u6BB5\uFF1F",
  "\u8FD9\u4E9B\u7247\u6BB5\u91CC\uFF0C\u4EC0\u4E48\u8BA9\u4F60\u6709\u611F\u89C9\uFF1F\u4E3A\u4EC0\u4E48\uFF1F",
  "\u4ECA\u5929\u8FD8\u6709\u4EC0\u4E48\u6CA1\u6536\u5C3E\u3001\u6CA1\u8BF4\u5B8C\uFF0C\u6216\u60F3\u5E26\u5230\u660E\u5929\uFF1F"
];
var DEFAULT_ADAPTIVE_QUESTION_LIMIT = 2;
var DEFAULT_SETTINGS = {
  activeProvider: "openai",
  providers: {
    openai: {
      model: "gpt-5-mini",
      credentialSource: "environment",
      environmentVariable: "OPENAI_API_KEY",
      secretId: ""
    },
    anthropic: {
      model: "claude-sonnet-4-5",
      credentialSource: "environment",
      environmentVariable: "ANTHROPIC_API_KEY",
      secretId: ""
    },
    gemini: {
      model: "gemini-2.5-flash",
      credentialSource: "environment",
      environmentVariable: "GEMINI_API_KEY",
      secretId: ""
    },
    "openai-compatible": {
      model: "",
      credentialSource: "none",
      environmentVariable: "OPENAI_API_KEY",
      secretId: "",
      baseUrl: "http://localhost:11434/v1"
    }
  },
  coreQuestions: [...CORE_QUESTIONS],
  adaptiveQuestionLimit: DEFAULT_ADAPTIVE_QUESTION_LIMIT,
  questionLayout: "cards",
  journalFolder: "\u5FC3\u8FF9\u65E5\u8BB0",
  historyDays: 7,
  reflectionTone: "gentle",
  customInstructions: "",
  dashboardRange: 30,
  weeklyReportAutoGenerate: true,
  weeklyReportMinimumDays: 3,
  security: {
    version: 1,
    salt: "",
    verifier: "",
    iterations: PASSWORD_KDF_ITERATIONS
  }
};
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
function configuredQuestionLayout(settings) {
  return settings.questionLayout === "timeline" ? "timeline" : "cards";
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

// src/providers.ts
var import_obsidian2 = require("obsidian");
function requireRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} \u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u6570\u636E\u683C\u5F0F`);
  }
  return value;
}
function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} \u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u6570\u636E\u683C\u5F0F`);
  }
  return value;
}
function requireString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} \u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u6570\u636E\u683C\u5F0F`);
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
function buildProviderRequest(kind, settings, secret, messages) {
  const configuration = settings[kind];
  if (configuration.model.trim().length === 0) {
    throw new Error("\u8BF7\u5148\u5728\u5FC3\u8FF9\u8BBE\u7F6E\u4E2D\u586B\u5199\u6A21\u578B\u540D\u79F0");
  }
  if (kind !== "openai-compatible" && secret.length === 0) {
    throw new Error("\u8BF7\u5148\u5728\u5FC3\u8FF9\u8BBE\u7F6E\u4E2D\u9009\u62E9 API Key");
  }
  switch (kind) {
    case "openai":
      return {
        url: "https://api.openai.com/v1/responses",
        headers: authorizationHeaders(secret),
        body: {
          model: configuration.model,
          input: messages
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
          ...systemText.length > 0 ? {
            systemInstruction: {
              parts: [{ text: systemText }]
            }
          } : {}
        }
      };
    }
    case "openai-compatible": {
      const compatible = settings["openai-compatible"];
      if (compatible.baseUrl.trim().length === 0) {
        throw new Error("\u8BF7\u5148\u5728\u5FC3\u8FF9\u8BBE\u7F6E\u4E2D\u586B\u5199 Base URL");
      }
      return {
        url: joinUrl(compatible.baseUrl, "chat/completions"),
        headers: authorizationHeaders(secret),
        body: {
          model: compatible.model,
          messages
        }
      };
    }
  }
}
function parseProviderResponse(kind, payload) {
  const root = requireRecord(payload, kind);
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
        throw new Error("OpenAI \u672A\u8FD4\u56DE\u6587\u672C\u5185\u5BB9");
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
        throw new Error("Anthropic \u672A\u8FD4\u56DE\u6587\u672C\u5185\u5BB9");
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
        throw new Error("Gemini \u672A\u8FD4\u56DE\u6587\u672C\u5185\u5BB9");
      }
      return texts.join("");
    }
    case "openai-compatible": {
      const choices = requireArray(root.choices, "OpenAI-compatible");
      const choice = requireRecord(choices[0], "OpenAI-compatible");
      const message = requireRecord(choice.message, "OpenAI-compatible");
      return requireString(message.content, "OpenAI-compatible");
    }
  }
}
function statusError(status, response) {
  if (status === 401 || status === 403) {
    return new Error("\u6A21\u578B\u670D\u52A1\u62D2\u7EDD\u4E86\u9274\u6743\uFF0C\u8BF7\u68C0\u67E5 API Key");
  }
  if (status === 429) {
    return new Error("\u6A21\u578B\u670D\u52A1\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\u6216\u989D\u5EA6\u4E0D\u8DB3\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
  }
  if (status >= 500) {
    return new Error("\u6A21\u578B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
  }
  let detail = response.text.trim();
  if (detail.length > 240) {
    detail = `${detail.slice(0, 240)}\u2026`;
  }
  return new Error(
    detail.length > 0 ? `\u6A21\u578B\u8BF7\u6C42\u5931\u8D25\uFF08${status}\uFF09\uFF1A${detail}` : `\u6A21\u578B\u8BF7\u6C42\u5931\u8D25\uFF08${status}\uFF09`
  );
}
var HttpLlmProvider = class {
  constructor(kind, settings, secret) {
    this.kind = kind;
    this.settings = settings;
    this.secret = secret;
  }
  async generate(messages) {
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
    let response;
    try {
      const result = await (0, import_obsidian2.requestUrl)(request);
      response = {
        status: result.status,
        json: result.json,
        text: result.text
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`\u65E0\u6CD5\u8FDE\u63A5\u6A21\u578B\u670D\u52A1\uFF1A${message}`);
    }
    if (response.status < 200 || response.status >= 300) {
      throw statusError(response.status, response);
    }
    return parseProviderResponse(this.kind, response.json);
  }
};

// src/journal-view.ts
var import_obsidian4 = require("obsidian");

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
  gentle: "\u8BED\u6C14\u6E29\u548C\u4F46\u5177\u4F53\uFF1A\u5148\u627F\u8BA4\u611F\u53D7\uFF0C\u518D\u6307\u51FA\u53EF\u80FD\u7684\u6A21\u5F0F\u5E76\u7ED9\u51FA\u53EF\u6267\u884C\u5EFA\u8BAE\u3002",
  direct: "\u4F7F\u7528\u76F4\u63A5\u7684\u6559\u7EC3\u5F0F\u8BED\u6C14\uFF1A\u6E05\u695A\u6307\u51FA\u76F2\u70B9\u3001\u8D23\u4EFB\u548C\u4E0B\u4E00\u6B65\uFF0C\u4F46\u4E0D\u8981\u7F9E\u8FB1\u6216\u6B66\u65AD\u3002",
  companion: "\u4F7F\u7528\u966A\u4F34\u5F0F\u8BED\u6C14\uFF1A\u4EE5\u5171\u60C5\u548C\u5F00\u653E\u95EE\u9898\u4E3A\u4E3B\uFF0C\u51CF\u5C11\u547D\u4EE4\u5F0F\u5EFA\u8BAE\u3002"
};
var SAFETY_INSTRUCTION = "\u4E0D\u8981\u8FDB\u884C\u5FC3\u7406\u6216\u533B\u5B66\u8BCA\u65AD\uFF0C\u4E0D\u8981\u628A\u63A8\u6D4B\u8868\u8FBE\u6210\u4E8B\u5B9E\uFF0C\u4E0D\u63D0\u4F9B\u9AD8\u98CE\u9669\u533B\u7597\u5EFA\u8BAE\u3002\u5982\u679C\u5185\u5BB9\u663E\u793A\u7528\u6237\u53EF\u80FD\u5904\u4E8E\u4E25\u91CD\u5371\u9669\u4E2D\uFF0C\u505C\u6B62\u4E00\u822C\u6210\u957F\u5EFA\u8BAE\uFF0C\u9F13\u52B1\u7528\u6237\u5C3D\u5FEB\u8054\u7CFB\u53EF\u4FE1\u4EFB\u7684\u4EBA\u6216\u4E13\u4E1A\u652F\u6301\u3002";
function answersText(draft) {
  return draft.answers.map(
    (answer, index) => `${index + 1}. \u95EE\uFF1A${answer.question}
\u7B54\uFF1A${answer.answer}`
  ).join("\n\n");
}
function ratingsText(draft) {
  const { mood, energy, stress } = draft.ratings;
  return `\u5FC3\u60C5 ${mood}/5\uFF0C\u7CBE\u529B ${energy}/5\uFF0C\u538B\u529B ${stress}/5`;
}
function buildFollowUpMessages(draft) {
  return [
    {
      role: "system",
      content: [
        "\u4F60\u662F\u4E00\u4E2A\u5E2E\u52A9\u7528\u6237\u5B8C\u6210\u77ED\u65E5\u8BB0\u7684\u63D0\u95EE\u8005\u3002",
        "\u7528\u6237\u7684\u65E5\u8BB0\u53EF\u4EE5\u540C\u65F6\u5305\u542B\u591A\u4E2A\u4EBA\u7269\u3001\u5DE5\u4F5C\u8FDB\u5C55\u3001\u751F\u6D3B\u5C0F\u4E8B\u3001\u60C5\u7EEA\u53D8\u5316\u548C\u672A\u89E3\u51B3\u7684\u95EE\u9898\uFF0C\u4E0D\u8981\u5F3A\u884C\u628A\u4E00\u5929\u6536\u7A84\u6210\u4E00\u4EF6\u4E8B\u3002",
        "\u5148\u68C0\u67E5\u5DF2\u6709\u56DE\u7B54\u662F\u5426\u7F3A\u5C11\u80FD\u8BA9\u65E5\u8BB0\u66F4\u5B8C\u6574\u7684\u5177\u4F53\u4FE1\u606F\uFF0C\u4F8B\u5982\u4EBA\u7269\u5173\u7CFB\u3001\u573A\u666F\u7EC6\u8282\u3001\u60C5\u7EEA\u6765\u6E90\u3001\u751F\u6D3B\u8D28\u611F\u6216\u60AC\u800C\u672A\u51B3\u7684\u7EBF\u7D22\u3002",
        "\u9700\u8981\u8865\u5145\u65F6\uFF0C\u53EA\u9009\u62E9\u4FE1\u606F\u4EF7\u503C\u6700\u9AD8\u7684\u4E00\u5904\uFF0C\u63D0\u51FA\u4E00\u4E2A\u7B80\u77ED\u3001\u5177\u4F53\u3001\u4E00\u6B21\u53EA\u95EE\u4E00\u4EF6\u4E8B\u4E14\u4E0D\u91CD\u590D\u5DF2\u6709\u95EE\u9898\u7684\u4E2D\u6587\u8FFD\u95EE\u3002",
        "\u5982\u679C\u4FE1\u606F\u5DF2\u7ECF\u8DB3\u591F\u751F\u6210\u6709\u610F\u4E49\u7684\u65E5\u8BB0\uFF0C\u5C06 continue \u8BBE\u4E3A false\uFF1B\u5426\u5219\u8BBE\u4E3A true\u3002",
        SAFETY_INSTRUCTION,
        '\u53EA\u8F93\u51FA JSON\uFF1A{"question":"...","continue":true}'
      ].join("\n")
    },
    {
      role: "user",
      content: `\u8BB0\u5F55\u5F52\u5C5E\u65E5\u671F\uFF1A${draftEntryDate(draft)}

\u4ECA\u65E5\u81EA\u8BC4\uFF1A${ratingsText(draft)}

\u5DF2\u6709\u95EE\u7B54\uFF1A
${answersText(draft)}`
    }
  ];
}
function buildJournalMessages(draft, history, tone, customInstructions) {
  const historySection = history.length > 0 ? `

\u8FD1\u671F\u65E5\u8BB0\u6458\u5F55\uFF08\u53EA\u7528\u4E8E\u53D1\u73B0\u6E29\u548C\u3001\u975E\u7EDD\u5BF9\u5316\u7684\u6A21\u5F0F\uFF09\uFF1A
${history}` : "";
  const customSection = customInstructions.trim().length > 0 ? `
\u7528\u6237\u7684\u4E2A\u4EBA\u504F\u597D\uFF1A${customInstructions.trim()}` : "";
  return [
    {
      role: "system",
      content: [
        "\u4F60\u662F\u4E00\u4F4D\u4E2D\u6587\u65E5\u8BB0\u6574\u7406\u4E0E\u4E2A\u4EBA\u6210\u957F\u53CD\u601D\u52A9\u624B\u3002",
        "\u5FE0\u5B9E\u4FDD\u7559\u7528\u6237\u4E8B\u5B9E\u548C\u60C5\u7EEA\uFF0C\u4E0D\u865A\u6784\u7EC6\u8282\uFF0C\u4E0D\u628A\u65E5\u8BB0\u5199\u6210\u9E21\u6C64\u3002",
        "\u65E5\u8BB0\u6B63\u6587\u8981\u5BB9\u7EB3\u5F53\u5929\u51FA\u73B0\u7684\u591A\u4E2A\u7247\u6BB5\uFF0C\u4E0D\u8981\u5F3A\u884C\u5F52\u7EB3\u6210\u5355\u4E00\u4E8B\u4EF6\u3001\u5355\u4E00\u60C5\u7EEA\u6216\u5355\u4E00\u6210\u957F\u4E3B\u9898\u3002",
        "\u4F18\u5148\u4FDD\u7559\u7528\u6237\u539F\u672C\u7684\u53E3\u543B\u3001\u4EBA\u7269\u79F0\u547C\u3001\u5177\u4F53\u7269\u4EF6\u3001\u6280\u672F\u540D\u8BCD\u3001\u611F\u5B98\u7EC6\u8282\u548C\u5E26\u60C5\u7EEA\u7684\u77ED\u53E5\uFF1B\u4E0D\u8981\u628A\u9C9C\u6D3B\u7EC6\u8282\u5168\u90E8\u6539\u5199\u6210\u62BD\u8C61\u603B\u7ED3\u3002",
        "\u7247\u6BB5\u6709\u81EA\u7136\u65F6\u95F4\u987A\u5E8F\u65F6\u6309\u65F6\u95F4\u63A8\u8FDB\uFF0C\u5426\u5219\u7528\u8F7B\u5FAE\u8FC7\u6E21\u8FDE\u63A5\uFF1B\u4E0D\u540C\u7247\u6BB5\u4E4B\u95F4\u5141\u8BB8\u4FDD\u7559\u60C5\u7EEA\u53CD\u5DEE\u3002",
        "\u6B63\u6587\u901A\u5E38\u5199\u6210 250\u2013600 \u4E2A\u4E2D\u6587\u5B57\u7B26\uFF1B\u4FE1\u606F\u8F83\u5C11\u65F6\u5FE0\u5B9E\u7B80\u5199\uFF0C\u4E0D\u4E3A\u51D1\u957F\u5EA6\u6DFB\u52A0\u5185\u5BB9\u3002",
        "\u4ECE\u5F53\u5929\u5B9E\u9645\u5185\u5BB9\u4E2D\u52A8\u6001\u63D0\u53D6 2\u20136 \u4E2A\u4E92\u4E0D\u91CD\u590D\u7684\u667A\u80FD\u5207\u7247\uFF0C\u6BCF\u4E2A\u5207\u7247\u5305\u542B\u4E00\u4E2A\u7B80\u77ED\u7C7B\u522B\u548C\u4E00\u53E5\u4E8B\u5B9E\u6027\u603B\u7ED3\uFF1B\u4F8B\u5982\u5DE5\u4F5C\u3001\u4EBA\u9645\u3001\u751F\u6D3B\u3001\u60C5\u7EEA\u3001\u5B66\u4E60\u6216\u672A\u89E3\u51B3\uFF0C\u4F46\u4E0D\u8981\u8F93\u51FA\u6CA1\u6709\u5185\u5BB9\u7684\u7C7B\u522B\u3002",
        "\u5207\u7247\u603B\u7ED3\u56DE\u7B54\u8BE5\u7EF4\u5EA6\u4ECA\u5929\u5177\u4F53\u53D1\u751F\u4E86\u4EC0\u4E48\uFF0C\u4E0D\u5199\u5EFA\u8BAE\uFF0C\u4E0D\u91CD\u590D\u7A7A\u6CDB\u8BC4\u4EF7\u3002",
        "\u65E5\u8BB0\u6B63\u6587\u4F7F\u7528\u81EA\u7136\u7684\u7B2C\u4E00\u4EBA\u79F0\uFF1B\u6D1E\u5BDF\u6839\u636E\u5F53\u5929\u4FE1\u606F\u91CF\u52A8\u6001\u7ED9\u51FA 2\u20134 \u6761\uFF0C\u4E0D\u4E3A\u51D1\u6570\u91CD\u590D\u540C\u4E00\u89C2\u5BDF\uFF1B\u5FAE\u884C\u52A8\u5FC5\u987B\u5C0F\u800C\u5177\u4F53\uFF1B\u4E3B\u9898\u4E3A 1\u20135 \u4E2A\u7B80\u77ED\u4E2D\u6587\u540D\u8BCD\u3002",
        "\u53CD\u601D\u6D1E\u5BDF\u4E0E\u6B63\u6587\u5206\u5F00\uFF1A\u4E0D\u8981\u628A\u6A21\u578B\u63A8\u6D4B\u6DF7\u5165\u65E5\u8BB0\u4E8B\u5B9E\u3002\u5FAE\u884C\u52A8\u4F18\u5148\u56DE\u5E94\u7528\u6237\u5C1A\u672A\u6536\u5C3E\u7684\u4E8B\u9879\u6216\u7591\u95EE\uFF0C\u907F\u514D\u6CDB\u6CDB\u5EFA\u8BAE\u3002",
        TONE_INSTRUCTIONS[tone],
        customSection,
        SAFETY_INSTRUCTION,
        '\u53EA\u8F93\u51FA JSON\uFF1A{"diary":"...","facets":[{"category":"\u5DE5\u4F5C","summary":"..."},{"category":"\u751F\u6D3B","summary":"..."}],"insights":["..."],"microAction":"...","selfQuestion":"...","themes":["..."]}'
      ].join("\n")
    },
    {
      role: "user",
      content: `\u8BB0\u5F55\u5F52\u5C5E\u65E5\u671F\uFF1A${draftEntryDate(draft)}

\u4ECA\u65E5\u81EA\u8BC4\uFF1A${ratingsText(draft)}

\u672C\u6B21\u95EE\u7B54\uFF1A
${answersText(draft)}${historySection}`
    }
  ];
}
function buildRatingMessages(draft) {
  return [
    {
      role: "system",
      content: [
        "\u4F60\u662F\u4E00\u4F4D\u8C28\u614E\u7684\u4E2D\u6587\u65E5\u8BB0\u72B6\u6001\u89C2\u5BDF\u8005\u3002",
        "\u53EA\u6839\u636E\u7528\u6237\u5728\u672C\u6B21\u95EE\u7B54\u4E2D\u4F7F\u7528\u7684\u8BED\u8A00\u548C\u63CF\u8FF0\uFF0C\u72EC\u7ACB\u4F30\u8BA1\u5FC3\u60C5\u3001\u7CBE\u529B\u548C\u538B\u529B\uFF1B\u4F60\u770B\u4E0D\u5230\u7528\u6237\u7684\u81EA\u8BC4\u5206\u6570\uFF0C\u4E5F\u4E0D\u8981\u5047\u8BBE\u54EA\u4E00\u65B9\u66F4\u6B63\u786E\u3002",
        "\u8BC4\u5206\u5747\u4E3A 1\u20135 \u7684\u6574\u6570\uFF1A\u5FC3\u60C5 1 \u8868\u793A\u660E\u663E\u4F4E\u843D\u30013 \u8868\u793A\u5E73\u7A33\u30015 \u8868\u793A\u660E\u4EAE\uFF1B\u7CBE\u529B 1 \u8868\u793A\u8017\u5C3D\u30013 \u8868\u793A\u5C1A\u53EF\u30015 \u8868\u793A\u5145\u6C9B\uFF1B\u538B\u529B 1 \u8868\u793A\u677E\u5F1B\u30013 \u8868\u793A\u9002\u4E2D\u30015 \u8868\u793A\u7D27\u7EF7\u3002",
        "\u6BCF\u9879\u7528\u4E00\u53E5\u7B80\u77ED\u4E2D\u6587\u8BF4\u660E\u6587\u672C\u4F9D\u636E\u3002\u8BC1\u636E\u4E0D\u8DB3\u65F6\u9009\u62E9 3\uFF0C\u5E76\u660E\u786E\u8BF4\u660E\u4FE1\u606F\u6709\u9650\uFF0C\u4E0D\u8981\u865A\u6784\u3002",
        "\u8FD9\u53EA\u662F\u5BF9\u6587\u5B57\u5448\u73B0\u51FA\u7684\u72B6\u6001\u8FDB\u884C\u89C2\u5BDF\uFF0C\u4E0D\u8FDB\u884C\u5FC3\u7406\u6216\u533B\u5B66\u8BCA\u65AD\uFF0C\u4E0D\u5224\u65AD\u7528\u6237\u662F\u5426\u586B\u9519\u3002",
        '\u53EA\u8F93\u51FA JSON\uFF1A{"mood":{"score":3,"reason":"..."},"energy":{"score":3,"reason":"..."},"stress":{"score":3,"reason":"..."}}'
      ].join("\n")
    },
    {
      role: "user",
      content: `\u672C\u6B21\u5B8C\u6574\u95EE\u7B54\uFF1A
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
  const score = (value) => value === null ? "\u65E0\u6570\u636E" : value.toFixed(1);
  const delta = (key) => current[key] === null || previous[key] === null ? "\u65E0\u6CD5\u5BF9\u6BD4" : `${current[key] - previous[key] >= 0 ? "+" : ""}${(current[key] - previous[key]).toFixed(1)}`;
  return [
    `\u8BB0\u5F55 ${current.days} \u5929\u3001${current.sessions} \u7BC7`,
    `\u5FC3\u60C5 ${score(current.mood)}\uFF08\u8F83\u524D\u4E00\u5468 ${delta("mood")}\uFF09`,
    `\u7CBE\u529B ${score(current.energy)}\uFF08\u8F83\u524D\u4E00\u5468 ${delta("energy")}\uFF09`,
    `\u538B\u529B ${score(current.stress)}\uFF08\u8F83\u524D\u4E00\u5468 ${delta("stress")}\uFF09`,
    `\u5E38\u89C1\u4E3B\u9898\uFF1A${current.themes.length > 0 ? current.themes.map((item) => `${item.theme}\uFF08${item.days}\u5929\uFF09`).join("\u3001") : "\u65E0"}`
  ].join("\n");
}
function buildWeeklyReportMessages(source, settings) {
  const custom = settings.customInstructions.trim().length > 0 ? `\n\u7528\u6237\u8868\u8FBE\u504F\u597D\uFF1A${settings.customInstructions.trim()}` : "";
  return [
    {
      role: "system",
      content: [
        "\u4F60\u662F\u4E00\u4F4D\u8C28\u614E\u3001\u5177\u4F53\u7684\u4E2D\u6587\u4E2A\u4EBA\u5468\u62A5\u5206\u6790\u52A9\u624B\u3002",
        "\u53EA\u4F7F\u7528\u7ED9\u5B9A\u7684\u65E5\u8BB0\u548C\u672C\u5730\u7EDF\u8BA1\uFF1B\u4E0D\u865A\u6784\u6570\u5B57\u3001\u65E5\u671F\u3001\u539F\u56E0\u6216\u5B8C\u6210\u60C5\u51B5\u3002",
        "\u5148\u603B\u7ED3\u72B6\u6001\u53D8\u5316\uFF0C\u518D\u7ED9\u51FA\u6709\u8BC1\u636E\u7684\u53EF\u80FD\u539F\u56E0\uFF0C\u6700\u540E\u63D0\u51FA\u4E00\u4E2A\u53EF\u5728\u4E0B\u5468\u5B8C\u6210\u7684\u5C0F\u884C\u52A8\u3002",
        "\u60C5\u7EEA\u89E3\u8BFB\u5FC5\u987B\u662F\u5047\u8BBE\u6027\u7684\uFF0C\u540C\u65F6\u7ED9\u51FA\u652F\u6301\u7EBF\u7D22\u548C\u53E6\u4E00\u79CD\u53EF\u80FD\u89E3\u91CA\uFF0C\u4E0D\u8FDB\u884C\u5FC3\u7406\u6216\u533B\u5B66\u8BCA\u65AD\u3002",
        "evidenceDates \u53EA\u80FD\u4F7F\u7528\u8F93\u5165\u4E2D\u51FA\u73B0\u4E14\u4F4D\u4E8E\u672C\u5468\u7684 YYYY-MM-DD \u65E5\u671F\u3002",
        TONE_INSTRUCTIONS[settings.reflectionTone],
        custom,
        SAFETY_INSTRUCTION,
        '\u53EA\u8F93\u51FA JSON\uFF1A{"summary":"...","changes":[{"observation":"...","evidenceDates":["YYYY-MM-DD"]}],"possibleCauses":[{"hypothesis":"...","evidenceDates":["YYYY-MM-DD"]}],"emotionReading":{"hypothesis":"...","clues":["..."],"alternative":"..."},"themes":[{"name":"...","observation":"..."}],"nextStep":{"action":"...","reason":"..."},"selfQuestion":"..."}'
      ].join("\n")
    },
    {
      role: "user",
      content: `\u62A5\u544A\u5468\u671F\uFF1A${source.period.start} \u81F3 ${source.period.end}\n\n\u672C\u5730\u786E\u5B9A\u6027\u7EDF\u8BA1\uFF1A\n${weeklyStatsText(source.stats, source.previousStats)}\n\n\u65E5\u8BB0\u6458\u5F55\uFF1A\n${source.excerpts}${source.truncated ? "\n\n\u6CE8\uFF1A\u8F93\u5165\u8FC7\u957F\uFF0C\u5DF2\u622A\u53D6\u90E8\u5206\u8F83\u65E9\u5185\u5BB9\u3002" : ""}`
    }
  ];
}
function buildRepairMessages(raw, shape) {
  const schema = shape === "follow-up" ? '{"question":"string","continue":boolean}' : shape === "journal" ? '{"diary":"string","facets":[{"category":"string","summary":"string"}],"insights":["string"],"microAction":"string","selfQuestion":"string","themes":["string"]}' : shape === "weekly-report" ? '{"summary":"string","changes":[{"observation":"string","evidenceDates":["YYYY-MM-DD"]}],"possibleCauses":[{"hypothesis":"string","evidenceDates":["YYYY-MM-DD"]}],"emotionReading":{"hypothesis":"string","clues":["string"],"alternative":"string"},"themes":[{"name":"string","observation":"string"}],"nextStep":{"action":"string","reason":"string"},"selfQuestion":"string"}' : '{"mood":{"score":3,"reason":"string"},"energy":{"score":3,"reason":"string"},"stress":{"score":3,"reason":"string"}}';
  const constraints = shape === "journal" ? "facets \u9700\u6709 2\u20136 \u4E2A\u4E14 category \u4E92\u4E0D\u91CD\u590D\uFF0Cinsights \u9700\u6839\u636E\u4FE1\u606F\u91CF\u52A8\u6001\u7ED9\u51FA 2\u20134 \u6761\uFF0Cthemes \u9700\u6709 1\u20135 \u4E2A\u3002" : shape === "rating" ? "\u4E09\u4E2A score \u5747\u9700\u4E3A 1\u20135 \u7684\u6574\u6570\uFF0C\u6BCF\u9879 reason \u5747\u4E0D\u80FD\u4E3A\u7A7A\u3002" : "";
  return [
    {
      role: "system",
      content: `\u628A\u7528\u6237\u63D0\u4F9B\u7684\u5185\u5BB9\u6574\u7406\u4E3A\u4E25\u683C\u6709\u6548\u7684 JSON\u3002\u4E0D\u8981\u589E\u52A0\u89E3\u91CA\u6216 Markdown\u3002\u76EE\u6807\u7ED3\u6784\uFF1A${schema}${constraints}`
    },
    {
      role: "user",
      content: raw
    }
  ];
}
function reportObjectArray(value, key, fields) {
  const raw = value[key];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`\u6A21\u578B\u7ED3\u679C\u4E2D\u7684 ${key} \u683C\u5F0F\u4E0D\u6B63\u786E`);
  }
  return raw.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`\u6A21\u578B\u7ED3\u679C\u4E2D\u7684 ${key} \u683C\u5F0F\u4E0D\u6B63\u786E`);
    }
    const parsed = {};
    for (const field of fields) {
      parsed[field] = stringField(item, field);
    }
    if ("evidenceDates" in item) {
      parsed.evidenceDates = stringArrayField(item, "evidenceDates");
    }
    return parsed;
  });
}
function parseWeeklyReport(raw, period) {
  const value = objectValue(raw);
  const emotion = value.emotionReading;
  const nextStep = value.nextStep;
  if (typeof emotion !== "object" || emotion === null || Array.isArray(emotion) || typeof nextStep !== "object" || nextStep === null || Array.isArray(nextStep)) {
    throw new Error("\u6A21\u578B\u7ED3\u679C\u7F3A\u5C11\u5468\u62A5\u7ED3\u6784");
  }
  const changes = reportObjectArray(value, "changes", ["observation"]);
  const possibleCauses = reportObjectArray(value, "possibleCauses", ["hypothesis"]);
  const emotionClues = stringArrayField(emotion, "clues");
  if (emotionClues.length === 0) {
    throw new Error("AI \u60C5\u7EEA\u5047\u8BBE\u81F3\u5C11\u9700\u8981\u4E00\u6761\u6587\u5B57\u7EBF\u7D22");
  }
  for (const item of [...changes, ...possibleCauses]) {
    if (!Array.isArray(item.evidenceDates)) {
      throw new Error("\u5468\u62A5\u8BC1\u636E\u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E");
    }
    item.evidenceDates = item.evidenceDates.filter((date) => date >= period.start && date <= period.end);
  }
  return {
    summary: stringField(value, "summary"),
    changes,
    possibleCauses,
    emotionReading: {
      hypothesis: stringField(emotion, "hypothesis"),
      clues: emotionClues,
      alternative: stringField(emotion, "alternative")
    },
    themes: reportObjectArray(value, "themes", ["name", "observation"]),
    nextStep: {
      action: stringField(nextStep, "action"),
      reason: stringField(nextStep, "reason")
    },
    selfQuestion: stringField(value, "selfQuestion")
  };
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
      throw new Error("\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u6709\u6548 JSON");
    }
    return JSON.parse(withoutFence.slice(start, end + 1));
  }
}
function objectValue(raw) {
  const value = extractJson(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE JSON \u5BF9\u8C61");
  }
  return value;
}
function stringField(value, key) {
  const field = value[key];
  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(`\u6A21\u578B\u7ED3\u679C\u7F3A\u5C11 ${key}`);
  }
  return field.trim();
}
function stringArrayField(value, key) {
  const field = value[key];
  if (!Array.isArray(field) || field.some((item) => typeof item !== "string")) {
    throw new Error(`\u6A21\u578B\u7ED3\u679C\u4E2D\u7684 ${key} \u683C\u5F0F\u4E0D\u6B63\u786E`);
  }
  return field.filter((item) => typeof item === "string").map((item) => item.trim()).filter((item) => item.length > 0);
}
function facetArrayField(value) {
  const field = value.facets;
  if (!Array.isArray(field)) {
    throw new Error("\u6A21\u578B\u7ED3\u679C\u4E2D\u7684 facets \u683C\u5F0F\u4E0D\u6B63\u786E");
  }
  const facets = field.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("\u6A21\u578B\u7ED3\u679C\u4E2D\u7684 facets \u683C\u5F0F\u4E0D\u6B63\u786E");
    }
    const facet = item;
    return {
      category: stringField(facet, "category"),
      summary: stringField(facet, "summary")
    };
  });
  if (facets.length < 2 || facets.length > 6) {
    throw new Error("\u667A\u80FD\u5207\u7247\u5FC5\u987B\u4E3A 2\u20136 \u6761");
  }
  if (new Set(facets.map((facet) => facet.category)).size !== facets.length) {
    throw new Error("\u667A\u80FD\u5207\u7247\u7C7B\u522B\u4E0D\u80FD\u91CD\u590D");
  }
  return facets;
}
function parseFollowUp(raw) {
  const value = objectValue(raw);
  if (typeof value.continue !== "boolean") {
    throw new Error("\u6A21\u578B\u7ED3\u679C\u7F3A\u5C11 continue");
  }
  return {
    question: value.continue ? stringField(value, "question") : "",
    continue: value.continue
  };
}
function ratingDetailField(value, key) {
  const field = value[key];
  if (typeof field !== "object" || field === null || Array.isArray(field)) {
    throw new Error(`\u6A21\u578B\u7ED3\u679C\u4E2D\u7684 ${key} \u8BC4\u5206\u683C\u5F0F\u4E0D\u6B63\u786E`);
  }
  const detail = field;
  if (typeof detail.score !== "number" || !Number.isInteger(detail.score) || detail.score < 1 || detail.score > 5) {
    throw new Error(`${key} \u7684 AI \u8BC4\u5206\u5FC5\u987B\u4E3A 1\u20135 \u7684\u6574\u6570`);
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
  if (insights.length < 2 || insights.length > 4) {
    throw new Error("\u53CD\u601D\u6D1E\u5BDF\u5FC5\u987B\u4E3A 2\u20134 \u6761");
  }
  if (themes.length < 1 || themes.length > 5) {
    throw new Error("\u4E3B\u9898\u5FC5\u987B\u4E3A 1\u20135 \u4E2A");
  }
  return {
    diary: stringField(value, "diary"),
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

// src/generation.ts
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
async function generateFollowUp(provider, draft) {
  const raw = await provider.generate(
    buildFollowUpMessages(draft),
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
  const raw = await provider.generate(buildWeeklyReportMessages(source, settings));
  return parseWithRepair(
    provider,
    raw,
    "weekly-report",
    (value) => parseWeeklyReport(value, source.period)
  );
}

// src/preview-controls.ts
var RatingScaleEditor = class {
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
        "aria-label": `${label}\u8BC4\u5206`
      }
    });
    for (let score = 1; score <= 5; score += 1) {
      const button = scale.createEl("button", {
        cls: "mind-trace-scale-point",
        text: String(score),
        attr: {
          type: "button",
          "aria-label": `${label} ${score} \u5206`,
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
    this.container.setAttribute("aria-label", "\u65E5\u8BB0\u4E3B\u9898");
    for (const theme of this.values) {
      const pill = this.container.createSpan({
        cls: "mind-trace-theme-pill"
      });
      pill.createSpan({ text: theme });
      const remove = pill.createEl("button", {
        text: "\xD7",
        attr: {
          type: "button",
          "aria-label": `\u79FB\u9664\u4E3B\u9898 ${theme}`
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
        placeholder: this.values.length < 5 ? "\u6DFB\u52A0\u4E3B\u9898\uFF0C\u6309\u56DE\u8F66\u786E\u8BA4" : "\u6700\u591A 5 \u4E2A\u4E3B\u9898",
        "aria-label": "\u6DFB\u52A0\u4E3B\u9898"
      }
    });
    this.input.disabled = this.values.length >= 5;
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "," || event.key === "\uFF0C") {
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

// src/saved-journal-view.ts
var import_obsidian3 = require("obsidian");

// src/saved-journal.ts
var RATING_LABELS = {
  mood: "\u5FC3\u60C5",
  energy: "\u7CBE\u529B",
  stress: "\u538B\u529B"
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
    throw new Error(`\u65E5\u8BB0\u5C5E\u6027 ${key} \u5DF2\u635F\u574F`);
  }
  const ratings = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > 5) {
      throw new Error(`\u65E5\u8BB0\u5C5E\u6027 ${key} \u5DF2\u635F\u574F`);
    }
    ratings.push(item);
  }
  return ratings;
}
function frontmatterThemes(frontmatter) {
  const value = frontmatter.themes;
  if (!Array.isArray(value)) {
    throw new Error("\u65E5\u8BB0\u5C5E\u6027 themes \u5DF2\u635F\u574F");
  }
  const themes = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error("\u65E5\u8BB0\u5C5E\u6027 themes \u5DF2\u635F\u574F");
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
function parseRating(block, key, selfScore) {
  const section = sectionBlock(block, "\u72B6\u6001\u5BF9\u7167");
  const label = RATING_LABELS[key];
  const row = new RegExp(
    `^\\| ${label} \\| (\\d)\\/5 \\| (\\d)\\/5 \\|`,
    "m"
  ).exec(section);
  const reason = new RegExp(
    `^> - \\*\\*${label}\\*\\*\uFF1A(.+)$`,
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
    throw new Error("\u65E5\u8BB0\u65E5\u671F\u5DF2\u635F\u574F");
  }
  const ratings = {
    mood: frontmatterNumberArray(frontmatter, "mood"),
    energy: frontmatterNumberArray(frontmatter, "energy"),
    stress: frontmatterNumberArray(frontmatter, "stress")
  };
  const dayThemes = frontmatterThemes(frontmatter);
  const headings = [...content.matchAll(/^## (\d{2}:\d{2})\s*$/gm)];
  const sessions = headings.map((heading, index) => {
    if (heading[1] === void 0) {
      throw new Error("\u65E5\u8BB0\u8BB0\u5F55\u65F6\u95F4\u5DF2\u635F\u574F");
    }
    const blockStart = heading.index + heading[0].length;
    const blockEnd = headings[index + 1]?.index ?? content.length;
    const block = content.slice(blockStart, blockEnd);
    const mood = ratings.mood[index];
    const energy = ratings.energy[index];
    const stress = ratings.stress[index];
    if (mood === void 0 || energy === void 0 || stress === void 0) {
      throw new Error("\u65E5\u8BB0\u8BC4\u5206\u4E0E\u8BB0\u5F55\u6B21\u6570\u4E0D\u4E00\u81F4");
    }
    const savedThemes = parseList(sectionText(block, "\u4ECA\u65E5\u4E3B\u9898"));
    return {
      time: heading[1],
      diary: sectionText(block, "\u65E5\u8BB0"),
      facets: parseFacets(sectionText(block, "\u4ECA\u65E5\u5207\u7247")),
      ratings: {
        mood: parseRating(block, "mood", mood),
        energy: parseRating(block, "energy", energy),
        stress: parseRating(block, "stress", stress)
      },
      insights: parseList(sectionText(block, "\u53CD\u601D\u6D1E\u5BDF")),
      microAction: sectionText(block, "\u660E\u65E5\u5FAE\u884C\u52A8"),
      selfQuestion: sectionText(block, "\u7559\u7ED9\u81EA\u5DF1\u7684\u95EE\u9898"),
      themes: savedThemes.length > 0 ? savedThemes : dayThemes
    };
  });
  return {
    date: frontmatter.date,
    sessions
  };
}
var RATING_WORDS = {
  mood: ["\u4F4E\u843D", "\u504F\u4F4E", "\u5E73\u7A33", "\u4E0D\u9519", "\u660E\u4EAE"],
  energy: ["\u8017\u5C3D", "\u75B2\u60EB", "\u5C1A\u53EF", "\u5145\u8DB3", "\u5145\u6C9B"],
  stress: ["\u677E\u5F1B", "\u8F7B\u677E", "\u9002\u4E2D", "\u504F\u9AD8", "\u7D27\u7EF7"]
};
function ratingWord(key, score) {
  const word = RATING_WORDS[key][score - 1];
  if (word === void 0) {
    throw new Error("\u8BC4\u5206\u5FC5\u987B\u4E3A 1\u20135");
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
      text: rating.aiScore === void 0 ? ratingWord(key, rating.selfScore) : rating.aiScore === rating.selfScore ? "\u4E24\u79CD\u8BFB\u6CD5\u4E00\u81F4" : `AI ${rating.aiScore > rating.selfScore ? "\u9AD8" : "\u4F4E"} ${Math.abs(rating.aiScore - rating.selfScore)} \u5206`
    });
    const selfHeading = card.createDiv({
      cls: "mind-trace-rating-ai-heading"
    });
    selfHeading.createSpan({ text: "\u6211\u7684\u611F\u53D7" });
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
      aiHeading.createSpan({ text: "AI \u89C2\u5BDF" });
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
function renderReviewMap(container, session) {
  const map = container.createDiv({
    cls: "mind-trace-review-map",
    attr: { role: "list", "aria-label": "\u65E5\u8BB0\u5185\u5BB9\u6982\u89C8" }
  });
  for (const [label, value] of [
    ["\u6B63\u6587", "1 \u7BC7"],
    ["\u4ECA\u65E5\u5207\u7247", `${session.facets.length} \u4E2A`],
    ["\u53CD\u601D\u6D1E\u5BDF", `${session.insights.length} \u6761`],
    ["\u660E\u65E5\u884C\u52A8", "1 \u6B65"]
  ]) {
    const item = map.createDiv({
      cls: "mind-trace-review-map-item",
      attr: { role: "listitem" }
    });
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
}
function renderSession(container, session) {
  const article = container.createEl("article", {
    cls: "mind-trace-saved-session"
  });
  const sessionHeading = article.createDiv({
    cls: "mind-trace-saved-session-heading"
  });
  sessionHeading.createSpan({ text: "\u4ECA\u65E5\u8BB0\u5F55" });
  sessionHeading.createEl("time", { text: session.time });
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
    text: "\u4ECA\u65E5 \xB7 \u5DF2\u4FDD\u5B58"
  });
  diaryTitle.createDiv({
    cls: "mind-trace-card-title mind-trace-diary-title",
    text: "\u4ECA\u5929\u7684\u6B63\u6587"
  });
  diaryHeading.createSpan({ text: "\u5FC3\u8FF9\u65E5\u8BB0" });
  const diaryWriting = diarySection.createDiv({
    cls: "mind-trace-diary-writing"
  });
  diaryWriting.createDiv({
    cls: "mind-trace-saved-copy mind-trace-saved-diary",
    text: session.diary
  });
  const facetsSection = article.createEl("section", {
    cls: "mind-trace-facets-section"
  });
  const facetsHeading = facetsSection.createDiv({
    cls: "mind-trace-card-heading"
  });
  facetsHeading.createDiv({
    cls: "mind-trace-card-title",
    text: "\u4ECA\u5929\u7531\u8FD9\u4E9B\u7EC4\u6210"
  });
  facetsHeading.createSpan({ text: "\u667A\u80FD\u5207\u7247" });
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
      text: "\u4ECA\u65E5\u5207\u7247"
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
    text: "\u6211\u4ECE\u4ECA\u5929\u770B\u89C1"
  });
  insightsHeading.createSpan({ text: "\u53CD\u601D\u6D1E\u5BDF" });
  for (const [index, insight] of session.insights.entries()) {
    const row = insightsSection.createDiv({
      cls: "mind-trace-insight-row"
    });
    row.createSpan({
      cls: "mind-trace-insight-mark",
      text: `\u89C2\u5BDF ${index + 1}`
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
    text: "\u660E\u5929\u6700\u5C0F\u7684\u4E00\u6B65"
  });
  actionHeading.createSpan({ text: "\u53EA\u505A\u8FD9\u4E00\u5C0F\u6B65" });
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
    text: "\u7559\u7ED9\u660E\u5929\u7684\u4E00\u4E2A\u95EE\u9898"
  });
  questionHeading.createSpan({ text: "\u4E0D\u6025\u7740\u56DE\u7B54" });
  const questionBody = questionSection.createDiv({
    cls: "mind-trace-question-body"
  });
  questionBody.createSpan({
    cls: "mind-trace-question-mark",
    text: "\uFF1F",
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
    text: "\u4ECA\u5929\u5173\u4E8E"
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
function renderSavedJournal(container, document2, options = {}) {
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
    text: "\u5FC3\u8FF9\u65E5\u8BB0 \xB7 \u5DF2\u4FDD\u5B58"
  });
  header.createEl("h1", {
    cls: "mind-trace-journal-title",
    text: document2.date
  });
  header.createEl("p", {
    text: `\u5171 ${document2.sessions.length} \u6B21\u8BB0\u5F55`
  });
  if (options.onEditSource !== void 0 || options.onExportPdf !== void 0) {
    const actions = header.createDiv({
      cls: "mind-trace-saved-header-actions"
    });
    if (options.onExportPdf !== void 0) {
      const exportPdf = actions.createEl("button", {
        cls: "mind-trace-export-pdf",
        text: "\u5BFC\u51FA PDF",
        attr: {
          type: "button",
          "aria-label": "\u5C06\u8FD9\u7BC7\u5FC3\u8FF9\u65E5\u8BB0\u5BFC\u51FA\u4E3A PDF"
        }
      });
      exportPdf.addEventListener("click", options.onExportPdf);
    }
    if (options.onEditSource !== void 0) {
      const editSource = actions.createEl("button", {
        cls: "mind-trace-edit-source",
        text: "\u7F16\u8F91 Markdown",
        attr: {
          type: "button",
          "aria-label": "\u7F16\u8F91\u539F\u59CB Markdown"
        }
      });
      editSource.addEventListener("click", options.onEditSource);
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
      const button = tabs.createEl("button", {
        cls: `mind-trace-session-tab${selected ? " is-active" : ""}`,
        text: `第 ${index + 1} 次 · ${session.time}`,
        attr: {
          type: "button",
          role: "tab",
          "aria-selected": String(selected),
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
        window.requestAnimationFrame(() => {
          const activeTabs = container.querySelectorAll(".mind-trace-session-tab");
          activeTabs[nextIndex]?.focus();
        });
      });
    }
  }
  const session = document2.sessions[selectedSessionIndex];
  if (session !== void 0) {
    renderSession(shell, session);
    const panel = shell.querySelector(".mind-trace-saved-session");
    panel?.setAttribute("role", "tabpanel");
  }
}
function renderPrintableJournal(container, document2) {
  container.empty();
  const header = container.createEl("header", {
    cls: "mind-trace-print-header"
  });
  header.createDiv({
    cls: "mind-trace-print-eyebrow",
    text: "\u5FC3\u8FF9\u65E5\u8BB0"
  });
  header.createEl("h1", { text: document2.date });
  header.createEl("p", {
    text: `\u5171 ${document2.sessions.length} \u6B21\u8BB0\u5F55`
  });
  for (const session of document2.sessions) {
    const article = container.createEl("article", {
      cls: "mind-trace-print-session"
    });
    const sessionHeading = article.createDiv({
      cls: "mind-trace-print-session-heading"
    });
    sessionHeading.createSpan({ text: "\u4ECA\u65E5\u8BB0\u5F55" });
    sessionHeading.createEl("time", { text: session.time });
    const ratings = article.createEl("section", {
      cls: "mind-trace-print-section"
    });
    ratings.createEl("h2", { text: "\u72B6\u6001\u5BF9\u7167" });
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
        text: `\u6211\u7684\u611F\u53D7 \xB7 ${rating.selfScore}/5 \xB7 ${ratingWord(key, rating.selfScore)}`
      });
      if (rating.aiScore !== void 0) {
        card.createEl("p", {
          text: `AI \u89C2\u5BDF \xB7 ${rating.aiScore}/5 \xB7 ${ratingWord(key, rating.aiScore)}`
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
    diary.createEl("h2", { text: "\u4ECA\u5929\u7684\u6B63\u6587" });
    diary.createDiv({ text: session.diary });
    if (session.facets.length > 0) {
      const facets = article.createEl("section", {
        cls: "mind-trace-print-section"
      });
      facets.createEl("h2", { text: "\u4ECA\u5929\u7531\u8FD9\u4E9B\u7EC4\u6210" });
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
      insights.createEl("h2", { text: "\u6211\u4ECE\u4ECA\u5929\u770B\u89C1" });
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
    action.createEl("h2", { text: "\u660E\u5929\u6700\u5C0F\u7684\u4E00\u6B65" });
    action.createEl("p", { text: session.microAction });
    const question = closing.createEl("section", {
      cls: "mind-trace-print-note mind-trace-print-question"
    });
    question.createEl("h2", { text: "\u7559\u7ED9\u660E\u5929\u7684\u4E00\u4E2A\u95EE\u9898" });
    question.createEl("p", { text: session.selfQuestion });
    if (session.themes.length > 0) {
      const themes = article.createDiv({
        cls: "mind-trace-print-themes"
      });
      themes.createEl("strong", { text: "\u4ECA\u5929\u5173\u4E8E" });
      themes.createSpan({ text: session.themes.join(" \xB7 ") });
    }
  }
}

// src/saved-journal-view.ts
var SAVED_JOURNAL_VIEW_TYPE = "mind-trace-saved-journal-view";
function parseFrontmatter(content, documentLabel = "\u5FC3\u8FF9\u65E5\u8BB0") {
  const info = (0, import_obsidian3.getFrontMatterInfo)(content);
  if (!info.exists) {
    throw new Error(`\u7F3A\u5C11${documentLabel}\u5C5E\u6027`);
  }
  const parsed = (0, import_obsidian3.parseYaml)(info.frontmatter);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${documentLabel}\u5C5E\u6027\u65E0\u6CD5\u8BC6\u522B`);
  }
  return Object.fromEntries(Object.entries(parsed));
}
var SavedJournalView = class extends import_obsidian3.TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  selectedSessionIndex = null;
  getViewType() {
    return SAVED_JOURNAL_VIEW_TYPE;
  }
  getDisplayText() {
    return this.file?.basename ?? "\u5FC3\u8FF9\u65E5\u8BB0";
  }
  getIcon() {
    return "notebook-pen";
  }
  getViewData() {
    return this.data;
  }
  setViewData(data, clear) {
    this.data = data;
    if (clear) {
      this.clear();
      this.selectedSessionIndex = null;
    }
    this.render();
  }
  clear() {
    this.contentEl.empty();
  }
  render() {
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
        onSessionChange: (index) => {
          this.selectedSessionIndex = index;
          this.render();
        },
        onEditSource: () => {
          void this.openMarkdownSource();
        },
        onExportPdf: () => {
          this.exportPdf(document2);
        }
      });
    } catch (error) {
      this.renderError(
        rendered,
        error instanceof Error ? error.message : "\u65E5\u8BB0\u683C\u5F0F\u65E0\u6CD5\u8BC6\u522B"
      );
    }
  }
  renderError(container, message) {
    const state = container.createDiv({
      cls: "mind-trace-empty-state mind-trace-saved-error"
    });
    state.createDiv({
      cls: "mind-trace-empty-mark",
      text: "\u65E0\u6CD5\u6062\u590D\u5E03\u5C40"
    });
    state.createDiv({
      cls: "mind-trace-empty-title",
      text: message
    });
    state.createEl("p", {
      text: "\u539F\u59CB Markdown \u6CA1\u6709\u88AB\u4FEE\u6539\uFF0C\u53EF\u4EE5\u5207\u6362\u5230\u6E90\u7801\u7EE7\u7EED\u67E5\u770B\u3002"
    });
    const button = state.createEl("button", {
      text: "\u7F16\u8F91\u539F\u59CB Markdown",
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
    const previousTitle = document.title;
    const body = document.body;
    const printDocument = document.createElement("main");
    printDocument.addClass("mind-trace-print-document");
    renderPrintableJournal(printDocument, journal);
    body.append(printDocument);
    const cleanup = () => {
      document.title = previousTitle;
      body.removeClass("mind-trace-printing");
      printDocument.remove();
      window.removeEventListener("afterprint", cleanup);
      window.removeEventListener("focus", restoreAfterFocus);
    };
    const restoreAfterFocus = () => {
      window.setTimeout(cleanup, 0);
    };
    document.title = `${journal.date}-\u5FC3\u8FF9`;
    body.addClass("mind-trace-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.addEventListener("focus", restoreAfterFocus, { once: true });
    new import_obsidian3.Notice("\u8BF7\u5728\u7CFB\u7EDF\u6253\u5370\u7A97\u53E3\u4E2D\u9009\u62E9\u201C\u5B58\u50A8\u4E3A PDF\u201D");
    window.setTimeout(() => {
      try {
        window.print();
      } catch (error) {
        cleanup();
        new import_obsidian3.Notice(
          error instanceof Error ? `\u65E0\u6CD5\u6253\u5F00 PDF \u5BFC\u51FA\u7A97\u53E3\uFF1A${error.message}` : "\u65E0\u6CD5\u6253\u5F00 PDF \u5BFC\u51FA\u7A97\u53E3"
        );
      }
    }, 50);
  }
};

// src/saved-weekly-report-view.ts
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
    throw new Error(`\u5468\u62A5\u7F3A\u5C11\u201C${heading}\u201D\u90E8\u5206`);
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
    throw new Error(`\u5468\u62A5\u7684\u201C${label}\u201D\u6CA1\u6709\u53EF\u8BC6\u522B\u5185\u5BB9`);
  }
  return items;
}
function validWeeklyMetricValue(value, allowDays = false) {
  const normalized = stripWeeklyInlineMarkdown(value).replace(/\s+/g, " ");
  if (normalized === "\u2014") {
    return normalized;
  }
  const pattern = allowDays ? /^[+-]?\d+(?:\.\d+)?(?: \u5929)?$/ : /^[+-]?\d+(?:\.\d+)?$/;
  if (!pattern.test(normalized)) {
    throw new Error(`\u5468\u62A5\u6570\u5B57\u683C\u5F0F\u65E0\u6CD5\u8BC6\u522B\uFF1A${normalized}`);
  }
  return normalized;
}
function parseWeeklyMetrics(section) {
  const labels = {
    "\u8BB0\u5F55\u65E5": "days",
    "\u5FC3\u60C5": "mood",
    "\u7CBE\u529B": "energy",
    "\u538B\u529B": "stress"
  };
  const parsed = {};
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) {
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 3 || !(cells[0] in labels)) {
      continue;
    }
    const key = labels[cells[0]];
    parsed[key] = {
      key,
      label: cells[0],
      current: validWeeklyMetricValue(cells[1], key === "days"),
      delta: validWeeklyMetricValue(cells[2], key === "days")
    };
  }
  for (const key of ["mood", "energy", "stress"]) {
    if (parsed[key] === void 0) {
      throw new Error(`\u5468\u62A5\u7F3A\u5C11${key === "mood" ? "\u5FC3\u60C5" : key === "energy" ? "\u7CBE\u529B" : "\u538B\u529B"}\u5BF9\u7167\u6570\u636E`);
    }
    const currentValue = Number.parseFloat(parsed[key].current);
    const deltaValue = Number.parseFloat(parsed[key].delta);
    if (parsed[key].current !== "\u2014" && (!Number.isFinite(currentValue) || currentValue < 1 || currentValue > 5)) {
      throw new Error(`\u5468\u62A5${parsed[key].label}\u672C\u5468\u503C\u5E94\u4E3A 1\u20135`);
    }
    if (parsed[key].delta !== "\u2014" && (!Number.isFinite(deltaValue) || Math.abs(deltaValue) > 4)) {
      throw new Error(`\u5468\u62A5${parsed[key].label}\u53D8\u5316\u91CF\u65E0\u6CD5\u8BC6\u522B`);
    }
  }
  return [parsed.mood, parsed.energy, parsed.stress];
}
function parseWeeklyEmotion(section) {
  const lines = section.split("\n").map((line) => line.replace(/^>\s?/, "").trim());
  const clues = lines.filter((line) => line.startsWith("- ")).map((line) => stripWeeklyInlineMarkdown(line.slice(2))).filter((line) => line.length > 0);
  const alternativeLine = lines.find((line) => /^\*\*\u53E6\u4E00\u79CD\u53EF\u80FD\uFF1A\*\*/.test(line));
  const alternative = alternativeLine === void 0 ? "" : stripWeeklyInlineMarkdown(alternativeLine.replace(/^\*\*\u53E6\u4E00\u79CD\u53EF\u80FD\uFF1A\*\*/, ""));
  const hypothesis = lines.find((line) => line.length > 0 && !line.startsWith("[!note]") && !line.startsWith("- ") && !line.startsWith("**\u53E6\u4E00\u79CD\u53EF\u80FD")) ?? "";
  if (hypothesis.length === 0 || clues.length === 0 || alternative.length === 0) {
    throw new Error("AI \u60C5\u7EEA\u5047\u8BBE\u683C\u5F0F\u65E0\u6CD5\u8BC6\u522B");
  }
  return {
    hypothesis: stripWeeklyInlineMarkdown(hypothesis),
    clues,
    alternative
  };
}
function parseWeeklyThemes(section) {
  const themes = [...section.matchAll(/^- \*\*(.+?)\*\*\uFF1A(.+)$/gm)].map((match) => ({
    name: stripWeeklyInlineMarkdown(match[1] ?? ""),
    observation: stripWeeklyInlineMarkdown(match[2] ?? "")
  })).filter((theme) => theme.name.length > 0 && theme.observation.length > 0);
  if (themes.length === 0) {
    throw new Error("\u5468\u62A5\u4E3B\u9898\u683C\u5F0F\u65E0\u6CD5\u8BC6\u522B");
  }
  return themes;
}
function parseWeeklyNextStep(section) {
  const actionMatch = /^\*\*(.+?)\*\*\s*$/m.exec(section);
  if (actionMatch === null || actionMatch[1] === void 0) {
    throw new Error("\u5468\u62A5\u7F3A\u5C11\u4E0B\u5468\u884C\u52A8");
  }
  const reason = stripWeeklyInlineMarkdown(section.slice(actionMatch.index + actionMatch[0].length));
  if (reason.length === 0) {
    throw new Error("\u5468\u62A5\u7F3A\u5C11\u884C\u52A8\u7406\u7531");
  }
  return {
    action: stripWeeklyInlineMarkdown(actionMatch[1]),
    reason
  };
}
function parseSavedWeeklyReport(content, frontmatter) {
  if (frontmatter["mind-trace-report"] !== true || frontmatter["report-type"] !== "weekly") {
    throw new Error("\u8FD9\u4E0D\u662F\u53EF\u8BC6\u522B\u7684\u5FC3\u8FF9\u5468\u62A5");
  }
  if (Number(frontmatter["mind-trace-report-version"]) !== 1) {
    throw new Error("\u5468\u62A5\u7248\u672C\u65E0\u6CD5\u8BC6\u522B");
  }
  const periodStart = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
  const periodEnd = typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "";
  if (parseLocalDate(periodStart) === null || parseLocalDate(periodEnd) === null || periodStart > periodEnd) {
    throw new Error("\u5468\u62A5\u5468\u671F\u65E5\u671F\u65E0\u6CD5\u8BC6\u522B");
  }
  const sourceDays = Number(frontmatter["source-days"]);
  const sourceSessions = Number(frontmatter["source-sessions"]);
  if (!Number.isInteger(sourceDays) || sourceDays < 0 || !Number.isInteger(sourceSessions) || sourceSessions < 0) {
    throw new Error("\u5468\u62A5\u8BB0\u5F55\u6570\u91CF\u65E0\u6CD5\u8BC6\u522B");
  }
  const generatedAt = typeof frontmatter["generated-at"] === "string" ? frontmatter["generated-at"] : "";
  if (generatedAt.length === 0 || Number.isNaN(new Date(generatedAt).getTime())) {
    throw new Error("\u5468\u62A5\u751F\u6210\u65F6\u95F4\u65E0\u6CD5\u8BC6\u522B");
  }
  const summary = stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "\u4E00\u5468\u6982\u89C8"));
  const questionSection = requiredWeeklyReportSection(content, "\u7559\u7ED9\u81EA\u5DF1\u7684\u95EE\u9898");
  const question = stripWeeklyInlineMarkdown(questionSection.split("\n> [!info]")[0] ?? "");
  if (summary.length === 0 || question.length === 0) {
    throw new Error("\u5468\u62A5\u6458\u8981\u6216\u81EA\u6211\u95EE\u9898\u4E3A\u7A7A");
  }
  const keepPeriodDates = (items) => items.map((item) => ({
    ...item,
    evidenceDates: item.evidenceDates.filter((date) => date >= periodStart && date <= periodEnd)
  }));
  return {
    periodStart,
    periodEnd,
    generatedAt,
    sourceDays,
    sourceSessions,
    summary,
    metrics: parseWeeklyMetrics(requiredWeeklyReportSection(content, "\u672C\u5468\u6570\u5B57")),
    changes: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "\u53D1\u751F\u7684\u53D8\u5316"), "\u53D1\u751F\u7684\u53D8\u5316")),
    possibleCauses: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "\u53EF\u80FD\u7684\u539F\u56E0"), "\u53EF\u80FD\u7684\u539F\u56E0")),
    emotion: parseWeeklyEmotion(requiredWeeklyReportSection(content, "AI \u60C5\u7EEA\u5047\u8BBE")),
    themes: parseWeeklyThemes(requiredWeeklyReportSection(content, "\u53CD\u590D\u51FA\u73B0\u7684\u4E3B\u9898")),
    nextStep: parseWeeklyNextStep(requiredWeeklyReportSection(content, "\u4E0B\u5468\u6700\u5C0F\u7684\u4E00\u6B65")),
    selfQuestion: question,
    truncated: content.includes("> [!info] \u672C\u5468\u65E5\u8BB0\u8F83\u957F")
  };
}
function weeklyGeneratedAtText(value) {
  const date = new Date(value);
  if (value.length === 0 || Number.isNaN(date.getTime())) {
    return "\u751F\u6210\u65F6\u95F4\u672A\u8BB0\u5F55";
  }
  return `${date.getFullYear()}\u5E74${date.getMonth() + 1}\u6708${date.getDate()}\u65E5 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} \u751F\u6210`;
}
function weeklyMetricDeltaClass(metric) {
  const value = Number.parseFloat(metric.delta);
  if (!Number.isFinite(value) || value === 0) {
    return "is-neutral";
  }
  const favorable = metric.key === "stress" ? value < 0 : value > 0;
  return favorable ? "is-favorable" : "is-unfavorable";
}
function renderWeeklyEvidenceRows(container, items, kind) {
  for (const item of items) {
    const row = container.createDiv({ cls: "mind-trace-weekly-evidence-row" });
    row.createSpan({ cls: "mind-trace-weekly-evidence-mark", text: kind });
    const copy = row.createDiv();
    copy.createDiv({ cls: "mind-trace-saved-copy", text: item.text });
    if (item.evidenceDates.length > 0) {
      const dates = copy.createDiv({ cls: "mind-trace-weekly-evidence-dates", attr: { "aria-label": "\u6587\u5B57\u8BC1\u636E\u65E5\u671F" } });
      for (const date of item.evidenceDates) {
        dates.createEl("time", { text: date.slice(5).replace("-", "/"), attr: { datetime: date, title: date } });
      }
    }
  }
}
function renderSavedWeeklyReport(container, report, options = {}) {
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-saved-weekly-report");
  const shell = container.createDiv({
    cls: `mind-trace-journal-shell mind-trace-saved-shell mind-trace-weekly-shell${options.animate ? " is-entering" : ""}`,
    attr: { "aria-busy": options.busy === true ? "true" : "false" }
  });
  const header = shell.createEl("header", { cls: "mind-trace-saved-header mind-trace-weekly-header" });
  header.createDiv({ cls: "mind-trace-eyebrow", text: "\u5FC3\u8FF9\u5468\u62A5 \xB7 \u5DF2\u751F\u6210" });
  header.createEl("h1", { cls: "mind-trace-journal-title", text: `${report.periodStart} \u2014 ${report.periodEnd}` });
  header.createEl("p", { text: `${report.sourceDays} \u4E2A\u8BB0\u5F55\u65E5 \xB7 ${report.sourceSessions} \u7BC7\u8BB0\u5F55 \xB7 ${weeklyGeneratedAtText(report.generatedAt)}` });
  const actions = header.createDiv({ cls: "mind-trace-saved-header-actions" });
  if (options.onRegenerate !== void 0) {
    const regenerate = actions.createEl("button", {
      cls: "mind-trace-export-pdf mind-trace-report-regenerate",
      text: options.busy ? "\u6B63\u5728\u751F\u6210\u2026" : "\u91CD\u65B0\u751F\u6210",
      attr: { type: "button" }
    });
    regenerate.disabled = options.busy === true;
    regenerate.addEventListener("click", options.onRegenerate);
  }
  if (options.onEditSource !== void 0) {
    const edit = actions.createEl("button", { cls: "mind-trace-edit-source", text: "\u7F16\u8F91 Markdown", attr: { type: "button" } });
    edit.disabled = options.busy === true;
    edit.addEventListener("click", options.onEditSource);
  }
  if (options.busy === true) {
    shell.createDiv({ cls: "mind-trace-report-inline-status", text: "\u6B63\u5728\u6839\u636E\u5F53\u524D\u65E5\u8BB0\u91CD\u65B0\u6574\u7406\u8FD9\u4E00\u5468\u2026", attr: { role: "status" } });
  }
  if (typeof options.error === "string" && options.error.length > 0) {
    shell.createDiv({ cls: "mind-trace-report-inline-error", text: options.error, attr: { role: "alert" } });
  }
  const fold = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-fold" });
  const ledger = fold.createDiv({ cls: "mind-trace-weekly-ledger" });
  ledger.createDiv({ cls: "mind-trace-section-kicker", text: "\u4E00\u5468\u8D26\u9875" });
  ledger.createEl("time", { text: `${report.periodStart.slice(5).replace("-", ".")}\n\u2014\n${report.periodEnd.slice(5).replace("-", ".")}` });
  const ledgerStats = ledger.createDiv({ cls: "mind-trace-weekly-ledger-stats" });
  for (const [label, value] of [["\u8BB0\u5F55\u65E5", String(report.sourceDays)], ["\u603B\u7BC7\u6570", String(report.sourceSessions)]]) {
    const item = ledgerStats.createDiv();
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
  const foldBody = fold.createDiv({ cls: "mind-trace-weekly-fold-body" });
  foldBody.createDiv({ cls: "mind-trace-diary-kicker", text: "\u4E00\u5468\u6982\u89C8 \xB7 \u5DF2\u5F52\u6863" });
  foldBody.createDiv({ cls: "mind-trace-card-title mind-trace-diary-title", text: "\u8FD9\u4E00\u5468\u7684\u6B63\u6587" });
  foldBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-summary", text: report.summary });
  const metricsSection = shell.createEl("section", { cls: "mind-trace-rating-comparison mind-trace-weekly-metrics" });
  const metricsHeading = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-heading" });
  const metricsCopy = metricsHeading.createDiv();
  metricsCopy.createDiv({ cls: "mind-trace-section-kicker", text: "\u72B6\u6001\u5BF9\u7167 \xB7 \u524D\u4E00\u5468" });
  metricsCopy.createDiv({ cls: "mind-trace-rating-comparison-title", text: "\u8FD9\u4E00\u5468\uFF0C\u72B6\u6001\u5982\u4F55\u79FB\u52A8", attr: { role: "heading", "aria-level": "2" } });
  metricsCopy.createEl("p", { text: "\u672C\u5468\u503C\u6765\u81EA\u65E5\u8BB0\u81EA\u8BC4\u5E73\u5747\uFF1B\u53D8\u5316\u91CF\u7528\u524D\u4E00\u5B8C\u6574\u5468\u4F5C\u5BF9\u7167\u3002" });
  const metricGrid = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-grid" });
  for (const metric of report.metrics) {
    const card = metricGrid.createEl("section", { cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${metric.key} mind-trace-weekly-metric-card` });
    const cardHeading = card.createDiv({ cls: "mind-trace-rating-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-rating-card-title", text: metric.label });
    cardHeading.createSpan({ cls: `mind-trace-rating-difference ${weeklyMetricDeltaClass(metric)}`, text: metric.delta === "\u2014" ? "\u6682\u65E0\u5BF9\u7167" : `\u8F83\u4E0A\u5468 ${metric.delta}` });
    const value = card.createDiv({ cls: "mind-trace-weekly-metric-value" });
    value.createEl("output", { text: metric.current });
    value.createSpan({ text: metric.current === "\u2014" ? "" : "/ 5" });
  }
  const analysisGrid = shell.createDiv({ cls: "mind-trace-weekly-analysis-grid" });
  for (const [title, label, items, mark] of [["\u53D1\u751F\u7684\u53D8\u5316", "\u4ECE\u8FD9\u4E00\u5468\u770B\u89C1", report.changes, "\u53D8\u5316"], ["\u53EF\u80FD\u7684\u539F\u56E0", "\u4FDD\u7559\u63A8\u6D4B\u7684\u8FB9\u754C", report.possibleCauses, "\u7EBF\u7D22"]]) {
    const card = analysisGrid.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-analysis-card" });
    const cardHeading = card.createDiv({ cls: "mind-trace-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-card-title", text: title });
    cardHeading.createSpan({ text: label });
    renderWeeklyEvidenceRows(card, items, mark);
  }
  const emotion = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-emotion-card" });
  const emotionHeading = emotion.createDiv({ cls: "mind-trace-card-heading" });
  emotionHeading.createDiv({ cls: "mind-trace-card-title", text: "AI \u5BF9\u8FD9\u4E00\u5468\u7684\u60C5\u7EEA\u5047\u8BBE" });
  emotionHeading.createSpan({ text: "\u53CC\u91CD\u8BFB\u6CD5" });
  emotion.createEl("p", { cls: "mind-trace-weekly-emotion-note", text: "\u8FD9\u662F\u6839\u636E\u6587\u5B57\u7EBF\u7D22\u7684\u5047\u8BBE\u6027\u89E3\u8BFB\uFF0C\u4E0D\u662F\u5FC3\u7406\u6216\u533B\u5B66\u8BCA\u65AD\u3002" });
  const emotionGrid = emotion.createDiv({ cls: "mind-trace-weekly-emotion-grid" });
  const primary = emotionGrid.createDiv({ cls: "mind-trace-weekly-emotion-primary" });
  primary.createSpan({ text: "\u4E3B\u8981\u5047\u8BBE" });
  primary.createDiv({ cls: "mind-trace-saved-copy", text: report.emotion.hypothesis });
  const alternative = emotionGrid.createDiv({ cls: "mind-trace-weekly-emotion-alternative" });
  alternative.createSpan({ text: "\u53E6\u4E00\u79CD\u53EF\u80FD" });
  alternative.createDiv({ cls: "mind-trace-saved-copy", text: report.emotion.alternative });
  const clues = emotion.createDiv({ cls: "mind-trace-weekly-clues" });
  clues.createSpan({ text: "\u6587\u5B57\u7EBF\u7D22" });
  const clueList = clues.createEl("ul");
  for (const clue of report.emotion.clues) {
    clueList.createEl("li", { text: clue });
  }
  const themesSection = shell.createEl("section", { cls: "mind-trace-facets-section mind-trace-weekly-themes" });
  const themesHeading = themesSection.createDiv({ cls: "mind-trace-card-heading" });
  themesHeading.createDiv({ cls: "mind-trace-card-title", text: "\u53CD\u590D\u51FA\u73B0\u7684\u4E3B\u9898" });
  themesHeading.createSpan({ text: "\u4E00\u5468\u5207\u7247" });
  const themesGrid = themesSection.createDiv({ cls: "mind-trace-facets-grid" });
  for (const theme of report.themes) {
    const card = themesGrid.createDiv({ cls: "mind-trace-facet-card" });
    const themeHeader = card.createDiv({ cls: "mind-trace-facet-header" });
    themeHeader.createSpan({ cls: "mind-trace-facet-kind", text: "\u5468\u5185\u4E3B\u9898" });
    card.createDiv({ cls: "mind-trace-facet-category", text: theme.name });
    card.createDiv({ cls: "mind-trace-facet-divider", attr: { "aria-hidden": "true" } });
    card.createDiv({ cls: "mind-trace-saved-copy mind-trace-facet-summary", text: theme.observation });
  }
  const closing = shell.createDiv({ cls: "mind-trace-reflection-grid mind-trace-weekly-closing" });
  const actionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-action-card" });
  const actionHeading = actionSection.createDiv({ cls: "mind-trace-card-heading" });
  actionHeading.createDiv({ cls: "mind-trace-card-title", text: "\u4E0B\u5468\u6700\u5C0F\u7684\u4E00\u6B65" });
  actionHeading.createSpan({ text: "\u53EA\u505A\u8FD9\u4E00\u5C0F\u6B65" });
  const actionBody = actionSection.createDiv({ cls: "mind-trace-action-body" });
  actionBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-action", text: report.nextStep.action });
  actionBody.createEl("p", { cls: "mind-trace-weekly-action-reason", text: report.nextStep.reason });
  const questionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-question-card" });
  const questionHeading = questionSection.createDiv({ cls: "mind-trace-card-heading" });
  questionHeading.createDiv({ cls: "mind-trace-card-title", text: "\u7559\u7ED9\u81EA\u5DF1\u7684\u95EE\u9898" });
  questionHeading.createSpan({ text: "\u4E0D\u6025\u7740\u56DE\u7B54" });
  const questionBody = questionSection.createDiv({ cls: "mind-trace-question-body" });
  questionBody.createSpan({ cls: "mind-trace-question-mark", text: "\uFF1F", attr: { "aria-hidden": "true" } });
  questionBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-compact-editor", text: report.selfQuestion });
  if (report.truncated) {
    shell.createEl("p", { cls: "mind-trace-weekly-truncated", text: "\u672C\u5468\u65E5\u8BB0\u8F83\u957F\uFF0CAI \u5206\u6790\u4F7F\u7528\u4E86\u622A\u53D6\u540E\u7684\u6458\u5F55\u3002" });
  }
}
var WeeklyReportRegenerateModal = class extends import_obsidian3.Modal {
  constructor(app, onConfirm) {
    super(app);
    this.onConfirm = onConfirm;
  }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("mind-trace-report-confirm-modal");
    this.contentEl.createEl("h2", { text: "\u91CD\u65B0\u751F\u6210\u8FD9\u4EFD\u5468\u62A5\uFF1F" });
    this.contentEl.createEl("p", {
      text: "\u5C06\u6839\u636E\u5F53\u524D\u65E5\u8BB0\u91CD\u65B0\u5206\u6790\uFF0C\u5E76\u66FF\u6362\u73B0\u6709\u5468\u62A5 Markdown\u3002"
    });
    const actions = this.contentEl.createDiv({ cls: "mind-trace-actions" });
    const cancel = actions.createEl("button", { text: "\u53D6\u6D88", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { cls: "mod-warning", text: "\u91CD\u65B0\u751F\u6210", attr: { type: "button" } });
    confirm.addEventListener("click", () => {
      this.close();
      void this.onConfirm();
    });
  }
};
var SavedWeeklyReportView = class extends import_obsidian3.TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  busy = false;
  inlineError = "";
  hasRendered = false;
  getViewType() {
    return WEEKLY_REPORT_VIEW_TYPE;
  }
  getDisplayText() {
    return this.file?.basename ?? "\u5FC3\u8FF9\u5468\u62A5";
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
    }
    this.render();
  }
  clear() {
    this.contentEl.empty();
  }
  render() {
    this.contentEl.empty();
    this.contentEl.addClass("mind-trace-view", "mind-trace-saved-file-view", "mind-trace-report-file-view");
    if (renderPrivacyGate(this.contentEl, this.plugin)) {
      return;
    }
    const rendered = this.contentEl.createDiv({ cls: "mind-trace-saved-render" });
    try {
      const frontmatter = parseFrontmatter(this.data, "\u5FC3\u8FF9\u5468\u62A5");
      const report = parseSavedWeeklyReport(this.data, frontmatter);
      renderSavedWeeklyReport(rendered, report, {
        animate: !this.hasRendered,
        busy: this.busy,
        error: this.inlineError,
        onRegenerate: () => {
          new WeeklyReportRegenerateModal(this.app, async () => {
            this.busy = true;
            this.inlineError = "";
            this.render();
            try {
              await this.plugin.generateWeeklyReport({
                type: "weekly",
                start: report.periodStart,
                end: report.periodEnd
              }, true);
            } catch (error) {
              this.inlineError = errorMessage(error);
            } finally {
              this.busy = false;
              this.render();
            }
          }).open();
        },
        onEditSource: () => {
          void this.openMarkdownSource();
        }
      });
      this.hasRendered = true;
    } catch (error) {
      this.renderError(rendered, errorMessage(error));
    }
  }
  renderError(container, message) {
    const state = container.createDiv({
      cls: "mind-trace-empty-state mind-trace-saved-error"
    });
    state.createDiv({
      cls: "mind-trace-empty-mark",
      text: "\u65E0\u6CD5\u6062\u590D\u5E03\u5C40"
    });
    state.createDiv({ cls: "mind-trace-empty-title", text: message });
    state.createEl("p", {
      text: "\u539F\u59CB Markdown \u6CA1\u6709\u88AB\u4FEE\u6539\uFF0C\u53EF\u4EE5\u5207\u6362\u5230\u6E90\u7801\u7EE7\u7EED\u67E5\u770B\u548C\u4FEE\u590D\u3002"
    });
    const button = state.createEl("button", {
      text: "\u7F16\u8F91\u539F\u59CB Markdown",
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

// src/journal-view.ts
var JOURNAL_VIEW_TYPE = "mind-trace-journal-view";
function errorMessage(error) {
  return error instanceof Error ? error.message : "\u53D1\u751F\u4E86\u672A\u77E5\u9519\u8BEF";
}
var RATING_STATE_WORDS = {
  mood: ["\u4F4E\u843D", "\u504F\u4F4E", "\u5E73\u7A33", "\u4E0D\u9519", "\u660E\u4EAE"],
  energy: ["\u8017\u5C3D", "\u75B2\u60EB", "\u5C1A\u53EF", "\u5145\u8DB3", "\u5145\u6C9B"],
  stress: ["\u677E\u5F1B", "\u8F7B\u677E", "\u9002\u4E2D", "\u504F\u9AD8", "\u7D27\u7EF7"]
};
function ratingStateWord(key, score) {
  const word = RATING_STATE_WORDS[key][score - 1];
  if (word === void 0) {
    throw new Error("\u8BC4\u5206\u5FC5\u987B\u4E3A 1\u20135");
  }
  return word;
}
function ratingDifferenceText(selfScore, aiScore) {
  const difference = aiScore - selfScore;
  if (difference === 0) {
    return "\u4E24\u79CD\u8BFB\u6CD5\u4E00\u81F4";
  }
  return `AI ${difference > 0 ? "\u9AD8" : "\u4F4E"} ${Math.abs(difference)} \u5206`;
}
function autoGrow(textarea) {
  const keepCaretVisible = () => {
    if (document.activeElement !== textarea || textarea.selectionEnd !== textarea.value.length) {
      return;
    }
    let parent = textarea.parentElement;
    let scroller = null;
    while (parent !== null) {
      const overflowY = window.getComputedStyle(parent).overflowY;
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
    const safeBottom = Math.min(scrollerRect.bottom, window.innerHeight) - 72;
    if (textareaRect.bottom > safeBottom) {
      scroller.scrollTop += textareaRect.bottom - safeBottom;
    }
  };
  const resize = (followCaret) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (followCaret) {
      window.requestAnimationFrame(keepCaretVisible);
    }
  };
  textarea.addEventListener("input", () => resize(true));
  window.requestAnimationFrame(() => resize(false));
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
var JournalView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  busy = false;
  busyText = "";
  mode = "home";
  unsubscribeDraft = null;
  unsubscribeMetrics = null;
  insightsCache = null;
  weeklyReportState = null;
  weeklyReportLoading = false;
  renderToken = 0;
  homeDashboard = null;
  getViewType() {
    return JOURNAL_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u5FC3\u8FF9";
  }
  getIcon() {
    return "notebook-pen";
  }
  onOpen() {
    this.unsubscribeDraft = this.plugin.onDraftChanged(() => {
      if (!this.busy) {
        this.render();
      }
    });
    this.unsubscribeMetrics = this.plugin.onMetricsChanged(() => {
      this.insightsCache = null;
      if (!this.weeklyReportLoading) {
        this.weeklyReportState = null;
      }
      if (!this.busy && this.mode === "home") {
        this.render();
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
    return Promise.resolve();
  }
  render() {
    this.renderToken += 1;
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mind-trace-view");
    if (renderPrivacyGate(container, this.plugin)) {
      return;
    }
    if (this.mode === "home") {
      this.renderHome(container);
    } else {
      this.renderJournal(container);
    }
  }
  startWizard() {
    this.mode = "wizard";
    this.render();
  }
  async openJournalFile(filePath) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: SAVED_JOURNAL_VIEW_TYPE,
      state: { file: filePath },
      active: true
    });
    await this.app.workspace.revealLeaf(leaf);
  }
  async openWeeklyReportFile(filePath) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: WEEKLY_REPORT_VIEW_TYPE,
      state: { file: filePath },
      active: true
    });
    await this.app.workspace.revealLeaf(leaf);
  }
  async loadInsights(range) {
    const entries = filterMetrics(collectMetrics(this.app).entries, range);
    const facetCounts = new Map();
    const timeCounts = [0, 0, 0, 0];
    const selfSums = { mood: 0, energy: 0, stress: 0 };
    const selfCounts = { mood: 0, energy: 0, stress: 0 };
    const aiSums = { mood: 0, energy: 0, stress: 0 };
    const aiCounts = { mood: 0, energy: 0, stress: 0 };
    let sessionCount = 0;
    let totalWords = 0;
    let skipped = 0;
    for (const entry of entries) {
      try {
        const file = this.app.vault.getAbstractFileByPath(entry.filePath);
        if (!(file instanceof import_obsidian4.TFile)) {
          skipped += 1;
          continue;
        }
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const content = await this.app.vault.cachedRead(file);
        const document2 = parseSavedJournal(content, frontmatter);
        for (const session of document2.sessions) {
          sessionCount += 1;
          totalWords += session.diary.length;
          for (const facet of session.facets) {
            facetCounts.set(facet.category, (facetCounts.get(facet.category) ?? 0) + 1);
          }
          const hour = Number(session.time.slice(0, 2));
          if (hour >= 5 && hour < 12) {
            timeCounts[0] += 1;
          } else if (hour >= 12 && hour < 18) {
            timeCounts[1] += 1;
          } else if (hour >= 18 && hour < 24) {
            timeCounts[2] += 1;
          } else {
            timeCounts[3] += 1;
          }
          for (const key of ["mood", "energy", "stress"]) {
            const rating = session.ratings[key];
            selfSums[key] += rating.selfScore;
            selfCounts[key] += 1;
            if (rating.aiScore !== void 0) {
              aiSums[key] += rating.aiScore;
              aiCounts[key] += 1;
            }
          }
        }
      } catch (error) {
        skipped += 1;
      }
    }
    return {
      facets: [...facetCounts.entries()].map(([category, count]) => ({ category, count })).sort(
        (left, right) => right.count - left.count || left.category.localeCompare(right.category)
      ).slice(0, 8),
      timeBuckets: ["上午", "下午", "晚上", "深夜"].map((label, index) => ({
        label,
        count: timeCounts[index] ?? 0
      })),
      compare: [["mood", "心情"], ["energy", "精力"], ["stress", "压力"]].map(([key, label]) => ({
        key,
        label,
        self: selfCounts[key] > 0 ? selfSums[key] / selfCounts[key] : 0,
        ai: aiCounts[key] > 0 ? aiSums[key] / aiCounts[key] : 0
      })),
      aiSamples: aiCounts.mood,
      sessionCount,
      totalWords,
      avgWords: sessionCount > 0 ? Math.round(totalWords / sessionCount) : 0,
      skipped
    };
  }
  async loadAndRenderInsights(range) {
    const token = this.renderToken;
    if (this.insightsCache === null || this.insightsCache.range !== range) {
      this.insightsCache = { range, data: await this.loadInsights(range) };
    }
    if (token !== this.renderToken || this.mode !== "home" || this.plugin.settings.dashboardRange !== range) {
      return;
    }
    this.homeDashboard?.renderInsights(this.insightsCache.data);
  }
  async loadWeeklyReportCard() {
    if (this.weeklyReportLoading || this.mode !== "home") {
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
        status = await this.plugin.generateWeeklyReport(period, false, true);
      }
      this.weeklyReportState = { ...status, key };
    } catch (error) {
      this.weeklyReportState = { kind: "error", key, period, message: errorMessage(error) };
    } finally {
      this.weeklyReportLoading = false;
      if (this.mode === "home" && this.leaf.view === this) {
        this.render();
      }
    }
  }
  async retryWeeklyReport(overwrite = false) {
    const period = completedPeriod("weekly");
    const key = `${period.start}--${period.end}`;
    this.weeklyReportLoading = true;
    this.weeklyReportState = { kind: "loading", key, period };
    this.render();
    try {
      const status = await this.plugin.generateWeeklyReport(period, overwrite, false);
      this.weeklyReportState = { ...status, key };
    } catch (error) {
      this.weeklyReportState = { kind: "error", key, period, message: errorMessage(error) };
    } finally {
      this.weeklyReportLoading = false;
      if (this.mode === "home" && this.leaf.view === this) {
        this.render();
      }
    }
  }
  renderHome(container) {
    const shell = container.createDiv({ cls: "mind-trace-home-shell" });
    const allEntries = collectMetrics(this.app).entries;
    const weekStart = localDateString(startOfLocalWeek(new Date()));
    const currentWeekEntries = allEntries.filter((entry) => entry.date >= weekStart && entry.date <= localDateString(new Date()));
    const currentWeek = metricSnapshot(currentWeekEntries);
    const lastWeekPeriod = completedPeriod("weekly");
    const lastWeek = metricSnapshot(periodEntries(allEntries, lastWeekPeriod));
    const header = shell.createDiv({ cls: "mind-trace-home-header" });
    const heading = header.createDiv();
    heading.createDiv({ cls: "mind-trace-eyebrow", text: "心迹" });
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
    this.renderWeekTrajectory(shell, currentWeekEntries);
    const lead = shell.createDiv({ cls: "mind-trace-home-lead-grid" });
    this.renderWeeklyReportCard(lead);
    this.renderRecordHistory(lead, allEntries);
    const dashboardSection = shell.createDiv({ cls: "mind-trace-home-section" });
    const dashboard = new DashboardComponent(
      this.app,
      dashboardSection,
      this.plugin.settings.dashboardRange,
      async (range) => {
        this.plugin.settings.dashboardRange = range;
        await this.plugin.saveSettings();
        void this.loadAndRenderInsights(range);
      },
      (filePath) => {
        void this.openJournalFile(filePath);
      }
    );
    dashboard.render();
    this.homeDashboard = dashboard;
    this.renderHomeList(shell);
    void this.loadAndRenderInsights(this.plugin.settings.dashboardRange);
    void this.loadWeeklyReportCard();
  }
  renderWeekTrajectory(container, entries) {
    const section = container.createEl("section", { cls: "mind-trace-week-trajectory" });
    const heading = section.createDiv({ cls: "mind-trace-week-heading" });
    const copy = heading.createDiv();
    copy.createDiv({ cls: "mind-trace-home-section-title", text: "本周轨迹", attr: { role: "heading", "aria-level": "2" } });
    copy.createEl("p", { text: "节点越高，记录中的心情越明亮；外圈与边线分别提示精力和压力。" });
    const recorded = new Map();
    for (const entry of entries) {
      if (!recorded.has(entry.date)) {
        recorded.set(entry.date, entry);
      }
    }
    const weekStart = startOfLocalWeek(new Date());
    const today = localDateString(new Date());
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addLocalDays(weekStart, index);
      const dateString = localDateString(date);
      return { date, dateString, entry: recorded.get(dateString), future: dateString > today };
    });
    const canvas = section.createDiv({
      cls: "mind-trace-week-canvas",
      attr: { role: "group", "aria-label": "本周七天状态轨迹" }
    });
    const svg = svgElement("svg", { viewBox: "0 0 700 150", "aria-hidden": "true" });
    svg.classList.add("mind-trace-week-svg");
    svg.append(svgElement("path", { d: "M 50 82 L 650 82", class: "mind-trace-week-baseline" }));
    const path = days.map((day, index) => {
      const x = 50 + index * 100;
      const y = day.entry === void 0 ? 82 : 124 - (day.entry.mood - 1) / 4 * 78;
      return `${index === 0 ? "M" : "L"} ${x} ${y.toFixed(1)}`;
    }).join(" ");
    svg.append(svgElement("path", { d: path, class: "mind-trace-week-path" }));
    canvas.append(svg);
    days.forEach((day, index) => {
      const x = (index + 0.5) / 7 * 100;
      const y = day.entry === void 0 ? 82 : 124 - (day.entry.mood - 1) / 4 * 78;
      const node = day.entry === void 0 ? canvas.createSpan({ cls: `mind-trace-week-node is-empty${day.future ? " is-future" : ""}` }) : canvas.createEl("button", {
        cls: `mind-trace-week-node is-recorded mind-trace-week-energy-${Math.round(day.entry.energy)} mind-trace-week-stress-${Math.round(day.entry.stress)}`,
        attr: {
          type: "button",
          "aria-label": `打开 ${day.dateString} 的日记，心情 ${day.entry.mood.toFixed(1)}，精力 ${day.entry.energy.toFixed(1)}，压力 ${day.entry.stress.toFixed(1)}`,
          title: `${day.dateString} · 心 ${day.entry.mood.toFixed(1)} / 精 ${day.entry.energy.toFixed(1)} / 压 ${day.entry.stress.toFixed(1)}`
        }
      });
      node.style.left = `${x}%`;
      node.style.top = `${y / 150 * 100}%`;
      if (day.entry !== void 0) {
        node.addEventListener("click", () => void this.openJournalFile(day.entry.filePath));
      }
      const label = canvas.createDiv({ cls: `mind-trace-week-day${day.dateString === today ? " is-today" : ""}` });
      label.style.left = `${x}%`;
      label.createSpan({ text: `周${"一二三四五六日"[index]}` });
      label.createEl("small", { text: `${day.date.getMonth() + 1}/${day.date.getDate()}` });
    });
  }
  renderWeeklyReportCard(container) {
    const state = this.weeklyReportState;
    const period = state?.period ?? completedPeriod("weekly");
    const card = container.createEl("section", { cls: "mind-trace-weekly-card" });
    const header = card.createDiv({ cls: "mind-trace-lead-card-header" });
    const title = header.createDiv();
    title.createDiv({ cls: "mind-trace-home-section-title", text: "上一周回顾", attr: { role: "heading", "aria-level": "2" } });
    title.createSpan({ cls: "mind-trace-period-label", text: periodLabel(period) });
    const body = card.createDiv({ cls: "mind-trace-weekly-card-body", attr: { "aria-live": "polite" } });
    const actions = card.createDiv({ cls: "mind-trace-weekly-card-actions" });
    const action = (label, handler, primary = false) => {
      const button = actions.createEl("button", { cls: primary ? "mod-cta" : "", text: label, attr: { type: "button" } });
      button.addEventListener("click", handler);
      return button;
    };
    if (state === null || state.kind === "loading") {
      body.createDiv({ cls: "mind-trace-report-status", text: "正在检查上一周的记录与周报…" });
      return;
    }
    if (state.kind === "ready" || state.kind === "stale") {
      if (state.kind === "stale") {
        header.createSpan({ cls: "mind-trace-report-badge", text: "日记有更新" });
      }
      body.createEl("p", { text: state.summary });
      action("打开完整周报", () => void this.openWeeklyReportFile(state.file.path), true);
      if (state.kind === "stale") {
        action("更新周报", () => {
          new WeeklyReportRegenerateModal(this.app, () => this.retryWeeklyReport(true)).open();
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
      action("生成周报", () => void this.retryWeeklyReport(false), true);
      return;
    }
    body.createDiv({ cls: "mind-trace-report-status-title", text: "周报暂时没有生成" });
    body.createEl("p", { text: state.message });
    action("重试生成", () => void this.retryWeeklyReport(false), true);
    action("打开设置", () => this.plugin.openSettings());
  }
  renderRecordHistory(container, entries) {
    const card = container.createEl("section", { cls: "mind-trace-record-card" });
    card.createDiv({ cls: "mind-trace-home-section-title", text: "记录履历", attr: { role: "heading", "aria-level": "2" } });
    const streaks = calculateStreaks(entries);
    const dates = new Set(entries.map((entry) => entry.date));
    const sessions = entries.reduce((sum, entry) => sum + entry.sessions, 0);
    const stats = card.createDiv({ cls: "mind-trace-record-stats" });
    for (const [label, value] of [["当前连续", `${streaks.current} 天`], ["记录日", `${dates.size} 天`], ["总篇数", `${sessions} 篇`], ["最长连续", `${streaks.longest} 天`]]) {
      const item = stats.createDiv();
      item.createSpan({ text: label });
      item.createEl("strong", { text: value });
    }
    const dots = card.createDiv({ cls: "mind-trace-record-dots", attr: { role: "img", "aria-label": "最近十四天记录情况" } });
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = localDateString(addLocalDays(new Date(), -offset));
      dots.createSpan({ cls: `mind-trace-record-dot${dates.has(date) ? " is-recorded" : ""}`, attr: { title: date } });
    }
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
          text: `+${entry.themes.length - 3}`,
          attr: { title: entry.themes.join("、") }
        });
      }
    }
    main.createSpan({
      cls: "mind-trace-home-sessions",
      text: `${entry.sessions} 篇`
    });
    main.createSpan({
      cls: "mind-trace-home-row-arrow",
      text: "→",
      attr: { "aria-hidden": "true" }
    });
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
  renderJournal(container) {
    const draft = this.plugin.draft ?? createDraft(this.plugin.settings);
    draft.entryDate = draftEntryDate(draft);
    const shell = container.createDiv({
      cls: `mind-trace-journal-shell ${draft.generated !== null ? "is-preview" : draft.step === 0 ? "is-checkin" : "is-question"}`
    });
    const backButton = shell.createEl("button", {
      cls: "mind-trace-home-back",
      text: "← 返回",
      attr: { type: "button", "aria-label": "返回心迹主页" }
    });
    backButton.addEventListener("click", () => {
      this.mode = "home";
      this.render();
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
        text: "\u6E05\u9664\u8349\u7A3F",
        attr: { type: "button", "aria-label": "\u6E05\u9664\u672A\u5B8C\u6210\u8349\u7A3F" }
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
        text: "\u8FDE\u63A5"
      });
      setup.createDiv({
        cls: "mind-trace-empty-title",
        text: "\u5148\u9009\u62E9\u4E00\u4E2A\u6A21\u578B\u670D\u52A1",
        attr: { role: "heading", "aria-level": "2" }
      });
      setup.createEl("p", {
        text: "\u914D\u7F6E\u6A21\u578B\u540D\u79F0\u548C API Key \u540E\uFF0C\u5C31\u53EF\u4EE5\u5F00\u59CB\u7B2C\u4E00\u7BC7\u5FC3\u8FF9\u65E5\u8BB0\u3002"
      });
      const button = setup.createEl("button", {
        cls: "mod-cta",
        text: "\u6253\u5F00\u8BBE\u7F6E",
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
      const phrases = loading.createSpan({
        cls: "mind-trace-loading-phrases"
      });
      phrases.createSpan({ text: this.busyText });
      phrases.createSpan({
        text: "心迹正在斟酌字句…",
        attr: { "aria-hidden": "true" }
      });
      phrases.createSpan({
        text: "墨快研好了…",
        attr: { "aria-hidden": "true" }
      });
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
          new import_obsidian4.Notice("只能选择今天或过去的日期");
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
        eyebrow: "\u4ECA\u65E5\u5FC3\u8FF9 \xB7 \u5B9A\u7A3F\u524D\u6821\u6837",
        title: "\u628A\u4ECA\u5929\u6536\u597D",
        description: "\u9501\u5B9A\u524D\u518D\u8BFB\u4E00\u904D\uFF1B\u8FD9\u91CC\u4ECD\u7136\u53EF\u4EE5\u4FEE\u6539\uFF0C\u4FDD\u5B58\u540E\u4F1A\u53D8\u6210\u5B89\u9759\u7684\u9605\u8BFB\u7248\u5F0F\u3002"
      };
    }
    if (draft.step === 0) {
      return {
        eyebrow: "\u4E24\u4E09\u5206\u949F\u7684\u65E5\u8BB0",
        title: "\u7ED9\u4ECA\u5929\u7559\u4E00\u70B9\u4F4D\u7F6E",
        description: "\u5148\u6807\u8BB0\u6B64\u523B\u7684\u72B6\u6001\uFF0C\u518D\u628A\u4ECA\u5929\u4ECE\u65E9\u5230\u665A\u8F7B\u8F7B\u626B\u4E00\u904D\u3002"
      };
    }
    return {
      eyebrow: "\u4ECA\u65E5\u5FC3\u8FF9 \xB7 \u6B63\u5728\u8BB0\u5F55",
      title: "\u6162\u4E00\u70B9\uFF0C\u542C\u542C\u4ECA\u5929",
      description: "\u4E0D\u9700\u8981\u5199\u5F97\u5B8C\u6574\uFF0C\u53EA\u5199\u4E0B\u6B64\u523B\u771F\u5B9E\u60F3\u5230\u7684\u5185\u5BB9\u3002"
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
      text: "\u6B64\u523B\u7684\u72B6\u6001"
    });
    lead.createEl("p", {
      text: "\u4E0D\u5FC5\u89E3\u91CA\uFF0C\u4E5F\u4E0D\u5FC5\u5224\u65AD\u3002\u70B9\u4E00\u4E0B\u6700\u63A5\u8FD1\u4F60\u7684\u6570\u5B57\u3002"
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
        `\u5FC3\u60C5${ratingStateWord("mood", ratingValues.mood)}`,
        `\u7CBE\u529B${ratingStateWord("energy", ratingValues.energy)}`,
        `\u538B\u529B${ratingStateWord("stress", ratingValues.stress)}`
      ].join(" \xB7 ");
    };
    for (const [key, label, metaphor, low, high] of [
      ["mood", "\u5FC3\u60C5", "\u5185\u5728\u5929\u6C14", "\u4F4E\u843D", "\u660E\u4EAE"],
      ["energy", "\u7CBE\u529B", "\u53EF\u7528\u7535\u91CF", "\u8017\u5C3D", "\u5145\u6C9B"],
      ["stress", "\u538B\u529B", "\u80A9\u4E0A\u91CD\u91CF", "\u677E\u5F1B", "\u7D27\u7EF7"]
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
          "aria-label": `${label}\u8BC4\u5206`
        }
      });
      const buttons = [];
      for (let score = 1; score <= 5; score += 1) {
        const button2 = scale.createEl("button", {
          text: String(score),
          attr: {
            type: "button",
            "aria-label": `${label} ${score} \u5206\uFF0C${ratingStateWord(key, score)}`,
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
      text: "\u5F00\u59CB\u56DE\u770B\u4ECA\u5929",
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
    const questionLayout = configuredQuestionLayout(
      this.plugin.settings
    );
    const coreQuestion = draft.step <= coreQuestions.length ? coreQuestions[draft.step - 1] : void 0;
    const question = coreQuestion ?? draft.pendingQuestion;
    const conversation = container.createEl("section", {
      cls: questionLayout === "timeline" ? `mind-trace-conversation is-timeline ${draft.answers.length > 0 ? "has-history" : ""}` : "mind-trace-conversation is-cards"
    });
    if (questionLayout === "timeline") {
      this.renderTimelineHistory(conversation, draft);
    }
    if (question === null) {
      const recovery = conversation.createDiv({
        cls: "mind-trace-decision-card"
      });
      recovery.createDiv({
        cls: "mind-trace-decision-mark",
        text: "\u2713"
      });
      recovery.createDiv({
        cls: "mind-trace-section-kicker",
        text: "\u6838\u5FC3\u8BB0\u5F55\u5DF2\u7ECF\u5B8C\u6210"
      });
      recovery.createDiv({
        cls: "mind-trace-decision-title",
        text: draft.adaptiveCount >= adaptiveQuestionLimit ? "\u8FD9\u4E9B\u5185\u5BB9\uFF0C\u5DF2\u7ECF\u8DB3\u591F\u5199\u6210\u4ECA\u5929" : "\u8981\u4E0D\u8981\u518D\u5F80\u91CC\u770B\u4E00\u70B9\uFF1F",
        attr: { role: "heading", "aria-level": "2" }
      });
      recovery.createEl("p", {
        text: draft.adaptiveCount >= adaptiveQuestionLimit ? "\u63A5\u4E0B\u6765\u4F1A\u6574\u7406\u6210\u65E5\u8BB0\u3001\u53CD\u601D\u6D1E\u5BDF\u548C\u4E00\u4E2A\u660E\u65E5\u5FAE\u884C\u52A8\u3002" : "\u5FC3\u8FF9\u53EF\u4EE5\u6839\u636E\u521A\u624D\u7684\u5185\u5BB9\u518D\u95EE\u4E00\u4E2A\u95EE\u9898\uFF1B\u5982\u679C\u6B64\u523B\u5DF2\u7ECF\u8DB3\u591F\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u6574\u7406\u3002"
      });
      const actions2 = recovery.createDiv({ cls: "mind-trace-actions" });
      if (draft.adaptiveCount < adaptiveQuestionLimit) {
        const continueButton = actions2.createEl("button", {
          cls: "mod-cta",
          text: "\u518D\u95EE\u6211\u4E00\u4E2A\u95EE\u9898",
          attr: { type: "button" }
        });
        continueButton.disabled = this.busy;
        continueButton.addEventListener("click", () => {
          void this.decideFollowUp(draft);
        });
      }
      const generateButton = actions2.createEl("button", {
        cls: draft.adaptiveCount >= adaptiveQuestionLimit ? "mod-cta" : "",
        text: draft.adaptiveCount >= adaptiveQuestionLimit ? "\u6574\u7406\u6210\u65E5\u8BB0" : "\u73B0\u5728\u5C31\u6574\u7406",
        attr: { type: "button" }
      });
      generateButton.disabled = this.busy;
      generateButton.addEventListener("click", () => {
        void this.generateEntry(draft);
      });
      if (questionLayout === "timeline" && draft.answers.length > 0) {
        this.scrollTimelineTo(recovery);
      }
      return;
    }
    const progress = coreQuestion === void 0 ? `\u4E2A\u6027\u5316\u8FFD\u95EE ${draft.adaptiveCount + 1}/${adaptiveQuestionLimit}` : `\u6838\u5FC3\u95EE\u9898 ${draft.step}/${coreQuestions.length}`;
    const stepCount = coreQuestion === void 0 ? adaptiveQuestionLimit : coreQuestions.length;
    const activeStep = coreQuestion === void 0 ? draft.adaptiveCount + 1 : draft.step;
    const writingStage = conversation.createDiv({
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
    index.createSpan({
      text: `/${String(stepCount).padStart(2, "0")}`
    });
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
      text: coreQuestion === void 0 ? "\u8FD9\u662F\u6839\u636E\u4F60\u521A\u624D\u5199\u4E0B\u7684\u5185\u5BB9\u63D0\u51FA\u7684\u3002\u5199\u4E0B\u7B2C\u4E00\u53CD\u5E94\u5C31\u597D\u3002" : "\u5199\u4E0B\u7B2C\u4E00\u53CD\u5E94\u5C31\u597D\uFF1B\u51E0\u4E2A\u7247\u6BB5\u3001\u5173\u952E\u8BCD\u6216\u4E00\u53E5\u5B8C\u6574\u7684\u8BDD\u90FD\u53EF\u4EE5\u3002"
    });
    const answer = sheet.createEl("textarea", {
      cls: "mind-trace-question-editor",
      attr: {
        rows: "8",
        placeholder: "\u4ECE\u8FD9\u91CC\u5F00\u59CB\u5199\u2026"
      }
    });
    autoGrow(answer);
    answer.disabled = this.busy;
    const footer = sheet.createDiv({
      cls: "mind-trace-question-footer"
    });
    footer.createSpan({
      text: "\u5199\u5230\u80FD\u8BA4\u51FA\u4ECA\u5929\uFF0C\u5C31\u591F\u4E86"
    });
    const actions = footer.createDiv({ cls: "mind-trace-actions" });
    const submit = actions.createEl("button", {
      cls: "mod-cta",
      text: coreQuestion === void 0 ? "\u7EE7\u7EED" : "\u4E0B\u4E00\u9898",
      attr: { type: "button" }
    });
    submit.disabled = this.busy;
    submit.addEventListener("click", () => {
      const value = answer.value.trim();
      if (value.length === 0) {
        new import_obsidian4.Notice("\u5148\u5199\u4E0B\u4E00\u70B9\u5185\u5BB9\u518D\u7EE7\u7EED");
        answer.focus();
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
        text: "\u8DF3\u8FC7\u5E76\u751F\u6210\u65E5\u8BB0",
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
    if (questionLayout === "timeline" && draft.answers.length > 0) {
      this.scrollTimelineTo(writingStage, answer);
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
        "aria-label": "\u5DF2\u7ECF\u5B8C\u6210\u7684\u95EE\u7B54"
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
        text: answer.kind === "core" ? "\u6838\u5FC3\u95EE\u9898 \xB7 \u5DF2\u5B8C\u6210" : "\u4E2A\u6027\u5316\u8FFD\u95EE \xB7 \u5DF2\u5B8C\u6210"
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
            new import_obsidian4.Notice("回答不能留空");
            input.focus();
            return;
          }
          const previous = answer.answer;
          answer.answer = value;
          save.disabled = true;
          save.textContent = "保存中…";
          void this.plugin.saveDraftSilently(draft).then(() => {
            answerCopy.textContent = value;
            finish();
            new import_obsidian4.Notice("回答已更新");
          }).catch((reason) => {
            answer.answer = previous;
            save.disabled = false;
            save.textContent = "保存修改";
            new import_obsidian4.Notice(errorMessage(reason));
          });
        });
        window.requestAnimationFrame(() => {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        });
      });
    }
  }
  scrollTimelineTo(element, focusTarget) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
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
          behavior: window.matchMedia(
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
      const overflowY = window.getComputedStyle(parent).overflowY;
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void next();
      return;
    }
    stage.addClass("is-leaving");
    window.setTimeout(() => {
      void next();
    }, 180);
  }
  renderPreview(container, draft) {
    const generated = draft.generated;
    if (generated === null) {
      return;
    }
    container.addClass("is-preview");
    const ratingEditors = this.renderRatingComparison(container, draft);
    const reviewMap = container.createDiv({
      cls: "mind-trace-review-map",
      attr: {
        role: "list",
        "aria-label": "\u65E5\u8BB0\u5185\u5BB9\u6982\u89C8"
      }
    });
    for (const [label, value] of [
      ["\u6B63\u6587", "1 \u7BC7"],
      ["\u4ECA\u65E5\u5207\u7247", `${generated.facets.length} \u4E2A`],
      ["\u53CD\u601D\u6D1E\u5BDF", `${generated.insights.length} \u6761`],
      ["\u660E\u65E5\u884C\u52A8", "1 \u6B65"]
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
      text: "\u4ECA\u65E5 \xB7 \u672A\u4FDD\u5B58"
    });
    diaryTitle.createDiv({
      cls: "mind-trace-card-title mind-trace-diary-title",
      text: "\u4ECA\u5929\u7684\u6B63\u6587",
      attr: { role: "heading", "aria-level": "2" }
    });
    const diaryMeta = diaryHeading.createDiv({
      cls: "mind-trace-diary-meta"
    });
    diaryMeta.createSpan({ text: "\u65E5\u8BB0\u6821\u6837" });
    diaryMeta.createSpan({ text: "\u53EF\u76F4\u63A5\u4FEE\u6539" });
    const diaryWriting = diarySection.createDiv({
      cls: "mind-trace-diary-writing"
    });
    const diary = diaryWriting.createEl("textarea", {
      cls: "mind-trace-editor-area mind-trace-diary-editor",
      text: generated.diary,
      attr: {
        rows: "9",
        "aria-label": "\u65E5\u8BB0\u6B63\u6587"
      }
    });
    autoGrow(diary);
    const facetsSection = container.createEl("section", {
      cls: "mind-trace-facets-section"
    });
    const facetsHeading = facetsSection.createDiv({
      cls: "mind-trace-card-heading"
    });
    facetsHeading.createDiv({
      cls: "mind-trace-card-title",
      text: "\u4ECA\u5929\u7531\u8FD9\u4E9B\u7EC4\u6210",
      attr: { role: "heading", "aria-level": "2" }
    });
    facetsHeading.createSpan({ text: "\u667A\u80FD\u5207\u7247 \xB7 \u53EF\u7F16\u8F91" });
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
        text: "\u4ECA\u65E5\u5207\u7247"
      });
      facetHeader.createSpan({
        cls: "mind-trace-facet-edit-hint",
        text: "\u70B9\u6807\u9898\u53EF\u4FEE\u6539"
      });
      const category = card.createEl("input", {
        cls: "mind-trace-facet-category",
        attr: {
          type: "text",
          value: facet.category,
          maxlength: "12",
          "aria-label": `\u667A\u80FD\u5207\u7247 ${index + 1} \u7C7B\u522B`
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
          "aria-label": `\u667A\u80FD\u5207\u7247 ${facet.category} \u603B\u7ED3`
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
      text: "\u6211\u4ECE\u4ECA\u5929\u770B\u89C1",
      attr: { role: "heading", "aria-level": "2" }
    });
    insightsHeading.createSpan({ text: "\u50CF\u9875\u8FB9\u6279\u6CE8\u4E00\u6837\uFF0C\u7559\u4E0B\u4E00\u5C42\u7406\u89E3" });
    const insightInputs = generated.insights.map((insight, index) => {
      const row = insightsSection.createDiv({
        cls: "mind-trace-insight-row"
      });
      row.createSpan({
        cls: "mind-trace-insight-mark",
        text: `\u89C2\u5BDF ${index + 1}`,
        attr: { "aria-hidden": "true" }
      });
      const input = row.createEl("textarea", {
        cls: "mind-trace-editor-area mind-trace-insight-editor",
        text: insight,
        attr: {
          rows: "2",
          "aria-label": "\u53CD\u601D\u6D1E\u5BDF"
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
      text: "\u660E\u5929\u6700\u5C0F\u7684\u4E00\u6B65",
      attr: { role: "heading", "aria-level": "2" }
    });
    actionHeading.createSpan({ text: "\u53EA\u505A\u8FD9\u4E00\u5C0F\u6B65" });
    const actionBody = actionSection.createDiv({
      cls: "mind-trace-action-body"
    });
    const action = actionBody.createEl("textarea", {
      cls: "mind-trace-editor-area mind-trace-compact-editor",
      text: generated.microAction,
      attr: {
        rows: "3",
        "aria-label": "\u660E\u65E5\u5FAE\u884C\u52A8"
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
      text: "\u7559\u7ED9\u660E\u5929\u7684\u4E00\u4E2A\u95EE\u9898",
      attr: { role: "heading", "aria-level": "2" }
    });
    questionHeading.createSpan({ text: "\u4E0D\u6025\u7740\u56DE\u7B54" });
    const questionBody = questionSection.createDiv({
      cls: "mind-trace-question-body"
    });
    questionBody.createSpan({
      cls: "mind-trace-question-mark",
      text: "\uFF1F",
      attr: { "aria-hidden": "true" }
    });
    const selfQuestion = questionBody.createEl("textarea", {
      cls: "mind-trace-editor-area mind-trace-compact-editor",
      text: generated.selfQuestion,
      attr: {
        rows: "3",
        "aria-label": "\u7559\u7ED9\u81EA\u5DF1\u7684\u95EE\u9898"
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
      text: "\u4ECA\u5929\u5173\u4E8E",
      attr: { role: "heading", "aria-level": "2" }
    });
    themesHeading.createSpan({ text: "\u6700\u591A 5 \u4E2A\u4E3B\u9898" });
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
      text: "\u51C6\u5907\u5B9A\u7A3F\u4E86\u5417\uFF1F"
    });
    footerCopy.createEl("p", {
      text: "\u9501\u5B9A\u540E\u4F1A\u5199\u5165\u4ECA\u5929\u7684\u5FC3\u8FF9\u65E5\u8BB0\uFF0C\u5E76\u4EE5\u9605\u8BFB\u7248\u5F0F\u6253\u5F00\uFF1B\u539F\u59CB\u95EE\u7B54\u6298\u53E0\u5728 Markdown \u6587\u672B\u3002"
    });
    const actions = footer.createDiv({ cls: "mind-trace-actions" });
    const regenerate = actions.createEl("button", {
      cls: "mind-trace-secondary-button",
      text: "\u91CD\u65B0\u6574\u7406",
      attr: { type: "button" }
    });
    regenerate.disabled = this.busy;
    regenerate.addEventListener("click", () => {
      draft.generated = null;
      void this.generateEntry(draft);
    });
    const save = actions.createEl("button", {
      cls: "mod-cta mind-trace-save-button",
      text: "\u9501\u5B9A\u5E76\u4FDD\u5B58",
      attr: { type: "button" }
    });
    save.disabled = this.busy;
    save.addEventListener("click", () => {
      const entry = this.previewEntry(
        diary,
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
      text: hasAssessment ? "\u72B6\u6001\u5BF9\u7167 \xB7 AI \u76F2\u8BC4" : "\u72B6\u6001\u56DE\u770B"
    });
    copy.createDiv({
      cls: "mind-trace-rating-comparison-title",
      text: hasAssessment ? "\u540C\u4E00\u5929\uFF0C\u4E24\u79CD\u8BFB\u6CD5" : "\u8FD9\u662F\u6211\u6B64\u523B\u7684\u611F\u53D7",
      attr: { role: "heading", "aria-level": "2" }
    });
    copy.createEl("p", {
      text: hasAssessment ? "\u4F60\u7684\u5206\u6570\u6765\u81EA\u5185\u5728\u611F\u53D7\uFF1BAI \u6CA1\u6709\u770B\u5230\u5B83\uFF0C\u53EA\u6839\u636E\u56DE\u7B54\u4E2D\u7684\u8BED\u8A00\u7559\u4E0B\u53E6\u4E00\u79CD\u89C2\u5BDF\u3002\u5DEE\u5F02\u4E0D\u662F\u5BF9\u9519\u3002" : "\u53EF\u4EE5\u5728\u4FDD\u5B58\u524D\u5FAE\u8C03\u3002\u91CD\u65B0\u6574\u7406\u540E\uFF0CAI \u4F1A\u5728\u770B\u4E0D\u5230\u81EA\u8BC4\u7684\u60C5\u51B5\u4E0B\u7559\u4E0B\u53E6\u4E00\u79CD\u89C2\u5BDF\u3002"
    });
    heading.createSpan({
      cls: "mind-trace-rating-comparison-badge",
      text: hasAssessment ? "\u72EC\u7ACB\u89C2\u5BDF" : "\u7B49\u5F85 AI \u89C2\u5BDF"
    });
    const grid = section.createDiv({
      cls: "mind-trace-rating-comparison-grid"
    });
    const editors = {};
    for (const [key, label] of [
      ["mood", "\u5FC3\u60C5"],
      ["energy", "\u7CBE\u529B"],
      ["stress", "\u538B\u529B"]
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
        text: detail === void 0 ? "\u7B49\u5F85\u5BF9\u7167" : ratingDifferenceText(draft.ratings[key], detail.score)
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
        "\u6211\u7684\u611F\u53D7",
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
      aiHeading.createSpan({ text: "AI \u89C2\u5BDF" });
      aiHeading.createEl("output", {
        text: detail === void 0 ? "\u2014" : `${detail.score}/5 \xB7 ${ratingStateWord(key, detail.score)}`
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
        text: detail === void 0 ? "\u5B8C\u6210\u4E00\u6B21\u65B0\u7684\u6574\u7406\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A AI \u7684\u72EC\u7ACB\u5224\u65AD\u4F9D\u636E\u3002" : detail.reason
      });
    }
    return editors;
  }
  previewEntry(diary, facets, insights, action, selfQuestion, themes) {
    const facetValues = facets.map((facet) => ({
      category: facet.category.value.trim(),
      summary: facet.summary.value.trim()
    }));
    const insightValues = insights.map((value) => value.value.trim()).filter((value) => value.length > 0);
    const themeValues = themes.getValues();
    if (diary.value.trim().length === 0 || action.value.trim().length === 0 || selfQuestion.value.trim().length === 0) {
      new import_obsidian4.Notice("\u65E5\u8BB0\u3001\u5FAE\u884C\u52A8\u548C\u81EA\u6211\u95EE\u9898\u4E0D\u80FD\u4E3A\u7A7A");
      return null;
    }
    if (facetValues.some(
      (facet) => facet.category.length === 0 || facet.summary.length === 0
    )) {
      new import_obsidian4.Notice("\u667A\u80FD\u5207\u7247\u7684\u7C7B\u522B\u548C\u603B\u7ED3\u4E0D\u80FD\u4E3A\u7A7A");
      return null;
    }
    if (facetValues.length < 2 || facetValues.length > 6) {
      new import_obsidian4.Notice("\u667A\u80FD\u5207\u7247\u9700\u8981\u4FDD\u7559 2\u20136 \u6761");
      return null;
    }
    if (new Set(facetValues.map((facet) => facet.category)).size !== facetValues.length) {
      new import_obsidian4.Notice("\u667A\u80FD\u5207\u7247\u7684\u7C7B\u522B\u4E0D\u80FD\u91CD\u590D");
      return null;
    }
    if (insightValues.length < 2 || insightValues.length > 4) {
      new import_obsidian4.Notice("\u53CD\u601D\u6D1E\u5BDF\u9700\u8981\u4FDD\u7559 2\u20134 \u6761");
      return null;
    }
    if (themeValues.length < 1 || themeValues.length > 5) {
      new import_obsidian4.Notice("\u4E3B\u9898\u9700\u8981\u4FDD\u7559 1\u20135 \u4E2A");
      return null;
    }
    return {
      diary: diary.value.trim(),
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
    await this.runBusy("\u6B63\u5728\u51C6\u5907\u4E00\u4E2A\u8D34\u5408\u4F60\u7684\u8FFD\u95EE\u2026", async () => {
      const decision = await generateFollowUp(
        this.plugin.createProvider(),
        draft
      );
      if (decision.continue && draft.adaptiveCount < draftAdaptiveQuestionLimit(draft)) {
        draft.pendingQuestion = decision.question;
        await this.plugin.setDraft(draft);
      } else {
        await this.generateEntryContent(draft);
      }
    });
  }
  async generateEntry(draft) {
    await this.runBusy("\u6B63\u5728\u6574\u7406\u65E5\u8BB0\u548C\u53CD\u601D\u2026", async () => {
      await this.generateEntryContent(draft);
    });
  }
  async persistAndGenerate(draft) {
    await this.plugin.setDraft(draft);
    await this.generateEntry(draft);
  }
  async generateEntryContent(draft) {
    this.busyText = "\u6B63\u5728\u72EC\u7ACB\u8BC4\u4F30\u72B6\u6001\u5E76\u6574\u7406\u65E5\u8BB0\u2026";
    this.render();
    const provider = this.plugin.createProvider();
    const history = await this.plugin.repository.recentContext(
      this.plugin.settings,
      parseLocalDate(draftEntryDate(draft)) ?? /* @__PURE__ */ new Date()
    );
    const [generated, assessment] = await Promise.all([
      generateJournal(
        provider,
        draft,
        history,
        this.plugin.settings
      ),
      generateRatingAssessment(provider, draft)
    ]);
    draft.generated = generated;
    draft.aiAssessment = assessment;
    await this.plugin.setDraft(draft);
  }
  async saveDraftEntry(draft, entry) {
    await this.runBusy("\u6B63\u5728\u4FDD\u5B58\u65E5\u8BB0\u2026", async () => {
      await this.plugin.setDraft(draft);
      const file = await this.plugin.saveEntry(
        draft,
        entry,
        entryDateWithCurrentTime(draftEntryDate(draft))
      );
      await this.plugin.setDraft(null);
      new import_obsidian4.Notice(`\u5FC3\u8FF9\u5DF2\u4FDD\u5B58\uFF1A${file.path}`);
      await this.leaf.setViewState({
        type: SAVED_JOURNAL_VIEW_TYPE,
        state: { file: file.path },
        active: true
      });
    });
  }
  async clearDraft() {
    await this.plugin.setDraft(null);
    new import_obsidian4.Notice("\u5FC3\u8FF9\u8349\u7A3F\u5DF2\u6E05\u9664");
  }
  async runBusy(text, action) {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.busyText = text;
    this.render();
    try {
      await action();
    } catch (error) {
      new import_obsidian4.Notice(errorMessage(error), 8e3);
    } finally {
      this.busy = false;
      this.busyText = "";
      if (this.leaf.view === this) {
        this.render();
      }
    }
  }
};

// src/settings.ts
var import_obsidian5 = require("obsidian");
var PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  "openai-compatible": "OpenAI-compatible"
};
var TONE_LABELS = {
  gentle: "\u6E29\u548C\u4F46\u5177\u4F53",
  direct: "\u76F4\u63A5\u6559\u7EC3\u5F0F",
  companion: "\u7EAF\u966A\u4F34\u5F0F"
};
var PrivacyPasswordModal = class extends import_obsidian5.Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("mind-trace-password-modal");
    const configured = this.plugin.isPasswordConfigured();
    contentEl.createEl("h2", { text: configured ? "管理心迹密码" : "设置心迹密码" });
    contentEl.createEl("p", {
      text: "密码只保护心迹插件界面，不会加密 Vault 中的 Markdown 原文。"
    });
    const form = contentEl.createEl("form", { cls: "mind-trace-password-form" });
    let current = null;
    if (configured && !this.plugin.isPrivacyUnlocked()) {
      current = form.createEl("input", {
        attr: {
          type: "password",
          placeholder: "当前密码",
          autocomplete: "current-password",
          "aria-label": "当前心迹密码"
        }
      });
    }
    const next = form.createEl("input", {
      attr: {
        type: "password",
        placeholder: configured ? "新密码（至少 8 个字符）" : "密码（至少 8 个字符）",
        autocomplete: "new-password",
        "aria-label": configured ? "新心迹密码" : "心迹密码"
      }
    });
    const confirmation = form.createEl("input", {
      attr: {
        type: "password",
        placeholder: "再次输入新密码",
        autocomplete: "new-password",
        "aria-label": "确认新心迹密码"
      }
    });
    const error = form.createEl("p", {
      cls: "mind-trace-lock-error",
      attr: { role: "alert", "aria-live": "polite" }
    });
    const actions = form.createDiv({ cls: "mind-trace-actions" });
    const save = actions.createEl("button", {
      cls: "mod-cta",
      text: configured ? "更新密码" : "设置密码",
      attr: { type: "submit" }
    });
    if (configured) {
      const remove = actions.createEl("button", {
        cls: "mod-warning",
        text: "移除密码",
        attr: { type: "button" }
      });
      remove.addEventListener("click", () => {
        if (current !== null && current.value.length === 0) {
          error.textContent = "请输入当前密码";
          current.focus();
          return;
        }
        if (!window.confirm("移除密码后，心迹页面将要求重新设置密码才能进入。确定移除吗？")) {
          return;
        }
        remove.disabled = true;
        void this.plugin.removePrivacyPassword(current?.value ?? "").then(() => {
          new import_obsidian5.Notice("心迹密码已移除");
          this.close();
          this.onDone();
        }).catch((reason) => {
          error.textContent = reason instanceof Error ? reason.message : "无法移除密码";
          remove.disabled = false;
        });
      });
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      error.textContent = "";
      if (next.value.length < 8) {
        error.textContent = "密码至少需要 8 个字符";
        next.focus();
        return;
      }
      if (next.value !== confirmation.value) {
        error.textContent = "两次输入的新密码不一致";
        confirmation.focus();
        return;
      }
      save.disabled = true;
      void (configured ? this.plugin.changePrivacyPassword(current?.value ?? "", next.value) : this.plugin.configurePrivacyPassword(next.value)).then(() => {
        new import_obsidian5.Notice(configured ? "心迹密码已更新" : "心迹密码已设置");
        this.close();
        this.onDone();
      }).catch((reason) => {
        error.textContent = reason instanceof Error ? reason.message : "无法保存密码";
        save.disabled = false;
      });
    });
    window.requestAnimationFrame(() => (current ?? next).focus());
  }
  onClose() {
    this.contentEl.empty();
  }
};
var MindTraceSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("mind-trace-settings");
    const header = containerEl.createDiv({
      cls: "mind-trace-settings-header"
    });
    header.createDiv({
      cls: "mind-trace-eyebrow",
      text: "\u5FC3\u8FF9 \xB7 \u504F\u597D"
    });
    header.createDiv({
      cls: "mind-trace-settings-title",
      text: "\u8BA9\u8BB0\u5F55\u66F4\u50CF\u4F60",
      attr: { role: "heading", "aria-level": "2" }
    });
    header.createEl("p", {
      text: "\u9009\u62E9\u6A21\u578B\u3001\u53CD\u601D\u65B9\u5F0F\u548C\u65E5\u8BB0\u4FDD\u5B58\u4E60\u60EF\u3002\u4FEE\u6539\u4F1A\u81EA\u52A8\u4FDD\u5B58\u3002"
    });
    const providerSection = this.createSection(
      "\u6A21\u578B\u4E0E\u8FDE\u63A5",
      "\u7528\u4E8E\u4E2A\u6027\u5316\u8FFD\u95EE\u3001\u6574\u7406\u65E5\u8BB0\u548C\u751F\u6210\u53CD\u601D\u3002"
    );
    new import_obsidian5.Setting(providerSection).setName("\u6A21\u578B\u670D\u52A1").setDesc("\u9009\u62E9\u5F53\u524D\u7528\u4E8E\u8FFD\u95EE\u548C\u751F\u6210\u65E5\u8BB0\u7684\u670D\u52A1").addDropdown((dropdown) => {
      for (const [value, label] of Object.entries(PROVIDER_LABELS)) {
        dropdown.addOption(value, label);
      }
      dropdown.setValue(this.plugin.settings.activeProvider).onChange(async (value) => {
        this.plugin.settings.activeProvider = value;
        await this.plugin.saveProviderSettings();
        this.display();
      });
    });
    this.renderActiveProvider(providerSection);
    new import_obsidian5.Setting(providerSection).setName("\u6D4B\u8BD5\u8FDE\u63A5").setDesc("\u53D1\u9001\u4E00\u4E2A\u6700\u5C0F\u8BF7\u6C42\uFF0C\u9A8C\u8BC1\u5F53\u524D\u6A21\u578B\u3001\u5730\u5740\u548C\u5BC6\u94A5").addButton(
      (button) => button.setButtonText("\u6D4B\u8BD5").onClick(async () => {
        button.setDisabled(true);
        button.setButtonText("\u6D4B\u8BD5\u4E2D\u2026");
        try {
          const response = await this.plugin.createProvider().generate(
            [
              {
                role: "user",
                content: "\u53EA\u56DE\u590D\uFF1A\u8FDE\u63A5\u6210\u529F"
              }
            ],
            "test"
          );
          new import_obsidian5.Notice(
            response.trim().length > 0 ? `\u5FC3\u8FF9\uFF1A${response.trim().slice(0, 80)}` : "\u5FC3\u8FF9\uFF1A\u8FDE\u63A5\u6210\u529F"
          );
        } catch (error) {
          new import_obsidian5.Notice(
            error instanceof Error ? error.message : "\u6A21\u578B\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25"
          );
        } finally {
          button.setDisabled(false);
          button.setButtonText("\u6D4B\u8BD5");
        }
      })
    );
    this.renderDialogueSettings();
    const journalSection = this.createSection(
      "\u65E5\u8BB0\u4E0E\u53CD\u601D",
      "\u51B3\u5B9A\u65E5\u8BB0\u4FDD\u5B58\u5728\u54EA\u91CC\uFF0C\u4EE5\u53CA\u5FC3\u8FF9\u5982\u4F55\u56DE\u5E94\u4F60\u3002"
    );
    new import_obsidian5.Setting(journalSection).setName("\u65E5\u8BB0\u76EE\u5F55").setDesc("\u5FC3\u8FF9\u65E5\u8BB0\u5728\u5F53\u524D Vault \u4E2D\u7684\u4FDD\u5B58\u76EE\u5F55").addText(
      (text) => text.setPlaceholder("\u5FC3\u8FF9\u65E5\u8BB0").setValue(this.plugin.settings.journalFolder).onChange(async (value) => {
        this.plugin.settings.journalFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    const historySetting = new import_obsidian5.Setting(journalSection).setName("\u53C2\u8003\u8FD1\u671F\u65E5\u8BB0").setDesc(
      `\u5F53\u524D\u4E3A\u6700\u8FD1 ${this.plugin.settings.historyDays} \u5929\uFF1B0 \u8868\u793A\u4E0D\u5411\u6A21\u578B\u53D1\u9001\u5386\u53F2`
    );
    let historyText;
    let historySlider;
    const applyHistoryDays = async (raw, source) => {
      if (!Number.isFinite(raw)) {
        return;
      }
      const value = Math.max(0, Math.min(30, Math.round(raw)));
      this.plugin.settings.historyDays = value;
      historySetting.setDesc(
        `\u5F53\u524D\u4E3A\u6700\u8FD1 ${value} \u5929\uFF1B0 \u8868\u793A\u4E0D\u5411\u6A21\u578B\u53D1\u9001\u5386\u53F2`
      );
      if (source !== "text") {
        historyText?.setValue(String(value));
      } else if (historyText?.getValue() !== String(value)) {
        historyText?.setValue(String(value));
      }
      if (source !== "slider") {
        historySlider?.setValue(value);
      }
      await this.plugin.saveSettings();
    };
    historySetting.addText((text) => {
      historyText = text;
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.max = "30";
      text.inputEl.step = "1";
      text.inputEl.addClass("mind-trace-number-input");
      text.setValue(String(this.plugin.settings.historyDays)).onChange(async (value) => {
        if (value.trim().length > 0) {
          await applyHistoryDays(Number(value), "text");
        }
      });
      text.inputEl.addEventListener("blur", () => {
        text.setValue(String(this.plugin.settings.historyDays));
      });
    });
    historySetting.addSlider(
      (slider) => {
        historySlider = slider;
        slider.setLimits(0, 30, 1).setValue(this.plugin.settings.historyDays).setDynamicTooltip().onChange(async (value) => {
          await applyHistoryDays(value, "slider");
        });
      }
    );
    new import_obsidian5.Setting(journalSection).setName("\u53CD\u601D\u8BED\u6C14").setDesc("\u63A7\u5236\u6D1E\u5BDF\u548C\u5EFA\u8BAE\u7684\u9ED8\u8BA4\u8868\u8FBE\u65B9\u5F0F").addDropdown((dropdown) => {
      for (const [value, label] of Object.entries(TONE_LABELS)) {
        dropdown.addOption(value, label);
      }
      dropdown.setValue(this.plugin.settings.reflectionTone).onChange(async (value) => {
        this.plugin.settings.reflectionTone = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian5.Setting(journalSection).setName("\u4E2A\u4EBA\u5316\u8BF4\u660E").setDesc("\u4F8B\u5982\uFF1A\u5C11\u7528\u9F13\u52B1\u5957\u8BDD\u3001\u5173\u6CE8\u5DE5\u4F5C\u8FB9\u754C\u3001\u4E0D\u8981\u66FF\u6211\u4E0B\u7ED3\u8BBA").addTextArea(
      (text) => text.setPlaceholder("\u53EF\u9009").setValue(this.plugin.settings.customInstructions).onChange(async (value) => {
        this.plugin.settings.customInstructions = value.trim();
        await this.plugin.saveSettings();
      })
    );
    const analysisSection = this.createSection(
      "\u56DE\u987E\u4E0E\u5206\u6790",
      "\u5728\u5B8C\u6574\u81EA\u7136\u5468\u7ED3\u675F\u540E\u751F\u6210\u7ED3\u6784\u5316\u56DE\u987E\uFF1B\u53EA\u6709\u8FDB\u5165\u5DF2\u89E3\u9501\u7684\u5FC3\u8FF9\u9996\u9875\u65F6\u624D\u4F1A\u8BF7\u6C42\u6A21\u578B\u3002"
    );
    new import_obsidian5.Setting(analysisSection).setName("\u81EA\u52A8\u8865\u9F50\u4E0A\u5468\u5468\u62A5").setDesc(
      "\u6BCF\u4E2A\u5E94\u7528\u4F1A\u8BDD\u5BF9\u6700\u8FD1\u4E00\u4E2A\u5B8C\u6574\u5468\u6700\u591A\u81EA\u52A8\u5C1D\u8BD5\u4E00\u6B21\uFF0C\u4E0D\u4F1A\u8986\u76D6\u5DF2\u6709\u62A5\u544A"
    ).addToggle((toggle) => toggle.setValue(this.plugin.settings.weeklyReportAutoGenerate !== false).onChange(async (value) => {
      this.plugin.settings.weeklyReportAutoGenerate = value;
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
    }));
    const minimumDays = Math.min(7, Math.max(3, Number(this.plugin.settings.weeklyReportMinimumDays) || 3));
    this.plugin.settings.weeklyReportMinimumDays = minimumDays;
    const minimumSetting = new import_obsidian5.Setting(analysisSection).setName("\u5468\u62A5\u6700\u4F4E\u8BB0\u5F55\u65E5").setDesc(
      `\u5F53\u524D\u4E3A ${minimumDays} \u5929\uFF1B\u4F4E\u4E8E\u95E8\u69DB\u65F6\u4E0D\u8C03\u7528\u6A21\u578B`
    );
    minimumSetting.addSlider((slider) => slider.setLimits(3, 7, 1).setValue(minimumDays).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.weeklyReportMinimumDays = value;
      minimumSetting.setDesc(`\u5F53\u524D\u4E3A ${value} \u5929\uFF1B\u4F4E\u4E8E\u95E8\u69DB\u65F6\u4E0D\u8C03\u7528\u6A21\u578B`);
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
    }));
    new import_obsidian5.Setting(analysisSection).setName("\u5468\u62A5\u4FDD\u5B58\u4F4D\u7F6E").setDesc(
      `${this.plugin.settings.journalFolder}/\u62A5\u544A/\u5468\u62A5\uFF08\u8DDF\u968F\u65E5\u8BB0\u76EE\u5F55\uFF09`
    );
    const privacySection = this.createSection(
      "\u9690\u79C1\u4E0E\u8349\u7A3F",
      "\u5FC3\u8FF9\u5BC6\u7801\u4FDD\u62A4\u63D2\u4EF6\u754C\u9762\uFF0C\u4E0D\u4F1A\u52A0\u5BC6 Vault \u4E2D\u7684 Markdown \u539F\u6587\uFF1B\u672A\u5B8C\u6210\u95EE\u7B54\u4FDD\u5B58\u5728\u63D2\u4EF6 data.json \u4E2D\u3002"
    );
    new import_obsidian5.Setting(privacySection).setName("心迹密码").setDesc(
      this.plugin.isPasswordConfigured() ? this.plugin.isPrivacyUnlocked() ? "已设置 · 当前已解锁，两小时后自动锁定" : "已设置 · 当前已锁定" : "尚未设置；首次进入心迹页面时也可以创建密码"
    ).addButton(
      (button) => button.setButtonText(this.plugin.isPasswordConfigured() ? "管理密码" : "设置密码").onClick(() => {
        new PrivacyPasswordModal(this.app, this.plugin, () => this.display()).open();
      })
    ).addButton(
      (button) => button.setButtonText("立即锁定").setDisabled(!this.plugin.isPrivacyUnlocked()).onClick(() => {
        this.plugin.lockPrivacy(true);
        this.display();
      })
    );
    new import_obsidian5.Setting(privacySection).setName("\u6E05\u9664\u672A\u5B8C\u6210\u8349\u7A3F").setDesc(
      this.plugin.draft === null ? "\u5F53\u524D\u6CA1\u6709\u672A\u5B8C\u6210\u8349\u7A3F" : "\u6E05\u9664\u8BC4\u5206\u3001\u95EE\u7B54\u548C\u5C1A\u672A\u4FDD\u5B58\u7684\u751F\u6210\u7ED3\u679C"
    ).addButton(
      (button) => button.setButtonText("\u6E05\u9664").setWarning().setDisabled(this.plugin.draft === null).onClick(async () => {
        await this.plugin.setDraft(null);
        new import_obsidian5.Notice("\u5FC3\u8FF9\u8349\u7A3F\u5DF2\u6E05\u9664");
        this.display();
      })
    );
  }
  renderDialogueSettings() {
    const section = this.createSection(
      "\u5BF9\u8BDD\u7ED3\u6784",
      "\u9009\u62E9\u63D0\u95EE\u9875\u9762\u7684\u5448\u73B0\u65B9\u5F0F\uFF0C\u5E76\u5B89\u6392\u5FC3\u8FF9\u5148\u95EE\u4EC0\u4E48\u3001\u6700\u591A\u518D\u8FFD\u95EE\u591A\u5C11\u3002\u9875\u9762\u5E03\u5C40\u7ACB\u5373\u751F\u6548\uFF1B\u95EE\u9898\u5185\u5BB9\u548C\u6570\u91CF\u4E0A\u9650\u7528\u4E8E\u4E0B\u4E00\u7BC7\u65B0\u65E5\u8BB0\u3002"
    );
    const coreQuestions = configuredCoreQuestions(this.plugin.settings);
    const adaptiveQuestionLimit = configuredAdaptiveQuestionLimit(
      this.plugin.settings
    );
    const questionLayout = configuredQuestionLayout(
      this.plugin.settings
    );
    new import_obsidian5.Setting(section).setName("\u63D0\u95EE\u9875\u9762").setDesc("\u5361\u7247\u6A21\u5F0F\u4E13\u6CE8\u5F53\u524D\u95EE\u9898\uFF1B\u65F6\u95F4\u7EBF\u6A21\u5F0F\u4FDD\u7559\u5DF2\u7ECF\u5B8C\u6210\u7684\u95EE\u7B54").addDropdown(
      (dropdown) => dropdown.addOption("cards", "\u8BBF\u8C08\u5361\u7247").addOption("timeline", "\u5BF9\u8BDD\u65F6\u95F4\u7EBF").setValue(questionLayout).onChange(async (value) => {
        this.plugin.settings.questionLayout = value === "timeline" ? "timeline" : "cards";
        await this.plugin.saveSettings();
        await this.plugin.setDraft(this.plugin.draft);
      })
    );
    new import_obsidian5.Setting(section).setName("个性化问题最大数量").setDesc("这是追问上限，不要求问满；AI 会根据信息是否充足提前停止。0 表示不追问，最多可设 5 个").addText(
      (text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "5";
        text.inputEl.step = "1";
        text.inputEl.addClass("mind-trace-number-input");
        text.setValue(String(adaptiveQuestionLimit)).onChange(async (raw) => {
          if (raw.trim().length === 0 || !Number.isFinite(Number(raw))) {
            return;
          }
          const value = Math.max(0, Math.min(5, Math.round(Number(raw))));
          if (raw !== String(value)) {
            text.setValue(String(value));
          }
          this.plugin.settings.adaptiveQuestionLimit = value;
          await this.plugin.saveSettings();
        });
        text.inputEl.addEventListener("blur", () => {
          text.setValue(String(configuredAdaptiveQuestionLimit(this.plugin.settings)));
        });
      }
    );
    const editor = section.createDiv({
      cls: "mind-trace-question-config"
    });
    const toolbar = editor.createDiv({
      cls: "mind-trace-question-config-toolbar"
    });
    const toolbarCopy = toolbar.createDiv();
    toolbarCopy.createDiv({
      cls: "mind-trace-question-config-title",
      text: "\u6838\u5FC3\u95EE\u9898"
    });
    toolbarCopy.createEl("p", {
      text: `${coreQuestions.length} \u4E2A\u95EE\u9898 \xB7 \u6309\u987A\u5E8F\u51FA\u73B0\uFF0C\u53EF\u8BBE\u7F6E 1\u20138 \u4E2A`
    });
    const addButton = toolbar.createEl("button", {
      cls: "mind-trace-question-config-add",
      attr: {
        type: "button",
        "aria-label": "\u6DFB\u52A0\u6838\u5FC3\u95EE\u9898"
      }
    });
    (0, import_obsidian5.setIcon)(addButton, "plus");
    addButton.createSpan({ text: "\u6DFB\u52A0" });
    addButton.disabled = coreQuestions.length >= 8;
    addButton.addEventListener("click", () => {
      this.plugin.settings.coreQuestions = [
        ...coreQuestions,
        "\u4ECA\u5929\u8FD8\u6709\u4EC0\u4E48\u503C\u5F97\u8BB0\u4E0B\uFF1F"
      ];
      void this.plugin.saveSettings().then(() => {
        this.display();
      });
    });
    const list = editor.createDiv({
      cls: "mind-trace-question-config-list"
    });
    for (const [index, question] of coreQuestions.entries()) {
      const row = list.createDiv({
        cls: "mind-trace-question-config-row"
      });
      row.createDiv({
        cls: "mind-trace-question-config-index",
        text: String(index + 1).padStart(2, "0"),
        attr: { "aria-hidden": "true" }
      });
      const input = row.createEl("textarea", {
        cls: "mind-trace-question-config-input",
        text: question,
        attr: {
          rows: "2",
          "aria-label": `\u6838\u5FC3\u95EE\u9898 ${index + 1}`
        }
      });
      input.addEventListener("change", () => {
        const value = input.value.trim();
        if (value.length === 0) {
          input.value = question;
          new import_obsidian5.Notice("\u6838\u5FC3\u95EE\u9898\u4E0D\u80FD\u4E3A\u7A7A");
          return;
        }
        const questions = [...coreQuestions];
        questions[index] = value;
        this.plugin.settings.coreQuestions = questions;
        void this.plugin.saveSettings();
      });
      const actions = row.createDiv({
        cls: "mind-trace-question-config-actions"
      });
      this.createQuestionAction(
        actions,
        "arrow-up",
        `\u4E0A\u79FB\u95EE\u9898 ${index + 1}`,
        index === 0,
        () => {
          const questions = [...coreQuestions];
          questions.splice(index, 1);
          questions.splice(index - 1, 0, question);
          this.plugin.settings.coreQuestions = questions;
          void this.plugin.saveSettings().then(() => {
            this.display();
          });
        }
      );
      this.createQuestionAction(
        actions,
        "arrow-down",
        `\u4E0B\u79FB\u95EE\u9898 ${index + 1}`,
        index === coreQuestions.length - 1,
        () => {
          const questions = [...coreQuestions];
          questions.splice(index, 1);
          questions.splice(index + 1, 0, question);
          this.plugin.settings.coreQuestions = questions;
          void this.plugin.saveSettings().then(() => {
            this.display();
          });
        }
      );
      this.createQuestionAction(
        actions,
        "trash-2",
        `\u5220\u9664\u95EE\u9898 ${index + 1}`,
        coreQuestions.length === 1,
        () => {
          this.plugin.settings.coreQuestions = coreQuestions.filter(
            (_, questionIndex) => questionIndex !== index
          );
          void this.plugin.saveSettings().then(() => {
            this.display();
          });
        }
      );
    }
    new import_obsidian5.Setting(section).setName("\u6062\u590D\u63A8\u8350\u95EE\u9898").setDesc("\u6062\u590D\u5FC3\u8FF9\u9ED8\u8BA4\u7684\u4E09\u9053\u95EE\u9898\uFF0C\u4E0D\u5F71\u54CD\u8FDB\u884C\u4E2D\u7684\u8349\u7A3F").addButton(
      (button) => button.setButtonText("\u6062\u590D\u9ED8\u8BA4").onClick(async () => {
        this.plugin.settings.coreQuestions = [...CORE_QUESTIONS];
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }
  createQuestionAction(container, icon, label, disabled, action) {
    const button = container.createEl("button", {
      cls: "clickable-icon",
      attr: {
        type: "button",
        "aria-label": label,
        title: label
      }
    });
    (0, import_obsidian5.setIcon)(button, icon);
    button.disabled = disabled;
    button.addEventListener("click", action);
  }
  createSection(title, description) {
    const section = this.containerEl.createEl("section", {
      cls: "mind-trace-settings-section"
    });
    const heading = section.createDiv({
      cls: "mind-trace-settings-section-heading"
    });
    heading.createDiv({
      cls: "mind-trace-settings-section-title",
      text: title,
      attr: { role: "heading", "aria-level": "3" }
    });
    heading.createEl("p", { text: description });
    return section;
  }
  renderActiveProvider(container) {
    const kind = this.plugin.settings.activeProvider;
    const configuration = this.plugin.settings.providers[kind];
    new import_obsidian5.Setting(container).setName("\u6A21\u578B\u540D\u79F0").setDesc(`\u5F53\u524D\u670D\u52A1\uFF1A${PROVIDER_LABELS[kind]}`).addText(
      (text) => text.setPlaceholder("\u8F93\u5165\u6A21\u578B ID").setValue(configuration.model).onChange(async (value) => {
        configuration.model = value.trim();
        await this.plugin.saveProviderSettings();
      })
    );
    const credentialSetting = new import_obsidian5.Setting(container).setName("\u9274\u6743\u65B9\u5F0F").setDesc(this.plugin.activeCredentialStatus());
    credentialSetting.addDropdown((dropdown) => {
      dropdown.addOption("environment", "\u73AF\u5883\u53D8\u91CF\uFF08\u684C\u9762\u7AEF\uFF09").addOption("secret-storage", "Obsidian Secret Storage");
      if (kind === "openai-compatible") {
        dropdown.addOption("none", "\u65E0\u9700\u9274\u6743");
      }
      dropdown.setValue(configuration.credentialSource).onChange(async (value) => {
        configuration.credentialSource = value;
        await this.plugin.saveProviderSettings();
        this.display();
      });
    });
    if (configuration.credentialSource === "environment") {
      new import_obsidian5.Setting(container).setName("\u73AF\u5883\u53D8\u91CF\u540D\u79F0").setDesc(
        "\u53EA\u8BFB\u53D6\u5F53\u524D Obsidian \u8FDB\u7A0B\u7684\u73AF\u5883\uFF0C\u4E0D\u4F1A\u628A\u53D8\u91CF\u503C\u5199\u5165\u63D2\u4EF6\u6570\u636E"
      ).addText(
        (text) => text.setPlaceholder("GEMINI_API_KEY").setValue(configuration.environmentVariable).onChange(async (value) => {
          configuration.environmentVariable = value.trim();
          await this.plugin.saveProviderSettings();
        })
      );
    }
    if (kind === "openai-compatible") {
      const compatible = this.plugin.settings.providers["openai-compatible"];
      new import_obsidian5.Setting(container).setName("Base URL").setDesc("\u63D2\u4EF6\u4F1A\u5728\u8BE5\u5730\u5740\u540E\u8BF7\u6C42 chat/completions").addText(
        (text) => text.setPlaceholder("http://localhost:11434/v1").setValue(compatible.baseUrl).onChange(async (value) => {
          compatible.baseUrl = value.trim();
          await this.plugin.saveProviderSettings();
        })
      );
    }
    if (configuration.credentialSource === "secret-storage") {
      new import_obsidian5.Setting(container).setName("API Key").setDesc("\u4ECE Obsidian Secret Storage \u9009\u62E9\u6216\u521B\u5EFA\u5BC6\u94A5").addComponent(
        (container2) => new import_obsidian5.SecretComponent(this.app, container2).setValue(configuration.secretId).onChange(async (value) => {
          configuration.secretId = value;
          await this.plugin.saveProviderSettings();
        })
      );
    }
  }
};

// src/storage.ts
var import_obsidian6 = require("obsidian");
function yamlString(value) {
  return JSON.stringify(value);
}
function frontmatterText(frontmatter) {
  return [
    "---",
    "mind-trace: true",
    "mind-trace-version: 1",
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
function ratingDifferenceText2(selfScore, aiScore) {
  const difference = aiScore - selfScore;
  if (difference === 0) {
    return "\u4E00\u81F4";
  }
  return `AI ${difference > 0 ? "\u9AD8" : "\u4F4E"} ${Math.abs(difference)} \u5206`;
}
function ratingComparisonLines(draft) {
  const assessment = draft.aiAssessment;
  if (assessment === void 0) {
    return [];
  }
  const rows = [
    ["mood", "\u5FC3\u60C5"],
    ["energy", "\u7CBE\u529B"],
    ["stress", "\u538B\u529B"]
  ].map(([key, label]) => {
    const selfScore = draft.ratings[key];
    const aiScore = assessment[key].score;
    return `| ${label} | ${selfScore}/5 | ${aiScore}/5 | ${ratingDifferenceText2(selfScore, aiScore)} |`;
  });
  const reasons = [
    ["mood", "\u5FC3\u60C5"],
    ["energy", "\u7CBE\u529B"],
    ["stress", "\u538B\u529B"]
  ].map(
    ([key, label]) => `> - **${label}**\uFF1A${inlineMarkdown(assessment[key].reason)}`
  );
  return [
    "### \u72B6\u6001\u5BF9\u7167",
    "",
    "| \u7EF4\u5EA6 | \u6211\u7684\u611F\u53D7 | AI \u89C2\u5BDF | \u5DEE\u5F02 |",
    "| --- | ---: | ---: | --- |",
    ...rows,
    "",
    "> [!note]- AI \u5224\u65AD\u4F9D\u636E",
    ...reasons,
    ""
  ];
}
function renderJournalSection(date, draft, entry) {
  const insights = entry.insights.map((insight) => `- ${insight}`).join("\n");
  const facets = entry.facets.map(
    (facet) => `- **${facet.category.replace(/\n/g, " ")}**\uFF1A${facet.summary.replace(/\n/g, " ")}`
  ).join("\n");
  const themes = entry.themes.map((theme) => `- ${theme}`).join("\n");
  const transcript = draft.answers.flatMap((answer) => [
    `> **${answer.question}**`,
    ...answer.answer.split("\n").map(quoteCalloutLine),
    ">"
  ]).join("\n");
  return [
    `## ${localTimeString(date)}`,
    "",
    "### \u65E5\u8BB0",
    "",
    entry.diary,
    "",
    "### \u4ECA\u65E5\u5207\u7247",
    "",
    facets,
    "",
    ...ratingComparisonLines(draft),
    "### \u53CD\u601D\u6D1E\u5BDF",
    "",
    insights,
    "",
    "### \u660E\u65E5\u5FAE\u884C\u52A8",
    "",
    entry.microAction,
    "",
    "### \u7559\u7ED9\u81EA\u5DF1\u7684\u95EE\u9898",
    "",
    entry.selfQuestion,
    "",
    "### \u4ECA\u65E5\u4E3B\u9898",
    "",
    themes,
    "",
    "> [!info]- \u539F\u59CB\u95EE\u7B54",
    transcript
  ].join("\n");
}
function renderNewJournal(date, draft, entry) {
  const dateString = localDateString(date);
  const frontmatter = {
    "mind-trace": true,
    "mind-trace-version": 1,
    date: dateString,
    mood: [draft.ratings.mood],
    energy: [draft.ratings.energy],
    stress: [draft.ratings.stress],
    themes: [...new Set(entry.themes)]
  };
  return [
    frontmatterText(frontmatter),
    "",
    `# ${dateString} \u5FC3\u8FF9`,
    "",
    renderJournalSection(date, draft, entry),
    ""
  ].join("\n");
}
function isMindTraceFrontmatter(frontmatter, date) {
  return frontmatter?.["mind-trace"] === true && (date === void 0 || frontmatter.date === date);
}
function numberArray(value, key) {
  if (!Array.isArray(value) || value.some(
    (item) => typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > 5
  )) {
    throw new Error(`\u65E5\u8BB0\u5C5E\u6027 ${key} \u5DF2\u635F\u574F`);
  }
  return value.filter((item) => typeof item === "number");
}
function stringArray(value, key) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`\u65E5\u8BB0\u5C5E\u6027 ${key} \u5DF2\u635F\u574F`);
  }
  return value.filter((item) => typeof item === "string");
}
function updateJournalFrontmatter(frontmatterValue, ratings, themes) {
  if (typeof frontmatterValue !== "object" || frontmatterValue === null || Array.isArray(frontmatterValue)) {
    throw new Error("\u65E5\u8BB0\u5C5E\u6027\u5DF2\u635F\u574F");
  }
  const frontmatter = frontmatterValue;
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
function chooseJournalPath(folder, date, exists) {
  const preferred = `${folder}/${date}.md`;
  if (!exists(preferred)) {
    return preferred;
  }
  const fallback = `${folder}/${date}-\u5FC3\u8FF9.md`;
  if (!exists(fallback)) {
    return fallback;
  }
  let suffix = 2;
  while (exists(`${folder}/${date}-\u5FC3\u8FF9-${suffix}.md`)) {
    suffix += 1;
  }
  return `${folder}/${date}-\u5FC3\u8FF9-${suffix}.md`;
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
    const action = /### 明日微行动\s*\n+([\s\S]*?)(?=\n### |\n> \[!|$)/.exec(
      block
    );
    if (diary?.[1] === void 0) {
      return [];
    }
    const parts = [`\u65E5\u8BB0\uFF1A${diary[1].trim()}`];
    if (action?.[1] !== void 0) {
      parts.push(`\u5FAE\u884C\u52A8\uFF1A${action[1].trim()}`);
    }
    return [parts.join("\n")];
  });
  return excerpts.join("\n\n");
}
var JournalRepository = class {
  constructor(app) {
    this.app = app;
  }
  saving = false;
  async save(draft, entry, settings, date = /* @__PURE__ */ new Date()) {
    if (this.saving) {
      throw new Error("\u65E5\u8BB0\u6B63\u5728\u4FDD\u5B58\uFF0C\u8BF7\u7A0D\u5019");
    }
    this.saving = true;
    try {
      const folder = (0, import_obsidian6.normalizePath)(settings.journalFolder.trim());
      if (folder.length === 0 || folder === "/") {
        throw new Error("\u65E5\u8BB0\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A");
      }
      await this.ensureFolder(folder);
      const dateString = localDateString(date);
      const existing = this.findDateFile(folder, dateString);
      if (existing !== null) {
        await this.app.fileManager.processFrontMatter(
          existing,
          (frontmatter) => {
            updateJournalFrontmatter(
              frontmatter,
              draft.ratings,
              entry.themes
            );
          }
        );
        await this.app.vault.append(
          existing,
          `

---

${renderJournalSection(date, draft, entry)}
`
        );
        return existing;
      }
      const path = chooseJournalPath(
        folder,
        dateString,
        (candidate) => this.app.vault.getAbstractFileByPath(candidate) !== null
      );
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
        excerpts.push(`\u3010${candidate.date}\u3011
${sections}`);
      }
    }
    return excerpts.join("\n\n");
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
      if (this.app.vault.getAbstractFileByPath(current) === null) {
        await this.app.vault.createFolder(current);
      }
    }
  }
};

// src/weekly-report.ts
function weeklyReportFolder(settings) {
  const journalFolder = (0, import_obsidian6.normalizePath)(settings.journalFolder.trim());
  if (journalFolder.length === 0 || journalFolder === "/") {
    throw new Error("\u65E5\u8BB0\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A");
  }
  return `${journalFolder}/\u62A5\u544A/\u5468\u62A5`;
}
function weeklyReportPath(settings, period) {
  return `${weeklyReportFolder(settings)}/${period.start}--${period.end}.md`;
}
function scoreCell(value) {
  return value === null ? "\u2014" : value.toFixed(1);
}
function scoreDelta(current, previous, key) {
  if (current[key] === null || previous[key] === null) {
    return "\u2014";
  }
  const value = current[key] - previous[key];
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}
function evidenceSuffix(dates) {
  return dates.length > 0 ? ` _\uFF08${dates.join("\u3001")}\uFF09_` : "";
}
function weeklyReportMarkdown(source, report) {
  const stats = source.stats;
  const previous = source.previousStats;
  const changes = report.changes.map((item) => `- ${item.observation}${evidenceSuffix(item.evidenceDates)}`).join("\n");
  const causes = report.possibleCauses.map((item) => `- ${item.hypothesis}${evidenceSuffix(item.evidenceDates)}`).join("\n");
  const themes = report.themes.map((item) => `- **${inlineMarkdown(item.name)}**\uFF1A${item.observation}`).join("\n");
  const clues = report.emotionReading.clues.map((item) => `> - ${item}`).join("\n");
  return [
    "---",
    "mind-trace-report: true",
    "mind-trace-report-version: 1",
    "report-type: weekly",
    `period-start: ${source.period.start}`,
    `period-end: ${source.period.end}`,
    `generated-at: ${new Date().toISOString()}`,
    `source-days: ${stats.days}`,
    `source-sessions: ${stats.sessions}`,
    "---",
    "",
    `# ${source.period.start} \u81F3 ${source.period.end} \u00B7 \u5FC3\u8FF9\u5468\u62A5`,
    "",
    "## \u4E00\u5468\u6982\u89C8",
    "",
    report.summary,
    "",
    "## \u672C\u5468\u6570\u5B57",
    "",
    "| \u7EF4\u5EA6 | \u672C\u5468 | \u8F83\u524D\u4E00\u5468 |",
    "| --- | ---: | ---: |",
    `| \u8BB0\u5F55\u65E5 | ${stats.days} \u5929 | ${stats.days - previous.days >= 0 ? "+" : ""}${stats.days - previous.days} \u5929 |`,
    `| \u5FC3\u60C5 | ${scoreCell(stats.mood)} | ${scoreDelta(stats, previous, "mood")} |`,
    `| \u7CBE\u529B | ${scoreCell(stats.energy)} | ${scoreDelta(stats, previous, "energy")} |`,
    `| \u538B\u529B | ${scoreCell(stats.stress)} | ${scoreDelta(stats, previous, "stress")} |`,
    "",
    "## \u53D1\u751F\u7684\u53D8\u5316",
    "",
    changes,
    "",
    "## \u53EF\u80FD\u7684\u539F\u56E0",
    "",
    causes,
    "",
    "## AI \u60C5\u7EEA\u5047\u8BBE",
    "",
    "> [!note] \u8FD9\u662F\u6839\u636E\u6587\u5B57\u7EBF\u7D22\u7684\u5047\u8BBE\u6027\u89E3\u8BFB\uFF0C\u4E0D\u662F\u5FC3\u7406\u6216\u533B\u5B66\u8BCA\u65AD\u3002",
    `> ${report.emotionReading.hypothesis}`,
    ">",
    clues,
    ">",
    `> **\u53E6\u4E00\u79CD\u53EF\u80FD\uFF1A**${report.emotionReading.alternative}`,
    "",
    "## \u53CD\u590D\u51FA\u73B0\u7684\u4E3B\u9898",
    "",
    themes,
    "",
    "## \u4E0B\u5468\u6700\u5C0F\u7684\u4E00\u6B65",
    "",
    `**${report.nextStep.action}**`,
    "",
    report.nextStep.reason,
    "",
    "## \u7559\u7ED9\u81EA\u5DF1\u7684\u95EE\u9898",
    "",
    report.selfQuestion,
    source.truncated ? "\n> [!info] \u672C\u5468\u65E5\u8BB0\u8F83\u957F\uFF0CAI \u5206\u6790\u4F7F\u7528\u4E86\u622A\u53D6\u540E\u7684\u6458\u5F55\u3002" : "",
    ""
  ].join("\n");
}
function reportSummaryFromMarkdown(content) {
  return /^## \u4E00\u5468\u6982\u89C8\s*\n+([\s\S]*?)(?=\n## |$)/m.exec(content)?.[1]?.trim() ?? "\u6253\u5F00\u5468\u62A5\uFF0C\u56DE\u770B\u8FD9\u4E00\u5468\u7684\u53D8\u5316\u3002";
}
var WeeklyReportRepository = class {
  constructor(app) {
    this.app = app;
  }
  async collect(period) {
    const allEntries = collectMetrics(this.app).entries;
    const entries = periodEntries(allEntries, period);
    const previousStats = metricSnapshot(periodEntries(allEntries, previousPeriod(period)));
    const excerpts = [];
    const sourceFiles = [];
    const successfulDays = /* @__PURE__ */ new Set();
    let sessions = 0;
    let length = 0;
    let truncated = false;
    let acceptingExcerpts = true;
    for (const entry of entries) {
      try {
        const file = this.app.vault.getAbstractFileByPath(entry.filePath);
        if (!(file instanceof import_obsidian6.TFile)) {
          continue;
        }
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const content = await this.app.vault.cachedRead(file);
        const journal = parseSavedJournal(content, frontmatter);
        sourceFiles.push(file);
        for (const session of journal.sessions) {
          const rawBlock = [
            `\u3010${journal.date} ${session.time}\u3011`,
            `\u81EA\u8BC4\uFF1A\u5FC3\u60C5 ${session.ratings.mood.selfScore}/5\uFF0C\u7CBE\u529B ${session.ratings.energy.selfScore}/5\uFF0C\u538B\u529B ${session.ratings.stress.selfScore}/5`,
            `\u65E5\u8BB0\uFF1A${session.diary}`,
            session.facets.length > 0 ? `\u5207\u7247\uFF1A${session.facets.map((item) => `${item.category}\uFF1A${item.summary}`).join("\uFF1B")}` : "",
            session.insights.length > 0 ? `\u5DF2\u6709\u6D1E\u5BDF\uFF1A${session.insights.join("\uFF1B")}` : "",
            session.microAction.length > 0 ? `\u5FAE\u884C\u52A8\uFF1A${session.microAction}` : "",
            session.selfQuestion.length > 0 ? `\u81EA\u6211\u95EE\u9898\uFF1A${session.selfQuestion}` : ""
          ].filter((line) => line.length > 0).join("\n");
          const block = rawBlock.slice(0, 3e3);
          if (rawBlock.length > block.length) {
            truncated = true;
          }
          sessions += 1;
          successfulDays.add(journal.date);
          if (acceptingExcerpts && length + block.length <= 24e3) {
            excerpts.push(block);
            length += block.length;
          } else {
            truncated = true;
            acceptingExcerpts = false;
          }
        }
      } catch {
      }
    }
    const stats = metricSnapshot(entries.filter((entry) => successfulDays.has(entry.date)));
    stats.days = successfulDays.size;
    stats.sessions = sessions;
    return {
      period,
      entries,
      sourceFiles,
      excerpts: excerpts.join("\n\n"),
      stats,
      previousStats,
      truncated
    };
  }
  find(settings, period) {
    const file = this.app.vault.getAbstractFileByPath(weeklyReportPath(settings, period));
    return file instanceof import_obsidian6.TFile ? file : null;
  }
  isStale(file, source) {
    return source.sourceFiles.some((candidate) => candidate.stat.mtime > file.stat.mtime);
  }
  async save(settings, source, report, overwrite = false) {
    const path = weeklyReportPath(settings, source.period);
    const existing = this.app.vault.getAbstractFileByPath(path);
    const content = weeklyReportMarkdown(source, report);
    if (existing instanceof import_obsidian6.TFile) {
      if (!overwrite) {
        return existing;
      }
      await this.app.vault.modify(existing, content);
      return existing;
    }
    await this.ensureFolder(weeklyReportFolder(settings));
    return await this.app.vault.create(path, content);
  }
  async ensureFolder(folder) {
    const parts = folder.split("/");
    let current = "";
    for (const part of parts) {
      current = current.length > 0 ? `${current}/${part}` : part;
      if (this.app.vault.getAbstractFileByPath(current) === null) {
        await this.app.vault.createFolder(current);
      }
    }
  }
};

// src/main.ts
var MindTracePlugin = class extends import_obsidian7.Plugin {
  settings = structuredClone(DEFAULT_SETTINGS);
  draft = null;
  repository;
  weeklyReportRepository;
  weeklyReportAttempts = /* @__PURE__ */ new Set();
  weeklyReportInFlight = /* @__PURE__ */ new Map();
  sourceEditLeaves = /* @__PURE__ */ new WeakMap();
  privacyUnlockedUntil = 0;
  privacyTimer = null;
  metricsListeners = /* @__PURE__ */ new Set();
  draftListeners = /* @__PURE__ */ new Set();
  async onload() {
    await this.loadPluginData();
    this.repository = new JournalRepository(this.app);
    this.weeklyReportRepository = new WeeklyReportRepository(this.app);
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
    this.addRibbonIcon("notebook-pen", "\u6253\u5F00\u5FC3\u8FF9\u8BB0\u5F55", () => {
      void this.openJournal();
    });
    this.addCommand({
      id: "open-mind-trace-journal",
      name: "\u6253\u5F00\u5FC3\u8FF9\u8BB0\u5F55",
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
          this.emitMetricsChanged();
          void this.openMindTraceFile(file);
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        void this.openMindTraceFile(file);
        window.setTimeout(() => {
          void this.openMindTraceFile(file);
        }, 50);
        window.setTimeout(() => {
          void this.openMindTraceFile(file);
        }, 250);
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
      void this.normalizeRestoredViews();
      void this.protectOpenMindTraceFiles();
    });
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof import_obsidian7.TFile && file.extension === "md") {
          this.emitMetricsChanged();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file) => {
        if (file instanceof import_obsidian7.TFile && file.extension === "md") {
          this.emitMetricsChanged();
        }
      })
    );
  }
  onunload() {
    if (this.privacyTimer !== null) {
      window.clearTimeout(this.privacyTimer);
      this.privacyTimer = null;
    }
    this.privacyUnlockedUntil = 0;
    this.metricsListeners.clear();
    this.draftListeners.clear();
    this.sourceEditLeaves = /* @__PURE__ */ new WeakMap();
  }
  async saveSettings() {
    await this.persist();
  }
  async saveProviderSettings() {
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
    const kind = this.settings.activeProvider;
    const configuration = this.settings.providers[kind];
    const secret = resolveCredential(
      configuration,
      (secretId) => this.app.secretStorage.getSecret(secretId),
      this.environment()
    );
    return new HttpLlmProvider(kind, this.settings.providers, secret);
  }
  isProviderConfigured() {
    const kind = this.settings.activeProvider;
    const configuration = this.settings.providers[kind];
    if (configuration.model.trim().length === 0) {
      return false;
    }
    if (kind === "openai-compatible") {
      if (this.settings.providers["openai-compatible"].baseUrl.trim().length === 0) {
        return false;
      }
    }
    return credentialAvailable(
      configuration,
      (secretId) => this.app.secretStorage.getSecret(secretId),
      this.environment()
    );
  }
  activeCredentialStatus() {
    const configuration = this.settings.providers[this.settings.activeProvider];
    switch (configuration.credentialSource) {
      case "environment":
        return credentialAvailable(
          configuration,
          (secretId) => this.app.secretStorage.getSecret(secretId),
          this.environment()
        ) ? `\u5DF2\u8BFB\u53D6 ${configuration.environmentVariable}` : `\u672A\u8BFB\u53D6\u5230 ${configuration.environmentVariable}`;
      case "secret-storage":
        return credentialAvailable(
          configuration,
          (secretId) => this.app.secretStorage.getSecret(secretId),
          this.environment()
        ) ? "\u5DF2\u9009\u62E9\u53EF\u7528\u5BC6\u94A5" : "\u5C1A\u672A\u9009\u62E9\u53EF\u7528\u5BC6\u94A5";
      case "none":
        return "\u4E0D\u4F7F\u7528\u9274\u6743";
    }
  }
  openSettings() {
    const app = this.app;
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
    this.emitMetricsChanged();
    return file;
  }
  async weeklyReportStatus(period = completedPeriod("weekly")) {
    const source = await this.weeklyReportRepository.collect(period);
    const file = this.weeklyReportRepository.find(this.settings, period);
    if (file !== null) {
      const content = await this.app.vault.cachedRead(file);
      let metadata = {};
      try {
        metadata = parseFrontmatter(content);
      } catch {
      }
      const sourceChanged = Number(metadata["source-days"]) !== source.stats.days || Number(metadata["source-sessions"]) !== source.stats.sessions;
      return {
        kind: sourceChanged || this.weeklyReportRepository.isStale(file, source) ? "stale" : "ready",
        period,
        source,
        file,
        summary: reportSummaryFromMarkdown(content)
      };
    }
    const minimum = Math.min(7, Math.max(3, Number(this.settings.weeklyReportMinimumDays) || 3));
    if (source.stats.days < minimum) {
      return { kind: "insufficient", period, source, minimum };
    }
    if (!this.isProviderConfigured()) {
      return { kind: "unconfigured", period, source };
    }
    return { kind: "missing", period, source };
  }
  async generateWeeklyReport(period = completedPeriod("weekly"), overwrite = false, automatic = false) {
    const key = `${period.start}--${period.end}`;
    if (automatic && this.weeklyReportAttempts.has(key)) {
      return await this.weeklyReportStatus(period);
    }
    const existingFlight = this.weeklyReportInFlight.get(key);
    if (existingFlight !== void 0) {
      return await existingFlight;
    }
    if (automatic) {
      this.weeklyReportAttempts.add(key);
    }
    const task = (async () => {
      const status = await this.weeklyReportStatus(period);
      if ((status.kind === "ready" || status.kind === "stale") && !overwrite) {
        return status;
      }
      if (status.kind === "insufficient") {
        throw new Error(`\u81F3\u5C11\u9700\u8981 ${status.minimum} \u4E2A\u8BB0\u5F55\u65E5\u624D\u80FD\u751F\u6210\u5468\u62A5`);
      }
      if (status.kind === "unconfigured") {
        throw new Error("\u8BF7\u5148\u5728\u5FC3\u8FF9\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u6A21\u578B\u4E0E API Key");
      }
      const source = status.source;
      const report = await generateWeeklyReport(this.createProvider(), source, this.settings);
      const file = await this.weeklyReportRepository.save(this.settings, source, report, overwrite);
      this.emitMetricsChanged();
      return {
        kind: "ready",
        period,
        source,
        file,
        summary: report.summary
      };
    })();
    this.weeklyReportInFlight.set(key, task);
    try {
      return await task;
    } finally {
      this.weeklyReportInFlight.delete(key);
    }
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
    const security = this.settings.security;
    return typeof security?.salt === "string" && security.salt.length > 0 && typeof security.verifier === "string" && security.verifier.length > 0;
  }
  isPrivacyUnlocked() {
    if (this.privacyUnlockedUntil <= Date.now()) {
      this.privacyUnlockedUntil = 0;
      return false;
    }
    return true;
  }
  async verifyPrivacyPassword(password) {
    if (!this.isPasswordConfigured()) {
      return false;
    }
    const security = this.settings.security;
    try {
      const verifier = await derivePasswordVerifier(
        password,
        base64ToBytes(security.salt),
        security.iterations
      );
      return constantTimeEqual(verifier, security.verifier);
    } catch {
      return false;
    }
  }
  async configurePrivacyPassword(password) {
    if (password.length < 8) {
      throw new Error("密码至少需要 8 个字符");
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = await derivePasswordVerifier(
      password,
      salt,
      PASSWORD_KDF_ITERATIONS
    );
    this.settings.security = {
      version: 1,
      salt: bytesToBase64(salt),
      verifier,
      iterations: PASSWORD_KDF_ITERATIONS
    };
    await this.persist();
    this.activatePrivacyUnlock();
  }
  async unlockPrivacy(password) {
    if (!await this.verifyPrivacyPassword(password)) {
      throw new Error("密码不正确");
    }
    this.activatePrivacyUnlock();
  }
  async changePrivacyPassword(currentPassword, newPassword) {
    if (!this.isPrivacyUnlocked() && !await this.verifyPrivacyPassword(currentPassword)) {
      throw new Error("当前密码不正确");
    }
    await this.configurePrivacyPassword(newPassword);
  }
  async removePrivacyPassword(currentPassword) {
    if (!this.isPrivacyUnlocked() && !await this.verifyPrivacyPassword(currentPassword)) {
      throw new Error("当前密码不正确");
    }
    this.settings.security = structuredClone(DEFAULT_SETTINGS.security);
    this.privacyUnlockedUntil = 0;
    if (this.privacyTimer !== null) {
      window.clearTimeout(this.privacyTimer);
      this.privacyTimer = null;
    }
    await this.persist();
    this.refreshProtectedViews();
    void this.closeProtectedSources();
  }
  activatePrivacyUnlock() {
    this.privacyUnlockedUntil = Date.now() + PRIVACY_UNLOCK_DURATION_MS;
    if (this.privacyTimer !== null) {
      window.clearTimeout(this.privacyTimer);
    }
    this.privacyTimer = window.setTimeout(() => {
      this.lockPrivacy(false);
    }, PRIVACY_UNLOCK_DURATION_MS);
    this.refreshProtectedViews();
  }
  lockPrivacy(showNotice = false) {
    this.privacyUnlockedUntil = 0;
    if (this.privacyTimer !== null) {
      window.clearTimeout(this.privacyTimer);
      this.privacyTimer = null;
    }
    this.refreshProtectedViews();
    void this.closeProtectedSources();
    if (showNotice) {
      new import_obsidian7.Notice("心迹已锁定");
    }
  }
  refreshJournalViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(JOURNAL_VIEW_TYPE)) {
      if (leaf.view instanceof JournalView) {
        leaf.view.weeklyReportState = null;
        leaf.view.render();
      }
    }
  }
  refreshProtectedViews() {
    this.refreshJournalViews();
    for (const leaf of this.app.workspace.getLeavesOfType(SAVED_JOURNAL_VIEW_TYPE)) {
      if (leaf.view instanceof SavedJournalView) {
        leaf.view.render();
      }
    }
    for (const leaf of this.app.workspace.getLeavesOfType(WEEKLY_REPORT_VIEW_TYPE)) {
      if (leaf.view instanceof SavedWeeklyReportView) {
        leaf.view.render();
      }
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
      return frontmatter["mind-trace"] === true || frontmatter["mind-trace-report"] === true;
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
    return Reflect.get(parsed, "mind-trace") === true || Reflect.get(parsed, "mind-trace-report") === true;
  }
  async protectedViewType(file) {
    const cached = this.app.metadataCache.getFileCache(file)?.frontmatter;
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
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) && Reflect.get(parsed, "mind-trace-report") === true ? WEEKLY_REPORT_VIEW_TYPE : SAVED_JOURNAL_VIEW_TYPE;
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
    for (const listener of this.metricsListeners) {
      listener();
    }
  }
  async loadPluginData() {
    const loaded = await this.loadData();
    if (loaded === null) {
      this.settings = structuredClone(DEFAULT_SETTINGS);
      this.draft = null;
      await this.persist();
      return;
    }
    if (typeof loaded !== "object" || Array.isArray(loaded) || !("settings" in loaded) || !("draft" in loaded)) {
      throw new Error("\u5FC3\u8FF9\u63D2\u4EF6\u6570\u636E\u683C\u5F0F\u65E0\u6548");
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
    const loadedSecurity = typeof loadedSettings.security === "object" && loadedSettings.security !== null && !Array.isArray(loadedSettings.security) ? loadedSettings.security : {};
    this.settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      ...loadedSettings,
      providers,
      security: {
        ...structuredClone(DEFAULT_SETTINGS.security),
        ...loadedSecurity
      }
    };
    this.settings.weeklyReportAutoGenerate = this.settings.weeklyReportAutoGenerate !== false;
    this.settings.weeklyReportMinimumDays = Math.min(
      7,
      Math.max(3, Math.round(Number(this.settings.weeklyReportMinimumDays) || 3))
    );
    this.draft = data.draft;
    if (typeof this.draft === "object" && this.draft !== null && !Array.isArray(this.draft)) {
      this.draft.entryDate = draftEntryDate(this.draft);
    }
  }
  async persist() {
    const data = {
      settings: this.settings,
      draft: this.draft
    };
    await this.saveData(data);
  }
  environment() {
    return import_obsidian7.Platform.isDesktopApp && typeof process !== "undefined" ? process.env : null;
  }
};
