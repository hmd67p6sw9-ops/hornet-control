Hornet Control — Diagnostics module

1. Розпакуй архів.
2. Додай diagnostics.js у корінь репозиторію поруч з index.html.
3. Переконайся, що index.html містить:
   <script src="diagnostics.js"></script>
4. Зроби commit.
5. Повністю закрий PWA і відкрий знову.

Модуль очікує, що в index.html вже існують елементи:
diagnosticsModal, diagnosticsStatus, diagnosticsCheckedAt,
diagnosticsSummary, diagnosticsSheets, diagnosticsIssues,
diagnosticsMessage, runDiagnosticsButton.
