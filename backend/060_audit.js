function getAuditLogSheet_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();

  return getOrCreateSecuritySheet_(
    book,
    AUDIT_LOG_SHEET,
    AUDIT_LOG_HEADERS
  ).sheet;
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
   USERS API v1.6.1-alpha2
   ========================= */


function listAuditLog(limit) {
  ensureBackendFoundation_();
  requirePermission_(PERMISSIONS.AUDIT_VIEW);

  const sheet = getAuditLogSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const requestedLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const rowCount = Math.min(lastRow - 1, requestedLimit);
  const startRow = lastRow - rowCount + 1;
  const values = sheet
    .getRange(
      startRow,
      1,
      rowCount,
      AUDIT_LOG_HEADERS.length
    )
    .getValues();

  return values
    .reverse()
    .map(function (row) {
      return {
        timestamp: formatDate_(row[0], "dd.MM.yyyy HH:mm:ss"),
        email: normalizeUserEmail_(row[1]),
        userId: String(row[2] || ""),
        role: String(row[3] || "").trim().toUpperCase(),
        action: String(row[4] || ""),
        entityType: String(row[5] || ""),
        entityId: String(row[6] || ""),
        result: String(row[7] || "").trim().toUpperCase(),
        details: parseLogDetails_(row[8])
      };
    });
}


function parseLogDetails_(details) {
  if (details === undefined || details === null || details === "") {
    return null;
  }

  if (typeof details !== "string") {
    return details;
  }

  try {
    return JSON.parse(details);
  } catch (error) {
    return details;
  }
}


/* =========================
   BACKUP & RECOVERY v1.6.0-alpha2
   ========================= */
