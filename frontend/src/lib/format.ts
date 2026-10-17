const weekdayDate = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const shortDate = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function formatLongDate(date: Date = new Date()): string {
  return weekdayDate.format(date);
}

export function formatShortDate(value: string): string {
  return shortDate.format(new Date(value));
}

export function formatTime(value: string): string {
  return timeFormat.format(new Date(value));
}

export function formatDateTime(value: string, timeZone?: string | null, allDay = false): string {
  const date = new Date(value);
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  if (allDay) {
    if (timeZone) dateOptions.timeZone = timeZone;
    return new Intl.DateTimeFormat(undefined, dateOptions).format(date);
  }
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  if (timeZone) {
    dateOptions.timeZone = timeZone;
    timeOptions.timeZone = timeZone;
  }
  return `${new Intl.DateTimeFormat(undefined, dateOptions).format(date)} · ${new Intl.DateTimeFormat(undefined, timeOptions).format(date)}`;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getInitials(name: string | undefined | null): string {
  if (!name?.trim()) return "K";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function toDatetimeLocalValue(iso: string | null, timeZone?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toDateLocalValue(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function fromDatetimeLocalValue(value: string, timeZone?: string | null): string | null {
  if (!value) return null;
  if (timeZone) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match;
    const targetUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    let instant = targetUtc;
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
      const representedUtc = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute),
      );
      instant = targetUtc - (representedUtc - instant);
    }
    const converted = new Date(instant);
    const check = Object.fromEntries(formatter.formatToParts(converted).map((part) => [part.type, part.value]));
    if (
      check.year !== year || check.month !== month || check.day !== day ||
      check.hour !== hour || check.minute !== minute
    ) return null;
    return Number.isNaN(converted.getTime()) ? null : converted.toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
