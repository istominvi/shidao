import type { ElementType, ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

type AppCardProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  muted?: boolean;
};

export function AppCard({
  as: Component = "section",
  className,
  children,
  muted = false,
}: AppCardProps) {
  return (
    <Component
      className={classNames("app-card", muted && "app-card-muted", className)}
    >
      {children}
    </Component>
  );
}
