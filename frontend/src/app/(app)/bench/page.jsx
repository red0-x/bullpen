import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { EmptyState } from "@/components/EmptyState";

export default function BenchPage() {
  return (
    <>
      <PageTitle eyebrow="Contractors" title="Bench" sub="Your ranked backups for every property and amenity." />
      <EmptyState
        testId="bench-coming-soon"
        title="The ranked bench is coming next"
        body="Importing contacts and browsing your ranked bench are part of the next build. Scores are already worked out behind the scenes."
      >
        <Link href="/properties/" className="btn btn-secondary" data-testid="bench-go-properties-button">See properties</Link>
      </EmptyState>
    </>
  );
}
