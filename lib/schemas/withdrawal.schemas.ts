import { z } from "zod";

export const createWithdrawalSchema = z.object({
  amountTokens: z.coerce.number().int().positive("Invalid amountTokens value"),
});

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
