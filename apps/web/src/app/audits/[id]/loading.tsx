import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    // role="status" makes the label valid (aria-label is prohibited on a role-less div) and
    // announces the loading state to screen readers.
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading audit">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-72" />
    </div>
  );
}
