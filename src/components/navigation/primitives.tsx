import Link from "next/link";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import { classNames } from "@/lib/ui/classnames";

type HeaderShellProps = {
  children: ReactNode;
  className?: string;
};

export function NavigationHeaderShell({
  children,
  className,
}: HeaderShellProps) {
  return (
    <div className={classNames("nav-header-shell", className)}>{children}</div>
  );
}

type NavPillLinkProps = {
  href: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
  ariaCurrent?: "page";
  scroll?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function NavPillLink({
  href,
  children,
  active = false,
  className,
  ariaCurrent,
  scroll,
  onClick,
}: NavPillLinkProps) {
  return (
    <Link
      href={href}
      aria-current={ariaCurrent}
      scroll={scroll}
      className={classNames(
        "nav-pill",
        active ? "nav-pill-active" : "nav-pill-inactive",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

type DropdownPanelProps = ComponentPropsWithoutRef<"div"> & {
  className?: string;
  style?: CSSProperties;
};

export const NavigationDropdownPanel = forwardRef<
  HTMLDivElement,
  DropdownPanelProps
>(function NavigationDropdownPanel(
  { children, className, style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={classNames("nav-dropdown-panel", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
});

export function navigationDropdownItemClass(
  className?: string,
  destructive = false,
) {
  return classNames(
    "nav-dropdown-item",
    destructive && "nav-dropdown-item-destructive",
    className,
  );
}
