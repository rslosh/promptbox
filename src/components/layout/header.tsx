"use client";

import { Input } from "@/components/ui/input";
import { Search, Command } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.08] bg-white/[0.06] px-6 backdrop-blur-xl">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold text-white/90 leading-tight">{title}</h1>
        {description && (
          <p className="text-xs text-white/40 leading-tight">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3 ml-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <Input
            type="search"
            placeholder="Search…"
            className="w-52 pl-8 pr-10 text-[13px] h-8"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <kbd className="flex h-5 items-center gap-0.5 rounded border border-white/[0.12] bg-white/[0.08] px-1.5 text-[10px] text-white/35 font-sans">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>

        {actions}
      </div>
    </header>
  );
}
