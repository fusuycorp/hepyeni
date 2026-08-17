export function getInitials(name?: string, email?: string): string {
  const source = name?.trim() || email?.trim() || "U";
  return source.slice(0, 2).toUpperCase();
}

export function getDisplayName(user?: { name?: string; email?: string }): string {
  return user?.name || user?.email || "Üye";
}
