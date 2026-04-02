export type AppRole = "owner" | "analyst" | "vendor";

const DEFAULT_ADMIN_EMAIL = "dilbert@gmail.com";

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

export function getAdminEmail() {
  return normalizeEmail(process.env.DILBERT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
}

export function isSuperAdminEmail(email?: string | null) {
  return normalizeEmail(email) === getAdminEmail();
}

export function getRoleLabel(role: AppRole) {
  switch (role) {
    case "owner":
      return "Owner";
    case "analyst":
      return "Analista";
    default:
      return "Vendedor";
  }
}
