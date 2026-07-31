import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { ThemeInit } from "@/components/layout/theme-init";

export const metadata: Metadata = {
  title: "Promptbox",
  description: "AI image prompting workspace - organize, tag, and remix prompts",
};

// Runs before paint so the persisted theme applies without a flash.
// Falls back to the OS preference on first visit.
const themeInit = `(function(){try{var t=localStorage.getItem("promptbox_theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="antialiased min-h-screen font-sans">
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
