// src/date-utils.ts
import { metricSnapshot } from "./conversation";

export { activeWeekStats, addLocalDays, comparisonPeriod, completedPeriod, currentMonthPeriod, currentWeekPeriod, draftEntryDate, entryDateWithCurrentTime, formationCaption, formationProgress, localDateString, localDayOrdinal, localTimeString, monthlyWeekSegments, parseLocalDate, periodEntries, periodLabel, periodWeekStart, startOfLocalDay, startOfLocalWeek };
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
