import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { api, errorText } from "@/src/api";
import { uploadPhoto } from "@/src/onboarding/shared";
import { useAfterDismiss, useCameraGate } from "@/src/onboarding/useCameraGate";
import { toast } from "@/src/toast";
import { Btn, Sheet, T } from "@/src/ui";

type Target = { id: string; name: string; cover_photo?: string | null };
const PICK = { mediaTypes: ["images"] as ImagePicker.MediaType[], allowsEditing: true, aspect: [16, 9] as [number, number], quality: 0.85 };

// "Change cover" for a rental: camera, photo library, or back to the house drawing.
export function useCoverPicker(onSaved: () => void) {
  const [target, setTarget] = useState<Target | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const after = useAfterDismiss();
  const camera = useCameraGate();

  const save = async (p: Target, photo: string | null) => {
    setBusyId(p.id);
    try {
      await api(`/properties/${p.id}/cover`, { method: "PUT", body: { photo } });
      toast.success(photo ? `New cover for ${p.name}.` : `${p.name} is back to its house drawing.`);
      onSaved();
    } catch (e) { toast.error(errorText(e)); } finally { setBusyId(null); }
  };

  const applyAsset = async (p: Target, r: ImagePicker.ImagePickerResult) => {
    if (r.canceled || !r.assets[0]) return;
    setBusyId(p.id);
    try {
      const f = await uploadPhoto(r.assets[0].uri);
      await save(p, f.url);
    } catch (e) { toast.error(errorText(e)); setBusyId(null); }
  };

  const choose = (how: "camera" | "library" | "remove") => {
    const p = target!;
    setTarget(null);
    if (how === "remove") return save(p, null);
    after.queue(() => {
      if (how === "library") ImagePicker.launchImageLibraryAsync(PICK).then((r) => applyAsset(p, r)).catch(() => toast.error("That photo didn't load. Try another."));
      else camera.ensure(() => { ImagePicker.launchCameraAsync(PICK).then((r) => applyAsset(p, r)).catch(() => toast.error("The camera didn't open. Try again.")); },
        "Bullpen uses your camera to take a cover photo of your rental.");
    });
  };

  const sheet = (
    <>
      <Sheet open={!!target} onClose={() => setTarget(null)} onDismiss={after.onDismiss} title="Cover photo" sub={target?.name} testID="cover-sheet">
        <T muted>A photo of the outside makes each rental easy to spot on the Bench and in Snap.</T>
        <Btn label="Take a photo" icon="camera" onPress={() => choose("camera")} testID="cover-camera-button" />
        <Btn label="Choose from your photos" icon="image" variant="secondary" onPress={() => choose("library")} testID="cover-library-button" />
        {!!target?.cover_photo && <Btn label="Use the house drawing" icon="house" variant="secondary" onPress={() => choose("remove")} testID="cover-remove-button" />}
      </Sheet>
      {camera.sheet}
    </>
  );

  return { open: setTarget, sheet, busyId };
}
