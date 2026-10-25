// Android: ARCore through munim-xr (plane mapping + tagging appliances in AR).
import { Modal } from "react-native";
import { XRTagger, xrSupport } from "./XRTagger";
import type { ArSupport, ScannerProps } from "./types";

export async function getArSupport(): Promise<ArSupport> {
  return { roomplan: false, xr: await xrSupport() };
}

export function RoomScanner(p: ScannerProps) {
  return (
    <Modal visible={p.open} animationType="slide" onRequestClose={() => p.onClose()} statusBarTranslucent>
      {p.open && <XRTagger {...p} />}
    </Modal>
  );
}
