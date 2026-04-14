import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

type AlertTone = "neutral" | "info" | "success" | "warning" | "error";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  title?: ReactNode;
};

export function Alert({
  tone = "neutral",
  title,
  className,
  children,
  role,
  ...props
}: AlertProps) {
  const semanticRole = role ?? (tone === "error" || tone === "warning" ? "alert" : "status");

  return (
    <div className={classNames("app-alert", `app-alert-${tone}`, className)} role={semanticRole} {...props}>
      {title ? <p className="app-alert-title">{title}</p> : null}
      {children ? <div className="app-alert-content">{children}</div> : null}
    </div>
  );
}
