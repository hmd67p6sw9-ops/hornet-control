Hornet Control v1.6.1-alpha3.1.1 — HealthCheck Headers

Виправлено:
- хибні HEADER_MISMATCH для Aircraft;
- хибні HEADER_MISMATCH для History;
- хибні HEADER_MISMATCH для Starlinks;
- підтримку українських та англійських назв заголовків;
- нечутливість діагностики до регістру, пробілів і символів-розділювачів.

Не змінюється:
- структура Google Sheets;
- дані;
- Sessions;
- авторизація;
- бізнес-API;
- SECURITY_ENFORCEMENT_ENABLED = false.

Встановлення:
1. Замінити backend/Code.js.
2. Виконати clasp push.
3. Створити нову версію deployment.
4. Примусово оновити PWA.
5. Запустити Діагностику системи.

Назва Deployment:
Hornet Control v1.6.1-alpha3.1.1 HealthCheck Headers
