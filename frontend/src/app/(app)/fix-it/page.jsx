"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";
import { URGENCY, fmtWhen } from "@/lib/image";
import { useContractorActions } from "@/lib/contractorActions";
import { PageTitle } from "@/components/PageTitle";
import { EmptyState } from "@/components/EmptyState";

const KIND = {
  issue: ["badge-warn", "Waiting on a contractor"],
  outcome: ["badge-neutral", "Outcome not logged"],
  gap: ["badge-warn", "Coverage gap"],
  stale: ["badge-neutral", "Stale contact"],
  watch: ["badge-warn", "Bench watch"],
};

function ItemAction({ item, actions, reload }) {
  const c = { id: item.contractor_id, business_name: item.title.split(":")[0] };
  const ack = async (value) => {
    await api.post(`/watch/alerts/${item.signal_id}/ack`, null, { params: { acknowledged: value } });
    reload();
  };
  const tid = `fixit-action-${item.id}`;
  if (item.kind === "issue") return <Link href={`/issue/?id=${item.issue_id}`} className="btn btn-primary" data-testid={tid}>{item.action}</Link>;
  if (item.kind === "outcome") return <Link href={`/issue/?id=${item.issue_id}#outcome`} className="btn btn-primary" data-testid={tid}>{item.action}</Link>;
  if (item.kind === "gap") {
    return <Link href={`/bench/?add=1&trade=${encodeURIComponent(item.trade)}&city=${encodeURIComponent(item.city)}`} className="btn btn-primary" data-testid={tid}>{item.action}</Link>;
  }
  if (item.kind === "watch") {
    return (
      <button className="btn btn-secondary" data-testid={tid} onClick={async () => {
        try {
          await ack(true);
          toast("Alert cleared.", { action: { label: "Undo", onClick: () => ack(false) } });
        } catch (e) {
          toast.error(errorText(e));
        }
      }}>{item.action}</button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn btn-primary" onClick={() => actions.stillActive(c)} data-testid={tid}>Still active</button>
      <button className="btn btn-secondary" onClick={() => actions.setStatus(c, "out_of_business")} data-testid={`${tid}-out`}>Out of business</button>
      <button className="btn btn-secondary" onClick={() => actions.snooze(c)} data-testid={`${tid}-snooze`}>Snooze 30 days</button>
    </div>
  );
}

export default function FixItPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api.get("/fixit").then((r) => { setData(r.data); setErr(""); }).catch((e) => setErr(errorText(e))), []);
  const actions = useContractorActions(load);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageTitle eyebrow="Home" title="Fix-it list" sub="What needs you today, in order.">
        <Link href="/something-broke/" className="btn btn-primary" data-testid="fixit-something-broke-button">Something broke</Link>
      </PageTitle>
      {err && <p className="card p-4 text-blush-ink" data-testid="fixit-error">{err}</p>}
      {!data && !err && <div className="card h-40 animate-pulse" />}
      {data?.items.length === 0 && (data.setup.properties === 0 || data.setup.contractors === 0) && (
        <EmptyState pose="glove" testId="fixit-setup-state" title="Let's build your bench" body="Add your rentals and the contractors you use. Bullpup will flag gaps and stale contacts here.">
          <Link href="/properties/" className="btn btn-primary" data-testid="fixit-setup-properties-button">Load demo or add properties</Link>
          <Link href="/bench/?tab=import" className="btn btn-secondary" data-testid="fixit-setup-import-button">Import contacts</Link>
        </EmptyState>
      )}
      {data?.items.length === 0 && data.setup.properties > 0 && data.setup.contractors > 0 && (
        <EmptyState pose="sleep" motion="breathe" testId="fixit-empty-state" title="Your bench is ready. Nothing needs you today." />
      )}
      <div className="flex flex-col gap-3" data-testid="fixit-list">
        {data?.items.map((i, idx) => (
          <div key={i.id} className="card p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 animate-rise" style={{ animationDelay: `${idx * 50}ms` }} data-testid={`fixit-item-${i.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className={`badge ${KIND[i.kind][0]}`}>{i.kind === "issue" && i.status === "open" ? "Needs a contractor" : KIND[i.kind][1]}</span>
                {i.urgency && <span className="badge badge-neutral">{URGENCY[i.urgency]}</span>}
              </div>
              <p className="mt-2 font-semibold text-espresso">{i.title}</p>
              {(i.subtitle || i.guest_arrival || i.scheduled_for) && (
                <p className="text-sm text-cocoa">
                  {i.subtitle}
                  {i.guest_arrival ? ` · Guests ${fmtWhen(i.guest_arrival)}` : ""}
                  {i.scheduled_for ? ` · Booked for ${fmtWhen(i.scheduled_for)}` : ""}
                </p>
              )}
            </div>
            <ItemAction item={i} actions={actions} reload={load} />
          </div>
        ))}
      </div>
    </>
  );
}
