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

function showMindTraceNotice(message, timeout) {
  const notice = new import_obsidian7.Notice(message, timeout);
  notice.noticeEl?.classList.add("mind-trace-notice");
  return notice;
}

// src/credentials.ts
function resolveCredential(configuration, resolveSecret) {
  switch (configuration.credentialSource) {
    case "secret-storage": {
      if (configuration.secretId.length === 0) {
        throw new Error("请先在心迹设置中选择 API Key");
      }
      const value = resolveSecret(configuration.secretId);
      if (value === null || value.length === 0) {
        throw new Error("Secret Storage 中没有找到所选 API Key");
      }
      return value;
    }
    case "none":
      return "";
    default:
      throw new Error("请先在心迹设置中选择 API Key");
  }
}
function credentialAvailable(configuration, resolveSecret) {
  try {
    resolveCredential(configuration, resolveSecret);
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
    throw new Error(`暂不支持 ${type} 周期`);
  }
  const end = addLocalDays(startOfLocalWeek(now), -1);
  const start = addLocalDays(end, -6);
  return {
    type,
    start: localDateString(start),
    end: localDateString(end)
  };
}
function currentWeekPeriod(now = /* @__PURE__ */ new Date()) {
  const start = startOfLocalWeek(now);
  return {
    type: "weekly",
    start: localDateString(start),
    end: localDateString(now)
  };
}
function previousPeriod(period) {
  const start = parseLocalDate(period.start);
  if (start === null) {
    throw new Error("报告周期日期无效");
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
  if (!plugin.isPrivacyGateEnabled() || plugin.isPrivacyUnlocked()) {
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
    text: configured ? "解锁心迹" : "设置心迹密码（可选）",
    attr: { role: "heading", "aria-level": "2" }
  });
  shell.createEl("p", {
    text: configured ? "解锁后两小时内，可以记录、阅读、查看成长看板、导出和编辑日记。" : "密码至少 8 个字符。心迹会保存加盐验证值，不会保存明文密码；也可以暂不设置，直接进入。"
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
  if (!configured) {
    const skip = shell.createEl("button", {
      cls: "mind-trace-lock-skip",
      text: "暂不设置，直接进入",
      attr: { type: "button" }
    });
    skip.addEventListener("click", () => {
      if (skip.disabled) {
        return;
      }
      error.textContent = "";
      skip.disabled = true;
      void plugin.skipPrivacySetup().catch((reason) => {
        error.textContent = reason instanceof Error ? reason.message : "无法进入心迹";
        skip.disabled = false;
      });
    });
  }
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
function lineSegments(entries, key, range, width = 560, height = 170, left = 24, top = 14) {
  if (entries.length === 0) {
    return [];
  }
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
      x: left + dayOffset / Math.max(range - 1, 1) * width,
      y: top + (5 - entry[key]) / 4 * height
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
function trendPoints(entries, key, range, left, top, plotWidth, plotHeight) {
  const today = /* @__PURE__ */ new Date();
  const startDate = addLocalDays(today, -(range - 1));
  return entries.flatMap((entry) => {
    const value = entry[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return [];
    }
    const dateParts = entry.date.split("-").map(Number);
    const date = new Date(
      dateParts[0] ?? 0,
      (dateParts[1] ?? 1) - 1,
      dateParts[2] ?? 1
    );
    const dayOffset = localDayOrdinal(date) - localDayOrdinal(startDate);
    if (dayOffset < 0 || dayOffset > range - 1) {
      return [];
    }
    return [{
      date: entry.date,
      dayOffset,
      value,
      x: left + dayOffset / Math.max(range - 1, 1) * plotWidth,
      y: top + (5 - value) / 4 * plotHeight
    }];
  }).sort((leftEntry, rightEntry) => leftEntry.dayOffset - rightEntry.dayOffset || leftEntry.date.localeCompare(rightEntry.date));
}
function trendBandPaths(selfPoints, aiPoints) {
  const selfByDate = new Map(selfPoints.map((point) => [point.date, point]));
  const aiByDate = new Map(aiPoints.map((point) => [point.date, point]));
  const dates = [...new Set([...selfByDate.keys(), ...aiByDate.keys()])].sort();
  const runs = [];
  let run = [];
  let previousOffset = null;
  for (const date of dates) {
    const self = selfByDate.get(date);
    const ai = aiByDate.get(date);
    if (self === void 0 || ai === void 0) {
      if (run.length > 0) {
        runs.push(run);
        run = [];
      }
      previousOffset = null;
      continue;
    }
    if (run.length > 0 && self.dayOffset - previousOffset !== 1) {
      runs.push(run);
      run = [];
    }
    run.push({ self, ai });
    previousOffset = self.dayOffset;
  }
  if (run.length > 0) {
    runs.push(run);
  }
  return runs.map((points) => {
    const forward = points.map((point) => `${point.self.x.toFixed(1)} ${point.self.y.toFixed(1)}`).join(" L ");
    const backward = [...points].reverse().map((point) => `${point.ai.x.toFixed(1)} ${point.ai.y.toFixed(1)}`).join(" L ");
    return `M ${forward} L ${backward} Z`;
  });
}
function renderLineChart(container, entries, range, onSelectRange = null, previousEntries = [], aiSeries = null) {
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
  headingCopy.createEl("p", { text: `${range} 天内实线为自评、虚线为 AI；空白表示当天没有记录` });
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
  const grid = section.createDiv({ cls: "mind-trace-trend-grid" });
  for (const [key, label] of [["mood", "心情"], ["energy", "精力"], ["stress", "压力"]]) {
    renderTrendMini(grid, key, label, entries, range, currentStats, previousStats, aiSeries);
  }
  return section;
}
function renderTrendMini(container, key, label, entries, range, currentStats, previousStats, aiSeries = null) {
  const mini = container.createDiv({ cls: `mind-trace-trend-mini mind-trace-trend-mini-${key}` });
  const heading = mini.createDiv({ cls: "mind-trace-trend-mini-heading" });
  const titleWrap = heading.createDiv({ cls: "mind-trace-trend-mini-title-wrap" });
  titleWrap.createSpan({ cls: "mind-trace-trend-mini-dot", attr: { "aria-hidden": "true" } });
  titleWrap.createDiv({
    cls: "mind-trace-trend-mini-title",
    text: label,
    attr: { role: "heading", "aria-level": "4" }
  });
  const stat = heading.createDiv({ cls: "mind-trace-trend-mini-stat" });
  const current = currentStats[key];
  stat.createEl("strong", { text: current === null ? "—" : current.toFixed(1) });
  if (current !== null && previousStats[key] !== null) {
    const change = current - previousStats[key];
    const neutral = Math.abs(change) < 0.05;
    const favorable = !neutral && (key === "stress" ? change < 0 : change > 0);
    stat.createEl("small", {
      cls: `mind-trace-trend-mini-delta ${neutral ? "is-neutral" : favorable ? "is-favorable" : "is-unfavorable"}`,
      text: `${change >= 0 ? "+" : ""}${change.toFixed(1)}`
    });
  }
  const legend = mini.createDiv({ cls: "mind-trace-trend-legend" });
  const selfLegend = legend.createSpan({ cls: "mind-trace-trend-legend-item" });
  selfLegend.createSpan({ cls: "mind-trace-trend-legend-line is-self" });
  selfLegend.appendText("自评");
  const aiLegend = legend.createSpan({ cls: "mind-trace-trend-legend-item" });
  aiLegend.createSpan({ cls: "mind-trace-trend-legend-line is-ai" });
  aiLegend.appendText("AI");
  const svgWidth = 300;
  const svgHeight = 152;
  const left = 30;
  const top = 14;
  const plotWidth = 244;
  const plotHeight = 106;
  const svg = svgElement("svg", {
    viewBox: `0 0 ${svgWidth} ${svgHeight}`,
    role: "img",
    "aria-label": `${range} 天${label}趋势，评分范围 1 到 5`
  });
  svg.classList.add("mind-trace-line-chart");
  for (let score = 1; score <= 5; score += 1) {
    const y = top + (5 - score) / 4 * plotHeight;
    svg.append(
      svgElement("line", {
        x1: String(left),
        x2: String(left + plotWidth),
        y1: String(y),
        y2: String(y),
        class: "mind-trace-grid-line"
      })
    );
    const label = svgElement("text", {
      x: "4",
      y: String(y + 4),
      class: "mind-trace-axis-label"
    });
    label.textContent = String(score);
    svg.append(label);
  }
  const trendStart = addLocalDays(new Date(), -(range - 1));
  const tickStep = range <= 7 ? 1 : range <= 30 ? 7 : 14;
  for (let offset = 0; offset < range; offset += tickStep) {
    const tickDate = addLocalDays(trendStart, offset);
    const x = left + offset / Math.max(range - 1, 1) * plotWidth;
    const tick = svgElement("text", {
      x: x.toFixed(1),
      y: String(svgHeight - 6),
      "text-anchor": offset === 0 ? "start" : x > left + plotWidth - 20 ? "end" : "middle",
      class: "mind-trace-axis-label"
    });
    tick.textContent = `${tickDate.getMonth() + 1}/${tickDate.getDate()}`;
    svg.append(tick);
  }
  const selfPoints = trendPoints(entries, key, range, left, top, plotWidth, plotHeight);
  const aiEntries = Array.isArray(aiSeries) ? aiSeries.filter((item) => item !== null && typeof item === "object" && item.ai !== null && typeof item.ai[key] === "number" && Number.isFinite(item.ai[key])).map((item) => ({ date: item.date, [key]: item.ai[key] })) : [];
  const aiPoints = trendPoints(aiEntries, key, range, left, top, plotWidth, plotHeight);
  const aiCoverageDays = new Set(aiPoints.map((point) => point.date)).size;
  if (aiCoverageDays > 0) {
    legend.createSpan({ cls: "mind-trace-trend-legend-coverage", text: `${aiCoverageDays} 天` });
  } else {
    legend.createSpan({ cls: "mind-trace-trend-legend-coverage is-empty", text: "暂无" });
  }
  const baseline = top + plotHeight + 8;
  if (aiPoints.length === 0) {
    for (const segment of lineSegments(entries, key, range, plotWidth, plotHeight, left, top)) {
      const firstX = /^M ([\d.]+)/.exec(segment)?.[1];
      const lastX = /([\d.]+) [\d.]+$/.exec(segment)?.[1];
      if (firstX !== void 0 && lastX !== void 0) {
        svg.append(
          svgElement("path", {
            d: `${segment} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`,
            class: `mind-trace-area-${key}`
          })
        );
      }
    }
  } else {
    for (const band of trendBandPaths(selfPoints, aiPoints)) {
      svg.append(
        svgElement("path", {
          d: band,
          class: `mind-trace-band-${key}`
        })
      );
    }
  }
  for (const segment of lineSegments(entries, key, range, plotWidth, plotHeight, left, top)) {
    svg.append(
      svgElement("path", {
        d: segment,
        class: `mind-trace-series mind-trace-series-${key}`,
        fill: "none"
      })
    );
  }
  for (const segment of lineSegments(aiEntries, key, range, plotWidth, plotHeight, left, top)) {
    svg.append(
      svgElement("path", {
        d: segment,
        class: `mind-trace-series mind-trace-series-${key} mind-trace-series-ai`,
        fill: "none"
      })
    );
  }
  for (const point of selfPoints) {
    const svgPoint = svgElement("circle", {
      cx: point.x.toFixed(1),
      cy: point.y.toFixed(1),
      r: "3",
      class: `mind-trace-point mind-trace-series-${key}`,
      tabindex: "0",
      role: "img",
      "aria-label": `${point.date} ${label} 自评 ${point.value.toFixed(1)}`
    });
    const title = svgElement("title", {});
    title.textContent = `${point.date} ${label} 自评 ${point.value.toFixed(1)}`;
    svgPoint.append(title);
    svg.append(svgPoint);
  }
  for (const point of aiPoints) {
    const svgPoint = svgElement("circle", {
      cx: point.x.toFixed(1),
      cy: point.y.toFixed(1),
      r: "2.5",
      class: `mind-trace-point mind-trace-point-ai mind-trace-series-${key}`,
      tabindex: "0",
      role: "img",
      "aria-label": `${point.date} ${label} AI ${point.value.toFixed(1)}`
    });
    const title = svgElement("title", {});
    title.textContent = `${point.date} ${label} AI ${point.value.toFixed(1)}`;
    svgPoint.append(title);
    svg.append(svgPoint);
  }
  mini.append(svg);
  return mini;
}
function renderThemes(container, entries, onSelectTheme = null) {
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
    const row = onSelectTheme === null ? container.createDiv({ cls: "mind-trace-theme-row" }) : container.createEl("button", {
      cls: "mind-trace-theme-row mind-trace-theme-filter-button",
      attr: {
        type: "button",
        "aria-label": `查看主题“${item.theme}”的历史记录`
      }
    });
    if (onSelectTheme !== null) {
      row.addEventListener("click", () => onSelectTheme(item.theme));
    }
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
var DashboardComponent = class {
  constructor(app, container, range, onRangeChange, onOpenEntry = null, onSelectTheme = null, onOpenEvent = null) {
    this.app = app;
    this.container = container;
    this.range = range;
    this.onRangeChange = onRangeChange;
    this.onOpenEntry = onOpenEntry;
    this.onSelectTheme = onSelectTheme;
    this.onOpenEvent = onOpenEvent;
    const now = new Date();
    this.calendarCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    this.calendarSection = null;
    this.calendarEntries = [];
    this.heatmapYear = now.getFullYear();
    this.heatmapSection = null;
    this.heatmapEntries = [];
    this.facetsContainer = null;
    this.eventsContainer = null;
    this.trendContainer = null;
    this.trendEntries = [];
    this.trendRange = this.range;
    this.trendPreviousEntries = [];
    this.trendAiSeries = null;
  }
  renderEmpty(container = this.container) {
    container.empty();
    container.addClass("mind-trace-dashboard");
    const empty = container.createDiv({
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
  }
  renderTrend(container, entries, range, previousEntries = [], aiSeries = null) {
    this.trendContainer = container;
    this.trendEntries = entries;
    this.trendRange = range;
    this.trendPreviousEntries = previousEntries;
    this.trendAiSeries = aiSeries;
    renderLineChart(container, entries, range, (nextRange) => {
      void this.setRange(nextRange);
    }, previousEntries, aiSeries);
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
      const isToday = dateString === todayString;
      const openable = (filePath !== void 0 || isToday) && this.onOpenEntry !== null;
      const classes = ["mind-trace-cal-cell"];
      if (mood !== void 0) {
        classes.push(`mind-trace-cal-day-${Math.min(5, Math.max(1, Math.round(mood)))}`);
      }
      if (isToday) {
        classes.push("is-today");
      }
      if (openable) {
        classes.push("is-openable");
      }
      const cellTitle = filePath !== void 0 ? `${dateString} 心情 ${mood.toFixed(1)}` : isToday ? `${dateString} · 开始今天的心迹记录` : dateString;
      const cell = grid.createSpan({
        cls: classes.join(" "),
        text: String(day),
        attr: openable ? {
          role: "button",
          tabindex: "0",
          "aria-label": filePath !== void 0 ? `打开 ${dateString} 的日记` : `开始 ${dateString} 的心迹记录`,
          title: cellTitle
        } : { title: cellTitle }
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
  renderYearHeatmap(entries, container = this.container) {
    this.heatmapEntries = entries;
    this.heatmapSection = container.createDiv({ cls: "mind-trace-chart-section mind-trace-heatmap-section" });
    this.renderYearHeatmapContent();
  }
  renderYearHeatmapContent() {
    const section = this.heatmapSection;
    if (section === null) {
      return;
    }
    section.empty();
    const heading = section.createDiv({
      cls: "mind-trace-chart-heading mind-trace-chart-heading-row"
    });
    heading.createDiv({
      cls: "mind-trace-chart-title",
      text: "年度热力图",
      attr: { role: "heading", "aria-level": "3" }
    });
    const nav = heading.createDiv({ cls: "mind-trace-heatmap-nav" });
    const previous = nav.createEl("button", {
      cls: "clickable-icon mind-trace-heatmap-nav-button",
      text: "‹",
      attr: { type: "button", "aria-label": "上一年" }
    });
    nav.createSpan({
      cls: "mind-trace-heatmap-year",
      text: `${this.heatmapYear}年`
    });
    const next = nav.createEl("button", {
      cls: "clickable-icon mind-trace-heatmap-nav-button",
      text: "›",
      attr: { type: "button", "aria-label": "下一年" }
    });
    previous.addEventListener("click", () => {
      this.shiftHeatmapYear(-1);
    });
    next.addEventListener("click", () => {
      this.shiftHeatmapYear(1);
    });
    const legend = section.createDiv({
      cls: "mind-trace-heatmap-legend",
      attr: { role: "img", "aria-label": "心情色阶：1 低落，5 明亮" }
    });
    const emptyItem = legend.createSpan({ cls: "mind-trace-heatmap-legend-item" });
    emptyItem.createSpan({ cls: "mind-trace-heatmap-swatch is-empty" });
    emptyItem.createSpan({ text: "无记录" });
    for (let level = 1; level <= 5; level += 1) {
      const item = legend.createSpan({ cls: "mind-trace-heatmap-legend-item" });
      item.createSpan({ cls: `mind-trace-heatmap-swatch mind-trace-cal-day-${level}` });
      item.createSpan({ text: String(level) });
    }
    const moodByDate = new Map();
    const fileByDate = new Map();
    for (const entry of this.heatmapEntries) {
      if (!moodByDate.has(entry.date)) {
        moodByDate.set(entry.date, entry.mood);
        fileByDate.set(entry.date, entry.filePath);
      }
    }
    const year = this.heatmapYear;
    const firstWeekday = (new Date(year, 0, 1).getDay() + 6) % 7;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInYear = leap ? 366 : 365;
    const weeks = Math.ceil((firstWeekday + daysInYear) / 7);
    const wrap = section.createDiv({ cls: "mind-trace-heatmap-wrap" });
    const grid = wrap.createDiv({
      cls: "mind-trace-heatmap",
      attr: {
        style: `grid-template-columns: 22px repeat(${weeks}, minmax(9px, 1fr)); grid-template-rows: repeat(8, 16px);`
      }
    });
    for (const [weekday, row] of [["一", 2], ["三", 4], ["五", 6]]) {
      grid.createSpan({
        cls: "mind-trace-heatmap-weekday",
        text: weekday,
        attr: { style: `grid-column: 1; grid-row: ${row};` }
      });
    }
    const monthStarts = [];
    let dayCursor = 1;
    for (let month = 0; month < 12; month += 1) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      monthStarts.push(Math.floor((dayCursor - 1 + firstWeekday) / 7));
      dayCursor += daysInMonth;
    }
    for (let month = 0; month < 12; month += 1) {
      const startWeek = monthStarts[month];
      const span = month < 11 ? monthStarts[month + 1] - startWeek : weeks - startWeek;
      grid.createSpan({
        cls: "mind-trace-heatmap-month",
        text: `${month + 1}月`,
        attr: { style: `grid-column: ${startWeek + 2} / span ${span}; grid-row: 1;` }
      });
    }
    const todayString = localDateString(new Date());
    dayCursor = 1;
    for (let month = 0; month < 12; month += 1) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const dateString = localDateString(new Date(year, month, day));
        const mood = moodByDate.get(dateString);
        const filePath = fileByDate.get(dateString);
        const isToday = dateString === todayString;
        const openable = (filePath !== void 0 || isToday) && this.onOpenEntry !== null;
        const classes = ["mind-trace-heat-cell"];
        if (mood !== void 0) {
          classes.push(`mind-trace-cal-day-${Math.min(5, Math.max(1, Math.round(mood)))}`);
        } else {
          classes.push("is-empty");
        }
        if (isToday) {
          classes.push("is-today");
        }
        if (openable) {
          classes.push("is-openable");
        }
        const weekIndex = Math.floor((dayCursor - 1 + firstWeekday) / 7);
        const weekday = (firstWeekday + dayCursor - 1) % 7;
        const cellTitle = filePath !== void 0 ? `${dateString} 心情 ${mood.toFixed(1)}` : isToday ? `${dateString} · 开始今天的心迹记录` : dateString;
        const cellStyle = `grid-column: ${weekIndex + 2}; grid-row: ${weekday + 2};`;
        const cell = grid.createSpan({
          cls: classes.join(" "),
          attr: openable ? {
            role: "button",
            tabindex: "0",
            "aria-label": filePath !== void 0 ? `打开 ${dateString} 的日记` : `开始 ${dateString} 的心迹记录`,
            title: cellTitle,
            style: cellStyle
          } : {
            title: cellTitle,
            style: cellStyle
          }
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
        dayCursor += 1;
      }
    }
  }
  shiftHeatmapYear(offset) {
    this.heatmapYear += offset;
    this.renderYearHeatmapContent();
  }
  renderThemesCard(container, entries) {
    const section = container.createDiv({ cls: "mind-trace-chart-section mind-trace-themes-card" });
    const heading = section.createDiv({ cls: "mind-trace-chart-heading" });
    heading.createDiv({
      cls: "mind-trace-chart-title",
      text: "主题",
      attr: { role: "heading", "aria-level": "3" }
    });
    heading.createEl("p", { text: "按出现天数统计。" });
    renderThemes(section, entries, this.onSelectTheme);
  }
  renderFacetsCard(container) {
    const section = container.createDiv({ cls: "mind-trace-chart-section mind-trace-facets-card" });
    const heading = section.createDiv({ cls: "mind-trace-chart-heading" });
    heading.createDiv({
      cls: "mind-trace-chart-title",
      text: "切片类别",
      attr: { role: "heading", "aria-level": "3" }
    });
    heading.createEl("p", { text: "来自日记正文解析。" });
    this.facetsContainer = section.createDiv();
    this.facetsContainer.createEl("p", {
      cls: "mind-trace-empty",
      text: "正在解析日记切片…"
    });
  }
  renderEventsCard(container) {
    const section = container.createDiv({ cls: "mind-trace-chart-section mind-trace-events-card" });
    const heading = section.createDiv({ cls: "mind-trace-chart-heading" });
    heading.createDiv({
      cls: "mind-trace-chart-title",
      text: "最近事件",
      attr: { role: "heading", "aria-level": "3" }
    });
    heading.createEl("p", { text: "来自所选周期，按时间倒序。" });
    this.eventsContainer = section.createDiv();
    this.eventsContainer.createEl("p", {
      cls: "mind-trace-empty",
      text: "正在整理最近事件…"
    });
  }
  renderInsights(insights) {
    if (this.facetsContainer !== null && this.facetsContainer.isConnected) {
      this.facetsContainer.empty();
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
    if (this.eventsContainer !== null && this.eventsContainer.isConnected) {
      this.eventsContainer.empty();
      if (insights.recentEvents.length === 0) {
        this.eventsContainer.createEl("p", {
          cls: "mind-trace-empty",
          text: "还没有提取到事件。"
        });
      } else {
        for (const event of insights.recentEvents) {
          const row = this.eventsContainer.createEl("button", {
            cls: "mind-trace-event-row",
            attr: {
              type: "button",
              title: event.summary,
              "aria-label": `打开 ${event.date} ${event.time} 的 ${event.type}：${event.title}`
            }
          });
          row.createSpan({ cls: "mind-trace-event-meta", text: `${event.date.slice(5).replace("-", "/")} ${event.time}` });
          row.createSpan({ cls: "mind-trace-event-type", text: event.type });
          row.createSpan({ cls: "mind-trace-event-title", text: event.title });
          if (this.onOpenEvent !== null) {
            row.addEventListener("click", () => this.onOpenEvent(event));
          }
        }
      }
    }
    if (this.trendContainer !== null && this.trendContainer.isConnected) {
      this.trendAiSeries = insights.series ?? null;
      this.trendContainer.empty();
      renderLineChart(
        this.trendContainer,
        this.trendEntries,
        this.trendRange,
        (nextRange) => {
          void this.setRange(nextRange);
        },
        this.trendPreviousEntries,
        this.trendAiSeries
      );
    }
  }
  async setRange(range) {
    if (range === this.range) {
      return;
    }
    this.range = range;
    await this.onRangeChange(range);
  }
};

// src/defaults.ts
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
  questionLayout: "cards",
  journalFolder: "心迹日记",
  historyDays: 7,
  reflectionTone: "gentle",
  customInstructions: "",
  dashboardRange: 30,
  weeklyReportAutoGenerate: true,
  weeklyReportMinimumDays: 3,
  weeklyEventLimit: 50,
  weeklyGraphEventLimit: 20,
  security: {
    version: 1,
    salt: "",
    verifier: "",
    iterations: PASSWORD_KDF_ITERATIONS,
    enabled: true
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
function statusError(status, response) {
  if (status === 401 || status === 403) {
    return new Error("模型服务拒绝了鉴权，请检查 API Key");
  }
  if (status === 429) {
    return new Error("模型服务请求过于频繁或额度不足，请稍后重试");
  }
  if (status >= 500) {
    return new Error("模型服务暂时不可用，请稍后重试");
  }
  let detail = response.text.trim();
  if (detail.length > 240) {
    detail = `${detail.slice(0, 240)}…`;
  }
  return new Error(
    detail.length > 0 ? `模型请求失败（${status}）：${detail}` : `模型请求失败（${status}）`
  );
}
var HttpLlmProvider = class {
  constructor(kind, settings, secret, onActivityStart = null) {
    this.kind = kind;
    this.settings = settings;
    this.secret = secret;
    this.onActivityStart = onActivityStart;
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
        const result = await (0, import_obsidian2.requestUrl)(request);
        response = {
          status: result.status,
          json: result.json,
          text: result.text
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`无法连接模型服务：${message}`);
      }
      if (response.status < 200 || response.status >= 300) {
        throw statusError(response.status, response);
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
        window.clearInterval(timer);
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
  timer = window.setInterval(update, 1e3);
  return () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}
function findMindTraceScroller(root) {
  let current = root;
  while (current !== null) {
    const style = window.getComputedStyle(current);
    if ((style.overflowY === "auto" || style.overflowY === "scroll") && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return root;
}
function captureMindTraceContext(root) {
  const scroller = findMindTraceScroller(root);
  const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null;
  const focusKey = active?.getAttribute("data-mind-trace-focus-key") ?? active?.getAttribute("aria-label") ?? active?.id ?? null;
  return {
    scroller,
    scrollTop: scroller.scrollTop,
    focusKey,
    selectionStart: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null,
    selectionEnd: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionEnd : null
  };
}
function restoreMindTraceContext(root, context) {
  window.requestAnimationFrame(() => {
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
    if (!(target instanceof HTMLElement)) {
      return;
    }
    target.focus({ preventScroll: true });
    if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && context.selectionStart !== null && context.selectionEnd !== null) {
      target.setSelectionRange(context.selectionStart, context.selectionEnd);
    }
    if (scroller !== null) {
      scroller.scrollTop = context.scrollTop;
    }
  });
}
var MindTraceConfirmModal = class extends import_obsidian7.Modal {
  constructor(app, plugin, configuration, onStart) {
    super(app);
    this.plugin = plugin;
    this.configuration = configuration;
    this.onStart = onStart;
  }
  onOpen() {
    this.modalEl.addClass("mind-trace-confirm-modal-shell", "mind-trace-dialog-shell");
    this.contentEl.addClass("mind-trace-confirm-modal");
    this.render();
  }
  onClose() {
    this.contentEl.empty();
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
    window.requestAnimationFrame(() => confirm.focus({ preventScroll: true }));
  }
};
var MindTraceTaskToast = class {
  constructor(app, plugin, configuration) {
    this.app = app;
    this.plugin = plugin;
    this.configuration = configuration;
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
  keyHandler = null;
  backdropHandler = null;
  dockListener = null;
  resizeListener = null;
  eyebrowEl = null;
  titleEl = null;
  bodyEl = null;
  actionsEl = null;
  shellBuilt = false;
  open() {
    void this.start();
    return this;
  }
  buildDom() {
    if (this.host !== null) {
      return;
    }
    this.host = document.body.createDiv({ cls: "mind-trace-toast-host" });
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
      const nav = document.querySelector(".mind-trace-nav");
      if (nav instanceof HTMLElement) {
        this.host.addClass("is-docked");
        this.host.style.top = `${nav.getBoundingClientRect().bottom}px`;
        if (this.dockListener === null) {
          this.dockListener = () => this.dockHost();
          window.addEventListener("scroll", this.dockListener, { capture: true, passive: true });
        }
        if (this.resizeListener === null) {
          this.resizeListener = () => this.dockHost();
          window.addEventListener("resize", this.resizeListener);
        }
        return;
      }
    }
    this.host.removeClass("is-docked");
    this.host.style.top = "";
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
      window.clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
    if (this.keyHandler !== null) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    if (this.backdropHandler !== null) {
      this.host?.removeEventListener("click", this.backdropHandler);
      this.backdropHandler = null;
    }
    if (this.dockListener !== null) {
      window.removeEventListener("scroll", this.dockListener, { capture: true });
      this.dockListener = null;
    }
    if (this.resizeListener !== null) {
      window.removeEventListener("resize", this.resizeListener);
      this.resizeListener = null;
    }
    this.stopTimers();
    this.host?.remove();
    this.host = null;
    this.card = null;
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
      window.clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }
  async start() {
    if (this.phase === "running" && this.startedAt !== 0) {
      return;
    }
    if (this.autoCloseTimer !== null) {
      window.clearTimeout(this.autoCloseTimer);
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
    const task = this.configuration.run((progress) => this.updateProgress(progress));
    const minimumDelay = new Promise((resolve) => window.setTimeout(() => resolve(slow), 120));
    try {
      const winner = await Promise.race([task.then((value) => ({ value })), minimumDelay]);
      if (winner === slow) {
        this.buildDom();
        this.render();
        await this.settleSuccess(await task);
      } else {
        this.buildDom();
        await this.settleSuccess(winner.value);
      }
    } catch (error) {
      this.buildDom();
      await this.settleError(error);
    } finally {
      this.stopTimers();
    }
  }
  async settleSuccess(result) {
    this.result = result;
    await this.configuration.onSuccess?.(result);
    this.settled = true;
    this.phase = "success";
    if (this.minimized) {
      showMindTraceNotice(this.configuration.backgroundSuccess ?? this.configuration.successTitle ?? "处理完成");
      this.close();
      return;
    }
    this.render();
  }
  async settleError(error) {
    this.error = errorMessage(error);
    this.settled = true;
    this.phase = "error";
    await this.configuration.onError?.(error);
    if (this.minimized) {
      showMindTraceNotice(this.error, 8e3);
      this.close();
      return;
    }
    this.render();
  }
  updateProgress(progress) {
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
    this.host.toggleClass("is-result", this.phase === "success" || this.phase === "error");
    this.dockHost();
    if (this.keyHandler !== null) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    if (this.backdropHandler !== null) {
      this.host.removeEventListener("click", this.backdropHandler);
      this.backdropHandler = null;
    }
    this.card.toggleClass("is-success", this.phase === "success");
    this.card.toggleClass("is-error", this.phase === "error");
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
      this.elapsedTimer = window.setInterval(() => this.paintProgress(), 1e3);
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
      this.elapsedTimer = window.setInterval(() => this.paintProgress(), 1e3);
      return;
    }
    const succeeded = this.phase === "success";
    this.card.setAttribute("role", "dialog");
    this.card.setAttribute("aria-modal", "true");
    this.titleEl.textContent = succeeded ? this.configuration.successTitle ?? "处理完成" : this.configuration.errorTitle ?? "处理没有完成";
    const successDetail = typeof this.configuration.successDetail === "function" ? this.configuration.successDetail(this.result) : this.configuration.successDetail;
    this.bodyEl.createEl("p", { cls: "mind-trace-dialog-body", text: succeeded ? successDetail ?? "相关内容已经更新。" : this.error ?? "发生未知错误。" });
    let primary;
    if (!succeeded) {
      const closeButton = this.actionsEl.createEl("button", { text: "关闭", attr: { type: "button" } });
      closeButton.addEventListener("click", () => this.close());
      const retry = this.actionsEl.createEl("button", { cls: "mod-cta", text: "重试", attr: { type: "button" } });
      retry.addEventListener("click", () => void this.start());
      primary = retry;
    } else if (this.configuration.onViewResult !== void 0 || this.configuration.successLabel) {
      const view = this.actionsEl.createEl("button", { cls: "mod-cta", text: this.configuration.successLabel ?? "查看结果", attr: { type: "button" } });
      view.addEventListener("click", () => {
        const result = this.result;
        this.close();
        this.configuration.onViewResult?.(result);
      });
      primary = view;
    } else {
      const done = this.actionsEl.createEl("button", { cls: "mod-cta", text: "完成", attr: { type: "button" } });
      done.addEventListener("click", () => this.close());
      primary = done;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        this.close();
      }
    };
    this.keyHandler = onKey;
    document.addEventListener("keydown", onKey);
    const onBackdrop = (event) => {
      if (event.target === this.host) {
        this.close();
      }
    };
    this.host.addEventListener("click", onBackdrop);
    this.backdropHandler = onBackdrop;
    window.requestAnimationFrame(() => primary.focus({ preventScroll: true }));
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
  other: "其他"
};
var EVENT_TYPE_LABEL_VALUES = Object.fromEntries(
  Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => [label, type])
);
var EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);
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
var MAX_EVENT_ELEMENTS = MAX_EVENT_ARGUMENTS;
var MAX_EVENT_RELATIONS = 12;
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
function normalizeEvent(event) {
  const id = typeof event?.id === "string" ? event.id.trim() : "";
  const type = EVENT_TYPES.includes(event?.type) ? event.type : "other";
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
  const elements = [...new Map(arguments2.map((argument) => [eventEntityKey(argument.entity), argument.entity])).values()];
  return { id, type, title, summary, arguments: arguments2, relations, elements, legacy: event?.legacy === true };
}
function validateEvents(events, allowEmpty = true) {
  if (!Array.isArray(events) || events.length > MAX_SESSION_EVENTS || !allowEmpty && events.length === 0) {
    throw new Error(`今日事件需要保留 0–${MAX_SESSION_EVENTS} 条`);
  }
  return events.map((raw, index) => {
    const event = normalizeEvent(raw);
    const rawArgumentCount = Array.isArray(raw?.arguments) ? raw.arguments.length : Array.isArray(raw?.elements) ? raw.elements.length : 0;
    const rawRelationCount = Array.isArray(raw?.relations) ? raw.relations.length : 0;
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
        "同时尽量完整提取当天明确发生的互动、决定、行动、进展、受阻、变化和具体经历为 events；纯情绪、抽象洞察或近期日记中的旧事不能单独作为今天的事件。没有明确事件时返回空数组。",
        "每个事件包含 type、简短 title、事实性 summary、1–16 个 arguments，以及 0–12 个 relations。type 只能是 interaction、decision、action、progress、obstacle、change、experience、other。",
        "argument 包含 role、label 和 entity；role 只能是 actor、participant、counterparty、recipient、target、object、context、location、cause、outcome、related；entity.kind 只能是 person、group、organization、project、product、place、activity、object、topic。",
        "日记叙述者本人必须使用 person 实体“我”，不得命名为“用户”。若内容讨论产品或服务的用户，应提取为带有具体名称的 group 实体，例如“插件用户”。",
        "只要正文明确支持，就完整保留人物、群体、组织、项目、产品、地点、活动、工具、对象、原因和结果。不要因为某个事件只有一个论元而删除它，也不要为了产生连线虚构论元。",
        "relation 只保存正文明确陈述的实体间事实，包含 type、label、subject、object；type 只能是 affiliation、social、ownership、part_of、dependency、collaboration、located_in、other，且 subject 与 object 必须也出现在该事件 arguments 中。普通共同出现不写成 relation。",
        "近期记录出现过同一实体时尽量复用原名称。最多返回 20 个互不重复的事件。",
        "切片总结回答该维度今天具体发生了什么，不写建议，不重复空泛评价。",
        "日记正文使用自然的第一人称；洞察根据当天信息量动态给出 2–4 条，不为凑数重复同一观察；微行动必须小而具体；主题为 1–5 个简短中文名词。",
        "反思洞察与正文分开：不要把模型推测混入日记事实。微行动优先回应用户尚未收尾的事项或疑问，避免泛泛建议。",
        "近期日记只作为背景，不能把旧事实写成今天发生的事。若它与今天有明确联系，可在洞察或微行动中温和指出延续、变化或未收尾线索；无关时不要为了表现记忆而强行引用。",
        TONE_INSTRUCTIONS[tone],
        customSection,
        SAFETY_INSTRUCTION,
        '只输出 JSON：{"diary":"...","events":[{"type":"interaction","title":"...","summary":"...","arguments":[{"role":"actor","label":"行动者","entity":{"kind":"person","name":"..."}}],"relations":[{"type":"affiliation","label":"任职于","subject":{"kind":"person","name":"..."},"object":{"kind":"organization","name":"..."}}]}],"facets":[{"category":"工作","summary":"..."},{"category":"生活","summary":"..."}],"insights":["..."],"microAction":"...","selfQuestion":"...","themes":["..."]}'
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
function buildWeeklyReportMessages(source, settings) {
  const custom = settings.customInstructions.trim().length > 0 ? `\n用户表达偏好：${settings.customInstructions.trim()}` : "";
  return [
    {
      role: "system",
      content: [
        "你是一位谨慎、具体的中文个人周报分析助手。",
        "只使用给定的日记和本地统计；不虚构数字、日期、原因或完成情况。",
        "先总结状态变化，再给出有证据的可能原因，最后提出一个可在下周完成的小行动。",
        "情绪解读必须是假设性的，同时给出支持线索和另一种可能解释，不进行心理或医学诊断。",
        "evidenceDates 只能使用输入中出现且位于本周的 YYYY-MM-DD 日期。",
        TONE_INSTRUCTIONS[settings.reflectionTone],
        custom,
        SAFETY_INSTRUCTION,
        '只输出 JSON：{"summary":"...","changes":[{"observation":"...","evidenceDates":["YYYY-MM-DD"]}],"possibleCauses":[{"hypothesis":"...","evidenceDates":["YYYY-MM-DD"]}],"emotionReading":{"hypothesis":"...","clues":["..."],"alternative":"..."},"themes":[{"name":"...","observation":"..."}],"nextStep":{"action":"...","reason":"..."},"selfQuestion":"..."}'
      ].join("\n")
    },
    {
      role: "user",
      content: `报告周期：${source.period.start} 至 ${source.period.end}\n\n本地确定性统计：\n${weeklyStatsText(source.stats, source.previousStats)}\n\n日记摘录：\n${source.excerpts}${source.truncated ? "\n\n注：输入过长，已截取部分较早内容。" : ""}`
    }
  ];
}
function buildEventBackfillMessages(sessions, knownElements = [], maximum = 50, preservedSessions = []) {
  return [
    {
      role: "system",
      content: [
        "你是中文日记事件整理助手。把所有给定会话当作同一个自然周联合整理，只从各会话当天的正文与切片中提取明确发生的互动、决定、行动、进展、受阻、变化和经历。",
        "纯情绪、抽象洞察、建议或其他日期的旧事不能作为事件；没有明确事件时返回空数组，不要为了填满而虚构。",
        "事件使用四层结构：type、title、summary、arguments、relations。论元包含 role、label、entity；实体 kind 只能是 person、group、organization、project、product、place、activity、object、topic。",
        "日记叙述者本人必须统一为 person 实体“我”，不得命名为“用户”。产品或服务的用户应使用带具体名称的 group 实体，例如“插件用户”。",
        "relation 只能保存正文明确支持的实体事实，subject 和 object 必须同时是该事件的论元；普通共同出现不是 relation。每个会话最多 20 个事件。",
        `所有返回会话合计最多 ${maximum} 个事件；在额度内优先保留事实明确、论元充分、对理解本周有价值的事件。`,
        "跨会话统一同一实体的名称并去除重复事件；已知实体与内容指向同一对象时复用原名称，不要自行进行模糊合并。",
        '只输出 JSON：{"sessions":[{"id":"输入中的会话 ID","date":"YYYY-MM-DD","time":"HH:mm","events":[{"type":"interaction","title":"...","summary":"...","arguments":[{"role":"actor","label":"行动者","entity":{"kind":"person","name":"..."}}],"relations":[]}]}]}'
      ].join("\n")
    },
    {
      role: "user",
      content: `已知实体：${knownElements.length > 0 ? knownElements.map((element) => `${EVENT_KIND_LABELS[element.kind]}：${element.name}`).join("；") : "无"}\n\n必须保留且仅作为命名与连续性上下文的事件：\n${preservedSessions.length > 0 ? preservedSessions.map((session) => `【${session.date} ${session.time}】${JSON.stringify(session.events.map((event) => ({ type: event.type, title: event.title, arguments: event.arguments, relations: event.relations }))).slice(0, 6e3)}`).join("\n") : "无"}\n\n待整理会话：\n${sessions.map((session) => eventBackfillSessionText(session)).join("\n\n")}`
    }
  ];
}
function eventBackfillSessionText(session) {
  const facets = session.facets.map((facet) => `${facet.category}：${facet.summary}`).join("；").slice(0, 2500) || "无";
  const diary = session.diary.slice(0, 6e3);
  const candidates = Array.isArray(session.events) && session.events.length > 0 ? JSON.stringify(session.events.map((event) => ({ type: event.type, title: event.title, summary: event.summary, arguments: event.arguments, relations: event.relations }))).slice(0, 4e3) : "无";
  return `【ID ${session.date}#${session.sessionIndex}｜${session.date} ${session.time}】\n日记：${diary}\n切片：${facets}\n日级候选：${candidates}`;
}
function buildRepairMessages(raw, shape) {
  const eventSchema = '{"type":"interaction|decision|action|progress|obstacle|change|experience|other","title":"string","summary":"string","arguments":[{"role":"actor|participant|counterparty|recipient|target|object|context|location|cause|outcome|related","label":"string","entity":{"kind":"person|group|organization|project|product|place|activity|object|topic","name":"string"}}],"relations":[{"type":"affiliation|social|ownership|part_of|dependency|collaboration|located_in|other","label":"string","subject":{"kind":"...","name":"string"},"object":{"kind":"...","name":"string"}}]}';
  const schema = shape === "follow-up" ? '{"question":"string","continue":boolean}' : shape === "journal" ? `{"diary":"string","events":[${eventSchema}],"facets":[{"category":"string","summary":"string"}],"insights":["string"],"microAction":"string","selfQuestion":"string","themes":["string"]}` : shape === "event-backfill" ? `{"sessions":[{"id":"string","date":"YYYY-MM-DD","time":"HH:mm","events":[${eventSchema}]}]}` : shape === "weekly-report" ? '{"summary":"string","changes":[{"observation":"string","evidenceDates":["YYYY-MM-DD"]}],"possibleCauses":[{"hypothesis":"string","evidenceDates":["YYYY-MM-DD"]}],"emotionReading":{"hypothesis":"string","clues":["string"],"alternative":"string"},"themes":[{"name":"string","observation":"string"}],"nextStep":{"action":"string","reason":"string"},"selfQuestion":"string"}' : '{"mood":{"score":3,"reason":"string"},"energy":{"score":3,"reason":"string"},"stress":{"score":3,"reason":"string"}}';
  const constraints = shape === "journal" ? "events 需为 0–20 个，事件各含 1–16 个合法 arguments 和 0–12 个 relations；facets 需有 2–6 个且 category 互不重复，insights 需根据信息量动态给出 2–4 条，themes 需有 1–5 个。" : shape === "event-backfill" ? "保留 sessions 的 date 和 time，每个 events 为 0–20 个，所有关系端点必须属于同一事件的论元。" : shape === "rating" ? "三个 score 均需为 1–5 的整数，每项 reason 均不能为空。" : "";
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
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`模型结果中的 ${key} 格式不正确`);
  }
  return raw.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`模型结果中的 ${key} 格式不正确`);
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
    throw new Error("模型结果缺少周报结构");
  }
  const changes = reportObjectArray(value, "changes", ["observation"]);
  const possibleCauses = reportObjectArray(value, "possibleCauses", ["hypothesis"]);
  const emotionClues = stringArrayField(emotion, "clues");
  if (emotionClues.length === 0) {
    throw new Error("AI 情绪假设至少需要一条文字线索");
  }
  for (const item of [...changes, ...possibleCauses]) {
    if (!Array.isArray(item.evidenceDates)) {
      throw new Error("周报证据日期格式不正确");
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
  const requested = new Map(requestedSessions.map((session) => [`${session.date}#${session.sessionIndex}`, session]));
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
  return parseWithRepair(
    provider,
    raw,
    "weekly-report",
    (value) => parseWeeklyReport(value, source.period)
  );
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
  constructor(container, initialEvents, onChange = null, options = {}) {
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
      title: "",
      summary: "",
      arguments: [{ role: "related", label: "相关", entity: { kind: "topic", name: "" } }],
      relations: []
    });
    if (this.collapsible) {
      this.expandedIndexes.clear();
      this.expandedIndexes.add(this.events.length - 1);
    }
    this.render();
    this.notify();
    this.container.querySelector(".mind-trace-event-title-input:last-of-type")?.focus();
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
            text: "×",
            attr: { type: "button", "aria-label": `移除事件 ${eventIndex + 1} 的论元 ${argumentIndex + 1}` }
          });
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
          argumentsHost.querySelector(".mind-trace-event-element-row:last-of-type input")?.focus();
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
          const removeRelation = row.createEl("button", { text: "×", attr: { type: "button", "aria-label": `移除事件 ${eventIndex + 1} 的关系 ${relationIndex + 1}` } });
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

// src/saved-journal-view.ts
var import_obsidian3 = require("obsidian");

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
    return { schema: 2, source: "legacy", reviewed: true };
  }
  try {
    const value = JSON.parse(raw);
    return {
      schema: Number(value.schema) === 3 ? 3 : 2,
      source: ["daily", "weekly", "manual", "legacy"].includes(value.source) ? value.source : "legacy",
      reviewed: value.reviewed === true
    };
  } catch {
    return { schema: 2, source: "legacy", reviewed: true };
  }
}
function parseSavedEvents(block) {
  if (!block.includes("### 今日事件")) {
    return { state: "missing", events: [] };
  }
  const section = sectionBlock(block, "今日事件");
  const meta = parseEventSectionMeta(section);
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
      return { id, type, title, summary, arguments: arguments2, relations, legacy: meta.schema < 3 };
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
function parseTranscript(block) {
  const marker = "> [!info]- 原始问答";
  const start = block.indexOf(marker);
  if (start === -1) {
    return "";
  }
  return block.slice(start + marker.length).split("\n").map((line) => line.replace(/^> ?/, "")).join("\n").replace(/\*\*(.+?)\*\*/g, "$1").trim();
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
    return {
      time: heading[1],
      diary: sectionText(block, "日记"),
      events: savedEvents.events,
      eventState: savedEvents.state,
      eventSchema: savedEvents.schema ?? 2,
      eventSource: savedEvents.source ?? "legacy",
      eventReviewed: savedEvents.reviewed === true,
      ...(savedEvents.error === void 0 ? {} : { eventError: savedEvents.error }),
      facets: parseFacets(sectionText(block, "今日切片")),
      ratings: {
        mood: parseRating(block, "mood", mood),
        energy: parseRating(block, "energy", energy),
        stress: parseRating(block, "stress", stress)
      },
      insights: parseList(sectionText(block, "反思洞察")),
      microAction: sectionText(block, "明日微行动"),
      selfQuestion: sectionText(block, "留给自己的问题"),
      themes: savedThemes.length > 0 ? savedThemes : dayThemes,
      transcript: parseTranscript(block)
    };
  });
  return {
    date: frontmatter.date,
    sessions
  };
}
const PARSED_JOURNAL_CACHE_LIMIT = 500;
const parsedJournalCache = /* @__PURE__ */ new Map();
const parsedJournalInFlight = /* @__PURE__ */ new Map();
async function readParsedJournal(app, file, frontmatter) {
  const key = `${file.path}@${file.stat.mtime}`;
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
    parsedJournalCache.set(key, document);
    if (parsedJournalCache.size > PARSED_JOURNAL_CACHE_LIMIT) {
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
    parsedJournalInFlight.delete(key);
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
    { key: "events", label: "今日事件", text: session.events.map((event) => `${EVENT_TYPE_LABELS[event.type]}｜${event.title}：${event.summary}\n${event.arguments.map((argument) => `${argument.label}｜${EVENT_KIND_LABELS[argument.entity.kind]}：${argument.entity.name}`).join(" · ")}\n${event.relations.map((relation) => `${relation.subject.name}${relation.label}${relation.object.name}`).join(" · ")}`).join("\n"), weight: 6 },
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
  constructor(plugin) {
    this.plugin = plugin;
  }
  cache = /* @__PURE__ */ new Map();
  snapshot = null;
  buildPromise = null;
  progress = { done: 0, total: 0 };
  version = 0;
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
      return { entries: [], themes: [], facets: [], ignoredFiles: 0 };
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
        const listeners = /* @__PURE__ */ new Set();
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
    return { entries: [], themes: [], facets: [], ignoredFiles: 0 };
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
        return { entries: [], themes: [], facets: [], ignoredFiles: 0 };
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
          return { entries: [], themes: [], facets: [], ignoredFiles: 0 };
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
      ignoredFiles
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
function eventElementStats(events) {
  const stats = /* @__PURE__ */ new Map();
  events.forEach((event, eventIndex) => {
    for (const element of event.elements) {
      const key = eventElementKey(element);
      const current = stats.get(key) ?? { key, kind: element.kind, name: element.name, eventIndexes: /* @__PURE__ */ new Set(), first: eventIndex };
      current.eventIndexes.add(eventIndex);
      stats.set(key, current);
    }
  });
  return [...stats.values()].sort((left, right) => right.eventIndexes.size - left.eventIndexes.size || left.first - right.first || left.name.localeCompare(right.name));
}
function journalEventRecords(document2, filePath = "") {
  return document2.sessions.flatMap((session, sessionIndex) => session.events.map((event, eventIndex) => ({
    id: `${filePath || document2.date}#${sessionIndex}:${eventIndex}`,
    filePath,
    sessionIndex,
    eventIndex,
    date: document2.date,
    time: session.time,
    type: event.type,
    title: event.title,
    summary: event.summary,
    arguments: event.arguments,
    relations: event.relations,
    elements: event.elements,
    legacy: event.legacy === true
  })));
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
        latestDate: record.date
      };
      current.eventIds.add(record.id);
      current.dates.add(record.date);
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
function renderEventLedger(container, events, options = {}) {
  const ledger = container.createDiv({ cls: "mind-trace-event-ledger" });
  events.forEach((event, index) => {
    const card = ledger.createEl("article", { cls: "mind-trace-event-ledger-item" });
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
    const elements = card.createDiv({ cls: "mind-trace-event-ledger-elements", attr: { "aria-label": "事件论元" } });
    for (const argument of event.arguments) {
      const pill = elements.createSpan({ cls: `mind-trace-event-element is-${argument.entity.kind}` });
      pill.createSpan({ text: argument.label });
      pill.createEl("strong", { text: argument.entity.name });
    }
    if (event.legacy === true) {
      elements.createSpan({ cls: "mind-trace-event-legacy-badge", text: "旧结构" });
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
function renderDailyEvents(container, session, options = {}) {
  const section = container.createEl("section", { cls: "mind-trace-event-section mind-trace-saved-event-section" });
  const heading = section.createDiv({ cls: "mind-trace-card-heading" });
  const copy = heading.createDiv();
  copy.createDiv({ cls: "mind-trace-card-title", text: "今天发生了什么" });
  copy.createEl("p", { text: "直接查看每件事的概要与全部论元；需要修正时使用“整理事件”。" });
  const headingActions = heading.createDiv({ cls: "mind-trace-event-heading-actions" });
  headingActions.createSpan({ text: session.eventState === "ready" ? `${session.events.length} 件事件` : "事件" });
  if (!options.editing && options.onEditEvents !== void 0) {
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
    state.createDiv({ cls: "mind-trace-event-empty-title", text: "事件章节暂时无法识别" });
    state.createEl("p", { text: session.eventError ?? "原始 Markdown 未被修改，可以从源码修复这一节。" });
    return;
  }
  if (session.events.length === 0) {
    const state = section.createDiv({ cls: "mind-trace-event-inline-state" });
    state.createDiv({ cls: "mind-trace-event-empty-title", text: "今天没有提取到明确事件" });
    state.createEl("p", { text: "没有为了凑数而把情绪或旧事写成事件。" });
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
    ["反思洞察", `${session.insights.length} 条`],
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
function renderSession(container, session, options = {}) {
  const article = container.createEl("article", {
    cls: "mind-trace-saved-session"
  });
  const sessionHeading = article.createDiv({
    cls: "mind-trace-saved-session-heading"
  });
  sessionHeading.createSpan({ text: "今日记录" });
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
    text: "今日 \xB7 已保存"
  });
  diaryTitle.createDiv({
    cls: "mind-trace-card-title mind-trace-diary-title",
    text: "今天的正文"
  });
  diaryHeading.createSpan({ text: "心迹日记" });
  const diaryWriting = diarySection.createDiv({
    cls: "mind-trace-diary-writing"
  });
  diaryWriting.createDiv({
    cls: "mind-trace-saved-copy mind-trace-saved-diary",
    text: session.diary
  });
  const eventSession = options.events?.editing && Array.isArray(options.events.values) ? { ...session, events: options.events.values, eventState: "ready", eventError: void 0 } : session;
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
    text: "我从今天看见"
  });
  insightsHeading.createSpan({ text: "反思洞察" });
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
    text: "心迹日记 \xB7 已保存"
  });
  header.createEl("h1", {
    cls: "mind-trace-journal-title",
    text: document2.date
  });
  header.createEl("p", {
    text: `共 ${document2.sessions.length} 次记录`
  });
  if (options.onEditSource !== void 0 || options.onExportPdf !== void 0) {
    const actions = header.createDiv({
      cls: "mind-trace-saved-header-actions"
    });
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
    renderSession(shell, session, {
      events: {
        date: document2.date,
        editing: options.editingEventSessionIndex === selectedSessionIndex,
        focusIndex: options.editingEventFocusIndex,
        values: options.editingEventValues,
        busy: options.eventSaveBusy === true,
        error: options.eventSaveError,
        onEditEvents: options.onEditEvents === void 0 ? void 0 : (focusIndex) => options.onEditEvents(selectedSessionIndex, focusIndex),
        onCancelEdit: options.onCancelEventEdit,
        onSaveEvents: options.onSaveEvents
      }
    });
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
        item.createEl("p", { text: event.summary });
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
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  selectedSessionIndex = null;
  pendingEventFocus = null;
  editingEventSessionIndex = null;
  editingEventFocusIndex = null;
  editingEventValues = null;
  eventEditMtime = null;
  eventSaveBusy = false;
  eventSaveError = "";
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
    window.requestAnimationFrame(() => this.applyEventFocus());
  }
  applyEventFocus() {
    const focus = this.pendingEventFocus;
    if (focus === null) {
      return;
    }
    let target = null;
    for (const candidate of this.contentEl.querySelectorAll("article.mind-trace-event-ledger-item")) {
      if (
        candidate.getAttribute("data-event-title") === focus.title &&
        candidate.getAttribute("data-event-summary") === focus.summary &&
        candidate.getAttribute("data-event-type") === focus.type
      ) {
        target = candidate;
        break;
      }
    }
    if (target === null) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.addClass("is-focused");
    window.setTimeout(() => {
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
        }
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
    window.requestAnimationFrame(() => {
      this.contentEl.querySelector(".mind-trace-saved-event-editor .mind-trace-event-title-input")?.focus();
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
    document.title = `${journal.date}-心迹`;
    body.addClass("mind-trace-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.addEventListener("focus", restoreAfterFocus, { once: true });
    showMindTraceNotice("请在系统打印窗口中选择“存储为 PDF”");
    window.setTimeout(() => {
      try {
        window.print();
      } catch (error) {
        cleanup();
        showMindTraceNotice(
          error instanceof Error ? `无法打开 PDF 导出窗口：${error.message}` : "无法打开 PDF 导出窗口"
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
    throw new Error(`周报缺少“${heading}”部分`);
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
    throw new Error(`周报的“${label}”没有可识别内容`);
  }
  return items;
}
function validWeeklyMetricValue(value, allowDays = false) {
  const normalized = stripWeeklyInlineMarkdown(value).replace(/\s+/g, " ");
  if (normalized === "—") {
    return normalized;
  }
  const pattern = allowDays ? /^[+-]?\d+(?:\.\d+)?(?: 天)?$/ : /^[+-]?\d+(?:\.\d+)?$/;
  if (!pattern.test(normalized)) {
    throw new Error(`周报数字格式无法识别：${normalized}`);
  }
  return normalized;
}
function parseWeeklyMetrics(section) {
  const labels = {
    "记录日": "days",
    "心情": "mood",
    "精力": "energy",
    "压力": "stress"
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
      throw new Error(`周报缺少${key === "mood" ? "心情" : key === "energy" ? "精力" : "压力"}对照数据`);
    }
    const currentValue = Number.parseFloat(parsed[key].current);
    const deltaValue = Number.parseFloat(parsed[key].delta);
    if (parsed[key].current !== "—" && (!Number.isFinite(currentValue) || currentValue < 1 || currentValue > 5)) {
      throw new Error(`周报${parsed[key].label}本周值应为 1–5`);
    }
    if (parsed[key].delta !== "—" && (!Number.isFinite(deltaValue) || Math.abs(deltaValue) > 4)) {
      throw new Error(`周报${parsed[key].label}变化量无法识别`);
    }
  }
  return [parsed.mood, parsed.energy, parsed.stress];
}
function parseWeeklyEmotion(section) {
  const lines = section.split("\n").map((line) => line.replace(/^>\s?/, "").trim());
  const clues = lines.filter((line) => line.startsWith("- ")).map((line) => stripWeeklyInlineMarkdown(line.slice(2))).filter((line) => line.length > 0);
  const alternativeLine = lines.find((line) => /^\*\*另一种可能：\*\*/.test(line));
  const alternative = alternativeLine === void 0 ? "" : stripWeeklyInlineMarkdown(alternativeLine.replace(/^\*\*另一种可能：\*\*/, ""));
  const hypothesis = lines.find((line) => line.length > 0 && !line.startsWith("[!note]") && !line.startsWith("- ") && !line.startsWith("**另一种可能")) ?? "";
  if (hypothesis.length === 0 || clues.length === 0 || alternative.length === 0) {
    throw new Error("AI 情绪假设格式无法识别");
  }
  return {
    hypothesis: stripWeeklyInlineMarkdown(hypothesis),
    clues,
    alternative
  };
}
function parseWeeklyThemes(section) {
  const themes = [...section.matchAll(/^- \*\*(.+?)\*\*：(.+)$/gm)].map((match) => ({
    name: stripWeeklyInlineMarkdown(match[1] ?? ""),
    observation: stripWeeklyInlineMarkdown(match[2] ?? "")
  })).filter((theme) => theme.name.length > 0 && theme.observation.length > 0);
  if (themes.length === 0) {
    throw new Error("周报主题格式无法识别");
  }
  return themes;
}
function parseWeeklyNextStep(section) {
  const actionMatch = /^\*\*(.+?)\*\*\s*$/m.exec(section);
  if (actionMatch === null || actionMatch[1] === void 0) {
    throw new Error("周报缺少下周行动");
  }
  const reason = stripWeeklyInlineMarkdown(section.slice(actionMatch.index + actionMatch[0].length));
  if (reason.length === 0) {
    throw new Error("周报缺少行动理由");
  }
  return {
    action: stripWeeklyInlineMarkdown(actionMatch[1]),
    reason
  };
}
function parseWeeklyEventSnapshot(section) {
  if (section.length === 0) {
    return null;
  }
  if (section.includes("本周尚没有可用的结构化事件")) {
    return aggregateEventRecords([]);
  }
  const indexMarker = "### 事件索引";
  const indexStart = section.indexOf(indexMarker);
  if (indexStart === -1) {
    return null;
  }
  const eventSection = section.slice(indexStart + indexMarker.length).trim();
  const headings = [...eventSection.matchAll(/^#### (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · (.+?)\s*$/gm)];
  const records = [];
  for (const [index, heading] of headings.entries()) {
    const date = heading[1] ?? "";
    const time = heading[2] ?? "";
    const rawTitle = parseEventMarkdownText(heading[3] ?? "");
    const typeLabel = rawTitle.includes("｜") ? rawTitle.slice(0, rawTitle.indexOf("｜")).trim() : "";
    const type = EVENT_TYPE_LABEL_VALUES[typeLabel] ?? "other";
    const title = EVENT_TYPE_LABEL_VALUES[typeLabel] === void 0 ? rawTitle : rawTitle.slice(rawTitle.indexOf("｜") + 1).trim();
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? eventSection.length;
    const block = eventSection.slice(start, end);
    const summary = parseEventMarkdownText(/^- 概要：(.+)$/m.exec(block)?.[1] ?? "");
    const arguments2 = [];
    for (const match of block.matchAll(/^- 论元｜(.+?)｜(.+?)｜(.+?)：(.+)$/gm)) {
      const roleCode = parseEventMarkdownText(match[1] ?? "related");
      const roleLabel = parseEventMarkdownText(match[2] ?? "相关");
      const kind = EVENT_LABEL_KINDS[parseEventMarkdownText(match[3] ?? "")] ?? "topic";
      const name = parseEventMarkdownText(match[4] ?? "");
      if (name.length > 0) {
        arguments2.push({ role: EVENT_ROLES.includes(roleCode) ? roleCode : EVENT_ROLE_LABEL_VALUES[roleLabel] ?? "related", label: roleLabel, entity: { kind, name } });
      }
    }
    if (arguments2.length === 0) {
      for (const match of block.matchAll(/^- 论元｜(.+?)｜(.+?)：(.+)$/gm)) {
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
        for (const match of block.matchAll(new RegExp(`^- ${label}：(.+)$`, "gm"))) {
          const name = parseEventMarkdownText(match[1] ?? "");
          if (name.length > 0) {
            arguments2.push({ role: "related", label: "相关", entity: { kind, name } });
          }
        }
      }
    }
    const relations = [];
    for (const match of block.matchAll(/^- 关系｜(.+?)｜(.+?)｜(.+?)：(.+?)｜(.+?)：(.+)$/gm)) {
      relations.push({
        type: EVENT_RELATION_LABEL_VALUES[parseEventMarkdownText(match[1] ?? "")] ?? "other",
        label: parseEventMarkdownText(match[2] ?? "相关"),
        subject: { kind: EVENT_LABEL_KINDS[parseEventMarkdownText(match[3] ?? "")] ?? "topic", name: parseEventMarkdownText(match[4] ?? "") },
        object: { kind: EVENT_LABEL_KINDS[parseEventMarkdownText(match[5] ?? "")] ?? "topic", name: parseEventMarkdownText(match[6] ?? "") }
      });
    }
    try {
      const event = validateEvents([{ type, title, summary, arguments: arguments2, relations, legacy: typeLabel.length === 0 }])[0];
      records.push({ id: `snapshot#${index}`, filePath: "", sessionIndex: -1, eventIndex: index, date, time, ...event });
    } catch {
    }
  }
  return headings.length > 0 && records.length === 0 ? null : aggregateEventRecords(records);
}
function parseSavedWeeklyReport(content, frontmatter) {
  if (frontmatter["mind-trace-report"] !== true || frontmatter["report-type"] !== "weekly") {
    throw new Error("这不是可识别的心迹周报");
  }
  const reportVersion = Number(frontmatter["mind-trace-report-version"]);
  if (reportVersion !== 1 && reportVersion !== 2 && reportVersion !== 3) {
    throw new Error("周报版本无法识别");
  }
  const periodStart = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
  const periodEnd = typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "";
  if (parseLocalDate(periodStart) === null || parseLocalDate(periodEnd) === null || periodStart > periodEnd) {
    throw new Error("周报周期日期无法识别");
  }
  const sourceDays = Number(frontmatter["source-days"]);
  const sourceSessions = Number(frontmatter["source-sessions"]);
  if (!Number.isInteger(sourceDays) || sourceDays < 0 || !Number.isInteger(sourceSessions) || sourceSessions < 0) {
    throw new Error("周报记录数量无法识别");
  }
  const generatedAt = typeof frontmatter["generated-at"] === "string" ? frontmatter["generated-at"] : "";
  if (generatedAt.length === 0 || Number.isNaN(new Date(generatedAt).getTime())) {
    throw new Error("周报生成时间无法识别");
  }
  const summary = stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "一周概览"));
  const questionSection = requiredWeeklyReportSection(content, "留给自己的问题");
  const question = stripWeeklyInlineMarkdown(questionSection.split("\n> [!info]")[0] ?? "");
  if (summary.length === 0 || question.length === 0) {
    throw new Error("周报摘要或自我问题为空");
  }
  const keepPeriodDates = (items) => items.map((item) => ({
    ...item,
    evidenceDates: item.evidenceDates.filter((date) => date >= periodStart && date <= periodEnd)
  }));
  const eventSnapshot = parseWeeklyEventSnapshot(weeklyReportSection(content, "本周事件图谱"));
  const eventCount = Number(frontmatter["event-count"] ?? eventSnapshot?.records.length ?? 0);
  const eventCoveredSessions = Number(frontmatter["event-covered-sessions"] ?? 0);
  const eventSourceSessions = Number(frontmatter["event-source-sessions"] ?? sourceSessions);
  return {
    reportVersion,
    periodStart,
    periodEnd,
    generatedAt,
    sourceDays,
    sourceSessions,
    eventCount: Number.isInteger(eventCount) && eventCount >= 0 ? eventCount : 0,
    eventCoveredSessions: Number.isInteger(eventCoveredSessions) && eventCoveredSessions >= 0 ? eventCoveredSessions : 0,
    eventSourceSessions: Number.isInteger(eventSourceSessions) && eventSourceSessions >= 0 ? eventSourceSessions : sourceSessions,
    eventSnapshot,
    summary,
    metrics: parseWeeklyMetrics(requiredWeeklyReportSection(content, "本周数字")),
    changes: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "发生的变化"), "发生的变化")),
    possibleCauses: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "可能的原因"), "可能的原因")),
    emotion: parseWeeklyEmotion(requiredWeeklyReportSection(content, "AI 情绪假设")),
    themes: parseWeeklyThemes(requiredWeeklyReportSection(content, "反复出现的主题")),
    nextStep: parseWeeklyNextStep(requiredWeeklyReportSection(content, "下周最小的一步")),
    selfQuestion: question,
    truncated: content.includes("> [!info] 本周日记较长")
  };
}
function weeklyGeneratedAtText(value) {
  const date = new Date(value);
  if (value.length === 0 || Number.isNaN(date.getTime())) {
    return "生成时间未记录";
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} 生成`;
}
function weeklyMetricDeltaClass(metric) {
  const value = Number.parseFloat(metric.delta);
  if (!Number.isFinite(value) || value === 0) {
    return "is-neutral";
  }
  const favorable = metric.key === "stress" ? value < 0 : value > 0;
  return favorable ? "is-favorable" : "is-unfavorable";
}
function renderWeeklyEvidenceRows(container, items, kind, onOpenEvidenceDate = null) {
  for (const item of items) {
    const row = container.createDiv({ cls: "mind-trace-weekly-evidence-row" });
    row.createSpan({ cls: "mind-trace-weekly-evidence-mark", text: kind });
    const copy = row.createDiv();
    copy.createDiv({ cls: "mind-trace-saved-copy", text: item.text });
    if (item.evidenceDates.length > 0) {
      const dates = copy.createDiv({ cls: "mind-trace-weekly-evidence-dates", attr: { "aria-label": "文字证据日期" } });
      for (const date of item.evidenceDates) {
        if (onOpenEvidenceDate === null) {
          dates.createEl("time", { text: date.slice(5).replace("-", "/"), attr: { datetime: date, title: date } });
        } else {
          const button = dates.createEl("button", {
            text: date.slice(5).replace("-", "/"),
            attr: { type: "button", title: date, "aria-label": `打开 ${date} 的日记` }
          });
          button.addEventListener("click", () => onOpenEvidenceDate(date));
        }
      }
    }
  }
}
function eventAggregateSignature(aggregate) {
  if (aggregate === null || aggregate === void 0) {
    return "";
  }
  return aggregate.records.map((record) => `${record.date}|${record.time}|${record.type}|${record.title}|${record.summary}|${eventRecordArguments(record).map((argument) => `${argument.role}:${eventArgumentKey(argument)}`).sort().join(",")}|${(record.relations ?? []).map((relation) => `${relation.type}:${eventElementKey(relation.subject)}:${eventElementKey(relation.object)}:${relation.label}`).sort().join(",")}`).sort().join("\n");
}
function eventRecordArguments(record) {
  if (Array.isArray(record.arguments) && record.arguments.length > 0) {
    return record.arguments;
  }
  return (record.elements ?? []).map((entity) => ({ role: "related", label: "相关", entity }));
}
function memoryStarHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function memoryStarClamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
function memoryStarCurve(left, right, seed) {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = memoryStarHash(seed) % 31 - 15;
  const middleX = (left.x + right.x) / 2 - dy / distance * bend;
  const middleY = (left.y + right.y) / 2 + dx / distance * bend;
  return {
    path: `M ${left.x.toFixed(1)} ${left.y.toFixed(1)} Q ${middleX.toFixed(1)} ${middleY.toFixed(1)} ${right.x.toFixed(1)} ${right.y.toFixed(1)}`,
    label: { x: middleX, y: middleY - 6 }
  };
}
function layoutMemoryStarGraph(records, entities, argumentLinks, relationLinks, targetWidth) {
  const nodes = [];
  for (const record of records) {
    nodes.push({
      key: `event:${record.id}`,
      nodeKind: "event",
      eventId: record.id,
      collisionRadius: 72,
      degree: 0
    });
  }
  for (const entity of entities.values()) {
    const radius = Math.min(27, 16 + entity.eventIds.size * 2);
    const labelWidth = Math.min(112, Math.max(48, entity.name.length * 11 + 14));
    nodes.push({
      key: `entity:${entity.key}`,
      nodeKind: "entity",
      entityKey: entity.key,
      radius,
      collisionRadius: Math.max(radius + 12, labelWidth / 2),
      degree: 0
    });
  }
  const nodeMap = new Map(nodes.map((node) => [node.key, node]));
  const adjacency = new Map(nodes.map((node) => [node.key, /* @__PURE__ */ new Set()]));
  const springs = [];
  const addSpring = (leftKey, rightKey, length, strength) => {
    if (!nodeMap.has(leftKey) || !nodeMap.has(rightKey)) return;
    adjacency.get(leftKey)?.add(rightKey);
    adjacency.get(rightKey)?.add(leftKey);
    nodeMap.get(leftKey).degree += 1;
    nodeMap.get(rightKey).degree += 1;
    springs.push({ leftKey, rightKey, length, strength });
  };
  for (const link of argumentLinks) {
    addSpring(`event:${link.eventId}`, `entity:${link.entityKey}`, 142, 0.034);
  }
  for (const link of relationLinks) {
    addSpring(`entity:${link.leftKey}`, `entity:${link.rightKey}`, 112, 0.018);
  }
  const components = [];
  const visited = /* @__PURE__ */ new Set();
  for (const start of [...nodes].sort((left, right) => left.key.localeCompare(right.key))) {
    if (visited.has(start.key)) continue;
    const queue = [start.key];
    const componentNodes = [];
    visited.add(start.key);
    while (queue.length > 0) {
      const key = queue.shift();
      const node = nodeMap.get(key);
      if (node !== void 0) componentNodes.push(node);
      for (const neighbor of [...(adjacency.get(key) ?? [])].sort()) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(componentNodes);
  }
  const positionedComponents = components.map((componentNodes) => {
    const componentKeys = new Set(componentNodes.map((node) => node.key));
    const componentSprings = springs.filter((spring) => componentKeys.has(spring.leftKey) && componentKeys.has(spring.rightKey));
    const estimatedArea = componentNodes.reduce((sum, node) => sum + Math.PI * (node.collisionRadius + 16) ** 2, 0);
    const naturalSide = Math.sqrt(Math.max(1, estimatedArea) * 1.62);
    const boxWidth = memoryStarClamp(naturalSide * 1.22, 270, 1880);
    const boxHeight = Math.max(230, estimatedArea * 1.62 / boxWidth);
    const centerX = boxWidth / 2;
    const centerY = boxHeight / 2;
    const positions = new Map();
    [...componentNodes].sort((left, right) => right.degree - left.degree || left.key.localeCompare(right.key)).forEach((node, index) => {
      const seed = memoryStarHash(node.key);
      const angle = (seed % 360 + index * 137.508) * Math.PI / 180;
      const spread = Math.min(boxWidth, boxHeight) * (0.08 + 0.32 * Math.sqrt(index / Math.max(1, componentNodes.length - 1)));
      positions.set(node.key, {
        x: centerX + Math.cos(angle) * spread,
        y: centerY + Math.sin(angle) * spread,
        vx: 0,
        vy: 0,
        node
      });
    });
    const iterations = componentNodes.length > 180 ? 105 : componentNodes.length > 80 ? 135 : 175;
    const cellSize = 190;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const force = new Map(componentNodes.map((node) => [node.key, { x: 0, y: 0 }]));
      const grid = /* @__PURE__ */ new Map();
      for (const position of positions.values()) {
        const cellX = Math.floor(position.x / cellSize);
        const cellY = Math.floor(position.y / cellSize);
        const key = `${cellX}:${cellY}`;
        const bucket = grid.get(key) ?? [];
        bucket.push(position);
        grid.set(key, bucket);
      }
      const ordered = [...positions.values()].sort((left, right) => left.node.key.localeCompare(right.node.key));
      const orderIndex = new Map(ordered.map((position, index) => [position.node.key, index]));
      ordered.forEach((left, leftIndex) => {
        const cellX = Math.floor(left.x / cellSize);
        const cellY = Math.floor(left.y / cellSize);
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (const right of grid.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
              const rightIndex = orderIndex.get(right.node.key) ?? -1;
              if (rightIndex <= leftIndex) continue;
              let dx = right.x - left.x;
              let dy = right.y - left.y;
              let distance = Math.hypot(dx, dy);
              if (distance < 0.01) {
                const seed = memoryStarHash(`${left.node.key}|${right.node.key}`);
                dx = seed % 2 === 0 ? 0.1 : -0.1;
                dy = seed % 3 === 0 ? 0.1 : -0.1;
                distance = Math.hypot(dx, dy);
              }
              if (distance > 230) continue;
              const minimumDistance = left.node.collisionRadius + right.node.collisionRadius + 13;
              const push = 5200 / Math.max(900, distance * distance) + Math.max(0, minimumDistance - distance) * 0.115;
              const unitX = dx / distance;
              const unitY = dy / distance;
              force.get(left.node.key).x -= unitX * push;
              force.get(left.node.key).y -= unitY * push;
              force.get(right.node.key).x += unitX * push;
              force.get(right.node.key).y += unitY * push;
            }
          }
        }
      });
      for (const spring of componentSprings) {
        const left = positions.get(spring.leftKey);
        const right = positions.get(spring.rightKey);
        if (left === void 0 || right === void 0) continue;
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.max(0.01, Math.hypot(dx, dy));
        const pull = (distance - spring.length) * spring.strength;
        const unitX = dx / distance;
        const unitY = dy / distance;
        force.get(left.node.key).x += unitX * pull;
        force.get(left.node.key).y += unitY * pull;
        force.get(right.node.key).x -= unitX * pull;
        force.get(right.node.key).y -= unitY * pull;
      }
      for (const position of positions.values()) {
        const centering = 0.0045 + Math.min(0.008, position.node.degree * 8e-4);
        const currentForce = force.get(position.node.key);
        currentForce.x += (centerX - position.x) * centering;
        currentForce.y += (centerY - position.y) * centering;
        position.vx = (position.vx + currentForce.x) * 0.76;
        position.vy = (position.vy + currentForce.y) * 0.76;
        const speed = Math.hypot(position.vx, position.vy);
        if (speed > 9) {
          position.vx = position.vx / speed * 9;
          position.vy = position.vy / speed * 9;
        }
        position.x = memoryStarClamp(position.x + position.vx, position.node.collisionRadius + 24, boxWidth - position.node.collisionRadius - 24);
        position.y = memoryStarClamp(position.y + position.vy, position.node.collisionRadius + 24, boxHeight - position.node.collisionRadius - 24);
      }
    }
    const collisionOrder = [...positions.values()].sort((left, right) => left.node.key.localeCompare(right.node.key));
    const collisionIndex = new Map(collisionOrder.map((position, index) => [position.node.key, index]));
    const collisionPasses = Math.min(180, 64 + Math.ceil(Math.sqrt(componentNodes.length) * 5));
    for (let pass = 0; pass < collisionPasses; pass += 1) {
      const grid = /* @__PURE__ */ new Map();
      for (const position of collisionOrder) {
        const cellX = Math.floor(position.x / cellSize);
        const cellY = Math.floor(position.y / cellSize);
        const key = `${cellX}:${cellY}`;
        const bucket = grid.get(key) ?? [];
        bucket.push(position);
        grid.set(key, bucket);
      }
      let maximumOverlap = 0;
      collisionOrder.forEach((left, leftIndex) => {
        const cellX = Math.floor(left.x / cellSize);
        const cellY = Math.floor(left.y / cellSize);
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (const right of grid.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
              if ((collisionIndex.get(right.node.key) ?? -1) <= leftIndex) continue;
              let dx = right.x - left.x;
              let dy = right.y - left.y;
              let distance = Math.hypot(dx, dy);
              const minimumDistance = left.node.collisionRadius + right.node.collisionRadius + 14;
              if (distance >= minimumDistance) continue;
              if (distance < 0.01) {
                const seed = memoryStarHash(`collision:${left.node.key}|${right.node.key}`);
                const angle = seed % 360 * Math.PI / 180;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
                distance = 1;
              }
              const overlap = minimumDistance - distance;
              maximumOverlap = Math.max(maximumOverlap, overlap);
              const shift = overlap * 0.7;
              const unitX = dx / distance;
              const unitY = dy / distance;
              left.x -= unitX * shift;
              left.y -= unitY * shift;
              right.x += unitX * shift;
              right.y += unitY * shift;
            }
          }
        }
      });
      if (maximumOverlap < 0.45) break;
    }
    const values = [...positions.values()];
    const minimumX = Math.min(...values.map((position) => position.x - position.node.collisionRadius)) - 30;
    const maximumX = Math.max(...values.map((position) => position.x + position.node.collisionRadius)) + 30;
    const minimumY = Math.min(...values.map((position) => position.y - position.node.collisionRadius)) - 30;
    const maximumY = Math.max(...values.map((position) => position.y + position.node.collisionRadius)) + 38;
    return {
      positions,
      minimumX,
      minimumY,
      width: Math.max(190, maximumX - minimumX),
      height: Math.max(170, maximumY - minimumY)
    };
  }).sort((left, right) => right.width * right.height - left.width * left.height);
  const padding = 34;
  const gap = 24;
  const packComponents = (shelfWidth) => {
    let cursorX = padding;
    let cursorY = padding;
    let rowHeight = 0;
    let maximumX = 0;
    const eventPositions = /* @__PURE__ */ new Map();
    const entityPositions = /* @__PURE__ */ new Map();
    for (const component of positionedComponents) {
      if (cursorX > padding && cursorX + component.width > shelfWidth) {
        cursorX = padding;
        cursorY += rowHeight + gap;
        rowHeight = 0;
      }
      const offsetX = cursorX - component.minimumX;
      const offsetY = cursorY - component.minimumY;
      for (const position of component.positions.values()) {
        const point = { x: position.x + offsetX, y: position.y + offsetY };
        if (position.node.nodeKind === "event") eventPositions.set(position.node.eventId, point);
        else entityPositions.set(position.node.entityKey, point);
      }
      cursorX += component.width + gap;
      rowHeight = Math.max(rowHeight, component.height);
      maximumX = Math.max(maximumX, cursorX - gap);
    }
    return {
      eventPositions,
      entityPositions,
      width: Math.max(680, maximumX + padding),
      height: Math.max(460, cursorY + rowHeight + padding)
    };
  };
  let shelfWidth = Math.max(680, targetWidth);
  let packed = packComponents(shelfWidth);
  for (let attempt = 0; attempt < 10 && packed.height > packed.width * 1.4; attempt += 1) {
    shelfWidth = Math.ceil(shelfWidth * 1.5);
    packed = packComponents(shelfWidth);
  }
  return {
    eventPositions: packed.eventPositions,
    entityPositions: packed.entityPositions,
    width: packed.width,
    height: packed.height
  };
}
function renderMemoryStarGraph(container, aggregate, options = {}) {
  const idCounts = /* @__PURE__ */ new Map();
  const allRecords = aggregate.records.map((record, index) => {
    const baseId = typeof record.id === "string" && record.id.length > 0 ? record.id : `record-${index}`;
    const count = idCounts.get(baseId) ?? 0;
    idCounts.set(baseId, count + 1);
    return count === 0 ? { ...record, id: baseId } : { ...record, id: `${baseId}#${count}` };
  });
  const eventLimit = Math.max(1, Math.min(allRecords.length, Number(options.eventLimit) || allRecords.length));
  const entityFrequency = /* @__PURE__ */ new Map();
  for (const record of allRecords) {
    for (const key of new Set(eventRecordArguments(record).map(eventArgumentKey))) {
      entityFrequency.set(key, (entityFrequency.get(key) ?? 0) + 1);
    }
  }
  const visibleRecords = [...allRecords].sort((left, right) => {
    const score = (record) => eventRecordArguments(record).reduce((sum, argument) => sum + (entityFrequency.get(eventArgumentKey(argument)) ?? 0), 0) + (record.relations?.length ?? 0) * 2 + eventRecordArguments(record).length;
    return score(right) - score(left) || left.date.localeCompare(right.date) || left.time.localeCompare(right.time);
  }).slice(0, eventLimit).sort((left, right) => left.id.localeCompare(right.id));
  const visibleEventIds = new Set(visibleRecords.map((record) => record.id));
  const entities = /* @__PURE__ */ new Map();
  const argumentLinks = [];
  const relationLinks = [];
  for (const record of visibleRecords) {
    for (const argument of eventRecordArguments(record)) {
      const key = eventArgumentKey(argument);
      const current = entities.get(key) ?? { key, ...argument.entity, eventIds: /* @__PURE__ */ new Set(), roles: /* @__PURE__ */ new Map() };
      current.eventIds.add(record.id);
      current.roles.set(record.id, argument.label);
      entities.set(key, current);
      argumentLinks.push({ eventId: record.id, entityKey: key, label: argument.label });
    }
    for (const relation of record.relations ?? []) {
      relationLinks.push({
        eventId: record.id,
        leftKey: eventElementKey(relation.subject),
        rightKey: eventElementKey(relation.object),
        label: relation.label
      });
    }
  }
  const layout = layoutMemoryStarGraph(visibleRecords, entities, argumentLinks, relationLinks, Math.max(680, Math.min(1180, (container.clientWidth || 880) * 1.3)));
  const { eventPositions, entityPositions, width, height } = layout;
  container.empty();
  const shell = container.createDiv({ cls: "mind-trace-memory-layout" });
  const stage = shell.createDiv({ cls: "mind-trace-memory-stage" });
  const inspector = shell.createEl("aside", { cls: "mind-trace-memory-inspector", attr: { "aria-live": "polite", "aria-label": "图谱节点详情" } });
  const toolbar = stage.createDiv({ cls: "mind-trace-memory-toolbar", attr: { "aria-label": "图谱缩放工具" } });
  const zoomOut = toolbar.createEl("button", { text: "−", attr: { type: "button", "aria-label": "缩小图谱", title: "缩小" } });
  const zoomReset = toolbar.createEl("button", { text: "适合", attr: { type: "button", "aria-label": "重置图谱视图", title: "适合画布" } });
  const zoomIn = toolbar.createEl("button", { text: "+", attr: { type: "button", "aria-label": "放大图谱", title: "放大" } });
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "group", tabindex: "0", "aria-label": options.ariaLabel ?? "事件与论元记忆星图" });
  svg.classList.add("mind-trace-memory-star");
  const viewport = svgElement("g", { class: "mind-trace-memory-viewport" });
  const edgeLayer = svgElement("g", { class: "mind-trace-memory-edge-layer" });
  const relationLayer = svgElement("g", { class: "mind-trace-memory-relation-layer" });
  for (const link of argumentLinks) {
      const eventPoint = eventPositions.get(link.eventId);
      const entityPoint = entityPositions.get(link.entityKey);
      if (eventPoint === void 0 || entityPoint === void 0) continue;
      const curve = memoryStarCurve(eventPoint, entityPoint, `${link.eventId}|${link.entityKey}`);
      const path = svgElement("path", { d: curve.path, class: "mind-trace-memory-argument-edge", "data-event": link.eventId, "data-entity": link.entityKey });
      edgeLayer.append(path);
      const role = svgElement("text", { x: String(curve.label.x), y: String(curve.label.y), "text-anchor": "middle", class: "mind-trace-memory-role-label", "data-event": link.eventId, "data-entity": link.entityKey });
      role.textContent = link.label;
      edgeLayer.append(role);
  }
  for (const link of relationLinks) {
      const left = entityPositions.get(link.leftKey);
      const right = entityPositions.get(link.rightKey);
      if (left === void 0 || right === void 0) continue;
      const curve = memoryStarCurve(left, right, `relation:${link.eventId}|${link.leftKey}|${link.rightKey}`);
      relationLayer.append(svgElement("path", { d: curve.path, class: "mind-trace-memory-relation-edge", "data-event": link.eventId, "data-left": link.leftKey, "data-right": link.rightKey }));
      const label = svgElement("text", { x: String(curve.label.x), y: String(curve.label.y), "text-anchor": "middle", class: "mind-trace-memory-relation-label", "data-event": link.eventId });
      label.textContent = link.label;
      relationLayer.append(label);
  }
  viewport.append(edgeLayer, relationLayer);
  const eventNodes = [];
  for (const record of visibleRecords) {
    const point = eventPositions.get(record.id);
    if (point === void 0) continue;
    const node = svgElement("g", { class: `mind-trace-memory-event-node is-${record.type ?? "other"}`, "data-event": record.id, tabindex: "0", role: "button", "aria-pressed": "false", "aria-label": `${EVENT_TYPE_LABELS[record.type] ?? "事件"}：${record.title}` });
    node.append(svgElement("rect", { x: String(point.x - 68), y: String(point.y - 27), width: "136", height: "54", rx: "17" }));
    const type = svgElement("text", { x: String(point.x), y: String(point.y - 7), "text-anchor": "middle", class: "mind-trace-memory-event-type" });
    type.textContent = EVENT_TYPE_LABELS[record.type] ?? "事件";
    const title = svgElement("text", { x: String(point.x), y: String(point.y + 12), "text-anchor": "middle", class: "mind-trace-memory-event-title" });
    title.textContent = record.title.length > 11 ? `${record.title.slice(0, 11)}…` : record.title;
    node.append(type, title);
    viewport.append(node);
    eventNodes.push(node);
  }
  const entityNodes = [];
  for (const entity of entities.values()) {
    const point = entityPositions.get(entity.key);
    if (point === void 0) continue;
    const node = svgElement("g", { class: `mind-trace-memory-entity-node is-${entity.kind}`, "data-entity": entity.key, tabindex: "0", role: "button", "aria-pressed": "false", "aria-label": `${EVENT_KIND_LABELS[entity.kind]} ${entity.name}，参与 ${entity.eventIds.size} 件事件` });
    const radius = Math.min(25, 15 + entity.eventIds.size * 2);
    if (["organization", "project", "product"].includes(entity.kind)) {
      node.append(svgElement("rect", { x: String(point.x - radius), y: String(point.y - radius), width: String(radius * 2), height: String(radius * 2), rx: entity.kind === "organization" ? "5" : "10" }));
    } else if (["place", "activity"].includes(entity.kind)) {
      node.append(svgElement("polygon", { points: `${point.x},${point.y - radius} ${point.x + radius},${point.y} ${point.x},${point.y + radius} ${point.x - radius},${point.y}` }));
    } else {
      node.append(svgElement("circle", { cx: String(point.x), cy: String(point.y), r: String(radius) }));
    }
    const glyph = svgElement("text", { x: String(point.x), y: String(point.y + 4), "text-anchor": "middle", class: "mind-trace-memory-entity-glyph" });
    glyph.textContent = EVENT_KIND_LABELS[entity.kind].slice(0, 1);
    const label = svgElement("text", { x: String(point.x), y: String(point.y + radius + 16), "text-anchor": "middle", class: "mind-trace-memory-entity-label" });
    label.textContent = entity.name.length > 9 ? `${entity.name.slice(0, 9)}…` : entity.name;
    node.append(glyph, label);
    viewport.append(node);
    entityNodes.push(node);
  }
  svg.append(viewport);
  stage.append(svg);
  let activeEvent = visibleRecords.some((record) => record.id === options.initialState?.activeEvent) ? options.initialState.activeEvent : null;
  let activeEntity = entities.has(options.initialState?.activeEntity) ? options.initialState.activeEntity : null;
  const timeText = (record) => typeof record.time === "string" && /^\d{2}:\d{2}/.test(record.time) ? record.time.slice(0, 5) : "未记录具体时间";
  const renderInspector = () => {
    inspector.empty();
    if (activeEvent === null && activeEntity === null) {
      inspector.createDiv({ cls: "mind-trace-memory-inspector-kicker", text: "节点详情" });
      inspector.createEl("h3", { text: "从一颗星开始" });
      inspector.createEl("p", { cls: "mind-trace-memory-inspector-empty", text: "选择事件查看发生时间、概要和论元；选择实体查看它连接的全部事件。" });
      return;
    }
    if (activeEvent !== null) {
      const record = allRecords.find((candidate) => candidate.id === activeEvent);
      if (record === void 0) return;
      inspector.createDiv({ cls: "mind-trace-memory-inspector-kicker", text: EVENT_TYPE_LABELS[record.type] ?? "事件" });
      inspector.createEl("h3", { text: record.title });
      const when = inspector.createEl("time", {
        cls: "mind-trace-memory-inspector-time",
        text: `${record.date} · ${timeText(record)}`,
        attr: { datetime: timeText(record) === "未记录具体时间" ? record.date : `${record.date}T${timeText(record)}` }
      });
      when.setAttribute("title", "事件发生时间");
      inspector.createEl("p", { cls: "mind-trace-memory-inspector-summary", text: record.summary });
      const argumentTitle = inspector.createDiv({ cls: "mind-trace-memory-inspector-label", text: `论元 · ${eventRecordArguments(record).length}` });
      argumentTitle.setAttribute("role", "heading");
      argumentTitle.setAttribute("aria-level", "4");
      const argumentsList = inspector.createDiv({ cls: "mind-trace-memory-inspector-arguments" });
      for (const argument of eventRecordArguments(record)) {
        const item = argumentsList.createDiv({ cls: `mind-trace-memory-inspector-argument is-${argument.entity.kind}` });
        item.createSpan({ text: argument.label });
        item.createEl("strong", { text: argument.entity.name });
        item.createEl("small", { text: EVENT_KIND_LABELS[argument.entity.kind] });
      }
      if ((record.relations ?? []).length > 0) {
        inspector.createDiv({ cls: "mind-trace-memory-inspector-label", text: `明确关系 · ${record.relations.length}` });
        const relations = inspector.createDiv({ cls: "mind-trace-memory-inspector-relations" });
        for (const relation of record.relations) {
          relations.createDiv({ text: `${relation.subject.name} —${relation.label}→ ${relation.object.name}` });
        }
      }
      return;
    }
    const entity = entities.get(activeEntity) ?? aggregate.nodes.find((node) => node.key === activeEntity);
    const related = allRecords.filter((record) => eventRecordArguments(record).some((argument) => eventArgumentKey(argument) === activeEntity)).sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time));
    inspector.createDiv({ cls: "mind-trace-memory-inspector-kicker", text: entity === void 0 ? "实体" : EVENT_KIND_LABELS[entity.kind] });
    inspector.createEl("h3", { text: entity?.name ?? "论元" });
    inspector.createDiv({ cls: "mind-trace-memory-inspector-count", text: `连接 ${related.length} 件事件` });
    const relatedList = inspector.createDiv({ cls: "mind-trace-memory-inspector-events" });
    for (const record of related) {
      const item = relatedList.createDiv({ cls: "mind-trace-memory-inspector-event" });
      item.createEl("time", { text: `${record.date} · ${timeText(record)}`, attr: { datetime: timeText(record) === "未记录具体时间" ? record.date : `${record.date}T${timeText(record)}` } });
      item.createEl("strong", { text: record.title });
      item.createSpan({ text: EVENT_TYPE_LABELS[record.type] ?? "事件" });
    }
  };
  const paint = () => {
    const activeEvents = /* @__PURE__ */ new Set();
    const activeEntities = /* @__PURE__ */ new Set();
    if (activeEvent !== null) {
      activeEvents.add(activeEvent);
      const record = visibleRecords.find((candidate) => candidate.id === activeEvent);
      for (const argument of record === void 0 ? [] : eventRecordArguments(record)) activeEntities.add(eventArgumentKey(argument));
    } else if (activeEntity !== null) {
      activeEntities.add(activeEntity);
      for (const record of visibleRecords) {
        if (eventRecordArguments(record).some((argument) => eventArgumentKey(argument) === activeEntity)) {
          activeEvents.add(record.id);
          for (const argument of eventRecordArguments(record)) activeEntities.add(eventArgumentKey(argument));
        }
      }
    }
    const selecting = activeEvent !== null || activeEntity !== null;
    for (const node of eventNodes) {
      const id = node.getAttribute("data-event") ?? "";
      node.classList.toggle("is-active", selecting && activeEvents.has(id));
      node.classList.toggle("is-dimmed", selecting && !activeEvents.has(id));
      node.setAttribute("aria-pressed", String(activeEvent === id));
    }
    for (const node of entityNodes) {
      const key = node.getAttribute("data-entity") ?? "";
      node.classList.toggle("is-active", selecting && activeEntities.has(key));
      node.classList.toggle("is-dimmed", selecting && !activeEntities.has(key));
      node.setAttribute("aria-pressed", String(activeEntity === key));
    }
    for (const edge of svg.querySelectorAll(".mind-trace-memory-argument-edge, .mind-trace-memory-role-label")) {
      const connected = activeEvents.has(edge.getAttribute("data-event") ?? "") && activeEntities.has(edge.getAttribute("data-entity") ?? "");
      edge.classList.toggle("is-active", selecting && connected);
      edge.classList.toggle("is-dimmed", selecting && !connected);
    }
    for (const edge of svg.querySelectorAll(".mind-trace-memory-relation-edge, .mind-trace-memory-relation-label")) {
      const connected = activeEvents.has(edge.getAttribute("data-event") ?? "");
      edge.classList.toggle("is-active", selecting && connected);
      edge.classList.toggle("is-dimmed", selecting && !connected);
    }
    const filtered = activeEvent !== null ? allRecords.filter((record) => record.id === activeEvent) : activeEntity !== null ? allRecords.filter((record) => eventRecordArguments(record).some((argument) => eventArgumentKey(argument) === activeEntity)) : allRecords;
    renderInspector();
    inspector.toggleClass("is-visible", selecting);
    options.onSelection?.(filtered, activeEvent, activeEntity);
    options.onStateChange?.({ activeEvent, activeEntity });
  };
  const activateNode = (node, kind) => {
    const activate = () => {
      if (kind === "event") {
        const id = node.getAttribute("data-event");
        activeEvent = activeEvent === id ? null : id;
        activeEntity = null;
      } else {
        const key = node.getAttribute("data-entity");
        activeEntity = activeEntity === key ? null : key;
        activeEvent = null;
      }
      paint();
    };
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      activate();
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      } else if (event.key === "Escape") {
        activeEvent = null;
        activeEntity = null;
        paint();
      }
    });
  };
  eventNodes.forEach((node) => activateNode(node, "event"));
  entityNodes.forEach((node) => activateNode(node, "entity"));
  const view = {
    scale: Number.isFinite(options.initialState?.scale) ? memoryStarClamp(options.initialState.scale, 0.65, 3) : 1,
    x: Number.isFinite(options.initialState?.x) ? options.initialState.x : 0,
    y: Number.isFinite(options.initialState?.y) ? options.initialState.y : 0
  };
  const emitState = () => options.onStateChange?.({ activeEvent, activeEntity, scale: view.scale, x: view.x, y: view.y });
  const applyView = () => {
    viewport.setAttribute("transform", `translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.scale.toFixed(3)})`);
    emitState();
  };
  const zoomAround = (factor, centerX = width / 2, centerY = height / 2) => {
    const nextScale = memoryStarClamp(view.scale * factor, 0.65, 3);
    const worldX = (centerX - view.x) / view.scale;
    const worldY = (centerY - view.y) / view.scale;
    view.x = centerX - worldX * nextScale;
    view.y = centerY - worldY * nextScale;
    view.scale = nextScale;
    applyView();
  };
  zoomOut.addEventListener("click", () => zoomAround(0.82));
  zoomIn.addEventListener("click", () => zoomAround(1.22));
  zoomReset.addEventListener("click", () => {
    view.scale = 1;
    view.x = 0;
    view.y = 0;
    applyView();
  });
  const svgPointFromClient = (clientX, clientY) => {
    const matrix = svg.getScreenCTM?.();
    if (matrix !== null && matrix !== void 0) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    const bounds = svg.getBoundingClientRect();
    return {
      x: (clientX - bounds.left) / Math.max(1, bounds.width) * width,
      y: (clientY - bounds.top) / Math.max(1, bounds.height) * height
    };
  };
  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const point = svgPointFromClient(event.clientX, event.clientY);
    zoomAround(event.deltaY < 0 ? 1.12 : 0.89, point.x, point.y);
  }, { passive: false });
  let pan = null;
  let suppressBackgroundClick = false;
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest?.(".mind-trace-memory-event-node, .mind-trace-memory-entity-node")) return;
    const point = svgPointFromClient(event.clientX, event.clientY);
    pan = { x: point.x, y: point.y, clientX: event.clientX, clientY: event.clientY, viewX: view.x, viewY: view.y, moved: false };
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add("is-panning");
  });
  svg.addEventListener("pointermove", (event) => {
    if (pan === null) return;
    const point = svgPointFromClient(event.clientX, event.clientY);
    const deltaX = point.x - pan.x;
    const deltaY = point.y - pan.y;
    pan.moved = pan.moved || Math.hypot(event.clientX - pan.clientX, event.clientY - pan.clientY) > 4;
    view.x = pan.viewX + deltaX;
    view.y = pan.viewY + deltaY;
    applyView();
  });
  const endPan = (event) => {
    if (pan === null) return;
    suppressBackgroundClick = pan.moved;
    pan = null;
    svg.releasePointerCapture?.(event.pointerId);
    svg.classList.remove("is-panning");
  };
  svg.addEventListener("pointerup", endPan);
  svg.addEventListener("pointercancel", endPan);
  svg.addEventListener("click", () => {
    if (suppressBackgroundClick) {
      suppressBackgroundClick = false;
      return;
    }
    activeEvent = null;
    activeEntity = null;
    paint();
  });
  svg.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      activeEvent = null;
      activeEntity = null;
      paint();
    }
  });
  applyView();
  paint();
  emitState();
  return { visibleRecords, visibleEventIds, getState: () => ({ activeEvent, activeEntity, scale: view.scale, x: view.x, y: view.y }) };
}
function renderWeeklyEventCenter(container, report, options = {}) {
  const section = options.existingSection ?? container.createEl("section", { cls: "mind-trace-event-section mind-trace-weekly-event-center" });
  section.empty();
  section.addClass("mind-trace-event-section", "mind-trace-weekly-event-center");
  options.onEventCenter?.(section);
  const heading = section.createDiv({ cls: "mind-trace-card-heading" });
  const copy = heading.createDiv();
  copy.createDiv({ cls: "mind-trace-card-title", text: "这一周围绕什么展开" });
  copy.createEl("p", { text: "位置只由事件与论元的连接关系决定；选择节点后查看发生时间与完整上下文。" });
  const liveSource = options.eventSource ?? null;
  const aggregate = liveSource?.events ?? report.eventSnapshot ?? aggregateEventRecords([]);
  const coverage = liveSource === null ? { covered: report.eventCoveredSessions, source: report.eventSourceSessions } : { covered: liveSource.eventCoveredSessions, source: liveSource.eventSourceSessions };
  const graphStatus = heading.createSpan({ text: options.eventLoading ? "正在读取日记…" : `${aggregate.records.length} 件事件 · ${coverage.covered}/${coverage.source} 篇已覆盖` });
  if (typeof options.eventError === "string" && options.eventError.length > 0) {
    section.createDiv({ cls: "mind-trace-event-inline-state is-error", text: options.eventError, attr: { role: "alert" } });
  }
  if (aggregate.records.length > (Number(options.weeklyEventLimit) || 50)) {
    section.createDiv({ cls: "mind-trace-event-inline-state", text: `本周有 ${aggregate.records.length} 件事件，超过当前上限；人工确认内容仍被完整保留。`, attr: { role: "status" } });
  }
  if (liveSource !== null && report.eventSnapshot !== null && eventAggregateSignature(liveSource.events) !== eventAggregateSignature(report.eventSnapshot)) {
    const stale = section.createDiv({ cls: "mind-trace-event-snapshot-status" });
    stale.createEl("strong", { text: "当前图谱已根据日记更新" });
    stale.createSpan({ text: "Markdown 快照仍是上次生成周报时的版本。" });
  }
  if ((liveSource?.eventInvalidSessions.length ?? 0) > 0) {
    section.createDiv({ cls: "mind-trace-event-inline-state is-error", text: `${liveSource.eventInvalidSessions.length} 篇记录的事件章节格式无法识别，请从原始 Markdown 修复。`, attr: { role: "alert" } });
  }
  const legacyCount = liveSource?.eventLegacySessions.length ?? 0;
  const calibrationCount = liveSource?.eventCalibrationSessions.length ?? 0;
  if (legacyCount + calibrationCount > 0 && options.onBackfillEvents !== void 0) {
    const missing = section.createDiv({ cls: "mind-trace-event-coverage-card" });
    const missingCopy = missing.createDiv();
    missingCopy.createEl("strong", { text: `${legacyCount + calibrationCount} 篇记录可以进行周级校准` });
    missingCopy.createEl("p", { text: "确认后将统一论元、关系与实体名称，人工确认内容保持不变。" });
    const button = missing.createEl("button", { text: legacyCount > 0 ? "升级并校准本周" : "校准本周事件", attr: { type: "button" } });
    button.disabled = options.backfillBusy === true;
    button.addEventListener("click", options.onBackfillEvents);
  }
  if (typeof options.backfillMessage === "string" && options.backfillMessage.length > 0) {
    const status = section.createDiv({ cls: `mind-trace-event-backfill-message${options.backfillBusy === true ? " mind-trace-llm-inline-status" : ""}`, attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
    if (options.backfillBusy === true) {
      attachLlmActivityStatus(status, options.llmActivitySource, options.backfillMessage);
    } else {
      status.textContent = options.backfillMessage;
    }
  }
  if (options.eventLoading && liveSource === null) {
    section.createDiv({ cls: "mind-trace-event-inline-state", text: "正在从本周日记整理事件与元素…", attr: { role: "status" } });
    return;
  }
  if (aggregate.records.length === 0) {
    const empty = section.createDiv({ cls: "mind-trace-event-inline-state" });
    empty.createDiv({ cls: "mind-trace-event-empty-title", text: coverage.source > 0 && coverage.covered === coverage.source ? "本周没有提取到明确事件" : "本周事件图谱还没有足够数据" });
    empty.createEl("p", { text: "图谱不会把情绪或推测自动转成事件。" });
    return;
  }
  const graphWrap = section.createDiv({ cls: "mind-trace-weekly-element-graph" });
  const ledgerDetails = section.createEl("details", { cls: "mind-trace-event-ledger-disclosure mind-trace-weekly-event-ledger-disclosure" });
  ledgerDetails.open = options.ledgerOpen === true;
  ledgerDetails.addEventListener("toggle", () => options.onLedgerToggle?.(ledgerDetails.open));
  const ledgerSummary = ledgerDetails.createEl("summary");
  const ledgerSummaryTitle = ledgerSummary.createSpan({ cls: "mind-trace-event-ledger-disclosure-title", text: "完整事件账" });
  const ledgerSummaryCount = ledgerSummary.createSpan({ cls: "mind-trace-event-ledger-disclosure-count", text: `${aggregate.records.length} 件` });
  const ledgerHost = ledgerDetails.createDiv({ cls: "mind-trace-weekly-event-ledger-host" });
  const renderLedger = (filtered, activeEvent, activeEntity) => {
    const entityName = activeEntity === null ? "" : aggregate.nodes.find((node) => node.key === activeEntity)?.name ?? "论元";
    ledgerSummaryTitle.textContent = activeEvent !== null ? `${filtered[0]?.title ?? "事件"} · 所选事件` : activeEntity !== null ? `${entityName} · 相关事件` : "完整事件账";
    ledgerSummaryCount.textContent = `${filtered.length} 件`;
    ledgerHost.empty();
    const grouped = new Map();
    for (const record of [...filtered].sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time))) {
      const group = grouped.get(record.date) ?? [];
      group.push(record);
      grouped.set(record.date, group);
    }
    for (const [date, records] of grouped) {
      const day = ledgerHost.createEl("section", { cls: "mind-trace-weekly-event-day" });
      day.createEl("time", { text: date, attr: { datetime: date } });
      renderEventLedger(day, records, {
        onOpenEvent: (record) => options.onOpenEvent?.(record)
      });
    }
  };
  const result = renderMemoryStarGraph(graphWrap, aggregate, {
    eventLimit: options.graphEventLimit ?? 20,
    ariaLabel: "本周事件与论元记忆星图",
    initialState: options.graphState,
    onStateChange: options.onGraphStateChange,
    onSelection: renderLedger
  });
  graphStatus.textContent = `图中 ${result.visibleRecords.length}/${aggregate.records.length} 件 · ${coverage.covered}/${coverage.source} 篇已覆盖`;
  const legend = graphWrap.createDiv({ cls: "mind-trace-event-kind-legend" });
  for (const kind of EVENT_KINDS) {
    legend.createSpan({ cls: `is-${kind}`, text: EVENT_KIND_LABELS[kind] });
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
  header.createDiv({ cls: "mind-trace-eyebrow", text: "心迹周报 \xB7 已生成" });
  header.createEl("h1", { cls: "mind-trace-journal-title", text: `${report.periodStart} — ${report.periodEnd}` });
  header.createEl("p", { text: `${report.sourceDays} 个记录日 \xB7 ${report.sourceSessions} 篇记录 \xB7 ${weeklyGeneratedAtText(report.generatedAt)}` });
  const actions = header.createDiv({ cls: "mind-trace-saved-header-actions" });
  if (options.onRegenerate !== void 0) {
    const regenerate = actions.createEl("button", {
      cls: "mind-trace-export-pdf mind-trace-report-regenerate",
      text: options.busy ? "正在生成…" : "重新生成",
      attr: { type: "button" }
    });
    regenerate.disabled = options.busy === true;
    regenerate.addEventListener("click", options.onRegenerate);
  }
  if (options.onEditSource !== void 0) {
    const edit = actions.createEl("button", { cls: "mind-trace-edit-source", text: "编辑 Markdown", attr: { type: "button" } });
    edit.disabled = options.busy === true;
    edit.addEventListener("click", options.onEditSource);
  }
  if (options.busy === true) {
    const status = shell.createDiv({ cls: "mind-trace-report-inline-status", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
    attachLlmActivityStatus(status, options.llmActivitySource, "正在根据当前日记重新整理这一周…");
  }
  if (typeof options.error === "string" && options.error.length > 0) {
    shell.createDiv({ cls: "mind-trace-report-inline-error", text: options.error, attr: { role: "alert" } });
  }
  const fold = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-fold" });
  const ledger = fold.createDiv({ cls: "mind-trace-weekly-ledger" });
  ledger.createDiv({ cls: "mind-trace-section-kicker", text: "一周账页" });
  ledger.createEl("time", { text: `${report.periodStart.slice(5).replace("-", ".")}\n—\n${report.periodEnd.slice(5).replace("-", ".")}` });
  const ledgerStats = ledger.createDiv({ cls: "mind-trace-weekly-ledger-stats" });
  for (const [label, value] of [["记录日", String(report.sourceDays)], ["总篇数", String(report.sourceSessions)]]) {
    const item = ledgerStats.createDiv();
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
  const foldBody = fold.createDiv({ cls: "mind-trace-weekly-fold-body" });
  foldBody.createDiv({ cls: "mind-trace-diary-kicker", text: "一周概览 \xB7 已归档" });
  foldBody.createDiv({ cls: "mind-trace-card-title mind-trace-diary-title", text: "这一周的正文" });
  foldBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-summary", text: report.summary });
  const metricsSection = shell.createEl("section", { cls: "mind-trace-rating-comparison mind-trace-weekly-metrics" });
  const metricsHeading = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-heading" });
  const metricsCopy = metricsHeading.createDiv();
  metricsCopy.createDiv({ cls: "mind-trace-section-kicker", text: "状态对照 \xB7 前一周" });
  metricsCopy.createDiv({ cls: "mind-trace-rating-comparison-title", text: "这一周，状态如何移动", attr: { role: "heading", "aria-level": "2" } });
  metricsCopy.createEl("p", { text: "本周值来自日记自评平均；变化量用前一完整周作对照。" });
  const metricGrid = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-grid" });
  for (const metric of report.metrics) {
    const card = metricGrid.createEl("section", { cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${metric.key} mind-trace-weekly-metric-card` });
    const cardHeading = card.createDiv({ cls: "mind-trace-rating-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-rating-card-title", text: metric.label });
    cardHeading.createSpan({ cls: `mind-trace-rating-difference ${weeklyMetricDeltaClass(metric)}`, text: metric.delta === "—" ? "暂无对照" : `较上周 ${metric.delta}` });
    const value = card.createDiv({ cls: "mind-trace-weekly-metric-value" });
    value.createEl("output", { text: metric.current });
    value.createSpan({ text: metric.current === "—" ? "" : "/ 5" });
  }
  renderWeeklyEventCenter(shell, report, options);
  const analysisGrid = shell.createDiv({ cls: "mind-trace-weekly-analysis-grid" });
  for (const [title, label, items, mark] of [["发生的变化", "从这一周看见", report.changes, "变化"], ["可能的原因", "保留推测的边界", report.possibleCauses, "线索"]]) {
    const card = analysisGrid.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-analysis-card" });
    const cardHeading = card.createDiv({ cls: "mind-trace-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-card-title", text: title });
    cardHeading.createSpan({ text: label });
    renderWeeklyEvidenceRows(card, items, mark, options.onOpenEvidenceDate ?? null);
  }
  const emotion = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-emotion-card" });
  const emotionHeading = emotion.createDiv({ cls: "mind-trace-card-heading" });
  emotionHeading.createDiv({ cls: "mind-trace-card-title", text: "AI 对这一周的情绪假设" });
  emotionHeading.createSpan({ text: "双重读法" });
  emotion.createEl("p", { cls: "mind-trace-weekly-emotion-note", text: "这是根据文字线索的假设性解读，不是心理或医学诊断。" });
  const emotionGrid = emotion.createDiv({ cls: "mind-trace-weekly-emotion-grid" });
  const primary = emotionGrid.createDiv({ cls: "mind-trace-weekly-emotion-primary" });
  primary.createSpan({ text: "主要假设" });
  primary.createDiv({ cls: "mind-trace-saved-copy", text: report.emotion.hypothesis });
  const alternative = emotionGrid.createDiv({ cls: "mind-trace-weekly-emotion-alternative" });
  alternative.createSpan({ text: "另一种可能" });
  alternative.createDiv({ cls: "mind-trace-saved-copy", text: report.emotion.alternative });
  const clues = emotion.createDiv({ cls: "mind-trace-weekly-clues" });
  clues.createSpan({ text: "文字线索" });
  const clueList = clues.createEl("ul");
  for (const clue of report.emotion.clues) {
    clueList.createEl("li", { text: clue });
  }
  const themesSection = shell.createEl("section", { cls: "mind-trace-facets-section mind-trace-weekly-themes" });
  const themesHeading = themesSection.createDiv({ cls: "mind-trace-card-heading" });
  themesHeading.createDiv({ cls: "mind-trace-card-title", text: "反复出现的主题" });
  themesHeading.createSpan({ text: "一周切片" });
  const themesGrid = themesSection.createDiv({ cls: "mind-trace-facets-grid" });
  for (const theme of report.themes) {
    const card = themesGrid.createDiv({ cls: "mind-trace-facet-card" });
    const themeHeader = card.createDiv({ cls: "mind-trace-facet-header" });
    themeHeader.createSpan({ cls: "mind-trace-facet-kind", text: "周内主题" });
    card.createDiv({ cls: "mind-trace-facet-category", text: theme.name });
    card.createDiv({ cls: "mind-trace-facet-divider", attr: { "aria-hidden": "true" } });
    card.createDiv({ cls: "mind-trace-saved-copy mind-trace-facet-summary", text: theme.observation });
  }
  const closing = shell.createDiv({ cls: "mind-trace-reflection-grid mind-trace-weekly-closing" });
  const actionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-action-card" });
  const actionHeading = actionSection.createDiv({ cls: "mind-trace-card-heading" });
  actionHeading.createDiv({ cls: "mind-trace-card-title", text: "下周最小的一步" });
  actionHeading.createSpan({ text: "只做这一小步" });
  const actionBody = actionSection.createDiv({ cls: "mind-trace-action-body" });
  actionBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-action", text: report.nextStep.action });
  actionBody.createEl("p", { cls: "mind-trace-weekly-action-reason", text: report.nextStep.reason });
  const questionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-question-card" });
  const questionHeading = questionSection.createDiv({ cls: "mind-trace-card-heading" });
  questionHeading.createDiv({ cls: "mind-trace-card-title", text: "留给自己的问题" });
  questionHeading.createSpan({ text: "不急着回答" });
  const questionBody = questionSection.createDiv({ cls: "mind-trace-question-body" });
  questionBody.createSpan({ cls: "mind-trace-question-mark", text: "？", attr: { "aria-hidden": "true" } });
  questionBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-compact-editor", text: report.selfQuestion });
  if (report.truncated) {
    shell.createEl("p", { cls: "mind-trace-weekly-truncated", text: "本周日记较长，AI 分析使用了截取后的摘录。" });
  }
}
var SavedWeeklyReportView = class extends import_obsidian3.TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  busy = false;
  inlineError = "";
  hasRendered = false;
  eventSource = null;
  eventSourceKey = "";
  eventLoading = false;
  eventError = "";
  eventLoadToken = 0;
  backfillBusy = false;
  backfillMessage = "";
  currentReport = null;
  graphState = { activeEvent: null, activeEntity: null, scale: 1, x: 0, y: 0 };
  ledgerOpen = false;
  eventCenterEl = null;
  getViewType() {
    return WEEKLY_REPORT_VIEW_TYPE;
  }
  getDisplayText() {
    return this.file?.basename ?? "心迹周报";
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
      this.eventSource = null;
      this.eventSourceKey = "";
      this.eventError = "";
      this.eventLoadToken += 1;
      this.backfillMessage = "";
    }
    this.render(!clear);
  }
  clear() {
    this.contentEl.empty();
  }
  render(preserveContext = false) {
    const context = preserveContext ? captureMindTraceContext(this.contentEl) : null;
    this.contentEl.empty();
    this.contentEl.addClass("mind-trace-view", "mind-trace-saved-file-view", "mind-trace-report-file-view");
    if (renderPrivacyGate(this.contentEl, this.plugin)) {
      return;
    }
    const rendered = this.contentEl.createDiv({ cls: "mind-trace-saved-render" });
    try {
      const frontmatter = parseFrontmatter(this.data, "心迹周报");
      const report = parseSavedWeeklyReport(this.data, frontmatter);
      this.currentReport = report;
      const periodKey = `${report.periodStart}--${report.periodEnd}`;
      if (this.eventSourceKey !== periodKey) {
        this.eventSourceKey = periodKey;
        this.eventSource = null;
        this.eventError = "";
        this.graphState = { activeEvent: null, activeEntity: null, scale: 1, x: 0, y: 0 };
        this.ledgerOpen = false;
      }
      renderSavedWeeklyReport(rendered, report, {
        animate: !this.hasRendered,
        busy: this.busy,
        error: this.inlineError,
        ...this.eventRenderOptions(report),
        onRegenerate: () => this.beginReportRegeneration(report),
        onEditSource: () => {
          void this.openMarkdownSource();
        },
        onOpenEvidenceDate: (date) => {
          void this.plugin.openJournalDate(date);
        },
        onOpenEvent: (record) => {
          void this.plugin.openJournalSession(record.filePath, record.sessionIndex);
        },
        onBackfillEvents: () => {
          void this.beginEventBackfill(report);
        },
      });
      this.hasRendered = true;
      if (!this.eventLoading && this.eventSource === null && this.eventError.length === 0) {
        void this.loadEventSource(report);
      }
    } catch (error) {
      this.renderError(rendered, errorMessage(error));
    }
    if (context !== null) {
      restoreMindTraceContext(this.contentEl, context);
    }
  }
  eventRenderOptions(report, existingSection = null) {
    return {
      eventSource: this.eventSource,
      eventLoading: this.eventLoading,
      eventError: this.eventError,
      graphEventLimit: this.plugin.settings.weeklyGraphEventLimit,
      weeklyEventLimit: this.plugin.settings.weeklyEventLimit,
      llmActivitySource: this.plugin,
      backfillBusy: this.backfillBusy,
      backfillMessage: this.backfillMessage,
      graphState: this.graphState,
      ledgerOpen: this.ledgerOpen,
      existingSection,
      onEventCenter: (section) => {
        this.eventCenterEl = section;
      },
      onGraphStateChange: (state) => {
        this.graphState = { ...this.graphState, ...state };
      },
      onLedgerToggle: (open) => {
        this.ledgerOpen = open;
      },
      onOpenEvent: (record) => {
        void this.plugin.openJournalSession(record.filePath, record.sessionIndex);
      },
      onBackfillEvents: () => {
        void this.beginEventBackfill(report);
      }
    };
  }
  refreshEventCenter(report = this.currentReport) {
    if (report === null || this.eventCenterEl === null || !this.eventCenterEl.isConnected || this.eventCenterEl.parentElement === null) {
      this.render(true);
      return;
    }
    const context = captureMindTraceContext(this.contentEl);
    renderWeeklyEventCenter(this.eventCenterEl.parentElement, report, this.eventRenderOptions(report, this.eventCenterEl));
    restoreMindTraceContext(this.contentEl, context);
  }
  async loadEventSource(report, force = false) {
    if (this.eventLoading || !this.plugin.isPrivacyUnlocked()) {
      return;
    }
    if (!force && this.eventSource !== null) {
      return;
    }
    const token = ++this.eventLoadToken;
    this.eventLoading = true;
    this.eventError = "";
    this.refreshEventCenter(report);
    try {
      const source = await this.plugin.weeklyReportRepository.collect({ type: "weekly", start: report.periodStart, end: report.periodEnd });
      if (token === this.eventLoadToken) {
        this.eventSource = source;
      }
    } catch (error) {
      if (token === this.eventLoadToken) {
        this.eventError = errorMessage(error);
      }
    } finally {
      if (token === this.eventLoadToken) {
        this.eventLoading = false;
        this.refreshEventCenter(report);
      }
    }
  }
  invalidateEventSource() {
    this.eventLoadToken += 1;
    this.eventLoading = false;
    this.eventSource = null;
    this.eventError = "";
    if (!this.backfillBusy && !this.busy) {
      this.refreshEventCenter();
    }
  }
  clearEventState() {
    this.eventLoadToken += 1;
    this.eventLoading = false;
    this.eventSource = null;
    this.eventError = "";
    this.backfillBusy = false;
    this.backfillMessage = "";
  }
  async beginEventBackfill(report) {
    const candidates = [...(this.eventSource?.eventCalibrationSessions ?? []), ...(this.eventSource?.eventLegacySessions ?? [])];
    if (candidates.length === 0 || this.backfillBusy || this.eventSource === null) {
      return;
    }
    const providerLabel = PROVIDER_LABELS[this.plugin.settings.activeProvider] ?? this.plugin.settings.activeProvider;
    const hasLegacy = (this.eventSource?.eventLegacySessions.length ?? 0) > 0;
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹周报 · 图谱整理",
      title: hasLegacy ? "升级并校准本周图谱事件？" : "校准本周图谱事件？",
      description: `将把 ${candidates.length} 篇记录的日记正文、切片和已有事件发送给 ${providerLabel}，统一事件、实体与关系；不会发送原始问答。`,
      confirmLabel: hasLegacy ? "升级并整理" : "开始整理",
      stages: ["收集本周事件", "校准图谱事件", "逐篇写回日记", "重新读取事件", "生成并更新图谱"],
      run: async (update) => {
        this.backfillBusy = true;
        this.backfillMessage = `正在后台用整周上下文整理 ${candidates.length} 篇记录。`;
        this.refreshEventCenter(report);
        update({ stage: 1, total: 5, title: "收集本周事件", detail: "正在读取最新日记，避免覆盖任务期间发生的修改。" });
        const latestSource = await this.plugin.weeklyReportRepository.collect({ type: "weekly", start: report.periodStart, end: report.periodEnd });
        const calibrated = await this.plugin.calibrateWeeklyEvents(latestSource, true, update);
        update({ stage: 5, total: 5, title: "生成并更新图谱", detail: "正在构建新的图谱布局并恢复当前浏览位置。" });
        this.eventSource = calibrated;
        this.eventError = "";
        return calibrated;
      },
      onSuccess: async () => {
        this.backfillBusy = false;
        this.backfillMessage = "";
        this.refreshEventCenter(report);
        await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      },
      onError: async () => {
        this.backfillBusy = false;
        this.backfillMessage = "";
        try {
          this.eventSource = await this.plugin.weeklyReportRepository.collect({ type: "weekly", start: report.periodStart, end: report.periodEnd });
          this.eventError = "";
        } catch (error) {
          this.eventError = errorMessage(error);
        }
        this.refreshEventCenter(report);
      },
      successTitle: "本周图谱已经整理完成",
      successDetail: `已校准 ${candidates.length} 篇记录，并根据写回后的事件重新生成图谱。`,
      successLabel: "查看图谱",
      backgroundSuccess: "本周图谱整理完成"
    });
  }
  beginReportRegeneration(report) {
    const period = { type: "weekly", start: report.periodStart, end: report.periodEnd };
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹周报 · 长任务",
      title: "重新整理这份周报？",
      description: "将重新整理本周图谱事件、写回未人工确认的日记事件，并替换现有周报 Markdown。",
      confirmLabel: "重新整理",
      warning: true,
      stages: ["读取本周记录", "整理图谱事件", "模型校准事件", "逐篇写回日记", "生成周报内容", "保存周报", "构建图谱数据", "更新周报与图谱"],
      run: async (update) => {
        this.busy = true;
        this.render(true);
        const result = await this.plugin.generateWeeklyReport(period, true, false, update);
        update({ stage: 8, total: 8, title: "更新周报与图谱", detail: "正在载入新周报并恢复当前浏览位置。" });
        this.data = await this.app.vault.cachedRead(result.file);
        this.eventSource = result.source;
        return result;
      },
      onSuccess: async () => {
        this.busy = false;
        this.inlineError = "";
        this.render(true);
        await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      },
      onError: async () => {
        this.busy = false;
        try {
          this.eventSource = await this.plugin.weeklyReportRepository.collect(period);
          this.eventError = "";
        } catch (error) {
          this.eventError = errorMessage(error);
        }
        this.render(true);
      },
      successTitle: "周报和图谱已经重新整理",
      successDetail: "事件已按整周上下文校准，周报与图谱均已更新。",
      successLabel: "查看新周报",
      backgroundSuccess: "周报和图谱重新整理完成"
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
    state.createDiv({ cls: "mind-trace-empty-title", text: message });
    state.createEl("p", {
      text: "原始 Markdown 没有被修改，可以切换到源码继续查看和修复。"
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
};

// src/journal-view.ts
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
  if (!(target instanceof HTMLElement)) {
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
  target.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const clear = () => {
    target.removeClass("is-invalid");
    target.removeAttribute("aria-invalid");
    error?.remove();
  };
  target.addEventListener("input", clear, { once: true });
  target.addEventListener("change", clear, { once: true });
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
var MIND_TRACE_MODES = [
  { id: "home", label: "主页", icon: "home" },
  { id: "record", label: "记录", icon: "notebook-pen" },
  { id: "trajectory", label: "轨迹", icon: "route" },
  { id: "reports", label: "报告", icon: "file-text" }
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
      generatedAt: typeof frontmatter["generated-at"] === "string" ? frontmatter["generated-at"] : "",
      days: Number(frontmatter["source-days"]) || 0,
      sessions: Number(frontmatter["source-sessions"]) || 0
    });
  }
  files.sort((left, right) => right.start.localeCompare(left.start) || right.end.localeCompare(left.end));
  return files;
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
  weeklyReportProgress = null;
  weeklyReportCardEl = null;
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
      if (!this.busy && !this.weeklyReportLoading && (this.mode === "home" || this.mode === "reports" || this.mode === "trajectory")) {
        if (this.metricsRenderTimer !== null) {
          window.clearTimeout(this.metricsRenderTimer);
        }
        this.metricsRenderTimer = window.setTimeout(() => {
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
      window.clearTimeout(this.historySearchTimer);
      this.historySearchTimer = null;
    }
    if (this.metricsRenderTimer !== null) {
      window.clearTimeout(this.metricsRenderTimer);
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
    this.historySectionEl = null;
    this.historyProgressEl = null;
    if (this.historySearchTimer !== null) {
      window.clearTimeout(this.historySearchTimer);
      this.historySearchTimer = null;
    }
  }
  render(preserveContext = false) {
    const existing = this.containerEl.children[1];
    const context = preserveContext && existing instanceof HTMLElement ? captureMindTraceContext(existing) : null;
    this.renderToken += 1;
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mind-trace-view");
    if (renderPrivacyGate(container, this.plugin)) {
      return;
    }
    const shell = container.createDiv({ cls: "mind-trace-app" });
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
      default:
        this.renderHome(panel);
        break;
    }
    if (context !== null) {
      restoreMindTraceContext(container, context);
    }
  }
  renderNav(shell) {
    const nav = shell.createDiv({
      cls: "mind-trace-nav",
      attr: { role: "tablist", "aria-label": "心迹模块" }
    });
    const items = nav.createDiv({ cls: "mind-trace-nav-items" });
    for (const [index, mode] of MIND_TRACE_MODES.entries()) {
      const active = this.mode === mode.id;
      const button = items.createEl("button", {
        cls: `mind-trace-nav-item${active ? " is-active" : ""}`,
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
        window.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`[data-mind-trace-focus-key="mind-trace-mode-${mode.id}"]`);
          if (target instanceof HTMLElement) {
            target.focus();
          }
        });
      });
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
          return;
        }
        event.preventDefault();
        const offset = event.key === "ArrowRight" ? 1 : -1;
        const next = MIND_TRACE_MODES[(index + offset + MIND_TRACE_MODES.length) % MIND_TRACE_MODES.length];
        this.setMode(next.id);
        window.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`[data-mind-trace-focus-key="mind-trace-mode-${next.id}"]`);
          if (target instanceof HTMLElement) {
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
      recentEvents: recentEvents.slice(0, 8),
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
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        if (this.mode === "reports" && this.leaf.view === this) {
          this.render(true);
        }
      },
      onError: (error) => {
        this.weeklyReportLoading = false;
        this.weeklyReportState = { kind: "error", key, period, message: errorMessage(error) };
        this.refreshWeeklyReportCard();
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
  generateCurrentWeekReport() {
    const period = currentWeekPeriod();
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹 · 本周周报",
      title: "生成本周周报？",
      description: "把当前自然周尚未结束的日记也纳入统计，生成本周版本；完整周结束后仍会单独生成。",
      confirm: false,
      confirmLabel: "开始生成",
      warning: false,
      stages: ["读取本周记录", "整理图谱事件", "模型校准事件", "逐篇写回日记", "生成周报内容", "保存周报", "构建图谱数据", "更新周报与图谱"],
      run: async (update) => {
        return await this.plugin.generateWeeklyReport(period, false, false, update);
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
    if (result.entries.length === 0) {
      const topGrid = shell.createDiv({ cls: "mind-trace-home-grid" });
      const calendarCell = topGrid.createDiv({ cls: "mind-trace-home-cell" });
      const weeklyCell = topGrid.createDiv({ cls: "mind-trace-home-cell" });
      dashboard.renderCalendar(result.entries, calendarCell);
      this.renderWeeklyReportCard(weeklyCell);
      const emptySection = shell.createDiv({ cls: "mind-trace-home-section" });
      dashboard.renderEmpty(emptySection);
      this.homeDashboard = dashboard;
      window.setTimeout(() => {
        void this.loadWeeklyReportCard();
      }, 0);
      return;
    }
    const filtered = filterMetrics(allEntries, this.plugin.settings.dashboardRange);
    const currentStart = addLocalDays(new Date(), -(this.plugin.settings.dashboardRange - 1));
    const previousEnd = localDateString(addLocalDays(currentStart, -1));
    const previousStart = localDateString(addLocalDays(currentStart, -this.plugin.settings.dashboardRange));
    const previousFiltered = allEntries.filter((entry) => entry.date >= previousStart && entry.date <= previousEnd);
    const topGrid = shell.createDiv({ cls: "mind-trace-home-grid" });
    const calendarCell = topGrid.createDiv({ cls: "mind-trace-home-cell" });
    const weeklyCell = topGrid.createDiv({ cls: "mind-trace-home-cell" });
    this.renderWeeklyReportCard(weeklyCell);
    dashboard.renderCalendar(result.entries, calendarCell);
    const trendSection = shell.createDiv({ cls: "mind-trace-home-section mind-trace-home-panel" });
    dashboard.renderTrend(trendSection, filtered, this.plugin.settings.dashboardRange, previousFiltered);
    const bottomGrid = shell.createDiv({ cls: "mind-trace-home-bottom-grid" });
    const themesCell = bottomGrid.createDiv({ cls: "mind-trace-home-cell" });
    const facetsCell = bottomGrid.createDiv({ cls: "mind-trace-home-cell" });
    const eventsCell = bottomGrid.createDiv({ cls: "mind-trace-home-cell" });
    dashboard.renderThemesCard(themesCell, filtered);
    dashboard.renderFacetsCard(facetsCell);
    dashboard.renderEventsCard(eventsCell);
    if (result.ignoredFiles > 0) {
      shell.createEl("p", {
        cls: "mind-trace-warning",
        text: `有 ${result.ignoredFiles} 篇心迹日记的属性格式无效，已忽略。`
      });
    }
    this.homeDashboard = dashboard;
    void this.loadAndRenderInsights(this.plugin.settings.dashboardRange, result.entries);
    window.setTimeout(() => {
      void this.loadWeeklyReportCard();
    }, 0);
  }
  renderWeeklyReportCard(container, existing = null) {
    const state = this.weeklyReportState;
    const period = state?.period ?? completedPeriod("weekly");
    const card = existing ?? container.createEl("section", { cls: "mind-trace-weekly-card" });
    card.empty();
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
      body.createEl("p", { text: state.summary });
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
  renderReportStatsCard(container) {
    const allEntries = collectMetrics(this.app).entries;
    const reportFiles = collectWeeklyReportFiles(this.app);
    const days = new Set(allEntries.map((entry) => entry.date)).size;
    const sessions = allEntries.reduce((sum, entry) => sum + entry.sessions, 0);
    const streaks = calculateStreaks(allEntries);
    const card = container.createEl("section", { cls: "mind-trace-record-card mind-trace-report-stats-card" });
    const header = card.createDiv({ cls: "mind-trace-lead-card-header" });
    header.createDiv({ cls: "mind-trace-home-section-title", text: "报告统计", attr: { role: "heading", "aria-level": "2" } });
    const rows = [
      ["周报数量", reportFiles.length],
      ["累计记录日", days],
      ["累计记录篇数", sessions],
      ["当前连续记录", streaks.current],
      ["最长连续记录", streaks.longest]
    ];
    const body = card.createDiv({ cls: "mind-trace-report-stats-body" });
    for (const [label, value] of rows) {
      const row = body.createDiv({ cls: "mind-trace-report-stats-row" });
      row.createSpan({ text: label });
      row.createEl("strong", { text: String(value) });
    }
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
    headingCopy.createEl("p", { text: "在正文、问答、主题和反思中找回过去的线索。全部检索只在本地进行。" });
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
      window.requestAnimationFrame(() => {
        const input = section.querySelector(".mind-trace-history-search-input");
        if (input instanceof HTMLInputElement) {
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
        placeholder: "搜索正文、主题、问题、行动…",
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
        window.clearTimeout(this.historySearchTimer);
      }
      this.historySearchTimer = window.setTimeout(() => {
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
        const chip = selectedValues.createEl("button", { text: `${value} ×`, attr: { type: "button", "aria-label": `移除${label}筛选 ${value}` } });
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
      const chip = chips.createEl("button", { cls: "mind-trace-history-active-filter-chip", text: `${label} ×`, attr: { type: "button", "aria-label": `移除筛选 ${label}` } });
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
    open.createSpan({ cls: "mind-trace-history-result-arrow", text: "→", attr: { "aria-hidden": "true" } });
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
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const section = this.historySectionEl;
      const input = section?.querySelector(".mind-trace-history-search-input");
      if (input instanceof HTMLInputElement) {
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
  renderReports(container) {
    const shell = container.createDiv({ cls: "mind-trace-page-shell mind-trace-reports-page" });
    const heading = shell.createDiv({ cls: "mind-trace-page-heading" });
    heading.createDiv({ cls: "mind-trace-eyebrow", text: "报告" });
    heading.createDiv({
      cls: "mind-trace-page-title",
      text: "把一段时间收拢成一张图景",
      attr: { role: "heading", "aria-level": "1" }
    });
    heading.createEl("p", { text: "支持自然周报告，自动整合本地日记与事件图谱。" });
    const current = currentWeekPeriod();
    const currentWeek = shell.createDiv({ cls: "mind-trace-current-week-report" });
    const currentCopy = currentWeek.createDiv();
    currentCopy.createDiv({ cls: "mind-trace-home-section-title", text: "本周周报", attr: { role: "heading", "aria-level": "2" } });
    currentCopy.createEl("p", { text: `${current.start.slice(5).replace("-", "/")} — ${current.end.slice(5).replace("-", "/")} · 把当前周尚未结束的日记也纳入统计，生成本周版本。` });
    const currentButton = currentWeek.createEl("button", {
      cls: "mod-cta",
      text: "生成本周周报",
      attr: { type: "button" }
    });
    currentButton.addEventListener("click", () => this.generateCurrentWeekReport());
    const lead = shell.createDiv({ cls: "mind-trace-home-lead-grid" });
    this.renderWeeklyReportCard(lead);
    this.renderReportStatsCard(lead);
    void this.loadWeeklyReportCard();
    const section = shell.createEl("section", { cls: "mind-trace-reports-list-section" });
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
      main.createSpan({
        cls: "mind-trace-home-row-arrow",
        text: "→",
        attr: { "aria-hidden": "true" }
      });
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
  async loadReportListSummaries(list, files) {
    for (const item of files) {
      const row = [...list.querySelectorAll(".mind-trace-home-row")].find((candidate) => candidate.getAttribute("data-report-path") === item.file.path);
      const summary = row?.querySelector(".mind-trace-report-list-summary");
      if (!(summary instanceof HTMLElement) || !summary.isConnected) {
        continue;
      }
      try {
        const content = await this.app.vault.cachedRead(item.file);
        summary.textContent = reportSummaryFromMarkdown(content);
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
      text: "按时间找回过去",
      attr: { role: "heading", "aria-level": "1" }
    });
    heading.createEl("p", { text: "通过日历、日记与本地全文检索回看过去。" });
    const entries = collectMetrics(this.app).entries;
    if (entries.length === 0) {
      const empty = shell.createDiv({ cls: "mind-trace-empty-state" });
      empty.createDiv({ cls: "mind-trace-empty-mark", text: "第一篇" });
      empty.createDiv({ cls: "mind-trace-empty-title", text: "从第一篇心迹日记开始" });
      empty.createEl("p", { text: "写完之后，这里会长出可以翻找的日历、日记和检索结果。" });
      const button = empty.createEl("button", { cls: "mod-cta", text: "开始记录", attr: { type: "button" } });
      button.addEventListener("click", () => this.startWizard());
      return;
    }
    const calendarSection = shell.createEl("section", { cls: "mind-trace-home-section" });
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
    this.renderHomeList(shell);
    this.renderHistoryCenter(shell);
    void this.loadAndRenderHistory();
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
        text: "✓"
      });
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
      if (questionLayout === "timeline" && draft.answers.length > 0) {
        this.scrollTimelineTo(recovery);
      }
      return;
    }
    const isAdaptiveQuestion = coreQuestion === void 0;
    const progress = isAdaptiveQuestion ? `个性化追问 · 第 ${draft.adaptiveCount + 1} 个` : `核心问题 ${draft.step}/${coreQuestions.length}`;
    const activeStep = isAdaptiveQuestion ? draft.adaptiveCount + 1 : draft.step;
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
      text: isAdaptiveQuestion ? "· 按需" : `/${String(coreQuestions.length).padStart(2, "0")}`
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
    eventsTitle.createEl("p", { text: "已随本次整理自动提取；保存后可以在关系图中逐条校正。" });
    eventsHeading.createSpan({ text: `${generatedEvents.length} 件事件 · 自动采用` });
    const eventDigest = eventsSection.createDiv({ cls: "mind-trace-event-preview-digest" });
    if (generatedEvents.length === 0) {
      eventDigest.createEl("p", { text: "今天没有提取到明确事件。" });
    } else {
      const list = eventDigest.createEl("ul");
      for (const event of generatedEvents.slice(0, 6)) {
        const item = list.createEl("li");
        item.createEl("strong", { text: event.title });
        item.createSpan({ text: event.arguments.slice(0, 3).map((argument) => `${argument.label}：${argument.entity.name}`).join(" · ") });
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
    const editors = {};
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
      if (eventTarget instanceof HTMLElement) eventTarget.tabIndex = -1;
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
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      },
      onError: () => {
        this.busy = false;
        this.render(true);
      },
      onViewResult: () => {
        const container = this.containerEl.children[1];
        findMindTraceScroller(container).scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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

// src/settings.ts
var import_obsidian5 = require("obsidian");
var PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  kimi: "Kimi",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  "openai-compatible": "OpenAI-compatible"
};
var PROVIDER_MODEL_PRESETS = {
  kimi: [
    { value: "kimi-k3", label: "Kimi K3" },
    { value: "kimi-k2.6", label: "Kimi K2.6" }
  ],
  deepseek: [
    { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" }
  ],
  qwen: [
    { value: "qwen3.8-max", label: "Qwen 3.8 Max" },
    { value: "qwen3.7-plus", label: "Qwen 3.7 Plus" },
    { value: "qwen3.7-flash", label: "Qwen 3.7 Flash" }
  ]
};
var CUSTOM_MODEL_OPTION = "__mind_trace_custom_model__";
var THINKING_LABELS = {
  auto: "自动（服务商默认）",
  off: "关闭深度思考",
  on: "开启深度思考"
};
var TONE_LABELS = {
  gentle: "温和但具体",
  direct: "直接教练式",
  companion: "纯陪伴式"
};
var PrivacyPasswordModal = class extends import_obsidian5.Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone;
  }
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("mind-trace-password-modal-shell", "mind-trace-dialog-shell");
    contentEl.empty();
    contentEl.addClass("mind-trace-password-modal");
    const configured = this.plugin.isPasswordConfigured();
    const eyebrow = contentEl.createDiv({ cls: "mind-trace-dialog-eyebrow", text: "心迹 · 隐私" });
    eyebrow.setAttribute("aria-hidden", "true");
    contentEl.createDiv({ cls: "mind-trace-dialog-title", text: configured ? "管理心迹密码" : "设置心迹密码" });
    contentEl.createEl("p", {
      cls: "mind-trace-dialog-body",
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
    const actions = form.createDiv({ cls: "mind-trace-actions mind-trace-dialog-actions" });
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    let save = null;
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
        const currentPassword = current?.value ?? "";
        openMindTraceOperation(this.app, this.plugin, {
          eyebrow: "心迹设置 · 隐私",
          title: "移除心迹密码？",
          description: "移除后，心迹页面会要求重新设置密码才能进入；Vault 中的 Markdown 原文不会改变。",
          confirmLabel: "移除密码",
          warning: true,
          stages: ["验证并移除密码"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "验证并移除密码", detail: "正在更新本地隐私设置。" });
            await this.plugin.removePrivacyPassword(currentPassword);
          },
          onSuccess: () => {
            showMindTraceNotice("心迹密码已移除");
            this.close();
            this.onDone();
          },
          successTitle: "心迹密码已移除",
          successDetail: "下次进入心迹页面时需要重新设置密码。",
          successLabel: "返回设置"
        });
      });
    }
    save = actions.createEl("button", {
      cls: "mod-cta",
      text: configured ? "更新密码" : "设置密码",
      attr: { type: "submit" }
    });
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
        showMindTraceNotice(configured ? "心迹密码已更新" : "心迹密码已设置");
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
  connectionTestBusy = false;
  display(preserveContext = false) {
    const { containerEl } = this;
    const context = preserveContext ? captureMindTraceContext(containerEl) : null;
    containerEl.empty();
    containerEl.addClass("mind-trace-settings");
    const header = containerEl.createDiv({
      cls: "mind-trace-settings-header"
    });
    header.createDiv({
      cls: "mind-trace-eyebrow",
      text: "心迹 \xB7 偏好"
    });
    header.createDiv({
      cls: "mind-trace-settings-title",
      text: "让记录更像你",
      attr: { role: "heading", "aria-level": "2" }
    });
    header.createEl("p", {
      text: "选择模型、反思方式和日记保存习惯。修改会自动保存。"
    });
    const providerSection = this.createSection(
      "模型与连接",
      "用于个性化追问、整理日记和生成反思。"
    );
    const providerCard = providerSection.createDiv({ cls: "mind-trace-provider-card" });
    this.renderProviderCard(providerCard);
    this.renderDialogueSettings();
    const journalSection = this.createSection(
      "日记与反思",
      "决定日记保存在哪里，以及心迹如何回应你。"
    );
    new import_obsidian5.Setting(journalSection).setName("日记目录").setDesc("心迹日记在当前 Vault 中的保存目录").addText(
      (text) => text.setPlaceholder("心迹日记").setValue(this.plugin.settings.journalFolder).onChange(async (value) => {
        this.plugin.settings.journalFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    const historySetting = new import_obsidian5.Setting(journalSection).setName("参考近期日记").setDesc(
      `用于按需追问和日记反思；当前参考最近 ${this.plugin.settings.historyDays} 天，0 表示关闭`
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
        `用于按需追问和日记反思；当前参考最近 ${value} 天，0 表示关闭`
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
    new import_obsidian5.Setting(journalSection).setName("反思语气").setDesc("控制洞察和建议的默认表达方式").addDropdown((dropdown) => {
      for (const [value, label] of Object.entries(TONE_LABELS)) {
        dropdown.addOption(value, label);
      }
      dropdown.setValue(this.plugin.settings.reflectionTone).onChange(async (value) => {
        this.plugin.settings.reflectionTone = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian5.Setting(journalSection).setName("个人化说明").setDesc("例如：少用鼓励套话、关注工作边界、不要替我下结论").addTextArea(
      (text) => text.setPlaceholder("可选").setValue(this.plugin.settings.customInstructions).onChange(async (value) => {
        this.plugin.settings.customInstructions = value.trim();
        await this.plugin.saveSettings();
      })
    );
    const analysisSection = this.createSection(
      "回顾与分析",
      "在完整自然周结束后生成结构化回顾；只有进入已解锁的心迹首页时才会请求模型。"
    );
    new import_obsidian5.Setting(analysisSection).setName("自动补齐上周周报").setDesc(
      "每个应用会话对最近一个完整周最多自动尝试一次；生成前会联合校准未人工确认的事件并写回日记。"
    ).addToggle((toggle) => toggle.setValue(this.plugin.settings.weeklyReportAutoGenerate !== false).onChange(async (value) => {
      this.plugin.settings.weeklyReportAutoGenerate = value;
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
    }));
    const minimumDays = Math.min(7, Math.max(3, Number(this.plugin.settings.weeklyReportMinimumDays) || 3));
    this.plugin.settings.weeklyReportMinimumDays = minimumDays;
    const minimumSetting = new import_obsidian5.Setting(analysisSection).setName("周报最低记录日").setDesc(
      `当前为 ${minimumDays} 天；低于门槛时不调用模型`
    );
    minimumSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "weekly-minimum-days");
      return slider.setLimits(3, 7, 1).setValue(minimumDays).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.weeklyReportMinimumDays = value;
      minimumSetting.setDesc(`当前为 ${value} 天；低于门槛时不调用模型`);
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
      });
    });
    const weeklyEventLimit = Math.min(100, Math.max(10, Math.round((Number(this.plugin.settings.weeklyEventLimit) || 50) / 5) * 5));
    this.plugin.settings.weeklyEventLimit = weeklyEventLimit;
    const eventLimitSetting = new import_obsidian5.Setting(analysisSection).setName("每周事件上限").setDesc(
      `当前最多保留 ${weeklyEventLimit} 件事件；人工确认内容不会因降低上限而删除`
    );
    eventLimitSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "weekly-event-limit");
      return slider.setLimits(10, 100, 5).setValue(weeklyEventLimit).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.weeklyEventLimit = value;
      if (this.plugin.settings.weeklyGraphEventLimit > value) {
        this.plugin.settings.weeklyGraphEventLimit = Math.max(5, Math.min(50, value));
      }
      eventLimitSetting.setDesc(`当前最多保留 ${value} 件事件；人工确认内容不会因降低上限而删除`);
      await this.plugin.saveSettings();
      this.display(true);
      this.plugin.refreshJournalViews();
      this.plugin.refreshWeeklyEventViews();
      });
    });
    const weeklyGraphEventLimit = Math.min(50, Math.max(5, Math.min(weeklyEventLimit, Math.round(Number(this.plugin.settings.weeklyGraphEventLimit) || 20))));
    this.plugin.settings.weeklyGraphEventLimit = weeklyGraphEventLimit;
    const graphLimitSetting = new import_obsidian5.Setting(analysisSection).setName("星图显示事件数").setDesc(
      `当前同时显示 ${weeklyGraphEventLimit} 件；完整内容始终保留在事件账中`
    );
    graphLimitSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "weekly-graph-event-limit");
      return slider.setLimits(5, Math.min(50, weeklyEventLimit), 1).setValue(weeklyGraphEventLimit).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.weeklyGraphEventLimit = value;
      graphLimitSetting.setDesc(`当前同时显示 ${value} 件；完整内容始终保留在事件账中`);
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
      this.plugin.refreshWeeklyEventViews();
      });
    });
    new import_obsidian5.Setting(analysisSection).setName("周报保存位置").setDesc(
      `${this.plugin.settings.journalFolder}/报告/周报（跟随日记目录）`
    );
    const privacySection = this.createSection(
      "隐私与草稿",
      "心迹密码可选：设置后保护插件界面，不会加密 Vault 中的 Markdown 原文；未完成问答保存在插件 data.json 中。"
    );
    new import_obsidian5.Setting(privacySection).setName("心迹密码").setDesc(
      this.plugin.isPasswordConfigured() ? this.plugin.isPrivacyUnlocked() ? "已设置 · 当前已解锁，两小时后自动锁定" : "已设置 · 当前已锁定" : "可选：未设置时可直接进入，首次进入时也可以选择暂不设置"
    ).addButton(
      (button) => button.setButtonText(this.plugin.isPasswordConfigured() ? "管理密码" : "设置密码").onClick(() => {
        new PrivacyPasswordModal(this.app, this.plugin, () => this.display(true)).open();
      })
    ).addButton(
      (button) => button.setButtonText("立即锁定").setDisabled(!this.plugin.isPasswordConfigured() || !this.plugin.isPrivacyGateEnabled() || !this.plugin.isPrivacyUnlocked()).onClick(() => {
        this.plugin.lockPrivacy(true);
        this.display(true);
      })
    );
    new import_obsidian5.Setting(privacySection).setName("清除未完成草稿").setDesc(
      this.plugin.draft === null ? "当前没有未完成草稿" : "清除评分、问答和尚未保存的生成结果"
    ).addButton(
      (button) => button.setButtonText("清除").setWarning().setDisabled(this.plugin.draft === null).onClick(() => {
        openMindTraceOperation(this.app, this.plugin, {
          eyebrow: "心迹设置 · 草稿",
          title: "清除未完成草稿？",
          description: "评分、问答和尚未保存的生成结果都会被清除，此操作无法撤销。",
          confirmLabel: "清除草稿",
          warning: true,
          stages: ["清除未完成内容"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "清除未完成内容", detail: "正在更新本地草稿状态。" });
            await this.plugin.setDraft(null);
          },
          onSuccess: () => this.display(true),
          successTitle: "草稿已清除",
          successDetail: "未完成的评分、问答和校样已经清除。",
          successLabel: "返回设置",
          backgroundSuccess: "心迹草稿已清除"
        });
      })
    );
    const debugSection = this.createSection(
      "开发者调试",
      "仅用于排查弹窗布局与交互；演示任务不会修改任何数据。密码弹窗为真实弹窗，操作会真实生效。"
    );
    new import_obsidian5.Setting(debugSection).setName("确认弹窗").setDesc("触发示例确认弹窗，确认后仅提示，不执行操作").addButton(
      (button) => button.setButtonText("触发确认弹窗").onClick(() => {
        new MindTraceConfirmModal(this.app, this.plugin, {
          eyebrow: "调试 · 确认",
          title: "这是确认弹窗示例",
          description: "用于调试确认弹窗的布局与按钮。",
          confirmLabel: "确认",
          stages: ["步骤一：演示", "步骤二：无实际操作"]
        }, () => showMindTraceNotice("确认弹窗已触发（无实际操作）")).open();
      })
    );
    new import_obsidian5.Setting(debugSection).setName("密码弹窗").setDesc("打开真实密码弹窗，可设置、移除或取消").addButton(
      (button) => button.setButtonText("触发密码弹窗").onClick(() => {
        new PrivacyPasswordModal(this.app, this.plugin, () => this.display(true)).open();
      })
    );
    new import_obsidian5.Setting(debugSection).setName("任务浮窗 · 有去向成功").setDesc("约 3 秒分阶段进度，完成后显示“查看报告”").addButton(
      (button) => button.setButtonText("触发有去向成功").onClick(() => {
        openMindTraceOperation(this.app, this.plugin, {
          confirm: false,
          eyebrow: "调试 · 任务",
          title: "演示长任务",
          stages: ["准备内容", "执行步骤", "收尾"],
          run: async (update) => {
            update({ stage: 1, total: 3, title: "准备内容", detail: "演示中…" });
            await new Promise((resolve) => window.setTimeout(resolve, 900));
            update({ stage: 2, total: 3, title: "执行步骤", detail: "演示中…" });
            await new Promise((resolve) => window.setTimeout(resolve, 900));
            update({ stage: 3, total: 3, title: "收尾", detail: "演示中…" });
            await new Promise((resolve) => window.setTimeout(resolve, 900));
          },
          successTitle: "调试任务完成",
          successDetail: "演示任务没有修改任何数据。",
          successLabel: "查看报告",
          onViewResult: () => showMindTraceNotice("查看报告按钮已触发（无实际操作）")
        });
      })
    );
    new import_obsidian5.Setting(debugSection).setName("任务浮窗 · 无去向成功").setDesc("瞬时完成，结果框只显示“完成”").addButton(
      (button) => button.setButtonText("触发无去向成功").onClick(() => {
        openMindTraceOperation(this.app, this.plugin, {
          confirm: false,
          eyebrow: "调试 · 任务",
          title: "演示瞬时任务",
          stages: ["完成"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "完成", detail: "演示中…" });
          },
          successTitle: "调试任务完成",
          successDetail: "演示任务没有修改任何数据。"
        });
      })
    );
    new import_obsidian5.Setting(debugSection).setName("任务浮窗 · 失败").setDesc("第二阶段抛出演示错误，显示“关闭 + 重试”").addButton(
      (button) => button.setButtonText("触发失败结果框").onClick(() => {
        openMindTraceOperation(this.app, this.plugin, {
          confirm: false,
          eyebrow: "调试 · 任务",
          title: "演示失败任务",
          stages: ["开始", "失败"],
          run: async (update) => {
            update({ stage: 1, total: 2, title: "开始", detail: "演示中…" });
            await new Promise((resolve) => window.setTimeout(resolve, 500));
            update({ stage: 2, total: 2, title: "失败", detail: "准备抛出演示错误…" });
            await new Promise((resolve) => window.setTimeout(resolve, 300));
            throw new Error("这是演示错误，用于调试失败结果框。");
          },
          errorTitle: "调试任务失败",
          onError: () => {}
        });
      })
    );
    new import_obsidian5.Setting(debugSection).setName("任务浮窗 · 后台完成").setDesc("启动慢任务后自动最小化，完成后只弹 Notice").addButton(
      (button) => button.setButtonText("触发后台完成").onClick(() => {
        const toast = openMindTraceOperation(this.app, this.plugin, {
          confirm: false,
          eyebrow: "调试 · 任务",
          title: "演示后台任务",
          stages: ["后台执行"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "后台执行", detail: "演示中…" });
            await new Promise((resolve) => window.setTimeout(resolve, 2500));
          },
          successTitle: "后台任务完成",
          successDetail: "演示任务没有修改任何数据。",
          backgroundSuccess: "后台调试任务已完成"
        });
        window.setTimeout(() => toast?.minimize(), 600);
      })
    );
    new import_obsidian5.Setting(debugSection).setName("Notice").setDesc("演示一条轻量通知").addButton(
      (button) => button.setButtonText("触发 Notice").onClick(() => {
        showMindTraceNotice("调试 Notice：这是一条轻提示");
      })
    );
    if (context !== null) {
      restoreMindTraceContext(containerEl, context);
    }
  }
  renderDialogueSettings() {
    const section = this.createSection(
      "对话结构",
      "选择提问页面的呈现方式，并安排心迹先问什么、最多再追问多少。页面布局立即生效；问题内容和数量上限用于下一篇新日记。"
    );
    const coreQuestions = configuredCoreQuestions(this.plugin.settings);
    const adaptiveQuestionLimit = configuredAdaptiveQuestionLimit(
      this.plugin.settings
    );
    const questionLayout = configuredQuestionLayout(
      this.plugin.settings
    );
    new import_obsidian5.Setting(section).setName("提问页面").setDesc("卡片模式专注当前问题；时间线模式保留已经完成的问答").addDropdown(
      (dropdown) => dropdown.addOption("cards", "访谈卡片").addOption("timeline", "对话时间线").setValue(questionLayout).onChange(async (value) => {
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
      text: "核心问题"
    });
    toolbarCopy.createEl("p", {
      text: `${coreQuestions.length} 个问题 \xB7 按顺序出现，可设置 1–8 个`
    });
    const addButton = toolbar.createEl("button", {
      cls: "mind-trace-question-config-add",
      attr: {
        type: "button",
        "aria-label": "添加核心问题"
      }
    });
    (0, import_obsidian5.setIcon)(addButton, "plus");
    addButton.createSpan({ text: "添加" });
    addButton.disabled = coreQuestions.length >= 8;
    addButton.addEventListener("click", () => {
      this.plugin.settings.coreQuestions = [
        ...coreQuestions,
        "今天还有什么值得记下？"
      ];
      void this.plugin.saveSettings().then(() => {
        this.display(true);
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
          "aria-label": `核心问题 ${index + 1}`
        }
      });
      input.addEventListener("change", () => {
        const value = input.value.trim();
        if (value.length === 0) {
          input.value = question;
          showMindTraceFieldError(input, "核心问题不能为空");
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
        `上移问题 ${index + 1}`,
        index === 0,
        () => {
          const questions = [...coreQuestions];
          questions.splice(index, 1);
          questions.splice(index - 1, 0, question);
          this.plugin.settings.coreQuestions = questions;
          void this.plugin.saveSettings().then(() => {
            this.display(true);
          });
        }
      );
      this.createQuestionAction(
        actions,
        "arrow-down",
        `下移问题 ${index + 1}`,
        index === coreQuestions.length - 1,
        () => {
          const questions = [...coreQuestions];
          questions.splice(index, 1);
          questions.splice(index + 1, 0, question);
          this.plugin.settings.coreQuestions = questions;
          void this.plugin.saveSettings().then(() => {
            this.display(true);
          });
        }
      );
      this.createQuestionAction(
        actions,
        "trash-2",
        `删除问题 ${index + 1}`,
        coreQuestions.length === 1,
        () => openMindTraceOperation(this.app, this.plugin, {
          eyebrow: "心迹设置 · 核心问题",
          title: `删除第 ${index + 1} 个核心问题？`,
          description: `“${question}”将从下一篇新日记的问题列表中移除。`,
          confirmLabel: "删除问题",
          warning: true,
          stages: ["更新问题列表"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "更新问题列表", detail: "正在保存新的问题顺序。" });
            this.plugin.settings.coreQuestions = coreQuestions.filter((_, questionIndex) => questionIndex !== index);
            await this.plugin.saveSettings();
          },
          onSuccess: () => this.display(true),
          successTitle: "核心问题已删除",
          successDetail: "新的问题列表会从下一篇日记开始使用。",
          successLabel: "返回设置"
        })
      );
    }
    new import_obsidian5.Setting(section).setName("恢复推荐问题").setDesc("恢复心迹默认的三道问题，不影响进行中的草稿").addButton(
      (button) => button.setButtonText("恢复默认").onClick(() => {
        openMindTraceOperation(this.app, this.plugin, {
          eyebrow: "心迹设置 · 核心问题",
          title: "恢复推荐问题？",
          description: "当前自定义问题和排序会被推荐的三道问题替换，不影响进行中的草稿。",
          confirmLabel: "恢复推荐问题",
          warning: true,
          stages: ["恢复问题列表"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "恢复问题列表", detail: "正在保存推荐问题。" });
            this.plugin.settings.coreQuestions = [...CORE_QUESTIONS];
            await this.plugin.saveSettings();
          },
          onSuccess: () => this.display(true),
          successTitle: "推荐问题已恢复",
          successDetail: "新的问题列表会从下一篇日记开始使用。",
          successLabel: "返回设置"
        });
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
  renderProviderCard(container) {
    container.empty();
    container.addClass("mind-trace-provider-card");
    const kind = this.plugin.settings.activeProvider;
    const configuration = this.plugin.settings.providers[kind];
    new import_obsidian5.Setting(container).setName("模型服务").setDesc("选择当前用于追问、整理日记和生成周报的服务").addDropdown((dropdown) => {
      dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "active-provider");
      for (const [value, label] of Object.entries(PROVIDER_LABELS)) {
        dropdown.addOption(value, label);
      }
      dropdown.setValue(kind).onChange(async (value) => {
        this.plugin.settings.activeProvider = value;
        await this.plugin.saveProviderSettings();
        this.renderProviderCard(container);
      });
    });
    const modelSetting = new import_obsidian5.Setting(container).setName("模型与思考").setDesc(
      kind === "openai-compatible" ? "填写服务商支持的模型 ID。" : "模型与深度思考在同一行；开启思考会更慢、消耗更多 token。"
    );
    const modelPresets = PROVIDER_MODEL_PRESETS[kind];
    if (modelPresets !== void 0) {
      const presetValues = new Set(modelPresets.map((preset) => preset.value));
      const customModel = !presetValues.has(configuration.model);
      modelSetting.addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "provider-model");
        for (const preset of modelPresets) {
          dropdown.addOption(preset.value, preset.label);
        }
        dropdown.addOption(CUSTOM_MODEL_OPTION, "自定义…");
        dropdown.setValue(customModel ? CUSTOM_MODEL_OPTION : configuration.model).onChange(async (value) => {
          configuration.model = value === CUSTOM_MODEL_OPTION ? "" : value;
          await this.plugin.saveProviderSettings();
          this.renderProviderCard(container);
        });
      });
      if (customModel) {
        modelSetting.addText((text) => text.setPlaceholder("输入模型 ID").setValue(configuration.model).onChange(async (value) => {
          configuration.model = value.trim();
          await this.plugin.saveProviderSettings();
        }));
      }
    } else {
      modelSetting.addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "provider-model");
        if (configuration.model.length > 0) {
          dropdown.addOption(configuration.model, configuration.model);
        }
        dropdown.addOption(CUSTOM_MODEL_OPTION, "自定义…");
        dropdown.setValue(configuration.model.length > 0 ? configuration.model : CUSTOM_MODEL_OPTION).onChange(async (value) => {
          if (value === CUSTOM_MODEL_OPTION) {
            configuration.model = "";
            await this.plugin.saveProviderSettings();
            this.renderProviderCard(container);
          }
        });
      });
      modelSetting.addText((text) => text.setPlaceholder("输入模型 ID").setValue(configuration.model).onChange(async (value) => {
        configuration.model = value.trim();
        await this.plugin.saveProviderSettings();
      }));
    }
    if (kind !== "openai-compatible") {
      modelSetting.addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "provider-thinking");
        for (const [value, label] of Object.entries(THINKING_LABELS)) {
          dropdown.addOption(value, label);
        }
        dropdown.setValue(configuration.thinkingMode ?? "auto").onChange(async (value) => {
          configuration.thinkingMode = value;
          await this.plugin.saveProviderSettings();
        });
      });
    }
    const credentialSetting = new import_obsidian5.Setting(container).setName("API Key").setDesc(this.plugin.activeCredentialStatus());
    const refreshCredentialStatus = () => {
      credentialSetting.setDesc(this.plugin.activeCredentialStatus());
    };
    if (kind === "openai-compatible") {
      credentialSetting.addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "credential-source");
        dropdown.addOption("secret-storage", "Obsidian Secret Storage").addOption("none", "无需鉴权");
        dropdown.setValue(configuration.credentialSource).onChange(async (value) => {
          configuration.credentialSource = value;
          await this.plugin.saveProviderSettings();
          this.renderProviderCard(container);
        });
      });
    }
    if (kind !== "openai-compatible" || configuration.credentialSource === "secret-storage") {
      credentialSetting.addComponent((componentContainer) => new import_obsidian5.SecretComponent(this.app, componentContainer).setValue(configuration.secretId).onChange(async (value) => {
        configuration.secretId = value;
        await this.plugin.saveProviderSettings();
        refreshCredentialStatus();
      }));
    }
    if (isChatCompletionsProvider(kind)) {
      new import_obsidian5.Setting(container).setName("Base URL").setDesc("插件会在该地址后请求 chat/completions").addText(
        (text) => text.setPlaceholder(DEFAULT_SETTINGS.providers[kind].baseUrl).setValue(configuration.baseUrl).onChange(async (value) => {
          configuration.baseUrl = value.trim();
          await this.plugin.saveProviderSettings();
        })
      );
    }
    const testSetting = new import_obsidian5.Setting(container).setName("测试连接").setDesc("发送一个最小请求，验证当前模型、地址和密钥");
    testSetting.addButton((button) => button.setButtonText("测试").setDisabled(this.connectionTestBusy).onClick(() => {
      void this.runConnectionTest(container, button);
    }));
  }
  async runConnectionTest(container, button) {
    if (this.connectionTestBusy) {
      return;
    }
    this.connectionTestBusy = true;
    button.setDisabled(true);
    container.querySelectorAll(".mind-trace-connection-task-status").forEach((element) => element.remove());
    const connectionStatus = container.createDiv({
      cls: "mind-trace-llm-inline-status mind-trace-connection-task-status",
      attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" }
    });
    const stopConnectionStatus = attachLlmActivityStatus(connectionStatus, this.plugin, "正在准备连接测试…");
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹设置 · 模型连接",
      title: "测试当前模型连接",
      description: "发送一个最小请求，验证模型名称、服务地址和鉴权信息。",
      confirm: false,
      stages: ["准备连接信息", "等待模型响应"],
      run: async (update) => {
        update({ stage: 1, total: 2, title: "准备连接信息", detail: "正在检查当前模型与鉴权配置。" });
        const provider = this.plugin.createProvider();
        update({ stage: 2, total: 2, title: "等待模型响应", detail: "已发送最小测试请求。" });
        return await provider.generate([
          { role: "user", content: "只回复：连接成功" }
        ], "test");
      },
      onSuccess: (response) => {
        stopConnectionStatus();
        connectionStatus.empty();
        connectionStatus.addClass("is-success");
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-primary", text: "模型连接正常" });
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-detail", text: response.trim().length > 0 ? response.trim().slice(0, 120) : "最小测试请求已成功完成。" });
        this.connectionTestBusy = false;
        button.setDisabled(false);
      },
      onError: (error) => {
        stopConnectionStatus();
        connectionStatus.empty();
        connectionStatus.addClass("is-error");
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-primary", text: "模型连接失败" });
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-detail", text: errorMessage(error) });
        this.connectionTestBusy = false;
        button.setDisabled(false);
      },
      successTitle: "模型连接正常",
      successDetail: (response) => response.trim().length > 0 ? `模型响应：${response.trim().slice(0, 120)}` : "请求成功完成。",
      successLabel: "返回设置",
      backgroundSuccess: "模型连接测试成功"
    });
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
      `- 概要：${eventMarkdownText(event.summary)}`
    ];
    for (const argument of event.arguments) {
      lines.push(`- 论元｜${argument.role}｜${eventMarkdownText(argument.label)}｜${EVENT_KIND_LABELS[argument.entity.kind]}：${eventMarkdownText(argument.entity.name)}`);
    }
    for (const relation of event.relations) {
      lines.push(`- 关系｜${EVENT_RELATION_LABELS[relation.type]}｜${eventMarkdownText(relation.label)}｜${EVENT_KIND_LABELS[relation.subject.kind]}：${eventMarkdownText(relation.subject.name)}｜${EVENT_KIND_LABELS[relation.object.kind]}：${eventMarkdownText(relation.object.name)}`);
    }
    return [...lines, ""];
  }).join("\n").trimEnd();
}
function eventMarkdownSection(events, options = {}) {
  const meta = {
    schema: 3,
    source: ["daily", "weekly", "manual"].includes(options.source) ? options.source : "daily",
    reviewed: options.reviewed === true
  };
  return `### 今日事件\n\n<!-- mind-trace-events: ${JSON.stringify(meta)} -->\n\n${eventMarkdownBody(events)}`;
}
function renderJournalSection(date, draft, entry) {
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
  return [
    `## ${localTimeString(date)}`,
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
    "### 反思洞察",
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
    "> [!info]- 原始问答",
    transcript
  ].join("\n");
}
function renderNewJournal(date, draft, entry) {
  const dateString = localDateString(date);
  const frontmatter = {
    "mind-trace": true,
    "mind-trace-version": 3,
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
function isMindTraceFrontmatter(frontmatter, date) {
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
  frontmatter["mind-trace-version"] = 3;
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
      parts.push(`事件与元素：${events[1].trim()}`);
    }
    if (action?.[1] !== void 0) {
      parts.push(`微行动：${action[1].trim()}`);
    }
    return [parts.join("\n")];
  });
  return excerpts.join("\n\n");
}
function upgradeJournalSchemaVersion(content) {
  return content.replace(/mind-trace-version:\s*[12]\b/, "mind-trace-version: 3");
}
function insertSessionEventSection(content, sessionIndex, events, options = {}) {
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
  return upgradeJournalSchemaVersion(updated);
}
function replaceSessionEventSection(content, sessionIndex, events, options = {}) {
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
  return upgradeJournalSchemaVersion(`${content.slice(0, blockStart)}${updatedBlock}${content.slice(blockEnd)}`);
}
var JournalRepository = class {
  constructor(app) {
    this.app = app;
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
    const content = await this.app.vault.cachedRead(file);
    if (file.stat.mtime !== expectedMtime) {
      throw new Error("日记在编辑期间发生了修改，请重新检查后再保存");
    }
    const updated = replaceSessionEventSection(content, sessionIndex, events, { source: "manual", reviewed: true });
    await this.app.vault.modify(file, updated);
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
        let content = await this.app.vault.cachedRead(file);
        for (const result of [...fileResults].sort((left, right) => right.source.sessionIndex - left.source.sessionIndex)) {
          content = result.source.eventState === "missing" ? insertSessionEventSection(content, result.source.sessionIndex, result.events, { source: "weekly", reviewed: false }) : replaceSessionEventSection(content, result.source.sessionIndex, result.events, { source: "weekly", reviewed: false });
        }
        await this.app.vault.modify(file, content);
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
    throw new Error("日记目录不能为空");
  }
  return `${journalFolder}/报告/周报`;
}
function weeklyReportPath(settings, period) {
  return `${weeklyReportFolder(settings)}/${period.start}--${period.end}.md`;
}
function scoreCell(value) {
  return value === null ? "—" : value.toFixed(1);
}
function scoreDelta(current, previous, key) {
  if (current[key] === null || previous[key] === null) {
    return "—";
  }
  const value = current[key] - previous[key];
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}
function evidenceSuffix(dates) {
  return dates.length > 0 ? ` _（${dates.join("、")}）_` : "";
}
function weeklyEventSnapshotLines(source) {
  const aggregate = source.events ?? aggregateEventRecords([]);
  if (aggregate.records.length === 0) {
    return ["_本周尚没有可用的结构化事件。_"];
  }
  const hubs = aggregate.nodes.slice(0, 10).map((node) => `- **${EVENT_KIND_LABELS[node.kind]}｜${eventMarkdownText(node.name)}**：${node.eventIds.size} 个事件，${node.dates.size} 天`);
  const records = [...aggregate.records].sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time) || left.eventIndex - right.eventIndex).flatMap((record) => {
    const lines = [
      `#### ${record.date} ${record.time} · ${EVENT_TYPE_LABELS[record.type] ?? EVENT_TYPE_LABELS.other}｜${eventMarkdownText(record.title)}`,
      `- 概要：${eventMarkdownText(record.summary)}`
    ];
    for (const argument of record.arguments ?? []) {
      lines.push(`- 论元｜${argument.role}｜${eventMarkdownText(argument.label)}｜${EVENT_KIND_LABELS[argument.entity.kind]}：${eventMarkdownText(argument.entity.name)}`);
    }
    for (const relation of record.relations ?? []) {
      lines.push(`- 关系｜${EVENT_RELATION_LABELS[relation.type]}｜${eventMarkdownText(relation.label)}｜${EVENT_KIND_LABELS[relation.subject.kind]}：${eventMarkdownText(relation.subject.name)}｜${EVENT_KIND_LABELS[relation.object.kind]}：${eventMarkdownText(relation.object.name)}`);
    }
    return [...lines, ""];
  });
  return ["### 核心元素", "", ...hubs, "", "### 事件索引", "", ...records];
}
function weeklyReportMarkdown(source, report) {
  const stats = source.stats;
  const previous = source.previousStats;
  const changes = report.changes.map((item) => `- ${item.observation}${evidenceSuffix(item.evidenceDates)}`).join("\n");
  const causes = report.possibleCauses.map((item) => `- ${item.hypothesis}${evidenceSuffix(item.evidenceDates)}`).join("\n");
  const themes = report.themes.map((item) => `- **${inlineMarkdown(item.name)}**：${item.observation}`).join("\n");
  const clues = report.emotionReading.clues.map((item) => `> - ${item}`).join("\n");
  return [
    "---",
    "mind-trace-report: true",
    "mind-trace-report-version: 3",
    "report-type: weekly",
    `period-start: ${source.period.start}`,
    `period-end: ${source.period.end}`,
    `generated-at: ${new Date().toISOString()}`,
    `source-days: ${stats.days}`,
    `source-sessions: ${stats.sessions}`,
    `event-count: ${source.events?.records.length ?? 0}`,
    `event-covered-sessions: ${source.eventCoveredSessions ?? 0}`,
    `event-source-sessions: ${source.eventSourceSessions ?? stats.sessions}`,
    "---",
    "",
    `# ${source.period.start} 至 ${source.period.end} · 心迹周报`,
    "",
    "## 一周概览",
    "",
    report.summary,
    "",
    "## 本周数字",
    "",
    "| 维度 | 本周 | 较前一周 |",
    "| --- | ---: | ---: |",
    `| 记录日 | ${stats.days} 天 | ${stats.days - previous.days >= 0 ? "+" : ""}${stats.days - previous.days} 天 |`,
    `| 心情 | ${scoreCell(stats.mood)} | ${scoreDelta(stats, previous, "mood")} |`,
    `| 精力 | ${scoreCell(stats.energy)} | ${scoreDelta(stats, previous, "energy")} |`,
    `| 压力 | ${scoreCell(stats.stress)} | ${scoreDelta(stats, previous, "stress")} |`,
    "",
    "## 发生的变化",
    "",
    changes,
    "",
    "## 可能的原因",
    "",
    causes,
    "",
    "## AI 情绪假设",
    "",
    "> [!note] 这是根据文字线索的假设性解读，不是心理或医学诊断。",
    `> ${report.emotionReading.hypothesis}`,
    ">",
    clues,
    ">",
    `> **另一种可能：**${report.emotionReading.alternative}`,
    "",
    "## 本周事件图谱",
    "",
    ...weeklyEventSnapshotLines(source),
    "",
    "## 反复出现的主题",
    "",
    themes,
    "",
    "## 下周最小的一步",
    "",
    `**${report.nextStep.action}**`,
    "",
    report.nextStep.reason,
    "",
    "## 留给自己的问题",
    "",
    report.selfQuestion,
    source.truncated ? "\n> [!info] 本周日记较长，AI 分析使用了截取后的摘录。" : "",
    ""
  ].join("\n");
}
function reportSummaryFromMarkdown(content) {
  return /^## 一周概览\s*\n+([\s\S]*?)(?=\n## |$)/m.exec(content)?.[1]?.trim() ?? "打开周报，回看这一周的变化。";
}
var WeeklyReportRepository = class {
  constructor(app) {
    this.app = app;
  }
  async collect(period) {
    const indexedEntries = collectMetrics(this.app).entries;
    const allEntries = [...indexedEntries];
    const indexedPaths = new Set(indexedEntries.map((entry) => entry.filePath));
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (indexedPaths.has(file.path)) {
        continue;
      }
      const cachedFrontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (cachedFrontmatter?.["mind-trace"] === true) {
        const metrics = metricsFromFrontmatter(cachedFrontmatter, file.path);
        if (metrics !== null) {
          allEntries.push(metrics);
          continue;
        }
      }
      try {
        const content = await this.app.vault.cachedRead(file);
        const info = (0, import_obsidian6.getFrontMatterInfo)(content);
        if (!info.exists) {
          continue;
        }
        const parsed = (0, import_obsidian6.parseYaml)(info.frontmatter);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed) || parsed["mind-trace"] !== true) {
          continue;
        }
        const metrics = metricsFromFrontmatter(parsed, file.path);
        if (metrics !== null) {
          allEntries.push(metrics);
        }
      } catch {
      }
    }
    allEntries.sort((left, right) => left.date.localeCompare(right.date));
    const entries = periodEntries(allEntries, period);
    const previousStats = metricSnapshot(periodEntries(allEntries, previousPeriod(period)));
    const excerpts = [];
    const sourceFiles = [];
    const successfulDays = /* @__PURE__ */ new Set();
    let sessions = 0;
    let length = 0;
    let truncated = false;
    let acceptingExcerpts = true;
    const eventRecords = [];
    const eventMissingSessions = [];
    const eventCalibrationSessions = [];
    const eventLegacySessions = [];
    const eventReviewedSessions = [];
    const eventInvalidSessions = [];
    let eventSourceSessions = 0;
    let eventCoveredSessions = 0;
    for (const entry of entries) {
      try {
        const file = this.app.vault.getAbstractFileByPath(entry.filePath);
        if (!(file instanceof import_obsidian6.TFile)) {
          continue;
        }
        let frontmatter = {};
        const cachedFrontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (cachedFrontmatter !== null && typeof cachedFrontmatter === "object" && !Array.isArray(cachedFrontmatter)) {
          frontmatter = cachedFrontmatter;
        } else {
          const content = await this.app.vault.cachedRead(file);
          try {
            const info = (0, import_obsidian6.getFrontMatterInfo)(content);
            const parsed = info.exists ? (0, import_obsidian6.parseYaml)(info.frontmatter) : {};
            frontmatter = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
          } catch {
          }
        }
        const journal = await readParsedJournal(this.app, file, frontmatter);
        sourceFiles.push(file);
        for (const [sessionIndex, session] of journal.sessions.entries()) {
          eventSourceSessions += 1;
          if (session.eventState === "ready") {
            eventCoveredSessions += 1;
            eventRecords.push(...session.events.map((event, eventIndex) => ({
              id: event.id || `${file.path}#${sessionIndex}:${eventIndex}`,
              filePath: file.path,
              sessionIndex,
              eventIndex,
              date: journal.date,
              time: session.time,
              type: event.type,
              title: event.title,
              summary: event.summary,
              arguments: event.arguments,
              relations: event.relations,
              elements: event.elements,
              legacy: event.legacy === true
            })));
            const sourceSession = {
              filePath: file.path,
              fileMtime: file.stat.mtime,
              date: journal.date,
              time: session.time,
              sessionIndex,
              diary: session.diary,
              facets: session.facets,
              events: session.events,
              eventState: "ready",
              eventSchema: session.eventSchema,
              eventReviewed: session.eventReviewed
            };
            if (session.eventSchema < 3) {
              eventLegacySessions.push(sourceSession);
            } else if (session.eventReviewed) {
              eventReviewedSessions.push(sourceSession);
            } else {
              eventCalibrationSessions.push(sourceSession);
            }
          } else if (session.eventState === "missing") {
            const sourceSession = {
              filePath: file.path,
              fileMtime: file.stat.mtime,
              date: journal.date,
              time: session.time,
              sessionIndex,
              diary: session.diary,
              facets: session.facets,
              events: [],
              eventState: "missing",
              eventSchema: 0,
              eventReviewed: false
            };
            eventMissingSessions.push(sourceSession);
            eventCalibrationSessions.push(sourceSession);
          } else {
            eventInvalidSessions.push({ filePath: file.path, date: journal.date, time: session.time, sessionIndex, error: session.eventError ?? "格式无法识别" });
          }
          const rawBlock = [
            `【${journal.date} ${session.time}】`,
            `自评：心情 ${session.ratings.mood.selfScore}/5，精力 ${session.ratings.energy.selfScore}/5，压力 ${session.ratings.stress.selfScore}/5`,
            `日记：${session.diary}`,
            session.events.length > 0 ? `事件：${session.events.map((event) => `${EVENT_TYPE_LABELS[event.type]}｜${event.title}（${event.arguments.map((argument) => `${argument.label}：${argument.entity.name}`).join("、")}）`).join("；")}` : "",
            session.facets.length > 0 ? `切片：${session.facets.map((item) => `${item.category}：${item.summary}`).join("；")}` : "",
            session.insights.length > 0 ? `已有洞察：${session.insights.join("；")}` : "",
            session.microAction.length > 0 ? `微行动：${session.microAction}` : "",
            session.selfQuestion.length > 0 ? `自我问题：${session.selfQuestion}` : ""
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
      truncated,
      events: aggregateEventRecords(eventRecords),
      eventSourceSessions,
      eventCoveredSessions,
      eventMissingSessions,
      eventCalibrationSessions,
      eventLegacySessions,
      eventReviewedSessions,
      eventInvalidSessions
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
  historyIndex;
  weeklyReportAttempts = /* @__PURE__ */ new Set();
  weeklyReportInFlight = /* @__PURE__ */ new Map();
  weeklyReportSourceCache = /* @__PURE__ */ new Map();
  sourceEditLeaves = /* @__PURE__ */ new WeakMap();
  privacyUnlockedUntil = 0;
  privacyTimer = null;
  metricsListeners = /* @__PURE__ */ new Set();
  draftListeners = /* @__PURE__ */ new Set();
  llmActivities = /* @__PURE__ */ new Map();
  llmActivitySequence = 0;
  async onload() {
    await this.loadPluginData();
    this.repository = new JournalRepository(this.app);
    this.weeklyReportRepository = new WeeklyReportRepository(this.app);
    this.historyIndex = new JournalHistoryIndex(this);
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
          this.historyIndex.invalidate(file.path);
          this.emitMetricsChanged();
          this.refreshWeeklyEventViews();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof import_obsidian7.TFile && file.extension === "md") {
          this.historyIndex.invalidate(oldPath);
          this.historyIndex.invalidate(file.path);
          this.emitMetricsChanged();
          this.refreshWeeklyEventViews();
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
    this.historyIndex?.clear();
    this.metricsListeners.clear();
    this.draftListeners.clear();
    this.llmActivities.clear();
    this.sourceEditLeaves = /* @__PURE__ */ new WeakMap();
  }
  async saveSettings() {
    await this.persist();
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
      (operation) => this.beginLlmActivity(kind, operation)
    );
  }
  beginLlmActivity(providerKind, operation) {
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
    this.historyIndex.invalidate(file.path);
    this.emitMetricsChanged();
    return file;
  }
  async weeklyReportStatus(period = completedPeriod("weekly")) {
    const key = `${period.start}--${period.end}`;
    let source = this.weeklyReportSourceCache.get(key);
    if (source === void 0) {
      source = await this.weeklyReportRepository.collect(period);
      this.weeklyReportSourceCache.set(key, source);
    }
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
  async generateWeeklyReport(period = completedPeriod("weekly"), overwrite = false, automatic = false, onProgress = null) {
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
      onProgress?.({ stage: 1, total: 8, title: "读取本周记录", detail: "正在收集日记、已有事件和周报状态。" });
      const status = await this.weeklyReportStatus(period);
      if ((status.kind === "ready" || status.kind === "stale") && !overwrite) {
        return status;
      }
      if (status.kind === "insufficient") {
        throw new Error(`至少需要 ${status.minimum} 个记录日才能生成周报`);
      }
      if (status.kind === "unconfigured") {
        throw new Error("请先在心迹设置中配置模型与 API Key");
      }
      let source = status.source;
      const calibrationCount = source.eventCalibrationSessions.length;
      onProgress?.({ stage: 2, total: 8, title: "整理图谱事件", detail: calibrationCount > 0 ? `发现 ${calibrationCount} 篇记录需要整周校准。` : "现有事件已经可以直接用于本周图谱。" });
      if (source.eventCalibrationSessions.length > 0) {
        source = await this.calibrateWeeklyEvents(source, false, onProgress, { model: 3, write: 4, reload: 7, total: 8 });
      }
      onProgress?.({ stage: 5, total: 8, title: "生成周报内容", detail: "正在根据整理后的日记和图谱事件生成本周回顾。" });
      const report = await generateWeeklyReport(this.createProvider(), source, this.settings);
      onProgress?.({ stage: 6, total: 8, title: "保存周报", detail: "正在把周报写入本地 Vault。" });
      const file = await this.weeklyReportRepository.save(this.settings, source, report, overwrite);
      onProgress?.({ stage: 7, total: 8, title: "构建图谱数据", detail: "正在重新汇总事件、实体和明确关系。" });
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
  async calibrateWeeklyEvents(source, includeLegacy = false, onProgress = null, progressPlan = { model: 2, write: 3, reload: 4, total: 5 }) {
    const mutable = includeLegacy ? [...source.eventCalibrationSessions, ...source.eventLegacySessions] : source.eventCalibrationSessions;
    if (mutable.length === 0) {
      return source;
    }
    const preserved = [...source.eventReviewedSessions, ...(includeLegacy ? [] : source.eventLegacySessions)].reduce((sum, session) => sum + session.events.length, 0);
    const maximum = Math.max(0, (Number(this.settings.weeklyEventLimit) || 50) - preserved);
    if (maximum === 0) {
      showMindTraceNotice(`本周已有 ${preserved} 件保留事件，已达到设置上限；未改写其他事件。`, 8e3);
      return source;
    }
    const knownElements = source.events.nodes.slice(0, 80).map((node) => ({ kind: node.kind, name: node.name }));
    const preservedSessions = [...source.eventReviewedSessions, ...(includeLegacy ? [] : source.eventLegacySessions)];
    onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: "校准图谱事件", detail: `正在统一 ${mutable.length} 篇记录中的事件、实体和关系。` });
    const results = await generateEventBackfill(this.createProvider(), mutable, knownElements, maximum, preservedSessions);
    onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "写回日记事件", detail: "正在逐篇保存校准结果。", current: 0, count: new Set(results.map((result) => result.source.filePath)).size });
    const outcome = await this.repository.applyEventBackfill(results, (current, count) => {
      onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "写回日记事件", detail: "正在逐篇保存校准结果。", current, count });
    });
    if (outcome.failed.length > 0) {
      const succeededFiles = new Set(outcome.succeeded.map((item) => item.filePath)).size;
      const failedFiles = new Set(outcome.failed.map((item) => item.filePath)).size;
      throw new Error(`周级校准部分完成：已写回 ${succeededFiles} 篇，${failedFiles} 篇未写回。${[...new Set(outcome.failed.map((failure) => failure.message))].join("；")}`);
    }
    onProgress?.({ stage: progressPlan.reload, total: progressPlan.total, title: "重新汇总图谱", detail: "正在读取写回后的事件并重建图谱数据。" });
    return await this.weeklyReportRepository.collect(source.period);
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
  isPrivacyGateEnabled() {
    return this.settings.security?.enabled !== false;
  }
  isPrivacyUnlocked() {
    if (!this.isPrivacyGateEnabled()) {
      return true;
    }
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
      iterations: PASSWORD_KDF_ITERATIONS,
      enabled: true
    };
    await this.persist();
    this.activatePrivacyUnlock();
  }
  async skipPrivacySetup() {
    this.settings.security = {
      ...structuredClone(DEFAULT_SETTINGS.security),
      ...this.settings.security
    };
    this.settings.security.enabled = false;
    if (this.privacyTimer !== null) {
      window.clearTimeout(this.privacyTimer);
      this.privacyTimer = null;
    }
    await this.persist();
    this.refreshProtectedViews();
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
    const resetSecurity = structuredClone(DEFAULT_SETTINGS.security);
    resetSecurity.enabled = false;
    this.settings.security = resetSecurity;
    this.privacyUnlockedUntil = 0;
    this.historyIndex.clear();
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
    this.historyIndex.clear();
    for (const leaf of this.app.workspace.getLeavesOfType(WEEKLY_REPORT_VIEW_TYPE)) {
      if (leaf.view instanceof SavedWeeklyReportView) {
        leaf.view.clearEventState();
      }
    }
    if (this.privacyTimer !== null) {
      window.clearTimeout(this.privacyTimer);
      this.privacyTimer = null;
    }
    this.refreshProtectedViews();
    void this.closeProtectedSources();
    if (showNotice) {
      showMindTraceNotice("心迹已锁定");
    }
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
      const currentPath = leaf.view?.file?.path ?? leaf.getViewState()?.state?.file;
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
      const currentPath = leaf.view?.file?.path ?? leaf.getViewState()?.state?.file;
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
    this.weeklyReportSourceCache.clear();
    for (const listener of this.metricsListeners) {
      listener();
    }
  }
  async loadPluginData() {
    const loaded = await this.loadData();
    if (loaded === null) {
      this.settings = structuredClone(DEFAULT_SETTINGS);
      this.draft = null;
      await this.applyCredentialInitialization(true);
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
    const loadedSecurity = typeof loadedSettings.security === "object" && loadedSettings.security !== null && !Array.isArray(loadedSettings.security) ? loadedSettings.security : {};
    const mergedSecurity = {
      ...structuredClone(DEFAULT_SETTINGS.security),
      ...loadedSecurity
    };
    if (typeof loadedSecurity.enabled !== "boolean") {
      const hasPassword = typeof loadedSecurity.salt === "string" && loadedSecurity.salt.length > 0 && typeof loadedSecurity.verifier === "string" && loadedSecurity.verifier.length > 0;
      mergedSecurity.enabled = hasPassword;
    }
    this.settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      ...loadedSettings,
      providers,
      security: mergedSecurity
    };
    this.settings.weeklyReportAutoGenerate = this.settings.weeklyReportAutoGenerate !== false;
    this.settings.weeklyReportMinimumDays = Math.min(
      7,
      Math.max(3, Math.round(Number(this.settings.weeklyReportMinimumDays) || 3))
    );
    this.settings.weeklyEventLimit = Math.min(
      100,
      Math.max(10, Math.round((Number(this.settings.weeklyEventLimit) || 50) / 5) * 5)
    );
    this.settings.weeklyGraphEventLimit = Math.min(
      50,
      Math.max(5, Math.min(this.settings.weeklyEventLimit, Math.round(Number(this.settings.weeklyGraphEventLimit) || 20)))
    );
    this.draft = data.draft;
    if (typeof this.draft === "object" && this.draft !== null && !Array.isArray(this.draft)) {
      this.draft.entryDate = draftEntryDate(this.draft);
    }
    const migrated = this.migrateLegacyCredentials();
    await this.applyCredentialInitialization(false);
    if (migrated) {
      await this.persist();
    }
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
    for (const provider of Object.values(this.settings.providers)) {
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
      if (typeof provider !== "object" || provider === null) {
        return false;
      }
      const legacyDefaultModel = kind === "gemini" && provider.model === "gemini-2.5-flash";
      if ((provider.model !== defaults.model && !legacyDefaultModel) || provider.baseUrl !== defaults.baseUrl || provider.credentialSource !== defaults.credentialSource) {
        return false;
      }
      if (typeof provider.secretId === "string" && provider.secretId.length > 0) {
        return false;
      }
    }
    return true;
  }
  async applyCredentialInitialization(fresh) {
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
      await this.persist();
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
    await this.persist();
    return true;
  }
  async persist() {
    const data = {
      settings: this.settings,
      draft: this.draft
    };
    await this.saveData(data);
  }
};
