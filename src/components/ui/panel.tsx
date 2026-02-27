import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Consistent section container — replaces Card in new-style pages */
export function Panel({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn("rounded-2xl border border-white/8 bg-white/[0.02]", className)}
      {...props}
    />
  );
}
