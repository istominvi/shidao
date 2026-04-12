import type { ElementType, ReactNode } from "react";

type AppCardProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  muted?: boolean;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AppCard({ as: Component = "section", className, children, muted = false }: AppCardProps) {
  return <Component className={joinClasses("app-card", muted && "app-card-muted", className)}>{children}</Component>;
}
