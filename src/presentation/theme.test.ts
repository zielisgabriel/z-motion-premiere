import { describe, expect, it } from "vitest";
import { applyTheme, readTheme, saveTheme, themeStorageKey } from "./theme";

function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const broken = {
  getItem: (): string | null => {
    throw new Error("Storage is disabled");
  },
  setItem: () => {
    throw new Error("Storage is disabled");
  },
};

describe("panel theme preference", () => {
  it("starts in the light theme when nothing was saved", () => {
    expect(readTheme(memory())).toBe("light");
    expect(readTheme(undefined)).toBe("light");
  });

  it("restores a saved dark theme", () => {
    expect(readTheme(memory({ [themeStorageKey]: "dark" }))).toBe("dark");
  });

  it("ignores unknown saved values and unreadable storage", () => {
    expect(readTheme(memory({ [themeStorageKey]: "sepia" }))).toBe("light");
    expect(readTheme(broken)).toBe("light");
  });

  it("saves the choice and tolerates storage that refuses writes", () => {
    const storage = memory();
    saveTheme(storage, "dark");
    expect(storage.values.get(themeStorageKey)).toBe("dark");
    expect(() => saveTheme(broken, "light")).not.toThrow();
  });

  it("marks the document so the stylesheet can switch palettes", () => {
    const root = document.createElement("html");
    applyTheme(root, "dark");
    expect(root.dataset.theme).toBe("dark");
    applyTheme(root, "light");
    expect(root.dataset.theme).toBe("light");
  });
});
