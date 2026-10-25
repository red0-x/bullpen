"use client";

function Cell({ value, onChange, testId, placeholder }) {
  return <input className="field !min-h-[40px] text-sm" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} />;
}

function Row({ r, i, update, trades }) {
  const tid = `import-row-${i}`;
  const unsureTrade = !r.trades.length;
  return (
    <div className={`rounded-[16px] border-[1.5px] p-4 ${r.include ? "border-line bg-white" : "border-line bg-[#F4EEE6] opacity-70"}`} data-testid={tid}>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 font-semibold min-h-[44px]">
          <input type="checkbox" className="h-5 w-5 accent-[#7B3F25]" checked={r.include} onChange={(e) => update({ include: e.target.checked })} data-testid={`${tid}-include`} />
          Save this one
        </label>
        {r.slots?.length > 0 && <span className="text-xs text-cocoa text-right">Fits: {r.slots.join(", ")}</span>}
      </div>
      {r.duplicate_of && (
        <div className="mt-2 rounded-[12px] bg-blush p-3 text-blush-ink text-sm" data-testid={`${tid}-duplicate`}>
          <p className="font-semibold">Looks like {r.duplicate_of.business_name} is already on your bench. Merge or keep both?</p>
          <div className="mt-2 flex gap-2">
            {[["merge", "Merge"], ["new", "Keep both"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => update({ choice: k })} aria-pressed={r.choice === k}
                className={`chip min-h-[40px] ${r.choice === k ? "bg-espresso text-white border-espresso" : "bg-white"}`} data-testid={`${tid}-${k}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Cell value={r.name} onChange={(v) => update({ name: v })} placeholder="Name" testId={`${tid}-name`} />
        <Cell value={r.business_name} onChange={(v) => update({ business_name: v })} placeholder="Business" testId={`${tid}-business`} />
        <Cell value={r.phone} onChange={(v) => update({ phone: v })} placeholder="Phone" testId={`${tid}-phone`} />
        <Cell value={r.email} onChange={(v) => update({ email: v })} placeholder="Email" testId={`${tid}-email`} />
        <Cell value={r.service_area.join(", ")} onChange={(v) => update({ service_area: v.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Service area" testId={`${tid}-area`} />
        <select className={`field !min-h-[40px] text-sm ${unsureTrade || r.unsure?.includes("trade") ? "!bg-blush !border-[#F0C6B5]" : ""}`} value={r.trades[0] || ""}
          onChange={(e) => update({ trades: e.target.value ? [e.target.value, ...r.trades.slice(1).filter((t) => t !== e.target.value)] : [] })} data-testid={`${tid}-trade`}>
          <option value="">Pick a trade</option>
          {trades.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {r.notes && <p className="mt-2 text-xs text-cocoa">Notes: {r.notes}</p>}
    </div>
  );
}

export function ImportPreview({ rows, setRows, trades, onSave, busy }) {
  const update = (i) => (p) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const chosen = rows.filter((r) => r.include);
  const missing = chosen.filter((r) => !r.trades.length || !r.name.trim()).length;
  return (
    <section className="card p-5 sm:p-6" data-testid="import-preview">
      <h2 className="text-2xl">Found {rows.length} contractor{rows.length === 1 ? "" : "s"}</h2>
      <p className="text-sm text-cocoa">Check each one. Fields in blush need you to pick.</p>
      <div className="mt-4 flex flex-col gap-3">
        {rows.map((r, i) => <Row key={r.key} r={r} i={i} update={update(i)} trades={trades} />)}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={busy || !chosen.length || missing > 0} onClick={onSave} data-testid="import-save-button">
          {busy ? "Saving…" : `Save ${chosen.length} to my bench`}
        </button>
        {missing > 0 && <span className="text-sm text-blush-ink font-semibold" data-testid="import-missing-note">Pick a trade for {missing} contractor{missing === 1 ? "" : "s"} first.</span>}
      </div>
    </section>
  );
}
