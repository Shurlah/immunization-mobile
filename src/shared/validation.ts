import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const registerChildSchema = z.object({
  caregiverName: z.string().min(1),
  caregiverPhoneNumber: z.string().min(7),
  relationshipToChild: z.string().optional(),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  sex: z.enum(['Male', 'Female']),
  facilityId: z.string().uuid(),
  healthWorkerId: z.string().uuid()
});

export const recordImmunizationSchema = z.object({
  childId: z.string().uuid(),
  vaccineId: z.string().uuid(),
  doseName: z.string().min(1),
  dateAdministered: z.string().min(1),
  facilityId: z.string().uuid(),
  administeredByUserId: z.string().uuid()
});

export type RegisterChildInput = z.infer<typeof registerChildSchema>;
export type RecordImmunizationInput = z.infer<typeof recordImmunizationSchema>;
