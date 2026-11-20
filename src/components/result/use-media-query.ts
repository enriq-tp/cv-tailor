"use client";

import { useCallback, useSyncExternalStore } from "react";

// True while the browser window matches the media query (for example "(min-width: 1024px)").
// useSyncExternalStore is React's tool for reading a value that lives outside React.
// The server snapshot is `false` (mobile layout); this hook is only used after the result
// has loaded in the browser, so the server value is never shown.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
