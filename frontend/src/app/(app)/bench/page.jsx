"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";
import { useContractorActions } from "@/lib/contractorActions";
import { PageTitle } from "@/components/PageTitle";
import { EmptyState } from "@/components/EmptyState";
import { SlotBench } from "@/components/bench/SlotBench";
import { ImportPanel } from "@/components/bench/ImportPanel";
import { WatchPanel } from "@/components/bench/WatchPanel";
import { ContractorRow } from "@/components/bench/ContractorRow";
import { AddContractorDialog } from "@/components/bench/AddContractorDialog";

const TABS = [["bench", "Ranked bench"], ["import", "Import contacts"], ["watch", "Bench watch"]];

function BenchView() {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "bench");
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(null);

  const load = useCallback(() => api.get("/bench").then((r) => setData(r.data)).catch((e) => toast.error(errorText(e))), []);
  const actions = useContractorActions(load);

  useEffect(() => {
    load();
    if (params.get("add")) {
      setAdding({ trades: params.get("trade") ? [params.get("trade")] : [], service_area: params.get("city") ? [params.get("city")] : [] });
    }
  }, [load, params]);

  if (!data) return <div className="card h-64 animate-pulse" />;
  return (
    <>
      <PageTitle eyebrow="Contractors" title="Bench" sub="Ranked backups for every property and amenity. Scores come from real outcomes.">
        <button className="btn btn-secondary" onClick={() => setAdding({})} data-testid="bench-add-contractor-button">+ Add contractor</button>
      </PageTitle>
      <div className="flex flex-wrap gap-2 mb-6" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-[44px] px-4 rounded-btn font-semibold border-[1.5px] whitespace-nowrap transition-colors duration-150 ${tab === k ? "bg-white border-line text-espresso" : "border-transparent text-cocoa hover:text-espresso"}`}
            data-testid={`bench-tab-${k}`}>{l}</button>
        ))}
      </div>
      {tab === "bench" && (data.properties.length === 0 ? (
        <EmptyState testId="bench-empty-state" title="No properties yet" body="Load the demo on the Properties screen, or import contacts to start your bench." />
      ) : (
        <>
          <SlotBench properties={data.properties} actions={actions} onAdd={setAdding} />
          {data.unmatched.length > 0 && (
            <section className="mt-8" data-testid="unmatched-section">
              <h2 className="text-2xl">Not matched to a slot</h2>
              <p className="text-sm text-cocoa">Their trade or service area doesn&apos;t match any property yet.</p>
              <div className="mt-3 flex flex-col gap-2">{data.unmatched.map((c) => <ContractorRow key={c.id} c={c} actions={actions} />)}</div>
            </section>
          )}
        </>
      ))}
      {tab === "import" && <ImportPanel trades={data.trades} onSaved={load} onManual={() => setAdding({})} />}
      {tab === "watch" && <WatchPanel onChanged={load} />}
      <AddContractorDialog open={!!adding} preset={adding} trades={data.trades} cities={data.cities} onClose={() => setAdding(null)} onSaved={load} />
    </>
  );
}

export default function BenchPage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <BenchView />
    </Suspense>
  );
}
