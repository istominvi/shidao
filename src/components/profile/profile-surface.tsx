import type { ElementType } from "react";
import {
  SurfaceCardContent,
  type SurfaceCardContentProps,
} from "@/components/ui/surface-card";
import { classNames } from "@/lib/ui/classnames";
import styles from "./profile-workspace.module.css";

type ProfileSurfaceProps = SurfaceCardContentProps & {
  as?: ElementType;
  className?: string;
};

export function ProfileSurface({
  as: Component = "section",
  className,
  ...contentProps
}: ProfileSurfaceProps) {
  return (
    <Component
      className={classNames(styles.card, className)}
      data-profile-surface="card"
    >
      <SurfaceCardContent {...contentProps} />
    </Component>
  );
}
