"use client";

import { useEffect, useMemo, useState } from "react";

function normalizeHash(hash: string | null | undefined) {
  if (!hash) return "";
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

export function useMarketingNavActive(sectionHrefs: string[]) {
  const sectionIds = useMemo(
    () =>
      sectionHrefs
        .map((href) => normalizeHash(href))
        .filter((id): id is string => id.length > 0),
    [sectionHrefs],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const getHashId = () => {
      const hashValue = normalizeHash(window.location.hash);
      return sectionIds.includes(hashValue) ? hashValue : null;
    };

    setActiveId(getHashId() ?? sectionIds[0]);

    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section instanceof HTMLElement);

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visibleEntries.length === 0) return;

        const nextId = visibleEntries[0].target.getAttribute("id");
        if (nextId) {
          setActiveId(nextId);
        }
      },
      {
        rootMargin: "-28% 0px -56% 0px",
        threshold: [0.25, 0.45, 0.7],
      },
    );

    sections.forEach((section) => observer.observe(section));

    const onHashChange = () => {
      setActiveId(getHashId() ?? sectionIds[0]);
    };

    window.addEventListener("hashchange", onHashChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [sectionIds]);

  return activeId;
}
