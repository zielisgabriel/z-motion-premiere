import type { Theme } from "./theme";

/** Square header button: a moon offers the dark theme, a sun the light one. */
export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Dark theme"
      aria-pressed={dark}
      title={dark ? "Switch to the light theme" : "Switch to the dark theme"}
      onClick={onToggle}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" />
          </>
        ) : (
          <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
        )}
      </svg>
    </button>
  );
}
