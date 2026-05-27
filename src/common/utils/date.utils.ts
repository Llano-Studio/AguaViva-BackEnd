// Date utilities to handle YYYY-MM-DD format robustly without timezone surprises
// All functions operate in local time, avoiding UTC parsing issues.

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function sanitizeEnvValue(value?: string): string | undefined {
  return value?.trim().replace(/^['"`\s]+|['"`\s]+$/g, '');
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

let cachedAppTimeZone: string | null = null;
export function getAppTimeZone(): string {
  if (cachedAppTimeZone) return cachedAppTimeZone;
  const candidates = [
    sanitizeEnvValue(process.env.APP_TIMEZONE),
    'America/Argentina/Buenos_Aires',
    'America/Buenos_Aires',
    'UTC',
  ].filter((value): value is string => Boolean(value));

  const validTimeZone = candidates.find(isValidTimeZone);
  cachedAppTimeZone = validTimeZone || 'UTC';
  return cachedAppTimeZone;
}

// Hardcoded BA offset (no DST since 2009). Used when ICU lacks tz data.
const BA_FIXED_OFFSET_MINUTES = -180;

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const values: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') values[p.type] = p.value;
    }
    const asUTC = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    return (asUTC - date.getTime()) / 60000;
  } catch {
    return BA_FIXED_OFFSET_MINUTES;
  }
}

function formatPartsWithFallback(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const collect = (parts: Intl.DateTimeFormatPart[]) => {
    const v: Record<string, string> = {};
    for (const p of parts) if (p.type !== 'literal') v[p.type] = p.value;
    return v;
  };
  try {
    return collect(
      new Intl.DateTimeFormat('es-AR', { timeZone, ...options }).formatToParts(date),
    );
  } catch {
    const shifted = new Date(date.getTime() + BA_FIXED_OFFSET_MINUTES * 60000);
    return {
      year: String(shifted.getUTCFullYear()),
      month: pad2(shifted.getUTCMonth() + 1),
      day: pad2(shifted.getUTCDate()),
      hour: pad2(shifted.getUTCHours()),
      minute: pad2(shifted.getUTCMinutes()),
      second: pad2(shifted.getUTCSeconds()),
    };
  }
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hh = pad2(Math.floor(abs / 60));
  const mm = pad2(abs % 60);
  return `${sign}${hh}:${mm}`;
}

// Parse a strict YYYY-MM-DD string into a local Date at 00:00:00.000
export function parseYMD(dateStr: string): Date {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!m) throw new Error('Formato de fecha inválido. Use YYYY-MM-DD');
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const mo = Number(mStr);
  const d = Number(dStr);
  const dt = new Date(y, mo - 1, d);
  dt.setHours(0, 0, 0, 0);
  if (formatLocalYMD(dt) !== dateStr) {
    throw new Error('Fecha fuera de rango o inválida');
  }
  return dt;
}

export function parseBAYMD(dateStr: string): Date {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!m) throw new Error('Formato de fecha inválido. Use YYYY-MM-DD');
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const mo = Number(mStr);
  const d = Number(dStr);
  const timeZone = getAppTimeZone();
  const utcMidnight = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, utcMidnight);
  const dt = new Date(utcMidnight.getTime() - offsetMinutes * 60000);
  if (formatBAYMD(dt) !== dateStr) {
    throw new Error('Fecha fuera de rango o inválida');
  }
  return dt;
}

export function parseUTCYMD(dateStr: string): Date {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!m) throw new Error('Formato de fecha inválido. Use YYYY-MM-DD');
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const mo = Number(mStr);
  const d = Number(dStr);
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  if (formatUTCYMD(dt) !== dateStr) {
    throw new Error('Fecha fuera de rango o inválida');
  }
  return dt;
}

export function dayBefore(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d;
}

// Validate string is strict YYYY-MM-DD and corresponds to a real calendar date
export function isValidYMD(dateStr: string): boolean {
  try {
    parseYMD(dateStr);
    return true;
  } catch {
    return false;
  }
}

// Format a Date into YYYY-MM-DD using local calendar fields
export function formatLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

// Current local date in YYYY-MM-DD
export function nowLocalYMD(): string {
  return formatLocalYMD(new Date());
}

// Format a Date into YYYY-MM-DD using Buenos Aires timezone (UTC-3)
export function formatBAYMD(date: Date): string {
  const iso = date.toISOString();
  const isUtcMidnight = /T00:00:00\.000Z$/.test(iso);
  if (isUtcMidnight) {
    const y = date.getUTCFullYear();
    const m = pad2(date.getUTCMonth() + 1);
    const d = pad2(date.getUTCDate());
    return `${y}-${m}-${d}`;
  }
  const timeZone = getAppTimeZone();
  const values = formatPartsWithFallback(date, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return `${values.year}-${values.month}-${values.day}`;
}

export function nowBAYMD(): string {
  return formatBAYMD(new Date());
}

// Start of day in BA timezone projected to a local Date by round-tripping YYYY-MM-DD
export function startOfDayBA(date: Date): Date {
  return parseBAYMD(formatBAYMD(date));
}

// End of day in BA timezone as local Date (23:59:59.999 of BA day)
export function endOfDayBA(date: Date): Date {
  const start = startOfDayBA(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return end;
}

export function formatBATimestampISO(date: Date): string {
  const timeZone = getAppTimeZone();
  const isUtcMidnight = /T00:00:00\.000Z$/.test(date.toISOString());
  const normalized = isUtcMidnight
    ? new Date(
        date.getTime() - getTimeZoneOffsetMinutes(timeZone, date) * 60000,
      )
    : date;
  const values = formatPartsWithFallback(normalized, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const offset = formatOffset(getTimeZoneOffsetMinutes(timeZone, normalized));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${offset}`;
}

// Compare two YYYY-MM-DD strings for descending sort
export function compareYmdDesc(a: string, b: string): number {
  // Lexicographic works for YYYY-MM-DD, but be explicit
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

export function formatBAHMS(date: Date): string {
  const timeZone = getAppTimeZone();
  const values = formatPartsWithFallback(date, timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return `${values.hour}${values.minute}${values.second}`;
}

export function formatUTCYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  return `${y}-${m}-${d}`;
}
