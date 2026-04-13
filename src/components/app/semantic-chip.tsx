import type { ReactNode } from "react";
import type { ChipSize, ChipTone } from "@/components/ui/chip";
import { Chip } from "@/components/ui/chip";

type SemanticChipProps = {
  icon: Parameters<typeof Chip>[0]["icon"];
  children: ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  className?: string;
};

export function SemanticChip({ icon, children, tone, size, className }: SemanticChipProps) {
  return (
    <Chip icon={icon} tone={tone} size={size} className={className}>
      {children}
    </Chip>
  );
}
