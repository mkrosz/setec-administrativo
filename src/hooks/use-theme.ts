import { useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "setec-theme";
const listeners = new Set<() => void>();
let current: Theme = "dark";

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}

if (typeof window !== "undefined") {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  current = stored === "light" ? "light" : "dark";
  apply(current);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setTheme(theme: Theme) {
  current = theme;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, theme);
  apply(theme);
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => "dark" as Theme,
  );
  return {
    theme,
    isLight: theme === "light",
    toggle: () => setTheme(theme === "light" ? "dark" : "light"),
    setTheme,
  };
}

/** Força o tema escuro enquanto a tela estiver montada (login, redefinição de senha). */
export function useForceDarkTheme() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("light");
  }
  useEffect(() => {
    document.documentElement.classList.remove("light");
    return () => apply(current);
  }, []);
}
