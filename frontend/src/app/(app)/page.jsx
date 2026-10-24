import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { EmptyState } from "@/components/EmptyState";

export default function FixItPage() {
  return (
    <>
      <PageTitle eyebrow="Home" title="Fix-it list" sub="What needs you today, in order." />
      <EmptyState
        testId="fixit-coming-soon"
        title="Your Fix-it list is on the way"
        body="Soon this will show open issues, outcomes to log, coverage gaps and stale contacts. For now, check your properties."
      >
        <Link href="/properties/" className="btn btn-primary" data-testid="fixit-go-properties-button">See properties</Link>
      </EmptyState>
    </>
  );
}
