export function toIsoDate(val?: string | null): string | null {
  if (!val || typeof val !== "string" || !val.trim()) return null;
  const trimmed = val.trim();
  if (/[;<>'"`]|--|\/\*/.test(trimmed)) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 1000 || year > 9999) return null;
  try {
    return d.toISOString();
  } catch {
    return null;
  }
}
