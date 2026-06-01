"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";

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

const ApiKeyContext = createContext<ApiKeyContextValue | undefined>(undefined);
const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(undefined);
const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const STORAGE_KEY = "cerebro.apiKey";

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
