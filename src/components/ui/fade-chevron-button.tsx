"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

type FadeChevronButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  direction: "left" | "right";
  children?: ReactNode;
};

export const FadeChevronButton = forwardRef<
  HTMLButtonElement,
  FadeChevronButtonProps
>(function FadeChevronButton(
  { direction, className, type = "button", children, ...props },
  ref,
) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      ref={ref}
      type={type}
      className={classNames("fade-chevron-control", className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      {children}
    </button>
  );
});
