import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { classNames } from "@/lib/ui/classnames";

export function productControlClassName(
  kind: "input" | "select" = "input",
  className?: string,
) {
  return classNames("product-control", `product-control-${kind}`, className);
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={productControlClassName("input", className)} {...props} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return <select className={productControlClassName("select", className)} {...props} />;
}
