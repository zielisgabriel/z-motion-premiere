export type Theme = "light" | "dark";

export const themeStorageKey = "z-motion-theme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

/** The panel's storage, or undefined where the host blocks it. */
export function panelStorage(): ThemeStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The saved theme; light is the default and the fallback. */
export function readTheme(storage: ThemeStorage | undefined): Theme {
  try {
    return storage?.getItem(themeStorageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveTheme(storage: ThemeStorage | undefined, theme: Theme) {
  try {
    storage?.setItem(themeStorageKey, theme);
  } catch {
    // The choice still applies for this session.
  }
}

/** The stylesheet switches palettes on `[data-theme]`. */
export function applyTheme(root: HTMLElement, theme: Theme) {
  root.dataset.theme = theme;
}
