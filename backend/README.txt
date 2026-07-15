Hornet Control v1.6.1-alpha3 — Session Foundation

Додано:
- аркуш Sessions;
- login(email, clientInfo);
- logout(sessionToken);
- getCurrentSession(sessionToken);
- requireAuth_(sessionToken);
- TTL сесії 12 годин;
- SHA-256 хешування токенів;
- завершення прострочених сесій;
- перевірка Active та Role через Users;
- оновлення LastLogin;
- AuditLog для входу, виходу, завершення та відкликання сесій;
- API-маршрути login, logout, getCurrentSession;
- перевірка Sessions у healthCheck.

Не змінено:
- SECURITY_ENFORCEMENT_ENABLED = false;
- існуючий frontend;
- бізнес-API;
- Users UI;
- Google Sign-In.

Встановлення:
1. Замінити backend/Code.js.
2. Виконати clasp push.
3. Створити нову версію Web App deployment.
4. Відкрити застосунок або запустити healthCheck.
5. Перевірити появу аркуша Sessions.

Назва Deployment:
Hornet Control v1.6.1-alpha3 Session Foundation
