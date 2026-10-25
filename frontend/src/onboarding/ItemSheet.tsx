import { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { api, errorText, photoSource } from "@/src/api";
import { CATEGORIES, ItemDraft, presetsFor } from "@/src/onboarding/shared";
import { Badge, Btn, Chip, ChipWrap, Field, Notice, Sheet, T } from "@/src/ui";

const EMPTY = { name: "", category: "appliance", brand: "", model: "", notes: "" };

// Add or edit one tagged appliance / fixture.
export function ItemSheet({ draft, roomType, roomName, onClose, onSaved }: { draft: ItemDraft | null; roomType: string; roomName?: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState<"" | "save" | "delete">("");
  const [error, setError] = useState("");
  const editing = !!draft?.id;

  useEffect(() => {
    if (!draft) return;
    setError("");
    setF({ name: draft.name || "", category: draft.category || "appliance", brand: draft.brand || "", model: draft.model || "", notes: draft.notes || "" });
  }, [draft]);

  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const done = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onSaved(); onClose(); };

  const save = async () => {
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      const body = { name: f.name.trim(), category: f.category, brand: f.brand, model: f.model, notes: f.notes };
      if (editing) await api(`/onboarding/items/${draft.id}`, { method: "PATCH", body });
      else await api(`/onboarding/rooms/${draft.room_id}/items`, { method: "POST", body: {
        ...body, photo_url: draft.photo_url || null, frame_point: draft.frame_point || null, position: draft.position || null, source: draft.source || "manual",
      } });
      done();
    } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };

  const remove = async () => {
    if (!draft?.id) return;
    setBusy("delete");
    try { await api(`/onboarding/items/${draft.id}`, { method: "DELETE" }); done(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };

  return (
    <Sheet open={!!draft} onClose={onClose} title={editing ? "Edit item" : "Tag an item"} sub={roomName} testID="item-sheet">
      {!!draft?.photo_url && (
        <View style={{ gap: 6 }}>
          <Image source={photoSource(draft.photo_url)} style={{ width: "100%", height: 150, borderRadius: 14 }} contentFit="cover" testID="item-sheet-photo" />
          <Badge icon={draft.source === "ar" ? "scan-line" : "image"} label={draft.source === "ar" ? "Placed in AR" : "Tagged on a photo"} />
        </View>
      )}
      {!editing && (
        <View style={{ gap: 8 }}>
          <T size={14} weight="semi">Quick pick</T>
          <ChipWrap testID="item-sheet-presets">
            {presetsFor(roomType).map((p) => (
              <Chip key={p.name} label={p.name} on={f.name === p.name} onPress={() => setF((x) => ({ ...x, name: p.name, category: p.category }))}
                testID={`item-preset-${p.name.replace(/\W+/g, "-").toLowerCase()}`} />
            ))}
          </ChipWrap>
        </View>
      )}
      <Field label="What is it?" value={f.name} onChangeText={set("name")} placeholder="Water heater" maxLength={80} testID="item-name-input" />
      <View style={{ gap: 8 }}>
        <T size={14} weight="semi">Type</T>
        <ChipWrap testID="item-category-select">
          {CATEGORIES.map((c) => <Chip key={c.key} label={c.label} on={f.category === c.key} onPress={() => set("category")(c.key)} testID={`item-category-${c.key}`} />)}
        </ChipWrap>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Brand" value={f.brand} onChangeText={set("brand")} placeholder="Optional" maxLength={80} testID="item-brand-input" /></View>
        <View style={{ flex: 1 }}><Field label="Model" value={f.model} onChangeText={set("model")} placeholder="Optional" maxLength={80} testID="item-model-input" /></View>
      </View>
      <Field label="Notes" value={f.notes} onChangeText={set("notes")} placeholder="Installed 2021, filter under the sink…" multiline maxLength={500} testID="item-notes-input" />
      {!!error && <Notice testID="item-sheet-error">{error}</Notice>}
      <Btn label={editing ? "Save changes" : "Tag it"} icon="check" busy={busy === "save"} disabled={!f.name.trim() || !!busy} onPress={save} testID="item-save-button" />
      {editing && <Btn label="Remove item" icon="trash-2" variant="secondary" busy={busy === "delete"} disabled={!!busy} onPress={remove} testID="item-delete-button" />}
    </Sheet>
  );
}
