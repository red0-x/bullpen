"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, ImageUp, PenLine, RotateCcw, Sparkles } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { URGENCY, fileToJpeg } from "@/lib/image";
import { Mascot } from "@/components/Mascot";
import { EmptyState } from "@/components/EmptyState";
import { LiveCamera } from "@/components/broke/LiveCamera";
import { FixGuide } from "@/components/broke/FixGuide";
import { DirectoryCard } from "@/components/broke/DirectoryCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const LAST = "bullpup:lastProperty";

function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 4000 });
  });
}

function autoFill(g, props) {
  const remembered = typeof window !== "undefined" ? localStorage.getItem(LAST) : null;
  const property_id = g.property_id || (props.some((p) => p.id === remembered) ? remembered : props[0]?.id);
  const prop = props.find((p) => p.id === property_id);
  const amenity = prop?.amenities.find((a) => a.id === g.amenity_id) || prop?.amenities.find((a) => a.trade === g.trade);
  return { ...g, property_id, amenity_id: amenity?.id || null, urgency: g.urgency || "this_week" };
}

function Capture({ onPhoto, onText, autoCamera }) {
  const [live, setLive] = useState(autoCamera);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const up = useRef(null);
  const native = useRef(null);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { onPhoto(await fileToJpeg(f)); } catch { toast.error("That photo didn't load. Try another."); }
  };
  return (
    <div className="flex flex-col items-center text-center gap-6 py-6" data-testid="snap-capture">
      <Mascot pose="camera" className="w-40 h-40 sm:w-52 sm:h-52" />
      <div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl">Something broke?</h1>
        <p className="mt-3 text-base md:text-lg text-cocoa max-w-md">Take a picture. Bullpup works out what&apos;s wrong, how to fix it and who to call.</p>
      </div>
      <button className="btn btn-primary text-xl px-10 min-h-[72px] rounded-[24px]" onClick={() => setLive(true)} data-testid="snap-take-picture-button">
        <Camera size={26} /> Take a picture
      </button>
      <div className="flex flex-wrap justify-center gap-3">
        <button className="btn btn-secondary" onClick={() => up.current?.click()} data-testid="snap-upload-button"><ImageUp size={18} /> Upload a photo</button>
        <button className="btn btn-secondary" onClick={() => setTyping(!typing)} data-testid="snap-type-button"><PenLine size={18} /> Describe it instead</button>
      </div>
      {typing && (
        <div className="card p-4 w-full max-w-lg flex flex-col gap-3 text-left">
          <textarea className="field !py-2.5 min-h-[90px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Hot tub at Tahoe won't heat. Guests arrive Friday 4pm." data-testid="snap-text-input" />
          <button className="btn btn-primary" disabled={!text.trim()} onClick={() => onText(text)} data-testid="snap-text-go-button">Find help</button>
        </div>
      )}
      <LiveCamera open={live} onClose={() => setLive(false)} onCapture={onPhoto} onUnavailable={() => { setLive(false); native.current?.click(); }} />
      <input ref={up} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="snap-upload-input" />
      <input ref={native} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} data-testid="snap-camera-input" />
    </div>
  );
}

function Summary({ d, props, trades, setD }) {
  const [edit, setEdit] = useState(false);
  const prop = props.find((p) => p.id === d.property_id);
  const amenity = prop?.amenities.find((a) => a.id === d.amenity_id);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="snap-summary">
      <span className="badge badge-ready !text-sm" data-testid="snap-trade">{d.trade}</span>
      <span className="badge badge-neutral !text-sm" data-testid="snap-property">{amenity ? `${amenity.label} · ` : ""}{prop?.name}</span>
      <span className="badge badge-warn !text-sm" data-testid="snap-urgency">{URGENCY[d.urgency]}</span>
      <button className="btn-link text-sm !min-h-[32px]" onClick={() => setEdit(!edit)} data-testid="snap-change-button">{edit ? "Done" : "Wrong? Change"}</button>
      {edit && (
        <div className="w-full grid sm:grid-cols-3 gap-2 mt-1">
          <select className="field" value={d.trade} onChange={(e) => setD({ ...d, trade: e.target.value, amenity_id: prop?.amenities.find((a) => a.trade === e.target.value)?.id || null })} data-testid="snap-trade-select">
            {trades.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className="field" value={d.property_id} onChange={(e) => setD(autoFill({ ...d, property_id: e.target.value, amenity_id: null }, props))} data-testid="snap-property-select">
            {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="field" value={d.urgency} onChange={(e) => setD({ ...d, urgency: e.target.value })} data-testid="snap-urgency-select">
            {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function SnapFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [props, setProps] = useState(null);
  const [trades, setTrades] = useState([]);
  const [step, setStep] = useState("capture");
  const [input, setInput] = useState({ photo: null, note: "" });
  const [d, setD] = useState(null);
  const [notice, setNotice] = useState("");
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(null);
  const geo = useRef(null);

  useEffect(() => {
    Promise.all([api.get("/properties"), api.get("/trades")]).then(([p, t]) => { setProps(p.data); setTrades(t.data); }).catch((e) => toast.error(errorText(e)));
    locate().then((g) => { geo.current = g; });
  }, []);

  useEffect(() => {
    if (d?.trade) {
      setList(null);
      api.get("/directory", { params: { trade: d.trade, ...(geo.current || {}) } }).then((r) => setList(r.data.results)).catch(() => setList([]));
    }
  }, [d?.trade]);

  const run = async (photo, note) => {
    setInput({ photo, note });
    setStep("thinking");
    setNotice("");
    try {
      const { data } = await api.post("/issues/diagnose", { photo_base64: photo?.base64 || null, note }, { timeout: 60000 });
      if (!data.ok || !data.draft.trade) {
        setNotice(data.ok ? "We couldn't tell from the photo. Try another angle, closer to the problem, or describe it." : data.message);
        return setStep("retry");
      }
      if (data.draft.is_rental_issue === false) setNotice("This doesn't look like part of your rental, but here's how to handle it and who could help.");
      else if (!data.draft.can_tell) setNotice("We weren't fully sure from the photo, so this is our best guess. A closer photo helps.");
      setD(autoFill({ ...data.draft, diagnosis: data.draft.diagnosis || note }, props));
      setStep("results");
    } catch {
      setNotice("Couldn't read that right now. Try again, or describe it instead.");
      setStep("retry");
    }
  };

  const track = async (force) => {
    if (!force && d.amenity_id) {
      const { data } = await api.get("/issues/open-for", { params: { amenity_id: d.amenity_id } }).catch(() => ({ data: {} }));
      if (data.issue) return setExisting(data.issue);
    }
    setBusy(true);
    try {
      const { data } = await api.post("/issues", {
        property_id: d.property_id, amenity_id: d.amenity_id, trade_needed: d.trade, urgency: d.urgency, host_note: input.note,
        ai_diagnosis: d.diagnosis, fix_steps: d.fix_steps || [], safety_note: d.safety_note || null, diy: d.diy || null,
        guest_arrival: d.guest_arrival ? new Date(d.guest_arrival).toISOString() : null, photo_base64: input.photo?.base64 || null,
      }, { timeout: 30000 });
      localStorage.setItem(LAST, d.property_id);
      router.push(`/issue/?id=${data.id}`);
    } catch (e) {
      toast.error(errorText(e));
      setBusy(false);
    }
  };

  const addToExisting = async () => {
    setBusy(true);
    try {
      await api.post(`/issues/${existing.id}/add`, { note: d.diagnosis || input.note, photo_base64: input.photo?.base64 || null });
      router.push(`/issue/?id=${existing.id}`);
    } catch (e) {
      toast.error(errorText(e));
      setBusy(false);
    }
  };

  const textBiz = (b) => {
    const prop = props.find((p) => p.id === d.property_id);
    const msg = `Hi ${b.business_name}, I host a rental (${prop?.name}). ${d.diagnosis} Could you help? Urgency: ${URGENCY[d.urgency]}.`;
    window.location.href = `sms:${b.phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(msg)}`;
  };

  if (props?.length === 0) {
    return <EmptyState pose="sniff" motion="sniff" testId="broke-no-properties" title="Add a property first" body="Bullpup needs your rentals to file the fix."><Link href="/properties/" className="btn btn-primary">Go to properties</Link></EmptyState>;
  }
  if (step === "capture" && !props) return <div className="card h-64 animate-pulse" data-testid="snap-loading" />;
  if (step === "capture") return <Capture autoCamera={params.get("camera") === "1"} onPhoto={(p) => run(p, "")} onText={(t) => run(null, t)} />;
  if (step === "thinking") {
    return (
      <div className="card py-14 flex flex-col items-center text-center" data-testid="diagnose-thinking">
        {input.photo && <img src={input.photo.dataUrl} alt="Your photo" className="h-40 rounded-[16px] object-cover mb-4" />}
        <Mascot pose="sniff" motion="sniff" className="w-40 h-36" />
        <p className="mt-4 font-head text-2xl">Sniffing it out…</p>
        <p className="text-cocoa text-sm mt-1">Finding what&apos;s wrong and the best people nearby.</p>
      </div>
    );
  }
  if (step === "retry") {
    return (
      <div className="flex flex-col gap-4" data-testid="snap-retry">
        <p className="rounded-[16px] bg-blush p-4 text-blush-ink font-semibold" data-testid="snap-notice">{notice}</p>
        <Capture onPhoto={(p) => run(p, "")} onText={(t) => run(null, t)} />
      </div>
    );
  }
  return (
    <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-6" data-testid="snap-results">
      <div className="flex flex-col gap-4">
        <div className="card p-5 flex flex-col gap-4">
          {input.photo && <img src={input.photo.dataUrl} alt="Your photo" className="w-full max-h-72 object-contain rounded-[16px] bg-cream" data-testid="snap-photo" />}
          {notice && <p className="rounded-[12px] bg-blush p-3 text-sm text-blush-ink font-semibold" data-testid="snap-notice">{notice}</p>}
          <div>
            <p className="text-sm font-semibold text-cocoa flex items-center gap-1"><Sparkles size={14} /> What&apos;s wrong</p>
            <p className="mt-1 text-lg text-espresso" data-testid="snap-diagnosis">{d.diagnosis || `Looks like a ${d.trade.toLowerCase()} job. Add a closer photo for a sharper read.`}</p>
          </div>
          <Summary d={d} props={props} trades={trades} setD={setD} />
          <FixGuide steps={d.fix_steps || []} safety={d.safety_note} diy={d.diy} testId="snap-fix-guide" />
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={() => track(false)} disabled={busy} data-testid="snap-track-button">{busy ? "Saving…" : "Track this & see my bench"}</button>
            <button className="btn btn-secondary" onClick={() => setStep("capture")} data-testid="snap-retake-button"><RotateCcw size={16} /> New photo</button>
          </div>
        </div>
      </div>
      <section className="flex flex-col gap-3" data-testid="snap-directory">
        <div>
          <h2 className="text-2xl sm:text-3xl">Best {d.trade.toLowerCase()} pros near San Francisco</h2>
          <p className="text-sm text-cocoa">Ranked by reviews, distance and reply speed. <span className="badge badge-warn">Sample listings</span></p>
        </div>
        {list === null && <div className="card h-40 animate-pulse" />}
        {list?.length === 0 && <p className="card p-4 text-cocoa">No listings for this trade yet.</p>}
        {list?.map((b) => <DirectoryCard key={b.id} b={b} cities={props.map((p) => p.city)} onRequest={textBiz} />)}
      </section>
      <ConfirmDialog open={!!existing} onOpenChange={(o) => !o && setExisting(null)}
        title={`There's already an open ${d.trade.toLowerCase()} issue there. Add to it?`}
        body={existing ? `"${existing.ai_diagnosis || existing.host_note || "Open issue"}" is still open.` : ""}
        confirmLabel="Add to it" onConfirm={addToExisting} busy={busy}
        secondaryLabel="Start a new one" onSecondary={() => { setExisting(null); track(true); }} />
    </div>
  );
}

export default function SomethingBrokePage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <SnapFlow />
    </Suspense>
  );
}
