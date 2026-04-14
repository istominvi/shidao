import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef } from "react";
import { productButtonClassName } from "@/components/ui/button";

export function productActionClassName(className?: string) {
  return productButtonClassName("secondary", className);
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function ActionButton({ className, type = "button", ...props }: ActionButtonProps) {
  return <button type={type} className={productActionClassName(className)} {...props} />;
}

type ActionLinkProps = ComponentPropsWithoutRef<typeof Link>;

export function ActionLink({ className, ...props }: ActionLinkProps) {
  return <Link className={productActionClassName(className)} {...props} />;
}
