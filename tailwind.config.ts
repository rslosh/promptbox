import type { Config } from "tailwindcss";

// Semantic mapping over the GatherOS token layer in globals.css.
// Utilities like bg-content / text-secondary / border-hairline / rounded-md
// resolve to CSS variables so both themes work from one class set.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        content: "var(--content-bg)",
        surface: "var(--surface-1)",
        sidebar: "var(--sidebar-bg)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "on-accent": "var(--text-on-accent)",
        "accent-faint": "var(--accent-bg-faint)",
        "accent-soft": "var(--accent-bg-soft)",
        "accent-active": "var(--accent-bg-active)",
        "accent-medium": "var(--accent-bg-medium)",
        "hover-bg": "var(--hover-bg)",
        "hover-soft": "var(--hover-bg-soft)",
        "hover-strong": "var(--hover-bg-strong)",
        "active-row": "var(--active-row-bg)",
        "input-bg": "var(--input-bg)",
        "input-focus": "var(--input-bg-focus)",
        success: "var(--status-success)",
        "success-dot": "var(--status-success-dot)",
        error: "var(--status-error)",
        "icon-blue": "var(--icon-blue)",
        "icon-yellow": "var(--icon-yellow)",
        "icon-orange": "var(--icon-orange)",
        "icon-red": "var(--icon-red)",
        "icon-green": "var(--icon-green)",
        "icon-purple": "var(--icon-purple)",
        "icon-pink": "var(--icon-pink)",
        "icon-muted": "var(--icon-muted)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
        strong: "var(--border-strong)",
        subtle: "var(--border-subtle)",
        hairline: "var(--border-hairline)",
        input: "var(--input-border)",
        glass: "var(--glass-border)",
      },
      ringColor: {
        accent: "var(--accent-ring)",
      },
      fontFamily: {
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      // GatherOS native density scale. Overrides Tailwind defaults so existing
      // text-xs/sm/lg/xl usages land on the GatherOS sizes.
      fontSize: {
        xs: ["11px", { lineHeight: "14px", letterSpacing: "-0.005em" }],
        sm: ["12px", { lineHeight: "16px", letterSpacing: "-0.005em" }],
        base: ["13px", { lineHeight: "18px", letterSpacing: "-0.005em" }],
        md: ["13px", { lineHeight: "18px", letterSpacing: "-0.005em" }],
        lg: ["18px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        xl: ["22px", { lineHeight: "28px", letterSpacing: "-0.015em" }],
        "2xl": ["22px", { lineHeight: "28px", letterSpacing: "-0.015em" }],
        "3xl": ["32px", { lineHeight: "38px", letterSpacing: "-0.02em" }],
        display: ["32px", { lineHeight: "38px", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        control: "var(--shadow-control)",
        card: "var(--shadow-card)",
        modal: "var(--shadow-modal)",
        glass: "var(--shadow-glass)",
        "glass-hover": "var(--shadow-glass-hover)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        pop: "var(--ease-pop)",
        bounce: "var(--ease-bounce)",
      },
      transitionDuration: {
        instant: "80ms",
        quick: "160ms",
        medium: "240ms",
        pronounced: "380ms",
        long: "600ms",
      },
      spacing: {
        titlebar: "var(--titlebar-height)",
      },
    },
  },
  plugins: [],
};

export default config;
