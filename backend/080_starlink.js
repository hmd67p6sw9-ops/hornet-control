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


function normalizeStarlinkId_(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}
