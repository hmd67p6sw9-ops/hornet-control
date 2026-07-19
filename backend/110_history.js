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
