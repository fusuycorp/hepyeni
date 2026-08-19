export function getInitials(name?: string, email?: string): string {
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanEmail = typeof email === "string" ? email.trim() : "";
  const source = cleanName || cleanEmail || "U";
  return source.slice(0, 2).toUpperCase();
}

export function getDisplayName(
  user?: { name?: string; email?: string },
  fallbackLabel = "",
): string {
  if (!user || typeof user !== "object") return fallbackLabel;
  const name = typeof user.name === "string" ? user.name.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";
  return name || email || fallbackLabel;
}
