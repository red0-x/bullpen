"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, MicOff, Send, X } from "lucide-react";
import { api } from "@/lib/api";

const ROUTES = { camera: "/something-broke/?camera=1", fixit: "/fix-it/", bench: "/bench/", properties: "/properties/" };

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

export function VoiceAgent() {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([{ role: "assistant", text: "Hi! Tell me what broke, or ask what needs you today." }]);
  const rec = useRef(null);
  const end = useRef(null);
  const supported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  const ask = async (message) => {
    if (!message.trim()) return;
    const history = [...msgs, { role: "user", text: message }];
    setMsgs(history);
    setText("");
    setBusy(true);
    try {
      const { data } = await api.post("/voice/ask", { message, history: history.slice(-8), page: path }, { timeout: 45000 });
      setMsgs((m) => [...m, { role: "assistant", text: data.reply }]);
      speak(data.reply);
      const to = data.action === "issue" && data.issue_id ? `/issue/?id=${data.issue_id}` : ROUTES[data.action];
      if (to) setTimeout(() => router.push(to), 900);
    } catch {
      const fallback = "I couldn't answer right now. Tap Something broke to snap a photo instead.";
      setMsgs((m) => [...m, { role: "assistant", text: fallback }]);
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    if (listening) return rec.current?.stop();
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new R();
    r.lang = "en-US";
    r.interimResults = true;
    r.onresult = (e) => {
      const t = Array.from(e.results).map((x) => x[0].transcript).join("");
      setText(t);
      if (e.results[e.results.length - 1].isFinal) ask(t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <>
      {open && (
        <div className="fixed z-40 bottom-24 right-3 sm:right-6 w-[calc(100%-1.5rem)] max-w-sm card flex flex-col max-h-[55vh] sm:max-h-[70vh]" data-testid="voice-panel">
          <div className="flex items-center gap-2 p-3 border-b-[1.5px] border-line">
            <img src="/mascot/pup-head.webp" alt="" className="h-9 w-9 rounded-lg border-[1.5px] border-line" />
            <p className="font-head text-lg flex-1">Talk to Bullpup</p>
            <button className="btn btn-secondary px-2 !min-h-[40px]" onClick={() => { setOpen(false); window.speechSynthesis?.cancel(); }} aria-label="Close" data-testid="voice-close-button"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2" data-testid="voice-messages">
            {msgs.map((m, i) => (
              <p key={i} className={`max-w-[85%] rounded-[16px] px-3 py-2 text-sm ${m.role === "user" ? "self-end bg-espresso text-white" : "self-start bg-cream border-[1.5px] border-line"}`}>{m.text}</p>
            ))}
            {busy && <p className="self-start text-sm text-cocoa" data-testid="voice-thinking">Thinking…</p>}
            <span ref={end} />
          </div>
          <form className="p-3 border-t-[1.5px] border-line flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            {supported && (
              <button type="button" onClick={listen} className={`btn px-3 ${listening ? "btn-primary animate-pulse" : "btn-secondary"}`} aria-label={listening ? "Stop listening" : "Speak"} data-testid="voice-mic-button">
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? "Listening…" : "Type or tap the mic"} data-testid="voice-text-input" />
            <button className="btn btn-secondary px-3" disabled={busy || !text.trim()} aria-label="Send" data-testid="voice-send-button"><Send size={18} /></button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-label="Talk to Bullpup" data-testid="voice-launcher-button"
        className="fixed z-40 bottom-5 right-3 sm:right-6 h-16 w-16 rounded-full bg-white border-[1.5px] border-line grid place-items-center hover:scale-105 transition-transform duration-150"
        style={{ boxShadow: "0 4px 0 0 #E8D9C6" }}>
        <img src="/mascot/pup-head.webp" alt="" className="h-12 w-12 rounded-full" />
        <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-cap text-white grid place-items-center"><Mic size={13} /></span>
      </button>
    </>
  );
}
