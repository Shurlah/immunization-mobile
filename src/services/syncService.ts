import NetInfo from '@react-native-community/netinfo';
import { applyServerChange, db } from '../database/localDb';
import { apiClient } from './apiClient';
import type { AuthSession, ServerChangeDto, SyncQueueItem } from '../shared/types';

let syncing = false;

export async function startSync(session: AuthSession) {
  if (syncing) return false;
  syncing = true;

  try {
    const network = await NetInfo.fetch();
    if (!network.isConnected) return false;

    if (!session.facilityId) {
      throw new Error('Your account is not assigned to a facility.');
    }

    const pending = await getPendingItems();
    if (pending.length > 0) {
      await uploadPending(session, pending.slice(0, 50));
    }

    await downloadServerChanges();
    await db.execute(
      `UPDATE SyncState SET LastSuccessfulSyncAt = ?, LastSyncAttemptAt = ? WHERE Id = 'default';`,
      [new Date().toISOString(), new Date().toISOString()]
    );
    return true;
  } finally {
    syncing = false;
  }
}

async function getPendingItems() {
  const result = await db.execute(
    `SELECT
      Id AS id,
      ClientChangeId AS clientChangeId,
      EntityType AS entityType,
      EntityId AS entityId,
      OperationType AS operationType,
      PayloadJson AS payloadJson,
      Status AS status,
      RetryCount AS retryCount,
      CreatedAt AS createdAt,
      LastAttemptAt AS lastAttemptAt,
      ErrorMessage AS errorMessage
    FROM SyncQueue
    WHERE Status IN ('Pending', 'Retrying', 'Failed')
    ORDER BY CreatedAt, rowid
    LIMIT 50;`
  );
  return (result.rows ?? []) as unknown as SyncQueueItem[];
}

async function uploadPending(session: AuthSession, items: SyncQueueItem[]) {
  const clientChangeIds = items.map(item => item.clientChangeId);

  await db.execute(
    `UPDATE SyncQueue SET Status = 'Syncing', LastAttemptAt = ? WHERE ClientChangeId IN (${items.map(() => '?').join(',')});`,
    [new Date().toISOString(), ...clientChangeIds]
  );

  try {
    const response = await apiClient.post('/api/sync/upload', {
      deviceId: '00000000-0000-0000-0000-000000000001',
      facilityId: session.facilityId,
      healthWorkerId: session.userId,
      changes: items.map(item => ({
        clientChangeId: item.clientChangeId,
        entityType: item.entityType,
        entityId: item.entityId,
        operationType: item.operationType,
        payload: JSON.parse(item.payloadJson),
        clientTimestamp: item.createdAt
      }))
    });

    for (const item of response.data.results as Array<{ clientChangeId: string; status: string; message: string }>) {
      await db.execute(
        `UPDATE SyncQueue SET Status = ?, ErrorMessage = ? WHERE ClientChangeId = ?;`,
        [item.status === 'Accepted' ? 'Synced' : item.status, item.message, item.clientChangeId]
      );
    }
  } catch (error) {
    await db.execute(
      `UPDATE SyncQueue SET Status = 'Failed', ErrorMessage = ? WHERE ClientChangeId IN (${items.map(() => '?').join(',')});`,
      [error instanceof Error ? error.message : 'Sync upload failed.', ...clientChangeIds]
    );
    throw error;
  }
}

async function downloadServerChanges() {
  const state = await db.execute(`SELECT LastPulledServerVersion FROM SyncState WHERE Id = 'default';`);
  const rows = (state.rows ?? []) as Array<{ LastPulledServerVersion?: number }>;
  let sinceVersion = Number(rows[0]?.LastPulledServerVersion ?? 0);

  // The server caps each download page at 500 changes, so keep pulling pages until it reports
  // no further progress — otherwise a large backlog would only ever partially apply.
  for (;;) {
    const response = await apiClient.get('/api/sync/download', { params: { sinceVersion } });
    const changes = (response.data.changes ?? []) as ServerChangeDto[];

    for (const change of changes) {
      try {
        await applyServerChange(change);
      } catch (error) {
        // Skip a change this client doesn't understand rather than aborting the whole sync,
        // but log it — a silent version-marker bug is exactly what this fix was for.
        console.warn(`Failed to apply ${change.entityType} ${change.operationType} change ${change.entityId}:`, error);
      }
    }

    const serverVersion = Number(response.data.serverVersion ?? sinceVersion);
    await db.execute(`UPDATE SyncState SET LastPulledServerVersion = ? WHERE Id = 'default';`, [serverVersion]);

    if (changes.length === 0 || serverVersion <= sinceVersion) {
      break;
    }

    sinceVersion = serverVersion;
  }
}
