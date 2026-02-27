export interface ImageColor {
  bg: string;
  border: string;
  text: string;
  ring: string;
  dot: string;
  hex: string; // reliable inline color for dynamic rendering
}

export const IMAGE_COLORS: ImageColor[] = [
  {
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700",
    ring: "ring-blue-400/50",
    dot: "bg-blue-500",
    hex: "#3b82f6",
  },
  {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-700",
    ring: "ring-amber-400/50",
    dot: "bg-amber-500",
    hex: "#f59e0b",
  },
  {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-700",
    ring: "ring-emerald-400/50",
    dot: "bg-emerald-500",
    hex: "#10b981",
  },
  {
    bg: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-700",
    ring: "ring-rose-400/50",
    dot: "bg-rose-500",
    hex: "#f43f5e",
  },
  {
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-700",
    ring: "ring-violet-400/50",
    dot: "bg-violet-500",
    hex: "#8b5cf6",
  },
  {
    bg: "bg-cyan-50",
    border: "border-cyan-300",
    text: "text-cyan-700",
    ring: "ring-cyan-400/50",
    dot: "bg-cyan-500",
    hex: "#06b6d4",
  },
  {
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700",
    ring: "ring-orange-400/50",
    dot: "bg-orange-500",
    hex: "#f97316",
  },
  {
    bg: "bg-pink-50",
    border: "border-pink-300",
    text: "text-pink-700",
    ring: "ring-pink-400/50",
    dot: "bg-pink-500",
    hex: "#ec4899",
  },
  {
    bg: "bg-teal-50",
    border: "border-teal-300",
    text: "text-teal-700",
    ring: "ring-teal-400/50",
    dot: "bg-teal-500",
    hex: "#14b8a6",
  },
  {
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    text: "text-indigo-700",
    ring: "ring-indigo-400/50",
    dot: "bg-indigo-500",
    hex: "#6366f1",
  },
];

export function getImageColor(index: number): ImageColor {
  return IMAGE_COLORS[index % IMAGE_COLORS.length];
}

export function getImageLabel(index: number): string {
  return `img${index + 1}`;
}
