/* Hornet Control v1.5.0-alpha1 */

function refreshQrQueueCount() {
  apiRequest(
    {
      action: "getQrQueue"
    },
    function (response) {
      if (!response.ok) {
        return;
      }

      const count =
        (response.queue || []).length;

      const element =
        document.getElementById(
          "qrQueueMenuCount"
        );

      element.textContent =
        count > 0
          ? " (" + count + ")"
          : "";
    }
  );
}

function openQrQueueModal() {
  closeAdminMenu();

  qrQueueItems = [];

  document
    .getElementById("qrQueueModal")
    .classList.remove("hidden");

  document.getElementById(
    "qrQueueSummary"
  ).textContent = "Завантаження…";

  document.getElementById(
    "qrQueueList"
  ).innerHTML = "";

  hideGenericMessage(
    "qrQueueMessage"
  );

  setQrQueueButtonsDisabled(true);

  apiRequest(
    {
      action: "getQrQueue"
    },
    function (response) {
      setQrQueueButtonsDisabled(false);

      if (!response.ok) {
        showGenericMessage(
          "qrQueueMessage",
          response.error ||
            "Не вдалося завантажити чергу",
          "error"
        );
        return;
      }

      qrQueueItems =
        response.queue || [];

      renderQrQueue();

      loadPrintTemplates();
    }
  );
}

function closeQrQueueModal() {
  document
    .getElementById("qrQueueModal")
    .classList.add("hidden");

  hideGenericMessage(
    "qrQueueMessage"
  );
}

function renderQrQueue() {
  const container =
    document.getElementById(
      "qrQueueList"
    );

  const summary =
    document.getElementById(
      "qrQueueSummary"
    );

  container.innerHTML = "";

  summary.textContent =
    "Очікують друку: " +
    qrQueueItems.length;

  if (!qrQueueItems.length) {
    container.innerHTML =
      '<div class="no-items">' +
      "Черга порожня" +
      "</div>";

    setQrQueueButtonsDisabled(true);
    return;
  }

  setQrQueueButtonsDisabled(false);

  qrQueueItems.forEach(function (item) {
    const label =
      document.createElement("label");

    label.className = "queue-item";

    const checkbox =
      document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.className =
      "qr-queue-checkbox";
    checkbox.value = item.id;
    checkbox.checked = true;

    const text =
      document.createElement("span");

    text.className =
      "queue-item-text";

    const id =
      document.createElement("span");

    id.className = "queue-item-id";
    id.textContent = item.id;

    const date =
      document.createElement("span");

    date.className =
      "queue-item-date";

    date.textContent =
      item.created ||
      "Дата не вказана";

    text.appendChild(id);
    text.appendChild(date);

    label.appendChild(checkbox);
    label.appendChild(text);

    container.appendChild(label);
  });
}

function toggleAllQrQueue(checked) {
  document
    .querySelectorAll(
      ".qr-queue-checkbox"
    )
    .forEach(function (checkbox) {
      checkbox.checked = checked;
    });
}

function getSelectedQrQueueIds() {
  return Array.from(
    document.querySelectorAll(
      ".qr-queue-checkbox:checked"
    )
  ).map(function (checkbox) {
    return checkbox.value;
  });
}

function setQrQueueButtonsDisabled(
  disabled
) {
  document.getElementById(
    "createQrPdfButton"
  ).disabled = disabled;

  document.getElementById(
    "markQrPrintedButton"
  ).disabled = disabled;
}

function createQrDataUrlForId(id) {
  const holder =
    document.createElement("div");

  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "-10000px";

  document.body.appendChild(holder);

  new QRCode(holder, {
    text: "HC1:" + id,
    width: 600,
    height: 600,
    correctLevel:
      QRCode.CorrectLevel.H
  });

  const canvas =
    holder.querySelector("canvas");

  const image =
    holder.querySelector("img");

  const dataUrl = canvas
    ? canvas.toDataURL("image/png")
    : image
      ? image.src
      : "";

  holder.remove();

  return dataUrl;
}

function markSelectedQrPrinted() {
  const ids =
    getSelectedQrQueueIds();

  if (!ids.length) {
    showGenericMessage(
      "qrQueueMessage",
      "Вибери хоча б один QR-код",
      "error"
    );
    return;
  }

  const confirmed = window.confirm(
    "Позначити вибрані QR-коди " +
      "надрукованими?"
  );

  if (!confirmed) {
    return;
  }

  setQrQueueButtonsDisabled(true);

  showGenericMessage(
    "qrQueueMessage",
    "Оновлення черги…",
    "info"
  );

  apiRequest(
    {
      action: "markQrPrinted",
      ids: ids.join(",")
    },
    function (response) {
      setQrQueueButtonsDisabled(
        false
      );

      if (!response.ok) {
        showGenericMessage(
          "qrQueueMessage",
          response.error ||
            "Не вдалося оновити чергу",
          "error"
        );
        return;
      }

      showGenericMessage(
        "qrQueueMessage",
        response.result.message,
        "success"
      );

      qrQueueItems =
        qrQueueItems.filter(
          function (item) {
            return !ids.includes(
              item.id
            );
          }
        );

      renderQrQueue();
      refreshQrQueueCount();
    }
  );
}

function showAircraftQr(aircraftId) {
  const id = String(
    aircraftId || selectedAircraftId || "",
  )
    .trim()
    .toUpperCase();

  if (!/^HN-\d{4}$/.test(id)) {
    showCardMessage(
      "Не вдалося визначити ID борта для QR.",
      "error",
    );
    return;
  }

  generatedQrAircraftId = id;
  generatedQrDataUrl = "";

  document.getElementById("qrAircraftId").textContent = id;
  document.getElementById("qrPayload").textContent =
    "HC1:" + id;

  const preview = document.getElementById("qrPreview");
  preview.innerHTML = "";

  new QRCode(preview, {
    text: "HC1:" + id,
    width: 720,
    height: 720,
    correctLevel: QRCode.CorrectLevel.H,
  });

  document
    .getElementById("qrModal")
    .classList.remove("hidden");

  setTimeout(function () {
    generatedQrDataUrl = getQrDataUrl();
  }, 100);
}

function closeQrModal() {
  document
    .getElementById("qrModal")
    .classList.add("hidden");
}

function getQrDataUrl() {
  const preview = document.getElementById("qrPreview");
  const canvas = preview.querySelector("canvas");
  const image = preview.querySelector("img");

  if (canvas) {
    return canvas.toDataURL("image/png");
  }

  if (image && image.src) {
    return image.src;
  }

  return generatedQrDataUrl;
}

function downloadAircraftQr() {
  if (!generatedQrAircraftId) return;

  const dataUrl = getQrDataUrl();

  if (!dataUrl) {
    alert("QR ще не готовий. Спробуй ще раз.");
    return;
  }

  const link = document.createElement("a");

  link.href = dataUrl;
  link.download =
    generatedQrAircraftId + "_QR.png";

  document.body.appendChild(link);
  link.click();
  link.remove();
}

function printAircraftQr() {
  if (!generatedQrAircraftId) return;

  const dataUrl = getQrDataUrl();

  if (!dataUrl) {
    alert("QR ще не готовий. Спробуй ще раз.");
    return;
  }

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("Браузер заблокував вікно друку.");
    return;
  }

  const safeId = escapeHtml(
    generatedQrAircraftId,
  );

  printWindow.document.write(
    "<!doctype html>" +
      "<html lang='uk'>" +
      "<head>" +
      "<meta charset='UTF-8'>" +
      "<title>" +
      safeId +
      "</title>" +
      "<style>" +
      "body{" +
      "margin:0;" +
      "display:flex;" +
      "min-height:100vh;" +
      "align-items:center;" +
      "justify-content:center;" +
      "font-family:Arial,sans-serif;" +
      "}" +
      ".label{" +
      "padding:24px;" +
      "text-align:center;" +
      "}" +
      "img{" +
      "width:320px;" +
      "height:320px;" +
      "}" +
      "h1{" +
      "margin:12px 0 0;" +
      "font-size:32px;" +
      "}" +
      "</style>" +
      "</head>" +
      "<body>" +
      "<div class='label'>" +
      "<img src='" +
      dataUrl +
      "' alt='QR'>" +
      "<h1>" +
      safeId +
      "</h1>" +
      "</div>" +
      "<script>" +
      "window.onload=function(){" +
      "window.print();" +
      "};" +
      "<\/script>" +
      "</body>" +
      "</html>",
  );

  printWindow.document.close();
}
