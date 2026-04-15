import type { ReactNode } from "react";
import Image from "next/image";
import { SurfaceCard } from "@/components/ui/surface-card";
import { classNames } from "@/lib/ui/classnames";

type MethodologyEntityCardProps = {
  title: ReactNode;
  description?: ReactNode;
  coverImage?: {
    src: string;
    alt: string;
  } | null;
  badges?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function MethodologyEntityCard({
  title,
  description,
  coverImage,
  badges,
  children,
  actions,
  className,
}: MethodologyEntityCardProps) {
  if (coverImage) {
    return (
      <SurfaceCard as="article" className={classNames("w-full", className)}>
        <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)] md:items-start">
          <div className="relative aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl border border-black/10 bg-neutral-50 p-2 md:max-w-none">
            <Image
              src={coverImage.src}
              alt={coverImage.alt}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 220px, 160px"
            />
          </div>
          <div className="min-w-0 space-y-4">
            <div className="min-w-0">
              <h2 className="surface-card-title">{title}</h2>
              {description ? (
                <p className="surface-card-description">{description}</p>
              ) : null}
            </div>
            {badges ? <div className="flex flex-wrap gap-2.5">{badges}</div> : null}
            {children}
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      as="article"
      title={title}
      description={description}
      className={classNames("w-full", className)}
    >
      <div className="space-y-4">
        {badges ? <div className="flex flex-wrap gap-2.5">{badges}</div> : null}
        {children}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </SurfaceCard>
  );
}
