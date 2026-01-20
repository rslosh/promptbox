"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bell, Command } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-black/80 px-6 backdrop-blur-xl">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {description && (
          <p className="text-sm text-white/60">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            type="search"
            placeholder="Search images..."
            className="w-64 pl-10 pr-12"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <kbd className="flex h-5 items-center gap-0.5 rounded border border-white/20 bg-white/5 px-1.5 text-[10px] text-white/40">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>

        {actions}

        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
