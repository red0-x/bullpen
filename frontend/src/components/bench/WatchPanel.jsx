"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Radar } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { fmtWhen } from "@/lib/image";

const SIG = {
  response_time: ["Reply time", (v) => `${Math.round(v / 6) / 10} h`],
  public_rating: ["Public rating", (v) => `${v} stars`],
  business_open: ["Business open", (v) => (v === "yes" ? "Open" : "Closed")],
  phone_working: ["Phone", (v) => (v === "yes" ? "Working" : "Disconnected")],
  license_status: ["License", (v) => v],
};
const BAD = (t, v) => (t === "business_open" || t === "phone_working" ? v !== "yes" : t === "license_status" ? v !== "active" : t === "response_time" ? +v >= 240 : false);

export function WatchPanel({ onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState(null);

  const load = useCallback(() => api.get("/watch").then((r) => setData(r.data)).catch((e) => toast.error(errorText(e))), []);
  useEffect(() => {
    load();
  }, [load]);

  const check = async () => {
    setBusy(true);
    try {
      const { data: res } = await api.post("/watch/check");
      setChanges(res.changes);
      await load();
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="watch-panel">
      <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Radar size={20} className="text-cap" />
            <h2 className="text-2xl">Bench watch</h2>
            <span className="badge badge-warn" data-testid="watch-sample-label">Sample data, not live checks</span>
          </div>
          <p className="text-sm text-cocoa mt-1">Signals beyond your own jobs: reply time, public rating, business open, phone working, license. Flags mark someone unreachable.</p>
          {data?.last_run && <p className="text-xs text-cocoa mt-1">Last check {fmtWhen(data.last_run)}</p>}
        </div>
        <button className="btn btn-primary shrink-0" onClick={check} disabled={busy} data-testid="watch-check-now-button">{busy ? "Checking…" : "Check now"}</button>
      </div>
      {changes && (
        <div className="rounded-[16px] bg-sage p-4 text-sage-ink" data-testid="watch-changes">
          <p className="font-head text-lg">What changed</p>
          <ul className="mt-1 list-disc pl-5 text-sm font-semibold">{changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      <div className="card p-2 sm:p-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]" data-testid="watch-table">
          <thead>
            <tr className="text-left text-cocoa">
              <th className="p-2">Contractor</th><th className="p-2">Score</th>
              {Object.values(SIG).map(([l]) => <th key={l} className="p-2">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {data?.contractors.map((c) => (
              <tr key={c.id} className={`border-t-[1.5px] border-line ${c.rank ? "" : "opacity-60"}`} data-testid={`watch-row-${c.id}`}>
                <td className="p-2 font-semibold">{c.business_name || c.name}<div className="text-xs text-cocoa font-normal max-w-[260px] truncate">{c.reason}</div></td>
                <td className="p-2">{c.score ?? "–"}</td>
                {Object.entries(SIG).map(([t, [, f]]) => {
                  const v = c.signals?.[t]?.value;
                  return <td key={t} className={`p-2 ${v && BAD(t, v) ? "text-blush-ink font-semibold" : ""}`}>{v ? f(v) : "–"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {data?.contractors.length === 0 && <p className="p-4 text-cocoa">No contractors to watch yet.</p>}
      </div>
    </div>
  );
}
