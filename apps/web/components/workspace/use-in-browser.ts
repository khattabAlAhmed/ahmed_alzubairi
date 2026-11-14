"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True once the component runs in the browser. Times are shown in the
 * viewer's zone, which the server doesn't know, so without a fixed `timeZone`
 * the text is filled in by the browser and the server sends it empty.
 */
export function useInBrowser(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
