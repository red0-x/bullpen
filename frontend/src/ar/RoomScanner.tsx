// Web (and any platform without a native AR module): no AR, the room screen offers photos instead.
import type { ArSupport, ScannerProps } from "./types";

export async function getArSupport(): Promise<ArSupport> {
  return { roomplan: false, xr: false };
}

export function RoomScanner(_: ScannerProps) {
  return null;
}
