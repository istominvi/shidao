"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrimaryNavItem } from "@/lib/navigation/primary-nav";

function getHashId(hash: string) {
  return hash.startsWith("#") ? hash.slice(1) : "";
}

export function useMarketingNavActive(items: PrimaryNavItem[]) {
  const sectionIds = useMemo(
    () =>
      items
        .map((item) => getHashId(item.href))
        .filter((id): id is string => Boolean(id)),
    [items],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || sectionIds.length === 0) {
      return;
    }

    const setFromHash = () => {
      const hashId = getHashId(window.location.hash);
      if (hashId && sectionIds.includes(hashId)) {
        setActiveId(hashId);
      }
    };

    setFromHash();
    window.addEventListener("hashchange", setFromHash);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target?.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0.15, 0.3, 0.5, 0.75],
      },
    );

    sectionIds.forEach((id) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      window.removeEventListener("hashchange", setFromHash);
      observer.disconnect();
    };
  }, [sectionIds]);

  return activeId;
}
