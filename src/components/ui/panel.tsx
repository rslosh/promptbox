import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Consistent section container — frosted glass card */
export function Panel({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn("rounded-2xl border border-black/[0.07] bg-white/65 backdrop-blur-sm", className)}
      {...props}
    />
  );
}
