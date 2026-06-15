"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

type ApiKeyContextValue = {
  apiKey: string;
  setApiKey: (value: string) => void;
};

type CommandPaletteContextValue = {
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
};

type SidebarContextValue = {
  collapsed: boolean;
  toggleSidebar: () => void;
};

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (value: ThemeMode) => void;
  toggleTheme: () => void;
};

const ApiKeyContext = createContext<ApiKeyContextValue | undefined>(undefined);
const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(undefined);
const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "cerebro.apiKey";
const THEME_STORAGE_KEY = "cerebro.theme";
const THEME_CHANGE_EVENT = "cerebro-theme";

const notifyKeyChange = () => {
  window.dispatchEvent(new Event("cerebro-api-key"));
};

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("cerebro-api-key", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("cerebro-api-key", callback);
  };
};

const getSnapshot = () => window.localStorage.getItem(STORAGE_KEY) ?? "";

const getServerSnapshot = () => "";

const notifyThemeChange = () => {
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
};

const subscribeTheme = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
};

const getThemeSnapshot = (): ThemeMode => {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

const getThemeServerSnapshot = (): ThemeMode => "light";

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const apiKey = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setApiKey = (value: string) => {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    notifyKeyChange();
  };

  const contextValue = useMemo(() => ({ apiKey, setApiKey }), [apiKey]);

  return (
    <ApiKeyContext.Provider value={contextValue}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const contextValue = useMemo(
    () => ({
      isCommandPaletteOpen,
      openCommandPalette: () => setCommandPaletteOpen(true),
      closeCommandPalette: () => setCommandPaletteOpen(false),
    }),
    [isCommandPaletteOpen],
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const contextValue = useMemo(
    () => ({ collapsed, toggleSidebar: () => setCollapsed((c) => !c) }),
    [collapsed],
  );
  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
  }, [theme]);

  const contextValue = useMemo(
    () => ({
      theme,
      setTheme: (value: ThemeMode) => {
        window.localStorage.setItem(THEME_STORAGE_KEY, value);
        notifyThemeChange();
      },
      toggleTheme: () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme === "dark" ? "light" : "dark");
        notifyThemeChange();
      },
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within SidebarProvider");
  return context;
}

export function useApiKey() {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error("useApiKey must be used within ApiKeyProvider");
  }
  return context;
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return context;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
