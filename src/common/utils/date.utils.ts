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

// Compare two YYYY-MM-DD strings for descending sort
export function compareYmdDesc(a: string, b: string): number {
  // Lexicographic works for YYYY-MM-DD, but be explicit
  if (a === b) return 0;
  return a < b ? 1 : -1;
}