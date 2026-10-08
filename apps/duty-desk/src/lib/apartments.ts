// Every apartment at The Destination, as confirmed with the property (October 2026):
// the Main Building (floors G–7) and the four Studio Wings (D, C, B, A; floors 1–6, two studios
// per wing per floor). Apartments are known by name, never by number. Extensions are as printed on
// the phone list, even where they don't match the floor (Park City 3312, Coralville 6012, Bergen 4412).
// Changing this list needs a code change and a deploy.

export interface Apartment {
  name: string;
  building: "Main Building" | "Wing A" | "Wing B" | "Wing C" | "Wing D";
  floor: string; // "G", "1"…"7"
  ext: string;
  type: string; // "Studio", "2 Bedroom", "3 Bedroom", "4 Bedroom"
  beds: number; // 0 for studios
}

export const APARTMENTS: Apartment[] = [
  { name: "Athens", building: "Main Building", floor: "7", ext: "7010", type: "4 Bedroom", beds: 4 },
  { name: "Astoria", building: "Main Building", floor: "7", ext: "7020", type: "4 Bedroom", beds: 4 },
  { name: "Venice", building: "Main Building", floor: "7", ext: "7030", type: "4 Bedroom", beds: 4 },
  { name: "Wanaka", building: "Main Building", floor: "6", ext: "6010", type: "2 Bedroom", beds: 2 },
  { name: "Harare", building: "Main Building", floor: "6", ext: "6020", type: "2 Bedroom", beds: 2 },
  { name: "Cape Town", building: "Main Building", floor: "6", ext: "6030", type: "3 Bedroom", beds: 3 },
  { name: "Baku", building: "Main Building", floor: "6", ext: "6040", type: "3 Bedroom", beds: 3 },
  { name: "Budapest", building: "Main Building", floor: "6", ext: "6050", type: "2 Bedroom", beds: 2 },
  { name: "Manila / La Paz", building: "Main Building", floor: "6", ext: "6060", type: "2 Bedroom", beds: 2 },
  { name: "Port Douglas", building: "Main Building", floor: "6", ext: "6070", type: "3 Bedroom", beds: 3 },
  { name: "Cairo", building: "Main Building", floor: "6", ext: "6080", type: "3 Bedroom", beds: 3 },
  { name: "Delhi", building: "Main Building", floor: "5", ext: "5010", type: "2 Bedroom", beds: 2 },
  { name: "Beirut", building: "Main Building", floor: "5", ext: "5020", type: "3 Bedroom", beds: 3 },
  { name: "Jabalia", building: "Main Building", floor: "5", ext: "5030", type: "3 Bedroom", beds: 3 },
  { name: "Lisbon", building: "Main Building", floor: "5", ext: "5040", type: "3 Bedroom", beds: 3 },
  { name: "Riyadh", building: "Main Building", floor: "5", ext: "5050", type: "2 Bedroom", beds: 2 },
  { name: "Zermatt", building: "Main Building", floor: "5", ext: "5060", type: "2 Bedroom", beds: 2 },
  { name: "Mumbai", building: "Main Building", floor: "5", ext: "5070", type: "3 Bedroom", beds: 3 },
  { name: "Tel Aviv", building: "Main Building", floor: "5", ext: "5080", type: "2 Bedroom", beds: 2 },
  { name: "Helsinki", building: "Main Building", floor: "4", ext: "4010", type: "2 Bedroom", beds: 2 },
  { name: "Zurich", building: "Main Building", floor: "4", ext: "4020", type: "2 Bedroom", beds: 2 },
  { name: "Minsk", building: "Main Building", floor: "4", ext: "4030", type: "3 Bedroom", beds: 3 },
  { name: "Munich", building: "Main Building", floor: "4", ext: "4040", type: "3 Bedroom", beds: 3 },
  { name: "Nice", building: "Main Building", floor: "4", ext: "4050", type: "2 Bedroom", beds: 2 },
  { name: "Florence", building: "Main Building", floor: "4", ext: "4060", type: "2 Bedroom", beds: 2 },
  { name: "Brussels", building: "Main Building", floor: "4", ext: "4070", type: "3 Bedroom", beds: 3 },
  { name: "Valencia", building: "Main Building", floor: "4", ext: "4080", type: "3 Bedroom", beds: 3 },
  { name: "Cusco", building: "Main Building", floor: "3", ext: "3010", type: "2 Bedroom", beds: 2 },
  { name: "Barbados", building: "Main Building", floor: "3", ext: "3020", type: "2 Bedroom", beds: 2 },
  { name: "Honolulu", building: "Main Building", floor: "3", ext: "3030", type: "2 Bedroom", beds: 2 },
  { name: "Sao Paulo", building: "Main Building", floor: "3", ext: "3040", type: "3 Bedroom", beds: 3 },
  { name: "Arcata", building: "Main Building", floor: "3", ext: "3050", type: "2 Bedroom", beds: 2 },
  { name: "Hawaii", building: "Main Building", floor: "3", ext: "3060", type: "2 Bedroom", beds: 2 },
  { name: "Hanoi", building: "Main Building", floor: "3", ext: "3070", type: "3 Bedroom", beds: 3 },
  { name: "Maldives", building: "Main Building", floor: "3", ext: "3080", type: "3 Bedroom", beds: 3 },
  { name: "Montreal", building: "Main Building", floor: "2", ext: "2010", type: "2 Bedroom", beds: 2 },
  { name: "Toronto", building: "Main Building", floor: "2", ext: "2020", type: "2 Bedroom", beds: 2 },
  { name: "Middlebury", building: "Main Building", floor: "2", ext: "2030", type: "2 Bedroom", beds: 2 },
  { name: "Vancouver", building: "Main Building", floor: "2", ext: "2040", type: "2 Bedroom", beds: 2 },
  { name: "Melbourne", building: "Main Building", floor: "2", ext: "2050", type: "2 Bedroom", beds: 2 },
  { name: "Auckland", building: "Main Building", floor: "2", ext: "2060", type: "2 Bedroom", beds: 2 },
  { name: "Sydney", building: "Main Building", floor: "2", ext: "2070", type: "2 Bedroom", beds: 2 },
  { name: "Glenwood", building: "Main Building", floor: "2", ext: "2080", type: "2 Bedroom", beds: 2 },
  { name: "Las Vegas", building: "Main Building", floor: "1", ext: "1010", type: "3 Bedroom", beds: 3 },
  { name: "Memphis", building: "Main Building", floor: "1", ext: "1020", type: "3 Bedroom", beds: 3 },
  { name: "Dallas", building: "Main Building", floor: "1", ext: "1030", type: "3 Bedroom", beds: 3 },
  { name: "Belair", building: "Main Building", floor: "1", ext: "1040", type: "3 Bedroom", beds: 3 },
  { name: "Princeton", building: "Main Building", floor: "1", ext: "1050", type: "2 Bedroom", beds: 2 },
  { name: "Houston", building: "Main Building", floor: "1", ext: "1060", type: "2 Bedroom", beds: 2 },
  { name: "Charleston", building: "Main Building", floor: "1", ext: "1070", type: "2 Bedroom", beds: 2 },
  { name: "Aspen", building: "Main Building", floor: "1", ext: "1080", type: "2 Bedroom", beds: 2 },
  { name: "Milan", building: "Main Building", floor: "G", ext: "0071", type: "2 Bedroom", beds: 2 },
  { name: "Jeville", building: "Main Building", floor: "G", ext: "0050", type: "2 Bedroom", beds: 2 },
  { name: "La Grande", building: "Wing D", floor: "6", ext: "6611", type: "Studio", beds: 0 },
  { name: "Santiago", building: "Wing D", floor: "6", ext: "6612", type: "Studio", beds: 0 },
  { name: "Vienna", building: "Wing C", floor: "6", ext: "6613", type: "Studio", beds: 0 },
  { name: "Glasgow", building: "Wing C", floor: "6", ext: "6614", type: "Studio", beds: 0 },
  { name: "Guatape", building: "Wing B", floor: "6", ext: "6615", type: "Studio", beds: 0 },
  { name: "River Falls", building: "Wing B", floor: "6", ext: "6616", type: "Studio", beds: 0 },
  { name: "Seoul", building: "Wing A", floor: "6", ext: "6617", type: "Studio", beds: 0 },
  { name: "Nairobi", building: "Wing A", floor: "6", ext: "6618", type: "Studio", beds: 0 },
  { name: "St Ives", building: "Wing D", floor: "5", ext: "5511", type: "Studio", beds: 0 },
  { name: "Hood River", building: "Wing D", floor: "5", ext: "5512", type: "Studio", beds: 0 },
  { name: "Merriam", building: "Wing C", floor: "5", ext: "5513", type: "Studio", beds: 0 },
  { name: "Corsica", building: "Wing C", floor: "5", ext: "5514", type: "Studio", beds: 0 },
  { name: "Beaufort", building: "Wing B", floor: "5", ext: "5515", type: "Studio", beds: 0 },
  { name: "Paraty", building: "Wing B", floor: "5", ext: "5516", type: "Studio", beds: 0 },
  { name: "Lagos", building: "Wing A", floor: "5", ext: "5517", type: "Studio", beds: 0 },
  { name: "Berlin", building: "Wing A", floor: "5", ext: "5518", type: "Studio", beds: 0 },
  { name: "Louisville", building: "Wing D", floor: "4", ext: "4411", type: "Studio", beds: 0 },
  { name: "Coralville", building: "Wing D", floor: "4", ext: "6012", type: "Studio", beds: 0 },
  { name: "Doha", building: "Wing C", floor: "4", ext: "4413", type: "Studio", beds: 0 },
  { name: "Middleton", building: "Wing C", floor: "4", ext: "4414", type: "Studio", beds: 0 },
  { name: "Frankfurt", building: "Wing B", floor: "4", ext: "4415", type: "Studio", beds: 0 },
  { name: "Suzdal", building: "Wing B", floor: "4", ext: "4416", type: "Studio", beds: 0 },
  { name: "Montana", building: "Wing A", floor: "4", ext: "4417", type: "Studio", beds: 0 },
  { name: "Warsaw", building: "Wing A", floor: "4", ext: "4418", type: "Studio", beds: 0 },
  { name: "Tokyo", building: "Wing D", floor: "3", ext: "3311", type: "Studio", beds: 0 },
  { name: "Bergen", building: "Wing D", floor: "3", ext: "4412", type: "Studio", beds: 0 },
  { name: "Bravard", building: "Wing C", floor: "3", ext: "3313", type: "Studio", beds: 0 },
  { name: "Alexandria", building: "Wing C", floor: "3", ext: "3314", type: "Studio", beds: 0 },
  { name: "Bruges", building: "Wing B", floor: "3", ext: "3315", type: "Studio", beds: 0 },
  { name: "Abu Dhabi", building: "Wing B", floor: "3", ext: "3316", type: "Studio", beds: 0 },
  { name: "Jerusalem", building: "Wing A", floor: "3", ext: "3317", type: "Studio", beds: 0 },
  { name: "Burgas", building: "Wing A", floor: "3", ext: "3318", type: "Studio", beds: 0 },
  { name: "Cartagena", building: "Wing D", floor: "2", ext: "2211", type: "Studio", beds: 0 },
  { name: "Shenzhen", building: "Wing D", floor: "2", ext: "2212", type: "Studio", beds: 0 },
  { name: "Brunswick", building: "Wing C", floor: "2", ext: "2213", type: "Studio", beds: 0 },
  { name: "Lima", building: "Wing C", floor: "2", ext: "2214", type: "Studio", beds: 0 },
  { name: "Chennai", building: "Wing B", floor: "2", ext: "2215", type: "Studio", beds: 0 },
  { name: "Hallstatt", building: "Wing B", floor: "2", ext: "2216", type: "Studio", beds: 0 },
  { name: "Queenstown", building: "Wing A", floor: "2", ext: "2217", type: "Studio", beds: 0 },
  { name: "Kano", building: "Wing A", floor: "2", ext: "2218", type: "Studio", beds: 0 },
  { name: "Park City", building: "Wing D", floor: "1", ext: "3312", type: "Studio", beds: 0 },
  { name: "Jakarta", building: "Wing D", floor: "1", ext: "1112", type: "Studio", beds: 0 },
  { name: "Augusta", building: "Wing C", floor: "1", ext: "1113", type: "Studio", beds: 0 },
  { name: "Grenada", building: "Wing C", floor: "1", ext: "1114", type: "Studio", beds: 0 },
  { name: "Jaipur", building: "Wing B", floor: "1", ext: "1115", type: "Studio", beds: 0 },
  { name: "Edinburgh", building: "Wing B", floor: "1", ext: "1116", type: "Studio", beds: 0 },
  { name: "Havana", building: "Wing A", floor: "1", ext: "1117", type: "Studio", beds: 0 },
  { name: "Dublin", building: "Wing A", floor: "1", ext: "1118", type: "Studio", beds: 0 },
];

export const MAIN_FLOORS = ["7", "6", "5", "4", "3", "2", "1", "G"];
export const STUDIO_FLOORS = ["6", "5", "4", "3", "2", "1"];
export const WINGS = ["Wing D", "Wing C", "Wing B", "Wing A"] as const;

// Matching ignores case, spacing and punctuation, so "VENICE", "venice " and "Venice" are the same
// apartment. A few names have more than one form on paper.
const ALIASES: Record<string, string> = { manila: "Manila / La Paz", lapaz: "Manila / La Paz", saopaulo: "Sao Paulo", telaviv: "Tel Aviv" };
export const aptKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const BY_KEY = new Map(APARTMENTS.map((a) => [aptKey(a.name), a]));

export function findApartment(name: string | null | undefined): Apartment | undefined {
  if (!name) return undefined;
  const k = aptKey(name);
  return BY_KEY.get(k) ?? (ALIASES[k] ? BY_KEY.get(aptKey(ALIASES[k])) : undefined);
}

export function aptWhere(a: Apartment): string {
  return `${a.building} · ${a.floor === "G" ? "Ground floor" : "Floor " + a.floor} · ${a.type} · ext ${a.ext}`;
}

export function aptShort(a: Apartment): string {
  return `${a.building === "Main Building" ? "Main" : a.building} · ${a.floor === "G" ? "G" : "L" + a.floor}`;
}

// Suggestions while typing a name: starts-with first, then contains.
export function suggestApartments(q: string, limit = 6): Apartment[] {
  const s = aptKey(q);
  if (!s) return [];
  return APARTMENTS.filter((a) => aptKey(a.name).includes(s))
    .sort((a, b) => (aptKey(a.name).startsWith(s) ? 0 : 1) - (aptKey(b.name).startsWith(s) ? 0 : 1) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
