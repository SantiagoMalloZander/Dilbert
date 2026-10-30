import { isExcludedAddress, type ProspectTown } from "@/lib/prospecting/towns";

// Fuentes del buscador de inmobiliarias.
// - Google Places (New) Text Search: la fuente buena. Necesita GOOGLE_PLACES_API_KEY.
// - OpenStreetMap (Overpass): gratis, sin key, pero con poca cobertura.

export type FoundProspect = {
  externalId: string;
  source: "google" | "osm";
  name: string;
  town: string;
  region: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  mapsUrl: string | null;
};

const DEFAULT_RADIUS_KM = 6;
const GOOGLE_MAX_PAGES = 3; // 20 por página → hasta 60 por búsqueda

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export function isGooglePlacesConfigured() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
};

// Google corta en 60 resultados por búsqueda: con la búsqueda default probamos
// varias frases (la primera filtrada por tipo "inmobiliaria") y deduplicamos.
const DEFAULT_GOOGLE_QUERIES = [
  { text: "inmobiliaria", includedType: "real_estate_agency" },
  { text: "inmobiliarias propiedades venta alquiler" },
  { text: "martillero corredor inmobiliario" },
];

async function searchGoogleQuery(
  town: ProspectTown,
  query: { text: string; includedType?: string },
  apiKey: string
): Promise<FoundProspect[]> {
  const results: FoundProspect[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < GOOGLE_MAX_PAGES; page += 1) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus,nextPageToken",
      },
      body: JSON.stringify({
        textQuery: `${query.text} en ${town.searchAs ?? town.name}, Provincia de Buenos Aires`,
        includedType: query.includedType,
        languageCode: "es",
        regionCode: "AR",
        pageSize: 20,
        pageToken,
        locationBias: {
          circle: {
            center: { latitude: town.lat, longitude: town.lng },
            radius: (town.radiusKm ?? DEFAULT_RADIUS_KM) * 1000,
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`GOOGLE_PLACES_ERROR ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as { places?: GooglePlace[]; nextPageToken?: string };

    for (const place of data.places ?? []) {
      if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
      if (isExcludedAddress(place.formattedAddress)) continue;

      results.push({
        externalId: `google:${place.id}`,
        source: "google",
        name: place.displayName?.text?.trim() || "Sin nombre",
        town: town.name,
        region: town.region,
        address: place.formattedAddress ?? null,
        phone: place.nationalPhoneNumber ?? null,
        website: place.websiteUri ?? null,
        email: null,
        mapsUrl: place.googleMapsUri ?? null,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return results;
}

async function searchGoogle(town: ProspectTown, query: string): Promise<FoundProspect[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const queries = query === "inmobiliaria" ? DEFAULT_GOOGLE_QUERIES : [{ text: query }];
  const batches = await Promise.all(queries.map((q) => searchGoogleQuery(town, q, apiKey)));

  const byId = new Map<string, FoundProspect>();
  for (const prospect of batches.flat()) byId.set(prospect.externalId, prospect);
  return [...byId.values()];
}

type OsmElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
};

async function searchOsm(town: ProspectTown): Promise<FoundProspect[]> {
  const radius = (town.radiusKm ?? DEFAULT_RADIUS_KM) * 1000;
  const query = `[out:json][timeout:20];nwr(around:${radius},${town.lat},${town.lng})["office"="estate_agent"];out center tags;`;

  // Los mirrors de Overpass se caen seguido: les pegamos a todos en paralelo
  // y usamos el primero que responda bien.
  const fetchMirror = async (endpoint: string) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; DilvertProspector/1.0)",
        Accept: "application/json",
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`OVERPASS_${response.status}`);
    return (await response.json()) as { elements?: OsmElement[] };
  };

  let data: { elements?: OsmElement[] };
  try {
    data = await Promise.any(OVERPASS_ENDPOINTS.map(fetchMirror));
  } catch {
    return [];
  }

  return (data.elements ?? [])
    .filter((element) => element.tags?.name)
    .map((element) => {
      const tags = element.tags ?? {};
      const address = [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
        .filter(Boolean)
        .join(" ");

      return {
        externalId: `osm:${element.type}/${element.id}`,
        source: "osm" as const,
        name: tags.name,
        town: town.name,
        region: town.region,
        address: address || null,
        phone: tags.phone ?? tags["contact:phone"] ?? null,
        website: tags.website ?? tags["contact:website"] ?? null,
        email: tags.email ?? tags["contact:email"] ?? null,
        mapsUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      };
    })
    .filter((prospect) => !isExcludedAddress(prospect.address));
}

export async function searchTown(
  town: ProspectTown,
  options: { query?: string; useGoogle?: boolean; useOsm?: boolean } = {}
) {
  const query = options.query?.trim() || "inmobiliaria";
  const [google, osm] = await Promise.all([
    options.useGoogle === false ? Promise.resolve([]) : searchGoogle(town, query),
    options.useOsm === false ? Promise.resolve([]) : searchOsm(town),
  ]);

  return [...google, ...osm];
}
