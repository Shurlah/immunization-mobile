import { open } from '@op-engineering/op-sqlite';
import { migrations } from './schema';
import { createUuid } from '../shared/uuid';
import type { DashboardState } from '../shared/types';

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
