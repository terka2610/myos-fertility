import { z } from "zod";

export const doctorInput = z.object({
  name: z.string().min(1).max(120), clinic: z.string().max(160), specialty: z.string().max(160), languages: z.string().max(200),
  is_female: z.boolean(), treats_pcos: z.boolean(), treats_endo: z.boolean(), supports_queer_trans: z.boolean(), supports_single_women: z.boolean(),
  consent: z.literal(true), photos: z.array(z.string().max(600_000)).min(1).max(3), mouth_x: z.number().min(0).max(1), mouth_y: z.number().min(0).max(1),
  documents: z.array(z.object({ name: z.string().max(200), storage_path: z.string().max(400).nullable(), pages: z.array(z.string().max(60_000)).max(200) })).max(10),
  bio: z.string().max(1000),
});

export function canContinueSetup(step: number, name: string, busy: boolean) {
  return !busy && (step !== 0 || name.trim().length > 0);
}