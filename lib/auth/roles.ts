// Admin and Project Manager share the full workspace permissions.
// Keep the stored role unchanged for account labels and audit history.
export function hasFullAccess(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'PROJECT_MANAGER';
}
