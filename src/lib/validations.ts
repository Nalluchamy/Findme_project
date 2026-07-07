import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

export const parcelCreateSchema = z.object({
  id: z.string().min(5).max(20).regex(/^PRCL-\d+$/, "Parcel ID must match format PRCL-XXX"),
  sellerId: z.string().uuid(),
  codAmount: z.number().positive().max(1000000), // Max 10 Lakh
  originLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
});

export const collectSchema = z.object({
  amount: z.number().nonnegative(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  gpsCoords: z.string().optional().or(z.literal('')),
});

export const handoverInitiateSchema = z.object({
  eventType: z.enum([
    'HANDOVER_TO_DEST_HUB',
    'HANDOVER_TO_ORIGIN_HUB',
    'HANDOVER_TO_ORIGIN_BRANCH',
    'SETTLED_TO_SELLER'
  ]),
  expectedAmount: z.number().nonnegative(),
  toPartyId: z.string().uuid(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  gpsCoords: z.string().optional().or(z.literal('')),
});

export const handoverConfirmSchema = z.object({
  amount: z.number().nonnegative(),
});
