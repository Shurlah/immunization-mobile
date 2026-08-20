export type SyncStatus = 'Pending' | 'Syncing' | 'Synced' | 'Failed' | 'Conflict' | 'Retrying';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  role: string;
  facilityId: string | null;
};

export type DashboardState = {
  online: boolean;
  lastSuccessfulSyncAt?: string;
  pendingCount: number;
  failedCount: number;
  childrenRegisteredToday: number;
  appointmentsDueToday: number;
};

export type SyncQueueItem = {
  id: string;
  clientChangeId: string;
  entityType: 'Guardian' | 'Child' | 'ImmunizationRecord' | 'Appointment';
  entityId: string;
  operationType: 'Create' | 'Update';
  payloadJson: string;
  status: SyncStatus;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
};

export type FacilityOption = {
  id: string;
  name: string;
  code: string;
};

export type ChildSummary = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  guardianId: string;
  guardianFullName?: string | null;
  guardianPhoneNumber?: string | null;
};

export type VaccineOption = {
  id: string;
  name: string;
  code: string;
};

export type Paged<T> = {
  items: T[];
};
