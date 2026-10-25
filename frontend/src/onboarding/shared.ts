import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api, ApiError, BACKEND, errorText, getToken } from "@/src/api";
import { uploadForm } from "@/src/utils/upload";
import type { IconName } from "@/src/ui";

export type Frame = { path: string; url: string };
export type Suggestion = { name: string; category: string; brand?: string | null };
export type Item = {
  id: string; room_id: string; name: string; category: string; brand?: string | null; model?: string | null; notes?: string;
  photo_url?: string | null; position?: any; frame_point?: { x: number; y: number } | null; source: "ar" | "photo" | "manual";
};
export type Room = {
  id: string; type: string; label: string; status: "in_progress" | "complete"; items: Item[];
  scan_data: { frames?: Frame[]; geometry?: any; ar?: any; suggested?: { type?: string; items: Suggestion[]; source?: "photo" | "scan" } };
};
export type OnboardingState = { property: any | null; rooms: Room[]; completed_rooms: number; can_finish: boolean; complete: boolean; skipped: boolean };
export type ItemDraft = Partial<Item> & { room_id: string };

export const ROOM_TYPES: { type: string; label: string; icon: IconName }[] = [
  { type: "kitchen", label: "Kitchen", icon: "cooking-pot" },
  { type: "living room", label: "Living room", icon: "sofa" },
  { type: "bedroom", label: "Bedroom", icon: "bed-double" },
  { type: "bathroom", label: "Bathroom", icon: "bath" },
  { type: "dining room", label: "Dining room", icon: "utensils" },
  { type: "laundry", label: "Laundry", icon: "washing-machine" },
  { type: "garage", label: "Garage", icon: "warehouse" },
  { type: "office", label: "Office", icon: "lamp-desk" },
  { type: "basement", label: "Basement", icon: "archive" },
  { type: "hallway", label: "Hallway", icon: "door-open" },
  { type: "outdoor", label: "Outdoor", icon: "trees" },
  { type: "other", label: "Other", icon: "layout-grid" },
];

export const roomMeta = (type: string) => ROOM_TYPES.find((r) => r.type === type) ?? { type, label: type.charAt(0).toUpperCase() + type.slice(1), icon: "layout-grid" as IconName };
export const roomTitle = (r: Pick<Room, "type" | "label">) => r.label || roomMeta(r.type).label;

export const CATEGORIES = [
  { key: "appliance", label: "Appliance", icon: "plug-zap" as IconName },
  { key: "fixture", label: "Fixture", icon: "lightbulb" as IconName },
  { key: "other", label: "Other", icon: "box" as IconName },
];

// Quick-tag names for each room; the category is picked automatically.
const FIXTURES = new Set(["Sink", "Toilet", "Shower", "Bathtub", "Fireplace", "Ceiling fan", "Smoke alarm", "Thermostat", "Light fixture", "Exhaust fan", "Sprinklers", "Electrical panel", "Utility sink", "Outlet", "Range hood"]);
const PRESETS: Record<string, string[]> = {
  kitchen: ["Refrigerator", "Stove", "Oven", "Dishwasher", "Microwave", "Sink", "Range hood", "Garbage disposal"],
  bathroom: ["Toilet", "Shower", "Bathtub", "Sink", "Exhaust fan", "Water heater"],
  laundry: ["Washer", "Dryer", "Water heater", "Utility sink"],
  "living room": ["Television", "Fireplace", "Thermostat", "Ceiling fan", "Smoke alarm", "AC unit"],
  bedroom: ["Ceiling fan", "AC unit", "Smoke alarm", "Television", "Light fixture"],
  "dining room": ["Light fixture", "Ceiling fan", "Thermostat"],
  garage: ["Water heater", "Furnace", "Garage door opener", "Electrical panel"],
  basement: ["Furnace", "Water heater", "Sump pump", "Electrical panel"],
  outdoor: ["Hot tub", "Pool pump", "Grill", "Sprinklers", "AC unit"],
  office: ["Light fixture", "Ceiling fan", "Outlet"],
};
export const presetsFor = (type: string) => (PRESETS[type] ?? ["Smoke alarm", "Thermostat", "Light fixture", "Outlet"]).map((name) => ({ name, category: categoryOf(name) }));
export const categoryOf = (name: string) => (FIXTURES.has(name) ? "fixture" : "appliance");

const ICONS: [RegExp, IconName][] = [
  [/fridge|refrigerator|freezer/i, "refrigerator"], [/microwave/i, "microwave"], [/tv|television/i, "tv"],
  [/fireplace/i, "flame-kindling"], [/stove|oven|range|grill|cooktop/i, "flame"], [/ceiling fan|exhaust fan|\bfan\b/i, "fan"],
  [/washer|dryer|washing/i, "washing-machine"], [/toilet/i, "toilet"], [/shower/i, "shower-head"], [/bath|tub/i, "bath"],
  [/hot tub|pool|spa/i, "waves"], [/sink|faucet|disposal|sump|sprinkler/i, "droplets"], [/thermostat/i, "thermometer"],
  [/smoke|alarm|detector/i, "siren"], [/water heater|furnace|heater|boiler/i, "heater"], [/\bac\b|hvac|air|vent/i, "air-vent"],
  [/light|lamp|bulb/i, "lightbulb"], [/outlet|panel|electric/i, "plug-zap"],
];
export const itemIcon = (name: string, category?: string): IconName =>
  ICONS.find(([re]) => re.test(name))?.[1] ?? (CATEGORIES.find((c) => c.key === category)?.icon || "box");

// Drop suggestions the host already tagged (or already has in the list).
export function mergeSuggestions(current: Suggestion[], incoming: Suggestion[], items: Item[]) {
  const seen = new Set([...current, ...items].map((s) => s.name.trim().toLowerCase()));
  const out = [...current];
  for (const s of incoming) {
    const k = s.name.trim().toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out.slice(0, 10);
}

// ---------- Uploads (Emergent object storage via /api/upload) ----------
export async function uploadFile(uri: string, name: string, mimeType: string): Promise<Frame> {
  const t = getToken();
  let res: any;
  try {
    res = await uploadForm(`${BACKEND}/api/upload`, { files: { file: { uri, name, mimeType } }, headers: t ? { Authorization: `Bearer ${t}` } : undefined });
  } catch {
    throw new ApiError(0, "Upload failed. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? "Couldn't save that file. Try again.");
  return data as Frame;
}

// JPEG, at most 1280px wide (never enlarged).
export async function uploadPhoto(uri: string): Promise<Frame> {
  const ctx = ImageManipulator.manipulate(uri);
  let img = await ctx.renderAsync();
  if (img.width > 1280) img = await ctx.resize({ width: 1280 }).renderAsync();
  const r = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return uploadFile(r.uri, "photo.jpg", "image/jpeg");
}

// ---------- State ----------
export function useOnboarding() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setState(await api<OnboardingState>("/onboarding")); setError(""); } catch (e) { setError(errorText(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { state, error, load };
}

export const sqft = (m2: number) => Math.round(m2 * 10.7639);
