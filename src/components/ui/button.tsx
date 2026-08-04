import { forwardRef, type ButtonHTMLAttributes } from "react";
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

export const Button = forwardRef<HTMLButtonElement, ProductButtonProps>(
  function Button(
    { variant = "primary", className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={productButtonClassName(variant, className)}
        {...props}
      />
    );
  },
);
