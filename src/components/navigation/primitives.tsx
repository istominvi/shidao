import Link from "next/link";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type HeaderShellProps = {
  children: ReactNode;
  className?: string;
  variant?: "integrated" | "app";
};

export function NavigationHeaderShell({
  children,
  className,
  variant = "app",
}: HeaderShellProps) {
  return (
    <div
      className={cx(
        "nav-header-shell",
        variant === "integrated"
          ? "nav-header-shell-integrated"
          : "nav-header-shell-app",
        className,
      )}
    >
      {children}
    </div>
  );
}

type NavPillLinkProps = {
  href: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
  ariaCurrent?: "page";
  scroll?: boolean;
};

export function NavPillLink({
  href,
  children,
  active = false,
  className,
  ariaCurrent,
  scroll,
}: NavPillLinkProps) {
  return (
    <Link
      href={href}
      aria-current={ariaCurrent}
      scroll={scroll}
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
  disabled?: boolean;
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
  disabled = false,
  onClick,
  className,
  type = "button",
  ariaPressed,
}: NavPillButtonProps) {
  const isDisabled = unavailable || loading || disabled;

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

type DropdownPanelProps = ComponentPropsWithoutRef<"div"> & {
  className?: string;
  style?: CSSProperties;
};

export const NavigationDropdownPanel = forwardRef<HTMLDivElement, DropdownPanelProps>(
  function NavigationDropdownPanel({ children, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cx("nav-dropdown-panel", className)}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  },
);

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
