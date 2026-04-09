import { type ReactNode } from "react";
import {
  NavPillLink,
  NavigationHeaderShell,
} from "@/components/navigation/primitives";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type SiteHeaderNavItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
  ariaCurrent?: "page";
  scroll?: boolean;
};

type SiteHeaderProps = {
  variant: "marketing-hero" | "product";
  brand: ReactNode;
  nav?: {
    ariaLabel: string;
    items: SiteHeaderNavItem[];
  };
  actions?: ReactNode;
  className?: string;
};

export function SiteHeader({
  variant,
  brand,
  nav,
  actions,
  className,
}: SiteHeaderProps) {
  const hasNav = Boolean(nav && nav.items.length > 0);

  return (
    <NavigationHeaderShell
      className={cx(
        "site-header-layout",
        variant === "marketing-hero"
          ? "site-header-hero"
          : "site-header-product",
        className,
      )}
    >
      <div className="site-header-brand">{brand}</div>

      {hasNav ? (
        <nav
          aria-label={nav?.ariaLabel}
          className="site-header-nav-wrap order-3 w-full md:order-none md:w-auto md:justify-self-center"
        >
          <div className="nav-primary-scroll">
            <ul className="nav-primary-list mx-auto">
              {nav?.items.map((item) => (
                <li key={item.id}>
                  <NavPillLink
                    href={item.href}
                    active={item.active}
                    ariaCurrent={item.ariaCurrent}
                    scroll={item.scroll}
                    className="text-sm"
                  >
                    {item.label}
                  </NavPillLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      ) : (
        <div className="hidden md:block" aria-hidden="true" />
      )}

      {actions ? (
        <div className="ml-auto md:ml-0 md:justify-self-end">{actions}</div>
      ) : null}
    </NavigationHeaderShell>
  );
}
