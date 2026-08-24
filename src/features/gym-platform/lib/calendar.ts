const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInMexico(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = new Map(parts.map((part) => [part.type, part.value]));
  return `${value.get("year")}-${value.get("month")}-${value.get("day")}`;
}

export function timeInMexico(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = new Map(parts.map((part) => [part.type, part.value]));
  return `${value.get("hour")}:${value.get("minute")}`;
}

export function addDaysToISO(date: string, days: number): string {
  if (!ISO_DATE.test(date) || !Number.isInteger(days)) throw new Error("Fecha no válida");
  const value = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(value.getTime())) throw new Error("Fecha no válida");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekdayFromISO(date: string): number {
  if (!ISO_DATE.test(date)) throw new Error("Fecha no válida");
  const value = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(value.getTime())) throw new Error("Fecha no válida");
  return value.getUTCDay();
}

export function isBookableISODate(date: string, today = todayInMexico()): boolean {
  return ISO_DATE.test(date) && date >= today && date <= addDaysToISO(today, 31);
}

export function isUpcomingOccurrence(date: string, time: string, now = new Date()): boolean {
  return ISO_DATE.test(date)
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    && `${date}T${time}` > `${todayInMexico(now)}T${timeInMexico(now)}`;
}
