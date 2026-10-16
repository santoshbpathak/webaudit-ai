import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        illustration="no-results"
        title="Not found"
        action={
          <Link href="/" className={buttonVariants()}>
            Start a new audit
          </Link>
        }
      >
        This audit or page does not exist on this machine. It may have been deleted.
      </EmptyState>
    </div>
  );
}
