/* ═══════════════════════════════════════════════════
   بركات المناسك — نظام إدارة إصدارات قاعدة البيانات
   Database Versioning & Migration System
   
   الملف الوحيد المسؤول عن تحويل البيانات بين الإصدارات
   ═══════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════
   الإعدادات الأساسية
═══════════════════════════════════════ */

var DB_STORAGE_KEY = 'barakat_db';
var CURRENT_DATABASE_VERSION = 15;
var BACKUP_PREFIX = 'barakat_backup_v';

/* ═══════════════════════════════════════
   هيكل البيانات القياسي
   
   هذا هو الهيكل الوحيد المعتمد في النظام.
   أي حقل جديد يُضاف هنا فقط.
═══════════════════════════════════════ */

var DB_SCHEMA = {
    version: 15,
    settings: {
        currency: 'IQD',
        language: 'ar'
    },
    transactions: [],
    expenses: [],
    expenseCategories: [],
    clients: [],
    manualDebts: [],
    installmentContracts: [],
    deletedItems: [],
    activityLog: [],
    backups: [],
    metadata: {
        createdAt: '',
        lastUpdated: '',
        migratedFrom: null
    }
};

/* ═══════════════════════════════════════
   هيكل عملية واحدة (Transaction Schema)
═══════════════════════════════════════ */

var TX_SCHEMA = {
    id: 0,
    type: 'increase',
    date: '',
    amount: 0,
    basePrice: 0,
    salePrice: 0,
    profit: 0,
    balance: 0,
    customer: '',
    airline: '',
    notes: '',
    clientId: 0,
    paymentMethod: 'cash',
    amountPaid: 0,
    remainingAmount: 0,
    debtPayments: [],
    serviceType: 'ticket',
    bookingRef: '',
    pnr: ''
};

/* ═══════════════════════════════════════
   هيكل مصروف واحد (Expense Schema)
═══════════════════════════════════════ */

var EXPENSE_SCHEMA = {
    id: 0,
    date: '',
    category: '',
    name: '',
    amount: 0,
    amountPaid: 0,
    remaining: 0,
    payments: [],
    description: '',
    notes: '',
    isRecurring: false,
    dueDay: 0,
    paymentStatus: 'paid',
    monthlyRecords: []
};

/* ═══════════════════════════════════════
    هيكل عميل واحد (Client Schema)
═══════════════════════════════════════ */

var CLIENT_SCHEMA = {
    id: 0,
    name: '',
    phone: '',
    address: '',
    notes: '',
    services: [],
    payments: []
};

/* ═══════════════════════════════════════
    هيكل خدمة واحدة (Service Schema)
═══════════════════════════════════════ */

var SERVICE_SCHEMA = {
    id: 0,
    date: '',
    description: '',
    amount: 0,
    paymentMethod: 'cash',
    downPayment: 0,
    installmentCount: 0,
    installmentPeriod: 'monthly',
    firstPaymentDate: '',
    installmentSchedule: []
};

/* ═══════════════════════════════════════
    هيكل قسط واحد (Payment Schema)
═══════════════════════════════════════ */

var PAYMENT_SCHEMA = {
    id: 0,
    date: '',
    amount: 0,
    notes: ''
};

/* ═══════════════════════════════════════
   أدوات الأمان
═══════════════════════════════════════ */

function dbSafeNum(val) {
    var n = Number(val);
    return isNaN(n) ? 0 : Math.trunc(n);
}

function dbSafeStr(val) {
    if (val === undefined || val === null) return '';
    return String(val);
}

function dbNowISO() {
    return new Date().toISOString();
}

/* ═══════════════════════════════════════
   تطبيع عملية واحدة
   
   يضمن أن كل الحقول موجودة وبنوع صحيح
═══════════════════════════════════════ */

function normalizeTransaction(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var tx = {};

    for (var key in TX_SCHEMA) {
        var defaultVal = TX_SCHEMA[key];
        var val = raw[key];

        if (val === undefined || val === null) {
            tx[key] = defaultVal;
        } else if (typeof defaultVal === 'number') {
            var n = Number(val);
            tx[key] = isNaN(n) ? defaultVal : Math.trunc(n);
        } else if (typeof defaultVal === 'string') {
            tx[key] = String(val);
        } else {
            tx[key] = val;
        }
    }

    if (tx.type === 'ticket') {
        tx.profit = dbSafeNum(tx.salePrice) - dbSafeNum(tx.basePrice);
    } else {
        tx.profit = 0;
    }

    tx.balance = 0;

    return tx;
}

/* ═══════════════════════════════════════
   تطبيع مصروف واحد
   
   يضمن أن كل الحقول موجودة وبنوع صحيح
═══════════════════════════════════════ */

function normalizeExpense(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var ex = {};

    for (var key in EXPENSE_SCHEMA) {
        var defaultVal = EXPENSE_SCHEMA[key];
        var val = raw[key];

        if (val === undefined || val === null) {
            ex[key] = defaultVal;
        } else if (typeof defaultVal === 'number') {
            var n = Number(val);
            ex[key] = isNaN(n) ? defaultVal : Math.trunc(n);
        } else if (typeof defaultVal === 'string') {
            ex[key] = String(val);
        } else {
            ex[key] = val;
        }
    }

    return ex;
}

/* ═══════════════════════════════════════
    تطبيع عميل واحد
═══════════════════════════════════════ */

function normalizeClient(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var cl = {};

    for (var key in CLIENT_SCHEMA) {
        var defaultVal = CLIENT_SCHEMA[key];
        var val = raw[key];

        if (val === undefined || val === null) {
            cl[key] = defaultVal;
        } else if (typeof defaultVal === 'number') {
            var n = Number(val);
            cl[key] = isNaN(n) ? defaultVal : Math.trunc(n);
        } else if (typeof defaultVal === 'string') {
            cl[key] = String(val);
        } else if (Array.isArray(defaultVal)) {
            cl[key] = Array.isArray(val) ? val : defaultVal;
        } else {
            cl[key] = val;
        }
    }

    if (!Array.isArray(cl.services)) cl.services = [];
    if (!Array.isArray(cl.payments)) cl.payments = [];

    var normServices = [];
    for (var i = 0; i < cl.services.length; i++) {
        var s = normalizeService(cl.services[i]);
        if (s) normServices.push(s);
    }
    cl.services = normServices;

    var normPayments = [];
    for (var j = 0; j < cl.payments.length; j++) {
        var p = normalizePayment(cl.payments[j]);
        if (p) normPayments.push(p);
    }
    cl.payments = normPayments;

    return cl;
}

/* ═══════════════════════════════════════
    تطبيع خدمة واحدة
═══════════════════════════════════════ */

function normalizeService(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var svc = {};

    for (var key in SERVICE_SCHEMA) {
        var defaultVal = SERVICE_SCHEMA[key];
        var val = raw[key];

        if (val === undefined || val === null) {
            svc[key] = defaultVal;
        } else if (typeof defaultVal === 'number') {
            var n = Number(val);
            svc[key] = isNaN(n) ? defaultVal : Math.trunc(n);
        } else if (typeof defaultVal === 'string') {
            svc[key] = String(val);
        } else if (Array.isArray(defaultVal)) {
            svc[key] = Array.isArray(val) ? val : defaultVal;
        } else {
            svc[key] = val;
        }
    }

    return svc;
}

/* ═══════════════════════════════════════
    تطبيع قسط واحد
═══════════════════════════════════════ */

function normalizePayment(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var pay = {};

    for (var key in PAYMENT_SCHEMA) {
        var defaultVal = PAYMENT_SCHEMA[key];
        var val = raw[key];

        if (val === undefined || val === null) {
            pay[key] = defaultVal;
        } else if (typeof defaultVal === 'number') {
            var n = Number(val);
            pay[key] = isNaN(n) ? defaultVal : Math.trunc(n);
        } else if (typeof defaultVal === 'string') {
            pay[key] = String(val);
        } else {
            pay[key] = val;
        }
    }

    return pay;
}

/* ═══════════════════════════════════════
   قراءة وكتابة قاعدة البيانات
═══════════════════════════════════════ */

function readDB() {
    try {
        var raw = localStorage.getItem(DB_STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && typeof parsed.version === 'number') {
                return parsed;
            }
        }
    } catch (e) {
        /* فشل القراءة — سنُنشئ قاعدة جديدة */
    }
    return null;
}

function writeDB(db) {
    db.metadata.lastUpdated = dbNowISO();
    try {
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
        return true;
    } catch (e) {
        return false;
    }
}

function createEmptyDB() {
    var db = JSON.parse(JSON.stringify(DB_SCHEMA));
    db.version = CURRENT_DATABASE_VERSION;
    db.metadata.createdAt = dbNowISO();
    db.metadata.lastUpdated = dbNowISO();
    return db;
}

/* ═══════════════════════════════════════
   النسخ الاحتياطي
   
   يُنشئ نسخة قبل كل\Migration\
═══════════════════════════════════════ */

function createBackup(db, versionLabel) {
    var backupKey = BACKUP_PREFIX + versionLabel + '_' + Date.now();
    var backup = {
        db: JSON.parse(JSON.stringify(db)),
        timestamp: dbNowISO(),
        version: db.version,
        label: versionLabel
    };
    try {
        localStorage.setItem(backupKey, JSON.stringify(backup));
        if (db.backups && Array.isArray(db.backups)) {
            db.backups.push({
                key: backupKey,
                timestamp: backup.timestamp,
                fromVersion: db.version,
                label: versionLabel
            });
            if (db.backups.length > 10) {
                var removed = db.backups.splice(0, db.backups.length - 10);
                for (var i = 0; i < removed.length; i++) {
                    try { localStorage.removeItem(removed[i].key); } catch (e) { /* تجاهل */ }
                }
            }
        }
        return backupKey;
    } catch (e) {
        return null;
    }
}

function restoreBackup(backupKey) {
    try {
        var raw = localStorage.getItem(backupKey);
        if (raw) {
            var backup = JSON.parse(raw);
            if (backup && backup.db) {
                return backup.db;
            }
        }
    } catch (e) { /* فشل */ }
    return null;
}

function listBackups() {
    var backups = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(BACKUP_PREFIX) === 0) {
            try {
                var raw = localStorage.getItem(key);
                var b = JSON.parse(raw);
                backups.push({
                    key: key,
                    timestamp: b.timestamp,
                    version: b.version,
                    label: b.label
                });
            } catch (e) { /* تجاهل */ }
        }
    }
    backups.sort(function(a, b) { return b.timestamp.localeCompare(a.timestamp); });
    return backups;
}

/* ═══════════════════════════════════════
   التحويلات القديمة
   
   يحوّل البيانات من الإصدارات القديمة
   التي لم يكن بها هيكل موحد
═══════════════════════════════════════ */

function migrateFromOldKeys() {
    var oldKeys = ['barakat_transactions', 'barakat_tickets_v3'];
    var allTransactions = [];
    var maxId = 0;

    for (var k = 0; k < oldKeys.length; k++) {
        try {
            var raw = localStorage.getItem(oldKeys[k]);
            if (!raw) continue;
            var parsed = JSON.parse(raw);
            var txs = [];

            if (Array.isArray(parsed)) {
                txs = parsed;
            } else if (parsed && Array.isArray(parsed.transactions)) {
                txs = parsed.transactions;
            }

            for (var t = 0; t < txs.length; t++) {
                var tx = normalizeTransaction(txs[t]);
                if (tx) {
                    if (tx.type === 'cut') tx.type = 'ticket';
                    if (tx.type === 'commision' || tx.type === 'عمولة') tx.type = 'increase';
                    if (tx.basePrice === 0 && txs[t].payPrice !== undefined) {
                        tx.basePrice = dbSafeNum(txs[t].payPrice);
                    }
                    if (tx.salePrice === 0 && txs[t].travelerPrice !== undefined) {
                        tx.salePrice = dbSafeNum(txs[t].travelerPrice);
                    }
                    if (tx.type === 'ticket') {
                        tx.profit = dbSafeNum(tx.salePrice) - dbSafeNum(tx.basePrice);
                    }
                    allTransactions.push(tx);
                    var txId = dbSafeNum(tx.id);
                    if (txId >= maxId) maxId = txId + 1;
                }
            }
        } catch (e) { /* تجاهل المفتاح التالف */ }
    }

    allTransactions.sort(function(a, b) {
        var da = String(a.date || '');
        var db = String(b.date || '');
        if (da !== db) return da.localeCompare(db);
        return dbSafeNum(a.id) - dbSafeNum(b.id);
    });

    var nextId = maxId > 0 ? maxId : 1;
    for (var i = 0; i < allTransactions.length; i++) {
        allTransactions[i].id = i + 1;
    }
    nextId = allTransactions.length + 1;

    for (var k2 = 0; k2 < oldKeys.length; k2++) {
        try { localStorage.removeItem(oldKeys[k2]); } catch (e) { /* تجاهل */ }
    }

    return { transactions: allTransactions, nextId: nextId };
}

/* ═══════════════════════════════════════
   دوال Migration لكل إصدار
   
   كل دالة مسؤولة عن تحويل من إصدار واحد فقط
   لا تُعدّل الدوال القديمة أبداً
═══════════════════════════════════════ */

/**
 * V0 → V1
 * الإصدار الأول — إنشاء الهيكل الأساسي
 * يحول البيانات القديمة (إن وُجدت) إلى الهيكل الموحد
 */
function migrateV0toV1(db) {
    var old = migrateFromOldKeys();
    db.transactions = old.transactions;
    db.settings = { currency: 'IQD', language: 'ar' };
    db.backups = db.backups || [];
    db.metadata.migratedFrom = 'legacy';
    db.version = 1;
    return db;
}

/**
 * V1 → V2
 * إضافة قسم المصاريف
 */
function migrateV1toV2(db) {
    if (!Array.isArray(db.expenses)) {
        db.expenses = [];
    }
    db.version = 2;
    return db;
}

/**
 * V2 → V3
 * إضافة قسم العملاء
 */
function migrateV2toV3(db) {
    if (!Array.isArray(db.clients)) {
        db.clients = [];
    }
    db.version = 3;
    return db;
}

/**
 * V3 → V4
 * إضافة حقول الأقساط للخدمات
 */
function migrateV3toV4(db) {
    if (Array.isArray(db.clients)) {
        for (var i = 0; i < db.clients.length; i++) {
            var cl = db.clients[i];
            if (Array.isArray(cl.services)) {
                for (var j = 0; j < cl.services.length; j++) {
                    var svc = cl.services[j];
                    if (svc.paymentMethod === undefined) svc.paymentMethod = 'cash';
                    if (svc.downPayment === undefined) svc.downPayment = 0;
                    if (svc.installmentCount === undefined) svc.installmentCount = 0;
                    if (svc.installmentPeriod === undefined) svc.installmentPeriod = 'monthly';
                    if (svc.firstPaymentDate === undefined) svc.firstPaymentDate = '';
                    if (!Array.isArray(svc.installmentSchedule)) svc.installmentSchedule = [];
                }
            }
        }
    }
    db.version = 4;
    return db;
}

/**
 * V4 → V5
 * تطوير نظام المصاريف — حقول جديدة + اقتراحات مخصصة
 */
function migrateV4toV5(db) {
    if (!Array.isArray(db.expenses)) db.expenses = [];
    if (!Array.isArray(db.expenseCategories)) db.expenseCategories = [];

    var defaultCategories = [
        'إيجار', 'كهرباء', 'إنترنت', 'رواتب', 'وقود',
        'إعلانات', 'صيانة', 'ضيافة', 'مستلزمات مكتبية', 'أخرى'
    ];

    for (var i = 0; i < db.expenseCategories.length; i++) {
        var cat = String(db.expenseCategories[i]);
        for (var d = defaultCategories.length - 1; d >= 0; d--) {
            if (defaultCategories[d] === cat) { defaultCategories.splice(d, 1); break; }
        }
    }
    for (var k = 0; k < defaultCategories.length; k++) {
        db.expenseCategories.push(defaultCategories[k]);
    }

    for (var j = 0; j < db.expenses.length; j++) {
        var ex = db.expenses[j];
        if (ex.name === undefined) ex.name = String(ex.category || '');
        if (ex.isRecurring === undefined) ex.isRecurring = false;
        if (ex.dueDay === undefined) ex.dueDay = 0;
        if (ex.paymentStatus === undefined) ex.paymentStatus = 'paid';
        if (!Array.isArray(ex.monthlyRecords)) ex.monthlyRecords = [];
    }

    db.version = 5;
    return db;
}

/**
 * V5 → V6
 * (احتياطي مستقبلي)
 */
function migrateV5toV6(db) {
    var txs = Array.isArray(db.transactions) ? db.transactions : [];
    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        if (tx.type === 'ticket') {
            if (tx.paymentMethod === undefined) tx.paymentMethod = 'cash';
            if (tx.amountPaid === undefined) tx.amountPaid = safeNum(tx.salePrice);
            if (tx.remainingAmount === undefined) tx.remainingAmount = 0;
            if (!Array.isArray(tx.debtPayments)) tx.debtPayments = [];
        }
    }
    db.version = 6;
    return db;
}

/**
 * V6 → V7
 * إضافة سلة المحذوفات (deletedItems)
 */
function migrateV6toV7(db) {
    if (!Array.isArray(db.deletedItems)) {
        db.deletedItems = [];
    }
    db.version = 7;
    return db;
}

/**
 * V7 → V8
 * إضافة الديون اليدوية (manualDebts)
 */
function migrateV7toV8(db) {
    if (!Array.isArray(db.manualDebts)) {
        db.manualDebts = [];
    }
    db.version = 8;
    return db;
}

/**
 * V8 → V9
 * تطوير نظام المصاريف — متابعة الدفع الجزئي
 */
function migrateV8toV9(db) {
    var exps = Array.isArray(db.expenses) ? db.expenses : [];
    for (var i = 0; i < exps.length; i++) {
        var ex = exps[i];
        if (ex.amountPaid === undefined) {
            ex.amountPaid = (ex.paymentStatus === 'paid') ? safeNum(ex.amount) : 0;
        }
        if (ex.remaining === undefined) {
            ex.remaining = Math.max(0, safeNum(ex.amount) - safeNum(ex.amountPaid));
        }
        if (!Array.isArray(ex.payments)) {
            ex.payments = [];
        }
    }
    db.version = 9;
    return db;
}

/**
 * V9 → V10
 * إضافة سجل النشاط (activityLog)
 */
function migrateV9toV10(db) {
    if (!Array.isArray(db.activityLog)) {
        db.activityLog = [];
    }
    db.version = 10;
    return db;
}

/* ═══════════════════════════════════════
   V10 → V11
   إضافة نظام الأقساط
═══════════════════════════════════════ */
function migrateV10toV11(db) {
    if (Array.isArray(db.manualDebts)) {
        for (var i = 0; i < db.manualDebts.length; i++) {
            var d = db.manualDebts[i];
            if (!d.recordType) d.recordType = 'debt';
            if (!Array.isArray(d.installments)) d.installments = [];
            if (d.downPayment === undefined) d.downPayment = 0;
            if (d.installmentCount === undefined) d.installmentCount = 0;
            if (d.installmentValue === undefined) d.installmentValue = 0;
            if (!d.firstDueDate) d.firstDueDate = '';
            if (!d.paymentPeriod) d.paymentPeriod = 'monthly';
            if (!Array.isArray(d.payments)) d.payments = [];
        }
    }
    db.version = 11;
    return db;
}

/* ═══════════════════════════════════════
    V11 → V12
    استقلال نظام الأقساط عن الديون
═══════════════════════════════════════ */
function migrateV11toV12(db) {
    if (!Array.isArray(db.installmentContracts)) {
        db.installmentContracts = [];
    }
    db.version = 12;
    return db;
}

/* ═══════════════════════════════════════
    V12 → V13
    خدمة «قطع» — أنواع خدمات متعددة + حجوزات طيران
═══════════════════════════════════════ */
var SEED_BOOKINGS_V13 = [
    {
        bookingRef: 'FL-429571', pnr: '9PFLTT',
        date: '2026-07-29', airline: 'طيران معراج', basePrice: 183000,
        notes: 'النجف (NJF) → مشهد (MHD) — ذهاب فقط | طيران معراج | رحلة 29/7/2026 | مسافر واحد | FL-429571 / PNR 9PFLTT'
    },
    {
        bookingRef: 'FL-7E5C79', pnr: '13469867',
        date: '2026-08-01', airline: 'طيران سبهران', basePrice: 267546,
        notes: 'طهران (IKA) → النجف (NJF) — ذهاب فقط | طيران سبهران | رحلة 6/8/2026 | 5 مسافرون | FL-7E5C79 / PNR 13469867'
    },
    {
        bookingRef: 'FL-58C41A', pnr: '13471501',
        date: '2026-08-02', airline: 'طيران سبهران', basePrice: 516426,
        notes: 'مشهد (MHD) → النجف (NJF) — ذهاب فقط | طيران سبهران | رحلة 8/8/2026 | 4 مسافرون | FL-58C41A / PNR 13471501'
    }
];

function migrateV12toV13(db) {
    if (!Array.isArray(db.transactions)) db.transactions = [];
    var txs = db.transactions;
    var seen = {};
    var maxId = 0;
    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        if (tx.serviceType === undefined) tx.serviceType = 'ticket';
        if (tx.bookingRef === undefined) tx.bookingRef = '';
        if (tx.pnr === undefined) tx.pnr = '';
        if (tx.bookingRef) seen[String(tx.bookingRef)] = true;
        if (dbSafeNum(tx.id) > maxId) maxId = dbSafeNum(tx.id);
    }
    for (var j = 0; j < SEED_BOOKINGS_V13.length; j++) {
        var sb = SEED_BOOKINGS_V13[j];
        if (seen[sb.bookingRef]) continue;
        txs.push({
            id: ++maxId,
            type: 'ticket',
            serviceType: 'ticket',
            date: sb.date,
            customer: '',
            airline: sb.airline,
            basePrice: sb.basePrice,
            salePrice: 0,
            profit: -sb.basePrice,
            notes: sb.notes,
            amount: 0,
            balance: 0,
            clientId: 0,
            paymentMethod: 'cash',
            amountPaid: 0,
            remainingAmount: 0,
            debtPayments: [],
            bookingRef: sb.bookingRef,
            pnr: sb.pnr
        });
        seen[sb.bookingRef] = true;
    }
    db.version = 13;
    return db;
}

/* ═══════════════════════════════════════
    V13 → V14
    تصحيح بيانات حجوزات V13 + إضافة باقي الحجوزات
    (المكتملة والمؤكدة فقط — الملغاة غير موثقة)
═══════════════════════════════════════ */
var SEED_BOOKINGS_V14 = [
    {
        bookingRef: 'FL-429571', pnr: '9PFLTT',
        date: '2026-07-29', airline: 'طيران معراج', basePrice: 183000,
        notes: 'النجف (NJF) → مشهد (MHD) — ذهاب فقط | طيران معراج | رحلة 29/7/2026 | مسافر واحد | FL-429571 / PNR 9PFLTT'
    },
    {
        bookingRef: 'FL-7E5C79', pnr: '13469867',
        date: '2026-08-01', airline: 'طيران سبهران', basePrice: 267546,
        notes: 'طهران (IKA) → النجف (NJF) — ذهاب فقط | طيران سبهران | رحلة 6/8/2026 | 5 مسافرون | FL-7E5C79 / PNR 13469867'
    },
    {
        bookingRef: 'FL-58C41A', pnr: '13471501',
        date: '2026-08-02', airline: 'طيران سبهران', basePrice: 516426,
        notes: 'مشهد (MHD) → النجف (NJF) — ذهاب فقط | طيران سبهران | رحلة 8/8/2026 | 4 مسافرون | FL-58C41A / PNR 13471501'
    },
    {
        bookingRef: 'FL-72B7DD', pnr: 'FVV82W',
        date: '2026-08-02', airline: 'طيران تابان', basePrice: 537471,
        notes: 'النجف (NJF) → مشهد (MHD) — ذهاب فقط | طيران تابان | رحلة 4/8/2026 | 4 مسافرون | FL-72B7DD / PNR FVV82W'
    },
    {
        bookingRef: 'FL-4256CB', pnr: 'PO12187350',
        date: '2026-08-03', airline: 'إيران اير', basePrice: 107771,
        notes: 'مشهد (MHD) → النجف (NJF) — ذهاب فقط | إيران اير | رحلة 5/8/2026 | مسافر واحد | FL-4256CB / PNR PO12187350'
    },
    {
        bookingRef: 'FL-D5B45D', pnr: '13476644',
        date: '2026-08-05', airline: 'طيران سبهران', basePrice: 144661,
        notes: 'مشهد (MHD) → النجف (NJF) — ذهاب فقط | طيران سبهران | رحلة 5/8/2026 | مسافر واحد | FL-D5B45D / PNR 13476644'
    },
    {
        bookingRef: 'FL-939E58', pnr: 'PO12188640',
        date: '2026-08-06', airline: 'طيران معراج', basePrice: 465491,
        notes: 'النجف (NJF) → مشهد (MHD) — ذهاب فقط | طيران معراج | رحلة 9/8/2026 | 3 مسافرون | FL-939E58 / PNR PO12188640'
    }
];

function migrateV13toV14(db) {
    if (!Array.isArray(db.transactions)) db.transactions = [];
    var txs = db.transactions;
    var maxId = 0;
    for (var i = 0; i < txs.length; i++) {
        if (txs[i].serviceType === undefined) txs[i].serviceType = 'ticket';
        if (txs[i].bookingRef === undefined) txs[i].bookingRef = '';
        if (txs[i].pnr === undefined) txs[i].pnr = '';
        if (dbSafeNum(txs[i].id) > maxId) maxId = dbSafeNum(txs[i].id);
    }
    for (var j = 0; j < SEED_BOOKINGS_V14.length; j++) {
        var sb = SEED_BOOKINGS_V14[j];
        var found = null;
        for (var k = 0; k < txs.length; k++) {
            if (txs[k].bookingRef === sb.bookingRef) { found = txs[k]; break; }
        }
        if (found) {
            found.date = sb.date;
            found.airline = sb.airline;
            found.basePrice = sb.basePrice;
            found.salePrice = 0;
            found.profit = -sb.basePrice;
            found.notes = sb.notes;
            found.pnr = sb.pnr;
            found.paymentMethod = 'cash';
            found.amountPaid = 0;
            found.remainingAmount = 0;
        } else {
            txs.push({
                id: ++maxId,
                type: 'ticket',
                serviceType: 'ticket',
                date: sb.date,
                customer: '',
                airline: sb.airline,
                basePrice: sb.basePrice,
                salePrice: 0,
                profit: -sb.basePrice,
                notes: sb.notes,
                amount: 0,
                balance: 0,
                clientId: 0,
                paymentMethod: 'cash',
                amountPaid: 0,
                remainingAmount: 0,
                debtPayments: [],
                bookingRef: sb.bookingRef,
                pnr: sb.pnr
            });
        }
    }
    db.version = 14;
    return db;
}

/* ═══════════════════════════════════════
    V14 → V15
    تسجيل أسعار البيع من رسائل الواتساب
    + إضافة حجز طيران ذهاب واياب مع فندق (د ضرغام)
═══════════════════════════════════════ */
var SALE_UPDATES_V15 = {
    'FL-429571': { salePrice: 200000, paymentMethod: 'cash', customer: '' },
    'FL-7E5C79': { salePrice: 325000, paymentMethod: 'debt', customer: 'ابو لجين' },
    'FL-4256CB': { salePrice: 118000, paymentMethod: 'debt', customer: 'ضرغام منيدح' },
    'FL-D5B45D': { salePrice: 155000, paymentMethod: 'debt', customer: 'دكتور سلوان محاويل' },
    'FL-939E58': { salePrice: 510000, paymentMethod: 'cash', customer: '' }
};

var HOTEL_BOOKING_V15 = {
    serviceType: 'hotel',
    date: '2026-08-03',
    customer: 'د ضرغام',
    provider: 'طيران ذهاب واياب + فندق',
    basePrice: 1250000,
    salePrice: 1500000,
    paymentMethod: 'cash',
    notes: 'طيران ذهاب واياب مع فندق — د ضرغام | سجل تلقائي V15'
};

function migrateV14toV15(db) {
    if (!Array.isArray(db.transactions)) db.transactions = [];
    var txs = db.transactions;
    var maxId = 0;
    for (var i = 0; i < txs.length; i++) {
        if (txs[i].serviceType === undefined) txs[i].serviceType = 'ticket';
        if (txs[i].bookingRef === undefined) txs[i].bookingRef = '';
        if (txs[i].pnr === undefined) txs[i].pnr = '';
        if (dbSafeNum(txs[i].id) > maxId) maxId = dbSafeNum(txs[i].id);
    }
    for (var j = 0; j < txs.length; j++) {
        var tx = txs[j];
        var up = tx.bookingRef ? SALE_UPDATES_V15[tx.bookingRef] : null;
        if (!up) continue;
        tx.salePrice = up.salePrice;
        tx.profit = up.salePrice - dbSafeNum(tx.basePrice);
        tx.paymentMethod = up.paymentMethod;
        tx.amountPaid = up.paymentMethod === 'debt' ? 0 : up.salePrice;
        tx.remainingAmount = up.paymentMethod === 'debt' ? up.salePrice : 0;
        if (up.customer) tx.customer = up.customer;
    }
    var hasHotel = false;
    for (var k = 0; k < txs.length; k++) {
        if (txs[k].notes && txs[k].notes.indexOf('سجل تلقائي V15') !== -1) { hasHotel = true; break; }
    }
    if (!hasHotel) {
        txs.push({
            id: ++maxId,
            type: 'ticket',
            serviceType: HOTEL_BOOKING_V15.serviceType,
            date: HOTEL_BOOKING_V15.date,
            customer: HOTEL_BOOKING_V15.customer,
            airline: HOTEL_BOOKING_V15.provider,
            basePrice: HOTEL_BOOKING_V15.basePrice,
            salePrice: HOTEL_BOOKING_V15.salePrice,
            profit: HOTEL_BOOKING_V15.salePrice - HOTEL_BOOKING_V15.basePrice,
            notes: HOTEL_BOOKING_V15.notes,
            amount: 0,
            balance: 0,
            clientId: 0,
            paymentMethod: HOTEL_BOOKING_V15.paymentMethod,
            amountPaid: HOTEL_BOOKING_V15.paymentMethod === 'debt' ? 0 : HOTEL_BOOKING_V15.salePrice,
            remainingAmount: HOTEL_BOOKING_V15.paymentMethod === 'debt' ? HOTEL_BOOKING_V15.salePrice : 0,
            debtPayments: [],
            bookingRef: '',
            pnr: ''
        });
    }
    db.version = 15;
    return db;
}

/* ═══════════════════════════════════════
   جدول Migration
     
    أضف هنا كل إصدار جديد ودالة التحويل الخاصة به
═══════════════════════════════════════ */

var MIGRATION_TABLE = {
    0: migrateV0toV1,
    1: migrateV1toV2,
    2: migrateV2toV3,
    3: migrateV3toV4,
    4: migrateV4toV5,
    5: migrateV5toV6,
    6: migrateV6toV7,
    7: migrateV7toV8,
    8: migrateV8toV9,
    9: migrateV9toV10,
    10: migrateV10toV11,
    11: migrateV11toV12,
    12: migrateV12toV13,
    13: migrateV13toV14,
    14: migrateV14toV15
};

/* ═══════════════════════════════════════
   تنفيذ Migration
   
   ي executing جميع التحويلات المطلوبة بالترتيب
═══════════════════════════════════════ */

function executeMigration(db) {
    var fromVersion = db.version;
    var toVersion = CURRENT_DATABASE_VERSION;

    if (fromVersion === toVersion) {
        return { success: true, migrated: false, fromVersion: fromVersion, toVersion: toVersion };
    }

    if (fromVersion > toVersion) {
        return {
            success: false,
            migrated: false,
            future: true,
            message: 'البيانات بإصدار ' + fromVersion + ' — النظام الحالي إصدار ' + toVersion
        };
    }

    var backupKey = createBackup(db, 'before_v' + toVersion);

    var currentVersion = fromVersion;
    try {
        while (currentVersion < toVersion) {
            var migrator = MIGRATION_TABLE[currentVersion];
            if (!migrator) {
                throw new Error('لا توجد دالة migration من V' + currentVersion + ' إلى V' + (currentVersion + 1));
            }
            db = migrator(db);
            db.version = currentVersion + 1;
            db.metadata.lastUpdated = dbNowISO();
            currentVersion = db.version;
        }

        writeDB(db);

        return {
            success: true,
            migrated: true,
            fromVersion: fromVersion,
            toVersion: toVersion,
            backupKey: backupKey
        };
    } catch (e) {
        if (backupKey) {
            var restored = restoreBackup(backupKey);
            if (restored) {
                writeDB(restored);
                return {
                    success: false,
                    migrated: false,
                    error: e.message,
                    restored: true,
                    backupKey: backupKey
                };
            }
        }
        return {
            success: false,
            migrated: false,
            error: e.message,
            restored: false
        };
    }
}

/* ═══════════════════════════════════════
   الدالة الرئيسية
   
   تُستدعى عند بدء تشغيل النظام
═══════════════════════════════════════ */

function initDatabase() {
    var db = readDB();
    var result = {
        db: null,
        migrated: false,
        fresh: false,
        future: false,
        error: null,
        message: ''
    };

    if (!db) {
        db = createEmptyDB();

        var old = migrateFromOldKeys();
        if (old.transactions.length > 0) {
            db.transactions = old.transactions;
            var backupKey = createBackup(db, 'legacy_import');
            writeDB(db);
            result.db = db;
            result.migrated = true;
            result.message = 'تم استيراد ' + old.transactions.length + ' عملية من الإصدار القديم';
            return result;
        }

        writeDB(db);
        result.db = db;
        result.fresh = true;
        result.message = 'تم إنشاء قاعدة بيانات جديدة';
        return result;
    }

    if (db.version === CURRENT_DATABASE_VERSION) {
        result.db = db;
        return result;
    }

    var migrationResult = executeMigration(db);

    if (migrationResult.future) {
        result.future = true;
        result.db = db;
        result.message = migrationResult.message;
        return result;
    }

    if (migrationResult.success) {
        result.db = readDB() || db;
        result.migrated = migrationResult.migrated;
        result.message = migrationResult.migrated
            ? 'تم تحديث قاعدة البيانات من الإصدار ' + migrationResult.fromVersion + ' إلى ' + migrationResult.toVersion + ' بنجاح دون فقدان أي بيانات'
            : '';
        return result;
    }

    result.error = migrationResult.error;
    result.message = migrationResult.restored
        ? 'فشلت عملية التحديث — تم استرجاع النسخة الاحتياطية'
        : 'خطأ غير معروف';
    result.db = readDB() || db;
    return result;
}

/* ═══════════════════════════════════════
   تطبيع عمليات مستوردة
   
   تُستخدم عند استيراد ملف JSON
═══════════════════════════════════════ */

function normalizeImportedTransactions(txs) {
    var result = [];
    if (!Array.isArray(txs)) return result;

    for (var i = 0; i < txs.length; i++) {
        var tx = normalizeTransaction(txs[i]);
        if (tx) result.push(tx);
    }
    return result;
}

/* ═══════════════════════════════════════
   تطبيع مصاريف مستوردة
   
   تُستخدم عند استيراد ملف JSON
═══════════════════════════════════════ */

function normalizeImportedExpenses(exps) {
    var result = [];
    if (!Array.isArray(exps)) return result;

    for (var i = 0; i < exps.length; i++) {
        var ex = normalizeExpense(exps[i]);
        if (ex) result.push(ex);
    }
    return result;
}

/* ═══════════════════════════════════════
    تطبيع عملاء مستوردين
═══════════════════════════════════════ */

function normalizeImportedClients(clients) {
    var result = [];
    if (!Array.isArray(clients)) return result;

    for (var i = 0; i < clients.length; i++) {
        var cl = normalizeClient(clients[i]);
        if (cl) result.push(cl);
    }
    return result;
}

/* ═══════════════════════════════════════
    هيكل دين يدوي واحد (Manual Debt Schema)
═══════════════════════════════════════ */

var MANUAL_DEBT_SCHEMA = {
    id: 0,
    name: '',
    phone: '',
    date: '',
    totalAmount: 0,
    amountPaid: 0,
    remaining: 0,
    reason: '',
    notes: '',
    payments: []
};

/* ═══════════════════════════════════════
    هيكل عقد أقساط واحد (Installment Contract Schema)
═══════════════════════════════════════ */

var INSTALLMENT_CONTRACT_SCHEMA = {
    id: 0,
    name: '',
    phone: '',
    description: '',
    total: 0,
    advance: 0,
    count: 0,
    instValue: 0,
    startDate: '',
    period: 'monthly',
    notes: '',
    installments: [],
    payments: []
};

/* ═══════════════════════════════════════
    تطبيع دين يدوي واحد
═══════════════════════════════════════ */

function normalizeManualDebt(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var d = {};

    for (var key in MANUAL_DEBT_SCHEMA) {
        var defaultVal = MANUAL_DEBT_SCHEMA[key];
        var val = raw[key];

        if (val === undefined || val === null) {
            d[key] = defaultVal;
        } else if (typeof defaultVal === 'number') {
            var n = Number(val);
            d[key] = isNaN(n) ? defaultVal : Math.trunc(n);
        } else if (typeof defaultVal === 'string') {
            d[key] = String(val);
        } else if (Array.isArray(defaultVal)) {
            d[key] = Array.isArray(val) ? val : defaultVal;
        } else {
            d[key] = val;
        }
    }

    if (!Array.isArray(d.payments)) d.payments = [];
    var normPayments = [];
    for (var j = 0; j < d.payments.length; j++) {
        var p = normalizePayment(d.payments[j]);
        if (p) normPayments.push(p);
    }
    d.payments = normPayments;

    return d;
}

/* ═══════════════════════════════════════
    تطبيع دفعة قسط واحد — مع الاحتفاظ بكل الحقول
    (الموظف والوقت) كي لا تُفقد أثناء الاستيراد
═══════════════════════════════════════ */

function normalizeInstallmentPayment(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var p = {
        id: dbSafeNum(raw.id),
        date: (raw.date === undefined || raw.date === null) ? '' : String(raw.date),
        amount: dbSafeNum(raw.amount),
        employee: (raw.employee === undefined || raw.employee === null) ? '' : String(raw.employee),
        notes: (raw.notes === undefined || raw.notes === null) ? '' : String(raw.notes)
    };
    if (raw.time !== undefined && raw.time !== null) p.time = String(raw.time);

    return p;
}

/* ═══════════════════════════════════════
    تطبيع عقد أقساط واحد
═══════════════════════════════════════ */

function normalizeInstallmentContract(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var c = {};

    for (var key in INSTALLMENT_CONTRACT_SCHEMA) {
        var defaultVal = INSTALLMENT_CONTRACT_SCHEMA[key];
        var val = raw[key];

        if (val === undefined || val === null) {
            c[key] = defaultVal;
        } else if (typeof defaultVal === 'number') {
            var n = Number(val);
            c[key] = isNaN(n) ? defaultVal : Math.trunc(n);
        } else if (typeof defaultVal === 'string') {
            c[key] = String(val);
        } else if (Array.isArray(defaultVal)) {
            c[key] = Array.isArray(val) ? val : defaultVal;
        } else {
            c[key] = val;
        }
    }

    if (!Array.isArray(c.installments)) c.installments = [];
    var normInst = [];
    for (var i = 0; i < c.installments.length; i++) {
        var inst = c.installments[i];
        if (!inst || typeof inst !== 'object') continue;

        var ni = {
            id: dbSafeNum(inst.id),
            number: dbSafeNum(inst.number),
            dueDate: (inst.dueDate === undefined || inst.dueDate === null) ? '' : String(inst.dueDate),
            amount: dbSafeNum(inst.amount),
            paid: dbSafeNum(inst.paid),
            status: ['paid', 'unpaid', 'partial', 'overdue', 'cancelled'].indexOf(inst.status) !== -1 ? inst.status : 'unpaid',
            payments: []
        };
        if (Array.isArray(inst.payments)) {
            for (var ip = 0; ip < inst.payments.length; ip++) {
                var np = normalizeInstallmentPayment(inst.payments[ip]);
                if (np) ni.payments.push(np);
            }
        }
        normInst.push(ni);
    }
    c.installments = normInst;

    if (!Array.isArray(c.payments)) c.payments = [];
    var normCPay = [];
    for (var j = 0; j < c.payments.length; j++) {
        var cp = normalizeInstallmentPayment(c.payments[j]);
        if (cp) normCPay.push(cp);
    }
    c.payments = normCPay;

    return c;
}

/* ═══════════════════════════════════════
    تطبيع عنصر من سلة المحذوفات
═══════════════════════════════════════ */

var DELETED_ITEM_TYPES = ['transaction', 'expense', 'client', 'service', 'manualDebt', 'installmentContract'];

function normalizeDeletedItem(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var type = DELETED_ITEM_TYPES.indexOf(raw.type) !== -1 ? raw.type : '';
    if (!type) return null;

    var item = {
        id: dbSafeNum(raw.id),
        type: type,
        data: (raw.data && typeof raw.data === 'object') ? raw.data : {},
        displayName: dbSafeStr(raw.displayName),
        deletedAt: dbSafeNum(raw.deletedAt)
    };
    if (!item.deletedAt) item.deletedAt = Date.now();
    return item;
}

/* ═══════════════════════════════════════
    تطبيع قوائم مستوردة (ديون، عقود، محذوفات، فئات)
═══════════════════════════════════════ */

function normalizeImportedManualDebts(list) {
    var result = [];
    if (!Array.isArray(list)) return result;
    for (var i = 0; i < list.length; i++) {
        var d = normalizeManualDebt(list[i]);
        if (d) result.push(d);
    }
    return result;
}

function normalizeImportedInstallmentContracts(list) {
    var result = [];
    if (!Array.isArray(list)) return result;
    for (var i = 0; i < list.length; i++) {
        var c = normalizeInstallmentContract(list[i]);
        if (c) result.push(c);
    }
    return result;
}

function normalizeImportedDeletedItems(list) {
    var result = [];
    if (!Array.isArray(list)) return result;
    for (var i = 0; i < list.length; i++) {
        var item = normalizeDeletedItem(list[i]);
        if (item) result.push(item);
    }
    return result;
}

function normalizeImportedExpenseCategories(list) {
    var result = [];
    if (!Array.isArray(list)) return result;
    var seen = {};
    for (var i = 0; i < list.length; i++) {
        var s = String(list[i]).trim();
        if (!s || seen[s]) continue;
        seen[s] = true;
        result.push(s);
    }
    return result;
}
