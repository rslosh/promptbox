"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/** Light/dark switcher — flips data-theme on <html> and persists the choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("promptbox_theme", next);
    } catch {}
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors duration-quick hover:bg-hover-soft hover:text-primary"
    >
      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}
