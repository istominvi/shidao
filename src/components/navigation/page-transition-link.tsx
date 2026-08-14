"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePageTransition } from "@/components/navigation/page-transition-provider";
import type { PageTransitionDirection } from "@/lib/navigation/page-transition";

type PageTransitionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  direction?: PageTransitionDirection;
};

export function PageTransitionLink({
  href,
  direction,
  replace,
  scroll,
  onClick,
  onNavigate,
  ...props
}: PageTransitionLinkProps) {
  const pageTransition = usePageTransition();

  return (
    <Link
      {...props}
      href={href}
      replace={replace}
      scroll={scroll}
      onClick={onClick}
      onNavigate={(event) => {
        let consumerPreventedNavigation = false;
        onNavigate?.({
          preventDefault: () => {
            consumerPreventedNavigation = true;
            event.preventDefault();
          },
        });
        if (consumerPreventedNavigation || !pageTransition) return;
        event.preventDefault();
        pageTransition.navigate(href, { direction, replace, scroll });
      }}
    />
  );
}
