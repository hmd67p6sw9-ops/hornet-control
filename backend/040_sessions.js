function getSessionsSheet_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();

  return getOrCreateSecuritySheet_(
    book,
    SESSIONS_SHEET,
    SESSION_HEADERS
  ).sheet;
}


function generateSessionToken_() {
  return (
    Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "")
  );
}


function hashSessionToken_(token) {
  return hashSecret_(token);
}


function nextSessionId_(sessionsSheet) {
  const sheet = sessionsSheet || getSessionsSheet_();
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
        .match(/^SES-(\d{6})$/);

      if (match) {
        maxNumber = Math.max(maxNumber, Number(match[1]));
      }
    });
  }

  const nextNumber = maxNumber + 1;

  if (nextNumber > 999999) {
    throw new Error("Закінчився діапазон ID сесій");
  }

  return "SES-" + String(nextNumber).padStart(6, "0");
}


function listLoginableUsers() {
  ensureBackendFoundation_();

  const sheet = getUsersSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, USER_HEADERS.length)
    .getValues()
    .map(function (row, index) {
      return userFromValues_(row, index + 2);
    })
    .filter(function (user) {
      return Boolean(user.userId) && user.active;
    })
    .map(function (user) {
      return {
        email: user.email,
        name: user.name,
        role: user.role
      };
    })
    .sort(function (first, second) {
      return first.name.localeCompare(second.name);
    });
}


function login_(email, pin, clientInfo) {
  ensureBackendFoundation_();

  const usersSheet = getUsersSheet_();
  const user = findUserByEmail_(usersSheet, email);

  if (!user) {
    appendAuditLog_(
      normalizeUserEmail_(email),
      "",
      "",
      "LOGIN_FAILED",
      "SESSION",
      "",
      "DENIED",
      { reason: "USER_NOT_FOUND" }
    );

    throw new Error("Користувача не знайдено");
  }

  if (!user.active) {
    appendAuditLog_(
      user.email,
      user.userId,
      user.role,
      "LOGIN_FAILED",
      "SESSION",
      "",
      "DENIED",
      { reason: "USER_DISABLED" }
    );

    throw new Error("Обліковий запис деактивовано");
  }

  if (!user.pinHash) {
    appendAuditLog_(
      user.email,
      user.userId,
      user.role,
      "LOGIN_FAILED",
      "SESSION",
      "",
      "DENIED",
      { reason: "PIN_NOT_SET" }
    );

    throw new Error("PIN не встановлено. Звернись до адміністратора.");
  }

  const providedPinHash = hashSecret_(String(pin || "").trim());

  if (providedPinHash !== user.pinHash) {
    appendAuditLog_(
      user.email,
      user.userId,
      user.role,
      "LOGIN_FAILED",
      "SESSION",
      "",
      "DENIED",
      { reason: "WRONG_PIN" }
    );

    throw new Error("Невірний PIN");
  }

  const sessionsSheet = getSessionsSheet_();
  const token = generateSessionToken_();
  const tokenHash = hashSessionToken_(token);
  const sessionId = nextSessionId_(sessionsSheet);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000
  );
  const nextRow = sessionsSheet.getLastRow() + 1;

  sessionsSheet
    .getRange(nextRow, 1, 1, SESSION_HEADERS.length)
    .setValues([[
      sessionId,
      tokenHash,
      user.userId,
      user.email,
      user.role,
      now,
      expiresAt,
      now,
      false,
      "",
      String(clientInfo || ""),
      SESSION_SCHEMA_VERSION
    ]]);

  usersSheet
    .getRange(user.row, 8) // LastLogin
    .setValue(now);

  appendAuditLog_(
    user.email,
    user.userId,
    user.role,
    "LOGIN_SUCCESS",
    "SESSION",
    sessionId,
    "SUCCESS",
    {}
  );

  return {
    token: token,
    sessionId: sessionId,
    expiresAt: formatDate_(expiresAt, "dd.MM.yyyy HH:mm:ss"),
    user: serializeUser_(user)
  };
}


function findSessionRowByTokenHash_(sessionsSheet, tokenHash) {
  const sheet = sessionsSheet || getSessionsSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, SESSION_HEADERS.length)
    .getValues();

  for (let index = 0; index < values.length; index++) {
    if (String(values[index][1] || "") === tokenHash) {
      return {
        row: index + 2,
        values: values[index]
      };
    }
  }

  return null;
}


function sessionFromRowValues_(row, sheetRow) {
  return {
    row: sheetRow,
    sessionId: String(row[0] || ""),
    tokenHash: String(row[1] || ""),
    userId: String(row[2] || ""),
    email: normalizeUserEmail_(row[3]),
    role: String(row[4] || "").trim().toUpperCase(),
    createdAt: row[5] || "",
    expiresAt: row[6] || "",
    lastActivity: row[7] || "",
    revoked: normalizeBoolean_(row[8]),
    revokedAt: row[9] || "",
    clientInfo: String(row[10] || ""),
    version: String(row[11] || "")
  };
}


function getCurrentSession_(token) {
  const rawToken = String(token || "").trim();

  if (!rawToken) {
    return null;
  }

  const sessionsSheet = getSessionsSheet_();
  const tokenHash = hashSessionToken_(rawToken);
  const found = findSessionRowByTokenHash_(sessionsSheet, tokenHash);

  if (!found) {
    return null;
  }

  const session = sessionFromRowValues_(found.values, found.row);

  if (session.revoked) {
    return null;
  }

  const now = new Date();
  const expiresAt = session.expiresAt instanceof Date
    ? session.expiresAt
    : new Date(session.expiresAt);

  if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime()) || expiresAt < now) {
    return null;
  }

  sessionsSheet.getRange(session.row, 8).setValue(now); // LastActivity

  return session;
}


function requireAuth_(token) {
  const session = getCurrentSession_(token);

  if (!session) {
    throw new Error("Сесія недійсна або застаріла. Увійдіть ще раз.");
  }

  return session;
}


function logout_(token) {
  const rawToken = String(token || "").trim();

  if (!rawToken) {
    return { ok: true };
  }

  const sessionsSheet = getSessionsSheet_();
  const tokenHash = hashSessionToken_(rawToken);
  const found = findSessionRowByTokenHash_(sessionsSheet, tokenHash);

  if (!found) {
    return { ok: true };
  }

  const session = sessionFromRowValues_(found.values, found.row);
  const now = new Date();

  sessionsSheet.getRange(session.row, 9).setValue(true); // Revoked
  sessionsSheet.getRange(session.row, 10).setValue(now); // RevokedAt

  appendAuditLog_(
    session.email,
    session.userId,
    session.role,
    "LOGOUT",
    "SESSION",
    session.sessionId,
    "SUCCESS",
    {}
  );

  return { ok: true };
}
