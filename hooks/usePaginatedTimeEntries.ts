"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { getTimeEntriesPage, type TimeEntriesCursor } from "@/lib/firestore";
import type { TimeEntry } from "@/lib/types";

const DEFAULT_PAGE_SIZE = 200;

export function usePaginatedTimeEntries(
  userId: string | undefined,
  pageSize = DEFAULT_PAGE_SIZE,
) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<TimeEntriesCursor | undefined>(undefined);
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    cursorRef.current = undefined;

    if (!userId) {
      setEntries([]);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingMore(false);

    void (async () => {
      try {
        const page = await getTimeEntriesPage(userId, { pageSize });

        if (generation !== generationRef.current) {
          return;
        }

        cursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
        startTransition(() => {
          setEntries(page.entries);
        });
      } catch (error) {
        if (generation !== generationRef.current) {
          return;
        }

        console.error("Failed to load time entries", error);
        setError(
          "Timeloggen kunne ikke lastes. Sjekk tilkoblingen og prøv igjen.",
        );
        setEntries([]);
        setHasMore(false);
      } finally {
        if (generation === generationRef.current) {
          setLoading(false);
        }
      }
    })();
    return () => {
      generationRef.current += 1;
    };
  }, [pageSize, userId]);

  const loadMore = async () => {
    if (!userId || !hasMore || loadingMore) {
      return;
    }

    const generation = generationRef.current;
    setLoadingMore(true);
    setError(null);

    try {
      const page = await getTimeEntriesPage(userId, {
        cursor: cursorRef.current,
        pageSize,
      });

      if (generation !== generationRef.current) {
        return;
      }

      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
      startTransition(() => {
        setEntries((current) => current.concat(page.entries));
      });
    } catch (error) {
      if (generation !== generationRef.current) {
        return;
      }

      console.error("Failed to load more time entries", error);
      setError("Eldre registreringer kunne ikke lastes. Prøv igjen.");
    } finally {
      if (generation === generationRef.current) {
        setLoadingMore(false);
      }
    }
  };

  const removeEntry = (entryId: string) => {
    startTransition(() => {
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    });
  };

  return {
    entries,
    hasMore,
    loadMore,
    loading,
    loadingMore,
    pageSize,
    removeEntry,
    error,
  };
}
