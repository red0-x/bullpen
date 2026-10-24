"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Clock, MapPin } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { URGENCY, fmtWhen, photoSrc } from "@/lib/image";
import { EmptyState } from "@/components/EmptyState";
import { Mascot } from "@/components/Mascot";
import { CandidateCard } from "@/components/issue/CandidateCard";
import { RequestDialog } from "@/components/issue/RequestDialog";
import { WaitingPanel } from "@/components/issue/WaitingPanel";

const STATUS = { open: "badge-warn", waiting: "badge-warn", scheduled: "badge-ready", resolved: "badge-ready" };

function IssueHeader({ data }) {
  const { issue, property, amenity } = data;
  return (
    <section className="card p-5 sm:p-6 grid md:grid-cols-[260px_1fr] gap-5 animate-rise" data-testid="issue-header">
      {issue.photo_url ? (
        <img src={photoSrc(issue.photo_url)} alt="Photo of the problem" className="w-full h-56 md:h-full object-cover rounded-[16px] bg-cream" data-testid="issue-photo" />
      ) : (
        <div className="rounded-[16px] bg-cream grid place-items-center p-4"><Mascot pose="wrench" className="w-32 h-36" /></div>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <span className={`badge ${STATUS[issue.status]} capitalize`} data-testid="issue-status">{issue.status}</span>
          {issue.urgency && <span className="badge badge-neutral">{URGENCY[issue.urgency]}</span>}
          <span className="badge badge-neutral">{issue.trade_needed}</span>
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl text-espresso">{amenity?.label || issue.trade_needed} at {property.name}</h1>
        <p className="mt-2 text-cocoa" data-testid="issue-diagnosis">{issue.ai_diagnosis || issue.host_note}</p>
        <div className="mt-3 flex flex-col gap-1 text-sm text-cocoa">
          <span className="flex items-center gap-1.5"><MapPin size={14} /> {property.address}</span>
          {issue.guest_arrival && <span className="flex items-center gap-1.5 text-blush-ink font-semibold"><Clock size={14} /> Guests arrive {fmtWhen(issue.guest_arrival)}</span>}
          {issue.scheduled_for && <span className="flex items-center gap-1.5 text-sage-ink font-semibold" data-testid="issue-scheduled-for"><CalendarCheck size={14} /> Booked for {fmtWhen(issue.scheduled_for)}</span>}
        </div>
        {issue.updates?.length > 0 && (
          <ul className="mt-3 text-sm text-cocoa list-disc pl-5">{issue.updates.map((u, i) => <li key={i}>{u.note || "Added a photo"}</li>)}</ul>
        )}
      </div>
    </section>
  );
}

function Candidates({ data, onRequest }) {
  const [full, setFull] = useState(false);
  const { candidates, active_total, issue, property, amenity } = data;
  const what = (amenity?.label || issue.trade_needed).toLowerCase();
  const city = property.name.split(" ")[0];
  return (
    <section className="card p-5 sm:p-6" data-testid="candidates-section">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="text-2xl">Top {Math.min(3, candidates.length) || ""} to call</h2>
        <button className="btn-link" onClick={() => setFull(!full)} data-testid="see-full-bench-button">{full ? "Hide full bench" : "See full bench"}</button>
      </div>
      {active_total === 0 ? (
        <div className="mt-4 rounded-[16px] bg-blush p-4 text-blush-ink" data-testid="no-contractors-notice">
          <p className="font-semibold">You have no {what} contractors at {city}. <Link href="/bench/" className="underline" data-testid="add-contractor-link">Add one now</Link></p>
        </div>
      ) : candidates.length === 0 ? (
        <p className="mt-4 rounded-[16px] bg-blush p-4 text-blush-ink font-semibold" data-testid="all-asked-notice">You&apos;ve asked everyone on the bench for this. Add more contractors after it&apos;s fixed.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {candidates.map((c, i) => <CandidateCard key={c.id} c={c} position={i + 1} onRequest={onRequest} />)}
          {candidates.length < 3 && (
            <p className="rounded-[16px] bg-blush p-3 text-sm text-blush-ink font-semibold" data-testid="few-backups-notice">
              Only {candidates.length} backup{candidates.length === 1 ? "" : "s"} for this. Add more after this is fixed.
            </p>
          )}
        </div>
      )}
      {full && (
        <div className="mt-5 pt-5 border-t-[1.5px] border-line flex flex-col gap-2" data-testid="full-bench">
          {data.bench.length === 0 && <p className="text-sm text-cocoa">Nobody on the bench for this trade here yet.</p>}
          {data.bench.map((c) => <CandidateCard key={c.id} c={c} position={c.rank} compact />)}
        </div>
      )}
    </section>
  );
}

function IssueView() {
  const id = useSearchParams().get("id");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [asking, setAsking] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/issues/${id}`);
      setData(r.data);
      return r.data;
    } catch (e) {
      setErr(errorText(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const logged = async (req, c) => {
    setAsking(null);
    await load();
    toast.success(`Logged your request to ${c.business_name}. Status: Waiting.`, {
      duration: 10000,
      action: { label: "Undo", onClick: async () => { await api.delete(`/requests/${req.id}`).catch(() => {}); load(); } },
    });
  };

  const respond = async (req, response, scheduled_for) => {
    try {
      await api.post(`/requests/${req.id}/response`, { response, scheduled_for: scheduled_for || null });
      const fresh = await load();
      const undo = { label: "Undo", onClick: async () => { await api.post(`/requests/${req.id}/response/undo`).catch(() => {}); load(); } };
      if (response === "booked") toast.success("Booked. Status: Scheduled.", { action: undo, duration: 10000 });
      else {
        toast(response === "declined" ? "Marked declined. Moving to the next person." : "Marked no answer. Here's the next backup.", { action: undo, duration: 10000 });
        if (fresh?.candidates?.[0]) setAsking(fresh.candidates[0]);
      }
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  if (err) return <EmptyState pose="sniff" motion="sniff" title="We couldn't find that issue" body={err} testId="issue-error"><Link href="/fix-it/" className="btn btn-primary">Back to Fix-it list</Link></EmptyState>;
  if (!data) return <div className="card h-64 animate-pulse" data-testid="issue-loading" />;
  const showCandidates = data.issue.status !== "scheduled" && data.issue.status !== "resolved";
  return (
    <div className="flex flex-col gap-6">
      <IssueHeader data={data} />
      <WaitingPanel requests={data.requests} onRespond={respond} />
      {showCandidates && <Candidates data={data} onRequest={setAsking} />}
      <RequestDialog issue={data.issue} contractor={asking} onClose={() => setAsking(null)} onLogged={logged} />
    </div>
  );
}

export default function IssuePage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <IssueView />
    </Suspense>
  );
}
