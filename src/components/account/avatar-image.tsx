"use client";

import Image, { type ImageLoaderProps } from "next/image";
import { useState } from "react";
import { accountAvatarSrc, type AccountAvatarView } from "@/lib/account-avatar";
import { classNames } from "@/lib/ui/classnames";

type AvatarImageProps = {
  avatar: AccountAvatarView;
  initials?: string;
  alt: string;
  size?: number;
  className?: string;
  priority?: boolean;
};

function privateAvatarLoader({ src, width }: ImageLoaderProps) {
  const deliveryWidth = Math.min(512, Math.max(32, width));
  return `${src}${src.includes("?") ? "&" : "?"}width=${deliveryWidth}`;
}

export function AvatarImage({
  avatar,
  initials = "U",
  alt,
  size = 40,
  className,
  priority = false,
}: AvatarImageProps) {
  const src = accountAvatarSrc(avatar);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  const loaded = loadedSrc === src;

  return (
    <span
      className={classNames(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-950 font-bold text-white",
        className,
      )}
      style={{ width: size, height: size }}
      role={failed && alt ? "img" : undefined}
      aria-label={failed && alt ? alt : undefined}
    >
      <span aria-hidden="true">{initials}</span>
      {!failed ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          priority={priority}
          loader={avatar.kind === "custom" ? privateAvatarLoader : undefined}
          quality={avatar.kind === "preset" ? 75 : undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
    </span>
  );
}
