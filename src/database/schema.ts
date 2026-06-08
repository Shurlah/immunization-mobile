export const migrations = [
  `CREATE TABLE IF NOT EXISTS Guardians (
    Id TEXT PRIMARY KEY,
    FullName TEXT NOT NULL,
    PhoneNumber TEXT NOT NULL,
    RelationshipToChild TEXT NULL,
    Address TEXT NULL,
    PendingSync INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS Children (
    Id TEXT PRIMARY KEY,
    FirstName TEXT NOT NULL,
    MiddleName TEXT NULL,
    LastName TEXT NOT NULL,
    DateOfBirth TEXT NOT NULL,
    Sex TEXT NOT NULL,
    GuardianId TEXT NOT NULL,
    FacilityId TEXT NOT NULL,
    PendingSync INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS ImmunizationRecords (
    Id TEXT PRIMARY KEY,
    ChildId TEXT NOT NULL,
    VaccineId TEXT NOT NULL,
    DoseName TEXT NOT NULL,
    DateAdministered TEXT NOT NULL,
    FacilityId TEXT NOT NULL,
    AdministeredByUserId TEXT NOT NULL,
    PendingSync INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS Appointments (
    Id TEXT PRIMARY KEY,
    ChildId TEXT NOT NULL,
    VaccineId TEXT NOT NULL,
    DoseName TEXT NOT NULL,
    FacilityId TEXT NOT NULL,
    AppointmentDate TEXT NOT NULL,
    Status TEXT NOT NULL,
    PendingSync INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS Vaccines (Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Code TEXT NOT NULL, IsActive INTEGER NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS VaccineSchedules (Id TEXT PRIMARY KEY, VaccineId TEXT NOT NULL, DoseName TEXT NOT NULL, RecommendedAgeInWeeks INTEGER NOT NULL, Sequence INTEGER NOT NULL, IsActive INTEGER NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS Facilities (Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Code TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS SyncQueue (
    Id TEXT PRIMARY KEY,
    ClientChangeId TEXT NOT NULL UNIQUE,
    EntityType TEXT NOT NULL,
    EntityId TEXT NOT NULL,
    OperationType TEXT NOT NULL,
    PayloadJson TEXT NOT NULL,
    Status TEXT NOT NULL,
    RetryCount INTEGER NOT NULL DEFAULT 0,
    CreatedAt TEXT NOT NULL,
    LastAttemptAt TEXT NULL,
    ErrorMessage TEXT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS SyncState (
    Id TEXT PRIMARY KEY,
    LastPulledServerVersion INTEGER NOT NULL DEFAULT 0,
    LastSuccessfulSyncAt TEXT NULL,
    LastSyncAttemptAt TEXT NULL,
    PendingCount INTEGER NOT NULL DEFAULT 0,
    FailedCount INTEGER NOT NULL DEFAULT 0
  );`
];
