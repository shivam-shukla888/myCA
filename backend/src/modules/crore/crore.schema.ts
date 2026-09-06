import { z } from 'zod';

export const simulateCroreSchema = z.object({
  starting_capital: z.number().min(0, 'Starting capital cannot be negative').optional(),
  monthly_contribution: z.number().min(0, 'Monthly contribution cannot be negative').optional(),
  annual_return_pct: z
    .number()
    .min(0, 'Annual return cannot be negative')
    .max(15, 'Return assumption capped at 15.0% for financial safety')
    .optional(),
  annual_stepup_pct: z
    .number()
    .min(0, 'Step-up rate cannot be negative')
    .max(30, 'Step-up capped at 30%')
    .optional(),
  monthly_income: z.number().min(0, 'Income cannot be negative').optional(),
  monthly_expenses: z.number().min(0, 'Expenses cannot be negative').optional(),
});

export type SimulateCroreInput = z.infer<typeof simulateCroreSchema>;
