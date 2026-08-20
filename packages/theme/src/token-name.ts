/** Convert camelCase MD3 role names to kebab-case CSS token suffixes. */
export function tokenName(role: string): string {
  return role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
