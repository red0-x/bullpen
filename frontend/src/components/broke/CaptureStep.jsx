"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, PenLine, X } from "lucide-react";
import { fileToJpeg } from "@/lib/image";
import { Mascot } from "@/components/Mascot";
import { LiveCamera } from "./LiveCamera";

export function CaptureStep({ value, onChange, onSubmit, busy }) {
  const camRef = useRef(null);
  const upRef = useRef(null);
  const [photoErr, setPhotoErr] = useState("");
  const [live, setLive] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });
  const openCamera = () => setLive(true);
  const nativeCamera = () => camRef.current?.click();

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoErr("");
    try {
      set({ photo: await fileToJpeg(file) });
    } catch {
      setPhotoErr("That photo didn't load. Try another, or type what broke instead.");
    }
  };

  const canGo = value.photo || value.note.trim();
  return (
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6" data-testid="capture-step">
      <div className="card p-5 sm:p-6">
        {value.photo ? (
          <div className="relative">
            <img src={value.photo.dataUrl} alt="Your photo of what broke" className="w-full max-h-[420px] object-contain rounded-[16px] bg-cream" data-testid="capture-photo-preview" />
            <button className="btn btn-secondary absolute top-3 right-3 px-3" onClick={() => set({ photo: null })} aria-label="Remove photo" data-testid="capture-remove-photo-button">
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={openCamera}
            className="w-full rounded-[16px] border-[2px] border-dashed border-line bg-cream/70 hover:bg-cream transition-colors duration-150 flex flex-col items-center justify-center gap-3 py-10 px-4"
            data-testid="capture-camera-dropzone"
          >
            <Mascot pose="camera" className="w-32 h-32 sm:w-40 sm:h-40" />
            <span className="font-head text-2xl text-espresso">Snap a photo</span>
            <span className="text-sm text-cocoa">Opens your camera on a phone or computer. Get the damage in frame.</span>
          </button>
        )}
        <LiveCamera open={live} onClose={() => setLive(false)} onCapture={(photo) => set({ photo })} onUnavailable={() => { setLive(false); nativeCamera(); }} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} data-testid="capture-camera-input" />
        <input ref={upRef} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="capture-upload-input" />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-secondary" onClick={openCamera} data-testid="capture-take-photo-button">
            <Camera size={18} /> {value.photo ? "Retake" : "Take photo"}
          </button>
          <button className="btn btn-secondary" onClick={() => upRef.current?.click()} data-testid="capture-upload-button">
            <ImageUp size={18} /> Upload
          </button>
        </div>
        {photoErr && <p className="mt-3 badge badge-warn !rounded-field !text-sm !py-2 whitespace-normal" data-testid="capture-photo-error">{photoErr}</p>}
      </div>

      <div className="card p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-espresso">
          <PenLine size={18} aria-hidden />
          <h2 className="text-xl">{value.photo ? "Anything to add?" : "No photo? Type what broke"}</h2>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Note (optional with a photo)
          <textarea
            className="field !py-2.5 min-h-[120px] resize-y"
            placeholder="Hot tub won't heat. Guests arrive Friday 4pm."
            value={value.note}
            maxLength={1000}
            onChange={(e) => set({ note: e.target.value })}
            data-testid="capture-note-input"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Guests arrive (optional)
          <input type="datetime-local" className="field" value={value.arrival} onChange={(e) => set({ arrival: e.target.value })} data-testid="capture-arrival-input" />
        </label>
        <button className="btn btn-primary mt-auto" disabled={!canGo || busy} onClick={onSubmit} data-testid="capture-diagnose-button">
          {busy ? "Sniffing it out…" : "Work out what's wrong"}
        </button>
        {!canGo && <p className="text-xs text-cocoa -mt-2">Add a photo or a note to continue.</p>}
      </div>
    </div>
  );
}
