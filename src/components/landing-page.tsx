"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/auth";
import { SessionNavActions } from "@/components/session-nav-actions";
import { useSessionView } from "@/components/use-session-view";
import {
  canRenderSessionNavActions,
  resolveLandingAuthCtaHref,
  resolveLandingNavAction,
} from "@/lib/navigation-contract";
import { PRIMARY_NAV_CONFIG } from "@/lib/navigation/primary-nav";
import { SiteHeader } from "@/components/site-header";
import { useMarketingNavActive } from "@/components/navigation/use-marketing-nav-active";
import {
  LandingHero,
  MethodSection,
  RolesAndFaqSection,
  WhySection,
  WorkflowSection,
} from "@/components/landing/sections";

export function LandingPage() {
  const { state, sessionResolved } = useSessionView();
  const authCtaHref = resolveLandingAuthCtaHref(state);
  const marketingActiveId = useMarketingNavActive(
    PRIMARY_NAV_CONFIG.marketing.items.map((item) => item.href),
  );

  const navActions = (() => {
    const action = resolveLandingNavAction(state, sessionResolved);
    switch (action) {
      case "guest-cta-pair":
        return (
          <>
            <Link href={ROUTES.login} className="landing-btn landing-btn-muted header-action-btn flex-1 sm:flex-none">
              Войти
            </Link>
            <Link href={ROUTES.join} className="landing-btn landing-btn-primary header-action-btn flex-1 sm:flex-none">
              Создать аккаунт
            </Link>
          </>
        );
      case "session-actions":
        return canRenderSessionNavActions(state) ? (
          <SessionNavActions state={state} variant="landing" portalMenu />
        ) : null;
      case "skeleton":
        return (
          <div className="landing-btn landing-btn-muted header-action-btn flex-1 sm:flex-none sm:min-w-[148px]" aria-hidden="true">
            <span className="block h-4 w-24 animate-pulse rounded-full bg-neutral-300/70" />
          </div>
        );
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  })();

  return (
    <main className="pb-16">
      <div className="fixed inset-x-0 top-0 z-[140]">
        <div className="container pt-4 md:pt-6">
          <SiteHeader
            variant="product"
            brandHref={ROUTES.home}
            navAriaLabel={PRIMARY_NAV_CONFIG.marketing.ariaLabel}
            navItems={PRIMARY_NAV_CONFIG.marketing.items.map((item) => ({
              id: item.id,
              label: item.label,
              href: item.href,
              active: marketingActiveId === item.id,
              scroll: true,
            }))}
            actions={<div className="flex w-full gap-2 sm:w-auto">{navActions}</div>}
            smoothAnchorScroll
            anchorOffset={112}
          />
        </div>
      </div>

      <div className="h-24 md:h-28" aria-hidden="true" />
      <LandingHero authCtaHref={authCtaHref} />
      <WhySection />
      <MethodSection />
      <WorkflowSection />
      <RolesAndFaqSection />
    </main>
  );
}
