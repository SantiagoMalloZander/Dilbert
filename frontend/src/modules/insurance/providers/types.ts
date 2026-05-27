export type Result<T> = { data: T | null; error: string | null };

/** Canonical insurance categories (ramos) — same vocabulary as the extractor. */
export const INSURANCE_CATEGORIES = [
  "auto",
  "hogar",
  "vida",
  "salud",
  "comercial",
  "art",
  "caucion",
  "responsabilidad_civil",
  "otros",
] as const;

export type InsuranceCategory = (typeof INSURANCE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  auto: "Automotor",
  hogar: "Hogar",
  vida: "Vida",
  salud: "Salud",
  comercial: "Comercial",
  art: "ART",
  caucion: "Caución",
  responsabilidad_civil: "Resp. Civil",
  otros: "Otros",
};

export type ProviderRecord = {
  id: string;
  name: string;
  categories: string[];
  logoUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ProviderFormInput = {
  name: string;
  categories: string[];
  notes?: string | null;
};
