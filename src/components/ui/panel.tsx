import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Consistent section container — frosted olive glass card */
export function Panel({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn("rounded-2xl border border-white/[0.09] bg-white/[0.07] backdrop-blur-sm", className)}
      {...props}
    />
  );
}
