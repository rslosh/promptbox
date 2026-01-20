export interface ImageColor {
  bg: string;
  border: string;
  text: string;
  ring: string;
  dot: string;
}

export const IMAGE_COLORS: ImageColor[] = [
  {
    bg: "bg-blue-500/20",
    border: "border-blue-500",
    text: "text-blue-400",
    ring: "ring-blue-500/50",
    dot: "bg-blue-500",
  },
  {
    bg: "bg-amber-500/20",
    border: "border-amber-500",
    text: "text-amber-400",
    ring: "ring-amber-500/50",
    dot: "bg-amber-500",
  },
  {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500",
    text: "text-emerald-400",
    ring: "ring-emerald-500/50",
    dot: "bg-emerald-500",
  },
  {
    bg: "bg-rose-500/20",
    border: "border-rose-500",
    text: "text-rose-400",
    ring: "ring-rose-500/50",
    dot: "bg-rose-500",
  },
  {
    bg: "bg-violet-500/20",
    border: "border-violet-500",
    text: "text-violet-400",
    ring: "ring-violet-500/50",
    dot: "bg-violet-500",
  },
  {
    bg: "bg-cyan-500/20",
    border: "border-cyan-500",
    text: "text-cyan-400",
    ring: "ring-cyan-500/50",
    dot: "bg-cyan-500",
  },
  {
    bg: "bg-orange-500/20",
    border: "border-orange-500",
    text: "text-orange-400",
    ring: "ring-orange-500/50",
    dot: "bg-orange-500",
  },
  {
    bg: "bg-pink-500/20",
    border: "border-pink-500",
    text: "text-pink-400",
    ring: "ring-pink-500/50",
    dot: "bg-pink-500",
  },
  {
    bg: "bg-teal-500/20",
    border: "border-teal-500",
    text: "text-teal-400",
    ring: "ring-teal-500/50",
    dot: "bg-teal-500",
  },
  {
    bg: "bg-indigo-500/20",
    border: "border-indigo-500",
    text: "text-indigo-400",
    ring: "ring-indigo-500/50",
    dot: "bg-indigo-500",
  },
];

export function getImageColor(index: number): ImageColor {
  return IMAGE_COLORS[index % IMAGE_COLORS.length];
}

export function getImageLabel(index: number): string {
  return `img${index + 1}`;
}
