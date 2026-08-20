import { open } from '@op-engineering/op-sqlite';
import { migrations } from './schema';
import { createUuid } from '../shared/uuid';
import type { ChildSummary, DashboardState, FacilityOption, ServerChangeDto, VaccineOption } from '../shared/types';

export const db = open({ name: 'immunization-local.db' });

export async function initializeDatabase() {
  for (const migration of migrations) {
    await db.execute(migration);
  }

  await db.execute(
    `INSERT OR IGNORE INTO SyncState (Id, LastPulledServerVersion, PendingCount, FailedCount)
     VALUES ('default', 0, 0, 0);`
  );
}

export async function enqueueSyncItem(input: {
  clientChangeId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  payload: unknown;
}) {
  await db.execute(
    `INSERT INTO SyncQueue
      (Id, ClientChangeId, EntityType, EntityId, OperationType, PayloadJson, Status, RetryCount, CreatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 'Pending', 0, ?);`,
    [
      createUuid(),
      input.clientChangeId,
      input.entityType,
      input.entityId,
      input.operationType,
      JSON.stringify(input.payload),
      new Date().toISOString()
    ]
  );
}

export async function getDashboardState(online: boolean): Promise<DashboardState> {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const result = await db.execute(
    `SELECT
      (SELECT COUNT(*) FROM SyncQueue WHERE Status IN ('Pending', 'Retrying', 'Syncing')) AS pendingCount,
      (SELECT COUNT(*) FROM SyncQueue WHERE Status IN ('Failed', 'Conflict')) AS failedCount,
      (SELECT COUNT(*) FROM SyncQueue WHERE EntityType = 'Child' AND CreatedAt >= ?) AS childrenRegisteredToday,
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = ? AND Status <> 'Completed') AS appointmentsDueToday,
      (SELECT LastSuccessfulSyncAt FROM SyncState WHERE Id = 'default') AS lastSuccessfulSyncAt;`,
    [todayPrefix, todayPrefix]
  );

  const row = (result.rows?.[0] ?? {}) as {
    pendingCount?: number;
    failedCount?: number;
    childrenRegisteredToday?: number;
    appointmentsDueToday?: number;
    lastSuccessfulSyncAt?: string | null;
  };

  return {
    online,
    pendingCount: Number(row.pendingCount ?? 0),
    failedCount: Number(row.failedCount ?? 0),
    childrenRegisteredToday: Number(row.childrenRegisteredToday ?? 0),
    appointmentsDueToday: Number(row.appointmentsDueToday ?? 0),
    lastSuccessfulSyncAt: row.lastSuccessfulSyncAt ?? undefined
  };
}

export async function getFacilities(): Promise<FacilityOption[]> {
  const result = await db.execute(
    `SELECT Id AS id, Name AS name, Code AS code
     FROM Facilities
     ORDER BY Name;`
  );

  return ((result.rows ?? []) as unknown as FacilityOption[]).map(item => ({
    id: item.id,
    name: item.name,
    code: item.code
  }));
}

export async function getLocalChildren(query: string): Promise<ChildSummary[]> {
  const like = `%${query}%`;
  const result = await db.execute(
    `SELECT c.Id AS id, c.FirstName AS firstName, c.MiddleName AS middleName, c.LastName AS lastName,
            c.DateOfBirth AS dateOfBirth, c.Sex AS sex, c.GuardianId AS guardianId,
            g.FullName AS guardianFullName, g.PhoneNumber AS guardianPhoneNumber
     FROM Children c
     LEFT JOIN Guardians g ON g.Id = c.GuardianId
     WHERE c.FirstName LIKE ? OR c.LastName LIKE ? OR g.PhoneNumber LIKE ?
     ORDER BY c.LastName, c.FirstName
     LIMIT 25;`,
    [like, like, like]
  );

  return (result.rows ?? []) as unknown as ChildSummary[];
}

/**
 * Applies one downloaded server change to the matching local table, so records created or
 * edited elsewhere (another device, the admin web app) become visible for offline search once
 * a sync has pulled them down. Handles every entity type the backend logs to ServerChangeLog:
 * Child, Guardian, Facility, Vaccine, VaccineSchedule, ImmunizationRecord, and Appointment.
 */
type Scalar = string | number | boolean | null;

function scalar(value: unknown): Scalar {
  return value === undefined ? null : (value as Scalar);
}

export async function applyServerChange(change: ServerChangeDto) {
  const payload = change.payload;

  switch (change.entityType) {
    case 'Child': {
      if (change.operationType === 'Delete') {
        await db.execute(`DELETE FROM Children WHERE Id = ?;`, [change.entityId]);
        return;
      }

      const guardian = payload.guardian as Record<string, unknown> | null | undefined;
      if (guardian?.id) {
        await db.execute(
          `INSERT OR REPLACE INTO Guardians (Id, FullName, PhoneNumber, RelationshipToChild, Address, PendingSync)
           VALUES (?, ?, ?, ?, ?, 0);`,
          [scalar(guardian.id), scalar(guardian.fullName), scalar(guardian.phoneNumber), scalar(guardian.relationshipToChild), scalar(guardian.address)]
        );
      }

      await db.execute(
        `INSERT OR REPLACE INTO Children (Id, FirstName, MiddleName, LastName, DateOfBirth, Sex, GuardianId, FacilityId, PendingSync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);`,
        [
          change.entityId,
          scalar(payload.firstName),
          scalar(payload.middleName),
          scalar(payload.lastName),
          scalar(payload.dateOfBirth),
          scalar(payload.sex),
          scalar(payload.guardianId),
          scalar(payload.facilityId)
        ]
      );
      return;
    }
    case 'Vaccine': {
      await db.execute(
        `INSERT OR REPLACE INTO Vaccines (Id, Name, Code, IsActive) VALUES (?, ?, ?, ?);`,
        [change.entityId, scalar(payload.name), scalar(payload.code), payload.isActive ? 1 : 0]
      );
      return;
    }
    case 'VaccineSchedule': {
      await db.execute(
        `INSERT OR REPLACE INTO VaccineSchedules (Id, VaccineId, DoseName, RecommendedAgeInWeeks, Sequence, IsActive)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          change.entityId,
          scalar(payload.vaccineId),
          scalar(payload.doseName),
          scalar(payload.recommendedAgeInWeeks),
          scalar(payload.sequence),
          payload.isActive ? 1 : 0
        ]
      );
      return;
    }
    case 'ImmunizationRecord': {
      await db.execute(
        `INSERT OR REPLACE INTO ImmunizationRecords (Id, ChildId, VaccineId, DoseName, DateAdministered, FacilityId, AdministeredByUserId, PendingSync)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0);`,
        [
          change.entityId,
          scalar(payload.childId),
          scalar(payload.vaccineId),
          scalar(payload.doseName),
          scalar(payload.dateAdministered),
          scalar(payload.facilityId),
          scalar(payload.administeredByUserId)
        ]
      );
      return;
    }
    case 'Guardian': {
      await db.execute(
        `INSERT OR REPLACE INTO Guardians (Id, FullName, PhoneNumber, RelationshipToChild, Address, PendingSync)
         VALUES (?, ?, ?, ?, ?, 0);`,
        [change.entityId, scalar(payload.fullName), scalar(payload.phoneNumber), scalar(payload.relationshipToChild), scalar(payload.address)]
      );
      return;
    }
    case 'Facility': {
      await db.execute(
        `INSERT OR REPLACE INTO Facilities (Id, Name, Code) VALUES (?, ?, ?);`,
        [change.entityId, scalar(payload.name), scalar(payload.code)]
      );
      return;
    }
    case 'Appointment': {
      await db.execute(
        `INSERT OR REPLACE INTO Appointments (Id, ChildId, VaccineId, DoseName, FacilityId, AppointmentDate, Status, PendingSync)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0);`,
        [
          change.entityId,
          scalar(payload.childId),
          scalar(payload.vaccineId),
          scalar(payload.doseName),
          scalar(payload.facilityId),
          scalar(payload.appointmentDate),
          scalar(payload.status)
        ]
      );
      return;
    }
    default:
      return;
  }
}

export async function getVaccines(): Promise<VaccineOption[]> {
  const result = await db.execute(
    `SELECT Id AS id, Name AS name, Code AS code
     FROM Vaccines
     WHERE IsActive = 1
     ORDER BY Name;`
  );

  return (result.rows ?? []) as unknown as VaccineOption[];
}
