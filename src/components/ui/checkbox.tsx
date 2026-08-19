import { forwardRef, type InputHTMLAttributes } from "react";
import { classNames } from "@/lib/ui/classnames";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={classNames("product-checkbox", className)}
        {...props}
      />
    );
  },
);
