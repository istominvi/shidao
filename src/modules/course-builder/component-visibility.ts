import { z } from "zod";

export const componentVisibilitySchema = z.enum([
  "learner_visible",
  "staff_only",
]);

export type ComponentVisibility = z.infer<typeof componentVisibilitySchema>;
