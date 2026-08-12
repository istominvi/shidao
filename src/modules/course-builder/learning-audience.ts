import { z } from "zod";

export const courseLearningAudienceSchema = z.enum(["children", "educators"]);

export type CourseLearningAudience = z.infer<
  typeof courseLearningAudienceSchema
>;

export const DEFAULT_COURSE_LEARNING_AUDIENCE =
  "children" satisfies CourseLearningAudience;
