function ensureUsersPinColumn_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), USER_HEADERS.length);
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (value) {
      return String(value || "").trim();
    });

  const pinColumnIndex = headers.findIndex(function (header) {
    return header.toUpperCase() === "PINHASH";
  });

  if (pinColumnIndex >= 0) {
    return;
  }

  sheet.getRange(1, USER_HEADERS.length).setValue("PinHash");
}


function getUsersSheet_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();

  return getOrCreateSecuritySheet_(
    book,
    USERS_SHEET,
    USER_HEADERS
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


/* =========================
   SESSION API v1.6.1-alpha3
   ========================= */


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
      return userFromValues_(row, index + 2);
    }
  }

  return null;
}


function listUsers() {
  ensureBackendFoundation_();
  requirePermission_(PERMISSIONS.USERS_VIEW);

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
      return Boolean(user.userId);
    })
    .sort(function (first, second) {
      if (first.active !== second.active) {
        return first.active ? -1 : 1;
      }

      if (first.role !== second.role) {
        return first.role.localeCompare(second.role);
      }

      return first.name.localeCompare(second.name);
    })
    .map(serializeUser_);
}


function getUser(userIdOrEmail) {
  ensureBackendFoundation_();
  requirePermission_(PERMISSIONS.USERS_VIEW);

  const identifier = String(userIdOrEmail || "").trim();

  if (!identifier) {
    throw new Error("Не вказано користувача");
  }

  const sheet = getUsersSheet_();
  const user = identifier.includes("@")
    ? findUserByEmail_(sheet, identifier)
    : findUserById_(sheet, identifier);

  if (!user) {
    throw new Error("Користувача не знайдено");
  }

  return serializeUser_(user);
}


function createUser(email, name, role, active, comment, pin) {
  ensureBackendFoundation_();
  const permission = requirePermission_(PERMISSIONS.USERS_MANAGE);
  const actor = permission.user || getCurrentUser_();

  const normalizedEmail = validateUserEmail_(email);
  const normalizedName = String(name || "").trim();
  const normalizedRole = normalizeUserRole_(role);
  const normalizedActive = active === undefined || active === null || active === ""
    ? true
    : normalizeBoolean_(active);
  const normalizedComment = String(comment || "").trim();
  const pinHash = pin ? hashSecret_(validatePin_(pin)) : "";

  if (!normalizedName) {
    throw new Error("Вкажіть ім’я або назву користувача");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getUsersSheet_();

    if (findUserByEmail_(sheet, normalizedEmail)) {
      throw new Error("Користувач із таким email уже існує");
    }

    const now = new Date();
    const userId = nextUserId_(sheet);
    const nextRow = sheet.getLastRow() + 1;

    sheet
      .getRange(nextRow, 1, 1, USER_HEADERS.length)
      .setValues([[
        userId,
        normalizedEmail,
        normalizedName,
        normalizedRole,
        normalizedActive,
        now,
        now,
        "",
        normalizedComment,
        pinHash
      ]]);

    appendAuditLog_(
      actor ? actor.email : "",
      actor ? actor.userId : "",
      actor ? actor.role : "",
      "USER_CREATED",
      "USER",
      userId,
      "SUCCESS",
      {
        email: normalizedEmail,
        name: normalizedName,
        role: normalizedRole,
        active: normalizedActive
      }
    );

    return {
      success: true,
      message: "Користувача додано",
      user: serializeUser_(findUserById_(sheet, userId))
    };
  } finally {
    lock.releaseLock();
  }
}


function updateUser(userId, email, name, role, comment) {
  ensureBackendFoundation_();
  const permission = requirePermission_(PERMISSIONS.USERS_MANAGE);
  const actor = permission.user || getCurrentUser_();

  const normalizedUserId = normalizeUserId_(userId);

  if (!normalizedUserId) {
    throw new Error("Некоректний UserID");
  }

  const normalizedEmail = validateUserEmail_(email);
  const normalizedName = String(name || "").trim();
  const normalizedRole = normalizeUserRole_(role);
  const normalizedComment = String(comment || "").trim();

  if (!normalizedName) {
    throw new Error("Вкажіть ім’я або назву користувача");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getUsersSheet_();
    const existing = findUserById_(sheet, normalizedUserId);

    if (!existing) {
      throw new Error("Користувача не знайдено");
    }

    const duplicate = findUserByEmail_(sheet, normalizedEmail);

    if (duplicate && duplicate.userId !== normalizedUserId) {
      throw new Error("Користувач із таким email уже існує");
    }

    if (existing.email === BOOTSTRAP_ADMIN_EMAIL) {
      if (normalizedEmail !== BOOTSTRAP_ADMIN_EMAIL) {
        throw new Error("Не можна змінити email головного адміністратора");
      }

      if (normalizedRole !== "ADMIN") {
        throw new Error("Не можна змінити роль головного адміністратора");
      }
    }

    const now = new Date();
    const previous = serializeUser_(existing);

    sheet
      .getRange(existing.row, 2, 1, 8)
      .setValues([[
        normalizedEmail,
        normalizedName,
        normalizedRole,
        existing.active,
        existing.createdAt || now,
        now,
        existing.lastLogin || "",
        normalizedComment
      ]]);

    const updated = findUserById_(sheet, normalizedUserId);

    appendAuditLog_(
      actor ? actor.email : "",
      actor ? actor.userId : "",
      actor ? actor.role : "",
      "USER_UPDATED",
      "USER",
      normalizedUserId,
      "SUCCESS",
      {
        before: previous,
        after: serializeUser_(updated)
      }
    );

    return {
      success: true,
      message: "Користувача оновлено",
      user: serializeUser_(updated)
    };
  } finally {
    lock.releaseLock();
  }
}


function setUserActive(userId, active) {
  ensureBackendFoundation_();
  const permission = requirePermission_(PERMISSIONS.USERS_MANAGE);
  const actor = permission.user || getCurrentUser_();

  const normalizedUserId = normalizeUserId_(userId);

  if (!normalizedUserId) {
    throw new Error("Некоректний UserID");
  }

  const normalizedActive = normalizeBoolean_(active);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getUsersSheet_();
    const existing = findUserById_(sheet, normalizedUserId);

    if (!existing) {
      throw new Error("Користувача не знайдено");
    }

    if (
      existing.email === BOOTSTRAP_ADMIN_EMAIL &&
      !normalizedActive
    ) {
      throw new Error("Не можна заблокувати головного адміністратора");
    }

    if (existing.active === normalizedActive) {
      return {
        success: true,
        unchanged: true,
        message: normalizedActive
          ? "Користувач уже активний"
          : "Користувач уже заблокований",
        user: serializeUser_(existing)
      };
    }

    const now = new Date();

    sheet
      .getRange(existing.row, 5)
      .setValue(normalizedActive);

    sheet
      .getRange(existing.row, 7)
      .setValue(now);

    const updated = findUserById_(sheet, normalizedUserId);
    const action = normalizedActive
      ? "USER_ENABLED"
      : "USER_DISABLED";

    appendAuditLog_(
      actor ? actor.email : "",
      actor ? actor.userId : "",
      actor ? actor.role : "",
      action,
      "USER",
      normalizedUserId,
      "SUCCESS",
      {
        email: existing.email
      }
    );

    return {
      success: true,
      unchanged: false,
      message: normalizedActive
        ? "Користувача активовано"
        : "Користувача заблоковано",
      user: serializeUser_(updated)
    };
  } finally {
    lock.releaseLock();
  }
}


function disableUser(userId) {
  return setUserActive(userId, false);
}


function enableUser(userId) {
  return setUserActive(userId, true);
}


function findUserById_(usersSheet, userId) {
  const sheet = usersSheet || getUsersSheet_();
  const normalizedUserId = normalizeUserId_(userId);

  if (!normalizedUserId) {
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

    if (normalizeUserId_(row[0]) === normalizedUserId) {
      return userFromValues_(row, index + 2);
    }
  }

  return null;
}


function userFromValues_(row, sheetRow) {
  return {
    row: sheetRow,
    userId: normalizeUserId_(row[0]),
    email: normalizeUserEmail_(row[1]),
    name: String(row[2] || "").trim(),
    role: String(row[3] || "").trim().toUpperCase(),
    active: normalizeBoolean_(row[4]),
    createdAt: row[5] || "",
    updatedAt: row[6] || "",
    lastLogin: row[7] || "",
    comment: String(row[8] || ""),
    pinHash: String(row[9] || "")
  };
}


function serializeUser_(user) {
  if (!user) {
    return null;
  }

  return {
    userId: String(user.userId || ""),
    email: normalizeUserEmail_(user.email),
    name: String(user.name || ""),
    role: String(user.role || "").trim().toUpperCase(),
    active: user.active !== false,
    createdAt: formatDate_(user.createdAt, "dd.MM.yyyy HH:mm:ss"),
    updatedAt: formatDate_(user.updatedAt, "dd.MM.yyyy HH:mm:ss"),
    lastLogin: formatDate_(user.lastLogin, "dd.MM.yyyy HH:mm:ss"),
    comment: String(user.comment || "")
  };
}


function normalizeUserId_(userId) {
  const normalized = String(userId || "")
    .trim()
    .toUpperCase();

  return /^USR-\d{6}$/.test(normalized)
    ? normalized
    : "";
}


function validateUserEmail_(email) {
  const normalizedEmail = normalizeUserEmail_(email);

  if (!normalizedEmail) {
    throw new Error("Вкажіть email користувача");
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new Error("Некоректний email користувача");
  }

  return normalizedEmail;
}


function validatePin_(pin) {
  const normalizedPin = String(pin || "").trim();

  if (!/^\d{4,6}$/.test(normalizedPin)) {
    throw new Error("PIN має складатись із 4–6 цифр");
  }

  return normalizedPin;
}


function setUserPin_(email, newPin) {
  ensureBackendFoundation_();
  const permission = requirePermission_(PERMISSIONS.USERS_MANAGE);
  const actor = permission.user || getCurrentUser_();

  const normalizedEmail = validateUserEmail_(email);
  const normalizedPin = validatePin_(newPin);

  const sheet = getUsersSheet_();
  const user = findUserByEmail_(sheet, normalizedEmail);

  if (!user) {
    throw new Error("Користувача не знайдено");
  }

  const pinHash = hashSecret_(normalizedPin);

  sheet.getRange(user.row, 10).setValue(pinHash); // PinHash
  sheet.getRange(user.row, 7).setValue(new Date()); // UpdatedAt

  appendAuditLog_(
    actor ? actor.email : "",
    actor ? actor.userId : "",
    actor ? actor.role : "",
    "USER_PIN_SET",
    "USER",
    user.userId,
    "SUCCESS",
    { targetEmail: normalizedEmail }
  );

  return {
    success: true,
    message: "PIN оновлено"
  };
}
