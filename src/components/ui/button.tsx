import type { ButtonHTMLAttributes } from "react";
import { classNames } from "@/lib/ui/classnames";

type ProductButtonVariant = "primary" | "secondary" | "ghost";

type ProductButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ProductButtonVariant;
};

export function productButtonClassName(
  variant: ProductButtonVariant = "primary",
  className?: string,
) {
  return classNames("product-btn", `product-btn-${variant}`, className);
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ProductButtonProps) {
  return (
    <button
      type={type}
      className={productButtonClassName(variant, className)}
      {...props}
    />
  );
}
