import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

type FormFieldProps<T extends ElementType = "div"> = {
  as?: T;
  className?: string;
  children: ReactNode;
};

export function FormField<T extends ElementType = "div">({
  as,
  className,
  children,
  ...props
}: FormFieldProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof FormFieldProps<T>>) {
  const Component = as ?? "div";
  return (
    <Component className={classNames("form-field", className)} {...props}>
      {children}
    </Component>
  );
}

type FieldLabelProps = ComponentPropsWithoutRef<"label">;

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return <label className={classNames("form-field-label", className)} {...props} />;
}

type FieldHintProps = ComponentPropsWithoutRef<"p">;

export function FieldHint({ className, ...props }: FieldHintProps) {
  return <p className={classNames("form-field-hint", className)} {...props} />;
}

type FieldErrorProps = ComponentPropsWithoutRef<"p">;

export function FieldError({ className, ...props }: FieldErrorProps) {
  return <p className={classNames("form-field-error", className)} role="alert" {...props} />;
}

type FieldControlProps = ComponentPropsWithoutRef<"div">;

export function FieldControl({ className, ...props }: FieldControlProps) {
  return <div className={classNames("form-field-control", className)} {...props} />;
}
