import { z } from "zod";

const pauseTypeEnum = z.enum(["1_HOUR", "7_DAYS", "MANUAL"]);

export const updateAvailabilitySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pause"),
    pauseType: pauseTypeEnum,
  }),
  z.object({
    action: z.literal("resume"),
  }),
]);

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
