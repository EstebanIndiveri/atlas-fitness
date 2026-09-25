import { z } from 'zod';

export const trainingPlanImprovementIntentSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .transform((value) => value.replace(/\s+/g, ' '));
