"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { URGENCY, fmtWhen } from "@/lib/image";
import { PageTitle } from "@/components/PageTitle";
import { EmptyState } from "@/components/EmptyState";

const STATUS = { open: ["badge-warn", "Needs a contractor"], waiting: ["badge-warn", "Waiting on reply"], scheduled: ["badge-ready", "Scheduled"] };

export default function FixItPage() {
  const [issues, setIssues] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/issues").then((r) => setIssues(r.data)).catch((e) => setErr(errorText(e)));
  }, []);

  return (
    <>
      <PageTitle eyebrow="Home" title="Fix-it list" sub="What needs you today, in order.">
        <Link href="/something-broke/" className="btn btn-primary" data-testid="fixit-something-broke-button">Something broke</Link>
      </PageTitle>
      {err && <p className="card p-4 text-blush-ink" data-testid="fixit-error">{err}</p>}
      {issues === null && !err && <div className="card h-40 animate-pulse" />}
      {issues?.length === 0 && (
        <EmptyState pose="sleep" motion="breathe" testId="fixit-empty-state" title="Your bench is ready. Nothing needs you today." body="Coverage gaps and stale contacts will show up here in an upcoming build." />
      )}
      <div className="flex flex-col gap-3" data-testid="fixit-list">
        {issues?.map((i, idx) => (
          <Link key={i.id} href={`/issue/?id=${i.id}`} className="card p-4 sm:p-5 flex items-center gap-4 hover:bg-[#FFFCF7] transition-colors duration-150 animate-rise"
            style={{ animationDelay: `${idx * 60}ms` }} data-testid={`fixit-issue-${i.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className={`badge ${STATUS[i.status][0]}`}>{STATUS[i.status][1]}</span>
                {i.urgency && <span className="badge badge-neutral">{URGENCY[i.urgency]}</span>}
              </div>
              <p className="mt-2 font-semibold text-espresso truncate">{i.amenity_label || i.trade_needed} at {i.property_name}</p>
              <p className="text-sm text-cocoa truncate">{i.ai_diagnosis || i.host_note}{i.guest_arrival ? ` · Guests ${fmtWhen(i.guest_arrival)}` : ""}</p>
            </div>
            <span className="btn btn-secondary px-3 shrink-0" aria-hidden><ChevronRight size={18} /></span>
          </Link>
        ))}
      </div>
    </>
  );
}
