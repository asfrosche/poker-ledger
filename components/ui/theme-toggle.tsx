"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Re-renders whenever the page's data-theme attribute changes (set by the toggle or the layout script). */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Header button that switches between light and night mode and remembers the choice in this browser. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, (): Theme => "light");

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("poker-ledger-theme", next);
    } catch {
      // Storage blocked: the switch still works for this visit.
    }
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to night mode"}
      aria-pressed={isDark}
      title={isDark ? "Light mode" : "Night mode"}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-panel text-ink hover:bg-surface"
    >
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
