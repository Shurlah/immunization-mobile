import { db, enqueueSyncItem } from '../database/localDb';
import type { RegisterChildInput, RecordImmunizationInput } from '../shared/validation';
import { createUuid } from '../shared/uuid';

export async function saveChildRegistration(input: RegisterChildInput) {
  const guardianId = createUuid();
  const childId = createUuid();

  await db.execute(
    `INSERT INTO Guardians (Id, FullName, PhoneNumber, RelationshipToChild, PendingSync) VALUES (?, ?, ?, ?, 1);`,
    [guardianId, input.caregiverName, input.caregiverPhoneNumber, input.relationshipToChild ?? null]
  );
  await enqueueSyncItem({
    clientChangeId: createUuid(),
    entityType: 'Guardian',
    entityId: guardianId,
    operationType: 'Create',
    payload: {
      id: guardianId,
      fullName: input.caregiverName,
      phoneNumber: input.caregiverPhoneNumber,
      alternativePhoneNumber: null,
      relationshipToChild: input.relationshipToChild ?? null
    }
  });

  const childPayload = {
    id: childId,
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth,
    sex: input.sex,
    guardianId,
    facilityId: input.facilityId,
    createdByUserId: input.healthWorkerId,
    createdByDeviceId: null
  };

  await db.execute(
    `INSERT INTO Children (Id, FirstName, MiddleName, LastName, DateOfBirth, Sex, GuardianId, FacilityId, PendingSync)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);`,
    [childId, input.firstName, input.middleName ?? null, input.lastName, input.dateOfBirth, input.sex, guardianId, input.facilityId]
  );
  await enqueueSyncItem({
    clientChangeId: createUuid(),
    entityType: 'Child',
    entityId: childId,
    operationType: 'Create',
    payload: childPayload
  });

  return childId;
}

export async function saveImmunizationRecord(input: RecordImmunizationInput) {
  const id = createUuid();
  const payload = { id, ...input };
  await db.execute(
    `INSERT INTO ImmunizationRecords
      (Id, ChildId, VaccineId, DoseName, DateAdministered, FacilityId, AdministeredByUserId, PendingSync)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1);`,
    [id, input.childId, input.vaccineId, input.doseName, input.dateAdministered, input.facilityId, input.administeredByUserId]
  );
  await enqueueSyncItem({
    clientChangeId: createUuid(),
    entityType: 'ImmunizationRecord',
    entityId: id,
    operationType: 'Create',
    payload
  });
  return id;
}
