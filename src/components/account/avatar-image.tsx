"use client";

import Image from "next/image";
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
  const failed = failedSrc === src;

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
      {failed ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          sizes={`${size}px`}
          priority={priority}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  );
}
