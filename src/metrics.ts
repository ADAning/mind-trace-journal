// src/metrics.ts
import { addLocalDays, localDateString, localDayOrdinal, parseLocalDate, startOfLocalDay } from "./date-utils";

export { average, calculateStreaks, clearMetricsIndex, collectMetrics, filterMetrics, metricsFileTracked, metricsFromFrontmatter, removeMetricsFile, renameMetricsFile, themeFrequency, updateMetricsFile };
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
const metricsIndexes = /* @__PURE__ */ new WeakMap();
function buildMetricsIndex(app) {
  const index = /* @__PURE__ */ new Map();
  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter?.["mind-trace"] !== true) continue;
    const entry = metricsFromFrontmatter(frontmatter, file.path);
    index.set(file.path, { entry, ignored: entry === null });
  }
  metricsIndexes.set(app, index);
  return index;
}
function metricsFileTracked(app, filePath) {
  return metricsIndexes.get(app)?.has(filePath) === true;
}
function updateMetricsFile(app, file) {
  const index = metricsIndexes.get(app);
  if (index === void 0) return;
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  if (frontmatter?.["mind-trace"] !== true) {
    index.delete(file.path);
    return;
  }
  const entry = metricsFromFrontmatter(frontmatter, file.path);
  index.set(file.path, { entry, ignored: entry === null });
}
function removeMetricsFile(app, filePath) {
  metricsIndexes.get(app)?.delete(filePath);
}
function renameMetricsFile(app, oldPath, file) {
  const index = metricsIndexes.get(app);
  if (index === void 0) return;
  index.delete(oldPath);
  updateMetricsFile(app, file);
}
function clearMetricsIndex(app) {
  metricsIndexes.delete(app);
}
function collectMetrics(app) {
  const index = metricsIndexes.get(app) ?? buildMetricsIndex(app);
  const entries = [];
  let ignoredFiles = 0;
  for (const item of index.values()) {
    if (item.ignored || item.entry === null) ignoredFiles += 1;
    else entries.push(item.entry);
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
