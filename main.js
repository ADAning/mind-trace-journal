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
  if (type === "weekly") {
    const end = addLocalDays(startOfLocalWeek(now), -1);
    const start = addLocalDays(end, -6);
    return {
      type,
      start: localDateString(start),
      end: localDateString(end)
    };
  }
  if (type === "monthly") {
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = addLocalDays(currentMonthStart, -1);
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      type,
      start: localDateString(start),
      end: localDateString(end),
      status: "complete"
    };
  }
  throw new Error(`暂不支持 ${type} 周期`);
}
function currentWeekPeriod(now = /* @__PURE__ */ new Date()) {
  const start = startOfLocalWeek(now);
  return {
    type: "weekly",
    start: localDateString(start),
    end: localDateString(now),
    status: "partial"
  };
}
function currentMonthPeriod(now = /* @__PURE__ */ new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    type: "monthly",
    start: localDateString(start),
    end: localDateString(now),
    status: "partial"
  };
}
function previousPeriod(period) {
  const start = parseLocalDate(period.start);
  if (start === null) {
    throw new Error("报告周期日期无效");
  }
  const end = addLocalDays(start, -1);
  if (period.type === "monthly") {
    return {
      type: "monthly",
      start: localDateString(new Date(end.getFullYear(), end.getMonth(), 1)),
      end: localDateString(end),
      status: "complete"
    };
  }
  return {
    type: period.type,
    start: localDateString(addLocalDays(end, -6)),
    end: localDateString(end)
  };
}
function comparisonPeriod(period) {
  if (period.type !== "monthly") {
    return previousPeriod(period);
  }
  const start = parseLocalDate(period.start);
  const end = parseLocalDate(period.end);
  if (start === null || end === null) {
    throw new Error("报告周期日期无效");
  }
  const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const previousMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0);
  const elapsedDays = Math.max(1, localDayOrdinal(end) - localDayOrdinal(start) + 1);
  const previousEnd = period.status === "partial" ? new Date(Math.min(
    previousMonthEnd.getTime(),
    addLocalDays(previousStart, elapsedDays - 1).getTime()
  )) : previousMonthEnd;
  return {
    type: "monthly",
    start: localDateString(previousStart),
    end: localDateString(previousEnd),
    status: period.status === "partial" ? "partial" : "complete"
  };
}
function periodWeekStart(dateString) {
  const date = parseLocalDate(dateString);
  return date === null ? null : localDateString(startOfLocalWeek(date));
}
function activeWeekStats(entries, period) {
  const grouped = new Map();
  for (const entry of entries) {
    const weekStart = periodWeekStart(entry.date);
    if (weekStart === null) {
      continue;
    }
    const values = grouped.get(weekStart) ?? [];
    values.push(entry);
    grouped.set(weekStart, values);
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([start, values]) => {
    const weekEnd = localDateString(addLocalDays(parseLocalDate(start), 6));
    const stats = metricSnapshot(values);
    return { start, end: weekEnd, ...stats };
  }).filter((item) => item.start <= period.end && item.end >= period.start);
}
function periodEntries(entries, period) {
  return entries.filter((entry) => entry.date >= period.start && entry.date <= period.end);
}
function formationProgress(entries, period, minimum) {
  const safeMinimum = Math.max(1, minimum);
  const days = metricSnapshot(periodEntries(entries, period)).days;
  return {
    days,
    minimum: safeMinimum,
    percent: (days / safeMinimum) * 100,
    overflow: Math.max(0, days - safeMinimum)
  };
}
function monthlyWeekSegments(entries, period, minimum) {
  const safeMinimum = Math.max(1, minimum);
  const monthStart = parseLocalDate(period.start);
  if (monthStart === null) {
    return [];
  }
  const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const monthStartOrd = localDayOrdinal(monthStart);
  const monthEndOrd = localDayOrdinal(lastDayOfMonth);
  const segments = [];
  let cursor = parseLocalDate(periodWeekStart(period.start));
  while (cursor !== null && cursor <= lastDayOfMonth) {
    const segEnd = addLocalDays(cursor, 6);
    const segStartOrd = localDayOrdinal(cursor);
    const segEndOrd = localDayOrdinal(segEnd);
    const inMonthDays = Math.min(segEndOrd, monthEndOrd) - Math.max(segStartOrd, monthStartOrd) + 1;
    const isTail = cursor < monthStart;
    const isHead = segEnd > lastDayOfMonth;
    if (isTail || !isHead || inMonthDays >= safeMinimum) {
      const segPeriod = { start: localDateString(cursor), end: localDateString(segEnd) };
      const days = metricSnapshot(periodEntries(entries, segPeriod)).days;
      segments.push({
        start: segPeriod.start,
        end: segPeriod.end,
        days,
        minimum: safeMinimum,
        percent: (days / safeMinimum) * 100,
        overflow: Math.max(0, days - safeMinimum),
        reached: days >= safeMinimum
      });
    }
    cursor = addLocalDays(segEnd, 1);
  }
  return segments;
}
function formationCaption(label, progress) {
  if (progress.days === 0) {
    return "写下今天的落点，进度就会点亮。";
  }
  if (progress.overflow > 0) {
    return `已超过${label}门槛 ${progress.overflow} 天，日记还在生长。`;
  }
  if (progress.days >= progress.minimum) {
    return `已点亮门槛，${label}可以生成了。`;
  }
  return `${label}门槛 ${progress.minimum} 个记录日，已点亮 ${progress.days} 个，还差 ${progress.minimum - progress.days} 天。`;
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
  return runs.filter((points) => points.length >= 2).map((points) => {
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
  const recordedDates = [...new Set((Array.isArray(entries) ? entries : []).map((entry) => typeof entry?.date === "string" ? entry.date : "").filter((date) => date.length > 0))].sort();
  const aiDates = [...new Set((Array.isArray(aiSeries) ? aiSeries : []).filter((item) => {
    if (item === null || typeof item !== "object" || typeof item.date !== "string") return false;
    return ["mood", "energy", "stress"].some((key) => Number.isFinite(Number(item.ai?.[key])));
  }).map((item) => item.date))].sort();
  const trendFoot = section.createDiv({ cls: "mind-trace-trend-foot", attr: { role: "status", "aria-live": "polite" } });
  if (recordedDates.length === 0 && aiDates.length === 0) {
    trendFoot.createSpan({ cls: "mind-trace-trend-foot-empty", text: `所选 ${range} 天暂无记录` });
  } else {
    const footItem = (label, value, modifier = "") => {
      const item = trendFoot.createSpan({ cls: `mind-trace-trend-foot-item${modifier.length > 0 ? ` ${modifier}` : ""}` });
      item.createSpan({ cls: "mind-trace-trend-foot-label", text: label });
      item.createEl("strong", { text: value });
    };
    footItem("记录日", `${recordedDates.length} 天`);
    footItem("AI 覆盖", `${aiDates.length} 天`, aiDates.length === 0 ? "is-empty" : "");
    if (recordedDates.length > 0) {
      const latest = recordedDates[recordedDates.length - 1];
      footItem("最近记录", latest.slice(5).replace("-", "/"));
    }
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
  const bandPaths = trendBandPaths(selfPoints, aiPoints);
  const aiCoverageDays = new Set(aiPoints.map((point) => point.date)).size;
  if (aiCoverageDays > 0) {
    legend.createSpan({ cls: "mind-trace-trend-legend-coverage", text: `${aiCoverageDays} 天` });
  } else {
    legend.createSpan({ cls: "mind-trace-trend-legend-coverage is-empty", text: "暂无" });
  }
  if (bandPaths.length > 0) {
    const bandLegend = legend.createSpan({ cls: "mind-trace-trend-legend-item mind-trace-trend-legend-band" });
    bandLegend.createSpan({ cls: "mind-trace-trend-legend-line is-band", attr: { "aria-hidden": "true" } });
    bandLegend.appendText("自评–AI 差值");
    svg.setAttribute("aria-label", `${range} 天${label}趋势，评分范围 1 到 5；阴影表示同一日期自评与 AI 的差值`);
  }
  for (const band of bandPaths) {
    svg.append(
      svgElement("path", {
        d: band,
        class: `mind-trace-band-${key}`,
        "aria-hidden": "true"
      })
    );
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
      attr: { type: "button", "aria-label": "上一个月" }
    });
    (0, import_obsidian4.setIcon)(previous, "chevron-left");
    nav.createSpan({
      cls: "mind-trace-cal-month",
      text: `${this.calendarCursor.getFullYear()}年${this.calendarCursor.getMonth() + 1}月`
    });
    const next = nav.createEl("button", {
      cls: "clickable-icon mind-trace-cal-nav-button",
      attr: { type: "button", "aria-label": "下一个月" }
    });
    (0, import_obsidian4.setIcon)(next, "chevron-right");
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
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const recordedDates = [...moodByDate.keys()].filter((date) => date.startsWith(`${monthPrefix}-`)).sort();
    const recordedMoods = recordedDates.map((date) => moodByDate.get(date)).filter((mood) => typeof mood === "number" && Number.isFinite(mood));
    const evidence = section.createDiv({ cls: "mind-trace-calendar-evidence", attr: { "aria-label": `${year}年${month + 1}月记录证据` } });
    const evidenceHeading = evidence.createDiv({ cls: "mind-trace-calendar-evidence-head" });
    evidenceHeading.createSpan({ cls: "mind-trace-calendar-evidence-title", text: "本月落点" });
    evidenceHeading.createSpan({ cls: "mind-trace-calendar-evidence-total", text: `${recordedDates.length} / ${daysInMonth} 天` });
    const evidenceStrip = evidence.createDiv({ cls: "mind-trace-calendar-evidence-strip", attr: { role: "list", "aria-label": "本月每日记录" } });
    const recordedDateSet = new Set(recordedDates);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateString = localDateString(new Date(year, month, day));
      const mood = moodByDate.get(dateString);
      const moodLabel = typeof mood === "number" && Number.isFinite(mood) ? `心情 ${mood.toFixed(1)}/5` : "无记录";
      const evidenceDay = evidenceStrip.createSpan({
        cls: `mind-trace-calendar-evidence-day${recordedDateSet.has(dateString) ? "" : " is-empty"}`,
        attr: {
          role: "listitem",
          title: `${dateString} · ${moodLabel}`,
          "aria-label": `${dateString}，${moodLabel}`
        }
      });
      if (typeof mood === "number" && Number.isFinite(mood)) {
        evidenceDay.addClass(`mind-trace-cal-day-${Math.min(5, Math.max(1, Math.round(mood)))}`);
      }
    }
    const evidenceMeta = evidence.createDiv({ cls: "mind-trace-calendar-evidence-meta" });
    const averageItem = evidenceMeta.createSpan({ cls: "mind-trace-calendar-evidence-meta-item" });
    averageItem.createSpan({ text: "平均心情" });
    averageItem.createEl("strong", { text: recordedMoods.length > 0 ? average(recordedMoods).toFixed(1) : "—" });
    const recentItem = evidenceMeta.createSpan({ cls: "mind-trace-calendar-evidence-meta-item" });
    recentItem.createSpan({ text: "最近记录" });
    recentItem.createEl("strong", { text: recordedDates.length > 0 ? recordedDates[recordedDates.length - 1].slice(5).replace("-", "/") : "—" });
    if (recordedDates.length === 0) {
      evidence.createEl("p", { cls: "mind-trace-calendar-evidence-empty", text: "这个月还没有落点。" });
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
      attr: { type: "button", "aria-label": "上一年" }
    });
    (0, import_obsidian4.setIcon)(previous, "chevron-left");
    nav.createSpan({
      cls: "mind-trace-heatmap-year",
      text: `${this.heatmapYear}年`
    });
    const next = nav.createEl("button", {
      cls: "clickable-icon mind-trace-heatmap-nav-button",
      attr: { type: "button", "aria-label": "下一年" }
    });
    (0, import_obsidian4.setIcon)(next, "chevron-right");
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
    // Keep the annual grid legible on desktop while allowing the wrap to
    // scroll horizontally on narrow panes.  The cell size is also written
    // into the grid tracks below, so cells remain square instead of
    // stretching with the available width.
    const heatCellSize = 16;
    const heatLabelWidth = 26;
    const heatGridGap = 3;
    const grid = wrap.createDiv({
      cls: "mind-trace-heatmap",
      attr: {
        style: `--mind-trace-heat-cell-size: ${heatCellSize}px; --mind-trace-heat-label-width: ${heatLabelWidth}px; grid-template-columns: ${heatLabelWidth}px repeat(${weeks}, ${heatCellSize}px); grid-template-rows: repeat(8, ${heatCellSize}px); min-width: ${heatLabelWidth + weeks * heatCellSize + weeks * heatGridGap}px;`
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
        const moodLabel = mood !== void 0 ? `心情 ${mood.toFixed(1)}/5` : "无记录";
        const cellTitle = filePath !== void 0 ? `${dateString} ${moodLabel}` : isToday ? `${dateString} · ${moodLabel} · 开始今天的心迹记录` : `${dateString} · ${moodLabel}`;
        const cellStyle = `grid-column: ${weekIndex + 2}; grid-row: ${weekday + 2};`;
        const cell = grid.createSpan({
          cls: classes.join(" "),
          attr: openable ? {
            role: "button",
            tabindex: "0",
            "aria-label": filePath !== void 0 ? `打开 ${dateString} 的日记，${moodLabel}` : `开始 ${dateString} 的心迹记录，${moodLabel}`,
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
    this.eventsContainer = section.createDiv({ cls: "mind-trace-events-list" });
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
      this.eventsContainer.classList.remove("is-sparse", "is-balanced", "is-dense");
      const eventCount = Array.isArray(insights.recentEvents) ? insights.recentEvents.length : 0;
      this.eventsContainer.classList.add(eventCount <= 5 ? "is-sparse" : eventCount <= 11 ? "is-balanced" : "is-dense");
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
          (0, import_obsidian4.setIcon)(row.createSpan({ cls: "mind-trace-event-row-icon", attr: { "aria-hidden": "true" } }), "arrow-right");
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
      if (!["confirmed", "rejected", "pending"].includes(item.status)) {
        continue;
      }
      const status = item.status;
      feedback[key] = {
        status,
        correction: typeof item.correction === "string" ? item.correction.slice(0, 800) : "",
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
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
var ObservationFeedbackModal = class extends import_obsidian7.Modal {
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
    const choiceLabels = [["confirmed", "像我 / 符合"], ["rejected", "不符合"], ["pending", "先保留"]];
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
    save.addEventListener("click", async () => {
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
    });
    window.requestAnimationFrame(() => save.focus({ preventScroll: true }));
  }
};
var JournalRegenerationPreviewModal = class extends import_obsidian7.Modal {
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
      latest.addEventListener("click", async () => {
        await this.plugin.openJournal();
        const view = this.app.workspace.getLeavesOfType(JOURNAL_VIEW_TYPE)[0]?.view;
        if (view instanceof JournalView) view.setMode("observation");
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
var MAX_EVENT_ELEMENTS = MAX_EVENT_ARGUMENTS;
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
    `记录 ${current.days} 天、${current.sessions} 篇，活跃自然周 ${current.activeWeeks} 周`,
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
      content: `报告周期：${source.period.start} 至 ${source.period.end}（${source.period.status === "partial" ? "截至今天的部分预览" : "完整自然月"}）\n\n本地确定性统计：\n${monthlyStatsText(source.stats, source.previousStats, source.period.status)}\n\n月度节律轴：\n${rhythm || "暂无活跃自然周"}\n\n事件目录：\n${reportEventCatalogText(source)}\n\n日记事实摘录：\n${source.excerpts}${source.truncated ? "\n\n注：输入过长，已截取部分较早内容。" : ""}`
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
    const parsed = {};
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
function parseReportV4Items(value, key, fields, period, validRefs, options = {}) {
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
  const byRef = new Map(catalog.map((event) => [event.ref, event]));
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
  const byRef = new Map(catalog.map((event) => [event.ref, event]));
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
      if (itemFeedback === null || typeof itemFeedback !== "object" || !["confirmed", "rejected", "pending"].includes(itemFeedback.status)) {
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
  const initialReady = eligible.length >= 1;
  const crossReady = periodCount >= 2 && independentEvidenceDates.length >= 2;
  const continuousReady = periodCount >= 4 && independentEvidenceDates.length >= 4 && spanDays >= 28;
  const stage = continuousReady ? "continuous" : crossReady ? "cross_period" : "initial";
  const maturity = {
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
  if (snapshot?.maturity && ["initial", "cross_period", "continuous"].includes(snapshot.maturity.stage)) {
    return snapshot.maturity;
  }
  return computeObservationMaturity(snapshot?.sources ?? []);
}
function observationSourceSignature(source) {
  return `${source?.type ?? ""}|${source?.periodStart ?? ""}|${source?.periodEnd ?? ""}|${source?.periodStatus === "partial" ? "partial" : "complete"}`;
}
function deriveObservationFreshness(snapshot, reports, availablePaths = null) {
  const current = dedupeObservationReports(reports);
  const savedSources = Array.isArray(snapshot?.sources) ? snapshot.sources : [];
  const currentByPath = new Map(current.map((source) => [observationDescriptorPath(source), source]));
  const savedByPath = new Map(savedSources.map((source) => [observationDescriptorPath(source), source]));
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
function buildObservationMessages(reports, feedback = {}, maturity = computeObservationMaturity(reports)) {
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
        "反馈语义：confirmed 表示用户确认符合，rejected 表示用户明确否认不符合，pending 表示用户暂保留；请尊重 rejected 与 correction，避免重复被否认的说法。",
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
          (0, import_obsidian4.setIcon)(removeTrace, "x");
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
          tracesHost.querySelector(".mind-trace-event-trace-row:last-of-type input")?.focus();
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
          (0, import_obsidian4.setIcon)(removeElement, "x");
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
          const removeRelation = row.createEl("button", { attr: { type: "button", "aria-label": `移除事件 ${eventIndex + 1} 的关系 ${relationIndex + 1}` } });
          (0, import_obsidian4.setIcon)(removeRelation, "x");
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
    const evidence = parseEventMarkdownText(/^  - 依据：(.+)$/m.exec(eventBlock.slice(start, end))?.[1] ?? "");
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
  return flattenHistoryEventRecords((document2?.sessions ?? []).map((session, sessionIndex) => ({
    filePath,
    sessionIndex,
    date: document2?.date ?? "",
    time: session?.time ?? "",
    themes: session?.themes ?? [],
    facets: session?.facets ?? [],
    events: session?.events ?? []
  })));
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
function renderEventTraces(container, traces, options = {}) {
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
function renderEventLedger(container, events, options = {}) {
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
function renderDailyEvents(container, session, options = {}) {
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
function renderSession(container, session, options = {}) {
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
    diaryWriting.addClass("has-margin");
    const margin = diaryWriting.createDiv({ cls: "mind-trace-diary-margin" });
    margin.createDiv({ cls: "mind-trace-diary-margin-title", text: "正文旁注" });
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
    if (panel instanceof HTMLElement && document2.sessions.length > 1) {
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
    window.requestAnimationFrame(() => this.applyEventFocus());
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
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center"
    });
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
      parsedJournalCache.clear();
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
function parseReportV4MarkdownItems(section) {
  const items = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("- ")) continue;
    let text = line.slice(2).trim();
    const refsMatch = /\s*<!--\s*mind-trace-event-refs:\s*([^>]+)-->\s*$/.exec(text);
    const eventRefs = refsMatch === null ? [] : refsMatch[1].split(",").map((value) => value.trim()).filter(Boolean);
    if (refsMatch !== null) text = text.slice(0, refsMatch.index).trim();
    const evidence = /\s*_（((?:\d{4}-\d{2}-\d{2})(?:、\d{4}-\d{2}-\d{2})*)）_\s*$/.exec(text);
    const evidenceDates = evidence === null ? [] : evidence[1].split("、").filter((date) => parseLocalDate(date) !== null);
    if (evidence !== null) text = text.slice(0, evidence.index).trim();
    text = stripWeeklyInlineMarkdown(text);
    if (text.length > 0) items.push({ text, evidenceDates, eventRefs });
  }
  return items;
}
function validWeeklyMetricValue(value, unit = null) {
  const normalized = stripWeeklyInlineMarkdown(value).replace(/\s+/g, " ");
  if (normalized === "—") {
    return normalized;
  }
  const unitPattern = unit === "天" || unit === "周" ? `(?:\\s*${unit})?` : "";
  const pattern = new RegExp(`^[+-]?\\d+(?:\\.\\d+)?${unitPattern}$`);
  if (!pattern.test(normalized)) {
    throw new Error(`报告数字格式无法识别：${normalized}`);
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
    const unit = key === "days" ? "天" : null;
    parsed[key] = {
      key,
      label: cells[0],
      current: validWeeklyMetricValue(cells[1], unit),
      delta: validWeeklyMetricValue(cells[2], unit)
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
  if (section.includes("本周尚没有可用的结构化事件") || section.includes("本月尚没有可用的结构化事件")) {
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
    const rawStatus = parseEventMarkdownText(/^- 状态｜(.+?)：/m.exec(block)?.[1] ?? "");
    const status = EVENT_STATUSES.includes(rawStatus) ? rawStatus : EVENT_STATUS_LABEL_VALUES[rawStatus];
    const traces = parseEventTraces(block);
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
      const event = validateEvents([{ type, status, title, summary, traces, arguments: arguments2, relations }])[0];
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
  if (![3, 4].includes(reportVersion)) {
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
  if (reportVersion === 4) {
    const eventSnapshot = parseWeeklyEventSnapshot(weeklyReportSection(content, "本周事件图谱"));
    const highlights = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "本周发生"));
    const progress = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "进展与状态"));
    const openLoops = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "尚未结束"));
    const themes = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "本周反复出现"));
    const carryForward = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "明确带到下周"));
    return {
      reportType: "weekly", reportVersion, periodStart, periodEnd,
      periodStatus: weeklyReportFrontmatterStatus(frontmatter), generatedAt, sourceDays, sourceSessions,
      eventCount: Number(frontmatter["event-count"] ?? eventSnapshot?.records.length ?? 0) || 0,
      eventCoveredSessions: Number(frontmatter["event-covered-sessions"] ?? 0) || 0,
      eventSourceSessions: Number(frontmatter["event-source-sessions"] ?? sourceSessions) || sourceSessions,
      eventSnapshot,
      summary: stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "一周概览")),
      metrics: parseWeeklyMetrics(requiredWeeklyReportSection(content, "本周数字")),
      highlights, progress, openLoops,
      themes: themes.map((item) => ({ ...item, name: item.text.split("：")[0] ?? "主题", observation: item.text.split("：").slice(1).join("：") || item.text })),
      carryForward,
      truncated: content.includes("> [!info] 本周日记较长")
    };
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
    periodStatus: weeklyReportFrontmatterStatus(frontmatter),
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
function parseMonthlyMetrics(section) {
  const parsed = {};
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) {
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 3) {
      continue;
    }
    const labels = { "记录日": "days", "活跃周": "activeWeeks", "心情": "mood", "精力": "energy", "压力": "stress" };
    const key = labels[cells[0]];
    if (key === void 0) {
      continue;
    }
    const unit = key === "days" ? "天" : key === "activeWeeks" ? "周" : null;
    parsed[key] = { key, label: cells[0], current: validWeeklyMetricValue(cells[1], unit), delta: validWeeklyMetricValue(cells[2], unit) };
  }
  for (const key of ["mood", "energy", "stress"]) {
    if (parsed[key] === void 0) {
      throw new Error(`月报缺少${key === "mood" ? "心情" : key === "energy" ? "精力" : "压力"}对照数据`);
    }
  }
  return [parsed.mood, parsed.energy, parsed.stress];
}
function parseMonthlyRhythm(section, periodStart = "") {
  const weeks = [];
  for (const line of section.split("\n")) {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 6 || !/^\d{2}-\d{2}–\d{2}-\d{2}$/.test(cells[0])) {
      continue;
    }
    const [startLabel, endLabel] = cells[0].split("–");
    const anchor = parseLocalDate(periodStart) ?? new Date();
    const toDate = (value) => {
      const [month, day] = value.split("-").map(Number);
      const candidates = [-1, 0, 1].map((offset) => new Date(anchor.getFullYear() + offset, month - 1, day));
      candidates.sort((left, right) => Math.abs(localDayOrdinal(left) - localDayOrdinal(anchor)) - Math.abs(localDayOrdinal(right) - localDayOrdinal(anchor)));
      return localDateString(candidates[0]);
    };
    weeks.push({
      startLabel,
      endLabel,
      days: Number.parseInt(cells[1], 10) || 0,
      sessions: Number.parseInt(cells[2], 10) || 0,
      mood: cells[3] === "—" ? null : Number.parseFloat(cells[3]),
      energy: cells[4] === "—" ? null : Number.parseFloat(cells[4]),
      stress: cells[5] === "—" ? null : Number.parseFloat(cells[5]),
      start: toDate(startLabel),
      end: toDate(endLabel)
    });
  }
  let rhythm = [];
  try {
    rhythm = parseWeeklyEvidenceItems(section, "月内节奏");
  } catch {
    // v4 的确定性自然周表可以独立存在；模型没有额外节奏文字时不应让整份月报失效。
    rhythm = [];
  }
  return { weeks, rhythm };
}
function parseSavedMonthlyReport(content, frontmatter) {
  if (frontmatter["mind-trace-report"] !== true || frontmatter["report-type"] !== "monthly") {
    throw new Error("这不是可识别的心迹月报");
  }
  const reportVersion = Number(frontmatter["mind-trace-report-version"]);
  if (![3, 4].includes(reportVersion)) {
    throw new Error("月报版本无法识别");
  }
  const periodStart = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
  const periodEnd = typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "";
  if (parseLocalDate(periodStart) === null || parseLocalDate(periodEnd) === null || periodStart > periodEnd) {
    throw new Error("月报周期日期无法识别");
  }
  const periodStatus = frontmatter["period-status"] === "partial" ? "partial" : "complete";
  const comparisonStart = typeof frontmatter["comparison-start"] === "string" ? frontmatter["comparison-start"] : "";
  const comparisonEnd = typeof frontmatter["comparison-end"] === "string" ? frontmatter["comparison-end"] : "";
  if (parseLocalDate(comparisonStart) === null || parseLocalDate(comparisonEnd) === null || comparisonStart > comparisonEnd) {
    throw new Error("月报对照周期日期无法识别");
  }
  const sourceDays = Number(frontmatter["source-days"]);
  const sourceSessions = Number(frontmatter["source-sessions"]);
  const activeWeeks = Number(frontmatter["source-active-weeks"]);
  if (![sourceDays, sourceSessions, activeWeeks].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("月报记录数量无法识别");
  }
  const generatedAt = typeof frontmatter["generated-at"] === "string" ? frontmatter["generated-at"] : "";
  if (generatedAt.length === 0 || Number.isNaN(new Date(generatedAt).getTime())) {
    throw new Error("月报生成时间无法识别");
  }
  if (reportVersion === 4) {
    const rhythmSection = requiredWeeklyReportSection(content, "月内节奏");
    const parsedRhythm = parseMonthlyRhythm(rhythmSection, periodStart);
    const eventSnapshot = parseWeeklyEventSnapshot(weeklyReportSection(content, "本月事件图谱"));
    const turningPoints = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "跨周转折"));
    const themeEvolution = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "主题如何演变"));
    const threads = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "持续推进与停滞"));
    const carryForward = parseReportV4MarkdownItems(requiredWeeklyReportSection(content, "带入下月的未决事项"));
    return {
      reportType: "monthly", reportVersion, periodStart, periodEnd, periodStatus, comparisonStart, comparisonEnd, generatedAt,
      sourceDays, sourceSessions, activeWeeks,
      eventCount: Number(frontmatter["event-count"] ?? eventSnapshot?.records.length ?? 0) || 0,
      eventCoveredSessions: Number(frontmatter["event-covered-sessions"] ?? 0) || 0,
      eventSourceSessions: Number(frontmatter["event-source-sessions"] ?? sourceSessions) || sourceSessions,
      eventSnapshot,
      summary: stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "本月概览")),
      metrics: parseMonthlyMetrics(requiredWeeklyReportSection(content, "本月数字")),
      weekStats: parsedRhythm.weeks, rhythm: parsedRhythm.rhythm,
      turningPoints, themeEvolution, threads, carryForward,
      truncated: content.includes("> [!info] 本月日记较长")
    };
  }
  const summary = stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "本月概览"));
  const question = stripWeeklyInlineMarkdown(requiredWeeklyReportSection(content, "留给自己的问题"));
  const rhythmSection = requiredWeeklyReportSection(content, "月内节奏");
  const parsedRhythm = parseMonthlyRhythm(rhythmSection, periodStart);
  const keepPeriodDates = (items) => items.map((item) => ({ ...item, evidenceDates: item.evidenceDates.filter((date) => date >= periodStart && date <= periodEnd) }));
  const eventSnapshot = parseWeeklyEventSnapshot(weeklyReportSection(content, "本月事件图谱"));
  const eventCount = Number(frontmatter["event-count"] ?? eventSnapshot?.records.length ?? 0);
  const eventCoveredSessions = Number(frontmatter["event-covered-sessions"] ?? 0);
  const eventSourceSessions = Number(frontmatter["event-source-sessions"] ?? sourceSessions);
  return {
    reportType: "monthly",
    reportVersion,
    periodStart,
    periodEnd,
    periodStatus,
    comparisonStart,
    comparisonEnd,
    generatedAt,
    sourceDays,
    sourceSessions,
    activeWeeks,
    eventCount: Number.isInteger(eventCount) && eventCount >= 0 ? eventCount : 0,
    eventCoveredSessions: Number.isInteger(eventCoveredSessions) && eventCoveredSessions >= 0 ? eventCoveredSessions : 0,
    eventSourceSessions: Number.isInteger(eventSourceSessions) && eventSourceSessions >= 0 ? eventSourceSessions : sourceSessions,
    eventSnapshot,
    summary,
    metrics: parseMonthlyMetrics(requiredWeeklyReportSection(content, "本月数字")),
    weekStats: parsedRhythm.weeks,
    rhythm: parsedRhythm.rhythm,
    changes: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "发生的变化"), "发生的变化")),
    possibleCauses: keepPeriodDates(parseWeeklyEvidenceItems(requiredWeeklyReportSection(content, "可能的原因"), "可能的原因")),
    emotion: parseWeeklyEmotion(requiredWeeklyReportSection(content, "AI 情绪假设")),
    themes: parseWeeklyThemes(requiredWeeklyReportSection(content, "反复出现的主题")),
    nextStep: parseWeeklyNextStep(requiredWeeklyReportSection(content, "下月最小的一步")),
    selfQuestion: question,
    truncated: content.includes("> [!info] 本月日记较长")
  };
}
function parseSavedReport(content, frontmatter) {
  return frontmatter["report-type"] === "monthly" ? parseSavedMonthlyReport(content, frontmatter) : parseSavedWeeklyReport(content, frontmatter);
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
  const zoomOut = toolbar.createEl("button", { attr: { type: "button", "aria-label": "缩小图谱", title: "缩小" } });
  (0, import_obsidian4.setIcon)(zoomOut, "minus");
  const zoomReset = toolbar.createEl("button", { text: "适合", attr: { type: "button", "aria-label": "重置图谱视图", title: "适合画布" } });
  const zoomIn = toolbar.createEl("button", { attr: { type: "button", "aria-label": "放大图谱", title: "放大" } });
  (0, import_obsidian4.setIcon)(zoomIn, "plus");
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
      inspector.createDiv({ cls: "mind-trace-memory-inspector-count", text: `进展 · ${EVENT_STATUS_LABELS[record.status] ?? "待确认"}` });
      renderEventTraces(inspector, record.traces);
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
  const scope = options.scope ?? "本周";
  const monthly = options.reportType === "monthly";
  const section = options.existingSection ?? container.createEl("section", { cls: `mind-trace-event-section mind-trace-weekly-event-center${monthly ? " mind-trace-monthly-event-center" : ""}` });
  section.empty();
  section.addClass("mind-trace-event-section", "mind-trace-weekly-event-center");
  if (monthly) {
    section.addClass("mind-trace-monthly-event-center");
  }
  options.onEventCenter?.(section);
  const heading = section.createDiv({ cls: "mind-trace-card-heading" });
  const copy = heading.createDiv();
  copy.createDiv({ cls: "mind-trace-card-title", text: `${scope}围绕什么展开` });
  copy.createEl("p", { text: "位置只由事件与论元的连接关系决定；选择节点后查看发生时间与完整上下文。" });
  const liveSource = options.eventSource ?? null;
  const candidateAggregate = liveSource?.events ?? report.eventSnapshot;
  const aggregate = candidateAggregate !== null && typeof candidateAggregate === "object" && Array.isArray(candidateAggregate.records) && Array.isArray(candidateAggregate.nodes) ? candidateAggregate : aggregateEventRecords([]);
  const coverage = liveSource === null ? { covered: Number(report.eventCoveredSessions) || 0, source: Number(report.eventSourceSessions) || Number(report.sourceSessions) || 0 } : { covered: Number(liveSource.eventCoveredSessions) || 0, source: Number(liveSource.eventSourceSessions) || Number(report.sourceSessions) || 0 };
  const graphStatus = heading.createSpan({ text: options.eventLoading ? "正在读取日记…" : `${aggregate.records.length} 件事件 · ${coverage.covered}/${coverage.source} 篇已覆盖` });
  if (typeof options.eventError === "string" && options.eventError.length > 0) {
    section.createDiv({ cls: "mind-trace-event-inline-state is-error", text: options.eventError, attr: { role: "alert" } });
  }
  const eventLimit = Number(options.eventLimit ?? options.weeklyEventLimit) || (monthly ? 100 : 50);
  const graphLimit = Number(options.graphEventLimit ?? (monthly ? options.monthlyGraphEventLimit : 20)) || (monthly ? 100 : 20);
  if (aggregate.records.length > eventLimit) {
    section.createDiv({ cls: "mind-trace-event-inline-state", text: `${scope}有 ${aggregate.records.length} 件事件，超过当前显示上限；人工确认内容仍被完整保留。`, attr: { role: "status" } });
  }
  if (liveSource !== null && report.eventSnapshot !== null && eventAggregateSignature(liveSource.events) !== eventAggregateSignature(report.eventSnapshot)) {
    const stale = section.createDiv({ cls: "mind-trace-event-snapshot-status" });
    stale.createEl("strong", { text: "当前图谱已根据日记更新" });
    stale.createSpan({ text: `Markdown 快照仍是上次生成${monthly ? "月报" : "周报"}时的版本。` });
  }
  if ((liveSource?.eventInvalidSessions?.length ?? 0) > 0) {
    const invalidState = section.createDiv({ cls: "mind-trace-event-inline-state is-error", attr: { role: "alert" } });
    invalidState.createDiv({ cls: "mind-trace-event-empty-title", text: `${liveSource.eventInvalidSessions.length} 篇记录的事件结构不匹配` });
    invalidState.createEl("p", { text: `可以逐篇打开处理，也可以确认后批量重新生成${monthly ? "；月报会按自然周分组" : ""}。原事件章节在新结果校验成功前不会改写。` });
    if (options.onOpenEvent !== void 0 || options.onRegenerateInvalidEvents !== void 0) {
      const invalidActions = invalidState.createDiv({ cls: "mind-trace-actions" });
      if (options.onRegenerateInvalidEvents !== void 0) {
        const regenerate = invalidActions.createEl("button", { cls: "mod-cta", text: `批量重新生成 ${liveSource.eventInvalidSessions.length} 篇`, attr: { type: "button" } });
        regenerate.disabled = options.backfillBusy === true;
        regenerate.addEventListener("click", options.onRegenerateInvalidEvents);
      }
      if (options.onOpenEvent !== void 0) {
        for (const item of liveSource.eventInvalidSessions.slice(0, 8)) {
          const open = invalidActions.createEl("button", { text: `打开 ${item.date} ${item.time}`, attr: { type: "button" } });
          open.addEventListener("click", () => options.onOpenEvent(item));
        }
      }
    }
  }
  const calibrationCount = liveSource?.eventCalibrationSessions?.length ?? 0;
  if (calibrationCount > 0 && options.onBackfillEvents !== void 0) {
    const missing = section.createDiv({ cls: "mind-trace-event-coverage-card" });
    const missingCopy = missing.createDiv();
    missingCopy.createEl("strong", { text: `${calibrationCount} 篇记录可以进行${monthly ? "按周" : "周级"}校准` });
    missingCopy.createEl("p", { text: "确认后将统一事件进展、体验/方向线索、论元、关系与实体名称，人工确认内容保持不变。" });
    const button = missing.createEl("button", { text: `校准${scope}事件`, attr: { type: "button" } });
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
    section.createDiv({ cls: "mind-trace-event-inline-state", text: `正在从${scope}日记整理事件与元素…`, attr: { role: "status" } });
    return;
  }
  if (aggregate.records.length === 0) {
    const empty = section.createDiv({ cls: "mind-trace-event-inline-state" });
    empty.createDiv({ cls: "mind-trace-event-empty-title", text: coverage.source > 0 && coverage.covered === coverage.source ? `${scope}没有提取到明确事件` : `${scope}事件图谱还没有足够数据` });
    empty.createEl("p", { text: "图谱不会写入系统推测；主观体验只在用户明确表达时保留。" });
    return;
  }
  let graphWrap;
  let graphDisclosure = null;
  if (monthly) {
    graphDisclosure = section.createEl("details", { cls: "mind-trace-monthly-graph-disclosure" });
    graphDisclosure.open = options.graphExpanded === true;
    const summary = graphDisclosure.createEl("summary", { text: "展开本月互动图谱" });
    summary.setAttribute("aria-label", "展开本月互动图谱");
    graphDisclosure.addEventListener("toggle", () => {
      if (graphDisclosure.open) {
        summary.textContent = "收起本月互动图谱";
      } else {
        summary.textContent = "展开本月互动图谱";
      }
      options.onGraphToggle?.(graphDisclosure.open);
    });
    graphWrap = graphDisclosure.createDiv({ cls: "mind-trace-weekly-element-graph mind-trace-monthly-element-graph" });
  } else {
    graphWrap = section.createDiv({ cls: "mind-trace-weekly-element-graph" });
  }
  const ledgerDetails = section.createEl("details", { cls: "mind-trace-event-ledger-disclosure mind-trace-weekly-event-ledger-disclosure" });
  ledgerDetails.open = options.ledgerOpen === true;
  ledgerDetails.addEventListener("toggle", () => options.onLedgerToggle?.(ledgerDetails.open));
  const ledgerSummary = ledgerDetails.createEl("summary");
  (0, import_obsidian4.setIcon)(ledgerSummary.createSpan({ cls: "mind-trace-event-ledger-disclosure-chevron", attr: { "aria-hidden": "true" } }), "chevron-right");
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
  if (monthly && graphDisclosure?.open !== true) {
    renderLedger(aggregate.records, null, null);
    graphStatus.textContent = `展开后显示图谱 · ${aggregate.records.length} 件 · ${coverage.covered}/${coverage.source} 篇已覆盖`;
    return;
  }
  const result = renderMemoryStarGraph(graphWrap, aggregate, {
    eventLimit: graphLimit,
    ariaLabel: `${scope}事件与论元记忆星图`,
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
function renderWeeklyMetricScale(card, metric) {
  const value = Number.parseFloat(metric?.current);
  const filled = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.round(value))) : 0;
  const scale = card.createDiv({
    cls: "mind-trace-weekly-metric-scale",
    attr: {
      role: "img",
      "aria-label": Number.isFinite(value) ? `${metric.label} 当前 ${value.toFixed(1)} / 5` : `${metric.label} 暂无当前分值`
    }
  });
  for (let level = 1; level <= 5; level += 1) {
    scale.createSpan({ cls: `mind-trace-weekly-metric-scale-cell${level <= filled ? " is-filled" : ""}`, attr: { "aria-hidden": "true" } });
  }
}
var V4_REPORT_ENUM_LABELS = {
  started: "开始",
  advanced: "推进",
  blocked: "受阻",
  completed: "完成",
  unchanged: "无变化",
  ongoing: "进行中",
  planned: "计划中",
  uncertain: "不确定",
  appeared: "出现",
  strengthened: "增强",
  weakened: "减弱",
  continued: "延续",
  shifted: "转向",
  ended: "结束",
  stalled: "停滞",
  repeated: "反复",
  resolved: "解决",
  goal: "目标",
  relationship: "关系",
  project: "项目",
  habit: "习惯",
  other: "其他"
};
function v4ReportEnumLabel(value) {
  return V4_REPORT_ENUM_LABELS[value] ?? value;
}
function localizeV4ReportText(value) {
  return String(value ?? "").replace(/\b(started|advanced|blocked|completed|unchanged|ongoing|planned|uncertain|appeared|strengthened|weakened|continued|shifted|ended|stalled|repeated|resolved|goal|relationship|project|habit|other)\b/g, (match) => v4ReportEnumLabel(match));
}
function v4ReportDisplayText(item) {
  if (typeof item?.subject === "string" && item.subject.length > 0) {
    return `${item.subject}${item.status ? `｜${v4ReportEnumLabel(item.status)}` : ""}：${localizeV4ReportText(item.text)}`;
  }
  if (typeof item?.name === "string" && item.name.length > 0 && typeof item?.observation === "string") {
    const qualifiers = [item.type, item.trajectory].filter((value) => typeof value === "string" && value.length > 0).map(v4ReportEnumLabel);
    return `${[item.name, ...qualifiers].join("｜")}：${item.observation}`;
  }
  return localizeV4ReportText(item?.text ?? item?.observation ?? item?.name ?? "记录");
}
function renderSavedV4Report(container, report, options = {}) {
  const monthly = report.reportType === "monthly";
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-saved-weekly-report", "mind-trace-saved-weekly-report-v4");
  if (monthly) container.addClass("mind-trace-saved-monthly-report");
  const shell = container.createDiv({ cls: `mind-trace-journal-shell mind-trace-saved-shell mind-trace-weekly-shell mind-trace-v4-report-shell${monthly ? " mind-trace-monthly-shell" : ""}`, attr: { "aria-busy": options.busy === true ? "true" : "false" } });
  const header = shell.createEl("header", { cls: "mind-trace-saved-header mind-trace-weekly-header" });
  header.createDiv({ cls: "mind-trace-eyebrow", text: `心迹${monthly ? "月报" : "周报"} · 记录版 v4` });
  header.createEl("h1", { cls: "mind-trace-journal-title", text: `${report.periodStart} — ${report.periodEnd}` });
  header.createEl("p", { text: `${report.sourceDays} 个记录日 · ${report.sourceSessions} 篇记录 · ${weeklyGeneratedAtText(report.generatedAt)}` });
  const actions = header.createDiv({ cls: "mind-trace-saved-header-actions" });
  if (options.onRegenerate !== void 0) {
    const button = actions.createEl("button", { cls: "mind-trace-report-regenerate", text: options.busy ? "正在生成…" : "重新生成", attr: { type: "button" } });
    button.disabled = options.busy === true;
    button.addEventListener("click", options.onRegenerate);
  }
  if (options.onEditSource !== void 0) actions.createEl("button", { cls: "mind-trace-edit-source", text: "编辑 Markdown", attr: { type: "button" } }).addEventListener("click", options.onEditSource);
  if (options.onDelete !== void 0) actions.createEl("button", { cls: "mind-trace-delete-file", text: "删除", attr: { type: "button" } }).addEventListener("click", options.onDelete);
  if (options.busy === true) {
    const status = shell.createDiv({ cls: "mind-trace-report-inline-status", attr: { role: "status", "aria-live": "polite" } });
    attachLlmActivityStatus(status, options.llmActivitySource, `正在重新整理这份${monthly ? "月报" : "周报"}…`);
  }
  if (options.error) shell.createDiv({ cls: "mind-trace-report-inline-error", text: options.error, attr: { role: "alert" } });
  const fold = shell.createEl("section", { cls: `mind-trace-editor-card mind-trace-weekly-fold${monthly ? " mind-trace-monthly-overview" : ""}` });
  const ledger = fold.createDiv({ cls: "mind-trace-weekly-ledger" });
  ledger.createDiv({ cls: "mind-trace-section-kicker", text: monthly ? report.periodStatus === "partial" ? "本月预览 · 截至今天" : "整月账页" : "一周账页" });
  ledger.createEl("time", { text: `${report.periodStart.slice(5).replace("-", ".")}\n—\n${report.periodEnd.slice(5).replace("-", ".")}` });
  const ledgerStats = ledger.createDiv({ cls: "mind-trace-weekly-ledger-stats" });
  const stats = [["记录日", String(report.sourceDays)], ["总篇数", String(report.sourceSessions)]];
  if (monthly) stats.push(["活跃周", String(report.activeWeeks ?? 0)]);
  for (const [label, value] of stats) {
    const item = ledgerStats.createDiv();
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
  const foldBody = fold.createDiv({ cls: "mind-trace-weekly-fold-body" });
  foldBody.createDiv({ cls: "mind-trace-diary-kicker", text: `${monthly ? "本月" : "一周"}概览 · 已归档` });
  foldBody.createDiv({ cls: "mind-trace-card-title mind-trace-diary-title", text: monthly ? "这个月的正文" : "这一周的正文" });
  foldBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-summary", text: report.summary });
  const overviewIndex = foldBody.createDiv({ cls: "mind-trace-weekly-overview-index", attr: { role: "list", "aria-label": monthly ? "本月回顾索引" : "本周回顾索引" } });
  if (monthly) {
    overviewIndex.createSpan({ text: `${report.turningPoints?.length ?? 0} 个跨周转折` });
    overviewIndex.createSpan({ text: `${report.themeEvolution?.length ?? 0} 条主题演变` });
    overviewIndex.createSpan({ text: `${report.activeWeeks ?? 0} 个活跃周` });
  } else {
    overviewIndex.createSpan({ text: `${report.highlights?.length ?? 0} 件本周发生` });
    overviewIndex.createSpan({ text: `${report.openLoops?.length ?? 0} 个未决事项` });
    overviewIndex.createSpan({ text: `${report.carryForward?.length ?? 0} 项带到下周` });
  }
  const metricsSection = shell.createEl("section", { cls: `mind-trace-rating-comparison mind-trace-weekly-metrics${monthly ? " mind-trace-monthly-metrics" : ""}` });
  const metricsHeading = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-heading" });
  const metricsCopy = metricsHeading.createDiv();
  const comparisonLabel = monthly ? report.periodStatus === "partial" ? "上月同期" : "上月" : "前一周";
  metricsCopy.createDiv({ cls: "mind-trace-section-kicker", text: `状态对照 · ${comparisonLabel}` });
  metricsCopy.createDiv({ cls: "mind-trace-rating-comparison-title", text: monthly ? "一个月，状态如何移动" : "这一周，状态如何移动", attr: { role: "heading", "aria-level": "2" } });
  metricsCopy.createEl("p", { text: `${monthly ? "本月" : "本周"}值来自日记自评平均；变化量用${comparisonLabel}作对照。` });
  const metricGrid = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-grid" });
  for (const metric of report.metrics ?? []) {
    const card = metricGrid.createEl("section", { cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${metric.key} mind-trace-weekly-metric-card` });
    const cardHeading = card.createDiv({ cls: "mind-trace-rating-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-rating-card-title", text: metric.label });
    cardHeading.createSpan({ cls: `mind-trace-rating-difference ${weeklyMetricDeltaClass(metric)}`, text: metric.delta === "—" ? "暂无对照" : `较${comparisonLabel} ${metric.delta}` });
    const value = card.createDiv({ cls: "mind-trace-weekly-metric-value" });
    value.createEl("output", { text: metric.current });
    value.createSpan({ text: metric.current === "—" ? "" : "/ 5" });
    renderWeeklyMetricScale(card, metric);
  }
  if (monthly && Array.isArray(report.weekStats)) {
    const rhythm = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-monthly-rhythm" });
    const rhythmHeading = rhythm.createDiv({ cls: "mind-trace-card-heading" });
    rhythmHeading.createDiv({ cls: "mind-trace-card-title", text: "月内节奏" });
    rhythmHeading.createSpan({ text: "自然周轴" });
    const axis = rhythm.createDiv({ cls: "mind-trace-monthly-rhythm-axis", attr: { role: "list", "aria-label": "月度节律轴" } });
    for (const week of report.weekStats) {
      const item = axis.createDiv({ cls: "mind-trace-monthly-rhythm-week", attr: { role: "listitem" } });
      item.createDiv({ cls: "mind-trace-monthly-rhythm-label", text: `${week.startLabel ?? week.start?.slice(5) ?? ""}–${week.endLabel ?? week.end?.slice(5) ?? ""}` });
      const bars = item.createDiv({ cls: "mind-trace-monthly-rhythm-bars" });
      for (const [key, label] of [["mood", "心"], ["energy", "精"], ["stress", "压"]]) {
        const score = week[key];
        const bar = bars.createDiv({ cls: `mind-trace-monthly-rhythm-bar is-${key}`, attr: { title: `${label} ${score === null ? "无数据" : Number(score).toFixed(1)}` } });
        bar.style.setProperty("--mind-trace-rhythm-value", score === null ? "0" : String(score));
      }
      item.createDiv({ cls: "mind-trace-monthly-rhythm-meta", text: `${week.days} 天 · ${week.sessions} 篇` });
    }
    if (Array.isArray(report.rhythm) && report.rhythm.length > 0) {
      const observations = rhythm.createDiv({ cls: "mind-trace-v4-rhythm-observations" });
      renderWeeklyEvidenceRows(observations, report.rhythm.map((item) => ({ ...item, text: v4ReportDisplayText(item) })), "节奏", options.onOpenEvidenceDate ?? null);
    }
  }
  const eventHost = shell.createDiv({ cls: "mind-trace-v4-event-host" });
  try {
    renderWeeklyEventCenter(eventHost, report, { ...options, reportType: monthly ? "monthly" : "weekly", scope: monthly ? "本月" : "本周", eventLimit: monthly ? options.monthlyGraphEventLimit ?? 100 : options.weeklyGraphEventLimit ?? 20 });
  } catch (error) {
    eventHost.empty();
    const fallback = eventHost.createEl("section", { cls: "mind-trace-event-section mind-trace-weekly-event-center" });
    options.onEventCenter?.(fallback);
    fallback.createDiv({ cls: "mind-trace-event-empty-title", text: `${monthly ? "本月" : "本周"}事件图谱暂时无法显示` });
    fallback.createEl("p", { text: `报告正文和统计仍可阅读。图谱错误：${errorMessage(error)}` });
  }
  const sections = monthly ? [["跨周转折", "跨自然周确认", report.turningPoints, "转折"], ["主题如何演变", "只记录跨周变化", report.themeEvolution, "主题"], ["持续推进与停滞", "事项状态轨迹", report.threads, "轨迹"], ["带入下月的未决事项", "明确延续", report.carryForward, "延续"]] : [["本周发生", "明确发生的重点", report.highlights, "发生"], ["进展与状态", "开始、推进与受阻", report.progress, "进展"], ["尚未结束", "仍在进行或待确认", report.openLoops, "未决"], ["本周反复出现", "只描述出现方式", report.themes, "主题"], ["明确带到下周", "来自已表达的意向", report.carryForward, "延续"]];
  for (let index = 0; index < sections.length; index += 2) {
    const group = sections.slice(index, index + 2);
    const analysisGrid = shell.createDiv({ cls: `mind-trace-weekly-analysis-grid mind-trace-v4-analysis-grid${group.length === 1 ? " is-single" : ""}` });
    for (const [title, label, items, mark] of group) {
      const section = analysisGrid.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-analysis-card" });
      const cardHeading = section.createDiv({ cls: "mind-trace-card-heading" });
      cardHeading.createDiv({ cls: "mind-trace-card-title", text: title });
      cardHeading.createSpan({ text: label });
      if (!Array.isArray(items) || items.length === 0) {
        section.createDiv({ cls: "mind-trace-saved-copy mind-trace-v4-report-empty", text: "暂无足够记录。" });
      } else {
        renderWeeklyEvidenceRows(section, items.map((item) => ({ ...item, text: v4ReportDisplayText(item) })), mark, options.onOpenEvidenceDate ?? null);
      }
    }
  }
  if (report.truncated) shell.createEl("p", { cls: "mind-trace-weekly-truncated", text: `${monthly ? "本月" : "本周"}日记较长，AI 整理使用了截取后的事实摘录。` });
}
function renderSavedWeeklyReport(container, report, options = {}) {
  if (report.reportVersion === 4) return renderSavedV4Report(container, report, options);
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
  if (options.onDelete !== void 0) {
    const deleteFile = actions.createEl("button", { cls: "mind-trace-delete-file", text: "删除", attr: { type: "button", "aria-label": "删除这篇心迹周报" } });
    deleteFile.disabled = options.deleteDisabled === true;
    deleteFile.addEventListener("click", options.onDelete);
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
  const weeklyIndex = foldBody.createDiv({ cls: "mind-trace-weekly-overview-index", attr: { role: "list", "aria-label": "本周回顾索引" } });
  weeklyIndex.createSpan({ text: `${Array.isArray(report.changes) ? report.changes.length : 0} 条变化` });
  weeklyIndex.createSpan({ text: `${Array.isArray(report.themes) ? report.themes.length : 0} 个主题` });
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
    renderWeeklyMetricScale(card, metric);
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
function renderSavedMonthlyReport(container, report, options = {}) {
  if (report.reportVersion === 4) return renderSavedV4Report(container, report, options);
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-saved-monthly-report", "mind-trace-saved-weekly-report");
  const shell = container.createDiv({
    cls: `mind-trace-journal-shell mind-trace-saved-shell mind-trace-weekly-shell mind-trace-monthly-shell${options.animate ? " is-entering" : ""}`,
    attr: { "aria-busy": options.busy === true ? "true" : "false" }
  });
  const header = shell.createEl("header", { cls: "mind-trace-saved-header mind-trace-weekly-header mind-trace-monthly-header" });
  header.createDiv({ cls: "mind-trace-eyebrow", text: `心迹月报 · ${report.periodStatus === "partial" ? "截至今天" : "已生成"}` });
  header.createEl("h1", { cls: "mind-trace-journal-title", text: `${report.periodStart} — ${report.periodEnd}` });
  header.createEl("p", { text: `${report.sourceDays} 个记录日 · ${report.sourceSessions} 篇记录 · ${report.activeWeeks} 个活跃自然周 · ${weeklyGeneratedAtText(report.generatedAt)}` });
  const actions = header.createDiv({ cls: "mind-trace-saved-header-actions" });
  if (options.onRegenerate !== void 0) {
    const regenerate = actions.createEl("button", { cls: "mind-trace-export-pdf mind-trace-report-regenerate", text: options.busy ? "正在生成…" : "重新生成", attr: { type: "button" } });
    regenerate.disabled = options.busy === true;
    regenerate.addEventListener("click", options.onRegenerate);
  }
  if (options.onEditSource !== void 0) {
    const edit = actions.createEl("button", { cls: "mind-trace-edit-source", text: "编辑 Markdown", attr: { type: "button" } });
    edit.disabled = options.busy === true;
    edit.addEventListener("click", options.onEditSource);
  }
  if (options.onDelete !== void 0) {
    const deleteFile = actions.createEl("button", { cls: "mind-trace-delete-file", text: "删除", attr: { type: "button", "aria-label": "删除这篇心迹月报" } });
    deleteFile.disabled = options.deleteDisabled === true;
    deleteFile.addEventListener("click", options.onDelete);
  }
  if (options.busy === true) {
    const status = shell.createDiv({ cls: "mind-trace-report-inline-status", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
    attachLlmActivityStatus(status, options.llmActivitySource, "正在根据当前日记重新整理这个月…");
  }
  if (typeof options.error === "string" && options.error.length > 0) {
    shell.createDiv({ cls: "mind-trace-report-inline-error", text: options.error, attr: { role: "alert" } });
  }
  const fold = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-fold mind-trace-monthly-overview" });
  const ledger = fold.createDiv({ cls: "mind-trace-weekly-ledger" });
  ledger.createDiv({ cls: "mind-trace-section-kicker", text: report.periodStatus === "partial" ? "本月预览 · 截至今天" : "整月账页" });
  ledger.createEl("time", { text: `${report.periodStart.slice(5).replace("-", ".")}\n—\n${report.periodEnd.slice(5).replace("-", ".")}` });
  const ledgerStats = ledger.createDiv({ cls: "mind-trace-weekly-ledger-stats" });
  for (const [label, value] of [["记录日", String(report.sourceDays)], ["总篇数", String(report.sourceSessions)], ["活跃周", String(report.activeWeeks)]]) {
    const item = ledgerStats.createDiv();
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }
  const foldBody = fold.createDiv({ cls: "mind-trace-weekly-fold-body" });
  foldBody.createDiv({ cls: "mind-trace-diary-kicker", text: "本月概览 · 已归档" });
  foldBody.createDiv({ cls: "mind-trace-card-title mind-trace-diary-title", text: "这个月的正文" });
  foldBody.createDiv({ cls: "mind-trace-saved-copy mind-trace-weekly-summary", text: report.summary });
  const monthlyIndex = foldBody.createDiv({ cls: "mind-trace-weekly-overview-index", attr: { role: "list", "aria-label": "本月回顾索引" } });
  monthlyIndex.createSpan({ text: `${Array.isArray(report.changes) ? report.changes.length : 0} 条变化` });
  monthlyIndex.createSpan({ text: `${Array.isArray(report.themes) ? report.themes.length : 0} 个主题` });
  monthlyIndex.createSpan({ text: `${Number(report.activeWeeks) || 0} 个活跃周` });
  const metricsSection = shell.createEl("section", { cls: "mind-trace-rating-comparison mind-trace-weekly-metrics mind-trace-monthly-metrics" });
  const metricsHeading = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-heading" });
  const metricsCopy = metricsHeading.createDiv();
  metricsCopy.createDiv({ cls: "mind-trace-section-kicker", text: `状态对照 · ${report.periodStatus === "partial" ? "上月同期" : "上月"}` });
  metricsCopy.createDiv({ cls: "mind-trace-rating-comparison-title", text: "一个月，状态如何移动", attr: { role: "heading", "aria-level": "2" } });
  metricsCopy.createEl("p", { text: `本月值来自日记自评平均；变化量用${report.periodStatus === "partial" ? "上月同期" : "上月"}作对照。` });
  const metricGrid = metricsSection.createDiv({ cls: "mind-trace-rating-comparison-grid" });
  for (const metric of report.metrics) {
    const card = metricGrid.createEl("section", { cls: `mind-trace-rating-comparison-card mind-trace-rating-comparison-${metric.key} mind-trace-weekly-metric-card` });
    const cardHeading = card.createDiv({ cls: "mind-trace-rating-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-rating-card-title", text: metric.label });
    cardHeading.createSpan({ cls: `mind-trace-rating-difference ${weeklyMetricDeltaClass(metric)}`, text: metric.delta === "—" ? "暂无对照" : `较${report.periodStatus === "partial" ? "上月同期" : "上月"} ${metric.delta}` });
    const value = card.createDiv({ cls: "mind-trace-weekly-metric-value" });
    value.createEl("output", { text: metric.current });
    value.createSpan({ text: metric.current === "—" ? "" : "/ 5" });
    renderWeeklyMetricScale(card, metric);
  }
  const rhythm = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-monthly-rhythm" });
  const rhythmHeading = rhythm.createDiv({ cls: "mind-trace-card-heading" });
  rhythmHeading.createDiv({ cls: "mind-trace-card-title", text: "月内节奏" });
  rhythmHeading.createSpan({ text: "自然周轴" });
  const axis = rhythm.createDiv({ cls: "mind-trace-monthly-rhythm-axis", attr: { role: "list", "aria-label": "月度节律轴" } });
  for (const week of report.weekStats ?? []) {
    const item = axis.createDiv({ cls: "mind-trace-monthly-rhythm-week", attr: { role: "listitem" } });
    item.createDiv({ cls: "mind-trace-monthly-rhythm-label", text: `${week.startLabel ?? week.start?.slice(5) ?? ""}–${week.endLabel ?? week.end?.slice(5) ?? ""}` });
    const bars = item.createDiv({ cls: "mind-trace-monthly-rhythm-bars" });
    for (const [key, label] of [["mood", "心"], ["energy", "精"], ["stress", "压"]]) {
      const value = week[key];
      const bar = bars.createDiv({ cls: `mind-trace-monthly-rhythm-bar is-${key}`, attr: { title: `${label} ${value === null ? "无数据" : value.toFixed(1)}` } });
      bar.style.setProperty("--mind-trace-rhythm-value", value === null ? "0" : String(value));
    }
    item.createDiv({ cls: "mind-trace-monthly-rhythm-meta", text: `${week.days} 天 · ${week.sessions} 篇` });
  }
  renderWeeklyEventCenter(shell, report, { ...options, reportType: "monthly", scope: "本月", eventLimit: options.monthlyGraphEventLimit ?? 100 });
  const analysisGrid = shell.createDiv({ cls: "mind-trace-weekly-analysis-grid mind-trace-monthly-analysis-grid" });
  for (const [title, label, items, mark] of [["发生的变化", "从这个月看见", report.changes, "变化"], ["可能的原因", "保留推测的边界", report.possibleCauses, "线索"]]) {
    const card = analysisGrid.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-analysis-card" });
    const cardHeading = card.createDiv({ cls: "mind-trace-card-heading" });
    cardHeading.createDiv({ cls: "mind-trace-card-title", text: title });
    cardHeading.createSpan({ text: label });
    renderWeeklyEvidenceRows(card, items, mark, options.onOpenEvidenceDate ?? null);
  }
  const emotion = shell.createEl("section", { cls: "mind-trace-editor-card mind-trace-weekly-emotion-card" });
  const emotionHeading = emotion.createDiv({ cls: "mind-trace-card-heading" });
  emotionHeading.createDiv({ cls: "mind-trace-card-title", text: "AI 对这个月的情绪假设" });
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
  for (const clue of report.emotion.clues) clueList.createEl("li", { text: clue });
  const themesSection = shell.createEl("section", { cls: "mind-trace-facets-section mind-trace-weekly-themes" });
  const themesHeading = themesSection.createDiv({ cls: "mind-trace-card-heading" });
  themesHeading.createDiv({ cls: "mind-trace-card-title", text: "反复出现的主题" });
  themesHeading.createSpan({ text: "月内切片" });
  const themesGrid = themesSection.createDiv({ cls: "mind-trace-facets-grid" });
  for (const theme of report.themes) {
    const card = themesGrid.createDiv({ cls: "mind-trace-facet-card" });
    const themeHeader = card.createDiv({ cls: "mind-trace-facet-header" });
    themeHeader.createSpan({ cls: "mind-trace-facet-kind", text: "月内主题" });
    card.createDiv({ cls: "mind-trace-facet-category", text: theme.name });
    card.createDiv({ cls: "mind-trace-facet-divider", attr: { "aria-hidden": "true" } });
    card.createDiv({ cls: "mind-trace-saved-copy mind-trace-facet-summary", text: theme.observation });
  }
  const closing = shell.createDiv({ cls: "mind-trace-reflection-grid mind-trace-weekly-closing" });
  const actionSection = closing.createEl("section", { cls: "mind-trace-editor-card mind-trace-action-card" });
  const actionHeading = actionSection.createDiv({ cls: "mind-trace-card-heading" });
  actionHeading.createDiv({ cls: "mind-trace-card-title", text: "下月最小的一步" });
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
  if (report.truncated) shell.createEl("p", { cls: "mind-trace-weekly-truncated", text: "本月日记较长，AI 分析使用了截取后的摘录。" });
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
  graphExpanded = false;
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
      const frontmatter = parseFrontmatter(this.data, "心迹报告");
      const report = parseSavedReport(this.data, frontmatter);
      this.currentReport = report;
      const periodKey = `${report.reportType ?? "weekly"}--${report.periodStart}--${report.periodEnd}`;
      if (this.eventSourceKey !== periodKey) {
        this.eventSourceKey = periodKey;
        this.eventSource = null;
        this.eventError = "";
        this.graphState = { activeEvent: null, activeEntity: null, scale: 1, x: 0, y: 0 };
        this.ledgerOpen = false;
        this.graphExpanded = false;
      }
      const renderOptions = {
        animate: !this.hasRendered,
        busy: this.busy,
        error: this.inlineError,
        ...this.eventRenderOptions(report),
        onRegenerate: () => this.beginReportRegeneration(report),
        onEditSource: () => {
          void this.openMarkdownSource();
        },
        onDelete: () => {
          confirmMindTraceFileDeletion(this, report.reportType === "monthly" ? "月报" : "周报");
        },
        deleteDisabled: this.busy || this.backfillBusy,
        onOpenEvidenceDate: (date) => {
          void this.plugin.openJournalDate(date);
        },
        onOpenEvent: (record) => {
          void this.plugin.openJournalSession(record.filePath, record.sessionIndex);
        },
        onBackfillEvents: () => {
          void this.beginEventBackfill(report);
        }
      };
      if (report.reportType === "monthly") {
        renderSavedMonthlyReport(rendered, report, renderOptions);
      } else {
        renderSavedWeeklyReport(rendered, report, renderOptions);
      }
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
    const monthly = report.reportType === "monthly";
    return {
      eventSource: this.eventSource,
      eventLoading: this.eventLoading,
      eventError: this.eventError,
      graphEventLimit: monthly ? this.plugin.settings.monthlyGraphEventLimit : this.plugin.settings.weeklyGraphEventLimit,
      weeklyEventLimit: this.plugin.settings.weeklyEventLimit,
      eventLimit: monthly ? this.plugin.settings.monthlyGraphEventLimit : this.plugin.settings.weeklyEventLimit,
      monthlyGraphEventLimit: this.plugin.settings.monthlyGraphEventLimit,
      reportType: monthly ? "monthly" : "weekly",
      scope: monthly ? "本月" : "本周",
      llmActivitySource: this.plugin,
      backfillBusy: this.backfillBusy,
      backfillMessage: this.backfillMessage,
      graphState: this.graphState,
      ledgerOpen: this.ledgerOpen,
      graphExpanded: this.graphExpanded,
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
      onGraphToggle: (open) => {
        this.graphExpanded = open;
        if (open && report.reportType === "monthly") {
          window.requestAnimationFrame(() => this.refreshEventCenter(report));
        }
      },
      onOpenEvent: (record) => {
        void this.plugin.openJournalSession(record.filePath, record.sessionIndex);
      },
      onBackfillEvents: () => {
        void this.beginEventBackfill(report);
      },
      onRegenerateInvalidEvents: () => {
        void this.beginInvalidEventRegeneration(report);
      }
    };
  }
  refreshEventCenter(report = this.currentReport) {
    if (report === null || this.eventCenterEl === null || !this.eventCenterEl.isConnected || this.eventCenterEl.parentElement === null) {
      this.render(true);
      return;
    }
    const context = captureMindTraceContext(this.contentEl);
    try {
      renderWeeklyEventCenter(this.eventCenterEl.parentElement, report, this.eventRenderOptions(report, this.eventCenterEl));
    } catch (error) {
      const host = this.eventCenterEl.parentElement;
      this.eventCenterEl = null;
      host.empty();
      const fallback = host.createEl("section", { cls: "mind-trace-event-section mind-trace-weekly-event-center" });
      this.eventCenterEl = fallback;
      fallback.createDiv({ cls: "mind-trace-event-empty-title", text: "事件图谱暂时无法显示" });
      fallback.createEl("p", { text: `报告正文和统计不受影响。图谱错误：${errorMessage(error)}` });
    }
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
      const period = { type: report.reportType === "monthly" ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
      const repository = report.reportType === "monthly" ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository;
      const source = await repository.collect(period);
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
    const candidates = this.eventSource?.eventCalibrationSessions ?? [];
    if (candidates.length === 0 || this.backfillBusy || this.eventSource === null) {
      return;
    }
    const providerLabel = PROVIDER_LABELS[this.plugin.settings.activeProvider] ?? this.plugin.settings.activeProvider;
    const monthly = report.reportType === "monthly";
    const scope = monthly ? "本月" : "本周";
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: `心迹${monthly ? "月报" : "周报"} · 图谱整理`,
      title: `校准${scope}图谱事件？`,
      description: `将把 ${candidates.length} 篇记录的日记正文、切片和已有事件发送给 ${providerLabel}，统一进展、体验/方向线索、实体与关系；不会发送原始问答。`,
      confirmLabel: "开始整理",
      stages: [`收集${scope}事件`, "校准图谱事件", "逐篇写回日记", "重新读取事件", "生成并更新图谱"],
      run: async (update) => {
        this.backfillBusy = true;
        this.backfillMessage = `正在后台用${monthly ? "自然周片段" : "整周上下文"}整理 ${candidates.length} 篇记录。`;
        this.refreshEventCenter(report);
        update({ stage: 1, total: 5, title: `收集${scope}事件`, detail: "正在读取最新日记，避免覆盖任务期间发生的修改。" });
        const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
        const repository = monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository;
        const latestSource = await repository.collect(period);
        const calibrated = monthly ? await this.plugin.calibrateMonthlyEvents(latestSource, update) : await this.plugin.calibrateWeeklyEvents(latestSource, update);
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
          const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
          this.eventSource = await (monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository).collect(period);
          this.eventError = "";
        } catch (error) {
          this.eventError = errorMessage(error);
        }
        this.refreshEventCenter(report);
      },
      successTitle: `${scope}图谱已经整理完成`,
      successDetail: `已校准 ${candidates.length} 篇记录，并根据写回后的事件重新生成图谱。`,
      successLabel: "查看图谱",
      backgroundSuccess: `${scope}图谱整理完成`
    });
  }
  async beginInvalidEventRegeneration(report) {
    const candidates = this.eventSource?.eventInvalidSessions ?? [];
    if (candidates.length === 0 || this.backfillBusy || this.eventSource === null) {
      return;
    }
    const providerLabel = PROVIDER_LABELS[this.plugin.settings.activeProvider] ?? this.plugin.settings.activeProvider;
    const monthly = report.reportType === "monthly";
    const scope = monthly ? "本月" : "本周";
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: `心迹${monthly ? "月报" : "周报"} · 事件修复`,
      title: `批量重新生成 ${candidates.length} 篇事件？`,
      description: `将把结构不匹配记录的日记正文与切片发送给 ${providerLabel}${monthly ? "，并按自然周分组抽取" : ""}；已有效的事件只用于统一命名和控制每周数量，不会被改写，也不会发送原始问答。`,
      confirmLabel: "批量重新生成",
      stages: [`收集${scope}异常记录`, monthly ? "按自然周重新抽取" : "重新抽取事件", "校验并逐篇写回", "重新汇总图谱"],
      run: async (update) => {
        this.backfillBusy = true;
        this.backfillMessage = `正在批量重新生成 ${candidates.length} 篇结构不匹配的事件。`;
        this.refreshEventCenter(report);
        update({ stage: 1, total: 4, title: `收集${scope}异常记录`, detail: "正在读取最新日记，避免覆盖任务期间发生的修改。" });
        const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
        const repository = monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository;
        const latestSource = await repository.collect(period);
        const regenerated = await this.plugin.regenerateInvalidEvents(latestSource, update);
        this.eventSource = regenerated;
        this.eventError = "";
        return regenerated;
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
          const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
          this.eventSource = await (monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository).collect(period);
          this.eventError = "";
        } catch (error) {
          this.eventError = errorMessage(error);
        }
        this.refreshEventCenter(report);
      },
      successTitle: `${scope}不匹配事件已经重新生成`,
      successDetail: `已重新生成 ${candidates.length} 篇记录，并根据写回后的事件更新图谱。`,
      successLabel: "查看图谱",
      backgroundSuccess: `${scope}事件批量重新生成完成`
    });
  }
  beginReportRegeneration(report) {
    const monthly = report.reportType === "monthly";
    const period = { type: monthly ? "monthly" : "weekly", start: report.periodStart, end: report.periodEnd, status: report.periodStatus ?? "complete" };
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: `心迹${monthly ? "月报" : "周报"} · 长任务`,
      title: `重新整理这份${monthly ? "月报" : "周报"}？`,
      description: `将重新整理${monthly ? "本月" : "本周"}图谱事件、写回未人工确认的日记事件，并替换现有${monthly ? "月报" : "周报"} Markdown。`,
      confirmLabel: "重新整理",
      warning: true,
      stages: [`读取${monthly ? "本月" : "本周"}记录`, "整理图谱事件", "模型校准事件", "逐篇写回日记", `生成${monthly ? "月报" : "周报"}内容`, `保存${monthly ? "月报" : "周报"}`, "构建图谱数据", `更新${monthly ? "月报" : "周报"}与图谱`],
      run: async (update) => {
        this.busy = true;
        this.render(true);
        const result = monthly ? await this.plugin.generateMonthlyReport(period, true, false, update) : await this.plugin.generateWeeklyReport(period, true, false, update);
        update({ stage: 8, total: 8, title: `更新${monthly ? "月报" : "周报"}与图谱`, detail: `正在载入新${monthly ? "月报" : "周报"}并恢复当前浏览位置。` });
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
          this.eventSource = await (monthly ? this.plugin.monthlyReportRepository : this.plugin.weeklyReportRepository).collect(period);
          this.eventError = "";
        } catch (error) {
          this.eventError = errorMessage(error);
        }
        this.render(true);
      },
      successTitle: `${monthly ? "月报" : "周报"}和图谱已经重新整理`,
      successDetail: `事件已按${monthly ? "自然周片段" : "整周"}上下文校准，${monthly ? "月报" : "周报"}与图谱均已更新。`,
      successLabel: `查看新${monthly ? "月报" : "周报"}`,
      backgroundSuccess: `${monthly ? "月报" : "周报"}和图谱重新整理完成`
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
    this.trajectoryQuery = createTrajectoryQuery();
    this.trajectoryVisibleCount = 40;
    this.trajectoryEntityExpanded = false;
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
    shell.appendChild(document.createComment(`
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
        window.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`[data-mind-trace-focus-key="mind-trace-mode-${mode.id}"]`);
          if (target instanceof HTMLElement) {
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
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
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
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
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
    window.setTimeout(() => {
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
    if (feedbackHost instanceof HTMLElement) {
      feedbackHost.classList.add("has-observation-feedback", `is-feedback-${feedback.status}`);
    }
    const status = container.createSpan({ cls: `mind-trace-observation-feedback-status is-${feedback.status}`, text: this.observationFeedbackLabel(feedback.status) });
    if (feedback.correction.length > 0 && feedbackHost instanceof HTMLElement) {
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
        window.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`#mind-trace-report-tab-${reportTabOptions[nextIndex][0]}`);
          if (target instanceof HTMLElement) target.focus();
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
      if (!(summary instanceof HTMLElement) || !summary.isConnected) {
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
        window.requestAnimationFrame(() => {
          const target = this.containerEl.children[1]?.querySelector(`#mind-trace-trajectory-tab-${nextView}`);
          if (target instanceof HTMLElement) target.focus();
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
    const reportFolderDescriptionUpdates = [];
    new import_obsidian5.Setting(journalSection).setName("日记目录").setDesc("心迹日记在当前 Vault 中的保存目录").addText(
      (text) => text.setPlaceholder("心迹日记").setValue(this.plugin.settings.journalFolder).onChange(async (value) => {
        this.plugin.settings.journalFolder = value.trim();
        await this.plugin.saveSettings();
        for (const updateDescription of reportFolderDescriptionUpdates) {
          updateDescription();
        }
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
      "按自然周与自然月生成结构化回顾；只有进入已解锁的心迹主页或回顾页时才会请求模型。"
    );
    new import_obsidian5.Setting(analysisSection).setName("自动补齐上周周报").setDesc(
      "每个应用会话对最近一个完整周最多自动尝试一次；生成前会联合校准未人工确认的事件并写回日记。"
    ).addToggle((toggle) => toggle.setValue(this.plugin.settings.weeklyReportAutoGenerate !== false).onChange(async (value) => {
      this.plugin.settings.weeklyReportAutoGenerate = value;
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
    }));
    const minimumDays = Math.min(7, Math.max(4, Number(this.plugin.settings.weeklyReportMinimumDays) || 4));
    this.plugin.settings.weeklyReportMinimumDays = minimumDays;
    const minimumSetting = new import_obsidian5.Setting(analysisSection).setName("周报最低记录日").setDesc(
      `当前为 ${minimumDays} 天；低于门槛时不调用模型`
    );
    minimumSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "weekly-minimum-days");
      return slider.setLimits(4, 7, 1).setValue(minimumDays).setDynamicTooltip().onChange(async (value) => {
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
    const addReportFolderSetting = (type, name, settingKey) => {
      const setting = new import_obsidian5.Setting(analysisSection).setName(name);
      let text;
      let followButton;
      const updateDescription = () => {
        const configured = normalizeReportFolderValue(this.plugin.settings[settingKey]);
        let resolved;
        try {
          resolved = type === "observation" ? observationFolder(this.plugin.settings) : resolveReportFolder(this.plugin.settings, type);
        } catch {
          resolved = "无法解析（请先设置有效的日记目录）";
        }
        setting.setDesc(
          `留空即可跟随日记目录；当前实际路径：${resolved}${configured.length === 0 ? "（跟随日记目录）" : ""}`
        );
        followButton?.setDisabled(configured.length === 0);
      };
      reportFolderDescriptionUpdates.push(updateDescription);
      setting.addText((control) => {
        text = control;
        const current = normalizeReportFolderValue(this.plugin.settings[settingKey]);
        this.plugin.settings[settingKey] = current;
        control.setPlaceholder("留空以跟随日记目录").setValue(current).onChange(async (value) => {
          const normalized = normalizeReportFolderValue(value);
          this.plugin.settings[settingKey] = normalized;
          if (control.getValue() !== normalized) {
            control.setValue(normalized);
          }
          updateDescription();
          await this.plugin.saveSettings();
          this.plugin.refreshJournalViews();
        });
        control.inputEl.addEventListener("blur", () => {
          control.setValue(normalizeReportFolderValue(this.plugin.settings[settingKey]));
        });
      });
      setting.addButton((button) => {
        followButton = button;
        return button.setButtonText("跟随日记目录").onClick(async () => {
          this.plugin.settings[settingKey] = "";
          text?.setValue("");
          updateDescription();
          await this.plugin.saveSettings();
          this.plugin.refreshJournalViews();
        });
      });
      updateDescription();
    };
    addReportFolderSetting("weekly", "周报保存位置", "weeklyReportFolder");
    new import_obsidian5.Setting(analysisSection).setName("自动补齐上月月报").setDesc(
      "每个应用会话对最近一个完整月最多自动尝试一次；只创建缺失月报，不覆盖预览、过期或手工编辑文件。"
    ).addToggle((toggle) => toggle.setValue(this.plugin.settings.monthlyReportAutoGenerate !== false).onChange(async (value) => {
      this.plugin.settings.monthlyReportAutoGenerate = value;
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
    }));
    const minimumWeeks = Math.min(5, Math.max(1, Number(this.plugin.settings.monthlyReportMinimumWeeks) || 4));
    this.plugin.settings.monthlyReportMinimumWeeks = minimumWeeks;
    const minimumMonthSetting = new import_obsidian5.Setting(analysisSection).setName("月报最低活跃周").setDesc(
      `当前为 ${minimumWeeks} 周；完整月需要不同周一至周日区间各有至少一天记录`
    );
    minimumMonthSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "monthly-minimum-weeks");
      return slider.setLimits(1, 5, 1).setValue(minimumWeeks).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.monthlyReportMinimumWeeks = value;
        minimumMonthSetting.setDesc(`当前为 ${value} 周；完整月需要不同周一至周日区间各有至少一天记录`);
        await this.plugin.saveSettings();
        this.plugin.refreshJournalViews();
      });
    });
    const monthlyGraphEventLimit = Math.min(200, Math.max(50, Math.round((Number(this.plugin.settings.monthlyGraphEventLimit) || 100) / 10) * 10));
    this.plugin.settings.monthlyGraphEventLimit = monthlyGraphEventLimit;
    const monthlyGraphSetting = new import_obsidian5.Setting(analysisSection).setName("月图谱显示事件数").setDesc(
      `当前月报星图显示 ${monthlyGraphEventLimit} 件；折叠事件账保留全部事件`
    );
    monthlyGraphSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "monthly-graph-event-limit");
      return slider.setLimits(50, 200, 10).setValue(monthlyGraphEventLimit).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.monthlyGraphEventLimit = value;
        monthlyGraphSetting.setDesc(`当前月报星图显示 ${value} 件；折叠事件账保留全部事件`);
        await this.plugin.saveSettings();
        this.plugin.refreshJournalViews();
        this.plugin.refreshWeeklyEventViews();
      });
    });
    addReportFolderSetting("monthly", "月报保存位置", "monthlyReportFolder");
    addReportFolderSetting("observation", "观照保存位置", "observationFolder");
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
      "安排心迹先问什么、最多再追问多少。核心问题和数量上限用于下一篇新日记，按需追问会在信息足够时提前结束。"
    );
    const coreQuestions = configuredCoreQuestions(this.plugin.settings);
    const adaptiveQuestionLimit = configuredAdaptiveQuestionLimit(
      this.plugin.settings
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
      const questions = configuredCoreQuestions(this.plugin.settings);
      if (questions.length >= 8) {
        return;
      }
      this.plugin.settings.coreQuestions = [
        ...questions,
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
        const questions = configuredCoreQuestions(this.plugin.settings);
        const value = input.value.trim();
        if (value.length === 0) {
          input.value = questions[index] ?? question;
          showMindTraceFieldError(input, "核心问题不能为空");
          return;
        }
        if (index >= questions.length) {
          input.value = questions[index] ?? question;
          return;
        }
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
          const questions = configuredCoreQuestions(this.plugin.settings);
          if (index <= 0 || index >= questions.length) {
            return;
          }
          const [currentQuestion] = questions.splice(index, 1);
          questions.splice(index - 1, 0, currentQuestion);
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
          const questions = configuredCoreQuestions(this.plugin.settings);
          if (index < 0 || index >= questions.length - 1) {
            return;
          }
          const [currentQuestion] = questions.splice(index, 1);
          questions.splice(index + 1, 0, currentQuestion);
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
        () => {
          const latestQuestions = configuredCoreQuestions(this.plugin.settings);
          const latestQuestion = latestQuestions[index] ?? question;
          return openMindTraceOperation(this.app, this.plugin, {
            eyebrow: "心迹设置 · 核心问题",
            title: `删除第 ${index + 1} 个核心问题？`,
            description: `“${latestQuestion}”将从下一篇新日记的问题列表中移除。`,
            confirmLabel: "删除问题",
            warning: true,
            stages: ["更新问题列表"],
            run: async (update) => {
              update({ stage: 1, total: 1, title: "更新问题列表", detail: "正在保存新的问题顺序。" });
              const questions = configuredCoreQuestions(this.plugin.settings);
              if (questions.length <= 1 || index < 0 || index >= questions.length) {
                return;
              }
              this.plugin.settings.coreQuestions = questions.filter((_, questionIndex) => questionIndex !== index);
              await this.plugin.saveSettings();
            },
            onSuccess: () => this.display(true),
            successTitle: "核心问题已删除",
            successDetail: "新的问题列表会从下一篇日记开始使用。",
            successLabel: "返回设置"
          });
        }
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
    new import_obsidian5.Setting(container).setName("模型服务").setDesc("选择当前用于追问、整理日记以及生成周报、月报的服务").addDropdown((dropdown) => {
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
      `- 概要：${eventMarkdownText(event.summary)}`,
      `- 状态｜${event.status}：${EVENT_STATUS_LABELS[event.status]}`
    ];
    for (const trace of event.traces) {
      lines.push(`- 线索｜${trace.kind}｜${trace.certainty}｜${EVENT_TRACE_KIND_LABELS[trace.kind]}：${eventMarkdownText(trace.text)}`);
      if (trace.evidence.length > 0) {
        lines.push(`  - 依据：${eventMarkdownText(trace.evidence)}`);
      }
    }
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
    schema: EVENT_SCHEMA_VERSION,
    source: ["daily", "weekly", "manual"].includes(options.source) ? options.source : "daily",
    reviewed: options.reviewed === true
  };
  return `### 今日事件\n\n<!-- mind-trace-events: ${JSON.stringify(meta)} -->\n\n${eventMarkdownBody(events)}`;
}
function renderJournalSection(date, draft, entry, options = {}) {
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
  const transcriptBlock = typeof options.transcriptMarkdown === "string" && options.transcriptMarkdown.trim().length > 0 ? options.transcriptMarkdown.replace(/\r?\n+$/, "") : ["> [!info]- 原始问答", transcript].join("\n");
  const sessionMeta = {
    schema: JOURNAL_SCHEMA_VERSION,
    generatedAt: options.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    source: options.source === "regenerated" ? "regenerated" : "conversation"
  };
  return [
    `## ${options.time ?? localTimeString(date)}`,
    `<!-- mind-trace-session: ${JSON.stringify(sessionMeta)} -->`,
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
    "### 本次轻反思",
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
    transcriptBlock
  ].join("\n");
}
function renderNewJournal(date, draft, entry) {
  const dateString = localDateString(date);
  const frontmatter = {
    "mind-trace": true,
    "mind-trace-version": JOURNAL_SCHEMA_VERSION,
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
  frontmatter["mind-trace-version"] = JOURNAL_SCHEMA_VERSION;
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
      try {
        parseEventSectionMeta(events[1]);
        parts.push(`事件与元素：${events[1].trim()}`);
      } catch {
      }
    }
    if (action?.[1] !== void 0) {
      parts.push(`微行动：${action[1].trim()}`);
    }
    return [parts.join("\n")];
  });
  return excerpts.join("\n\n");
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
  return updated;
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
  return `${content.slice(0, blockStart)}${updatedBlock}${content.slice(blockEnd)}`;
}
function regeneratedSessionValue(source, entry, assessment) {
  return {
    ...source,
    version: JOURNAL_SCHEMA_VERSION,
    source: "regenerated",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    diary: entry.diary,
    events: entry.events,
    eventState: "ready",
    eventSchema: EVENT_SCHEMA_VERSION,
    eventSource: "daily",
    eventReviewed: false,
    facets: entry.facets,
    ratings: {
      mood: { selfScore: source.ratings.mood.selfScore, aiScore: assessment.mood.score, reason: assessment.mood.reason },
      energy: { selfScore: source.ratings.energy.selfScore, aiScore: assessment.energy.score, reason: assessment.energy.reason },
      stress: { selfScore: source.ratings.stress.selfScore, aiScore: assessment.stress.score, reason: assessment.stress.reason }
    },
    insights: entry.insights,
    microAction: entry.microAction,
    selfQuestion: entry.selfQuestion,
    themes: entry.themes
  };
}
function regeneratedSessionMarkdown(documentDate, replacement) {
  const draft = {
    entryDate: documentDate,
    ratings: {
      mood: replacement.source.ratings.mood.selfScore,
      energy: replacement.source.ratings.energy.selfScore,
      stress: replacement.source.ratings.stress.selfScore
    },
    answers: replacement.source.transcriptAnswers,
    aiAssessment: replacement.assessment
  };
  return renderJournalSection(parseLocalDate(documentDate) ?? (/* @__PURE__ */ new Date()), draft, replacement.entry, {
    time: replacement.source.time,
    source: "regenerated",
    generatedAt: replacement.generatedAt,
    transcriptMarkdown: replacement.source.transcriptMarkdown
  });
}
function updateJournalHeaderText(content, themes) {
  let updated = content.replace(/^(mind-trace-version:)\s*\d+\s*$/m, `$1 ${JOURNAL_SCHEMA_VERSION}`);
  if (updated === content && /^---\s*$/m.test(updated)) {
    updated = updated.replace(/^---\s*$/m, `---\nmind-trace-version: ${JOURNAL_SCHEMA_VERSION}`);
  }
  const themeLine = `themes: [${[...new Set(themes)].map(yamlString).join(", ")}]`;
  if (/^themes:\s*.*$/m.test(updated)) updated = updated.replace(/^themes:\s*.*$/m, themeLine);
  return updated;
}
function replaceJournalSessionsContent(content, document2, replacements) {
  const headings = [...content.matchAll(/^## \d{2}:\d{2}\s*$/gm)];
  let updated = content;
  for (const replacement of [...replacements].sort((left, right) => right.sessionIndex - left.sessionIndex)) {
    const heading = headings[replacement.sessionIndex];
    if (heading === void 0) throw new Error("要更新的日记会话已经不存在");
    const start = heading.index;
    const end = headings[replacement.sessionIndex + 1]?.index ?? content.length;
    const separator = replacement.sessionIndex + 1 < headings.length ? "\n\n---\n\n" : "\n";
    updated = `${updated.slice(0, start)}${regeneratedSessionMarkdown(document2.date, replacement)}${separator}${updated.slice(end)}`;
  }
  const parsed = parseSavedJournal(updated, parseFrontmatter(updated));
  return updateJournalHeaderText(updated, parsed.sessions.flatMap((session) => session.themes));
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
  async updateJournalSessions(file, document2, replacements, expectedMtime) {
    if (!(file instanceof import_obsidian6.TFile) || file.stat.mtime !== expectedMtime) {
      throw new Error("日记在生成校样后发生了修改，请重新生成后再保存");
    }
    const content = await this.app.vault.cachedRead(file);
    if (file.stat.mtime !== expectedMtime) throw new Error("日记在读取期间发生了修改，请重新生成后再保存");
    const updated = replaceJournalSessionsContent(content, document2, replacements);
    parseSavedJournal(updated, parseFrontmatter(updated));
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
function normalizeReportFolderValue(value) {
  const normalized = typeof value === "string" ? (0, import_obsidian6.normalizePath)(value.trim()) : "";
  if (normalized.length === 0 || normalized === "/" || normalized === ".") {
    return "";
  }
  return normalized.replace(/^\/+/, "").replace(/\/+$/, "");
}
function resolveReportFolder(settings, type = "weekly") {
  const journalFolder = normalizeReportFolderValue(settings?.journalFolder);
  if (journalFolder.length === 0) {
    throw new Error("日记目录不能为空");
  }
  const reportType = type === "monthly" ? "monthly" : "weekly";
  const settingKey = reportType === "monthly" ? "monthlyReportFolder" : "weeklyReportFolder";
  const configured = normalizeReportFolderValue(settings?.[settingKey]);
  if (configured.length > 0) {
    return configured;
  }
  const label = reportType === "monthly" ? "月报" : "周报";
  return (0, import_obsidian6.normalizePath)(`${journalFolder}/报告/${label}`);
}
function weeklyReportFolder(settings) {
  return resolveReportFolder(settings, "weekly");
}
function weeklyPeriodStatus(period) {
  if (period?.status === "partial") {
    return "partial";
  }
  if (period?.status === "complete") {
    return "complete";
  }
  const start = parseLocalDate(period?.start ?? "");
  const end = parseLocalDate(period?.end ?? "");
  if (start !== null && end !== null && localDateString(addLocalDays(start, 6)) === localDateString(end)) {
    return "complete";
  }
  return "partial";
}
function weeklyReportFrontmatterStatus(frontmatter) {
  if (frontmatter?.["period-status"] === "partial" || frontmatter?.["period-status"] === "complete") {
    return frontmatter["period-status"];
  }
  const start = typeof frontmatter?.["period-start"] === "string" ? frontmatter["period-start"] : "";
  const end = typeof frontmatter?.["period-end"] === "string" ? frontmatter["period-end"] : "";
  return weeklyPeriodStatus({ start, end });
}
function weeklyReportPath(settings, period) {
  return (0, import_obsidian6.normalizePath)(`${weeklyReportFolder(settings)}/${period.start}--${period.end}.md`);
}
function monthlyReportFolder(settings) {
  return resolveReportFolder(settings, "monthly");
}
function monthlyReportPath(settings, period) {
  return (0, import_obsidian6.normalizePath)(`${monthlyReportFolder(settings)}/${period.start.slice(0, 7)}.md`);
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
function weeklyEventSnapshotLines(source, options = {}) {
  const scope = options.scope ?? "本周";
  const aggregate = source.events ?? aggregateEventRecords([]);
  if (aggregate.records.length === 0) {
    return [`_${scope}尚没有可用的结构化事件。_`];
  }
  const hubs = aggregate.nodes.slice(0, 10).map((node) => `- **${EVENT_KIND_LABELS[node.kind]}｜${eventMarkdownText(node.name)}**：${node.eventIds.size} 个事件，${node.dates.size} 天`);
  const records = [...aggregate.records].sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time) || left.eventIndex - right.eventIndex).flatMap((record) => {
    const lines = [
      `#### ${record.date} ${record.time} · ${EVENT_TYPE_LABELS[record.type] ?? EVENT_TYPE_LABELS.other}｜${eventMarkdownText(record.title)}`,
      `- 概要：${eventMarkdownText(record.summary)}`,
      `- 状态｜${record.status}：${EVENT_STATUS_LABELS[record.status]}`
    ];
    for (const trace of record.traces ?? []) {
      lines.push(`- 线索｜${trace.kind}｜${trace.certainty}｜${EVENT_TRACE_KIND_LABELS[trace.kind]}：${eventMarkdownText(trace.text)}`);
      if (trace.evidence.length > 0) {
        lines.push(`  - 依据：${eventMarkdownText(trace.evidence)}`);
      }
    }
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
  const line = (text, item) => `- ${text}${evidenceSuffix(item.evidenceDates)}${item.eventRefs?.length > 0 ? ` <!-- mind-trace-event-refs: ${item.eventRefs.join(",")} -->` : ""}`;
  const highlights = report.highlights.map((item) => line(item.text, item)).join("\n") || "_本周没有足够的重点记录。_";
  const progress = report.progress.map((item) => line(`**${inlineMarkdown(item.subject)}｜${v4ReportEnumLabel(item.status)}**：${item.text}`, item)).join("\n") || "_本周没有可确认的状态变化。_";
  const openLoops = report.openLoops.map((item) => line(`**${v4ReportEnumLabel(item.status)}**：${item.text}`, item)).join("\n") || "_本周没有明确的未决事项。_";
  const themes = report.themes.map((item) => line(`**${inlineMarkdown(item.name)}**：${item.observation}`, item)).join("\n") || "_本周没有足够的重复主题。_";
  const carryForward = report.carryForward.map((item) => line(item.text, item)).join("\n") || "_没有记录到用户明确带往下周的事项。_";
  return [
    "---",
    "mind-trace-report: true",
    "mind-trace-report-version: 4",
    "report-type: weekly",
    `period-start: ${source.period.start}`,
    `period-end: ${source.period.end}`,
    `period-status: ${weeklyPeriodStatus(source.period)}`,
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
    "## 本周事件图谱",
    "",
    ...weeklyEventSnapshotLines(source),
    "",
    "## 本周发生",
    "",
    highlights,
    "",
    "## 进展与状态",
    "",
    progress,
    "",
    "## 尚未结束",
    "",
    openLoops,
    "",
    "## 本周反复出现",
    "",
    themes,
    "",
    "## 明确带到下周",
    "",
    carryForward,
    source.truncated ? "\n> [!info] 本周日记较长，AI 分析使用了截取后的摘录。" : "",
    ""
  ].join("\n");
}
function monthlyRhythmLines(source, report) {
  const rows = source.weekStats.map((week) => [
    `| ${week.start.slice(5)}–${week.end.slice(5)} | ${week.days} | ${week.sessions} | ${scoreCell(week.mood)} | ${scoreCell(week.energy)} | ${scoreCell(week.stress)} |`
  ]).flat();
  const observations = report.rhythm.map((item) => `- ${item.observation}${evidenceSuffix(item.evidenceDates)}`).join("\n");
  return [
    "| 自然周 | 记录日 | 篇数 | 心情 | 精力 | 压力 |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    observations
  ];
}
function monthlyReportMarkdown(source, report) {
  const stats = source.stats;
  const previous = source.previousStats;
  const comparisonLabel = source.period.status === "partial" ? "较上月同期" : "较上月";
  const line = (text, item) => `- ${text}${evidenceSuffix(item.evidenceDates)}${item.eventRefs?.length > 0 ? ` <!-- mind-trace-event-refs: ${item.eventRefs.join(",")} -->` : ""}`;
  const turningPoints = report.turningPoints.map((item) => line(item.text, item)).join("\n") || "_本月没有足够证据标记跨周转折。_";
  const evolution = report.themeEvolution.map((item) => line(`**${inlineMarkdown(item.name)}｜${v4ReportEnumLabel(item.trajectory)}**：${item.observation}`, item)).join("\n") || "_本月没有足够的跨周主题演变。_";
  const threads = report.threads.map((item) => line(`**${v4ReportEnumLabel(item.type)}｜${inlineMarkdown(item.name)}｜${v4ReportEnumLabel(item.trajectory)}**：${item.observation}`, item)).join("\n") || "_本月没有可确认的持续事项变化。_";
  const carryForward = report.carryForward.map((item) => line(item.text, item)).join("\n") || "_没有记录到明确带入下月的事项。_";
  return [
    "---",
    "mind-trace-report: true",
    "mind-trace-report-version: 4",
    "report-type: monthly",
    `period-start: ${source.period.start}`,
    `period-end: ${source.period.end}`,
    `period-status: ${source.period.status === "partial" ? "partial" : "complete"}`,
    `comparison-start: ${source.comparisonPeriod.start}`,
    `comparison-end: ${source.comparisonPeriod.end}`,
    `generated-at: ${new Date().toISOString()}`,
    `source-days: ${stats.days}`,
    `source-sessions: ${stats.sessions}`,
    `source-active-weeks: ${stats.activeWeeks}`,
    `event-count: ${source.events?.records.length ?? 0}`,
    `event-covered-sessions: ${source.eventCoveredSessions ?? 0}`,
    `event-source-sessions: ${source.eventSourceSessions ?? stats.sessions}`,
    "---",
    "",
    `# ${source.period.start} 至 ${source.period.end} · 心迹月报${source.period.status === "partial" ? "（截至今天）" : ""}`,
    "",
    "## 本月概览",
    "",
    report.summary,
    "",
    "## 本月数字",
    "",
    `| 维度 | 本月 | ${comparisonLabel} |`,
    "| --- | ---: | ---: |",
    `| 记录日 | ${stats.days} 天 | ${stats.days - previous.days >= 0 ? "+" : ""}${stats.days - previous.days} 天 |`,
    `| 活跃周 | ${stats.activeWeeks} 周 | ${stats.activeWeeks - previous.activeWeeks >= 0 ? "+" : ""}${stats.activeWeeks - previous.activeWeeks} 周 |`,
    `| 心情 | ${scoreCell(stats.mood)} | ${scoreDelta(stats, previous, "mood")} |`,
    `| 精力 | ${scoreCell(stats.energy)} | ${scoreDelta(stats, previous, "energy")} |`,
    `| 压力 | ${scoreCell(stats.stress)} | ${scoreDelta(stats, previous, "stress")} |`,
    "",
    "## 月内节奏",
    "",
    ...monthlyRhythmLines(source, report),
    "",
    "## 本月事件图谱",
    "",
    ...weeklyEventSnapshotLines(source, { scope: "本月" }),
    "",
    "## 跨周转折",
    "",
    turningPoints,
    "",
    "## 主题如何演变",
    "",
    evolution,
    "",
    "## 持续推进与停滞",
    "",
    threads,
    "",
    "## 带入下月的未决事项",
    "",
    carryForward,
    source.truncated ? "\n> [!info] 本月日记较长，AI 分析使用了截取后的摘录。" : "",
    ""
  ].join("\n");
}
function reportSummaryFromMarkdown(content, heading = "一周概览") {
  return new RegExp(`^## ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n## |$)`, "m").exec(content)?.[1]?.trim() ?? (heading === "本月概览" ? "打开月报，回看这个月的变化。" : "打开周报，回看这一周的变化。");
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
    const comparison = comparisonPeriod(period);
    const previousStats = metricSnapshot(periodEntries(allEntries, comparison));
    const excerpts = [];
    const sourceFiles = [];
    const successfulDays = /* @__PURE__ */ new Set();
    const monthlyExcerptBlocks = new Map();
    let sessions = 0;
    let length = 0;
    let truncated = false;
    let acceptingExcerpts = true;
    const eventRecords = [];
    const eventMissingSessions = [];
    const eventCalibrationSessions = [];
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
              status: event.status,
              title: event.title,
              summary: event.summary,
              traces: event.traces,
              arguments: event.arguments,
              relations: event.relations,
              elements: event.elements
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
            if (session.eventReviewed) {
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
            eventInvalidSessions.push({
              filePath: file.path,
              fileMtime: file.stat.mtime,
              date: journal.date,
              time: session.time,
              sessionIndex,
              diary: session.diary,
              facets: session.facets,
              events: [],
              eventState: "invalid",
              eventSchema: session.eventSchema,
              eventReviewed: false,
              error: session.eventError ?? "格式无法识别"
            });
          }
          const rawBlock = [
            `【${journal.date} ${session.time}】`,
            `自评：心情 ${session.ratings.mood.selfScore}/5，精力 ${session.ratings.energy.selfScore}/5，压力 ${session.ratings.stress.selfScore}/5`,
            `日记：${session.diary}`,
            session.events.length > 0 ? `事件：${session.events.map((event) => `${EVENT_TYPE_LABELS[event.type]}｜${EVENT_STATUS_LABELS[event.status]}｜${event.title}（${event.arguments.map((argument) => `${argument.label}：${argument.entity.name}`).join("、")}；${event.traces.map((trace) => `${EVENT_TRACE_KIND_LABELS[trace.kind]}：${trace.text}`).join("、")}）`).join("；")}` : "",
            session.facets.length > 0 ? `记录切片：${session.facets.map((item) => `${item.category}：${item.summary}`).join("；")}` : ""
          ].filter((line) => line.length > 0).join("\n");
          const block = rawBlock.slice(0, 3e3);
          if (rawBlock.length > block.length) {
            truncated = true;
          }
          sessions += 1;
          successfulDays.add(journal.date);
          if (period.type === "monthly") {
            const week = periodWeekStart(journal.date) ?? journal.date;
            const blocks = monthlyExcerptBlocks.get(week) ?? [];
            blocks.push(block);
            monthlyExcerptBlocks.set(week, blocks);
          } else if (acceptingExcerpts && length + block.length <= 24e3) {
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
    if (period.type === "monthly") {
      const activeWeeks = [...monthlyExcerptBlocks.keys()].sort();
      const weekBudget = activeWeeks.length > 0 ? Math.floor(24e3 / activeWeeks.length) : 0;
      let monthlyLength = 0;
      for (const week of activeWeeks) {
        const blocks = monthlyExcerptBlocks.get(week) ?? [];
        const sessionBudget = blocks.length > 0 ? Math.max(1, Math.floor(weekBudget / blocks.length)) : 0;
        for (const block of blocks) {
          if (monthlyLength >= 24e3 || sessionBudget <= 0) {
            truncated = true;
            continue;
          }
          const remaining = Math.min(sessionBudget, 24e3 - monthlyLength);
          const excerpt = block.slice(0, remaining);
          excerpts.push(excerpt);
          monthlyLength += excerpt.length;
          if (excerpt.length < block.length) {
            truncated = true;
          }
        }
      }
    }
    const weekStats = activeWeekStats(entries.filter((entry) => successfulDays.has(entry.date)), period);
    stats.activeWeeks = weekStats.length;
    previousStats.activeWeeks = activeWeekStats(periodEntries(allEntries, comparison), comparison).length;
    const excerptText = excerpts.join("\n\n");
    if (period.type === "monthly" && excerptText.length > 24e3) {
      truncated = true;
    }
    return {
      period,
      comparisonPeriod: comparison,
      entries,
      sourceFiles,
      excerpts: period.type === "monthly" ? excerptText.slice(0, 24e3) : excerptText,
      stats,
      previousStats,
      weekStats,
      truncated,
      events: aggregateEventRecords(eventRecords),
      eventSourceSessions,
      eventCoveredSessions,
      eventMissingSessions,
      eventCalibrationSessions,
      eventReviewedSessions,
      eventInvalidSessions
    };
  }
  find(settings, period) {
    const targetStatus = weeklyPeriodStatus(period);
    const exact = this.app.vault.getAbstractFileByPath(weeklyReportPath(settings, period));
    if (exact instanceof import_obsidian6.TFile) {
      const frontmatter = this.app.metadataCache.getFileCache(exact)?.frontmatter;
      if (frontmatter?.["mind-trace-report"] === true && frontmatter?.["report-type"] === "weekly" && weeklyReportFrontmatterStatus(frontmatter) === targetStatus) {
        return exact;
      }
    }
    const targetWeek = periodWeekStart(period.start) ?? period.start;
    const folder = weeklyReportFolder(settings);
    const candidates = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(`${folder}/`)) {
        continue;
      }
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontmatter?.["mind-trace-report"] !== true || frontmatter?.["report-type"] !== "weekly") {
        continue;
      }
      const start = typeof frontmatter["period-start"] === "string" ? frontmatter["period-start"] : "";
      const end = typeof frontmatter["period-end"] === "string" ? frontmatter["period-end"] : "";
      if (periodWeekStart(start) !== targetWeek) {
        continue;
      }
      const status = weeklyReportFrontmatterStatus(frontmatter);
      if (status !== targetStatus) {
        continue;
      }
      candidates.push({ file, end });
    }
    candidates.sort((left, right) => right.end.localeCompare(left.end) || right.file.path.localeCompare(left.file.path));
    return candidates[0]?.file ?? null;
  }
  isStale(file, source) {
    return source.sourceFiles.some((candidate) => candidate.stat.mtime > file.stat.mtime);
  }
  async save(settings, source, report, overwrite = false) {
    const path = weeklyReportPath(settings, source.period);
    let existing = this.find(settings, source.period);
    let completingPreview = false;
    if (existing === null && weeklyPeriodStatus(source.period) === "complete") {
      const exact = this.app.vault.getAbstractFileByPath(path);
      const frontmatter = exact instanceof import_obsidian6.TFile ? this.app.metadataCache.getFileCache(exact)?.frontmatter : null;
      if (exact instanceof import_obsidian6.TFile && frontmatter?.["mind-trace-report"] === true && frontmatter?.["report-type"] === "weekly" && frontmatter?.["period-start"] === source.period.start && frontmatter?.["period-end"] === source.period.end && weeklyReportFrontmatterStatus(frontmatter) === "partial") {
        existing = exact;
        completingPreview = true;
      }
    }
    const content = weeklyReportMarkdown(source, report);
    if (existing instanceof import_obsidian6.TFile) {
      if (!overwrite && !completingPreview) {
        return existing;
      }
      if (existing.path !== path && this.app.vault.getAbstractFileByPath(path) === null && typeof this.app.vault.rename === "function") {
        try {
          await this.app.vault.rename(existing, path);
          existing = this.app.vault.getAbstractFileByPath(path) ?? existing;
        } catch {
        }
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
var MonthlyReportRepository = class extends WeeklyReportRepository {
  find(settings, period) {
    const file = this.app.vault.getAbstractFileByPath(monthlyReportPath(settings, period));
    return file instanceof import_obsidian6.TFile ? file : null;
  }
  async save(settings, source, report, overwrite = false) {
    const path = monthlyReportPath(settings, source.period);
    const existing = this.app.vault.getAbstractFileByPath(path);
    const content = monthlyReportMarkdown(source, report);
    if (existing instanceof import_obsidian6.TFile) {
      if (!overwrite) {
        return existing;
      }
      await this.app.vault.modify(existing, content);
      return existing;
    }
    await this.ensureFolder(monthlyReportFolder(settings));
    return await this.app.vault.create(path, content);
  }
};
function observationFolder(settings) {
  const configured = normalizeReportFolderValue(settings?.observationFolder);
  if (configured.length > 0) return configured;
  const journalFolder = normalizeReportFolderValue(settings?.journalFolder);
  if (journalFolder.length === 0) throw new Error("日记目录不能为空");
  return (0, import_obsidian6.normalizePath)(`${journalFolder}/观照`);
}
function observationStatusLabel(status) {
  return status === "confirmed" ? "确认" : status === "rejected" ? "否认" : "暂存";
}
function observationStatusValue(label) {
  return label === "确认" ? "confirmed" : label === "否认" ? "rejected" : "pending";
}
function observationFrontmatter(snapshot) {
  const sources = Array.isArray(snapshot.sources) ? snapshot.sources : [];
  const starts = sources.map((source) => source.periodStart).filter(Boolean).sort();
  const ends = sources.map((source) => source.periodEnd).filter(Boolean).sort();
  return [
    "---",
    "mind-trace-observation: true",
    "mind-trace-observation-version: 2",
    `observation-id: ${yamlString(snapshot.id)}`,
    `generated-at: ${snapshot.generatedAt}`,
    `period-start: ${starts[0] ?? ""}`,
    `period-end: ${ends[ends.length - 1] ?? ""}`,
    `stage: ${snapshot.maturity?.stage ?? "initial"}`,
    `source-report-count: ${sources.length}`,
    "---"
  ].join("\n");
}
function observationEvidenceMarkdown(item) {
  const time = item.time ? ` ${item.time}` : "";
  const quote = item.quote ? `；“${inlineMarkdown(item.quote)}”` : "";
  return `${item.date}${time}｜${inlineMarkdown(item.title || "未命名事件")}：${inlineMarkdown(item.summary || "无摘要")}${quote}`;
}
function observationSubsection(block, heading) {
  const marker = `#### ${heading}`;
  const start = block.indexOf(marker);
  if (start === -1) return "";
  const contentStart = start + marker.length;
  const next = block.indexOf("\n#### ", contentStart);
  return block.slice(contentStart, next === -1 ? block.length : next).trim();
}
function observationMarkdown(snapshot) {
  const analysis = snapshot.analysis;
  const evidenceById = new Map((snapshot.evidence ?? []).map((item) => [item.id, item]));
  const lines = [observationFrontmatter(snapshot), "", "# 最近的变化全景", "", "## 概览", "", analysis.summary, ""];
  for (const dimension of OBSERVATION_DIMENSIONS) {
    const claims = analysis.claims.filter((claim) => claim.dimension === dimension);
    if (claims.length === 0) continue;
    lines.push(`## ${dimension}`, "");
    for (const claim of claims) {
      const metrics = observationClaimMetrics(claim, snapshot.evidence ?? [], snapshot.sources ?? []);
      const metadata = { id: claim.key, dimension: claim.dimension, layer: claim.layer, support: claim.supportEvidenceRefs, counter: claim.counterEvidenceRefs };
      const feedback = snapshot.feedback?.[claim.key] ?? { status: "pending", correction: "" };
      lines.push(`### ${claim.statement}`, `<!-- mind-trace-observation-claim: ${JSON.stringify(metadata)} -->`, "");
      lines.push(`**此前：**${claim.before || "暂无明确对照"}`, `**现在：**${claim.now || "暂无明确对照"}`, `**线索阶段：**${metrics.signal}`, `**依据充分度：**${metrics.sufficiency}`, `**依据统计：**支持 ${metrics.support.length} · 反例 ${metrics.counter.length} · 独立周期 ${metrics.independentPeriods} · 跨度 ${metrics.spanDays} 天`, "");
      lines.push("#### 支持记录", "", ...(metrics.support.length > 0 ? metrics.support.map((item) => `- [${item.id}] ${observationEvidenceMarkdown(item)}`) : ["_暂无可用支持记录。_"]), "");
      lines.push("#### 反例", "", ...(metrics.counter.length > 0 ? metrics.counter.map((item) => `- [${item.id}] ${observationEvidenceMarkdown(item)}`) : ["_暂未找到反例，不等于不存在反例。_"]), "");
      lines.push("#### 另一种解释", "", claim.alternative || "这条事实性观察暂不需要替代解释。", "", "#### 仍缺少的信息", "", claim.missingInformation || "暂无。", "", "#### 可以问自己", "", claim.verificationQuestion || "这条记录与你的实际体验一致吗？", "", "#### 我的校准", "", `- 状态：${observationStatusLabel(feedback.status)}`, `- 修正：${String(feedback.correction ?? "").replace(/\n/g, " ")}`, "", `<!-- mind-trace-observation-claim-end: ${claim.key} -->`, "");
    }
  }
  lines.push("## 接下来值得观察", "", analysis.nextObservation, "", "## 证据索引", "");
  for (const item of snapshot.evidence ?? []) {
    lines.push(`<!-- mind-trace-observation-evidence: ${JSON.stringify(item)} -->`, `- [${item.id}] ${observationEvidenceMarkdown(item)}`);
  }
  lines.push("", "## 来源报告", "");
  for (const source of snapshot.sources ?? []) {
    lines.push(`<!-- mind-trace-observation-source: ${JSON.stringify(source)} -->`, `- [[${source.filePath}|${source.type === "monthly" ? "月报" : "周报"} ${source.periodStart} — ${source.periodEnd}]]`);
  }
  return `${lines.join("\n").trim()}\n`;
}
function parseObservationMarkdown(content, filePath = "") {
  const frontmatter = parseFrontmatter(content, "观照");
  if (frontmatter["mind-trace-observation"] !== true) throw new Error("不是心迹观照文件");
  const legacyMatch = content.match(/<!-- mind-trace-observation-legacy: (\{[^\n]+\}) -->/);
  if (legacyMatch !== null) {
    const legacy = JSON.parse(legacyMatch[1]);
    return { ...normalizeSelfObservation(legacy), id: String(frontmatter["observation-id"] ?? ""), filePath, legacy: true };
  }
  if (Number(frontmatter["mind-trace-observation-version"]) !== 2) throw new Error("不支持的观照格式版本");
  const summary = weeklyReportSection(content, "概览");
  const nextObservation = weeklyReportSection(content, "接下来值得观察");
  const evidence = [];
  const sources = [];
  for (const match of content.matchAll(/<!-- mind-trace-observation-evidence: (\{[^\n]+\}) -->/g)) {
    try { evidence.push(JSON.parse(match[1])); } catch { throw new Error("证据索引格式损坏"); }
  }
  for (const match of content.matchAll(/<!-- mind-trace-observation-source: (\{[^\n]+\}) -->/g)) {
    try { sources.push(JSON.parse(match[1])); } catch { throw new Error("来源报告索引格式损坏"); }
  }
  const claims = [];
  const feedback = {};
  const claimPattern = /### ([^\n]+)\n<!-- mind-trace-observation-claim: (\{[^\n]+\}) -->\n([\s\S]*?)<!-- mind-trace-observation-claim-end: ([^>]+) -->/g;
  for (const match of content.matchAll(claimPattern)) {
    let metadata;
    try { metadata = JSON.parse(match[2]); } catch { throw new Error(`观察“${match[1]}”的隐藏引用格式损坏`); }
    const id = String(metadata.id || match[4]).trim() || observationItemKey("claim", { dimension: metadata.dimension, observation: match[1] }, claims.length);
    const block = match[3];
    const field = (label) => block.match(new RegExp(`\\*\\*${label}：\\*\\*([^\\n]*)`))?.[1]?.trim() ?? "";
    const calibration = observationSubsection(block, "我的校准");
    const status = observationStatusValue(calibration.match(/^- 状态：([^\n]+)/m)?.[1]?.trim() ?? "暂存");
    const correction = calibration.match(/^- 修正：([^\n]*)/m)?.[1]?.trim() ?? "";
    const claim = {
      key: id,
      dimension: observationDimension(metadata.dimension),
      layer: ["fact", "inference", "hypothesis"].includes(metadata.layer) ? metadata.layer : "inference",
      statement: match[1].trim(), before: field("此前"), now: field("现在"),
      supportEvidenceRefs: Array.isArray(metadata.support) ? metadata.support : [],
      counterEvidenceRefs: Array.isArray(metadata.counter) ? metadata.counter : [],
      alternative: observationSubsection(block, "另一种解释"),
      missingInformation: observationSubsection(block, "仍缺少的信息"),
      verificationQuestion: observationSubsection(block, "可以问自己")
    };
    claims.push(claim);
    feedback[id] = { status, correction, updatedAt: "" };
  }
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const broken = claims.find((claim) => [...claim.supportEvidenceRefs, ...claim.counterEvidenceRefs].some((id) => !evidenceIds.has(id)));
  if (broken !== void 0) throw new Error(`观察“${broken.statement}”的证据引用已经断裂`);
  if (summary.length === 0 || nextObservation.length === 0 || claims.length === 0) throw new Error("观照正文缺少概览、观察条目或后续观察");
  return {
    version: 2,
    id: String(frontmatter["observation-id"] ?? ""),
    generatedAt: String(frontmatter["generated-at"] ?? ""),
    maturity: { stage: String(frontmatter.stage ?? "initial") },
    sources,
    evidence,
    analysis: { schemaVersion: 2, summary, claims, nextObservation },
    feedback,
    filePath,
    legacy: false
  };
}
function legacyObservationMarkdown(snapshot) {
  const normalized = normalizeSelfObservation(snapshot);
  const generatedAt = normalized.generatedAt || (/* @__PURE__ */ new Date()).toISOString();
  const id = `obs-legacy-${generatedAt.replace(/[^0-9]/g, "").slice(0, 17)}`;
  const starts = normalized.sources.map((source) => source.periodStart).filter(Boolean).sort();
  const ends = normalized.sources.map((source) => source.periodEnd).filter(Boolean).sort();
  const payload = JSON.stringify({ ...normalized, generatedAt }).replace(/-->/g, "--\\u003e");
  const summary = normalized.analysis?.summary ?? "由旧版 data.json 迁移的历史观照。";
  const analysis = normalized.analysis ?? {};
  const lines = ["---", "mind-trace-observation: true", "mind-trace-observation-version: 1", `observation-id: ${yamlString(id)}`, `generated-at: ${generatedAt}`, `period-start: ${starts[0] ?? ""}`, `period-end: ${ends[ends.length - 1] ?? ""}`, `stage: ${normalized.maturity?.stage ?? "initial"}`, `source-report-count: ${normalized.sources.length}`, "---", "", "# 历史观照", "", "## 概览", "", summary, "", `<!-- mind-trace-observation-legacy: ${payload} -->`, "", "> 此文件由旧版 data.json 迁移，保留旧栏目语义；下一次观照会使用新版统一观察格式。", ""];
  if (analysis.changes?.length) lines.push("## 变化描线", "", ...analysis.changes.map((item) => `- **${item.dimension}｜${item.signal ?? item.level ?? "线索"}**：${item.before} → ${item.now}`), "");
  if (analysis.perspectives?.length) lines.push("## 从不同角度看", "", ...analysis.perspectives.map((item) => `- **${item.perspective}｜${item.layer}**：${item.observation}`), "");
  if (analysis.hypotheses?.length) lines.push("## 值得验证的假设", "", ...analysis.hypotheses.flatMap((item) => [`### ${item.statement}`, "", `- 另一种解释：${item.alternative}`, `- 可以问自己：${item.question}`, ""]));
  if (analysis.roles?.length) lines.push("## 最近承担的角色", "", ...analysis.roles.map((item) => `- **${item.label}**：${item.observation}`), "");
  if (analysis.nextStep || analysis.selfQuestion) lines.push("## 旧版后续", "", analysis.nextStep ? `- 下一小步：${analysis.nextStep}` : "", analysis.selfQuestion ? `- 留给自己：${analysis.selfQuestion}` : "", "");
  return `${lines.join("\n").trim()}\n`;
}
function observationFileStem(date = /* @__PURE__ */ new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}--${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
var ObservationRepository = class extends WeeklyReportRepository {
  async list() {
    const results = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cached = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (cached !== void 0 && cached?.["mind-trace-observation"] !== true) continue;
      let content;
      try {
        content = await this.app.vault.cachedRead(file);
        const info = (0, import_obsidian6.getFrontMatterInfo)(content);
        if (!info.exists) continue;
        const parsed = (0, import_obsidian6.parseYaml)(info.frontmatter);
        if (parsed?.["mind-trace-observation"] !== true) continue;
        const snapshot = parseObservationMarkdown(content, file.path);
        results.push({ file, snapshot, error: "" });
      } catch (error) {
        if (cached?.["mind-trace-observation"] === true || content?.includes("mind-trace-observation: true")) results.push({ file, snapshot: null, error: errorMessage(error) });
      }
    }
    results.sort((left, right) => String(right.snapshot?.generatedAt ?? "").localeCompare(String(left.snapshot?.generatedAt ?? "")) || right.file.stat.mtime - left.file.stat.mtime);
    return results;
  }
  async save(settings, snapshot, content = null) {
    const folder = observationFolder(settings);
    await this.ensureFolder(folder);
    const generated = new Date(snapshot.generatedAt || Date.now());
    const stem = observationFileStem(Number.isNaN(generated.getTime()) ? /* @__PURE__ */ new Date() : generated);
    let suffix = 1;
    let path = (0, import_obsidian6.normalizePath)(`${folder}/${stem}.md`);
    while (this.app.vault.getAbstractFileByPath(path) !== null) {
      suffix += 1;
      path = (0, import_obsidian6.normalizePath)(`${folder}/${stem}-${suffix}.md`);
    }
    const file = await this.app.vault.create(path, content ?? observationMarkdown(snapshot));
    const verified = parseObservationMarkdown(await this.app.vault.cachedRead(file), file.path);
    return { file, snapshot: verified };
  }
  async updateFeedback(filePath, claimId, value, expectedMtime = null) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian6.TFile)) throw new Error("观照文件已不存在");
    if (expectedMtime !== null && file.stat.mtime !== expectedMtime) throw new Error("观照文件已在其他位置修改，请重新打开后再校准");
    const startingMtime = file.stat.mtime;
    const snapshot = parseObservationMarkdown(await this.app.vault.cachedRead(file), file.path);
    if (!snapshot.analysis?.claims?.some((claim) => claim.key === claimId)) throw new Error("找不到要校准的观察条目");
    snapshot.feedback[claimId] = { status: ["confirmed", "rejected", "pending"].includes(value?.status) ? value.status : "pending", correction: String(value?.correction ?? "").slice(0, 800), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (file.stat.mtime !== startingMtime) throw new Error("观照文件在校准期间发生了修改，请重新打开后再保存");
    await this.app.vault.modify(file, observationMarkdown(snapshot));
    return parseObservationMarkdown(await this.app.vault.cachedRead(file), file.path);
  }
};

// src/main.ts
var MindTracePlugin = class extends import_obsidian7.Plugin {
  settings = structuredClone(DEFAULT_SETTINGS);
  draft = null;
  repository;
  weeklyReportRepository;
  monthlyReportRepository;
  observationRepository;
  legacySelfObservation = emptySelfObservation();
  historyIndex;
  weeklyReportAttempts = /* @__PURE__ */ new Set();
  weeklyReportInFlight = /* @__PURE__ */ new Map();
  weeklyReportSourceCache = /* @__PURE__ */ new Map();
  monthlyReportAttempts = /* @__PURE__ */ new Set();
  monthlyReportInFlight = /* @__PURE__ */ new Map();
  monthlyReportSourceCache = /* @__PURE__ */ new Map();
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
    this.monthlyReportRepository = new MonthlyReportRepository(this.app);
    this.observationRepository = new ObservationRepository(this.app);
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
      void this.migrateLegacyObservation();
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
      sources: reports.map((item) => ({ type: item.type, periodStart: item.periodStart, periodEnd: item.periodEnd, periodStatus: item.periodStatus === "partial" ? "partial" : "complete", filePath: item.filePath, generatedAt: item.generatedAt, modifiedAt: this.app.vault.getAbstractFileByPath(item.filePath)?.stat?.mtime ?? 0 })),
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
    const minimum = Math.min(7, Math.max(4, Number(this.settings.weeklyReportMinimumDays) || 4));
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
        source = await this.calibrateWeeklyEvents(source, onProgress, { model: 3, write: 4, reload: 7, total: 8 });
      }
      onProgress?.({ stage: 5, total: 8, title: "生成周报内容", detail: "正在根据整理后的日记和图谱事件生成本周回顾。" });
      const report = await generateWeeklyReport(this.createProvider(), source, this.settings);
      onProgress?.({ stage: 6, total: 8, title: "保存周报", detail: "正在把周报写入本地 Vault。" });
      const file = await this.weeklyReportRepository.save(this.settings, source, report, overwrite);
      onProgress?.({ stage: 7, total: 8, title: "构建图谱数据", detail: "正在重新汇总事件进展、体验/方向线索、实体和明确关系。" });
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
  async monthlyReportStatus(period = completedPeriod("monthly")) {
    const key = `${period.start}--${period.end}--${period.status ?? "complete"}`;
    let source = this.monthlyReportSourceCache.get(key);
    if (source === void 0) {
      source = await this.monthlyReportRepository.collect(period);
      this.monthlyReportSourceCache.set(key, source);
    }
    const file = this.monthlyReportRepository.find(this.settings, period);
    if (file !== null) {
      const content = await this.app.vault.cachedRead(file);
      let metadata = {};
      try {
        metadata = parseFrontmatter(content);
      } catch {
      }
      const sourceChanged = Number(metadata["source-days"]) !== source.stats.days || Number(metadata["source-sessions"]) !== source.stats.sessions || Number(metadata["source-active-weeks"]) !== source.stats.activeWeeks || metadata["period-status"] !== (period.status ?? "complete") || metadata["comparison-start"] !== source.comparisonPeriod.start || metadata["comparison-end"] !== source.comparisonPeriod.end;
      return {
        kind: sourceChanged || this.monthlyReportRepository.isStale(file, source) ? "stale" : "ready",
        period,
        source,
        file,
        summary: reportSummaryFromMarkdown(content, "本月概览")
      };
    }
    const minimum = period.status === "partial" ? 1 : Math.min(5, Math.max(1, Number(this.settings.monthlyReportMinimumWeeks) || 4));
    if (period.status === "partial" ? source.stats.days < minimum : source.stats.activeWeeks < minimum) {
      return { kind: "insufficient", period, source, minimum };
    }
    if (!this.isProviderConfigured()) {
      return { kind: "unconfigured", period, source };
    }
    return { kind: "missing", period, source };
  }
  async generateMonthlyReport(period = completedPeriod("monthly"), overwrite = false, automatic = false, onProgress = null) {
    const key = `${period.start}--${period.end}--${period.status ?? "complete"}`;
    if (automatic && this.monthlyReportAttempts.has(key)) {
      return await this.monthlyReportStatus(period);
    }
    const existingFlight = this.monthlyReportInFlight.get(key);
    if (existingFlight !== void 0) {
      return await existingFlight;
    }
    if (automatic) {
      this.monthlyReportAttempts.add(key);
    }
    const task = (async () => {
      onProgress?.({ stage: 1, total: 8, title: "读取本月记录", detail: "正在收集日记、已有事件和月报状态。" });
      const status = await this.monthlyReportStatus(period);
      if ((status.kind === "ready" || status.kind === "stale") && !overwrite) {
        return status;
      }
      if (status.kind === "insufficient") {
        throw new Error(period.status === "partial" ? "本月至少需要 1 个记录日才能生成预览" : `至少需要 ${status.minimum} 个活跃自然周才能生成月报`);
      }
      if (status.kind === "unconfigured") {
        throw new Error("请先在心迹设置中配置模型与 API Key");
      }
      let source = status.source;
      const calibrationCount = source.eventCalibrationSessions.length;
      onProgress?.({ stage: 2, total: 8, title: "整理月度事件", detail: calibrationCount > 0 ? `发现 ${calibrationCount} 篇记录需要按自然周校准。` : "现有事件已经可以直接用于本月图谱。" });
      if (calibrationCount > 0) {
        source = await this.calibrateMonthlyEvents(source, onProgress, { model: 3, write: 4, reload: 7, total: 8 });
      }
      onProgress?.({ stage: 5, total: 8, title: "生成月报内容", detail: "正在根据整月日记、节奏和图谱事件生成回顾。" });
      const report = await generateMonthlyReport(this.createProvider(), source, this.settings);
      onProgress?.({ stage: 6, total: 8, title: "保存月报", detail: "正在把月报写入本地 Vault。" });
      const file = await this.monthlyReportRepository.save(this.settings, source, report, overwrite);
      onProgress?.({ stage: 7, total: 8, title: "构建月度图谱", detail: "正在重新汇总整月事件进展、体验/方向线索、实体和明确关系。" });
      this.emitMetricsChanged();
      return { kind: "ready", period, source, file, summary: report.summary };
    })();
    this.monthlyReportInFlight.set(key, task);
    try {
      return await task;
    } finally {
      this.monthlyReportInFlight.delete(key);
    }
  }
  async regenerateInvalidEvents(source, onProgress = null, progressPlan = { model: 2, write: 3, reload: 4, total: 4 }) {
    const mutable = source.eventInvalidSessions;
    if (mutable.length === 0) {
      return source;
    }
    const monthly = source.period.type === "monthly";
    const grouped = /* @__PURE__ */ new Map();
    for (const session of mutable) {
      const week = periodWeekStart(session.date) ?? session.date;
      const values = grouped.get(week) ?? [];
      values.push(session);
      grouped.set(week, values);
    }
    const readySessions = [
      ...source.eventReviewedSessions,
      ...source.eventCalibrationSessions.filter((session) => session.eventState === "ready")
    ];
    const weeklyLimit = Number(this.settings.weeklyEventLimit) || 50;
    const plans = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([week, sessions]) => {
      const preservedSessions = readySessions.filter((session) => (periodWeekStart(session.date) ?? session.date) === week);
      const preservedCount = preservedSessions.reduce((sum, session) => sum + session.events.length, 0);
      return { week, sessions, preservedSessions, preservedCount, maximum: Math.max(0, weeklyLimit - preservedCount) };
    });
    const fullWeek = plans.find((plan) => plan.maximum === 0);
    if (fullWeek !== void 0) {
      throw new Error(`${fullWeek.week} 已有 ${fullWeek.preservedCount} 件有效事件，达到每周上限；未改写结构不匹配的记录。请提高每周事件上限后重试。`);
    }
    const results = [];
    onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: monthly ? "按自然周重新抽取" : "重新抽取事件", detail: monthly ? `正在依次处理 ${plans.length} 个自然周中的 ${mutable.length} 篇记录。` : `正在从 ${mutable.length} 篇记录的正文与切片重新抽取详细事件。` });
    let segment = 0;
    for (const plan of plans) {
      segment += 1;
      const knownElements = eventEntityDisambiguationProfiles(source.events.records, monthly ? 60 : 50, plan.sessions);
      const generated = await generateEventBackfill(this.createProvider(), plan.sessions, knownElements, plan.maximum, plan.preservedSessions);
      results.push(...generated);
      onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: monthly ? "按自然周重新抽取" : "重新抽取事件", detail: monthly ? `已完成 ${segment}/${plans.length} 个自然周。` : `已完成 ${plan.sessions.length} 篇记录的模型抽取。` });
    }
    onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "校验并逐篇写回", detail: "正在校验新事件并替换对应章节；已有效事件保持不变。", current: 0, count: new Set(results.map((result) => result.source.filePath)).size });
    const outcome = await this.repository.applyEventBackfill(results, (current, count) => {
      onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "校验并逐篇写回", detail: "正在保存通过校验的新事件。", current, count });
    });
    if (outcome.failed.length > 0) {
      const succeededFiles = new Set(outcome.succeeded.map((item) => item.filePath)).size;
      const failedFiles = new Set(outcome.failed.map((item) => item.filePath)).size;
      throw new Error(`批量重新生成部分完成：已写回 ${succeededFiles} 篇文件，${failedFiles} 篇未写回。${[...new Set(outcome.failed.map((failure) => failure.message))].join("；")}`);
    }
    onProgress?.({ stage: progressPlan.reload, total: progressPlan.total, title: "重新汇总图谱", detail: "正在读取写回后的事件并更新图谱数据。" });
    return await (monthly ? this.monthlyReportRepository : this.weeklyReportRepository).collect(source.period);
  }
  async calibrateWeeklyEvents(source, onProgress = null, progressPlan = { model: 2, write: 3, reload: 4, total: 5 }) {
    const mutable = source.eventCalibrationSessions;
    if (mutable.length === 0) {
      return source;
    }
    const preserved = source.eventReviewedSessions.reduce((sum, session) => sum + session.events.length, 0);
    const maximum = Math.max(0, (Number(this.settings.weeklyEventLimit) || 50) - preserved);
    if (maximum === 0) {
      showMindTraceNotice(`本周已有 ${preserved} 件保留事件，已达到设置上限；未改写其他事件。`, 8e3);
      return source;
    }
    const knownElements = eventEntityDisambiguationProfiles(source.events.records, 60, mutable);
    const preservedSessions = source.eventReviewedSessions;
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
  async calibrateMonthlyEvents(source, onProgress = null, progressPlan = { model: 2, write: 3, reload: 4, total: 5 }) {
    const mutable = source.eventCalibrationSessions;
    if (mutable.length === 0) {
      return source;
    }
    const grouped = new Map();
    for (const session of mutable) {
      const week = periodWeekStart(session.date) ?? session.date;
      const values = grouped.get(week) ?? [];
      values.push(session);
      grouped.set(week, values);
    }
    const preserved = source.eventReviewedSessions;
    const results = [];
    const expectedMtimes = new Map(source.sourceFiles.map((file) => [file.path, file.stat.mtime]));
    onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: "按周校准月度事件", detail: `正在依次整理 ${grouped.size} 个自然周片段。` });
    let segment = 0;
    for (const [week, sessions] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      segment += 1;
      const preservedSessions = preserved.filter((item) => (periodWeekStart(item.date) ?? item.date) === week);
      const preservedCount = preservedSessions.reduce((sum, session) => sum + session.events.length, 0);
      const maximum = Math.max(0, (Number(this.settings.weeklyEventLimit) || 50) - preservedCount);
      if (maximum === 0) {
        onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: "按周校准月度事件", detail: `${week} 已有 ${preservedCount} 件人工保留事件，达到每周上限，跳过模型校准。` });
        continue;
      }
      const knownElements = eventEntityDisambiguationProfiles(source.events.records, 60, sessions);
      const generated = await generateEventBackfill(this.createProvider(), sessions, knownElements, maximum, preservedSessions);
      results.push(...generated);
      onProgress?.({ stage: progressPlan.model, total: progressPlan.total, title: "按周校准月度事件", detail: `已完成 ${segment}/${grouped.size} 个自然周片段。` });
    }
    if (results.length === 0) {
      return source;
    }
    const changed = source.sourceFiles.find((file) => {
      const current = this.app.vault.getAbstractFileByPath(file.path);
      return !(current instanceof import_obsidian7.TFile) || current.stat.mtime !== expectedMtimes.get(file.path);
    });
    if (changed !== void 0) {
      throw new Error(`月度校准期间日记发生了修改，已停止写回：${changed.path}`);
    }
    onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "写回月度事件", detail: "正在逐篇保存各自然周校准结果。", current: 0, count: new Set(results.map((result) => result.source.filePath)).size });
    const outcome = await this.repository.applyEventBackfill(results, (current, count) => {
      onProgress?.({ stage: progressPlan.write, total: progressPlan.total, title: "写回月度事件", detail: "正在逐篇保存各自然周校准结果。", current, count });
    });
    if (outcome.failed.length > 0) {
      const succeededFiles = new Set(outcome.succeeded.map((item) => item.filePath)).size;
      const failedFiles = new Set(outcome.failed.map((failure) => failure.filePath)).size;
      throw new Error(`月度校准部分完成：已写回 ${succeededFiles} 篇文件，${failedFiles} 篇未写回。${[...new Set(outcome.failed.map((failure) => failure.message))].join("；")}`);
    }
    onProgress?.({ stage: progressPlan.reload, total: progressPlan.total, title: "重新汇总月度图谱", detail: "正在读取写回后的事件并重建月度图谱数据。" });
    return await this.monthlyReportRepository.collect(source.period);
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
    for (const leaf of this.app.workspace.getLeavesOfType(OBSERVATION_VIEW_TYPE)) {
      if (leaf.view instanceof SavedObservationView) leaf.view.render();
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
    this.weeklyReportSourceCache.clear();
    this.monthlyReportSourceCache.clear();
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
    const hadLegacyQuestionLayout = Object.prototype.hasOwnProperty.call(loadedSettings, "questionLayout");
    let reportFolderSettingsChanged = false;
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
    if (hadLegacyQuestionLayout) {
      delete this.settings.questionLayout;
    }
    for (const key of ["weeklyReportFolder", "monthlyReportFolder", "observationFolder"]) {
      const normalized = normalizeReportFolderValue(this.settings[key]);
      if (this.settings[key] !== normalized) {
        reportFolderSettingsChanged = true;
      }
      this.settings[key] = normalized;
    }
    this.legacySelfObservation = normalizeSelfObservation(loadedSettings.selfObservation);
    delete this.settings.selfObservation;
    this.settings.weeklyReportAutoGenerate = this.settings.weeklyReportAutoGenerate !== false;
    this.settings.weeklyReportMinimumDays = Math.min(
      7,
      Math.max(4, Math.round(Number(this.settings.weeklyReportMinimumDays) || 4))
    );
    this.settings.weeklyEventLimit = Math.min(
      100,
      Math.max(10, Math.round((Number(this.settings.weeklyEventLimit) || 50) / 5) * 5)
    );
    this.settings.weeklyGraphEventLimit = Math.min(
      50,
      Math.max(5, Math.min(this.settings.weeklyEventLimit, Math.round(Number(this.settings.weeklyGraphEventLimit) || 20)))
    );
    this.settings.monthlyReportAutoGenerate = this.settings.monthlyReportAutoGenerate !== false;
    this.settings.monthlyReportMinimumWeeks = Math.min(
      5,
      Math.max(1, Math.round(Number(this.settings.monthlyReportMinimumWeeks) || 4))
    );
    this.settings.monthlyGraphEventLimit = Math.min(
      200,
      Math.max(50, Math.round((Number(this.settings.monthlyGraphEventLimit) || 100) / 10) * 10)
    );
    this.draft = data.draft;
    if (typeof this.draft === "object" && this.draft !== null && !Array.isArray(this.draft)) {
      this.draft.entryDate = draftEntryDate(this.draft);
    }
    const migrated = this.migrateLegacyCredentials();
    const credentialInitialized = await this.applyCredentialInitialization(false, false);
    if (migrated || hadLegacyQuestionLayout || reportFolderSettingsChanged || credentialInitialized) {
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
  async persist() {
    const settings = { ...this.settings };
    delete settings.selfObservation;
    if (this.legacySelfObservation?.analysis !== null) settings.selfObservation = this.legacySelfObservation;
    const data = {
      settings,
      draft: this.draft
    };
    await this.saveData(data);
  }
};
