// Date utilities to handle YYYY-MM-DD format robustly without timezone surprises
// All functions operate in local time, avoiding UTC parsing issues.

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
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
  // Validate round-trip equality to catch impossible dates like 2025-02-30
  if (formatLocalYMD(dt) !== dateStr) {
    throw new Error('Fecha fuera de rango o inválida');
  }
  return dt;
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
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => String(parts.find(p => p.type === t)?.value || '').padStart(t === 'day' || t === 'month' ? 2 : 0, '0');
  const y = get('year');
  const m = get('month');
  const d = get('day');
  return `${y}-${m}-${d}`;
}

export function nowBAYMD(): string {
  return formatBAYMD(new Date());
}

// Start of day in BA timezone projected to a local Date by round-tripping YYYY-MM-DD
export function startOfDayBA(date: Date): Date {
  return parseYMD(formatBAYMD(date));
}

// End of day in BA timezone as local Date (23:59:59.999 of BA day)
export function endOfDayBA(date: Date): Date {
  const start = startOfDayBA(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return end;
}

export function formatBATimestampISO(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => String(parts.find(p => p.type === t)?.value || '').padStart(t === 'day' || t === 'month' ? 2 : 0, '0');
  const y = get('year');
  const m = get('month');
  const d = get('day');
  const hh = get('hour');
  const mm = get('minute');
  const ss = get('second');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}-03:00`;
}

// Compare two YYYY-MM-DD strings for descending sort
export function compareYmdDesc(a: string, b: string): number {
  // Lexicographic works for YYYY-MM-DD, but be explicit
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

export function formatBAHMS(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => String(parts.find(p => p.type === t)?.value || '').padStart(2, '0');
  const hh = get('hour');
  const mm = get('minute');
  const ss = get('second');
  return `${hh}${mm}${ss}`;
}

export function formatUTCYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  return `${y}-${m}-${d}`;
}