/** Accept finite angles only. Never turn an empty field into zero. */
export function parseTiltInput(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 90) return null;
  return Math.round(value * 100) / 100;
}
