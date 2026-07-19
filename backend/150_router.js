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

    const AUTH_EXEMPT_ACTIONS = [
      "listLoginableUsers",
      "login",
      "logout",
      "getCurrentSession"
    ];

    // Дії, які вже мають власну перевірку requirePermission_ всередині
    // своєї функції (Users/AuditLog) — тут навмисно НЕ дублюємо перевірку,
    // щоб уникнути подвійного запису в AuditLog при відмові.
    const SELF_CHECKED_ACTIONS = [
      "listUsers",
      "getUser",
      "createUser",
      "updateUser",
      "setUserActive",
      "disableUser",
      "enableUser",
      "listAuditLog",
      "setUserPin"
    ];

    const ACTION_PERMISSIONS = {
      dashboard: PERMISSIONS.DASHBOARD_VIEW,

      listAircraftByStatus: PERMISSIONS.AIRCRAFT_VIEW,
      get: PERMISSIONS.AIRCRAFT_VIEW,
      searchAircraft: PERMISSIONS.AIRCRAFT_VIEW,
      nextAircraftId: PERMISSIONS.AIRCRAFT_VIEW,
      createAircraft: PERMISSIONS.AIRCRAFT_CREATE,
      update: PERMISSIONS.AIRCRAFT_STATUS_CHANGE,
      updateDetails: PERMISSIONS.AIRCRAFT_EDIT,

      listStarlinksByStatus: PERMISSIONS.STARLINK_VIEW,
      starlinks: PERMISSIONS.STARLINK_VIEW,
      getStarlink: PERMISSIONS.STARLINK_VIEW,
      searchStarlinks: PERMISSIONS.STARLINK_VIEW,
      nextStarlinkId: PERMISSIONS.STARLINK_VIEW,
      createStarlink: PERMISSIONS.STARLINK_CREATE,
      assignStarlink: PERMISSIONS.STARLINK_ASSIGN,

      createBatch: PERMISSIONS.BATCH_CREATE,

      getQrQueue: PERMISSIONS.QR_VIEW,
      getPrintSettings: PERMISSIONS.QR_VIEW,
      getPrintTemplates: PERMISSIONS.QR_VIEW,
      qrStatus: PERMISSIONS.QR_VIEW,
      markQrPrinted: PERMISSIONS.QR_PRINT,
      syncQrQueue: PERMISSIONS.QR_PRINT,
      requeueQr: PERMISSIONS.QR_PRINT,

      history: PERMISSIONS.HISTORY_VIEW,

      listBackups: PERMISSIONS.BACKUP_VIEW,
      createBackup: PERMISSIONS.BACKUP_CREATE,

      healthCheck: PERMISSIONS.DIAGNOSTICS_VIEW
    };

    CURRENT_SESSION_USER_ = null;

    if (AUTH_EXEMPT_ACTIONS.indexOf(action) === -1) {
      const session = requireAuth_(parameters.token);

      CURRENT_SESSION_USER_ = findUserByEmail_(
        getUsersSheet_(),
        session.email
      );

      if (
        SELF_CHECKED_ACTIONS.indexOf(action) === -1 &&
        ACTION_PERMISSIONS[action]
      ) {
        requirePermission_(ACTION_PERMISSIONS[action]);
      }
    }


    if (action === "listLoginableUsers") {
      return jsonp_(callback, {
        ok: true,
        users: listLoginableUsers()
      });
    }

    if (action === "login") {
      return jsonp_(callback, {
        ok: true,
        session: login_(parameters.email, parameters.pin, parameters.clientInfo)
      });
    }

    if (action === "setUserPin") {
      return jsonp_(callback, {
        ok: true,
        result: setUserPin_(parameters.email, parameters.pin)
      });
    }

    if (action === "logout") {
      return jsonp_(callback, logout_(parameters.token));
    }

    if (action === "getCurrentSession") {
      const session = getCurrentSession_(parameters.token);

      return jsonp_(callback, {
        ok: true,
        session: session
          ? {
              sessionId: session.sessionId,
              email: session.email,
              role: session.role,
              expiresAt: formatDate_(session.expiresAt, "dd.MM.yyyy HH:mm:ss")
            }
          : null
      });
    }

    if (action === "listUsers") {
      return jsonp_(callback, {
        ok: true,
        users: listUsers()
      });
    }

    if (action === "getUser") {
      return jsonp_(callback, {
        ok: true,
        user: getUser(
          parameters.userId || parameters.email
        )
      });
    }

    if (action === "createUser") {
      return jsonp_(callback, {
        ok: true,
        result: createUser(
          parameters.email,
          parameters.name,
          parameters.role,
          parameters.active,
          parameters.comment,
          parameters.pin
        )
      });
    }

    if (action === "updateUser") {
      return jsonp_(callback, {
        ok: true,
        result: updateUser(
          parameters.userId,
          parameters.email,
          parameters.name,
          parameters.role,
          parameters.comment
        )
      });
    }

    if (action === "setUserActive") {
      return jsonp_(callback, {
        ok: true,
        result: setUserActive(
          parameters.userId,
          parameters.active
        )
      });
    }

    if (action === "disableUser") {
      return jsonp_(callback, {
        ok: true,
        result: disableUser(parameters.userId)
      });
    }

    if (action === "enableUser") {
      return jsonp_(callback, {
        ok: true,
        result: enableUser(parameters.userId)
      });
    }

    if (action === "listAuditLog") {
      return jsonp_(callback, {
        ok: true,
        auditLog: listAuditLog(parameters.limit)
      });
    }

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
