import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { EmptyState } from "@/components/EmptyState";

export default function SomethingBrokePage() {
  return (
    <>
      <PageTitle eyebrow="Quick fix" title="Something broke" sub="Snap a photo and Bullpup finds the top 3 people to call." />
      <EmptyState
        testId="something-broke-coming-soon"
        title="Photo-first fixing is almost here"
        body="Snapping a photo and getting your top 3 contractors arrives in an upcoming build. Nothing here is sent anywhere yet."
      >
        <Link href="/properties/" className="btn btn-secondary" data-testid="something-broke-go-properties-button">See properties</Link>
      </EmptyState>
    </>
  );
}
