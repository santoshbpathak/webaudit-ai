import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

/** Shown on result views while the audit is still queued or running. */
export function NotFinished({ id }: { id: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <EmptyState
        illustration="scanning"
        title="Results will appear when the audit finishes"
        action={
          <Link href={`/audits/${id}`} className={buttonVariants({ variant: "secondary" })}>
            View live progress
          </Link>
        }
      >
        Findings are only shown once analysis completes, so nothing here is a partial guess.
      </EmptyState>
    </div>
  );
}
