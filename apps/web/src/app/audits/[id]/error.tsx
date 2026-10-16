"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function AuditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <EmptyState
        illustration="network-error"
        title="This view could not be loaded"
        action={
          <Button onClick={reset}>
            <RotateCw /> Try again
          </Button>
        }
      >
        {error.message || "An unexpected error occurred while reading the audit data."}
        {error.digest && <span className="mt-1 block font-mono">ref {error.digest}</span>}
      </EmptyState>
    </div>
  );
}
