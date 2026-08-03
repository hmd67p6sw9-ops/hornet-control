function dashboard() {
  ensureBackendFoundation_();

  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const starlinksSheet = getRequiredSheet_(STARLINKS_SHEET);
  const qrQueueSheet = getQrQueueSheet_();

  const aircraftCounts = {
    Warehouse: 0,
    Damaged: 0, // "Пошкоджено/На ремонті" (об'єднано 2026-08-02)
    Refurbish: 0, // "На переробці на БГ"
    Ready: 0, // "На позиції"
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

      if (status === "На складі") {
        aircraftCounts.Warehouse++;
      } else if (status === "Пошкоджено/На ремонті") {
        aircraftCounts.Damaged++;
      } else if (status === "На переробці на БГ") {
        aircraftCounts.Refurbish++;
      } else if (status === "На позиції") {
        aircraftCounts.Ready++;
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
    Used: 0, // "Використаний" (раніше "Втрачений", перейменовано 2026-08-02)
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

      if (status === "Використаний" || status === "Списаний") {
        starlinkCounts.Used++;
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
    Positions: getPositionCounts_(),
    QR: {
      Queued: queued,
      History: history
    }
  };
}