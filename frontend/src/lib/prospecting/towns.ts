// Localidades de Provincia de Buenos Aires para prospectar inmobiliarias.
// Fuera de CABA y del conurbano (24 partidos), y sin Campana (pedido explícito).
// Las coordenadas son del centro de cada ciudad y se usan para sesgar la
// búsqueda de Google y para el radio de OpenStreetMap.

export type ProspectTown = {
  name: string;
  region: ProspectRegion;
  lat: number;
  lng: number;
  /** Texto para la búsqueda si difiere del nombre (barrios de ciudades grandes). */
  searchAs?: string;
  /** Radio de búsqueda en km (ciudades grandes usan más). */
  radiusKm?: number;
};

export const PROSPECT_REGIONS = [
  "Gran La Plata",
  "Corredor Norte y Periurbano",
  "Costa Atlántica",
  "Interior Norte",
  "Interior Centro",
  "Interior Sur",
] as const;

export type ProspectRegion = (typeof PROSPECT_REGIONS)[number];

export const PROSPECT_TOWNS: ProspectTown[] = [
  // Gran La Plata — La Plata se parte en barrios porque Google corta en 60 resultados.
  { name: "La Plata", region: "Gran La Plata", lat: -34.9214, lng: -57.9545, radiusKm: 5 },
  { name: "City Bell", region: "Gran La Plata", lat: -34.865, lng: -58.045, radiusKm: 4 },
  { name: "Gonnet", region: "Gran La Plata", lat: -34.877, lng: -58.017, radiusKm: 3 },
  { name: "Villa Elisa", region: "Gran La Plata", lat: -34.846, lng: -58.083, radiusKm: 4 },
  { name: "Tolosa", region: "Gran La Plata", lat: -34.9, lng: -57.97, radiusKm: 3 },
  { name: "Los Hornos", region: "Gran La Plata", lat: -34.955, lng: -57.985, radiusKm: 4 },
  { name: "Berisso", region: "Gran La Plata", lat: -34.873, lng: -57.886, radiusKm: 6 },
  { name: "Ensenada", region: "Gran La Plata", lat: -34.864, lng: -57.912, radiusKm: 5 },
  { name: "Brandsen", region: "Gran La Plata", lat: -35.168, lng: -58.234 },

  // Corredor norte y periurbano (estilo Campana, sin Campana)
  { name: "Zárate", region: "Corredor Norte y Periurbano", lat: -34.098, lng: -59.028 },
  { name: "Escobar", region: "Corredor Norte y Periurbano", lat: -34.348, lng: -58.797 },
  { name: "Pilar", region: "Corredor Norte y Periurbano", lat: -34.459, lng: -58.914 },
  { name: "Capilla del Señor", region: "Corredor Norte y Periurbano", lat: -34.293, lng: -59.103 },
  { name: "Luján", region: "Corredor Norte y Periurbano", lat: -34.57, lng: -59.105 },
  { name: "General Rodríguez", region: "Corredor Norte y Periurbano", lat: -34.608, lng: -58.952 },
  { name: "Marcos Paz", region: "Corredor Norte y Periurbano", lat: -34.78, lng: -58.835 },
  { name: "Cañuelas", region: "Corredor Norte y Periurbano", lat: -35.052, lng: -58.761 },
  { name: "San Vicente", region: "Corredor Norte y Periurbano", lat: -35.025, lng: -58.423 },
  { name: "Baradero", region: "Corredor Norte y Periurbano", lat: -33.811, lng: -59.508 },
  { name: "San Pedro", region: "Corredor Norte y Periurbano", lat: -33.679, lng: -59.667 },
  { name: "San Antonio de Areco", region: "Corredor Norte y Periurbano", lat: -34.25, lng: -59.471 },
  { name: "Mercedes", region: "Corredor Norte y Periurbano", lat: -34.651, lng: -59.43 },
  { name: "Lobos", region: "Corredor Norte y Periurbano", lat: -35.185, lng: -59.095 },
  { name: "Navarro", region: "Corredor Norte y Periurbano", lat: -35.004, lng: -59.277 },
  { name: "San Miguel del Monte", region: "Corredor Norte y Periurbano", lat: -35.441, lng: -58.809 },
  { name: "Chascomús", region: "Corredor Norte y Periurbano", lat: -35.575, lng: -58.009 },
  { name: "Magdalena", region: "Corredor Norte y Periurbano", lat: -35.081, lng: -57.517 },

  // Costa Atlántica
  // Mar del Plata tiene cientos de inmobiliarias: se parte en barrios.
  { name: "Mar del Plata · Centro", searchAs: "Centro, Mar del Plata", region: "Costa Atlántica", lat: -38.0009, lng: -57.552, radiusKm: 2 },
  { name: "Mar del Plata · La Perla", searchAs: "La Perla, Mar del Plata", region: "Costa Atlántica", lat: -37.9905, lng: -57.553, radiusKm: 2 },
  { name: "Mar del Plata · Güemes", searchAs: "Güemes, Mar del Plata", region: "Costa Atlántica", lat: -38.018, lng: -57.544, radiusKm: 2 },
  { name: "Mar del Plata · Playa Grande", searchAs: "Playa Grande, Mar del Plata", region: "Costa Atlántica", lat: -38.028, lng: -57.533, radiusKm: 2 },
  { name: "Mar del Plata · Chauvín", searchAs: "Chauvín, Mar del Plata", region: "Costa Atlántica", lat: -38.012, lng: -57.56, radiusKm: 2 },
  { name: "Mar del Plata · Constitución", searchAs: "Constitución, Mar del Plata", region: "Costa Atlántica", lat: -37.97, lng: -57.565, radiusKm: 3 },
  { name: "Mar del Plata · Punta Mogotes", searchAs: "Punta Mogotes, Mar del Plata", region: "Costa Atlántica", lat: -38.075, lng: -57.545, radiusKm: 3 },
  { name: "Pinamar", region: "Costa Atlántica", lat: -37.108, lng: -56.861 },
  { name: "Cariló", region: "Costa Atlántica", lat: -37.163, lng: -56.9, radiusKm: 4 },
  { name: "Villa Gesell", region: "Costa Atlántica", lat: -37.263, lng: -56.973 },
  { name: "San Clemente del Tuyú", region: "Costa Atlántica", lat: -36.357, lng: -56.723 },
  { name: "Santa Teresita", region: "Costa Atlántica", lat: -36.541, lng: -56.692 },
  { name: "San Bernardo", region: "Costa Atlántica", lat: -36.689, lng: -56.678, radiusKm: 4 },
  { name: "Mar de Ajó", region: "Costa Atlántica", lat: -36.719, lng: -56.678, radiusKm: 4 },
  { name: "Santa Clara del Mar", region: "Costa Atlántica", lat: -37.835, lng: -57.507 },
  { name: "Miramar", region: "Costa Atlántica", lat: -38.271, lng: -57.839 },
  { name: "Necochea", region: "Costa Atlántica", lat: -38.554, lng: -58.739 },
  { name: "Claromecó", region: "Costa Atlántica", lat: -38.857, lng: -60.072 },
  { name: "Monte Hermoso", region: "Costa Atlántica", lat: -38.988, lng: -61.297 },
  { name: "General Madariaga", region: "Costa Atlántica", lat: -37.002, lng: -57.136 },

  // Interior norte
  { name: "San Nicolás", region: "Interior Norte", lat: -33.335, lng: -60.225 },
  { name: "Ramallo", region: "Interior Norte", lat: -33.486, lng: -60.003 },
  { name: "Pergamino", region: "Interior Norte", lat: -33.89, lng: -60.573 },
  { name: "Arrecifes", region: "Interior Norte", lat: -34.064, lng: -60.103 },
  { name: "Capitán Sarmiento", region: "Interior Norte", lat: -34.172, lng: -59.79 },
  { name: "Salto", region: "Interior Norte", lat: -34.293, lng: -60.255 },
  { name: "Rojas", region: "Interior Norte", lat: -34.196, lng: -60.735 },
  { name: "Colón", region: "Interior Norte", lat: -33.896, lng: -61.1 },
  { name: "Junín", region: "Interior Norte", lat: -34.585, lng: -60.959 },
  { name: "Chacabuco", region: "Interior Norte", lat: -34.641, lng: -60.474 },
  { name: "Chivilcoy", region: "Interior Norte", lat: -34.896, lng: -60.017 },
  { name: "Lincoln", region: "Interior Norte", lat: -34.866, lng: -61.53 },
  { name: "General Villegas", region: "Interior Norte", lat: -35.032, lng: -63.012 },

  // Interior centro
  { name: "Bragado", region: "Interior Centro", lat: -35.119, lng: -60.489 },
  { name: "9 de Julio", region: "Interior Centro", lat: -35.444, lng: -60.884 },
  { name: "25 de Mayo", region: "Interior Centro", lat: -35.433, lng: -60.173 },
  { name: "Carlos Casares", region: "Interior Centro", lat: -35.623, lng: -61.364 },
  { name: "Pehuajó", region: "Interior Centro", lat: -35.811, lng: -61.897 },
  { name: "Trenque Lauquen", region: "Interior Centro", lat: -35.97, lng: -62.734 },
  { name: "Bolívar", region: "Interior Centro", lat: -36.23, lng: -61.113 },
  { name: "Saladillo", region: "Interior Centro", lat: -35.64, lng: -59.778 },
  { name: "Roque Pérez", region: "Interior Centro", lat: -35.401, lng: -59.334 },
  { name: "Las Flores", region: "Interior Centro", lat: -36.014, lng: -59.1 },
  { name: "General Belgrano", region: "Interior Centro", lat: -35.769, lng: -58.495 },
  { name: "Dolores", region: "Interior Centro", lat: -36.313, lng: -57.679 },
  { name: "Azul", region: "Interior Centro", lat: -36.777, lng: -59.858 },
  { name: "Olavarría", region: "Interior Centro", lat: -36.893, lng: -60.322 },
  { name: "Tandil", region: "Interior Centro", lat: -37.321, lng: -59.135, radiusKm: 8 },
  { name: "Balcarce", region: "Interior Centro", lat: -37.846, lng: -58.255 },
  { name: "Benito Juárez", region: "Interior Centro", lat: -37.677, lng: -59.806 },

  // Interior sur
  { name: "Bahía Blanca · Centro", searchAs: "Centro, Bahía Blanca", region: "Interior Sur", lat: -38.7183, lng: -62.2663, radiusKm: 2 },
  { name: "Bahía Blanca · Universitario", searchAs: "Barrio Universitario, Bahía Blanca", region: "Interior Sur", lat: -38.702, lng: -62.27, radiusKm: 2 },
  { name: "Bahía Blanca · Palihue", searchAs: "Palihue, Bahía Blanca", region: "Interior Sur", lat: -38.696, lng: -62.238, radiusKm: 2 },
  { name: "Bahía Blanca · Villa Mitre", searchAs: "Villa Mitre, Bahía Blanca", region: "Interior Sur", lat: -38.732, lng: -62.285, radiusKm: 2 },
  { name: "Tres Arroyos", region: "Interior Sur", lat: -38.375, lng: -60.275 },
  { name: "Lobería", region: "Interior Sur", lat: -38.163, lng: -58.782 },
  { name: "Coronel Suárez", region: "Interior Sur", lat: -37.455, lng: -61.933 },
  { name: "Coronel Pringles", region: "Interior Sur", lat: -37.982, lng: -61.354 },
  { name: "Pigüé", region: "Interior Sur", lat: -37.606, lng: -62.405 },
  { name: "Carmen de Patagones", region: "Interior Sur", lat: -40.798, lng: -62.981 },
];

/** Si una dirección cae en alguno de estos lugares, se descarta. */
export const EXCLUDED_ADDRESS_PATTERNS = [
  /\bcampana\b/i,
  /\bcaba\b/i,
  /ciudad aut[oó]noma/i,
  /capital federal/i,
];

export function isExcludedAddress(address?: string | null) {
  if (!address) return false;
  return EXCLUDED_ADDRESS_PATTERNS.some((pattern) => pattern.test(address));
}

/** Zonas excluidas por coordenadas (para resultados que no traen la ciudad en la dirección). */
const EXCLUDED_ZONES = [
  { name: "Campana", lat: -34.163, lng: -58.959, radiusKm: 6 },
];

function inCaba(lat: number, lng: number) {
  return lat > -34.706 && lat < -34.526 && lng > -58.532 && lng < -58.334;
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function isInExcludedZone(lat: number, lng: number) {
  return (
    inCaba(lat, lng) ||
    EXCLUDED_ZONES.some((zone) => distanceKm(lat, lng, zone.lat, zone.lng) <= zone.radiusKm)
  );
}

export function findTown(name: string) {
  return PROSPECT_TOWNS.find((town) => town.name === name) ?? null;
}
