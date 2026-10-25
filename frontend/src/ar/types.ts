export type ScanItem = { name: string; category: string; position?: Record<string, number | string>; photoUri?: string };
export type RoomSummary = { walls: number; doors: number; windows: number; openings: number; objects: number; floor_area_m2?: number };
export type ScanResult = {
  method: "roomplan" | "arkit" | "arcore";
  jsonUri?: string; // RoomPlan export (local file)
  usdzUri?: string;
  summary?: RoomSummary;
  planes?: number;
  floor_area_m2?: number;
  items: ScanItem[]; // placed by the host in AR, saved straight away
  suggested?: { type?: string; items: { name: string; category: string }[] }; // detected, the host confirms them
};
export type ArSupport = { roomplan: boolean; xr: boolean };
export type ScannerProps = {
  open: boolean;
  mode: "roomplan" | "xr";
  roomType: string;
  scanName: string;
  xrOk: boolean;
  onClose: (message?: string) => void;
  onDone: (r: ScanResult) => void;
};

// RoomPlan object categories -> what Bullpen calls them.
const OBJECTS: Record<string, [string, string]> = {
  refrigerator: ["Refrigerator", "appliance"], stove: ["Stove", "appliance"], oven: ["Oven", "appliance"],
  dishwasher: ["Dishwasher", "appliance"], washerDryer: ["Washer / dryer", "appliance"], television: ["Television", "appliance"],
  sink: ["Sink", "fixture"], toilet: ["Toilet", "fixture"], bathtub: ["Bathtub", "fixture"], fireplace: ["Fireplace", "fixture"],
  stairs: ["Stairs", "other"], bed: ["Bed", "other"], sofa: ["Sofa", "other"], chair: ["Chair", "other"], table: ["Table", "other"], storage: ["Storage", "other"],
};
const ROOM_HINTS: [string, string[]][] = [
  ["kitchen", ["refrigerator", "stove", "oven", "dishwasher"]], ["bathroom", ["toilet", "bathtub"]], ["laundry", ["washerDryer"]],
  ["bedroom", ["bed"]], ["living room", ["sofa", "television", "fireplace"]],
];

const catKey = (c: any): string => (typeof c === "string" ? c : c && typeof c === "object" ? Object.keys(c)[0] || "" : "");

// Reads the CapturedRoom / CapturedStructure JSON that RoomPlan exports.
export function parseRoomPlan(json: any): { summary: RoomSummary; suggested: NonNullable<ScanResult["suggested"]> } {
  const rooms: any[] = Array.isArray(json?.rooms) ? json.rooms : [];
  const pick = (k: string): any[] => (Array.isArray(json?.[k]) ? json[k] : rooms.flatMap((r) => (Array.isArray(r?.[k]) ? r[k] : [])));
  const keys = pick("objects").map((o) => catKey(o?.category)).filter(Boolean);
  const area = pick("floors").reduce((a, f) => a + (Array.isArray(f?.dimensions) ? (Number(f.dimensions[0]) || 0) * (Number(f.dimensions[1]) || 0) : 0), 0);
  const counts = new Map<string, number>();
  keys.forEach((k) => counts.set(k, (counts.get(k) || 0) + 1));
  const items: { name: string; category: string }[] = [];
  counts.forEach((n, k) => {
    const o = OBJECTS[k];
    if (!o || o[1] === "other") return;
    for (let i = 1; i <= Math.min(n, 3); i++) items.push({ name: i === 1 ? o[0] : `${o[0]} ${i}`, category: o[1] });
  });
  const type = ROOM_HINTS.find(([, ks]) => ks.some((k) => counts.has(k)))?.[0];
  return {
    summary: { walls: pick("walls").length, doors: pick("doors").length, windows: pick("windows").length, openings: pick("openings").length,
      objects: keys.length, floor_area_m2: area > 0 ? Math.round(area * 10) / 10 : undefined },
    suggested: { type, items },
  };
}
