import { useState } from "react";
import { Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { toast } from "@/src/toast";
import { Btn, Sheet, T } from "@/src/ui";

type Pending = { mode: "explain" | "blocked"; then: () => void; why: string };

// Camera permission flow shared by photos, walkthrough video and AR scans:
// check first, explain before the system prompt, and send to Settings once it's blocked.
export function useCameraGate(onFallback?: () => void) {
  const [p, setP] = useState<Pending | null>(null);

  const ensure = async (then: () => void, why: string) => {
    try {
      const cur = await ImagePicker.getCameraPermissionsAsync();
      if (cur.granted) return then();
      setP({ mode: cur.canAskAgain ? "explain" : "blocked", then, why });
    } catch {
      toast.error("The camera isn't available here. Upload photos instead.");
    }
  };

  const allow = async () => {
    if (!p) return;
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (res.granted) { setP(null); p.then(); } else setP({ ...p, mode: res.canAskAgain ? "explain" : "blocked" });
  };

  const sheet = (
    <Sheet open={!!p} onClose={() => setP(null)} title={p?.mode === "blocked" ? "Camera is turned off" : "Use your camera"} testID="onboarding-camera-sheet">
      <T muted>{p?.mode === "blocked" ? "Turn the camera on for Bullpen in Settings, or upload photos you already have." : p?.why}</T>
      {p?.mode === "blocked"
        ? <Btn label="Open Settings" icon="settings" onPress={() => { setP(null); Linking.openSettings(); }} testID="onboarding-camera-settings-button" />
        : <Btn label="Allow camera" icon="camera" onPress={allow} testID="onboarding-camera-allow-button" />}
      {onFallback && <Btn label="Upload photos instead" variant="secondary" onPress={() => { setP(null); onFallback(); }} testID="onboarding-camera-upload-button" />}
    </Sheet>
  );

  return { ensure, sheet };
}
