const AIRCRAFT_SHEET = "Aircraft";


const HISTORY_SHEET = "History";


const STARLINKS_SHEET = "Starlinks";


const QR_QUEUE_SHEET = "QR_Queue";


const SETTINGS_SHEET = "Settings";


const PRINT_TEMPLATES_SHEET = "PrintTemplates";


const BATCHES_SHEET = "Batches";


const SYSTEM_LOG_SHEET = "SystemLog";


const BACKUPS_SHEET = "Backups";


const USERS_SHEET = "Users";


const AUDIT_LOG_SHEET = "AuditLog";


const BACKUP_FOLDER_NAME = "Hornet Control Backups";


const BOOTSTRAP_ADMIN_EMAIL = "asghornetcontrol@gmail.com";


const API_KEY = "HC_7YkP9vLm42QaX8Nr5DzB1UcEe96MwFs";


const AIRCRAFT_COLUMNS = {
  ID: 1,
  STATUS: 2,
  STARLINK: 3,
  SERIAL_NUMBER: 4,
  RECEIVED_DATE: 5,
  LAST_CHANGE: 6,
  COMMENT: 7,
  BATCH_ID: 8
};


const STARLINK_COLUMNS = {
  ID: 1,
  STATUS: 2,
  AIRCRAFT_ID: 3,
  SERIAL_NUMBER: 4,
  COMMENT: 5
};


const ALLOWED_STATUSES = [
  "Активний",
  "На складі",
  "Майстерня",
  "БГ",
  "Пошкоджено",
  "Використаний",
  "Списаний"
];


const BLOCKED_STARLINK_STATUSES = [
  "Несправний",
  "Втрачений",
  "Ремонт",
  "Списаний"
];


const BATCH_COLUMNS = {
  ID: 1,
  CREATED_DATE: 2,
  QUANTITY: 3,
  COMMENT: 4,
  FIRST_AIRCRAFT: 5,
  LAST_AIRCRAFT: 6,
  CREATED_AT: 7
};


const AIRCRAFT_HEADERS = [
  "ID",
  "Status",
  "Starlink",
  "SerialNumber",
  "ReceivedDate",
  "LastChange",
  "Comment",
  "BatchID"
];


const BATCH_HEADERS = [
  "BatchID",
  "CreatedDate",
  "Quantity",
  "Comment",
  "FirstAircraft",
  "LastAircraft",
  "CreatedAt"
];


const SYSTEM_LOG_HEADERS = [
  "Timestamp",
  "Level",
  "Action",
  "Message",
  "Details"
];


const BACKUP_HEADERS = [
  "BackupID",
  "CreatedAt",
  "Name",
  "FileID",
  "URL",
  "Comment"
];


const USER_ROLES = [
  "ADMIN",
  "WAREHOUSE",
  "CLERK",
  "COMBAT"
];


const SECURITY_ENFORCEMENT_ENABLED = true;


const PERMISSIONS = {
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  AIRCRAFT_VIEW: "AIRCRAFT_VIEW",
  AIRCRAFT_CREATE: "AIRCRAFT_CREATE",
  AIRCRAFT_EDIT: "AIRCRAFT_EDIT",
  AIRCRAFT_STATUS_CHANGE: "AIRCRAFT_STATUS_CHANGE",
  STARLINK_VIEW: "STARLINK_VIEW",
  STARLINK_CREATE: "STARLINK_CREATE",
  STARLINK_ASSIGN: "STARLINK_ASSIGN",
  BATCH_CREATE: "BATCH_CREATE",
  QR_VIEW: "QR_VIEW",
  QR_PRINT: "QR_PRINT",
  HISTORY_VIEW: "HISTORY_VIEW",
  BACKUP_VIEW: "BACKUP_VIEW",
  BACKUP_CREATE: "BACKUP_CREATE",
  DIAGNOSTICS_VIEW: "DIAGNOSTICS_VIEW",
  USERS_VIEW: "USERS_VIEW",
  USERS_MANAGE: "USERS_MANAGE",
  AUDIT_VIEW: "AUDIT_VIEW"
};


const ROLE_PERMISSIONS = {
  ADMIN: Object.keys(PERMISSIONS).map(function (key) {
    return PERMISSIONS[key];
  }),

  WAREHOUSE: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.AIRCRAFT_VIEW,
    PERMISSIONS.AIRCRAFT_CREATE,
    PERMISSIONS.AIRCRAFT_EDIT,
    PERMISSIONS.AIRCRAFT_STATUS_CHANGE,
    PERMISSIONS.STARLINK_VIEW,
    PERMISSIONS.STARLINK_CREATE,
    PERMISSIONS.STARLINK_ASSIGN,
    PERMISSIONS.BATCH_CREATE,
    PERMISSIONS.QR_VIEW,
    PERMISSIONS.QR_PRINT,
    PERMISSIONS.HISTORY_VIEW
  ],

  CLERK: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.AIRCRAFT_VIEW,
    PERMISSIONS.STARLINK_VIEW,
    PERMISSIONS.QR_VIEW,
    PERMISSIONS.HISTORY_VIEW
  ],

  COMBAT: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.AIRCRAFT_VIEW,
    PERMISSIONS.AIRCRAFT_STATUS_CHANGE,
    PERMISSIONS.STARLINK_VIEW,
    PERMISSIONS.STARLINK_ASSIGN,
    PERMISSIONS.HISTORY_VIEW
  ]
};


const USER_HEADERS = [
  "UserID",
  "Email",
  "Name",
  "Role",
  "Active",
  "CreatedAt",
  "UpdatedAt",
  "LastLogin",
  "Comment",
  "PinHash"
];


const AUDIT_LOG_HEADERS = [
  "Timestamp",
  "Email",
  "UserID",
  "Role",
  "Action",
  "EntityType",
  "EntityID",
  "Result",
  "Details"
];


const SESSIONS_SHEET = "Sessions";


const SESSION_HEADERS = [
  "SessionID",
  "TokenHash",
  "UserID",
  "Email",
  "Role",
  "CreatedAt",
  "ExpiresAt",
  "LastActivity",
  "Revoked",
  "RevokedAt",
  "ClientInfo",
  "Version"
];


const SESSION_TTL_HOURS = 12;


const SESSION_SCHEMA_VERSION = "1";


/* =========================
   SHEETS EDIT HANDLER
   ========================= */


const BACKEND_FOUNDATION_VERSION = "1.6.1-alpha3.4";


const FOUNDATION_CHECK_PROPERTY = "BACKEND_FOUNDATION_VERSION_ENSURED";


const FOUNDATION_CHECK_TIMESTAMP_PROPERTY = "BACKEND_FOUNDATION_CHECKED_AT";


const FOUNDATION_CHECK_TTL_MS = 5 * 60 * 1000; // 5 хвилин — запобіжник, навіть якщо забудеш підняти версію


const HEADER_ALIASES = {
  Status: ["Status", "Статус"],
  Starlink: ["Starlink", "STARLINK"],
  SerialNumber: ["SerialNumber", "Серійний номер"],
  ReceivedDate: ["ReceivedDate", "Дата отримання"],
  LastChange: ["LastChange", "Остання зміна"],
  Comment: ["Comment", "Коментар"],
  Timestamp: ["Timestamp", "Час"],
  OldStatus: ["OldStatus", "Старий статус"],
  NewStatus: ["NewStatus", "Новий статус"]
};
