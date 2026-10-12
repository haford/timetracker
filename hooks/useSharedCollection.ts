"use client";

import { useSyncExternalStore } from "react";

type Snapshot<T> = { data: T[]; loading: boolean; error: string | null };
type Listen<T> = (
  data: (items: T[]) => void,
  error: (error: Error) => void,
) => () => void;
type Store<T> = {
  getSnapshot: () => Snapshot<T>;
  subscribe: (listener: () => void) => () => void;
  patch: (update: (data: T[]) => T[]) => void;
};
const stores = new Map<string, Store<unknown>>();
const serverSnapshot: Snapshot<never> = {
  data: [],
  loading: true,
  error: null,
};
const emptySnapshot: Snapshot<never> = {
  data: [],
  loading: false,
  error: null,
};
const idleSubscribe = () => () => {};

function collectionStore<T>(key: string, listen: Listen<T>): Store<T> {
  const existing = stores.get(key);
  if (existing) return existing as Store<T>;
  let state: Snapshot<T> = { data: [], loading: true, error: null };
  let unsubscribe: (() => void) | undefined;
  let disposeTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  function publish(next: Snapshot<T>) {
    state = next;
    listeners.forEach((l) => l());
  }
  const store: Store<T> = {
    getSnapshot: () => state,
    subscribe(listener) {
      if (disposeTimer) clearTimeout(disposeTimer);
      listeners.add(listener);
      if (!unsubscribe) {
        unsubscribe = listen(
          (data) => publish({ data, loading: false, error: null }),
          () =>
            publish({
              ...state,
              loading: false,
              error: "Sjekk tilkoblingen og prøv igjen.",
            }),
        );
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size)
          disposeTimer = setTimeout(() => {
            unsubscribe?.();
            unsubscribe = undefined;
            stores.delete(key);
          }, 1000);
      };
    },
    patch(update) {
      publish({ ...state, data: update(state.data) });
    },
  };
  stores.set(key, store as Store<unknown>);
  return store;
}

export function useSharedCollection<T>(
  key: string | undefined,
  listen: Listen<T>,
) {
  const store =
    typeof window !== "undefined" && key
      ? collectionStore(key, listen)
      : undefined;
  return useSyncExternalStore(
    store?.subscribe ?? idleSubscribe,
    store?.getSnapshot ?? (() => emptySnapshot),
    () => serverSnapshot,
  ) as Snapshot<T>;
}

export function patchCollections<T>(
  prefix: string,
  update: (data: T[]) => T[],
) {
  for (const [key, store] of stores)
    if (key.startsWith(prefix)) (store as Store<T>).patch(update);
}
