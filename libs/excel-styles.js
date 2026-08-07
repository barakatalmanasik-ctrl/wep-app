/* ═══════════════════════════════════════════════════
   بركات المناسك — نظام Excel الاحترافي
   Excel Professional Export Engine v1.0
   ═══════════════════════════════════════════════════ */

'use strict';

var XL = {};

/* ═══════════════════════════════════════
   الألوان والثوابت
═══════════════════════════════════════ */
var XL_COLORS = {
    green:       '1A6B4E',
    greenDark:   '145438',
    greenLight:  'E8F5E9',
    greenMed:    '2E7D5B',
    white:       'FFFFFF',
    black:       '1A1A1A',
    gray:        'F5F5F5',
    grayBorder:  'D0D0D0',
    blue:        '1565C0',
    blueLight:   'E3F2FD',
    red:         'C62828',
    redLight:    'FFEBEE',
    orange:      'E65100',
    orangeLight: 'FFF3E0',
    yellow:      'F9A825',
    yellowLight: 'FFFDE7',
    purple:      '6A1B9A',
    purpleLight: 'F3E5F5',
    teal:        '00695C',
    tealLight:   'E0F2F1',
    dashboardBg: 'F8FAF9'
};

var XL_FONTS = {
    title:   { name: 'Cairo', sz: 18, bold: true, color: { rgb: XL_COLORS.white } },
    subtitle:{ name: 'Cairo', sz: 12, bold: true, color: { rgb: XL_COLORS.greenDark } },
    company: { name: 'Cairo', sz: 10, bold: true, color: { rgb: XL_COLORS.green } },
    header:  { name: 'Cairo', sz: 11, bold: true, color: { rgb: XL_COLORS.white } },
    body:    { name: 'Cairo', sz: 11, bold: false, color: { rgb: XL_COLORS.black } },
    bodyBold:{ name: 'Cairo', sz: 11, bold: true, color: { rgb: XL_COLORS.black } },
    summaryLabel: { name: 'Cairo', sz: 11, bold: true, color: { rgb: XL_COLORS.greenDark } },
    summaryValue: { name: 'Cairo', sz: 12, bold: true, color: { rgb: XL_COLORS.green } },
    dashLabel: { name: 'Cairo', sz: 10, bold: true, color: { rgb: XL_COLORS.greenDark } },
    dashValue: { name: 'Cairo', sz: 14, bold: true, color: { rgb: XL_COLORS.green } },
    footer:  { name: 'Cairo', sz: 9, bold: false, color: { rgb: '888888' } }
};

var XL_FILLS = {
    greenHeader:  { fgColor: { rgb: XL_COLORS.green } },
    greenLight:   { fgColor: { rgb: XL_COLORS.greenLight } },
    white:        { fgColor: { rgb: XL_COLORS.white } },
    gray:         { fgColor: { rgb: XL_COLORS.gray } },
    blueHeader:   { fgColor: { rgb: XL_COLORS.blue } },
    blueLight:    { fgColor: { rgb: XL_COLORS.blueLight } },
    redLight:     { fgColor: { rgb: XL_COLORS.redLight } },
    orangeLight:  { fgColor: { rgb: XL_COLORS.orangeLight } },
    tealLight:    { fgColor: { rgb: XL_COLORS.tealLight } },
    purpleLight:  { fgColor: { rgb: XL_COLORS.purpleLight } },
    yellowLight:  { fgColor: { rgb: XL_COLORS.yellowLight } },
    dashboardBg:  { fgColor: { rgb: XL_COLORS.dashboardBg } }
};

var XL_BORDERS = {
    thin: { style: 'thin', color: { rgb: XL_COLORS.grayBorder } },
    none: {}
};

function xlThinBorder() {
    var b = {};
    b.top = XL_BORDERS.thin; b.bottom = XL_BORDERS.thin;
    b.left = XL_BORDERS.thin; b.right = XL_BORDERS.thin;
    return b;
}

/* ═══════════════════════════════════════
   دوال مساعدة
═══════════════════════════════════════ */

function xlNow() {
    var d = new Date();
    var dateStr = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
    var timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return { date: dateStr, time: timeStr, full: dateStr + '  ' + timeStr };
}

function xlFormatNum(n) {
    var v = safeNum(n);
    return v.toLocaleString('en-US') + ' د.ع';
}

function xlNumPlain(n) {
    return safeNum(n);
}

function xlEmployeeName() {
    try {
        var emp = getEmployeeName();
        return emp || 'غير محدد';
    } catch (e) { return 'غير محدد'; }
}

function xlCompanyName() {
    return 'بركات المناسك';
}

/* ═══════════════════════════════════════
   إنشاء ورقة عمل جديدة
═══════════════════════════════════════ */
function xlCreateSheet(wb, name) {
    var ws = XLSX.utils.aoa_to_sheet([[]]);
    ws['!cols'] = [];
    XLSX.utils.book_append_sheet(wb, ws, name);
    return ws;
}

/* ═══════════════════════════════════════
   ترويسة التقرير (صفوف العناوين)
═══════════════════════════════════════ */
function xlWriteHeader(ws, reportTitle, startRow, numCols) {
    startRow = startRow || 0;
    numCols = numCols || 8;
    var now = xlNow();
    var emp = xlEmployeeName();
    var company = xlCompanyName();

    // Row 0: Company name (merged)
    XLSX.utils.sheet_add_aoa(ws, [[company]], { origin: 'A' + (startRow + 1) });
    var companyCell = XLSX.utils.encode_cell({ r: startRow, c: 0 });
    ws[companyCell].s = {
        font: XL_FONTS.company,
        alignment: { horizontal: 'center', vertical: 'center' }
    };

    // Row 1: Report title (merged, big green banner)
    XLSX.utils.sheet_add_aoa(ws, [[reportTitle]], { origin: 'A' + (startRow + 2) });
    var titleCell = XLSX.utils.encode_cell({ r: startRow + 1, c: 0 });
    ws[titleCell].s = {
        font: XL_FONTS.title,
        fill: XL_FILLS.greenHeader,
        alignment: { horizontal: 'center', vertical: 'center' }
    };

    // Row 2: Date + Time + Employee
    var infoRow = 'تاريخ الإنشاء: ' + now.full + '  |  الموظف: ' + emp;
    XLSX.utils.sheet_add_aoa(ws, [[infoRow]], { origin: 'A' + (startRow + 3) });
    var infoCell = XLSX.utils.encode_cell({ r: startRow + 2, c: 0 });
    ws[infoCell].s = {
        font: XL_FONTS.company,
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: XL_FILLS.greenLight
    };

    // Merge header cells across numCols columns
    var mergeEndCol = numCols - 1;
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push(
        { s: { r: startRow, c: 0 }, e: { r: startRow, c: mergeEndCol } },
        { s: { r: startRow + 1, c: 0 }, e: { r: startRow + 1, c: mergeEndCol } },
        { s: { r: startRow + 2, c: 0 }, e: { r: startRow + 2, c: mergeEndCol } }
    );

    return startRow + 4; // Next available row
}

/* ═══════════════════════════════════════
   لوحة ملخص Dashboard
═══════════════════════════════════════ */
function xlWriteDashboard(ws, cards, startRow, numCols) {
    numCols = numCols || 8;
    cards = cards || [];

    // Dashboard title
    XLSX.utils.sheet_add_aoa(ws, [[ '\u{1F4CA} لوحة الملخص' ]], { origin: 'A' + (startRow + 1) });
    var dashTitleCell = XLSX.utils.encode_cell({ r: startRow, c: 0 });
    ws[dashTitleCell].s = {
        font: XL_FONTS.subtitle,
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: XL_FILLS.greenLight
    };
    ws['!merges'].push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: numCols - 1 } });
    var row = startRow + 2;

    // Arrange cards in rows of 4
    var perRow = 4;
    for (var i = 0; i < cards.length; i += perRow) {
        var rowCards = cards.slice(i, i + perRow);
        var colSpan = Math.floor(numCols / perRow);

        for (var j = 0; j < rowCards.length; j++) {
            var card = rowCards[j];
            var c = j * colSpan;

            // Label cell
            var labelCell = XLSX.utils.encode_cell({ r: row, c: c });
            XLSX.utils.sheet_add_aoa(ws, [[ card.label ]], { origin: XLSX.utils.encode_cell({ r: row, c: c }) });
            ws[labelCell].s = {
                font: XL_FONTS.dashLabel,
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: xlThinBorder(),
                fill: { fgColor: { rgb: card.bgColor || XL_COLORS.greenLight } }
            };

            // Value cell (below label)
            var valCell = XLSX.utils.encode_cell({ r: row + 1, c: c });
            var displayVal = card.isCurrency ? xlFormatNum(card.value) : String(card.value);
            XLSX.utils.sheet_add_aoa(ws, [[ displayVal ]], { origin: XLSX.utils.encode_cell({ r: row + 1, c: c }) });
            ws[valCell].s = {
                font: { name: 'Cairo', sz: 14, bold: true, color: { rgb: card.valueColor || XL_COLORS.green } },
                alignment: { horizontal: 'center', vertical: 'center' },
                border: xlThinBorder(),
                fill: { fgColor: { rgb: card.bgColor || XL_COLORS.greenLight } }
            };

            // Merge label cells if colSpan > 1
            if (colSpan > 1) {
                ws['!merges'].push({ s: { r: row, c: c }, e: { r: row, c: c + colSpan - 1 } });
                ws['!merges'].push({ s: { r: row + 1, c: c }, e: { r: row + 1, c: c + colSpan - 1 } });
            }
        }
        row += 3; // label + value + spacing
    }

    return row;
}

/* ═══════════════════════════════════════
   جدول البيانات الاحترافي
═══════════════════════════════════════ */
function xlWriteTable(ws, headers, data, startRow, options) {
    options = options || {};
    var numCols = headers.length;

    // Write headers
    for (var h = 0; h < headers.length; h++) {
        var cell = XLSX.utils.encode_cell({ r: startRow, c: h });
        XLSX.utils.sheet_add_aoa(ws, [[ headers[h] ]], { origin: cell });
        ws[cell].s = {
            font: XL_FONTS.header,
            fill: XL_FILLS.greenHeader,
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: xlThinBorder()
        };
    }

    // Write data rows
    for (var i = 0; i < data.length; i++) {
        var rowData = data[i];
        var isEven = i % 2 === 0;
        for (var j = 0; j < rowData.length; j++) {
            var dCell = XLSX.utils.encode_cell({ r: startRow + 1 + i, c: j });
            XLSX.utils.sheet_add_aoa(ws, [[ rowData[j] ]], { origin: dCell });
            ws[dCell].s = {
                font: XL_FONTS.body,
                fill: isEven ? XL_FILLS.white : XL_FILLS.greenLight,
                alignment: {
                    horizontal: j === 0 ? 'center' : (options.alignments && options.alignments[j]) || (typeof rowData[j] === 'number' || (typeof rowData[j] === 'string' && /^[\d,]+$/.test(rowData[j]))) ? 'center' : 'right',
                    vertical: 'center',
                    wrapText: true
                },
                border: xlThinBorder()
            };
        }
    }

    // Set column widths
    if (options.colWidths) {
        ws['!cols'] = options.colWidths.map(function(w) { return { wch: w }; });
    } else {
        // Auto-width based on header length and data
        ws['!cols'] = headers.map(function(h, idx) {
            var maxLen = h.length;
            for (var i = 0; i < data.length; i++) {
                var val = String(data[i][idx] || '');
                if (val.length > maxLen) maxLen = val.length;
            }
            return { wch: Math.max(maxLen + 4, 12) };
        });
    }

    // Freeze panes (freeze below header row)
    ws['!freeze'] = { xSplit: 0, ySplit: startRow + 1, topLeftCell: 'A' + (startRow + 2) };

    // Auto filter
    var lastCol = XLSX.utils.encode_col(numCols - 1);
    var lastRow = startRow + data.length;
    ws['!autofilter'] = { ref: 'A' + (startRow + 1) + ':' + lastCol + (lastRow + 1) };

    return lastRow + 2;
}

/* ═══════════════════════════════════════
   قسم ملخص أسفل الجدول
═══════════════════════════════════════ */
function xlWriteSummary(ws, summaryItems, startRow, numCols) {
    numCols = numCols || 8;
    summaryItems = summaryItems || [];
    var halfCols = Math.floor(numCols / 2);

    // Summary box title
    XLSX.utils.sheet_add_aoa(ws, [[ '\u{1F4CB} ملخص التقرير' ]], { origin: 'A' + (startRow + 1) });
    var sumTitleCell = XLSX.utils.encode_cell({ r: startRow, c: 0 });
    ws[sumTitleCell].s = {
        font: XL_FONTS.subtitle,
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: XL_FILLS.greenHeader,
        border: xlThinBorder()
    };
    ws['!merges'].push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: numCols - 1 } });

    var row = startRow + 1;
    var perRow = 2;
    for (var i = 0; i < summaryItems.length; i += perRow) {
        var items = summaryItems.slice(i, i + perRow);
        for (var j = 0; j < items.length; j++) {
            var item = items[j];
            var c = j * halfCols;

            // Label
            var lblCell = XLSX.utils.encode_cell({ r: row, c: c });
            XLSX.utils.sheet_add_aoa(ws, [[ item.label ]], { origin: lblCell });
            ws[lblCell].s = {
                font: XL_FONTS.summaryLabel,
                fill: XL_FILLS.greenLight,
                alignment: { horizontal: 'right', vertical: 'center' },
                border: xlThinBorder()
            };
            ws['!merges'].push({ s: { r: row, c: c }, e: { r: row, c: c + Math.floor(halfCols / 2) - 1 } });

            // Value
            var valC = c + Math.floor(halfCols / 2);
            var valCell = XLSX.utils.encode_cell({ r: row, c: valC });
            var displayVal = item.isCurrency ? xlFormatNum(item.value) : String(item.value);
            XLSX.utils.sheet_add_aoa(ws, [[ displayVal ]], { origin: valCell });
            ws[valCell].s = {
                font: { name: 'Cairo', sz: 12, bold: true, color: { rgb: item.valueColor || XL_COLORS.green } },
                fill: XL_FILLS.white,
                alignment: { horizontal: 'left', vertical: 'center' },
                border: xlThinBorder()
            };
            ws['!merges'].push({ s: { r: row, c: valC }, e: { r: row, c: c + halfCols - 1 } });
        }
        row++;
    }

    // Footer line
    row++;
    XLSX.utils.sheet_add_aoa(ws, [[ 'تم إنشاء هذا التقرير بواسطة نظام بركات المناسك  ' + xlNow().full ]], { origin: 'A' + (row + 1) });
    var footerCell = XLSX.utils.encode_cell({ r: row, c: 0 });
    ws[footerCell].s = {
        font: XL_FONTS.footer,
        alignment: { horizontal: 'center', vertical: 'center' }
    };
    ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: numCols - 1 } });

    return row + 2;
}

/* ═══════════════════════════════════════
   إعدادات الطباعة
═══════════════════════════════════════ */
function xlSetPrintSettings(ws, options) {
    options = options || {};
    var numCols = options.numCols || 8;

    // Page setup - A4
    ws['!page'] = ws['!page'] || {};
    ws['!page'].orientation = options.landscape ? 'landscape' : 'portrait';
    ws['!page'].paper = 9; // A4

    // Margins (in inches)
    ws['!page'].margins = {
        left: 0.5, right: 0.5, top: 0.75, bottom: 0.75,
        header: 0.3, footer: 0.3
    };

    // Header/footer
    ws['!page'].header = {
        center: [
            { text: xlCompanyName() + ' - ' + (options.reportTitle || ''), options: { fontSize: 10, fontFace: 'Cairo' } }
        ]
    };
    ws['!page'].footer = {
        center: [
            { text: '&P / &N', options: { fontSize: 9 } }
        ]
    };

    // Print area
    if (options.printArea) {
        ws['!printArea'] = options.printArea;
    }

    // Fit to page
    ws['!page'].fitTo = { width: 1, height: 0 };
}

/* ═══════════════════════════════════════
   تحميل ملف Excel
═══════════════════════════════════════ */
function xlDownload(wb, filename) {
    var data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════
   إنشاء ملف كامل (تجميع)
═══════════════════════════════════════ */
function xlBuildWorkbook(options) {
    var wb = XLSX.utils.book_new();
    var ws = xlCreateSheet(wb, options.sheetName || 'التقرير');
    var numCols = options.numCols || 8;
    var currentRow = 0;

    // 1. Header
    currentRow = xlWriteHeader(ws, options.title, currentRow, numCols);

    // 2. Dashboard (if cards provided)
    if (options.cards && options.cards.length > 0) {
        currentRow = xlWriteDashboard(ws, options.cards, currentRow, numCols);
    }

    // 3. Data table (if headers and data provided)
    if (options.headers && options.data) {
        currentRow = xlWriteTable(ws, options.headers, options.data, currentRow, options.tableOptions || {});
    }

    // 4. Summary
    if (options.summaryItems && options.summaryItems.length > 0) {
        currentRow = xlWriteSummary(ws, options.summaryItems, currentRow, numCols);
    }

    // 5. Print settings
    xlSetPrintSettings(ws, {
        landscape: options.landscape !== false,
        numCols: numCols,
        reportTitle: options.title,
        printArea: options.printArea
    });

    return wb;
}

/* ═══════════════════════════════════════
   تحميل ملف مكتمل
═══════════════════════════════════════ */
function xlExport(options) {
    var wb = xlBuildWorkbook(options);
    xlDownload(wb, options.filename || 'report.xlsx');
    toast('تم التصدير بنجاح', 'success');
}
