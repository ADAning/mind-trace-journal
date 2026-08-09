// src/dashboard.ts
import * as import_obsidian4 from "obsidian";
import { metricSnapshot } from "./conversation";
import { addLocalDays, localDateString, localDayOrdinal, startOfLocalDay } from "./date-utils";
import { average, calculateStreaks, themeFrequency } from "./metrics";
import { mindTraceDocument } from "./runtime-preamble";

export { DashboardComponent, svgElement };

var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
function svgElement(context, tag, attributes) {
  const element = mindTraceDocument(context).createElementNS(SVG_NAMESPACE, tag);
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
  const selfByDate = new Map<string, any>(selfPoints.map((point) => [point.date, point]));
  const aiByDate = new Map<string, any>(aiPoints.map((point) => [point.date, point]));
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
  const svg = svgElement(container, "svg", {
    viewBox: `0 0 ${svgWidth} ${svgHeight}`,
    role: "img",
    "aria-label": `${range} 天${label}趋势，评分范围 1 到 5`
  });
  svg.classList.add("mind-trace-line-chart");
  for (let score = 1; score <= 5; score += 1) {
    const y = top + (5 - score) / 4 * plotHeight;
    svg.append(
      svgElement(container, "line", {
        x1: String(left),
        x2: String(left + plotWidth),
        y1: String(y),
        y2: String(y),
        class: "mind-trace-grid-line"
      })
    );
    const label = svgElement(container, "text", {
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
    const tick = svgElement(container, "text", {
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
      svgElement(container, "path", {
        d: band,
        class: `mind-trace-band-${key}`,
        "aria-hidden": "true"
      })
    );
  }
  for (const segment of lineSegments(entries, key, range, plotWidth, plotHeight, left, top)) {
    svg.append(
      svgElement(container, "path", {
        d: segment,
        class: `mind-trace-series mind-trace-series-${key}`,
        fill: "none"
      })
    );
  }
  for (const segment of lineSegments(aiEntries, key, range, plotWidth, plotHeight, left, top)) {
    svg.append(
      svgElement(container, "path", {
        d: segment,
        class: `mind-trace-series mind-trace-series-${key} mind-trace-series-ai`,
        fill: "none"
      })
    );
  }
  for (const point of selfPoints) {
    const svgPoint = svgElement(container, "circle", {
      cx: point.x.toFixed(1),
      cy: point.y.toFixed(1),
      r: "3",
      class: `mind-trace-point mind-trace-series-${key}`,
      role: "img",
      "aria-label": `${point.date} ${label} 自评 ${point.value.toFixed(1)}`
    });
    const title = svgElement(container, "title", {});
    title.textContent = `${point.date} ${label} 自评 ${point.value.toFixed(1)}`;
    svgPoint.append(title);
    svg.append(svgPoint);
  }
  for (const point of aiPoints) {
    const svgPoint = svgElement(container, "circle", {
      cx: point.x.toFixed(1),
      cy: point.y.toFixed(1),
      r: "2.5",
      class: `mind-trace-point mind-trace-point-ai mind-trace-series-${key}`,
      role: "img",
      "aria-label": `${point.date} ${label} AI ${point.value.toFixed(1)}`
    });
    const title = svgElement(container, "title", {});
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
  declare app: any;
  declare container: HTMLElement;
  declare range: any;
  declare onRangeChange: any;
  declare onOpenEntry: any;
  declare onSelectTheme: any;
  declare onOpenEvent: any;
  declare calendarCursor: Date;
  declare calendarSection: HTMLElement | null;
  declare calendarEntries: any[];
  declare heatmapYear: number;
  declare heatmapSection: HTMLElement | null;
  declare heatmapEntries: any[];
  declare facetsContainer: HTMLElement | null;
  declare eventsContainer: HTMLElement | null;
  declare trendContainer: HTMLElement | null;
  declare trendEntries: any[];
  declare trendRange: any;
  declare trendPreviousEntries: any[];
  declare trendAiSeries: any;
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
        text: String(weekday),
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
