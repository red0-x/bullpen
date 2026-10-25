"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Camera, RefreshCw, X } from "lucide-react";

const MESSAGES = {
  NotAllowedError: "Camera access was blocked. Allow it in your browser settings, or upload a photo instead.",
  NotFoundError: "We couldn't find a camera on this device. Upload a photo instead.",
  NotReadableError: "Another app is using the camera. Close it and try again, or upload a photo.",
};

export function LiveCamera({ open, onClose, onCapture, onUnavailable }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [facing, setFacing] = useState("environment");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailable?.();
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        video.current.srcObject = s;
        video.current.play().catch(() => {});
      })
      .catch((e) => setErr(MESSAGES[e.name] || "The camera didn't start. Upload a photo instead."));
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, stop, onUnavailable]);

  const snap = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setFlash(true);
    setTimeout(() => {
      setFlash(false);
      onCapture({ dataUrl, base64: dataUrl.split(",")[1] });
      onClose();
    }, 180);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-espresso/80" />
        <Dialog.Content className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 sm:w-[min(92vw,860px)] bg-espresso sm:rounded-card overflow-hidden flex flex-col" data-testid="live-camera">
          <Dialog.Title className="sr-only">Take a photo</Dialog.Title>
          <Dialog.Description className="sr-only">Point the camera at what broke and tap the shutter.</Dialog.Description>
          <div className="relative flex-1 sm:flex-none sm:aspect-video bg-black grid place-items-center">
            <video ref={video} playsInline muted onLoadedData={() => setReady(true)} className="w-full h-full object-contain" data-testid="live-camera-video" />
            {flash && <div className="absolute inset-0 bg-white" />}
            {!ready && !err && <p className="absolute text-cream font-semibold">Starting camera…</p>}
            {err && (
              <div className="absolute inset-x-6 text-center" data-testid="live-camera-error">
                <p className="text-cream font-semibold">{err}</p>
                <button className="btn btn-secondary mt-4" onClick={() => { onClose(); onUnavailable?.(); }} data-testid="live-camera-upload-instead-button">Upload a photo</button>
              </div>
            )}
            <Dialog.Close className="absolute top-3 right-3 btn btn-secondary px-3" aria-label="Close camera" data-testid="live-camera-close-button"><X size={18} /></Dialog.Close>
          </div>
          <div className="flex items-center justify-center gap-6 p-5">
            <button className="btn btn-secondary px-3" onClick={() => setFacing(facing === "environment" ? "user" : "environment")} aria-label="Switch camera" data-testid="live-camera-switch-button">
              <RefreshCw size={18} />
            </button>
            <button onClick={snap} disabled={!ready} aria-label="Take photo" data-testid="live-camera-snap-button"
              className="h-[72px] w-[72px] rounded-full bg-cream border-[5px] border-[#E8D9C6] grid place-items-center active:scale-90 transition-transform duration-100 disabled:opacity-50">
              <Camera size={28} className="text-cap" />
            </button>
            <span className="w-[46px]" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
