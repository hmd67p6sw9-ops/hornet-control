Hornet Control v1.6.1-alpha2 — Users API

Додано:
- listUsers
- getUser
- createUser
- updateUser
- setUserActive
- disableUser
- enableUser
- listAuditLog
- валідацію email, ролі та UserID
- захист bootstrap-адміністратора
- аудит створення, редагування, активації та блокування користувачів

Режим безпеки:
SECURITY_ENFORCEMENT_ENABLED залишається false.
Поточний функціонал не блокується.

Встановлення через clasp:
1. Замінити backend/Code.js цим файлом.
2. У Terminal виконати: clasp push
3. В Apps Script створити нову версію deployment.
4. Перевірити існуючий функціонал.

Назва Deployment:
Hornet Control v1.6.1-alpha2 Users API
