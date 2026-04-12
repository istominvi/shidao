import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type AppCardProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  muted?: boolean;
};

export function AppCard({ as: Component = "section", className, children, muted = false }: AppCardProps) {
  return <Component className={cn("app-card", muted && "app-card-muted", className)}>{children}</Component>;
}
