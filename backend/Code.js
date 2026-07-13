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

const SECURITY_ENFORCEMENT_ENABLED = false;

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
  "Comment"
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


/* =========================
   SHEETS EDIT HANDLER
   ========================= */

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();

  if (sheet.getName() !== AIRCRAFT_SHEET) return;

  ensureBackendFoundation_();
  if (e.range.getRow() === 1) return;
  if (e.range.getColumn() !== AIRCRAFT_COLUMNS.STATUS) return;

  const id = String(
    sheet.getRange(e.range.getRow(), AIRCRAFT_COLUMNS.ID).getValue() || ""
  ).trim();

  if (!id) return;

  const oldStatus = String(e.oldValue || "").trim();
  const newStatus = String(e.value || "").trim();

  if (!newStatus || oldStatus === newStatus) return;

  const now = new Date();

  sheet
    .getRange(e.range.getRow(), AIRCRAFT_COLUMNS.LAST_CHANGE)
    .setValue(now);

  appendHistory_(now, id, oldStatus, newStatus, "");

  if (newStatus === "Використаний") {
    markLinkedStarlinkLost_(sheet, e.range.getRow());
  }
}




/* =========================
   BACKEND FOUNDATION v1.5.0-alpha1
   ========================= */

function ensureBackendFoundation_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);

  ensureAircraftBatchColumn_(aircraftSheet);
  ensureAircraftStatusValidation_(aircraftSheet);
  getBatchesSheet_(spreadsheet);
  getSystemLogSheet_(spreadsheet);
  getBackupsSheet_(spreadsheet);
  ensureSecurityFoundation_(spreadsheet);
}


function ensureAircraftStatusValidation_(sheet) {
  const firstDataRow = 2;
  const numberOfRows = Math.max(
    sheet.getMaxRows() - firstDataRow + 1,
    1
  );

  const validation = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(ALLOWED_STATUSES, true)
    .setAllowInvalid(false)
    .setHelpText("Вибери статус зі списку")
    .build();

  sheet
    .getRange(
      firstDataRow,
      AIRCRAFT_COLUMNS.STATUS,
      numberOfRows,
      1
    )
    .setDataValidation(validation);
}


function ensureAircraftBatchColumn_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), AIRCRAFT_COLUMNS.COMMENT);
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (value) {
      return String(value || "").trim();
    });

  const batchColumnIndex = headers.findIndex(function (header) {
    return header.toUpperCase() === "BATCHID";
  });

  if (batchColumnIndex >= 0) {
    if (batchColumnIndex + 1 !== AIRCRAFT_COLUMNS.BATCH_ID) {
      throw new Error(
        "Колонка BatchID у Aircraft має бути восьмою колонкою"
      );
    }

    return;
  }

  sheet
    .getRange(1, AIRCRAFT_COLUMNS.BATCH_ID)
    .setValue("BatchID");
}


function getBatchesSheet_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(BATCHES_SHEET);

  if (!sheet) {
    sheet = book.insertSheet(BATCHES_SHEET);
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, BATCH_HEADERS.length)
      .setValues([BATCH_HEADERS]);

    return sheet;
  }

  const currentHeaders = sheet
    .getRange(1, 1, 1, BATCH_HEADERS.length)
    .getValues()[0];

  const headerRowIsEmpty = currentHeaders.every(function (value) {
    return !String(value || "").trim();
  });

  if (headerRowIsEmpty) {
    sheet
      .getRange(1, 1, 1, BATCH_HEADERS.length)
      .setValues([BATCH_HEADERS]);
  }

  return sheet;
}


function getSystemLogSheet_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SYSTEM_LOG_SHEET);

  if (!sheet) {
    sheet = book.insertSheet(SYSTEM_LOG_SHEET);
  }

  ensureHeaderRow_(sheet, SYSTEM_LOG_HEADERS);

  return sheet;
}


function getBackupsSheet_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(BACKUPS_SHEET);

  if (!sheet) {
    sheet = book.insertSheet(BACKUPS_SHEET);
  }

  ensureHeaderRow_(sheet, BACKUP_HEADERS);

  return sheet;
}


function ensureHeaderRow_(sheet, expectedHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders]);

    return;
  }

  const currentHeaders = sheet
    .getRange(1, 1, 1, expectedHeaders.length)
    .getValues()[0];

  const headerRowIsEmpty = currentHeaders.every(function (value) {
    return !String(value || "").trim();
  });

  if (headerRowIsEmpty) {
    sheet
      .getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders]);
  }
}


function logSystemEvent_(level, action, message, details) {
  try {
    const sheet = getSystemLogSheet_();
    const nextRow = sheet.getLastRow() + 1;

    sheet
      .getRange(nextRow, 1, 1, SYSTEM_LOG_HEADERS.length)
      .setValues([[
        new Date(),
        String(level || "INFO"),
        String(action || ""),
        String(message || ""),
        stringifyLogDetails_(details)
      ]]);
  } catch (loggingError) {
    console.error("SystemLog error:", loggingError);
  }
}


function stringifyLogDetails_(details) {
  if (details === undefined || details === null || details === "") {
    return "";
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch (error) {
    return String(details);
  }
}


/* =========================
   SECURITY FOUNDATION v1.6.1-alpha1
   ========================= */

function ensureSecurityFoundation_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const usersResult = getOrCreateSecuritySheet_(
    book,
    USERS_SHEET,
    USER_HEADERS
  );
  const auditResult = getOrCreateSecuritySheet_(
    book,
    AUDIT_LOG_SHEET,
    AUDIT_LOG_HEADERS
  );

  if (usersResult.created || auditResult.created) {
    appendAuditLog_(
      "",
      "",
      "",
      "SECURITY_FOUNDATION_CREATED",
      "SYSTEM",
      "",
      "SUCCESS",
      {
        usersSheetCreated: usersResult.created,
        auditLogSheetCreated: auditResult.created
      }
    );
  }

  ensureBootstrapAdmin_(usersResult.sheet);
}


function getOrCreateSecuritySheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  let created = false;

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    created = true;
  }

  ensureHeaderRow_(sheet, headers);

  return {
    sheet: sheet,
    created: created
  };
}


function getUsersSheet_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();

  return getOrCreateSecuritySheet_(
    book,
    USERS_SHEET,
    USER_HEADERS
  ).sheet;
}


function getAuditLogSheet_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();

  return getOrCreateSecuritySheet_(
    book,
    AUDIT_LOG_SHEET,
    AUDIT_LOG_HEADERS
  ).sheet;
}


function ensureBootstrapAdmin_(usersSheet) {
  const sheet = usersSheet || getUsersSheet_();
  const existingAdmin = findUserByEmail_(
    sheet,
    BOOTSTRAP_ADMIN_EMAIL
  );

  if (existingAdmin) {
    return existingAdmin;
  }

  const now = new Date();
  const userId = nextUserId_(sheet);
  const nextRow = sheet.getLastRow() + 1;

  sheet
    .getRange(nextRow, 1, 1, USER_HEADERS.length)
    .setValues([[
      userId,
      BOOTSTRAP_ADMIN_EMAIL,
      "Hornet Control Administrator",
      "ADMIN",
      true,
      now,
      now,
      "",
      "Головний службовий адміністратор"
    ]]);

  appendAuditLog_(
    BOOTSTRAP_ADMIN_EMAIL,
    userId,
    "ADMIN",
    "ADMIN_BOOTSTRAPPED",
    "USER",
    userId,
    "SUCCESS",
    {
      email: BOOTSTRAP_ADMIN_EMAIL
    }
  );

  return {
    row: nextRow,
    userId: userId,
    email: BOOTSTRAP_ADMIN_EMAIL,
    name: "Hornet Control Administrator",
    role: "ADMIN",
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLogin: "",
    comment: "Головний службовий адміністратор"
  };
}


function nextUserId_(usersSheet) {
  const sheet = usersSheet || getUsersSheet_();
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, 1, lastRow - 1, 1)
      .getValues();

    values.forEach(function (row) {
      const match = String(row[0] || "")
        .trim()
        .toUpperCase()
        .match(/^USR-(\d{6})$/);

      if (match) {
        maxNumber = Math.max(maxNumber, Number(match[1]));
      }
    });
  }

  const nextNumber = maxNumber + 1;

  if (nextNumber > 999999) {
    throw new Error("Закінчився діапазон ID користувачів");
  }

  return "USR-" + String(nextNumber).padStart(6, "0");
}


function normalizeUserEmail_(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}


function normalizeUserRole_(role) {
  const normalizedRole = String(role || "")
    .trim()
    .toUpperCase();

  if (!USER_ROLES.includes(normalizedRole)) {
    throw new Error("Некоректна роль користувача");
  }

  return normalizedRole;
}


function normalizePermission_(permission) {
  const normalizedPermission = String(permission || "")
    .trim()
    .toUpperCase();

  const validPermissions = Object.keys(PERMISSIONS).map(function (key) {
    return PERMISSIONS[key];
  });

  if (!validPermissions.includes(normalizedPermission)) {
    throw new Error("Невідомий дозвіл: " + normalizedPermission);
  }

  return normalizedPermission;
}


function getCurrentUser_(email) {
  const requestedEmail = normalizeUserEmail_(email);
  let resolvedEmail = requestedEmail;

  if (!resolvedEmail) {
    try {
      resolvedEmail = normalizeUserEmail_(
        Session.getActiveUser().getEmail()
      );
    } catch (error) {
      resolvedEmail = "";
    }
  }

  if (!resolvedEmail && !SECURITY_ENFORCEMENT_ENABLED) {
    resolvedEmail = BOOTSTRAP_ADMIN_EMAIL;
  }

  if (!resolvedEmail) {
    return null;
  }

  return findUserByEmail_(getUsersSheet_(), resolvedEmail);
}


function getCurrentUserRole_(email) {
  const user = getCurrentUser_(email);

  if (!user || !user.active) {
    return "";
  }

  return normalizeUserRole_(user.role);
}


function getRolePermissions_(role) {
  const normalizedRole = normalizeUserRole_(role);

  return (ROLE_PERMISSIONS[normalizedRole] || []).slice();
}


function hasPermission_(userOrRole, permission) {
  const normalizedPermission = normalizePermission_(permission);
  let role = "";
  let active = true;

  if (typeof userOrRole === "string") {
    role = normalizeUserRole_(userOrRole);
  } else if (userOrRole && typeof userOrRole === "object") {
    role = normalizeUserRole_(userOrRole.role);
    active = userOrRole.active !== false;
  } else {
    const currentUser = getCurrentUser_();

    if (!currentUser) {
      return false;
    }

    role = normalizeUserRole_(currentUser.role);
    active = currentUser.active;
  }

  if (!active) {
    return false;
  }

  return getRolePermissions_(role).includes(normalizedPermission);
}


function requirePermission_(permission, user) {
  const normalizedPermission = normalizePermission_(permission);
  const currentUser = user || getCurrentUser_();

  if (!SECURITY_ENFORCEMENT_ENABLED) {
    return {
      allowed: true,
      compatibilityMode: true,
      permission: normalizedPermission,
      user: currentUser
    };
  }

  if (!currentUser || !currentUser.active) {
    appendAuditLog_(
      currentUser ? currentUser.email : "",
      currentUser ? currentUser.userId : "",
      currentUser ? currentUser.role : "",
      "ACCESS_DENIED",
      "PERMISSION",
      normalizedPermission,
      "DENIED",
      {
        reason: currentUser ? "USER_DISABLED" : "USER_NOT_FOUND"
      }
    );

    throw new Error("Доступ заборонено");
  }

  if (!hasPermission_(currentUser, normalizedPermission)) {
    appendAuditLog_(
      currentUser.email,
      currentUser.userId,
      currentUser.role,
      "ACCESS_DENIED",
      "PERMISSION",
      normalizedPermission,
      "DENIED",
      {
        reason: "MISSING_PERMISSION"
      }
    );

    throw new Error("Недостатньо прав для виконання дії");
  }

  return {
    allowed: true,
    compatibilityMode: false,
    permission: normalizedPermission,
    user: currentUser
  };
}


function getPermissionEngineStatus_() {
  return {
    enforcementEnabled: SECURITY_ENFORCEMENT_ENABLED,
    roles: USER_ROLES.slice(),
    permissions: Object.keys(PERMISSIONS).map(function (key) {
      return PERMISSIONS[key];
    }),
    rolePermissions: {
      ADMIN: getRolePermissions_("ADMIN"),
      WAREHOUSE: getRolePermissions_("WAREHOUSE"),
      CLERK: getRolePermissions_("CLERK"),
      COMBAT: getRolePermissions_("COMBAT")
    }
  };
}


function findUserByEmail_(usersSheet, email) {
  const sheet = usersSheet || getUsersSheet_();
  const normalizedEmail = normalizeUserEmail_(email);

  if (!normalizedEmail) {
    return null;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, USER_HEADERS.length)
    .getValues();

  for (let index = 0; index < values.length; index++) {
    const row = values[index];
    const rowEmail = normalizeUserEmail_(row[1]);

    if (rowEmail === normalizedEmail) {
      return {
        row: index + 2,
        userId: String(row[0] || ""),
        email: rowEmail,
        name: String(row[2] || ""),
        role: String(row[3] || "").trim().toUpperCase(),
        active: normalizeBoolean_(row[4]),
        createdAt: row[5] || "",
        updatedAt: row[6] || "",
        lastLogin: row[7] || "",
        comment: String(row[8] || "")
      };
    }
  }

  return null;
}


function appendAuditLog_(
  email,
  userId,
  role,
  action,
  entityType,
  entityId,
  result,
  details
) {
  try {
    const sheet = getAuditLogSheet_();
    const nextRow = sheet.getLastRow() + 1;

    sheet
      .getRange(nextRow, 1, 1, AUDIT_LOG_HEADERS.length)
      .setValues([[
        new Date(),
        normalizeUserEmail_(email),
        String(userId || ""),
        String(role || "").trim().toUpperCase(),
        String(action || ""),
        String(entityType || ""),
        String(entityId || ""),
        String(result || "SUCCESS").trim().toUpperCase(),
        stringifyLogDetails_(details)
      ]]);
  } catch (loggingError) {
    console.error("AuditLog error:", loggingError);
  }
}


/* =========================
   BACKUP & RECOVERY v1.6.0-alpha2
   ========================= */

function createBackup(comment) {
  ensureBackendFoundation_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceFile = DriveApp.getFileById(spreadsheet.getId());
    const backupFolder = getOrCreateBackupFolder_(sourceFile);
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd_HH-mm-ss"
    );
    const backupName = "Hornet_Control_Backup_" + timestamp;
    const backupFile = sourceFile.makeCopy(backupName, backupFolder);
    const backupId = nextBackupId_();
    const createdAt = new Date();
    const safeComment = String(comment || "").trim();

    const sheet = getBackupsSheet_(spreadsheet);
    const nextRow = sheet.getLastRow() + 1;

    sheet
      .getRange(nextRow, 1, 1, BACKUP_HEADERS.length)
      .setValues([[
        backupId,
        createdAt,
        backupName,
        backupFile.getId(),
        backupFile.getUrl(),
        safeComment
      ]]);

    logSystemEvent_(
      "INFO",
      "CREATE_BACKUP",
      "Резервну копію створено",
      {
        backupId: backupId,
        fileId: backupFile.getId(),
        name: backupName
      }
    );

    return {
      backupId: backupId,
      createdAt: formatDate_(createdAt, "dd.MM.yyyy HH:mm:ss"),
      name: backupName,
      fileId: backupFile.getId(),
      url: backupFile.getUrl(),
      comment: safeComment,
      message: "Резервну копію створено"
    };
  } finally {
    lock.releaseLock();
  }
}


function listBackups(limit) {
  ensureBackendFoundation_();

  const sheet = getBackupsSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const requestedLimit = Math.max(
    1,
    Math.min(Number(limit) || 20, 100)
  );
  const values = sheet
    .getRange(2, 1, lastRow - 1, BACKUP_HEADERS.length)
    .getValues();

  return values
    .reverse()
    .slice(0, requestedLimit)
    .map(function (row) {
      const fileId = String(row[3] || "").trim();
      let available = false;

      if (fileId) {
        try {
          DriveApp.getFileById(fileId).getName();
          available = true;
        } catch (error) {
          available = false;
        }
      }

      return {
        backupId: String(row[0] || ""),
        createdAt: formatDate_(row[1], "dd.MM.yyyy HH:mm:ss"),
        name: String(row[2] || ""),
        fileId: fileId,
        url: String(row[4] || ""),
        comment: String(row[5] || ""),
        available: available
      };
    });
}


function getOrCreateBackupFolder_(sourceFile) {
  const parents = sourceFile.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const folders = parent.getFoldersByName(BACKUP_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(BACKUP_FOLDER_NAME);
}


function nextBackupId_() {
  const sheet = getBackupsSheet_();
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, 1, lastRow - 1, 1)
      .getValues();

    values.forEach(function (row) {
      const match = String(row[0] || "")
        .trim()
        .toUpperCase()
        .match(/^BK-(\d{6})$/);

      if (match) {
        maxNumber = Math.max(maxNumber, Number(match[1]));
      }
    });
  }

  return "BK-" + String(maxNumber + 1).padStart(6, "0");
}


function healthCheck() {
  ensureBackendFoundation_();

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const report = {
    ok: true,
    checkedAt: formatDate_(new Date(), "dd.MM.yyyy HH:mm:ss"),
    summary: {
      errors: 0,
      warnings: 0,
      repaired: 0
    },
    sheets: [],
    issues: []
  };

  const sheetDefinitions = [
    {
      name: AIRCRAFT_SHEET,
      headers: AIRCRAFT_HEADERS
    },
    {
      name: HISTORY_SHEET,
      headers: [
        "Timestamp",
        "AircraftID",
        "OldStatus",
        "NewStatus",
        "Comment"
      ]
    },
    {
      name: STARLINKS_SHEET,
      headers: [
        "ID",
        "Status",
        "AircraftID",
        "SerialNumber",
        "Comment"
      ]
    },
    {
      name: QR_QUEUE_SHEET,
      headers: [
        "AircraftID",
        "Created",
        "Printed",
        "PrintedDate"
      ]
    },
    {
      name: SETTINGS_SHEET,
      headers: [
        "Key",
        "Value"
      ]
    },
    {
      name: PRINT_TEMPLATES_SHEET,
      headers: [
        "ID",
        "Name",
        "Type",
        "PageWidth",
        "PageHeight",
        "Columns",
        "Rows",
        "LabelWidth",
        "LabelHeight",
        "MarginLeft",
        "MarginTop",
        "GapX",
        "GapY",
        "QRSize",
        "ShowSerial",
        "Title",
        "IdFontSize",
        "SerialFontSize"
      ]
    },
    {
      name: BATCHES_SHEET,
      headers: BATCH_HEADERS
    },
    {
      name: SYSTEM_LOG_SHEET,
      headers: SYSTEM_LOG_HEADERS
    },
    {
      name: BACKUPS_SHEET,
      headers: BACKUP_HEADERS
    },
    {
      name: USERS_SHEET,
      headers: USER_HEADERS
    },
    {
      name: AUDIT_LOG_SHEET,
      headers: AUDIT_LOG_HEADERS
    }
  ];

  sheetDefinitions.forEach(function (definition) {
    const sheet = spreadsheet.getSheetByName(definition.name);

    if (!sheet) {
      addHealthIssue_(
        report,
        "ERROR",
        "MISSING_SHEET",
        definition.name,
        'Відсутній аркуш "' + definition.name + '"'
      );

      return;
    }

    const currentHeaders = sheet
      .getRange(1, 1, 1, definition.headers.length)
      .getValues()[0]
      .map(function (value) {
        return String(value || "").trim();
      });

    const mismatches = [];

    definition.headers.forEach(function (expectedHeader, index) {
      if (currentHeaders[index] !== expectedHeader) {
        mismatches.push({
          column: index + 1,
          expected: expectedHeader,
          actual: currentHeaders[index]
        });
      }
    });

    report.sheets.push({
      name: definition.name,
      rows: Math.max(sheet.getLastRow() - 1, 0),
      columns: sheet.getLastColumn(),
      schemaOk: mismatches.length === 0
    });

    if (mismatches.length) {
      addHealthIssue_(
        report,
        "WARNING",
        "HEADER_MISMATCH",
        definition.name,
        "Структура заголовків відрізняється від очікуваної",
        mismatches
      );
    }
  });

  inspectAircraftIntegrity_(report);
  inspectStarlinkIntegrity_(report);
  inspectQrQueueIntegrity_(report);

  report.ok = report.summary.errors === 0;

  logSystemEvent_(
    report.ok ? "INFO" : "ERROR",
    "HEALTH_CHECK",
    report.ok
      ? "Перевірку цілісності завершено"
      : "Перевірка виявила критичні помилки",
    report.summary
  );

  return report;
}


function addHealthIssue_(
  report,
  severity,
  code,
  source,
  message,
  details
) {
  const normalizedSeverity = String(severity || "WARNING").toUpperCase();

  report.issues.push({
    severity: normalizedSeverity,
    code: String(code || ""),
    source: String(source || ""),
    message: String(message || ""),
    details: details || null
  });

  if (normalizedSeverity === "ERROR") {
    report.summary.errors++;
  } else {
    report.summary.warnings++;
  }
}


function inspectAircraftIntegrity_(report) {
  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues();

  const idRows = {};
  const serialRows = {};
  const validAircraftIds = {};

  values.forEach(function (row, index) {
    const sheetRow = index + 2;
    const rawId = String(row[AIRCRAFT_COLUMNS.ID - 1] || "").trim();
    const id = normalizeAircraftId_(rawId);
    const serial = String(
      row[AIRCRAFT_COLUMNS.SERIAL_NUMBER - 1] || ""
    )
      .trim()
      .toUpperCase();

    const status = String(
      row[AIRCRAFT_COLUMNS.STATUS - 1] || ""
    ).trim();

    if (rawId && !id) {
      addHealthIssue_(
        report,
        "ERROR",
        "INVALID_AIRCRAFT_ID",
        AIRCRAFT_SHEET,
        "Некоректний ID борта в рядку " + sheetRow,
        {
          row: sheetRow,
          value: rawId
        }
      );
    }

    if (id) {
      validAircraftIds[id] = true;

      if (!idRows[id]) {
        idRows[id] = [];
      }

      idRows[id].push(sheetRow);
    }

    if (serial) {
      if (!serialRows[serial]) {
        serialRows[serial] = [];
      }

      serialRows[serial].push(sheetRow);
    }

    if (status && !ALLOWED_STATUSES.includes(status)) {
      addHealthIssue_(
        report,
        "WARNING",
        "INVALID_AIRCRAFT_STATUS",
        AIRCRAFT_SHEET,
        "Невідомий статус борта в рядку " + sheetRow,
        {
          row: sheetRow,
          value: status
        }
      );
    }
  });

  Object.keys(idRows).forEach(function (id) {
    if (idRows[id].length > 1) {
      addHealthIssue_(
        report,
        "ERROR",
        "DUPLICATE_AIRCRAFT_ID",
        AIRCRAFT_SHEET,
        "Дублікат ID борта " + id,
        {
          rows: idRows[id]
        }
      );
    }
  });

  Object.keys(serialRows).forEach(function (serial) {
    if (serialRows[serial].length > 1) {
      addHealthIssue_(
        report,
        "ERROR",
        "DUPLICATE_AIRCRAFT_SERIAL",
        AIRCRAFT_SHEET,
        "Дублікат серійного номера борта " + serial,
        {
          rows: serialRows[serial]
        }
      );
    }
  });

  report._validAircraftIds = validAircraftIds;
}


function inspectStarlinkIntegrity_(report) {
  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, STARLINK_COLUMNS.COMMENT)
    .getValues();

  const idRows = {};
  const serialRows = {};
  const validAircraftIds = report._validAircraftIds || {};

  values.forEach(function (row, index) {
    const sheetRow = index + 2;
    const id = normalizeStarlinkId_(row[STARLINK_COLUMNS.ID - 1]);
    const serial = String(
      row[STARLINK_COLUMNS.SERIAL_NUMBER - 1] || ""
    )
      .trim()
      .toUpperCase();

    const aircraftId = normalizeAircraftId_(
      row[STARLINK_COLUMNS.AIRCRAFT_ID - 1]
    );

    if (id) {
      if (!idRows[id]) {
        idRows[id] = [];
      }

      idRows[id].push(sheetRow);
    }

    if (serial) {
      if (!serialRows[serial]) {
        serialRows[serial] = [];
      }

      serialRows[serial].push(sheetRow);
    }

    if (aircraftId && !validAircraftIds[aircraftId]) {
      addHealthIssue_(
        report,
        "ERROR",
        "ORPHAN_STARLINK_LINK",
        STARLINKS_SHEET,
        "Starlink прив’язаний до неіснуючого борта " + aircraftId,
        {
          row: sheetRow,
          starlinkId: id,
          aircraftId: aircraftId
        }
      );
    }
  });

  Object.keys(idRows).forEach(function (id) {
    if (idRows[id].length > 1) {
      addHealthIssue_(
        report,
        "ERROR",
        "DUPLICATE_STARLINK_ID",
        STARLINKS_SHEET,
        "Дублікат ID Starlink " + id,
        {
          rows: idRows[id]
        }
      );
    }
  });

  Object.keys(serialRows).forEach(function (serial) {
    if (serialRows[serial].length > 1) {
      addHealthIssue_(
        report,
        "ERROR",
        "DUPLICATE_STARLINK_SERIAL",
        STARLINKS_SHEET,
        "Дублікат серійного номера Starlink " + serial,
        {
          rows: serialRows[serial]
        }
      );
    }
  });

  delete report._validAircraftIds;
}


function inspectQrQueueIntegrity_(report) {
  const sheet = getQrQueueSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 4)
    .getValues();

  const activeRows = {};

  values.forEach(function (row, index) {
    const sheetRow = index + 2;
    const aircraftId = normalizeAircraftId_(row[0]);
    const printed = normalizeBoolean_(row[2]);

    if (!aircraftId) {
      addHealthIssue_(
        report,
        "WARNING",
        "INVALID_QR_QUEUE_ID",
        QR_QUEUE_SHEET,
        "Некоректний ID у черзі QR",
        {
          row: sheetRow,
          value: row[0]
        }
      );

      return;
    }

    if (!printed) {
      if (!activeRows[aircraftId]) {
        activeRows[aircraftId] = [];
      }

      activeRows[aircraftId].push(sheetRow);
    }
  });

  Object.keys(activeRows).forEach(function (aircraftId) {
    if (activeRows[aircraftId].length > 1) {
      addHealthIssue_(
        report,
        "WARNING",
        "DUPLICATE_ACTIVE_QR",
        QR_QUEUE_SHEET,
        "Борт має кілька активних записів у черзі QR: " + aircraftId,
        {
          rows: activeRows[aircraftId]
        }
      );
    }
  });
}


function dashboard() {
  ensureBackendFoundation_();

  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const starlinksSheet = getRequiredSheet_(STARLINKS_SHEET);
  const qrQueueSheet = getQrQueueSheet_();

  const aircraftCounts = {
    Active: 0,
    Warehouse: 0,
    Workshop: 0,
    Ready: 0,
    Damaged: 0,
    Used: 0,
    Total: 0
  };

  const aircraftLastRow = aircraftSheet.getLastRow();

  if (aircraftLastRow >= 2) {
    const aircraftValues = aircraftSheet
      .getRange(
        2,
        AIRCRAFT_COLUMNS.ID,
        aircraftLastRow - 1,
        2
      )
      .getValues();

    aircraftValues.forEach(function (row) {
      const id = normalizeAircraftId_(row[0]);

      if (!id) {
        return;
      }

      const status = String(row[1] || "").trim();

      aircraftCounts.Total++;

      if (status === "Активний") {
        aircraftCounts.Active++;
      } else if (status === "На складі") {
        aircraftCounts.Warehouse++;
      } else if (status === "Майстерня") {
        aircraftCounts.Workshop++;
      } else if (status === "БГ") {
        aircraftCounts.Ready++;
      } else if (status === "Пошкоджено") {
        aircraftCounts.Damaged++;
      } else if (
        status === "Використаний" ||
        status === "Списаний"
      ) {
        aircraftCounts.Used++;
      }
    });
  }

  const starlinkCounts = {
    Free: 0,
    Assigned: 0,
    Broken: 0,
    Lost: 0,
    Total: 0
  };

  const starlinksLastRow = starlinksSheet.getLastRow();

  if (starlinksLastRow >= 2) {
    const values = starlinksSheet
      .getRange(2, 1, starlinksLastRow - 1, 3)
      .getValues();

    values.forEach(function (row) {
      const id = String(row[0] || "").trim();

      if (!id) {
        return;
      }

      const status = String(row[1] || "").trim();
      const aircraftId = String(row[2] || "").trim();

      starlinkCounts.Total++;

      if (status === "Втрачений" || status === "Списаний") {
        starlinkCounts.Lost++;
      } else if (status === "Несправний" || status === "Ремонт") {
        starlinkCounts.Broken++;
      } else if (status === "На борту" || aircraftId) {
        starlinkCounts.Assigned++;
      } else {
        starlinkCounts.Free++;
      }
    });
  }

  let queued = 0;
  let history = 0;
  const qrLastRow = qrQueueSheet.getLastRow();

  if (qrLastRow >= 2) {
    const qrValues = qrQueueSheet
      .getRange(2, 1, qrLastRow - 1, 4)
      .getValues();

    qrValues.forEach(function (row) {
      const id = normalizeAircraftId_(row[0]);

      if (!id) {
        return;
      }

      if (normalizeBoolean_(row[2])) {
        history++;
      } else {
        queued++;
      }
    });
  }

  return {
    Aircraft: aircraftCounts,
    Starlink: starlinkCounts,
    QR: {
      Queued: queued,
      History: history
    }
  };
}


function listAircraftByStatus(status) {
  ensureBackendFoundation_();

  const normalizedStatus = String(status || "").trim();

  if (!normalizedStatus) {
    throw new Error("Не вказано статус борта");
  }

  const acceptedStatus = normalizeAircraftStatusFilter_(normalizedStatus);
  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues();

  return values
    .map(function (row, index) {
      return aircraftFromValues_(row, index + 2);
    })
    .filter(function (aircraft) {
      return aircraftStatusMatchesFilter_(
        aircraft.status,
        acceptedStatus
      );
    });
}


function listStarlinksByStatus(status) {
  const normalizedStatus = String(status || "").trim();

  if (!normalizedStatus) {
    throw new Error("Не вказано статус STARLINK");
  }

  const acceptedStatus = normalizeStarlinkStatusFilter_(normalizedStatus);
  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 5)
    .getValues();

  return values
    .map(function (row, index) {
      return {
        row: index + 2,
        id: String(row[0] || ""),
        status: String(row[1] || "Вільний"),
        linkedAircraft: String(row[2] || ""),
        serialNumber: String(row[3] || ""),
        comment: String(row[4] || "")
      };
    })
    .filter(function (starlink) {
      return starlinkStatusMatchesFilter_(
        starlink,
        acceptedStatus
      );
    });
}


function createBatch(
  quantity,
  status,
  createdDate,
  comment,
  serialNumbers
) {
  const parsedQuantity = Number(quantity);
  const normalizedStatus = String(status || "На складі").trim();
  const parsedCreatedDate = parseReceivedDate_(createdDate) || new Date();
  const normalizedComment = String(comment || "").trim();

  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
    throw new Error("Кількість має бути додатним цілим числом");
  }

  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    throw new Error("Некоректний статус");
  }

  const normalizedSerialNumbers = parseBatchSerialNumbers_(
    serialNumbers,
    parsedQuantity
  );

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    ensureBackendFoundation_();

    const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
    const batchesSheet = getBatchesSheet_();
    const historySheet = getRequiredSheet_(HISTORY_SHEET);
    const qrQueueSheet = getQrQueueSheet_();

    validateBatchSerialNumbers_(
      aircraftSheet,
      normalizedSerialNumbers
    );

    const batchId = getNextBatchIdFromSheet_(batchesSheet);
    const firstAircraftId = getNextAircraftIdFromSheet_(aircraftSheet);
    const firstAircraftNumber = Number(firstAircraftId.slice(3));
    const lastAircraftNumber = firstAircraftNumber + parsedQuantity - 1;

    if (lastAircraftNumber > 9999) {
      throw new Error(
        "Партія виходить за межі діапазону HN-0001–HN-9999"
      );
    }

    const now = new Date();
    const aircraftRows = [];
    const historyRows = [];
    const qrRows = [];
    const aircraftIds = [];

    for (let index = 0; index < parsedQuantity; index++) {
      const aircraftId =
        "HN-" +
        String(firstAircraftNumber + index).padStart(4, "0");

      aircraftIds.push(aircraftId);

      aircraftRows.push([
        aircraftId,
        normalizedStatus,
        "",
        normalizedSerialNumbers[index] || "",
        parsedCreatedDate,
        now,
        normalizedComment,
        batchId
      ]);

      historyRows.push([
        now,
        aircraftId,
        "",
        normalizedStatus,
        "BATCH_CREATE: " + batchId
      ]);

      qrRows.push([
        aircraftId,
        now,
        false,
        ""
      ]);
    }

    const batchRow = [[
      batchId,
      parsedCreatedDate,
      parsedQuantity,
      normalizedComment,
      aircraftIds[0],
      aircraftIds[aircraftIds.length - 1],
      now
    ]];

    const startRows = {
      aircraft: aircraftSheet.getLastRow() + 1,
      batches: batchesSheet.getLastRow() + 1,
      history: historySheet.getLastRow() + 1,
      qr: qrQueueSheet.getLastRow() + 1
    };

    const written = {
      aircraft: false,
      batches: false,
      history: false,
      qr: false
    };

    try {
      aircraftSheet
        .getRange(
          startRows.aircraft,
          1,
          aircraftRows.length,
          AIRCRAFT_COLUMNS.BATCH_ID
        )
        .setValues(aircraftRows);
      written.aircraft = true;

      batchesSheet
        .getRange(
          startRows.batches,
          1,
          1,
          BATCH_HEADERS.length
        )
        .setValues(batchRow);
      written.batches = true;

      historySheet
        .getRange(
          startRows.history,
          1,
          historyRows.length,
          5
        )
        .setValues(historyRows);
      written.history = true;

      qrQueueSheet
        .getRange(
          startRows.qr,
          1,
          qrRows.length,
          4
        )
        .setValues(qrRows);
      written.qr = true;
    } catch (error) {
      rollbackBatchWrite_(
        aircraftSheet,
        batchesSheet,
        historySheet,
        qrQueueSheet,
        startRows,
        written,
        parsedQuantity
      );

      throw error;
    }

    return {
      success: true,
      message: "Партію створено",
      quantity: parsedQuantity,
      firstAircraft: aircraftIds[0],
      lastAircraft: aircraftIds[aircraftIds.length - 1],
      aircraftIds: aircraftIds
    };
  } finally {
    lock.releaseLock();
  }
}


function rollbackBatchWrite_(
  aircraftSheet,
  batchesSheet,
  historySheet,
  qrQueueSheet,
  startRows,
  written,
  quantity
) {
  if (written.qr) {
    qrQueueSheet
      .getRange(startRows.qr, 1, quantity, 4)
      .clearContent();
  }

  if (written.history) {
    historySheet
      .getRange(startRows.history, 1, quantity, 5)
      .clearContent();
  }

  if (written.batches) {
    batchesSheet
      .getRange(startRows.batches, 1, 1, BATCH_HEADERS.length)
      .clearContent();
  }

  if (written.aircraft) {
    aircraftSheet
      .getRange(
        startRows.aircraft,
        1,
        quantity,
        AIRCRAFT_COLUMNS.BATCH_ID
      )
      .clearContent();
  }
}


function parseBatchSerialNumbers_(serialNumbers, quantity) {
  let values = [];

  if (Array.isArray(serialNumbers)) {
    values = serialNumbers;
  } else {
    const text = String(serialNumbers || "").trim();

    if (text) {
      try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
          values = parsed;
        } else {
          values = text.split(/[\n,;]+/);
        }
      } catch (error) {
        values = text.split(/[\n,;]+/);
      }
    }
  }

  const normalized = values.map(function (value) {
    return String(value || "").trim();
  });

  if (normalized.length > quantity) {
    throw new Error(
      "Передано більше серійних номерів, ніж бортів у партії"
    );
  }

  while (normalized.length < quantity) {
    normalized.push("");
  }

  const nonEmpty = normalized
    .filter(function (value) {
      return Boolean(value);
    })
    .map(function (value) {
      return value.toUpperCase();
    });

  if (new Set(nonEmpty).size !== nonEmpty.length) {
    throw new Error("У партії є дублікати серійних номерів");
  }

  return normalized;
}


function validateBatchSerialNumbers_(sheet, serialNumbers) {
  const requested = new Set(
    serialNumbers
      .filter(function (value) {
        return Boolean(value);
      })
      .map(function (value) {
        return value.toUpperCase();
      })
  );

  if (!requested.size) {
    return;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(
      2,
      AIRCRAFT_COLUMNS.ID,
      lastRow - 1,
      AIRCRAFT_COLUMNS.SERIAL_NUMBER
    )
    .getValues();

  for (let index = 0; index < values.length; index++) {
    const serial = String(
      values[index][AIRCRAFT_COLUMNS.SERIAL_NUMBER - 1] || ""
    )
      .trim()
      .toUpperCase();

    if (serial && requested.has(serial)) {
      const aircraftId = String(
        values[index][AIRCRAFT_COLUMNS.ID - 1] || ""
      ).trim();

      throw new Error(
        "Серійний номер " +
        serial +
        " уже використовується бортом " +
        aircraftId
      );
    }
  }
}


function getNextBatchIdFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, BATCH_COLUMNS.ID, lastRow - 1, 1)
      .getValues();

    values.forEach(function (row) {
      const match = String(row[0] || "")
        .trim()
        .toUpperCase()
        .match(/^BT-(\d{6})$/);

      if (!match) {
        return;
      }

      maxNumber = Math.max(maxNumber, Number(match[1]));
    });
  }

  const nextNumber = maxNumber + 1;

  if (nextNumber > 999999) {
    throw new Error("Закінчився діапазон ID партій");
  }

  return "BT-" + String(nextNumber).padStart(6, "0");
}


function normalizeAircraftStatusFilter_(status) {
  const aliases = {
    ACTIVE: "Активний",
    "АКТИВНІ": "Активний",
    "АКТИВНИЙ": "Активний",
    WAREHOUSE: "На складі",
    "НА СКЛАДІ": "На складі",
    WORKSHOP: "Майстерня",
    "МАЙСТЕРНЯ": "Майстерня",
    READY: "БГ",
    "БГ": "БГ",
    DAMAGED: "Пошкоджено",
    "ПОШКОДЖЕНО": "Пошкоджено",
    USED: "Використаний",
    "ВИКОРИСТАНІ": "Використаний",
    "ВИКОРИСТАНИЙ": "Використаний"
  };

  const key = String(status || "").trim().toUpperCase();
  const normalized = aliases[key] || String(status || "").trim();

  if (!ALLOWED_STATUSES.includes(normalized)) {
    throw new Error("Некоректний статус борта");
  }

  return normalized;
}


function aircraftStatusMatchesFilter_(status, filterStatus) {
  const current = String(status || "").trim();

  if (filterStatus === "Використаний") {
    return current === "Використаний" || current === "Списаний";
  }

  return current === filterStatus;
}


function normalizeStarlinkStatusFilter_(status) {
  const aliases = {
    FREE: "Вільний",
    "ВІЛЬНІ": "Вільний",
    "ВІЛЬНИЙ": "Вільний",
    ASSIGNED: "На борту",
    "НА БОРТАХ": "На борту",
    "НА БОРТУ": "На борту",
    BROKEN: "Несправний",
    "НЕСПРАВНІ": "Несправний",
    "НЕСПРАВНИЙ": "Несправний",
    LOST: "Втрачений",
    "ВТРАЧЕНІ": "Втрачений",
    "ВТРАЧЕНИЙ": "Втрачений"
  };

  const key = String(status || "").trim().toUpperCase();
  const normalized = aliases[key] || String(status || "").trim();

  if (
    !["Вільний", "На борту", "Несправний", "Втрачений"].includes(
      normalized
    )
  ) {
    throw new Error("Некоректний статус STARLINK");
  }

  return normalized;
}


function starlinkStatusMatchesFilter_(starlink, filterStatus) {
  const status = String(starlink.status || "").trim();
  const linkedAircraft = String(starlink.linkedAircraft || "").trim();

  if (filterStatus === "Втрачений") {
    return status === "Втрачений" || status === "Списаний";
  }

  if (filterStatus === "Несправний") {
    return status === "Несправний" || status === "Ремонт";
  }

  if (filterStatus === "На борту") {
    return status === "На борту" || Boolean(linkedAircraft);
  }

  return (
    !linkedAircraft &&
    !BLOCKED_STARLINK_STATUSES.includes(status) &&
    status !== "На борту"
  );
}


/* =========================
   AIRCRAFT
   ========================= */

function getAircraft(id) {
  const normalizedId = normalizeAircraftId_(id);

  if (!normalizedId) {
    throw new Error("Введіть ID борта");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const row = findAircraftRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("Борт " + normalizedId + " не знайдено");
  }

  return aircraftFromRow_(sheet, row);
}


function searchAircraft(query) {
  const text = String(query || "").trim().toUpperCase();

  if (!text) {
    throw new Error("Введіть ID або серійний номер");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet
    .getRange(2, 1, lastRow - 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues();
  const result = [];

  values.forEach(function (row, index) {
    const id = String(row[0] || "").trim().toUpperCase();
    const serial = String(row[3] || "").trim().toUpperCase();

    if (id.includes(text) || serial.includes(text)) {
      result.push({
        row: index + 2,
        id: String(row[0] || ""),
        status: String(row[1] || "Не вказано"),
        starlink: String(row[2] || ""),
        serialNumber: String(row[3] || ""),
        receivedDate: formatDate_(row[4], "dd.MM.yyyy"),
        lastChange: formatDate_(row[5], "dd.MM.yyyy HH:mm:ss"),
        comment: String(row[6] || "")
      });
    }
  });

  return result.slice(0, 25);
}


function getNextAircraftId() {
  const sheet =
    getRequiredSheet_(AIRCRAFT_SHEET);

  return getNextAircraftIdFromSheet_(sheet);
}


function createAircraft(
  status,
  serialNumber,
  receivedDate,
  comment
) {
  const normalizedStatus = String(
    status || "На складі"
  ).trim();

  const normalizedSerialNumber = String(
    serialNumber || ""
  ).trim();

  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    throw new Error("Некоректний статус");
  }

  const parsedReceivedDate =
    parseReceivedDate_(receivedDate);

  const lock = LockService.getDocumentLock();

  lock.waitLock(20000);

  try {
    const sheet =
      getRequiredSheet_(AIRCRAFT_SHEET);

    const newAircraftId =
      getNextAircraftIdFromSheet_(sheet);

    if (normalizedSerialNumber) {
      const duplicateSerialRow =
        findAircraftRowBySerial_(
          sheet,
          normalizedSerialNumber
        );

      if (duplicateSerialRow) {
        const existingAircraftId = String(
          sheet
            .getRange(
              duplicateSerialRow,
              AIRCRAFT_COLUMNS.ID
            )
            .getValue() || ""
        ).trim();

        throw new Error(
          "Серійний номер " +
          normalizedSerialNumber +
          " уже використовується бортом " +
          existingAircraftId
        );
      }
    }

    const now = new Date();

    sheet.appendRow([
      newAircraftId,
      normalizedStatus,
      "",
      normalizedSerialNumber,
      parsedReceivedDate || "",
      now,
      String(comment || "").trim(),
      ""
    ]);

    appendHistory_(
      now,
      newAircraftId,
      "",
      normalizedStatus,
      "СТВОРЕНО БОРТ"
    );

    appendQrQueue_(
      newAircraftId,
      now
    );

    return {
      success: true,
      message: "Борт додано",
      aircraft: getAircraft(newAircraftId)
    };
  } finally {
    lock.releaseLock();
  }
}


function updateAircraftStatus(id, newStatus) {
  const normalizedId = normalizeAircraftId_(id);
  const normalizedStatus = String(newStatus || "").trim();

  if (!normalizedId) {
    throw new Error("Не вказано ID борта");
  }

  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    throw new Error("Некоректний статус");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const row = findAircraftRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("Борт " + normalizedId + " не знайдено");
  }

  const oldStatus = String(
    sheet.getRange(row, AIRCRAFT_COLUMNS.STATUS).getValue() || ""
  ).trim();

  if (oldStatus === normalizedStatus) {
    return {
      success: true,
      unchanged: true,
      message: "Цей статус уже встановлений",
      status: normalizedStatus
    };
  }

  const now = new Date();

  sheet.getRange(row, AIRCRAFT_COLUMNS.STATUS).setValue(normalizedStatus);
  sheet.getRange(row, AIRCRAFT_COLUMNS.LAST_CHANGE).setValue(now);

  appendHistory_(now, normalizedId, oldStatus, normalizedStatus, "");

  if (normalizedStatus === "Використаний") {
    markLinkedStarlinkLost_(sheet, row);
  }

  return {
    success: true,
    unchanged: false,
    message: "Статус оновлено",
    status: normalizedStatus,
    lastChange: formatDate_(now, "dd.MM.yyyy HH:mm:ss")
  };
}


function updateAircraftDetails(
  id,
  serialNumber,
  receivedDate,
  comment
) {
  const normalizedId = normalizeAircraftId_(id);

  if (!normalizedId) {
    throw new Error("Не вказано ID борта");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const row = findAircraftRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("Борт " + normalizedId + " не знайдено");
  }

  const oldValues = sheet
    .getRange(row, 1, 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues()[0];

  const oldSerialNumber = String(oldValues[3] || "").trim();
  const oldReceivedDate = formatDate_(oldValues[4], "dd.MM.yyyy");
  const oldComment = String(oldValues[6] || "").trim();

  const newSerialNumber = String(
    serialNumber || ""
  ).trim();

  const newComment = String(
    comment || ""
  ).trim();

  const parsedReceivedDate =
    parseReceivedDate_(receivedDate);

  if (newSerialNumber) {
    const duplicateSerialRow =
      findAircraftRowBySerial_(
        sheet,
        newSerialNumber,
        row
      );

    if (duplicateSerialRow) {
      const existingAircraftId = String(
        sheet
          .getRange(
            duplicateSerialRow,
            AIRCRAFT_COLUMNS.ID
          )
          .getValue() || ""
      ).trim();

      throw new Error(
        "Серійний номер " +
        newSerialNumber +
        " уже використовується бортом " +
        existingAircraftId
      );
    }
  }

  const newReceivedDateText = parsedReceivedDate
    ? formatDate_(parsedReceivedDate, "dd.MM.yyyy")
    : "";

  const changes = [];

  if (oldSerialNumber !== newSerialNumber) {
    changes.push(
      "Серійний номер: " +
      (oldSerialNumber || "не вказано") +
      " → " +
      (newSerialNumber || "не вказано")
    );
  }

  if (oldReceivedDate !== newReceivedDateText) {
    changes.push(
      "Дата отримання: " +
      (oldReceivedDate || "не вказано") +
      " → " +
      (newReceivedDateText || "не вказано")
    );
  }

  if (oldComment !== newComment) {
    changes.push("Коментар змінено");
  }

  if (!changes.length) {
    return {
      success: true,
      unchanged: true,
      message: "Змін немає",
      aircraft: getAircraft(normalizedId)
    };
  }

  const now = new Date();

  sheet
    .getRange(row, AIRCRAFT_COLUMNS.SERIAL_NUMBER)
    .setValue(newSerialNumber);

  if (parsedReceivedDate) {
    sheet
      .getRange(row, AIRCRAFT_COLUMNS.RECEIVED_DATE)
      .setValue(parsedReceivedDate);
  } else {
    sheet
      .getRange(row, AIRCRAFT_COLUMNS.RECEIVED_DATE)
      .clearContent();
  }

  sheet
    .getRange(row, AIRCRAFT_COLUMNS.COMMENT)
    .setValue(newComment);

  sheet
    .getRange(row, AIRCRAFT_COLUMNS.LAST_CHANGE)
    .setValue(now);

  appendHistory_(
    now,
    normalizedId,
    "",
    "",
    "ДАНІ БОРТА: " + changes.join("; ")
  );

  return {
    success: true,
    unchanged: false,
    message: "Дані борта оновлено",
    aircraft: getAircraft(normalizedId)
  };
}


/* =========================
   STARLINKS
   ========================= */

function getAvailableStarlinks(aircraftId) {
  const normalizedAircraftId = normalizeAircraftId_(aircraftId);

  if (!normalizedAircraftId) {
    throw new Error("Не вказано ID борта");
  }

  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const result = [];

  values.forEach(function (row) {
    const id = String(row[0] || "").trim();
    const status = String(row[1] || "").trim();
    const linkedAircraft = String(row[2] || "").trim().toUpperCase();

    if (!id) return;

    const blocked = BLOCKED_STARLINK_STATUSES.includes(status);
    const belongsToCurrentAircraft =
      linkedAircraft === normalizedAircraftId;
    const isFree = !linkedAircraft && !blocked;

    if (isFree || belongsToCurrentAircraft) {
      result.push({
        id: id,
        status: status || "Вільний",
        linkedAircraft: linkedAircraft,
        current: belongsToCurrentAircraft
      });
    }
  });

  result.sort(function (a, b) {
    if (a.current && !b.current) return -1;
    if (!a.current && b.current) return 1;
    return a.id.localeCompare(b.id);
  });

  return result;
}


function getStarlink(id) {
  const normalizedId = normalizeStarlinkId_(id);

  if (!normalizedId) {
    throw new Error("Не вказано ID STARLINK");
  }

  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const row = findStarlinkRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("STARLINK " + normalizedId + " не знайдено");
  }

  const values = sheet.getRange(row, 1, 1, 5).getValues()[0];

  return {
    row: row,
    id: String(values[0] || ""),
    status: String(values[1] || "Вільний"),
    linkedAircraft: String(values[2] || ""),
    serialNumber: String(values[3] || ""),
    comment: String(values[4] || "")
  };
}


function searchStarlinks(query) {
  const text = String(query || "").trim().toUpperCase();

  if (!text) {
    throw new Error("Введіть ID або серійний номер STARLINK");
  }

  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const result = [];

  values.forEach(function (row, index) {
    const id = String(row[0] || "").trim().toUpperCase();
    const serial = String(row[3] || "").trim().toUpperCase();

    if (id.includes(text) || serial.includes(text)) {
      result.push({
        row: index + 2,
        id: String(row[0] || ""),
        status: String(row[1] || "Вільний"),
        linkedAircraft: String(row[2] || ""),
        serialNumber: String(row[3] || ""),
        comment: String(row[4] || "")
      });
    }
  });

  return result.slice(0, 25);
}


function getNextStarlinkId() {
  const sheet =
    getRequiredSheet_(STARLINKS_SHEET);

  return getNextStarlinkIdFromSheet_(sheet);
}


function createStarlink(
  serialNumber,
  comment
) {
  const normalizedSerialNumber = String(
    serialNumber || ""
  ).trim();

  const lock =
    LockService.getDocumentLock();

  lock.waitLock(20000);

  try {
    const sheet =
      getRequiredSheet_(STARLINKS_SHEET);

    const newStarlinkId =
      getNextStarlinkIdFromSheet_(sheet);

    if (normalizedSerialNumber) {
      const duplicateSerialRow =
        findStarlinkRowBySerial_(
          sheet,
          normalizedSerialNumber
        );

      if (duplicateSerialRow) {
        const existingStarlinkId = String(
          sheet
            .getRange(
              duplicateSerialRow,
              STARLINK_COLUMNS.ID
            )
            .getValue() || ""
        ).trim();

        throw new Error(
          "Серійний номер " +
          normalizedSerialNumber +
          " уже використовується STARLINK " +
          existingStarlinkId
        );
      }
    }

    sheet.appendRow([
      newStarlinkId,
      "Вільний",
      "",
      normalizedSerialNumber,
      String(comment || "").trim()
    ]);

    return {
      success: true,
      message: "STARLINK додано",
      starlink: getStarlink(newStarlinkId)
    };
  } finally {
    lock.releaseLock();
  }
}


function assignStarlink(aircraftId, starlinkId) {
  const normalizedAircraftId = normalizeAircraftId_(aircraftId);
  const normalizedStarlinkId = String(starlinkId || "").trim();

  if (!normalizedAircraftId) {
    throw new Error("Не вказано ID борта");
  }

  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const starlinksSheet = getRequiredSheet_(STARLINKS_SHEET);

  const aircraftRow = findAircraftRow_(
    aircraftSheet,
    normalizedAircraftId
  );

  if (!aircraftRow) {
    throw new Error("Борт " + normalizedAircraftId + " не знайдено");
  }

  const aircraftStatus = String(
    aircraftSheet
      .getRange(aircraftRow, AIRCRAFT_COLUMNS.STATUS)
      .getValue() || ""
  ).trim();

  const currentStarlink = String(
    aircraftSheet
      .getRange(aircraftRow, AIRCRAFT_COLUMNS.STARLINK)
      .getValue() || ""
  ).trim();

  if (currentStarlink === normalizedStarlinkId) {
    return {
      success: true,
      unchanged: true,
      message: "Цей Starlink уже прив’язаний",
      starlink: currentStarlink
    };
  }

  if (
    aircraftStatus === "Використаний" ||
    aircraftStatus === "Списаний"
  ) {
    throw new Error(
      "Не можна змінювати STARLINK архівного борта"
    );
  }

  let newStarlinkRow = null;

  if (normalizedStarlinkId) {
    newStarlinkRow = findStarlinkRow_(
      starlinksSheet,
      normalizedStarlinkId
    );

    if (!newStarlinkRow) {
      throw new Error(
        "Starlink " + normalizedStarlinkId + " не знайдено"
      );
    }

    const newStarlinkValues = starlinksSheet
      .getRange(newStarlinkRow, 1, 1, 5)
      .getValues()[0];

    const newStarlinkStatus = String(
      newStarlinkValues[1] || ""
    ).trim();

    const linkedAircraft = String(
      newStarlinkValues[2] || ""
    ).trim().toUpperCase();

    if (BLOCKED_STARLINK_STATUSES.includes(newStarlinkStatus)) {
      throw new Error(
        "Starlink має статус «" + newStarlinkStatus + "»"
      );
    }

    if (
      linkedAircraft &&
      linkedAircraft !== normalizedAircraftId
    ) {
      throw new Error(
        "Starlink уже прив’язаний до " + linkedAircraft
      );
    }
  }

  if (currentStarlink) {
    const oldStarlinkRow = findStarlinkRow_(
      starlinksSheet,
      currentStarlink
    );

    if (oldStarlinkRow) {
      starlinksSheet
        .getRange(oldStarlinkRow, STARLINK_COLUMNS.STATUS)
        .setValue("Вільний");

      starlinksSheet
        .getRange(oldStarlinkRow, STARLINK_COLUMNS.AIRCRAFT_ID)
        .clearContent();
    }
  }

  if (normalizedStarlinkId && newStarlinkRow) {
    starlinksSheet
      .getRange(newStarlinkRow, STARLINK_COLUMNS.STATUS)
      .setValue("На борту");

    starlinksSheet
      .getRange(newStarlinkRow, STARLINK_COLUMNS.AIRCRAFT_ID)
      .setValue(normalizedAircraftId);
  }

  aircraftSheet
    .getRange(aircraftRow, AIRCRAFT_COLUMNS.STARLINK)
    .setValue(normalizedStarlinkId);

  appendHistory_(
    new Date(),
    normalizedAircraftId,
    "",
    "",
    "STARLINK: " +
      (currentStarlink || "не прив’язаний") +
      " → " +
      (normalizedStarlinkId || "не прив’язаний")
  );

  return {
    success: true,
    unchanged: false,
    message: normalizedStarlinkId
      ? "Starlink прив’язано"
      : "Starlink відв’язано",
    starlink: normalizedStarlinkId
  };
}


/* =========================
   QR PRINT QUEUE
   ========================= */

function getQrQueue() {
  const queueSheet = getQrQueueSheet_();
  const lastRow = queueSheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const aircraftSheet =
    getRequiredSheet_(AIRCRAFT_SHEET);

  const aircraftLastRow =
    aircraftSheet.getLastRow();

  const serialByAircraftId = {};

  if (aircraftLastRow >= 2) {
    const aircraftValues = aircraftSheet
      .getRange(
        2,
        1,
        aircraftLastRow - 1,
        7
      )
      .getValues();

    aircraftValues.forEach(function (row) {
      const id =
        normalizeAircraftId_(row[0]);

      if (!id) {
        return;
      }

      serialByAircraftId[id] = String(
        row[3] || ""
      ).trim();
    });
  }

  const values = queueSheet
    .getRange(
      2,
      1,
      lastRow - 1,
      4
    )
    .getValues();

  const result = [];

  values.forEach(function (row, index) {
    const id =
      normalizeAircraftId_(row[0]);

    const printed =
      normalizeBoolean_(row[2]);

    if (!id || printed) {
      return;
    }

    result.push({
      row: index + 2,
      id: id,
      serialNumber:
        serialByAircraftId[id] || "",
      created: formatDate_(
        row[1],
        "dd.MM.yyyy HH:mm:ss"
      ),
      printed: false
    });
  });

  return result;
}


function markQrPrinted(ids) {
  const normalizedIds = String(ids || "")
    .split(",")
    .map(function (id) {
      return normalizeAircraftId_(id);
    })
    .filter(function (id) {
      return Boolean(id);
    });

  const uniqueIds = Array.from(
    new Set(normalizedIds)
  );

  if (!uniqueIds.length) {
    throw new Error(
      "Не вибрано QR-коди"
    );
  }

  const sheet = getQrQueueSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      success: true,
      updated: 0,
      message: "Черга порожня"
    };
  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      4
    )
    .getValues();

  const now = new Date();
  let updated = 0;

  values.forEach(function (row, index) {
    const id = normalizeAircraftId_(row[0]);
    const printed = normalizeBoolean_(row[2]);

    if (
      printed ||
      !uniqueIds.includes(id)
    ) {
      return;
    }

    const sheetRow = index + 2;

    sheet
      .getRange(sheetRow, 3)
      .setValue(true);

    sheet
      .getRange(sheetRow, 4)
      .setValue(now);

    updated++;
  });

  return {
    success: true,
    updated: updated,
    message:
      "Позначено надрукованими: " +
      updated
  };
}


function appendQrQueue_(
  aircraftId,
  created
) {
  const id = normalizeAircraftId_(
    aircraftId
  );

  if (!id) {
    throw new Error(
      "Некоректний ID для черги QR"
    );
  }

  const sheet = getQrQueueSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const values = sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        3
      )
      .getValues();

    for (let i = 0; i < values.length; i++) {
      const existingId =
        normalizeAircraftId_(
          values[i][0]
        );

      const printed =
        normalizeBoolean_(
          values[i][2]
        );

      if (
        existingId === id &&
        !printed
      ) {
        return;
      }
    }
  }

  sheet.appendRow([
    id,
    created || new Date(),
    false,
    ""
  ]);
}


function getQrQueueSheet_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      QR_QUEUE_SHEET
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      QR_QUEUE_SHEET
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "AircraftID",
      "Created",
      "Printed",
      "PrintedDate"
    ]);
  } else {
    const headers = sheet
      .getRange(1, 1, 1, 4)
      .getValues()[0];

    const empty = headers.every(
      function (value) {
        return !String(value || "").trim();
      }
    );

    if (empty) {
      sheet
        .getRange(1, 1, 1, 4)
        .setValues([[
          "AircraftID",
          "Created",
          "Printed",
          "PrintedDate"
        ]]);
    }
  }

  return sheet;
}


function normalizeBoolean_(value) {
  if (value === true) {
    return true;
  }

  const text = String(value || "")
    .trim()
    .toUpperCase();

  return (
    text === "TRUE" ||
    text === "ТАК" ||
    text === "YES" ||
    text === "1"
  );
}


/* =========================
   QR SYNCHRONIZATION
   ========================= */

function syncQrQueue() {
  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const queueSheet = getQrQueueSheet_();
  const aircraftIds = [];
  const aircraftLastRow = aircraftSheet.getLastRow();

  if (aircraftLastRow >= 2) {
    aircraftSheet
      .getRange(2, AIRCRAFT_COLUMNS.ID, aircraftLastRow - 1, 1)
      .getValues()
      .forEach(function (row) {
        const id = normalizeAircraftId_(row[0]);
        if (id) aircraftIds.push(id);
      });
  }

  const activeQueueIds = new Set();
  const queueLastRow = queueSheet.getLastRow();

  if (queueLastRow >= 2) {
    queueSheet
      .getRange(2, 1, queueLastRow - 1, 3)
      .getValues()
      .forEach(function (row) {
        const id = normalizeAircraftId_(row[0]);
        const printed = normalizeBoolean_(row[2]);
        if (id && !printed) activeQueueIds.add(id);
      });
  }

  const uniqueAircraftIds = Array.from(new Set(aircraftIds));
  const missingIds = uniqueAircraftIds.filter(function (id) {
    return !activeQueueIds.has(id);
  });

  if (missingIds.length) {
    const now = new Date();
    const rows = missingIds.map(function (id) {
      return [id, now, false, ""];
    });
    queueSheet
      .getRange(queueSheet.getLastRow() + 1, 1, rows.length, 4)
      .setValues(rows);
  }

  return {
    success: true,
    totalAircraft: uniqueAircraftIds.length,
    alreadyQueued: uniqueAircraftIds.length - missingIds.length,
    added: missingIds.length,
    message: "Синхронізацію завершено"
  };
}

function requeueAircraftQr(aircraftId) {
  const id = normalizeAircraftId_(aircraftId);
  if (!id) throw new Error("Некоректний ID борта");

  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
  if (!findAircraftRow_(aircraftSheet, id)) {
    throw new Error("Борт " + id + " не знайдено");
  }

  const queueSheet = getQrQueueSheet_();
  const lastRow = queueSheet.getLastRow();

  if (lastRow >= 2) {
    const values = queueSheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < values.length; i++) {
      const existingId = normalizeAircraftId_(values[i][0]);
      const printed = normalizeBoolean_(values[i][2]);
      if (existingId === id && !printed) {
        return {
          success: true,
          unchanged: true,
          message: "QR цього борта вже у черзі"
        };
      }
    }
  }

  const now = new Date();
  queueSheet.appendRow([id, now, false, ""]);
  appendHistory_(now, id, "", "", "QR повторно додано у чергу");

  return {
    success: true,
    unchanged: false,
    message: "QR додано у чергу повторно"
  };
}

function getAircraftQrStatus(aircraftId) {
  const id = normalizeAircraftId_(aircraftId);
  if (!id) throw new Error("Некоректний ID борта");

  const queueSheet = getQrQueueSheet_();
  const lastRow = queueSheet.getLastRow();
  if (lastRow < 2) return {state: "missing", label: "Не створено"};

  const values = queueSheet.getRange(2, 1, lastRow - 1, 4).getValues();
  let hasPrinted = false;

  for (let i = 0; i < values.length; i++) {
    if (normalizeAircraftId_(values[i][0]) !== id) continue;
    if (!normalizeBoolean_(values[i][2])) {
      return {state: "queued", label: "У черзі"};
    }
    hasPrinted = true;
  }

  return hasPrinted
    ? {state: "printed", label: "Надруковано"}
    : {state: "missing", label: "Не створено"};
}

/* =========================
   PRINT SETTINGS
   ========================= */

function getPrintSettings() {
  const sheet = getSettingsSheet_();
  const lastRow = sheet.getLastRow();

  const defaults =
    getDefaultPrintSettings_();

  if (lastRow < 2) {
    return defaults;
  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      2
    )
    .getValues();

  const rawSettings = {};

  values.forEach(function (row) {
    const key = String(
      row[0] || ""
    ).trim();

    if (!key) {
      return;
    }

    rawSettings[key] = row[1];
  });

  return {
    printer: String(
      rawSettings.Printer ||
      defaults.printer
    ).trim(),

    labelWidth: numberSetting_(
      rawSettings.LabelWidth,
      defaults.labelWidth,
      20,
      108
    ),

    labelHeight: numberSetting_(
      rawSettings.LabelHeight,
      defaults.labelHeight,
      15,
      150
    ),

    qrSize: numberSetting_(
      rawSettings.QRSize,
      defaults.qrSize,
      10,
      90
    ),

    title: String(
      rawSettings.Title ||
      defaults.title
    ).trim(),

    showSerial: normalizeBooleanSetting_(
      rawSettings.ShowSerial,
      defaults.showSerial
    ),

    idFontSize: numberSetting_(
      rawSettings.IdFontSize,
      defaults.idFontSize,
      6,
      30
    ),

    serialFontSize: numberSetting_(
      rawSettings.SerialFontSize,
      defaults.serialFontSize,
      5,
      20
    ),

    margin: numberSetting_(
      rawSettings.Margin,
      defaults.margin,
      0,
      15
    )
  };
}


function getSettingsSheet_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      SETTINGS_SHEET
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      SETTINGS_SHEET
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Key",
      "Value"
    ]);

    const defaults =
      getDefaultPrintSettings_();

    sheet
      .getRange(
        2,
        1,
        9,
        2
      )
      .setValues([
        ["Printer", defaults.printer],
        [
          "LabelWidth",
          defaults.labelWidth
        ],
        [
          "LabelHeight",
          defaults.labelHeight
        ],
        ["QRSize", defaults.qrSize],
        ["Title", defaults.title],
        [
          "ShowSerial",
          defaults.showSerial
        ],
        [
          "IdFontSize",
          defaults.idFontSize
        ],
        [
          "SerialFontSize",
          defaults.serialFontSize
        ],
        ["Margin", defaults.margin]
      ]);
  }

  return sheet;
}


function getDefaultPrintSettings_() {
  return {
    printer: "Xprinter XP-420B",
    labelWidth: 60,
    labelHeight: 40,
    qrSize: 25,
    title: "HORNET",
    showSerial: true,
    idFontSize: 15,
    serialFontSize: 8,
    margin: 2
  };
}


function numberSetting_(
  value,
  fallback,
  minimum,
  maximum
) {
  const number = Number(value);

  if (!isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, number)
  );
}


function normalizeBooleanSetting_(
  value,
  fallback
) {
  if (
    value === true ||
    value === false
  ) {
    return value;
  }

  const text = String(value || "")
    .trim()
    .toUpperCase();

  if (
    text === "TRUE" ||
    text === "ТАК" ||
    text === "YES" ||
    text === "1"
  ) {
    return true;
  }

  if (
    text === "FALSE" ||
    text === "НІ" ||
    text === "NO" ||
    text === "0"
  ) {
    return false;
  }

  return fallback;
}


/* =========================
   PRINT TEMPLATES
   ========================= */

function getPrintTemplates() {
  const sheet = getPrintTemplatesSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      18
    )
    .getValues();

  return values
    .map(function (row) {
      return {
        id: String(row[0] || "").trim(),
        name: String(row[1] || "").trim(),
        type: String(row[2] || "")
          .trim()
          .toUpperCase(),
        pageWidth: Number(row[3]),
        pageHeight: Number(row[4]),
        columns: Number(row[5]),
        rows: Number(row[6]),
        labelWidth: Number(row[7]),
        labelHeight: Number(row[8]),
        marginLeft: Number(row[9]),
        marginTop: Number(row[10]),
        gapX: Number(row[11]),
        gapY: Number(row[12]),
        qrSize: Number(row[13]),
        showSerial:
          normalizeBooleanSetting_(
            row[14],
            false
          ),
        title: String(row[15] || "").trim(),
        idFontSize: Number(row[16]),
        serialFontSize: Number(row[17])
      };
    })
    .filter(function (template) {
      return (
        template.id &&
        template.name &&
        template.type
      );
    });
}


function getPrintTemplatesSheet_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      PRINT_TEMPLATES_SHEET
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      PRINT_TEMPLATES_SHEET
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "ID",
      "Name",
      "Type",
      "PageWidth",
      "PageHeight",
      "Columns",
      "Rows",
      "LabelWidth",
      "LabelHeight",
      "MarginLeft",
      "MarginTop",
      "GapX",
      "GapY",
      "QRSize",
      "ShowSerial",
      "Title",
      "IdFontSize",
      "SerialFontSize"
    ]);

    sheet
      .getRange(
        2,
        1,
        2,
        18
      )
      .setValues([
        [
          "A4_44",
          "A4 — 44 етикетки 48,5×25,44 мм",
          "SHEET",
          210,
          297,
          4,
          11,
          48.5,
          25.44,
          8,
          8.58,
          0,
          0,
          19,
          false,
          "",
          9,
          6
        ],
        [
          "XP420B_60X40",
          "Xprinter XP-420B — 60×40 мм",
          "ROLL",
          60,
          40,
          1,
          1,
          60,
          40,
          0,
          0,
          0,
          0,
          25,
          true,
          "HORNET",
          15,
          8
        ]
      ]);
  }

  return sheet;
}


/* =========================
   HISTORY
   ========================= */

function getAircraftHistory(id) {
  const normalizedId = normalizeAircraftId_(id);

  if (!normalizedId) {
    throw new Error("Не вказано ID борта");
  }

  const historySheet = getRequiredSheet_(HISTORY_SHEET);
  const lastRow = historySheet.getLastRow();

  if (lastRow < 2) return [];

  const values = historySheet
    .getRange(2, 1, lastRow - 1, 5)
    .getValues();

  const result = [];

  values.forEach(function (row) {
    const rowId = normalizeAircraftId_(row[1]);

    if (rowId !== normalizedId) return;

    const oldStatus = String(row[2] || "").trim();
    const newStatus = String(row[3] || "").trim();
    const comment = String(row[4] || "").trim();

    let type = "status";

    if (!oldStatus && !newStatus) {
      if (comment.startsWith("STARLINK:")) {
        type = "starlink";
      } else if (comment.startsWith("ДАНІ БОРТА:")) {
        type = "details";
      } else if (comment.startsWith("BATCH_CREATE:")) {
        type = "BATCH_CREATE";
      } else if (comment.startsWith("СТВОРЕНО БОРТ")) {
        type = "created";
      }
    }

    result.push({
      timestamp: formatDate_(row[0], "dd.MM.yyyy HH:mm:ss"),
      oldStatus: oldStatus,
      newStatus: newStatus,
      comment: comment,
      type: type
    });
  });

  result.reverse();
  return result;
}


/* =========================
   API
   ========================= */

function doGet(e) {
  const parameters = e && e.parameter ? e.parameter : {};

  const callback = sanitizeCallback_(
    parameters.callback || "callback"
  );

  try {
    if (parameters.key !== API_KEY) {
      throw new Error("Немає доступу");
    }

    const action = String(parameters.action || "").trim();

    ensureBackendFoundation_();

    if (action === "healthCheck") {
      return jsonp_(callback, {
        ok: true,
        health: healthCheck()
      });
    }

    if (action === "createBackup") {
      return jsonp_(callback, {
        ok: true,
        backup: createBackup(parameters.comment)
      });
    }

    if (action === "listBackups") {
      return jsonp_(callback, {
        ok: true,
        backups: listBackups(parameters.limit)
      });
    }

    if (action === "dashboard") {
      return jsonp_(callback, {
        ok: true,
        dashboard: dashboard()
      });
    }

    if (action === "createBatch") {
      return jsonp_(callback, {
        ok: true,
        result: createBatch(
          parameters.quantity,
          parameters.status,
          parameters.createdDate,
          parameters.comment,
          parameters.serialNumbers
        )
      });
    }

    if (action === "listAircraftByStatus") {
      return jsonp_(callback, {
        ok: true,
        aircraft: listAircraftByStatus(parameters.status)
      });
    }

    if (action === "listStarlinksByStatus") {
      return jsonp_(callback, {
        ok: true,
        starlinks: listStarlinksByStatus(parameters.status)
      });
    }

    if (action === "get") {
      return jsonp_(callback, {
        ok: true,
        aircraft: getAircraft(parameters.id)
      });
    }

    if (action === "searchAircraft") {
      return jsonp_(callback, {
        ok: true,
        aircraft: searchAircraft(parameters.query)
      });
    }

    if (action === "nextAircraftId") {
      return jsonp_(callback, {
        ok: true,
        id: getNextAircraftId()
      });
    }

    if (action === "createAircraft") {
      return jsonp_(callback, {
        ok: true,
        result: createAircraft(
          parameters.status,
          parameters.serialNumber,
          parameters.receivedDate,
          parameters.comment
        )
      });
    }

    if (action === "update") {
      return jsonp_(callback, {
        ok: true,
        result: updateAircraftStatus(
          parameters.id,
          parameters.status
        )
      });
    }

    if (action === "updateDetails") {
      return jsonp_(callback, {
        ok: true,
        result: updateAircraftDetails(
          parameters.id,
          parameters.serialNumber,
          parameters.receivedDate,
          parameters.comment
        )
      });
    }

    if (action === "starlinks") {
      return jsonp_(callback, {
        ok: true,
        starlinks: getAvailableStarlinks(parameters.id)
      });
    }

    if (action === "getStarlink") {
      return jsonp_(callback, {
        ok: true,
        starlink: getStarlink(parameters.id)
      });
    }

    if (action === "searchStarlinks") {
      return jsonp_(callback, {
        ok: true,
        starlinks: searchStarlinks(parameters.query)
      });
    }

    if (action === "nextStarlinkId") {
      return jsonp_(callback, {
        ok: true,
        id: getNextStarlinkId()
      });
    }

    if (action === "createStarlink") {
      return jsonp_(callback, {
        ok: true,
        result: createStarlink(
          parameters.serialNumber,
          parameters.comment
        )
      });
    }

    if (action === "assignStarlink") {
      return jsonp_(callback, {
        ok: true,
        result: assignStarlink(
          parameters.id,
          parameters.starlink
        )
      });
    }

    if (action === "history") {
      return jsonp_(callback, {
        ok: true,
        history: getAircraftHistory(parameters.id)
      });
    }

    if (action === "getQrQueue") {
      return jsonp_(callback, {
        ok: true,
        queue: getQrQueue()
      });
    }

    if (action === "getPrintSettings") {
      return jsonp_(callback, {
        ok: true,
        settings: getPrintSettings()
      });
    }

    if (action === "getPrintTemplates") {
      return jsonp_(callback, {
        ok: true,
        templates: getPrintTemplates()
      });
    }

    if (action === "markQrPrinted") {
      return jsonp_(callback, {
        ok: true,
        result: markQrPrinted(parameters.ids)
      });
    }

    if (action === "syncQrQueue") {
      return jsonp_(callback, {
        ok: true,
        result: syncQrQueue()
      });
    }

    if (action === "requeueQr") {
      return jsonp_(callback, {
        ok: true,
        result: requeueAircraftQr(parameters.id)
      });
    }

    if (action === "qrStatus") {
      return jsonp_(callback, {
        ok: true,
        status: getAircraftQrStatus(parameters.id)
      });
    }

    throw new Error("Невідома дія");
  } catch (error) {
    const action = String(parameters.action || "").trim();

    logSystemEvent_(
      "ERROR",
      action || "UNKNOWN_ACTION",
      error.message || String(error),
      {
        parameters: sanitizeLogParameters_(parameters),
        stack: error && error.stack ? String(error.stack) : ""
      }
    );

    return jsonp_(callback, {
      ok: false,
      error: error.message || String(error)
    });
  }
}


function sanitizeLogParameters_(parameters) {
  const safe = {};

  Object.keys(parameters || {}).forEach(function (key) {
    if (key === "key" || key === "callback") {
      return;
    }

    safe[key] = parameters[key];
  });

  return safe;
}


/* =========================
   HELPERS
   ========================= */

function aircraftFromRow_(sheet, row) {
  const values = sheet
    .getRange(row, 1, 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues()[0];

  return aircraftFromValues_(values, row);
}


function aircraftFromValues_(values, row) {
  return {
    row: row,
    id: String(values[0] || ""),
    status: String(values[1] || "Не вказано"),
    starlink: String(values[2] || ""),
    serialNumber: String(values[3] || ""),
    receivedDate: formatDate_(values[4], "dd.MM.yyyy"),
    lastChange: formatDate_(values[5], "dd.MM.yyyy HH:mm:ss"),
    comment: String(values[6] || "")
  };
}


function findAircraftRow_(sheet, id) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const ids = sheet
    .getRange(2, AIRCRAFT_COLUMNS.ID, lastRow - 1, 1)
    .getValues();

  for (let i = 0; i < ids.length; i++) {
    const currentId = normalizeAircraftId_(ids[i][0]);

    if (currentId === id) {
      return i + 2;
    }
  }

  return null;
}


function getNextAircraftIdFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const ids = sheet
      .getRange(
        2,
        AIRCRAFT_COLUMNS.ID,
        lastRow - 1,
        1
      )
      .getValues();

    ids.forEach(function (row) {
      const match = String(row[0] || "")
        .trim()
        .toUpperCase()
        .match(/^HN-(\d{4})$/);

      if (!match) {
        return;
      }

      const number = Number(match[1]);

      if (number > maxNumber) {
        maxNumber = number;
      }
    });
  }

  const nextNumber = maxNumber + 1;

  if (nextNumber > 9999) {
    throw new Error(
      "Закінчився доступний діапазон ID HN-0001–HN-9999"
    );
  }

  return "HN-" + String(nextNumber).padStart(4, "0");
}


function findAircraftRowBySerial_(
  sheet,
  serialNumber,
  excludedRow
) {
  const normalizedSerial = String(
    serialNumber || ""
  )
    .trim()
    .toUpperCase();

  if (!normalizedSerial) {
    return null;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet
    .getRange(
      2,
      AIRCRAFT_COLUMNS.SERIAL_NUMBER,
      lastRow - 1,
      1
    )
    .getValues();

  for (let i = 0; i < values.length; i++) {
    const row = i + 2;

    if (excludedRow && row === excludedRow) {
      continue;
    }

    const currentSerial = String(
      values[i][0] || ""
    )
      .trim()
      .toUpperCase();

    if (currentSerial === normalizedSerial) {
      return row;
    }
  }

  return null;
}


function getNextStarlinkIdFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const ids = sheet
      .getRange(
        2,
        STARLINK_COLUMNS.ID,
        lastRow - 1,
        1
      )
      .getValues();

    ids.forEach(function (row) {
      const text = String(row[0] || "")
        .trim()
        .toUpperCase();

      const match = text.match(
        /^MINI[_-](\d{2,4})$/
      );

      if (!match) {
        return;
      }

      const number = Number(match[1]);

      if (number > maxNumber) {
        maxNumber = number;
      }
    });
  }

  const nextNumber = maxNumber + 1;

  if (nextNumber > 9999) {
    throw new Error(
      "Закінчився доступний діапазон " +
      "MINI_001–MINI_9999"
    );
  }

  return (
    "MINI_" +
    String(nextNumber).padStart(3, "0")
  );
}


function findStarlinkRowBySerial_(
  sheet,
  serialNumber,
  excludedRow
) {
  const normalizedSerial = String(
    serialNumber || ""
  )
    .trim()
    .toUpperCase();

  if (!normalizedSerial) {
    return null;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet
    .getRange(
      2,
      STARLINK_COLUMNS.SERIAL_NUMBER,
      lastRow - 1,
      1
    )
    .getValues();

  for (let i = 0; i < values.length; i++) {
    const row = i + 2;

    if (excludedRow && row === excludedRow) {
      continue;
    }

    const currentSerial = String(
      values[i][0] || ""
    )
      .trim()
      .toUpperCase();

    if (currentSerial === normalizedSerial) {
      return row;
    }
  }

  return null;
}


function findStarlinkRow_(sheet, starlinkId) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const ids = sheet
    .getRange(2, STARLINK_COLUMNS.ID, lastRow - 1, 1)
    .getValues();

  const normalizedTarget = String(
    starlinkId || ""
  ).trim().toUpperCase();

  for (let i = 0; i < ids.length; i++) {
    const currentId = String(ids[i][0] || "")
      .trim()
      .toUpperCase();

    if (currentId === normalizedTarget) {
      return i + 2;
    }
  }

  return null;
}


function markLinkedStarlinkLost_(aircraftSheet, aircraftRow) {
  const starlinkId = String(
    aircraftSheet
      .getRange(aircraftRow, AIRCRAFT_COLUMNS.STARLINK)
      .getValue() || ""
  ).trim();

  if (!starlinkId) {
    return;
  }

  const starlinksSheet = getRequiredSheet_(STARLINKS_SHEET);
  const starlinkRow = findStarlinkRow_(starlinksSheet, starlinkId);

  if (!starlinkRow) {
    return;
  }

  starlinksSheet
    .getRange(starlinkRow, STARLINK_COLUMNS.STATUS)
    .setValue("Втрачений");

  starlinksSheet
    .getRange(starlinkRow, STARLINK_COLUMNS.AIRCRAFT_ID)
    .setValue(
      String(
        aircraftSheet
          .getRange(aircraftRow, AIRCRAFT_COLUMNS.ID)
          .getValue() || ""
      ).trim()
    );
}


function appendHistory_(
  timestamp,
  id,
  oldStatus,
  newStatus,
  comment
) {
  const history = getRequiredSheet_(HISTORY_SHEET);

  history.appendRow([
    timestamp,
    id,
    oldStatus,
    newStatus,
    comment || ""
  ]);
}


function getRequiredSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Не знайдено аркуш "' + sheetName + '"');
  }

  return sheet;
}


function normalizeAircraftId_(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase();

  const match = text.match(/HN-\d{4}/);
  return match ? match[0] : "";
}


function normalizeStarlinkId_(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}


function parseReceivedDate_(value) {
  const text = String(value || "").trim();

  if (!text) return null;

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error("Некоректний формат дати");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Некоректна дата");
  }

  return date;
}


function formatDate_(value, pattern) {
  if (!value) return "";

  const date = value instanceof Date
    ? value
    : new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    pattern
  );
}


function jsonp_(callback, data) {
  return ContentService
    .createTextOutput(
      callback + "(" + JSON.stringify(data) + ");"
    )
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}


function sanitizeCallback_(callback) {
  const value = String(callback || "callback");

  if (/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(value)) {
    return value;
  }

  return "callback";
}
