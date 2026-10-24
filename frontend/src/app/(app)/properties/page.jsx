"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { PageTitle } from "@/components/PageTitle";
import { PropertyCard } from "@/components/PropertyCard";
import { DemoControls } from "@/components/DemoControls";
import { EmptyState } from "@/components/EmptyState";

export default function PropertiesPage() {
  const [props, setProps] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api.get("/properties"), api.get("/demo/status")]);
      setProps(p.data);
      setStatus(s.data);
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <PageTitle eyebrow="Your rentals" title="Properties" sub="Every amenity and how many backups you have for it.">
        <DemoControls status={status} onChange={refresh} />
      </PageTitle>
      {error && (
        <div className="card p-4 mb-6 flex items-center justify-between gap-3" data-testid="properties-error">
          <p className="text-blush-ink">{error}</p>
          <button className="btn btn-secondary" onClick={refresh}>Try again</button>
        </div>
      )}
      {props === null && !error && <div className="card h-56 animate-pulse" data-testid="properties-loading" />}
      {props?.length === 0 && (
        <EmptyState
          testId="properties-empty-state"
          title="No properties yet"
          body="Load the demo to see Bullpup with three sample rentals and a bench of made-up contractors."
        />
      )}
      <div className="flex flex-col gap-6" data-testid="properties-list">
        {props?.map((p, i) => <PropertyCard key={p.id} property={p} index={i} />)}
      </div>
    </>
  );
}
