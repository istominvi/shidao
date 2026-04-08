import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type HeaderShellProps = {
  children: ReactNode;
  className?: string;
};

export function NavigationHeaderShell({ children, className }: HeaderShellProps) {
  return <div className={cx("nav-header-shell", className)}>{children}</div>;
}

type NavPillLinkProps = {
  href: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
  ariaCurrent?: "page";
};

export function NavPillLink({
  href,
  children,
  active = false,
  className,
  ariaCurrent,
}: NavPillLinkProps) {
  return (
    <Link
      href={href}
      aria-current={ariaCurrent}
      className={cx("nav-pill", active ? "nav-pill-active" : "nav-pill-inactive", className)}
    >
      {children}
    </Link>
  );
}

type NavPillButtonProps = {
  children: ReactNode;
  active?: boolean;
  unavailable?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  ariaPressed?: boolean;
};

export function NavPillButton({
  children,
  active = false,
  unavailable = false,
  loading = false,
  onClick,
  className,
  type = "button",
  ariaPressed,
}: NavPillButtonProps) {
  const isDisabled = unavailable || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={ariaPressed}
      aria-busy={loading || undefined}
      className={cx(
        "nav-pill",
        active ? "nav-pill-active" : "nav-pill-inactive",
        unavailable && !active ? "nav-pill-unavailable" : "cursor-pointer",
        className,
      )}
    >
      {children}
    </button>
  );
}

type DropdownPanelProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function NavigationDropdownPanel({ children, className, style }: DropdownPanelProps) {
  return (
    <div className={cx("nav-dropdown-panel", className)} style={style}>
      {children}
    </div>
  );
}

export function navigationDropdownItemClass(className?: string, destructive = false) {
  return cx("nav-dropdown-item", destructive && "nav-dropdown-item-destructive", className);
}

type SegmentedSwitchProps = {
  children: ReactNode;
  className?: string;
};

export function NavSegmentedSwitch({ children, className }: SegmentedSwitchProps) {
  return <div className={cx("nav-segmented-switch", className)}>{children}</div>;
}
