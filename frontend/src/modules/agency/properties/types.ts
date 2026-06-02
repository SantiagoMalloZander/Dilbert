export type Result<T> = { data: T | null; error: string | null };

export const PROPERTY_TYPES = [
  "depto", "casa", "ph",
  "terreno", "terreno_industrial", "terreno_barrio", "terreno_complejo",
  "local", "oficina", "galpon", "cochera", "quinta",
] as const;

export const OPERATION_TYPES = ["venta", "alquiler", "alquiler_temporario"] as const;

export const PROPERTY_STATUSES = [
  "disponible", "reservada", "vendida", "alquilada", "pausada",
] as const;

export const COMMON_AMENITIES = [
  "balcon", "terraza", "parrilla", "pileta", "gym", "sum",
  "seguridad", "baulera", "lavadero", "jardin", "vista_abierta", "amoblado",
] as const;

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  depto: "Departamento", casa: "Casa", ph: "PH",
  terreno: "Terreno", terreno_industrial: "Terreno industrial",
  terreno_barrio: "Lote en barrio cerrado", terreno_complejo: "Lote en complejo",
  local: "Local", oficina: "Oficina", galpon: "Galpón",
  cochera: "Cochera", quinta: "Quinta",
};

export const OPERATION_LABELS: Record<string, string> = {
  venta: "Venta", alquiler: "Alquiler", alquiler_temporario: "Alquiler temporario",
};

export const STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible", reservada: "Reservada", vendida: "Vendida",
  alquilada: "Alquilada", pausada: "Pausada",
};

export const AMENITY_LABELS: Record<string, string> = {
  balcon: "Balcón", terraza: "Terraza", parrilla: "Parrilla",
  pileta: "Pileta", gym: "Gimnasio", sum: "SUM",
  seguridad: "Seguridad", baulera: "Baulera", lavadero: "Lavadero",
  jardin: "Jardín", vista_abierta: "Vista abierta", amoblado: "Amoblado",
};

export type PropertyRecord = {
  id: string;
  title: string;
  internalCode: string | null;
  listingUrl: string | null;
  propertyType: string;
  operationType: string;
  status: string;
  address: string | null;
  zone: string | null;
  city: string | null;
  province: string | null;
  floor: string | null;
  apartment: string | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surfaceTotal: number | null;
  surfaceCovered: number | null;
  yearBuilt: number | null;
  price: number | null;
  currency: string | null;
  expenses: number | null;
  expensesCurrency: string | null;
  hasGarage: boolean | null;
  garageCount: number | null;
  mortgageEligible: boolean | null;
  amenities: string[];
  description: string | null;
  assignedTo: string | null;
  createdAt: string;
};

export type PropertyFormInput = {
  title: string;
  internalCode?: string | null;
  listingUrl?: string | null;
  propertyType: string;
  operationType: string;
  status: string;
  address?: string | null;
  zone?: string | null;
  city?: string | null;
  province?: string | null;
  floor?: string | null;
  apartment?: string | null;
  rooms?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  surfaceTotal?: number | null;
  surfaceCovered?: number | null;
  yearBuilt?: number | null;
  price?: number | null;
  currency?: string | null;
  expenses?: number | null;
  expensesCurrency?: string | null;
  hasGarage?: boolean | null;
  garageCount?: number | null;
  mortgageEligible?: boolean | null;
  amenities?: string[];
  description?: string | null;
};
