Hornet Control v1.3.6 — етикетки для Xprinter XP-420B

Що додано:
- окремий аркуш Settings з параметрами друку;
- API getPrintSettings;
- PDF створюється під точний розмір рулонної етикетки;
- одна сторінка PDF = одна фізична етикетка;
- великий QR;
- напис HORNET;
- великий ID борта;
- серійний номер;
- поточний розмір і принтер показуються в меню QR на друк;
- черга QR та автоматичне оновлення PWA збережені.

Аркуш Settings створюється автоматично з такими значеннями:

Key | Value
Printer | Xprinter XP-420B
LabelWidth | 60
LabelHeight | 40
QRSize | 25
Title | HORNET
ShowSerial | TRUE
IdFontSize | 15
SerialFontSize | 8
Margin | 2

Значення ширини, висоти, QR та відступів вказуються в міліметрах.
Розміри можна змінити без нового релізу застосунку.

Встановлення:
1. У Code.gs встав чинний API_KEY.
2. Повністю заміни Code.gs в Apps Script.
3. Збережи та опублікуй нову версію.
4. У index.html встав чинні API_URL та API_KEY.
5. Повністю заміни index.html у GitHub.
6. Повністю заміни sw.js.
7. Зроби Commit changes.
8. Закрий PWA та відкрий знову.

Друк:
- вибери XP-420B;
- масштаб 100% / Actual size;
- вимкни Fit to page;
- розмір паперу має відповідати LabelWidth × LabelHeight.
