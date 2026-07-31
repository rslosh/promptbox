"use client";

import { useLayoutEffect } from "react";

/**
 * Re-applies the persisted theme after hydration. The inline head script
 * handles first paint, but React 19 hydration resets <html> attributes it
 * doesn't know about, so this puts data-theme back before the next paint.
 */
export function ThemeInit() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem("promptbox_theme");
      const theme =
        stored ??
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
  }, []);

  return null;
}
