"use client";

import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Search, Command } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="gos-chrome sticky top-0 z-40 flex h-titlebar items-center justify-between border-b border-hairline px-5">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="text-md font-semibold text-primary leading-tight">{title}</h1>
        {description && (
          <p className="hidden truncate text-sm text-secondary leading-tight lg:block">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 ml-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary" />
          <Input
            type="search"
            placeholder="Search…"
            className="w-52 pl-8 pr-10 h-7"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <kbd className="flex h-4.5 items-center gap-0.5 rounded-sm border bg-accent-faint px-1 text-[10px] text-tertiary font-sans">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>

        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
