Hornet Control v1.4.0 — Print Engine

Додано універсальний модуль друку з вибором шаблону.

Шаблони за замовчуванням:
1. A4 — 44 етикетки 48,5 × 25,44 мм
   - 4 колонки × 11 рядків;
   - аркуш 210 × 297 мм;
   - поля 8 мм зліва та 8,58 мм зверху;
   - QR та ID борта на кожній етикетці.

2. Xprinter XP-420B — 60 × 40 мм
   - одна сторінка PDF = одна етикетка;
   - великий QR;
   - ID борта;
   - серійний номер.

Новий аркуш PrintTemplates створюється автоматично.
Кожен рядок — окремий шаблон друку.

Колонки:
ID
Name
Type
PageWidth
PageHeight
Columns
Rows
LabelWidth
LabelHeight
MarginLeft
MarginTop
GapX
GapY
QRSize
ShowSerial
Title
IdFontSize
SerialFontSize

Типи:
- SHEET — аркуш із кількома етикетками;
- ROLL — одна етикетка на сторінку.

Щоб додати новий принтер або папір, достатньо додати рядок
у PrintTemplates. Логіку черги QR змінювати не потрібно.

Оновлення:
1. У Code.gs встав чинний API_KEY.
2. Повністю заміни Code.gs в Apps Script.
3. Опублікуй нову версію.
4. У index.html встав чинні API_URL та API_KEY.
5. Замінити index.html і sw.js у GitHub.
6. Зробити Commit changes.
7. Перезапустити PWA.

Для A4:
- масштаб 100%;
- вимкнути Fit to page / Підігнати;
- папір A4;
- спочатку зробити пробний друк на звичайному аркуші.
