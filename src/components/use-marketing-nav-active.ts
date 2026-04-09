"use client";

import { useEffect, useMemo, useState } from "react";

type UseMarketingNavActiveParams = {
  sectionIds: string[];
};

function normalizeHash(hash: string | null | undefined) {
  if (!hash) return null;
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  return normalized || null;
}

export function useMarketingNavActive({ sectionIds }: UseMarketingNavActiveParams) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const validSectionIds = useMemo(() => new Set(sectionIds), [sectionIds]);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const applyHashState = () => {
      const hashId = normalizeHash(window.location.hash);
      if (hashId && validSectionIds.has(hashId)) {
        setActiveSectionId(hashId);
      }
    };

    applyHashState();
    window.addEventListener("hashchange", applyHashState);

    const nodes = sectionIds
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (nodes.length === 0) {
      return () => window.removeEventListener("hashchange", applyHashState);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id && validSectionIds.has(visible.target.id)) {
          setActiveSectionId(visible.target.id);
        }
      },
      {
        threshold: [0.25, 0.45, 0.65],
        rootMargin: "-35% 0px -45% 0px",
      },
    );

    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", applyHashState);
    };
  }, [sectionIds, validSectionIds]);

  return activeSectionId;
}
