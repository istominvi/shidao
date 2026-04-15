import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { SurfaceCard } from "@/components/ui/surface-card";
import { classNames } from "@/lib/ui/classnames";

type MethodologyEntityCardProps = {
  title: ReactNode;
  description?: ReactNode;
  href?: string;
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
  href,
  coverImage,
  badges,
  children,
  actions,
  className,
}: MethodologyEntityCardProps) {
  const clickableTitle = href ? (
    <Link href={href} className="inline-block cursor-pointer transition hover:opacity-80">
      {title}
    </Link>
  ) : (
    title
  );

  if (coverImage) {
    const coverPreview = (
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-black/10 bg-neutral-50 p-2 md:h-full md:w-auto md:min-w-[220px]">
        <Image
          src={coverImage.src}
          alt={coverImage.alt}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 220px, 160px"
        />
      </div>
    );

    return (
      <SurfaceCard as="article" className={classNames("w-full", className)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
          {href ? (
            <Link href={href} className="block cursor-pointer md:self-stretch">
              {coverPreview}
            </Link>
          ) : (
            coverPreview
          )}
          <div className="min-w-0 space-y-4">
            <div className="min-w-0">
              <h2 className="surface-card-title">{clickableTitle}</h2>
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
      title={clickableTitle}
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
