/* Hornet Control v1.5.0-alpha1 */

function isJsPdfReady() {
  return Boolean(
    window.jspdf &&
    window.jspdf.jsPDF
  );
}

function loadExternalScript(
  source,
  timeoutMilliseconds
) {
  return new Promise(
    function (resolve, reject) {
      const script =
        document.createElement("script");

      let finished = false;

      const timeoutId = setTimeout(
        function () {
          if (finished) {
            return;
          }

          finished = true;
          script.remove();

          reject(
            new Error(
              "Перевищено час завантаження"
            )
          );
        },
        timeoutMilliseconds
      );

      script.src = source;
      script.async = true;
      script.crossOrigin = "anonymous";

      script.onload = function () {
        if (finished) {
          return;
        }

        finished = true;
        clearTimeout(timeoutId);
        resolve();
      };

      script.onerror = function () {
        if (finished) {
          return;
        }

        finished = true;
        clearTimeout(timeoutId);
        script.remove();

        reject(
          new Error(
            "Не вдалося завантажити скрипт"
          )
        );
      };

      document.head.appendChild(script);
    }
  );
}

async function ensureJsPdfLoaded() {
  if (isJsPdfReady()) {
    return true;
  }

  if (jsPdfLoadPromise) {
    return jsPdfLoadPromise;
  }

  const sources = [
    "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"
  ];

  jsPdfLoadPromise = (
    async function () {
      for (
        let index = 0;
        index < sources.length;
        index++
      ) {
        try {
          await loadExternalScript(
            sources[index],
            12000
          );

          if (isJsPdfReady()) {
            return true;
          }
        } catch (error) {
          console.warn(
            "jsPDF source failed:",
            sources[index],
            error
          );
        }
      }

      throw new Error(
        "Не вдалося завантажити jsPDF " +
        "з жодного доступного джерела."
      );
    }
  )();

  try {
    return await jsPdfLoadPromise;
  } catch (error) {
    jsPdfLoadPromise = null;
    throw error;
  }
}

function loadPrintTemplates() {
  apiRequest(
    {
      action: "getPrintTemplates"
    },
    function (response) {
      if (!response.ok) {
        showGenericMessage(
          "qrQueueMessage",
          response.error ||
            "Не вдалося завантажити шаблони друку",
          "error"
        );
        return;
      }

      printTemplates =
        response.templates || [];

      renderPrintTemplateOptions();
    }
  );
}

function renderPrintTemplateOptions() {
  const select =
    document.getElementById(
      "printTemplateSelect"
    );

  select.innerHTML = "";

  if (!printTemplates.length) {
    const option =
      document.createElement("option");

    option.value = "";
    option.textContent =
      "Немає доступних шаблонів";

    select.appendChild(option);
    selectedPrintTemplate = null;
    renderPrintTemplateSummary();
    return;
  }

  printTemplates.forEach(
    function (template) {
      const option =
        document.createElement("option");

      option.value = template.id;
      option.textContent =
        template.name;

      select.appendChild(option);
    }
  );

  const savedTemplateId =
    localStorage.getItem(
      "hornetPrintTemplate"
    );

  const preferred =
    printTemplates.find(
      function (template) {
        return (
          template.id ===
          savedTemplateId
        );
      }
    ) || printTemplates[0];

  select.value = preferred.id;
  selectedPrintTemplate = preferred;

  renderPrintTemplateSummary();
}

function onPrintTemplateChange() {
  const select =
    document.getElementById(
      "printTemplateSelect"
    );

  selectedPrintTemplate =
    printTemplates.find(
      function (template) {
        return (
          template.id ===
          select.value
        );
      }
    ) || null;

  if (selectedPrintTemplate) {
    localStorage.setItem(
      "hornetPrintTemplate",
      selectedPrintTemplate.id
    );
  }

  renderPrintTemplateSummary();
}

function renderPrintTemplateSummary() {
  const element =
    document.getElementById(
      "printSettingsSummary"
    );

  if (!selectedPrintTemplate) {
    element.textContent = "";
    return;
  }

  const template =
    selectedPrintTemplate;

  if (template.type === "SHEET") {
    element.textContent =
      template.pageWidth +
      " × " +
      template.pageHeight +
      " мм • " +
      template.columns +
      " × " +
      template.rows +
      " = " +
      (
        template.columns *
        template.rows
      ) +
      " етикетки";
    return;
  }

  element.textContent =
    template.labelWidth +
    " × " +
    template.labelHeight +
    " мм • одна сторінка = одна етикетка";
}

function createQrQueuePdf() {
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

  if (!selectedPrintTemplate) {
    showGenericMessage(
      "qrQueueMessage",
      "Вибери шаблон друку",
      "error"
    );
    return;
  }

  setQrQueueButtonsDisabled(true);

  showGenericMessage(
    "qrQueueMessage",
    "Завантаження бібліотеки PDF…",
    "info"
  );

  ensureJsPdfLoaded()
    .then(function () {
      generatePdfByTemplate(
        ids,
        selectedPrintTemplate
      );
    })
    .catch(function (error) {
      setQrQueueButtonsDisabled(
        false
      );

      showGenericMessage(
        "qrQueueMessage",
        error.message ||
          "Не вдалося завантажити бібліотеку PDF",
        "error"
      );
    });
}

function generatePdfByTemplate(
  ids,
  template
) {
  if (template.type === "SHEET") {
    generateSheetLabelPdf(
      ids,
      template
    );
    return;
  }

  if (template.type === "ROLL") {
    generateRollLabelPdf(
      ids,
      template
    );
    return;
  }

  setQrQueueButtonsDisabled(false);

  showGenericMessage(
    "qrQueueMessage",
    "Невідомий тип шаблону: " +
      template.type,
    "error"
  );
}

function generateSheetLabelPdf(
  ids,
  template
) {
  showGenericMessage(
    "qrQueueMessage",
    "Створення A4 PDF…",
    "info"
  );

  try {
    const jsPDF =
      window.jspdf.jsPDF;

    const pageWidth =
      Number(template.pageWidth);

    const pageHeight =
      Number(template.pageHeight);

    const columns =
      Number(template.columns);

    const rows =
      Number(template.rows);

    const labelsPerPage =
      columns * rows;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [
        pageWidth,
        pageHeight
      ],
      compress: true
    });

    ids.forEach(function (id, index) {
      if (
        index > 0 &&
        index % labelsPerPage === 0
      ) {
        pdf.addPage(
          [
            pageWidth,
            pageHeight
          ],
          "portrait"
        );
      }

      const position =
        index % labelsPerPage;

      const column =
        position % columns;

      const row =
        Math.floor(
          position / columns
        );

      const x =
        Number(template.marginLeft) +
        column *
          (
            Number(
              template.labelWidth
            ) +
            Number(template.gapX)
          );

      const y =
        Number(template.marginTop) +
        row *
          (
            Number(
              template.labelHeight
            ) +
            Number(template.gapY)
          );

      const queueItem =
        qrQueueItems.find(
          function (item) {
            return item.id === id;
          }
        ) || {};

      drawSheetLabel(
        pdf,
        x,
        y,
        id,
        queueItem.serialNumber || "",
        template
      );
    });

    const filename =
      "Hornet_A4_44_" +
      new Date()
        .toISOString()
        .slice(0, 10) +
      ".pdf";

    pdf.save(filename);

    showGenericMessage(
      "qrQueueMessage",
      "A4 PDF створено. Друкуй у масштабі 100% без «Підігнати до сторінки».",
      "success"
    );
  } catch (error) {
    showGenericMessage(
      "qrQueueMessage",
      error.message ||
        "Не вдалося створити A4 PDF",
      "error"
    );
  } finally {
    setQrQueueButtonsDisabled(
      false
    );
  }
}

function drawSheetLabel(
  pdf,
  x,
  y,
  aircraftId,
  serialNumber,
  template
) {
  const labelWidth =
    Number(template.labelWidth);

  const labelHeight =
    Number(template.labelHeight);

  const qrSize = Math.min(
    Number(template.qrSize),
    labelHeight - 3,
    labelWidth * 0.48
  );

  const qrData =
    createQrDataUrlForId(
      aircraftId
    );

  const qrX = x + 1.5;
  const qrY =
    y +
    (labelHeight - qrSize) / 2;

  pdf.addImage(
    qrData,
    "PNG",
    qrX,
    qrY,
    qrSize,
    qrSize
  );

  const textX =
    x + qrSize + 3;

  const textWidth =
    labelWidth - qrSize - 4;

  pdf.setTextColor(0);
  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    Number(
      template.idFontSize || 9
    )
  );

  pdf.text(
    aircraftId,
    textX,
    y + labelHeight / 2 + 1,
    {
      maxWidth: textWidth
    }
  );

  if (
    template.showSerial &&
    serialNumber
  ) {
    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(
      Number(
        template.serialFontSize || 6
      )
    );

    pdf.text(
      "SN: " + serialNumber,
      textX,
      y + labelHeight / 2 + 5,
      {
        maxWidth: textWidth
      }
    );
  }
}

function generateRollLabelPdf(
  ids,
  template
) {
  showGenericMessage(
    "qrQueueMessage",
    "Створення PDF для термопринтера…",
    "info"
  );

  try {
    const jsPDF =
      window.jspdf.jsPDF;

    const width =
      Number(template.labelWidth);

    const height =
      Number(template.labelHeight);

    const orientation =
      width >= height
        ? "landscape"
        : "portrait";

    const pdf = new jsPDF({
      orientation: orientation,
      unit: "mm",
      format: [width, height],
      compress: true
    });

    ids.forEach(function (id, index) {
      if (index > 0) {
        pdf.addPage(
          [width, height],
          orientation
        );
      }

      const queueItem =
        qrQueueItems.find(
          function (item) {
            return item.id === id;
          }
        ) || {};

      drawRollLabel(
        pdf,
        id,
        queueItem.serialNumber || "",
        template
      );
    });

    const filename =
      "Hornet_" +
      template.id +
      "_" +
      new Date()
        .toISOString()
        .slice(0, 10) +
      ".pdf";

    pdf.save(filename);

    showGenericMessage(
      "qrQueueMessage",
      "PDF створено: одна сторінка — одна етикетка. Друкуй у масштабі 100%.",
      "success"
    );
  } catch (error) {
    showGenericMessage(
      "qrQueueMessage",
      error.message ||
        "Не вдалося створити PDF",
      "error"
    );
  } finally {
    setQrQueueButtonsDisabled(
      false
    );
  }
}

function drawRollLabel(
  pdf,
  aircraftId,
  serialNumber,
  template
) {
  const width =
    Number(template.labelWidth);

  const height =
    Number(template.labelHeight);

  const qrSize = Math.min(
    Number(template.qrSize),
    height - 12,
    width - 8
  );

  const qrData =
    createQrDataUrlForId(
      aircraftId
    );

  const title =
    String(template.title || "")
      .trim();

  let y = 2;

  if (title) {
    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(7);
    pdf.setTextColor(90);

    pdf.text(
      title,
      width / 2,
      4,
      {
        align: "center"
      }
    );

    y = 5;
  }

  const qrX =
    (width - qrSize) / 2;

  pdf.addImage(
    qrData,
    "PNG",
    qrX,
    y,
    qrSize,
    qrSize
  );

  pdf.setTextColor(0);
  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    Number(
      template.idFontSize || 15
    )
  );

  pdf.text(
    aircraftId,
    width / 2,
    y + qrSize + 4,
    {
      align: "center"
    }
  );

  if (
    template.showSerial &&
    serialNumber
  ) {
    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(
      Number(
        template.serialFontSize || 8
      )
    );

    pdf.text(
      "SN: " + serialNumber,
      width / 2,
      height - 2,
      {
        align: "center",
        maxWidth: width - 4
      }
    );
  }
}
