import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Consistent section container — GatherOS surface card */
export function Panel({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn("rounded-xl border bg-surface shadow-card", className)}
      {...props}
    />
  );
}
