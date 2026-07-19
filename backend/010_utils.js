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


function hashSecret_(value) {
  const rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || "")
  );

  return rawBytes
    .map(function (byte) {
      const unsignedByte = byte < 0 ? byte + 256 : byte;
      const hex = unsignedByte.toString(16);

      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");
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
