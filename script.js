/* ═══════════════════════════════════════════════════
   بركات المناسك — نظام التذاكر v15.3.0
   محرك الحسابات الدقيق — متكامل مع نظام الإصدارات
   
   يعتمد على migration.js لإدارة قاعدة البيانات
   ═══════════════════════════════════════════════════ */

'use strict';

var DB_KEY = 'barakat_db';
var db = null;
var nextId = 1;
var nextExpId = 1;
var nextClientId = 1;
var currentClientId = null;
var ticketContext = false;
var confirmCallback = null;

/* ═══════════════════════════════════════
   أداة الأمان
═══════════════════════════════════════ */
function safeNum(val) {
    var n = Number(val);
    return isNaN(n) ? 0 : Math.trunc(n);
}

function fmt(n) {
    return safeNum(n).toLocaleString('en-US');
}

function getTransactions() {
    return (db && Array.isArray(db.transactions)) ? db.transactions : [];
}

function setTransactions(txs) {
    if (db) db.transactions = txs;
}

function getExpenses() {
    return (db && Array.isArray(db.expenses)) ? db.expenses : [];
}

function setExpenses(exps) {
    if (db) db.expenses = exps;
}

function getClients() {
    return (db && Array.isArray(db.clients)) ? db.clients : [];
}

function setClients(clients) {
    if (db) db.clients = clients;
}

function getDeletedItems() {
    return (db && Array.isArray(db.deletedItems)) ? db.deletedItems : [];
}

function setDeletedItems(items) {
    if (db) db.deletedItems = items;
}

var TRASH_RETENTION_MS = 24 * 60 * 60 * 1000;

function getManualDebts() {
    return (db && Array.isArray(db.manualDebts)) ? db.manualDebts : [];
}

function setManualDebts(debts) {
    if (db) db.manualDebts = debts;
}

/* ═══════════════════════════════════════
   نظام الموظف — جلسة العمل
══════════════════════════════════════ */
var _employeeSession = null;

function getEmployeeSession() {
    return _employeeSession;
}

function setEmployeeSession(name, uid) {
    _employeeSession = { name: String(name), date: todayStr() };
    if (typeof sbUpdateProfileName === 'function') {
        Promise.resolve().then(function() {
            return sbUpdateProfileName(name, uid);
        }).catch(function() { /* تجاهل فشل الحفظ — الجلسة في الذاكرة */ });
    }
}

function clearEmployeeSession() {
    _employeeSession = null;
}

function getEmployeeName() {
    var session = getEmployeeSession();
    if (session && session.date === todayStr()) return session.name;
    return '';
}

function checkEmployeeSession() {
    var name = getEmployeeName();
    if (!name) {
        showLoginOverlay();
        return false;
    }
    updateEmployeeDisplay(name);
    return true;
}

function showLoginOverlay() {
    var overlay = document.getElementById('loginOverlay');
    if (overlay) {
        overlay.classList.add('show');
        var nameInput = document.getElementById('employeeNameInput');
        var emailInput = document.getElementById('loginEmailInput');
        var passInput = document.getElementById('loginPasswordInput');
        var submitBtn = document.getElementById('loginSubmitBtn');
        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        if (submitBtn) submitBtn.disabled = false;
        if (nameInput) nameInput.focus();
        var switchBtn = document.getElementById('switchUserBtn');
        var logoutBtn = document.getElementById('logoutBtn');
        var userCard = document.getElementById('sidebarUserCard');
        if (switchBtn) switchBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userCard) userCard.style.display = 'none';
    }
}

function hideLoginOverlay() {
    var overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.remove('show');
}

function submitEmployeeLogin(e) {
    e.preventDefault();
    var nameInput = document.getElementById('employeeNameInput');
    var emailInput = document.getElementById('loginEmailInput');
    var passInput = document.getElementById('loginPasswordInput');
    var name = (nameInput ? nameInput.value : '').trim();
    var email = (emailInput ? emailInput.value : '').trim();
    var pass = passInput ? passInput.value : '';
    if (!name || !email || !pass) {
        if (typeof toast === 'function') toast('أدخل الاسم والبريد الإلكتروني وكلمة المرور', 'error');
        return;
    }
    var btn = document.getElementById('loginSubmitBtn');
    if (btn) btn.disabled = true;
    Promise.resolve()
        .then(function() { return supabaseSignIn(email, pass); })
        .then(function(session) { return finishEmployeeLogin(name, session); })
        .catch(function(err) {
            console.error('Login failed:', err);
            if (typeof toast === 'function') {
                toast('فشل تسجيل الدخول: ' + (err && err.message ? err.message : 'حاول مجدداً'), 'error');
            }
        })
        .then(function() {
            if (btn) btn.disabled = false;
        });
}

/* إكمال الدخول:
   - الهوية تُحدد من جلسة Supabase (auth.uid()) وليس من الاسم المكتوب.
   - يُجلب الـ profile المرتبط بـ auth.uid() فقط (لا بحث بالاسم).
   - إن وُجد اسم محفوظ يظهر هو، ويُحدَّث فقط إذا كتب المستخدم اسماً جديداً.
   - كل تحديث للاسم يستهدف سجل المستخدم الحالي (uid) فقط. */
function finishEmployeeLogin(name, session) {
    var uid = (session && session.user) ? String(session.user.id) : '';
    return Promise.resolve()
        .then(function() {
            if (typeof sbGetEmployeeSession === 'function') return sbGetEmployeeSession();
            return null;
        })
        .then(function(profile) {
            var savedName = profile ? String(profile.name || '').trim() : '';
            var finalName;
            if (savedName && (!name || name === savedName)) {
                finalName = savedName;
            } else {
                finalName = name || savedName || 'موظف';
            }
            setEmployeeSession(finalName, uid);
            return finalName;
        })
        .then(function(finalName) {
            if (window.__SUPA_DB__ && db) {
                hideLoginOverlay();
                updateEmployeeDisplay(finalName);
                initApp();
                return;
            }
            return sbLoadAll().then(function(loadedDb) {
                window.__SUPA_DB__ = loadedDb;
                db = loadedDb;
                hideLoginOverlay();
                updateEmployeeDisplay(finalName);
                initApp();
            });
        });
}

function switchEmployee() {
    showConfirm('هل تريد تبديل الحساب؟', function(ok) {
        if (!ok) return;
        clearEmployeeSession();
        appInitialized = false;
        db = null;
        window.__SUPA_DB__ = null;
        if (typeof supabaseSignOut === 'function') {
            supabaseSignOut().then(function() { showLoginOverlay(); });
        } else {
            showLoginOverlay();
        }
    });
}

function logoutEmployee() {
    showConfirm('هل تريد تسجيل الخروج؟', function(ok) {
        if (!ok) return;
        clearEmployeeSession();
        appInitialized = false;
        db = null;
        window.__SUPA_DB__ = null;
        if (typeof supabaseSignOut === 'function') {
            supabaseSignOut().then(function() { showLoginOverlay(); });
        } else {
            showLoginOverlay();
        }
    });
}

function updateEmployeeDisplay(name) {
    var topbar = document.getElementById('topbarEmployee');
    var switchBtn = document.getElementById('switchUserBtn');
    var logoutBtn = document.getElementById('logoutBtn');
    var userCard = document.getElementById('sidebarUserCard');
    var sucName = document.getElementById('sucName');
    if (topbar) topbar.innerHTML = '<i data-lucide="user" style="width:16px;height:16px"></i> ' + name;
    if (sucName) sucName.textContent = name;
    if (userCard) userCard.style.display = '';
    if (switchBtn) switchBtn.style.display = '';
    if (logoutBtn) logoutBtn.style.display = '';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ═══════════════════════════════════════
   سجل النشاط
══════════════════════════════════════ */
function getActivityLog() {
    return (db && Array.isArray(db.activityLog)) ? db.activityLog : [];
}

function setActivityLog(log) {
    if (db) db.activityLog = log;
}

function nowTimeStr() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function logActivity(action, description) {
    var log = getActivityLog();
    var maxId = 0;
    for (var i = 0; i < log.length; i++) {
        var lid = safeNum(log[i].id);
        if (lid > maxId) maxId = lid;
    }
    var d = new Date();
    var day = d.getDate();
    var month = d.getMonth() + 1;
    var year = d.getFullYear();
    var dateStr = (day < 10 ? '0' : '') + day + '/' + (month < 10 ? '0' : '') + month + '/' + year;
    log.push({
        id: maxId + 1,
        date: dateStr,
        time: nowTimeStr(),
        employee: getEmployeeName() || '—',
        action: String(action),
        description: String(description || '')
    });
    setActivityLog(log);
}

function renderActivityLog() {
    var body = document.getElementById('activityBody');
    var empty = document.getElementById('activityEmpty');
    var tableWrap = document.getElementById('activityTableWrap');
    if (!body) return;
    var log = getActivityLog();
    var search = (document.getElementById('activitySearch') || {}).value || '';
    var filtered = [];
    for (var i = 0; i < log.length; i++) {
        var entry = log[i];
        var matchSearch = !search ||
            (entry.employee || '').indexOf(search) !== -1 ||
            (entry.action || '').indexOf(search) !== -1 ||
            (entry.description || '').indexOf(search) !== -1;
        if (matchSearch) filtered.push(entry);
    }
    filtered.sort(function(a, b) { return b.id - a.id; });
    var resultsEl = document.getElementById('activityResults');
    if (resultsEl) resultsEl.textContent = filtered.length + ' سجل';
    if (filtered.length === 0) {
        body.innerHTML = '';
        if (empty) empty.style.display = '';
        if (tableWrap) tableWrap.style.display = 'none';
        return;
    }
    if (empty) empty.style.display = 'none';
    if (tableWrap) tableWrap.style.display = '';
    var html = '';
    for (var j = 0; j < filtered.length; j++) {
        var entry2 = filtered[j];
        html += '<tr>';
        html += '<td>' + (j + 1) + '</td>';
        html += '<td>' + (entry2.date || '—') + '</td>';
        html += '<td>' + (entry2.time || '—') + '</td>';
        html += '<td>' + (entry2.employee || '—') + '</td>';
        html += '<td><span class="badge badge-blue">' + (entry2.action || '—') + '</span></td>';
        html += '<td>' + (entry2.description || '—') + '</td>';
        html += '</tr>';
    }
    body.innerHTML = html;
}

function exportActivityExcel() {
    var log = getActivityLog();
    if (log.length === 0) { toast('لا توجد بيانات للتصدير', 'warning'); return; }

    var headers = ['#', 'التاريخ', 'الوقت', 'الموظف', 'العملية', 'الوصف'];
    var data = [];
    for (var i = 0; i < log.length; i++) {
        var e2 = log[i];
        data.push([i + 1, e2.date || '—', e2.time || '—', e2.employee || '—', e2.action || '—', e2.description || '—']);
    }

    // Dashboard cards
    var uniqueEmployees = {};
    var uniqueActions = {};
    for (var j = 0; j < log.length; j++) {
        if (log[j].employee) uniqueEmployees[log[j].employee] = true;
        if (log[j].action) uniqueActions[log[j].action] = true;
    }

    var cards = [
        { label: 'إجمالي العمليات', value: log.length, bgColor: 'E8F5E9', valueColor: '1A6B4E' },
        { label: 'عدد الموظفين', value: Object.keys(uniqueEmployees).length, bgColor: 'E3F2FD', valueColor: '1565C0' },
        { label: 'أنواع العمليات', value: Object.keys(uniqueActions).length, bgColor: 'FFF3E0', valueColor: 'E65100' },
        { label: 'آخر عملية', value: log[log.length - 1].date || '—', bgColor: 'F3E5F5', valueColor: '6A1B9A' }
    ];

    var summaryItems = [
        { label: 'إجمالي العمليات', value: log.length, isCurrency: false },
        { label: 'عدد الموظفين', value: Object.keys(uniqueEmployees).length, isCurrency: false },
        { label: 'تاريخ البداية', value: log[0].date || '—', isCurrency: false },
        { label: 'تاريخ النهاية', value: log[log.length - 1].date || '—', isCurrency: false }
    ];

    xlExport({
        title: 'سجل النشاطات',
        filename: 'activity_log_' + todayStr() + '.xlsx',
        sheetName: 'سجل النشاطات',
        numCols: 6,
        cards: cards,
        headers: headers,
        data: data,
        summaryItems: summaryItems,
        landscape: false,
        tableOptions: { colWidths: [6, 14, 10, 16, 18, 40] }
    });
}

function printActivityLog() {
    window.print();
}

/* ═══════════════════════════════════════
   التهيئة
══════════════════════════════════════ */
var appInitialized = false;

document.addEventListener('DOMContentLoaded', function() {
    bootApp();
    enhanceMobileTables();
    observeMobileTables();
    initModalDrag();
});

function enhanceMobileTables() {
    var tables = document.querySelectorAll('table.tbl, table.table');
    for (var t = 0; t < tables.length; t++) {
        var table = tables[t];
        var thead = table.querySelector('thead');
        var tbody = table.querySelector('tbody');
        if (!thead || !tbody) continue;
        var ths = thead.querySelectorAll('th');
        if (!ths.length) continue;
        var rows = tbody.querySelectorAll('tr');
        for (var r = 0; r < rows.length; r++) {
            var tds = rows[r].querySelectorAll('td');
            if (!tds.length) continue;
            if (tds.length === 1 && tds.length !== ths.length) continue;
            var count = Math.min(tds.length, ths.length);
            for (var c = 0; c < count; c++) {
                var label = (ths[c].textContent || '').replace(/\s+/g, ' ').trim();
                if (label) tds[c].setAttribute('data-label', label);
            }
        }
    }
}

function observeMobileTables() {
    var timer = null;
    var observer = new MutationObserver(function() {
        if (timer) return;
        timer = setTimeout(function() {
            timer = null;
            enhanceMobileTables();
        }, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function bootApp() {
    if (typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) {
        if (typeof toast === 'function') {
            toast('لم يتم إعداد Supabase — ضع SUPABASE_URL و SUPABASE_ANON_KEY في ملف config.js', 'error');
        }
        showLoginOverlay();
        return;
    }
    if (typeof supabaseSetAuthStateHook === 'function') {
        supabaseSetAuthStateHook(function(event) {
            if (event !== 'SIGNED_OUT') return;
            clearEmployeeSession();
            appInitialized = false;
            db = null;
            window.__SUPA_DB__ = null;
            showLoginOverlay();
        });
    }
    var getBootSession = (typeof supabaseBootSession === 'function') ? supabaseBootSession : supabaseGetSession;
    getBootSession().then(function(session) {
        if (!session) {
            showLoginOverlay();
            return null;
        }
        return sbLoadAll().then(function(loadedDb) {
            window.__SUPA_DB__ = loadedDb;
            db = loadedDb;
            syncUIPrefsFromDB();
            return sbGetEmployeeSession();
        }).then(function(session2) {
            _employeeSession = session2;
            if (!checkEmployeeSession()) return null;
            initApp();
            return null;
        });
    }).catch(function(err) {
        console.error('Supabase load failed:', err);
        if (typeof toast === 'function') {
            toast('فشل الاتصال بـ Supabase: ' + (err && err.message ? err.message : 'تحقق من config.js'), 'error');
        }
        showLoginOverlay();
    });
}

function initApp() {
    if (appInitialized) {
        renderAll();
        return;
    }
    appInitialized = true;
    if (!db) db = window.__SUPA_DB__ || null;

    nextId = computeNextId();
    nextExpId = computeNextExpId();
    nextClientId = computeNextClientId();
    loadExpenseCategories();
    generateMonthlyRecurringExpenses();
    recalculateAll();
    saveDB();
    setTodayDate('incDate');
    setTodayDate('tktDate');
    setTodayDate('expDate');
    renderAll();
    renderSettingsPage();
    initReportYear();
    handlePageParam();
    setInterval(function() {
        var trashPage = document.getElementById('page-trash');
        if (trashPage && trashPage.classList.contains('active')) renderTrash();
    }, 60000);
}

function computeNextId() {
    var txs = getTransactions();
    var maxId = 0;
    for (var i = 0; i < txs.length; i++) {
        var id = safeNum(txs[i].id);
        if (id > maxId) maxId = id;
    }
    return maxId + 1;
}

function computeNextExpId() {
    var exps = getExpenses();
    var maxId = 0;
    for (var i = 0; i < exps.length; i++) {
        var id = safeNum(exps[i].id);
        if (id > maxId) maxId = id;
    }
    return maxId + 1;
}

function computeNextClientId() {
    var clients = getClients();
    var maxId = 0;
    for (var i = 0; i < clients.length; i++) {
        var id = safeNum(clients[i].id);
        if (id > maxId) maxId = id;
    }
    return maxId + 1;
}

function saveDB() {
    if (!db) return;
    if (typeof sbScheduleSync === 'function') sbScheduleSync();
}

/* ═══════════════════════════════════════
   التنقل بين الصفحات
═══════════════════════════════════════ */
function handlePageParam() {
    var params = new URLSearchParams(window.location.search);
    var page = params.get('page');
    if (!page) return;
    var valid = ['home', 'statement', 'reports', 'expenses', 'clients', 'debts', 'installments', 'activity', 'backup', 'trash', 'settings'];
    if (valid.indexOf(page) !== -1) {
        showPage(page);
        if (page === 'expenses') openExpenseDialog();
    } else if (page === 'sell') {
        openTicketDialog();
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('page-' + id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    document.querySelector('[data-page="' + id + '"]').classList.add('active');
    if (id === 'trash') renderTrash();
    if (id === 'debts') renderManualDebts();
    if (id === 'activity') renderActivityLog();
    closeSidebar();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
}


/* ═══════════════════════════════════════
   حساب الرصيد — الدقة المطلقة
═══════════════════════════════════════ */
function recalculateAll() {
    var txs = getTransactions();
    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        if (tx.type === 'ticket') {
            tx.profit = safeNum(tx.salePrice) - safeNum(tx.basePrice);
            if (tx.paymentMethod === 'debt') {
                tx.remainingAmount = Math.max(0, safeNum(tx.salePrice) - safeNum(tx.amountPaid));
            }
        }
    }

    var running = 0;
    var sorted = getSortedTransactions();
    for (var i = 0; i < sorted.length; i++) {
        var tx = sorted[i];
        if (tx.type === 'increase') {
            running += safeNum(tx.amount);
        } else {
            if (tx.paymentMethod === 'debt') {
                running -= safeNum(tx.amountPaid);
            } else {
                running -= safeNum(tx.basePrice);
            }
        }
        tx.balance = running;
    }
}

function refreshApplicationState() {
    recalculateAll();
    saveDB();
    renderAll();
}

/* ═══════════════════════════════════════
   إعدادات الواجهة (المظهر / الخط / الكثافة / التخطيط)
   - تُحفظ محلياً (localStorage) لتطبيق فوري قبل الرسم
   - وتُرتبط بالحساب عبر db.settings + app_settings (سحابياً)
   ═══════════════════════════════════════ */
var UI_PREFS_KEY = 'barakat_ui_prefs';
var UI_PREFS_DEFAULTS = { theme: 'light', font: 'md', density: 'default', layout: 'wide' };
var UI_PREFS_VALUES = {
    theme: ['light', 'dark', 'system'],
    font: ['sm', 'md', 'lg', 'xl'],
    density: ['comfortable', 'default', 'compact'],
    layout: ['wide', 'centered']
};

function getUIPrefs() {
    var prefs = {};
    for (var k in UI_PREFS_DEFAULTS) prefs[k] = UI_PREFS_DEFAULTS[k];
    try {
        var raw = localStorage.getItem(UI_PREFS_KEY);
        if (raw) {
            var p = JSON.parse(raw) || {};
            for (var k2 in UI_PREFS_DEFAULTS) {
                if (p[k2] !== undefined && p[k2] !== null) prefs[k2] = p[k2];
            }
        }
    } catch (e) { /* تجاهل */ }
    return validateUIPrefs(prefs);
}

function validateUIPrefs(prefs) {
    var out = {};
    for (var k in UI_PREFS_DEFAULTS) {
        var v = prefs[k];
        out[k] = (UI_PREFS_VALUES[k] && UI_PREFS_VALUES[k].indexOf(v) !== -1) ? v : UI_PREFS_DEFAULTS[k];
    }
    return out;
}

function saveUIPrefsLocal(prefs) {
    try {
        localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) { /* تجاهل */ }
}

function applyUIPrefs(prefs) {
    prefs = validateUIPrefs(prefs);
    var de = document.documentElement;
    de.setAttribute('data-font', prefs.font);
    de.setAttribute('data-density', prefs.density);
    de.setAttribute('data-layout', prefs.layout);
    var resolved = prefs.theme === 'system'
        ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : prefs.theme;
    de.setAttribute('data-theme', resolved);
    syncSystemThemeListener(prefs.theme);
    renderSettingsPage();
}

function syncSystemThemeListener(theme) {
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (theme === 'system') {
        if (!syncSystemThemeListener._bound) {
            syncSystemThemeListener._bound = function() {
                var cur = getUIPrefs();
                if (cur.theme === 'system') {
                    document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
                }
            };
            mq.addEventListener ? mq.addEventListener('change', syncSystemThemeListener._bound) : mq.addListener(syncSystemThemeListener._bound);
        }
    }
}

function setUIPref(key, value) {
    var prefs = getUIPrefs();
    if (!(key in UI_PREFS_DEFAULTS)) return;
    prefs[key] = value;
    prefs = validateUIPrefs(prefs);
    saveUIPrefsLocal(prefs);
    applyUIPrefs(prefs);
    if (db) {
        if (!db.settings) db.settings = {};
        db.settings['ui_' + (key === 'theme' ? 'theme' : key === 'font' ? 'font_size' : key === 'density' ? 'density' : 'layout')] = value;
        saveDB();
    }
    toast('تم تحديث الإعدادات', 'success');
}

function syncUIPrefsFromDB() {
    if (!db || !db.settings) return;
    var map = {
        theme: db.settings.ui_theme,
        font: db.settings.ui_font_size,
        density: db.settings.ui_density,
        layout: db.settings.ui_layout
    };
    var prefs = getUIPrefs();
    var changed = false;
    for (var k in map) {
        if (map[k] && UI_PREFS_VALUES[k] && UI_PREFS_VALUES[k].indexOf(map[k]) !== -1 && prefs[k] !== map[k]) {
            prefs[k] = map[k];
            changed = true;
        }
    }
    if (changed) {
        saveUIPrefsLocal(prefs);
        applyUIPrefs(prefs);
    }
}

function renderSettingsPage() {
    var prefs = getUIPrefs();
    var controls = document.querySelectorAll('.seg-control[data-pref]');
    for (var i = 0; i < controls.length; i++) {
        var key = controls[i].getAttribute('data-pref');
        var options = controls[i].querySelectorAll('.seg-option');
        for (var j = 0; j < options.length; j++) {
            var active = options[j].getAttribute('data-val') === prefs[key];
            options[j].classList.toggle('active', active);
        }
    }
}

function resetUIPrefs() {
    var prefs = {};
    for (var k in UI_PREFS_DEFAULTS) prefs[k] = UI_PREFS_DEFAULTS[k];
    saveUIPrefsLocal(prefs);
    applyUIPrefs(prefs);
    if (db) {
        if (!db.settings) db.settings = {};
        db.settings.ui_theme = 'light';
        db.settings.ui_font_size = 'md';
        db.settings.ui_density = 'default';
        db.settings.ui_layout = 'wide';
        saveDB();
    }
    toast('تم استعادة الإعدادات الافتراضية', 'success');
}

function getSortedTransactions() {
    var txs = getTransactions();
    return txs.slice().sort(function(a, b) {
        var da = String(a.date || '');
        var db2 = String(b.date || '');
        if (da !== db2) return da.localeCompare(db2);
        return safeNum(a.id) - safeNum(b.id);
    });
}

/* ترتيب عرض كشف الحساب: الأحدث أولاً (يُنزل بعد العملية المضافة) */
function getSortedTransactionsDesc() {
    return getSortedTransactions().reverse();
}


function calcProfit(basePrice, salePrice) {
    return safeNum(salePrice) - safeNum(basePrice);
}

function getTotals() {
    var increase = 0, ticketCost = 0, sales = 0, profit = 0;
    var totalDebt = 0, debtCount = 0;
    var ticketCount = 0, increaseCount = 0;
    var txs = getTransactions();

    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        if (tx.type === 'increase') {
            increase += safeNum(tx.amount);
            increaseCount++;
        } else if (tx.type === 'ticket') {
            ticketCost += safeNum(tx.basePrice);
            sales += safeNum(tx.salePrice);
            profit += safeNum(tx.profit);
            ticketCount++;
            if (tx.paymentMethod === 'debt' && tx.remainingAmount > 0) {
                totalDebt += safeNum(tx.remainingAmount);
                debtCount++;
            }
        }
    }

    var balance = 0;
    var sorted = getSortedTransactions();
    if (sorted.length > 0) {
        balance = safeNum(sorted[sorted.length - 1].balance);
    }

    return {
        balance: safeNum(balance),
        increase: safeNum(increase),
        ticketCost: safeNum(ticketCost),
        sales: safeNum(sales),
        profit: safeNum(profit),
        ticketCount: ticketCount,
        increaseCount: increaseCount,
        totalDebt: safeNum(totalDebt),
        debtCount: debtCount
    };
}

/* ═══════════════════════════════════════
   تعزيز
═══════════════════════════════════════ */
function openIncreaseDialog() {
    setTodayDate('incDate');
    document.getElementById('incAmount').value = '';
    document.getElementById('incNotes').value = '';
    showModal('increaseModal');
}

function saveIncrease(e) {
    e.preventDefault();
    var date = document.getElementById('incDate').value;
    var amount = safeNum(document.getElementById('incAmount').value);
    var notes = document.getElementById('incNotes').value.trim();

    if (!date || amount <= 0) {
        toast('يرجى إدخال بيانات صحيحة', 'error');
        return;
    }

    var txs = getTransactions();
    txs.push({
        id: nextId++,
        type: 'increase',
        date: String(date),
        amount: amount,
        notes: String(notes),
        basePrice: 0,
        salePrice: 0,
        profit: 0,
        balance: 0,
        customer: '',
        airline: ''
    });
    setTransactions(txs);

    refreshApplicationState();
    closeAllModals();
    logActivity('تعزيز رصيد', 'مبلغ: ' + fmt(amount) + ' د.ع');
    toast('تم التعزيز بنجاح — +' + fmt(amount) + ' د.ع', 'success');
}


/* ═══════════════════════════════════════
   بيع تذكرة
═══════════════════════════════════════ */
function toggleDebtFields() {
    var method = document.getElementById('tktPaymentMethod').value;
    var box = document.getElementById('tktDebtFields');
    if (box) box.style.display = method === 'debt' ? '' : 'none';
    if (method === 'cash') {
        var saleVal = safeNum(document.getElementById('tktSale').value);
        document.getElementById('tktAmountPaid').value = '';
        document.getElementById('tktRemaining').value = '';
    } else {
        calcDebtRemaining();
    }
}

function calcDebtRemaining() {
    var sale = safeNum(document.getElementById('tktSale').value);
    var paid = safeNum(document.getElementById('tktAmountPaid').value);
    var remaining = Math.max(0, sale - paid);
    document.getElementById('tktRemaining').value = remaining;
}

function openTicketDialog() {
    setTodayDate('tktDate');
    document.getElementById('tktCustomer').value = '';
    document.getElementById('tktAirline').value = '';
    document.getElementById('tktBase').value = '';
    document.getElementById('tktSale').value = '';
    document.getElementById('tktNotes').value = '';
    document.getElementById('tktPaymentMethod').value = 'cash';
    var debtBox = document.getElementById('tktDebtFields');
    if (debtBox) debtBox.style.display = 'none';
    var amtPaid = document.getElementById('tktAmountPaid');
    if (amtPaid) amtPaid.value = '';
    var rem = document.getElementById('tktRemaining');
    if (rem) rem.value = '';
    document.getElementById('liveCalcBox').classList.remove('show');
    populateCustomerSelect();
    showModal('ticketModal');
}

function populateCustomerSelect() {
    var sel = document.getElementById('tktClientSelect');
    if (!sel) return;
    var clients = getClients();
    var html = '<option value="">— بدون عميل —</option>';
    for (var i = 0; i < clients.length; i++) {
        var cl = clients[i];
        var label = cl.name || '';
        if (cl.phone) label += ' — ' + cl.phone;
        html += '<option value="' + cl.id + '">' + label + '</option>';
    }
    sel.innerHTML = html;
}

function onTicketClientChange() {
    var sel = document.getElementById('tktClientSelect');
    var nameField = document.getElementById('tktCustomer');
    if (!sel || !nameField) return;
    var clientId = safeNum(sel.value);
    if (clientId > 0) {
        var clients = getClients();
        for (var i = 0; i < clients.length; i++) {
            if (safeNum(clients[i].id) === clientId) {
                nameField.value = clients[i].name || '';
                break;
            }
        }
    } else {
        nameField.value = '';
    }
}

function openNewCustomerFromTicket() {
    ticketContext = true;
    openClientDialog();
}

function liveCalc() {
    var base = safeNum(document.getElementById('tktBase').value);
    var sale = safeNum(document.getElementById('tktSale').value);
    var box = document.getElementById('liveCalcBox');
    var val = document.getElementById('liveProfit');

    if (base > 0 || sale > 0) {
        var profit = calcProfit(base, sale);
        val.textContent = fmt(profit) + ' د.ع';
        val.className = 'lc-value' + (profit < 0 ? ' negative' : '');
        box.classList.add('show');
    } else {
        box.classList.remove('show');
    }
}

function saveTicket(e) {
    e.preventDefault();
    var date = document.getElementById('tktDate').value;
    var customer = document.getElementById('tktCustomer').value.trim();
    var airline = document.getElementById('tktAirline').value.trim();
    var basePrice = safeNum(document.getElementById('tktBase').value);
    var salePrice = safeNum(document.getElementById('tktSale').value);
    var notes = document.getElementById('tktNotes').value.trim();
    var clientId = safeNum(document.getElementById('tktClientSelect').value);
    var paymentMethod = document.getElementById('tktPaymentMethod').value;
    var amountPaid = paymentMethod === 'debt' ? safeNum(document.getElementById('tktAmountPaid').value) : salePrice;
    var remainingAmount = paymentMethod === 'debt' ? salePrice - amountPaid : 0;

    if (!date || basePrice <= 0) {
        toast('يرجى إدخال السعر الأساسي والتاريخ', 'error');
        return;
    }
    if (paymentMethod === 'debt' && (amountPaid < 0 || amountPaid > salePrice)) {
        toast('المبلغ المدفوع يجب أن يكون بين 0 و سعر البيع', 'error');
        return;
    }

    var profit = calcProfit(basePrice, salePrice);
    var txs = getTransactions();

    txs.push({
        id: nextId++,
        type: 'ticket',
        serviceType: 'ticket',
        date: String(date),
        customer: String(customer),
        airline: String(airline),
        basePrice: basePrice,
        salePrice: salePrice,
        profit: profit,
        notes: String(notes),
        amount: 0,
        balance: 0,
        clientId: clientId,
        paymentMethod: paymentMethod,
        amountPaid: amountPaid,
        remainingAmount: remainingAmount,
        debtPayments: [],
        bookingRef: '',
        pnr: ''
    });
    setTransactions(txs);

    refreshApplicationState();
    closeAllModals();
    logActivity('بيع تذكرة', (customer || 'بدون اسم') + ' — تكلفة: ' + fmt(basePrice) + ' د.ع');
    if (paymentMethod === 'debt' && remainingAmount > 0) {
        toast('تم حفظ البيع (دين) — المتبقي: ' + fmt(remainingAmount) + ' د.ع', 'success');
    } else if (salePrice <= 0) {
        toast('تم حفظ البيع — بانتظار إدخال سعر البيع', 'success');
    } else {
        toast('تم حفظ البيع — الربح: ' + fmt(profit) + ' د.ع', 'success');
    }
}

/* ═══════════════════════════════════════
   قائمة «قطع» + خدمات (فيزا / فندق / eSIM)
═══════════════════════════════════════ */
var SERVICE_TYPES = {
    ticket: { label: 'قطع تذكرة طيران', badge: 'تذكرة', icon: 'plane',      color: 'blue',   btn: 'blue',   providerLabel: 'شركة الطيران', providerPh: 'اختياري' },
    visa:   { label: 'إصدار فيزا',      badge: 'فيزا',  icon: 'stamp',      color: 'green',  btn: 'green',  providerLabel: 'السفارة / الجهة', providerPh: 'اختياري' },
    hotel:  { label: 'حجز فندق',        badge: 'فندق',  icon: 'hotel',      color: 'orange', btn: 'amber',  providerLabel: 'الفندق', providerPh: 'اختياري' },
    esim:   { label: 'شراء شريحة eSIM', badge: 'eSIM',  icon: 'smartphone', color: 'purple', btn: 'purple', providerLabel: 'مزود الخدمة', providerPh: 'اختياري' }
};

function getServiceInfo(tx) {
    return SERVICE_TYPES[tx && tx.serviceType] || SERVICE_TYPES.ticket;
}

function toggleCutDropdown(e) {
    if (e) e.stopPropagation();
    document.getElementById('cutDropdown').classList.toggle('open');
}

function closeCutDropdown() {
    var d = document.getElementById('cutDropdown');
    if (d) d.classList.remove('open');
}

document.addEventListener('click', function(e) {
    var d = document.getElementById('cutDropdown');
    if (d && !d.contains(e.target)) d.classList.remove('open');
});

function openService(type) {
    closeCutDropdown();
    if (type === 'ticket') { openTicketDialog(); return; }
    openCutServiceDialog(type);
}

function openCutServiceDialog(type) {
    var cfg = SERVICE_TYPES[type] || SERVICE_TYPES.visa;
    document.getElementById('svcType').value = type || 'visa';
    document.getElementById('svcBase').value = '';
    document.getElementById('svcSale').value = '';
    document.getElementById('svcNotes').value = '';
    var h = document.getElementById('svcHeader');
    h.className = 'modal-header modal-header-' + cfg.color;
    document.getElementById('svcTitle').innerHTML =
        '<i data-lucide="' + cfg.icon + '" style="width:18px;height:18px;vertical-align:middle"></i> ' + cfg.label;
    var btn = document.getElementById('svcSaveBtn');
    btn.className = 'btn btn-' + cfg.btn;
    btn.textContent = 'حفظ';
    showModal('serviceModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function saveService(e) {
    e.preventDefault();
    var type = document.getElementById('svcType').value || 'visa';
    var cfg = SERVICE_TYPES[type] || SERVICE_TYPES.visa;
    var date = todayStr();
    var basePrice = safeNum(document.getElementById('svcBase').value);
    var salePrice = safeNum(document.getElementById('svcSale').value);
    var notes = document.getElementById('svcNotes').value.trim();

    if (basePrice <= 0) {
        toast('يرجى إدخال السعر الأساسي', 'error');
        return;
    }

    var profit = calcProfit(basePrice, salePrice);
    var txs = getTransactions();
    txs.push({
        id: nextId++,
        type: 'ticket',
        serviceType: type,
        date: String(date),
        customer: '',
        airline: '',
        basePrice: basePrice,
        salePrice: salePrice,
        profit: profit,
        notes: String(notes),
        amount: 0,
        balance: 0,
        clientId: 0,
        paymentMethod: 'cash',
        amountPaid: salePrice,
        remainingAmount: 0,
        debtPayments: [],
        bookingRef: '',
        pnr: ''
    });
    setTransactions(txs);

    refreshApplicationState();
    closeAllModals();
    logActivity(cfg.label, 'بدون اسم — تكلفة: ' + fmt(basePrice) + ' د.ع');
    if (salePrice <= 0) {
        toast('تم حفظ ' + cfg.label + ' — بانتظار إدخال سعر البيع', 'success');
    } else {
        toast('تم حفظ ' + cfg.label + ' — الربح: ' + fmt(profit) + ' د.ع', 'success');
    }
}

/* ═══════════════════════════════════════
   التعديل
═══════════════════════════════════════ */
function openEdit(id) {
    var txs = getTransactions();
    var tx = null;
    for (var i = 0; i < txs.length; i++) {
        if (safeNum(txs[i].id) === safeNum(id)) { tx = txs[i]; break; }
    }
    if (!tx) return;

    var title = document.getElementById('editTitle');
    var fields = document.getElementById('editFields');

    if (tx.type === 'increase') {
        title.textContent = 'تعديل تعزيز';
        fields.innerHTML =
            '<input type="hidden" id="editId" value="' + tx.id + '">' +
            '<div class="field-group"><label>التاريخ</label>' +
            '<input type="date" class="field" id="editDate" value="' + tx.date + '" required></div>' +
            '<div class="field-group"><label>المبلغ (دينار عراقي)</label>' +
            '<input type="number" class="field" id="editAmount" value="' + safeNum(tx.amount) + '" min="1" step="1" required></div>' +
            '<div class="field-group"><label>الملاحظات</label>' +
            '<input type="text" class="field" id="editNotes" value="' + (tx.notes || '') + '"></div>';
    } else {
        var srv = getServiceInfo(tx);
        title.textContent = 'تعديل ' + srv.label;
        fields.innerHTML =
            '<input type="hidden" id="editId" value="' + tx.id + '">' +
            '<div class="field-row">' +
            '<div class="field-group"><label>التاريخ</label>' +
            '<input type="date" class="field" id="editDate" value="' + tx.date + '" required></div>' +
            '<div class="field-group"><label>اسم العميل</label>' +
            '<input type="text" class="field" id="editCustomer" value="' + (tx.customer || '') + '"></div>' +
            '</div>' +
            '<div class="field-group"><label>' + srv.providerLabel + '</label>' +
            '<input type="text" class="field" id="editAirline" value="' + (tx.airline || '') + '"></div>' +
            '<div class="field-row">' +
            '<div class="field-group"><label>السعر الأساسي</label>' +
            '<input type="number" class="field" id="editBase" value="' + safeNum(tx.basePrice) + '" min="1" step="1" required></div>' +
            '<div class="field-group"><label>سعر البيع</label>' +
            '<input type="number" class="field" id="editSale" value="' + safeNum(tx.salePrice) + '" min="0" step="1"></div>' +
            '</div>' +
            '<div class="field-group"><label>الملاحظات</label>' +
            '<input type="text" class="field" id="editNotes" value="' + (tx.notes || '') + '"></div>';
    }
    showModal('editModal');
}

function submitEdit(e) {
    e.preventDefault();
    var id = safeNum(document.getElementById('editId').value);
    var txs = getTransactions();
    var tx = null;
    for (var i = 0; i < txs.length; i++) {
        if (safeNum(txs[i].id) === id) { tx = txs[i]; break; }
    }
    if (!tx) return;

    tx.date = String(document.getElementById('editDate').value);
    tx.notes = String(document.getElementById('editNotes').value.trim());

    if (tx.type === 'increase') {
        var amount = safeNum(document.getElementById('editAmount').value);
        if (amount <= 0) { toast('المبلغ غير صحيح', 'error'); return; }
        tx.amount = amount;
    } else {
        var custEl = document.getElementById('editCustomer');
        var airEl = document.getElementById('editAirline');
        tx.customer = custEl ? String(custEl.value).trim() : '';
        tx.airline = airEl ? String(airEl.value).trim() : '';
        var base = safeNum(document.getElementById('editBase').value);
        var sale = safeNum(document.getElementById('editSale').value);
        if (base <= 0) { toast('السعر الأساسي غير صحيح', 'error'); return; }
        tx.basePrice = base;
        tx.salePrice = sale;
        tx.profit = calcProfit(base, sale);
        if (tx.paymentMethod === 'debt') {
            tx.amountPaid = Math.min(safeNum(tx.amountPaid), sale);
            tx.remainingAmount = Math.max(0, sale - tx.amountPaid);
        }
    }

    recalculateAll();
    var newBalance = getTotals().balance;
    if (newBalance < 0) {
        toast('تحذير: الرصيد أصبح سالباً', 'warning');
    }

    logActivity('تعديل تذكرة', 'رقم #' + id);
    refreshApplicationState();
    closeAllModals();
    toast('تم التعديل بنجاح', 'success');
}


/* ═══════════════════════════════════════
   الحذف
═══════════════════════════════════════ */
function confirmDelete(id) {
    showConfirm('سيتم نقل هذا السجل إلى سلة المحذوفات ويمكن استرجاعه خلال 24 ساعة.', function(ok) {
        if (!ok) return;
        var txs = getTransactions();
        var item = null;
        for (var i = 0; i < txs.length; i++) {
            if (safeNum(txs[i].id) === safeNum(id)) { item = txs[i]; break; }
        }
        if (!item) return;
        var displayName = (item.type === 'ticket')
            ? (item.customer || 'تذكرة #' + item.id)
            : ' تعزيز #' + item.id;
        moveToTrash('transaction', JSON.parse(JSON.stringify(item)), displayName);
        setTransactions(txs.filter(function(t) { return safeNum(t.id) !== safeNum(id); }));
        logActivity('حذف تذكرة', displayName);
        refreshApplicationState();
        toast('تم النقل إلى سلة المحذوفات', 'success');
    });
}

/* ═══════════════════════════════════════
   عرض البيانات
═══════════════════════════════════════ */
function renderAll() {
    renderDashboard();
    renderTable();
    renderRecent();
    renderExpenses();
    renderClients();
    renderManualDebts();
    renderInstallments();
    renderTrash();
    renderActivityLog();
    generateDebtReport();
    if (currentClientId) renderClientDetail();
}

function renderDashboard() {
    var t = getTotals();
    var expTotals = getExpenseTotals();
    var mdStats = getManualDebtStats();
    var clients = getClients();
    var activeClients = 0;
    var debtorClients = t.debtCount;
    for (var i = 0; i < clients.length; i++) {
        var cl = clients[i];
        var st = getClientStats(cl);
        if (st.svcCount > 0) activeClients++;
        var ds = getClientDebtStats(cl);
        if (ds.totalRemaining > 0) debtorClients++;
    }
    document.getElementById('dashBalance').textContent = fmt(t.balance);
    document.getElementById('dashIncrease').textContent = fmt(t.increase);
    document.getElementById('dashTicketCost').textContent = fmt(t.ticketCost);
    document.getElementById('dashSales').textContent = fmt(t.sales);
    document.getElementById('dashProfit').textContent = fmt(t.profit);
    document.getElementById('dashTickets').textContent = t.ticketCount;
    document.getElementById('dashIncreases').textContent = t.increaseCount;
    document.getElementById('dashTotalExpenses').textContent = fmt(expTotals.totalPaid) + ' د.ع';
    document.getElementById('dashTotalDebt').textContent = fmt(t.totalDebt + mdStats.totalRemaining) + ' د.ع';
    document.getElementById('dashDebtClients').textContent = debtorClients;
    document.getElementById('dashClientCount').textContent = activeClients;
}

function renderTable() {
    var body = document.getElementById('tableBody');
    var empty = document.getElementById('emptyMsg');
    var sorted = getSortedTransactionsDesc();

    if (sorted.length === 0) {
        body.innerHTML = '';
        empty.style.display = '';
        return;
    }

    empty.style.display = 'none';
    var html = '';

    for (var i = 0; i < sorted.length; i++) {
        var tx = sorted[i];
        var isTicket = tx.type === 'ticket';
        var badge = isTicket
            ? '<span class="badge badge-' + getServiceInfo(tx).color + '">' + getServiceInfo(tx).badge + '</span>'
            : '<span class="badge badge-green">تعزيز</span>';
        var profitNum = safeNum(tx.profit);
        var profitClass = isTicket ? (profitNum >= 0 ? 'text-green' : 'text-red') : '';
        var profitText = isTicket ? fmt(profitNum) : '—';
        var baseText = isTicket ? fmt(safeNum(tx.basePrice)) : '—';
        var saleText = isTicket ? fmt(safeNum(tx.salePrice)) : '—';
        var custText = isTicket && tx.customer ? tx.customer : '—';
        var airText = isTicket && tx.airline ? tx.airline : '—';

        html += '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + (tx.date || '—') + '</td>' +
            '<td>' + badge + '</td>' +
            '<td>' + custText + '</td>' +
            '<td>' + airText + '</td>' +
            '<td class="num">' + baseText + '</td>' +
            '<td class="num">' + saleText + '</td>' +
            '<td class="num ' + profitClass + '">' + profitText + '</td>' +
            '<td class="num text-brand">' + fmt(safeNum(tx.balance)) + '</td>' +
            '<td>' + (tx.notes || '—') + '</td>' +
            '<td class="actions-cell">' +
            '<button class="btn-icon btn-edit" onclick="openEdit(' + tx.id + ')" title="تعديل"><i data-lucide="pencil"></i></button>' +
            '<button class="btn-icon btn-del" onclick="confirmDelete(' + tx.id + ')" title="حذف"><i data-lucide="trash-2"></i></button>' +
            '</td></tr>';
    }
    body.innerHTML = html;
}

function renderRecent() {
    var panel = document.getElementById('recentPanel');
    var list = document.getElementById('recentList');
    var sorted = getSortedTransactions().slice(-5).reverse();

    if (sorted.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = '';

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
        var tx = sorted[i];
        var isTicket = tx.type === 'ticket';
        var srv = getServiceInfo(tx);
        var icon = isTicket ? '<i data-lucide="' + srv.icon + '"></i>' : '<i data-lucide="trending-up"></i>';
        var cls = isTicket ? srv.color : 'green';
        var type = isTicket ? srv.label : 'تعزيز';
        var amt, amtClass;

        if (isTicket) {
            var p = safeNum(tx.profit);
            amt = (p >= 0 ? '+' : '') + fmt(p);
            amtClass = p >= 0 ? 'green' : 'red';
        } else {
            amt = '+' + fmt(safeNum(tx.amount));
            amtClass = 'green';
        }

        html += '<div class="recent-item">' +
            '<div class="recent-info">' +
            '<div class="recent-icon ' + cls + '">' + icon + '</div>' +
            '<div><div class="recent-type">' + type + '</div>' +
            '<div class="recent-date">' + (tx.date || '') + (tx.customer ? ' — ' + tx.customer : '') + '</div></div>' +
            '</div>' +
            '<div class="recent-amount ' + amtClass + '">' + amt + ' د.ع</div></div>';
    }
    list.innerHTML = html;
}


/* ═══════════════════════════════════════
   تصفية جدول كشف الحساب
═══════════════════════════════════════ */
function filterTable() {
    var text = document.getElementById('searchText').value.toLowerCase();
    var type = document.getElementById('filterType').value;
    var rows = document.querySelectorAll('#tableBody tr');
    var sorted = getSortedTransactionsDesc();

    rows.forEach(function(row, i) {
        var tx = sorted[i];
        if (!tx) return;
        var show = true;
        if (type !== 'all') {
            if (type === 'تعزيز' && tx.type !== 'increase') show = false;
            if (type === 'بيع' && tx.type !== 'ticket') show = false;
        }
        if (text) {
            var haystack = String((tx.notes || '') + ' ' + (tx.customer || '') + ' ' + (tx.airline || '')).toLowerCase();
            if (haystack.indexOf(text) === -1) show = false;
        }
        row.style.display = show ? '' : 'none';
    });
}

/* ═══════════════════════════════════════
   التقارير
═══════════════════════════════════════ */
var currentReportMode = 'monthly';

function switchReportMode(mode) {
    currentReportMode = mode;
    document.querySelectorAll('#reportTabs .tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-mode="' + mode + '"]').classList.add('active');
    var monthSel = document.getElementById('reportMonth');
    var dateInp = document.getElementById('reportDate');
    monthSel.style.display = mode === 'monthly' ? '' : 'none';
    dateInp.style.display = mode === 'daily' ? '' : 'none';
    generateReport();
}

function initReportYear() {
    var sel = document.getElementById('reportYear');
    var now = new Date();
    sel.innerHTML = '';
    for (var y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
        sel.innerHTML += '<option value="' + y + '">' + y + '</option>';
    }
    var monthSel = document.getElementById('reportMonth');
    var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    monthSel.innerHTML = months.map(function(m, i) {
        return '<option value="' + String(i + 1).padStart(2, '0') + '">' + m + '</option>';
    }).join('');
    var dateInp = document.getElementById('reportDate');
    dateInp.value = now.toISOString().split('T')[0];
    monthSel.style.display = '';
    dateInp.style.display = 'none';
    generateReport();
}

function generateReport() {
    var year = safeNum(document.getElementById('reportYear').value);
    var month = document.getElementById('reportMonth').value;
    var date = document.getElementById('reportDate').value;
    var filtered;
    var filteredExpenses;

    if (currentReportMode === 'monthly') {
        var prefix = year + '-' + month;
        var recKey = year + '-' + month;
        filtered = getTransactions().filter(function(tx) { return String(tx.date || '').indexOf(prefix) === 0; });
        filteredExpenses = getExpenses().filter(function(ex) {
            if (ex.isRecurring) {
                for (var r = 0; r < ex.monthlyRecords.length; r++) {
                    if (ex.monthlyRecords[r].month === recKey) return true;
                }
                return false;
            }
            return String(ex.date || '').indexOf(prefix) === 0;
        });
    } else if (currentReportMode === 'daily') {
        filtered = getTransactions().filter(function(tx) { return String(tx.date || '') === date; });
        filteredExpenses = getExpenses().filter(function(ex) {
            if (ex.isRecurring) return false;
            return String(ex.date || '') === date;
        });
    } else {
        filtered = getTransactions().filter(function(tx) { return String(tx.date || '').indexOf(String(year)) === 0; });
        filteredExpenses = getExpenses().filter(function(ex) {
            if (ex.isRecurring) {
                for (var r = 0; r < ex.monthlyRecords.length; r++) {
                    if (ex.monthlyRecords[r].month && ex.monthlyRecords[r].month.indexOf(String(year)) === 0) return true;
                }
                return false;
            }
            return String(ex.date || '').indexOf(String(year)) === 0;
        });
    }

    var increase = 0, ticketCost = 0, sales = 0, profit = 0, count = 0;
    for (var i = 0; i < filtered.length; i++) {
        var tx = filtered[i];
        if (tx.type === 'increase') {
            increase += safeNum(tx.amount);
        } else if (tx.type === 'ticket') {
            ticketCost += safeNum(tx.basePrice);
            sales += safeNum(tx.salePrice);
            profit += safeNum(tx.profit);
            count++;
        }
    }

    var periodExpenses = 0;
    var periodExpensesUnpaid = 0;
    for (var j = 0; j < filteredExpenses.length; j++) {
        var fex = filteredExpenses[j];
        var fexPaid = true;
        if (fex.isRecurring) {
            fexPaid = false;
            if (currentReportMode === 'monthly') {
                var recKey = year + '-' + month;
                for (var r = 0; r < fex.monthlyRecords.length; r++) {
                    if (fex.monthlyRecords[r].month === recKey && fex.monthlyRecords[r].status === 'paid') {
                        fexPaid = true; break;
                    }
                }
            } else {
                for (var r2 = 0; r2 < fex.monthlyRecords.length; r2++) {
                    if (fex.monthlyRecords[r2].status === 'paid') { fexPaid = true; break; }
                }
            }
        } else {
            fexPaid = (fex.paymentStatus || 'paid') === 'paid';
        }
        if (fexPaid) periodExpenses += safeNum(fex.amount);
        else periodExpensesUnpaid += safeNum(fex.amount);
    }

    var netProfit = profit - periodExpenses;
    var netClass = netProfit >= 0 ? 'kpi-emerald' : 'kpi-red';
    var netIcon = netProfit >= 0 ? '<i data-lucide="circle-check-big"></i>' : '<i data-lucide="x"></i>';
    var netLabel = netProfit >= 0 ? 'الشركة رابحة' : 'الشركة خاسرة';
    var currentBalance = getTotals().balance;

    document.getElementById('reportKpis').innerHTML =
        '<div class="kpi kpi-green"><div class="kpi-icon"><i data-lucide="trending-up"></i></div><div class="kpi-body"><span class="kpi-label">إجمالي التعزيز</span><span class="kpi-value">' + fmt(increase) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-red"><div class="kpi-icon"><i data-lucide="trending-down"></i></div><div class="kpi-body"><span class="kpi-label">تكلفة التذاكر</span><span class="kpi-value">' + fmt(ticketCost) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-blue"><div class="kpi-icon"><i data-lucide="banknote"></i></div><div class="kpi-body"><span class="kpi-label">إجمالي المبيعات</span><span class="kpi-value">' + fmt(sales) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-emerald"><div class="kpi-icon"><i data-lucide="trending-up"></i></div><div class="kpi-body"><span class="kpi-label">إجمالي الأرباح</span><span class="kpi-value">' + fmt(profit) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-orange"><div class="kpi-icon"><i data-lucide="wallet"></i></div><div class="kpi-body"><span class="kpi-label">المصاريف</span><span class="kpi-value">' + fmt(periodExpenses) + ' د.ع</span></div></div>' +
        '<div class="kpi ' + netClass + '"><div class="kpi-icon">' + netIcon + '</div><div class="kpi-body"><span class="kpi-label">صافي الربح</span><span class="kpi-value">' + fmt(netProfit) + ' د.ع — ' + netLabel + '</span></div></div>' +
        '<div class="kpi kpi-purple"><div class="kpi-icon"><i data-lucide="plane"></i></div><div class="kpi-body"><span class="kpi-label">عدد التذاكر</span><span class="kpi-value">' + count + '</span></div></div>' +
        '<div class="kpi kpi-purple"><div class="kpi-icon"><i data-lucide="wallet-cards"></i></div><div class="kpi-body"><span class="kpi-label">الرصيد الحالي</span><span class="kpi-value">' + fmt(currentBalance) + ' د.ع</span></div></div>';

    var tbody = document.getElementById('reportBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">لا توجد بيانات</td></tr>';
    } else {
        var html = '';
        for (var j = 0; j < filtered.length; j++) {
            var t = filtered[j];
            var isT = t.type === 'ticket';
            var b = isT ? '<span class="badge badge-' + getServiceInfo(t).color + '">' + getServiceInfo(t).badge + '</span>' : '<span class="badge badge-green">تعزيز</span>';
            var pc = isT ? (safeNum(t.profit) >= 0 ? 'text-green' : 'text-red') : '';
            html += '<tr><td>' + (t.date || '') + '</td><td>' + b + '</td><td>' + (t.customer || '—') + '</td>' +
                '<td class="num">' + (isT ? fmt(safeNum(t.basePrice)) : '—') + '</td>' +
                '<td class="num">' + (isT ? fmt(safeNum(t.salePrice)) : '—') + '</td>' +
                '<td class="num ' + pc + '">' + (isT ? fmt(safeNum(t.profit)) : '—') + '</td>' +
                '<td>' + (t.notes || '—') + '</td></tr>';
        }
        tbody.innerHTML = html;
    }
    drawChart(filtered);
}


/* ═══════════════════════════════════════
   الرسم البياني — Canvas API
═══════════════════════════════════════ */
function drawChart(data) {
    var canvas = document.getElementById('profitChart');
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = (rect.width - 44) * dpr;
    canvas.height = 260 * dpr;
    canvas.style.width = (rect.width - 44) + 'px';
    canvas.style.height = '260px';
    ctx.scale(dpr, dpr);
    var W = rect.width - 44;
    var H = 260;
    ctx.clearRect(0, 0, W, H);

    var dailyProfit = {};
    for (var i = 0; i < data.length; i++) {
        var tx = data[i];
        if (tx.type !== 'ticket') continue;
        var day = String(tx.date || '').slice(8, 10);
        dailyProfit[day] = (dailyProfit[day] || 0) + safeNum(tx.profit);
    }

    var days = Object.keys(dailyProfit).sort();
    var values = days.map(function(d) { return dailyProfit[d]; });

    if (days.length === 0) {
        ctx.fillStyle = '#a0aec0';
        ctx.font = '600 14px Cairo';
        ctx.textAlign = 'center';
        ctx.fillText('لا توجد بيانات كافية للرسم', W / 2, H / 2);
        return;
    }

    var maxAbs = 1;
    for (var k = 0; k < values.length; k++) {
        var av = Math.abs(values[k]);
        if (av > maxAbs) maxAbs = av;
    }
    var pad = { top: 30, right: 20, bottom: 50, left: 20 };
    var chartW = W - pad.left - pad.right;
    var chartH = H - pad.top - pad.bottom;
    var barW = Math.min(chartW / days.length * 0.65, 40);
    var gap = chartW / days.length;
    var zeroY = pad.top + chartH / 2;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(W - pad.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    for (var d = 0; d < days.length; d++) {
        var x = pad.left + gap * d + gap / 2 - barW / 2;
        var val = values[d];
        var h = (Math.abs(val) / maxAbs) * (chartH / 2);
        var y = val >= 0 ? zeroY - h : zeroY;
        var grad = ctx.createLinearGradient(x, y, x, y + h);
        if (val >= 0) {
            grad.addColorStop(0, '#22c55e');
            grad.addColorStop(1, '#16a34a');
        } else {
            grad.addColorStop(0, '#ef4444');
            grad.addColorStop(1, '#dc2626');
        }
        var r = Math.min(barW / 2, 6);
        ctx.beginPath();
        if (val >= 0) {
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + barW, y, x + barW, y + h, r);
            ctx.arcTo(x + barW, y + h, x, y + h, 0);
            ctx.arcTo(x, y + h, x, y, 0);
            ctx.arcTo(x, y, x + barW, y, r);
        } else {
            ctx.moveTo(x, y);
            ctx.arcTo(x + barW, y, x + barW, y + h, 0);
            ctx.arcTo(x + barW, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + barW, y, 0);
        }
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.font = '600 11px Cairo';
        ctx.textAlign = 'center';
        ctx.fillText(days[d], pad.left + gap * d + gap / 2, H - pad.bottom + 18);
        ctx.fillStyle = val >= 0 ? '#16a34a' : '#dc2626';
        ctx.font = '700 10px Cairo';
        ctx.fillText(fmt(val), pad.left + gap * d + gap / 2, val >= 0 ? y - 8 : y + h + 16);
    }
}

/* ═══════════════════════════════════════
   التصدير — Excel
═══════════════════════════════════════ */
function exportReportExcel() {
    var year = safeNum(document.getElementById('reportYear').value);
    var month = document.getElementById('reportMonth').value;
    var date = document.getElementById('reportDate').value;
    var filtered, filteredExpenses, fileName, periodLabel;

    if (currentReportMode === 'monthly') {
        var prefix = year + '-' + month;
        var recKey = year + '-' + month;
        filtered = getTransactions().filter(function(tx) { return String(tx.date || '').indexOf(prefix) === 0; });
        filteredExpenses = getExpenses().filter(function(ex) {
            if (ex.isRecurring) {
                for (var r = 0; r < ex.monthlyRecords.length; r++) {
                    if (ex.monthlyRecords[r].month === recKey) return true;
                }
                return false;
            }
            return String(ex.date || '').indexOf(prefix) === 0;
        });
        fileName = 'report_' + year + '_' + month + '.xlsx';
        periodLabel = 'تقرير شهري - ' + year + '/' + month;
    } else if (currentReportMode === 'daily') {
        filtered = getTransactions().filter(function(tx) { return String(tx.date || '') === date; });
        filteredExpenses = getExpenses().filter(function(ex) {
            if (ex.isRecurring) return false;
            return String(ex.date || '') === date;
        });
        fileName = 'report_' + date + '.xlsx';
        periodLabel = 'تقرير يومي - ' + date;
    } else {
        filtered = getTransactions().filter(function(tx) { return String(tx.date || '').indexOf(String(year)) === 0; });
        filteredExpenses = getExpenses().filter(function(ex) {
            if (ex.isRecurring) {
                for (var r = 0; r < ex.monthlyRecords.length; r++) {
                    if (ex.monthlyRecords[r].month && ex.monthlyRecords[r].month.indexOf(String(year)) === 0) return true;
                }
                return false;
            }
            return String(ex.date || '').indexOf(String(year)) === 0;
        });
        fileName = 'report_' + year + '.xlsx';
        periodLabel = 'تقرير سنوي - ' + year;
    }

    var headers = ['التاريخ', 'النوع', 'العميل', 'الشركة', 'السعر الأساسي', 'سعر البيع', 'الربح', 'الملاحظات'];
    var data = [];
    var incTotal = 0, costTotal = 0, saleTotal = 0, profitTotal = 0, count = 0;

    for (var i = 0; i < filtered.length; i++) {
        var tx = filtered[i];
        var isT = tx.type === 'ticket';
        var type = isT ? getServiceInfo(tx).badge : 'تعزيز';
        var base = isT ? xlFormatNum(tx.basePrice) : '—';
        var sale = isT ? xlFormatNum(tx.salePrice) : '—';
        var prof = isT ? xlFormatNum(tx.profit) : '—';
        data.push([tx.date || '—', type, tx.customer || '—', tx.airline || '—', base, sale, prof, tx.notes || '—']);
        if (isT) { costTotal += safeNum(tx.basePrice); saleTotal += safeNum(tx.salePrice); profitTotal += safeNum(tx.profit); count++; }
        else { incTotal += safeNum(tx.amount); }
    }

    var periodExpenses = 0;
    for (var j = 0; j < filteredExpenses.length; j++) {
        var fexE = filteredExpenses[j];
        if (fexE.isRecurring) {
            for (var r = 0; r < fexE.monthlyRecords.length; r++) {
                if (fexE.monthlyRecords[r].status === 'paid') { periodExpenses += safeNum(fexE.amount); break; }
            }
        } else {
            if ((fexE.paymentStatus || 'paid') === 'paid') periodExpenses += safeNum(fexE.amount);
        }
    }

    var netProfit = profitTotal - periodExpenses;
    var balance = getTotals().balance;

    var cards = [
        { label: 'إجمالي المبيعات', value: saleTotal, isCurrency: true, bgColor: 'E8F5E9', valueColor: '1A6B4E' },
        { label: 'إجمالي تكلفة التذاكر', value: costTotal, isCurrency: true, bgColor: 'FFF3E0', valueColor: 'E65100' },
        { label: 'إجمالي الأرباح', value: profitTotal, isCurrency: true, bgColor: 'E3F2FD', valueColor: '1565C0' },
        { label: 'صافي الربح', value: netProfit, isCurrency: true, bgColor: netProfit >= 0 ? 'E8F5E9' : 'FFEBEE', valueColor: netProfit >= 0 ? '1A6B4E' : 'C62828' },
        { label: 'إجمالي التعزيز', value: incTotal, isCurrency: true, bgColor: 'F3E5F5', valueColor: '6A1B9A' },
        { label: 'المصاريف', value: periodExpenses, isCurrency: true, bgColor: 'FFEBEE', valueColor: 'C62828' },
        { label: 'الرصيد الحالي', value: balance, isCurrency: true, bgColor: 'E0F2F1', valueColor: '00695C' },
        { label: 'عدد التذاكر', value: count, bgColor: 'FFFDE7', valueColor: 'F9A825' }
    ];

    var summaryItems = [
        { label: 'إجمالي التعزيز', value: xlFormatNum(incTotal), isCurrency: false },
        { label: 'إجمالي تكلفة التذاكر', value: xlFormatNum(costTotal), isCurrency: false },
        { label: 'إجمالي المبيعات', value: xlFormatNum(saleTotal), isCurrency: false },
        { label: 'إجمالي الأرباح', value: xlFormatNum(profitTotal), isCurrency: false },
        { label: 'المصاريف', value: xlFormatNum(periodExpenses), isCurrency: false },
        { label: 'صافي الربح', value: xlFormatNum(netProfit), isCurrency: false, valueColor: netProfit >= 0 ? '1A6B4E' : 'C62828' },
        { label: 'عدد التذاكر', value: count, isCurrency: false },
        { label: 'الرصيد الحالي', value: xlFormatNum(balance), isCurrency: false }
    ];

    xlExport({
        title: periodLabel,
        filename: fileName,
        sheetName: 'التقرير',
        numCols: 8,
        cards: cards,
        headers: headers,
        data: data,
        summaryItems: summaryItems,
        landscape: true,
        tableOptions: { colWidths: [14, 14, 18, 16, 16, 16, 16, 24] }
    });
}

function exportReportPrint() { window.print(); }


/* ═══════════════════════════════════════
   النسخ الاحتياطي
═══════════════════════════════════════ */

var BACKUP_FORMAT_VERSION = 1;

function exportJSON() {
    var backup = {
        backupVersion: BACKUP_FORMAT_VERSION,
        appVersion: '15.3.0',
        dbVersion: CURRENT_DATABASE_VERSION,
        exportedAt: new Date().toISOString(),
        settings: JSON.parse(JSON.stringify(db.settings || {})),
        transactions: JSON.parse(JSON.stringify(db.transactions || [])),
        expenses: JSON.parse(JSON.stringify(db.expenses || [])),
        expenseCategories: JSON.parse(JSON.stringify(db.expenseCategories || [])),
        clients: JSON.parse(JSON.stringify(db.clients || [])),
        manualDebts: JSON.parse(JSON.stringify(db.manualDebts || [])),
        installmentContracts: JSON.parse(JSON.stringify(db.installmentContracts || [])),
        deletedItems: JSON.parse(JSON.stringify(db.deletedItems || [])),
        metadata: JSON.parse(JSON.stringify(db.metadata || {}))
    };
    var data = JSON.stringify(backup, null, 2);
    var now = new Date();
    var fileName = 'Backup_' + now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') + '.json';
    downloadFile(data, fileName, 'application/json');
    toast('تم التصدير بنجاح — جميع البيانات محفوظة', 'success');
}

function validateBackupFile(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'الملف غير صالح — لا يمكن قراءته' };
    }
    if (!Array.isArray(data.transactions)) {
        return { valid: false, error: 'الملف لا يحتوي على بيانات التذاكر' };
    }
    var stats = {
        transactions: data.transactions.length,
        expenses: Array.isArray(data.expenses) ? data.expenses.length : 0,
        clients: Array.isArray(data.clients) ? data.clients.length : 0,
        manualDebts: Array.isArray(data.manualDebts) ? data.manualDebts.length : 0,
        installmentContracts: Array.isArray(data.installmentContracts) ? data.installmentContracts.length : 0,
        deletedItems: Array.isArray(data.deletedItems) ? data.deletedItems.length : 0,
        expenseCategories: Array.isArray(data.expenseCategories) ? data.expenseCategories.length : 0
    };
    return { valid: true, stats: stats, version: data.dbVersion || 0 };
}

function importJSON(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        try {
            var data = JSON.parse(ev.target.result);

            var validation = validateBackupFile(data);
            if (!validation.valid) {
                toast(validation.error, 'error');
                return;
            }

            var s = validation.stats;
            var summaryParts = [];
            summaryParts.push(s.transactions + ' تذكرة/عملية');
            summaryParts.push(s.clients + ' عميل');
            summaryParts.push(s.expenses + ' مصروف');
            summaryParts.push(s.manualDebts + ' دين يدوي');
            summaryParts.push(s.installmentContracts + ' عقد قسط');
            if (s.deletedItems > 0) summaryParts.push(s.deletedItems + ' سجل في سلة المحذوفات');
            var summary = summaryParts.join(' — ');

            showConfirm(
                'سيتم استيراد النسخة الاحتياطية:\n' + summary +
                '\n\nسيتم إنشاء نسخة احتياطية تلقائية من البيانات الحالية قبل الاستيراد.',
                function(ok) {
                    if (!ok) return;

                    var autoBackup = {
                        backupVersion: BACKUP_FORMAT_VERSION,
                        appVersion: '15.3.0',
                        dbVersion: CURRENT_DATABASE_VERSION,
                        exportedAt: new Date().toISOString(),
                        settings: JSON.parse(JSON.stringify(db.settings || {})),
                        transactions: JSON.parse(JSON.stringify(db.transactions || [])),
                        expenses: JSON.parse(JSON.stringify(db.expenses || [])),
                        expenseCategories: JSON.parse(JSON.stringify(db.expenseCategories || [])),
                        clients: JSON.parse(JSON.stringify(db.clients || [])),
                        manualDebts: JSON.parse(JSON.stringify(db.manualDebts || [])),
                        installmentContracts: JSON.parse(JSON.stringify(db.installmentContracts || [])),
                        deletedItems: JSON.parse(JSON.stringify(db.deletedItems || [])),
                        metadata: JSON.parse(JSON.stringify(db.metadata || {}))
                    };
                    try {
                        if (Array.isArray(db.backups)) {
                            db.backups.push({
                                key: 'autobackup_' + Date.now(),
                                timestamp: new Date().toISOString(),
                                fromVersion: CURRENT_DATABASE_VERSION,
                                label: 'قبل الاستيراد'
                            });
                            while (db.backups.length > 10) {
                                db.backups.splice(0, db.backups.length - 10);
                            }
                        }
                    } catch (e) { /* تجاهل */ }

                    var importedClients = Array.isArray(data.clients)
                        ? normalizeImportedClients(data.clients) : [];
                    var importedTxs = Array.isArray(data.transactions)
                        ? normalizeImportedTransactions(data.transactions) : [];
                    var importedExps = Array.isArray(data.expenses)
                        ? normalizeImportedExpenses(data.expenses) : [];
                    var importedManualDebts = Array.isArray(data.manualDebts)
                        ? data.manualDebts : [];
                    var importedInstallmentContracts = Array.isArray(data.installmentContracts)
                        ? data.installmentContracts : [];
                    var importedDeletedItems = Array.isArray(data.deletedItems)
                        ? data.deletedItems : [];
                    var importedExpCat = Array.isArray(data.expenseCategories)
                        ? data.expenseCategories : [];

                    db.settings = data.settings || { currency: 'IQD', language: 'ar' };
                    db.transactions = importedTxs;
                    db.expenses = importedExps;
                    db.expenseCategories = importedExpCat;
                    db.clients = importedClients;
                    db.manualDebts = importedManualDebts;
                    db.installmentContracts = importedInstallmentContracts;
                    db.deletedItems = importedDeletedItems;
                    db.metadata = data.metadata || db.metadata;

                    nextId = computeNextId();
                    nextExpId = computeNextExpId();
                    nextClientId = computeNextClientId();
                    loadExpenseCategories();
                    generateMonthlyRecurringExpenses();
                    refreshApplicationState();
                    toast('تم استيراد جميع البيانات بنجاح', 'success');
                }
            );
        } catch (err) {
            toast('خطأ في قراءة الملف: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function deleteAll() {
    showConfirm('⚠️ تحذير: سيتم حذف جميع بيانات النظام نهائياً ولن يمكن استرجاعها!\n\nشمل: التذاكر، العملاء، المصاريف، الديون، الأقساط، سلة المحذوفات، الإعدادات.\n\nهل تريد المتابعة؟', function(ok) {
        if (!ok) return;
        db.transactions = [];
        db.expenses = [];
        db.expenseCategories = [];
        db.clients = [];
        db.manualDebts = [];
        db.installmentContracts = [];
        db.deletedItems = [];
        db.backups = [];
        db.settings = { currency: 'IQD', language: 'ar' };
        db.metadata = { createdAt: dbNowISO(), lastUpdated: dbNowISO(), migratedFrom: null };
        nextId = 1;
        nextExpId = 1;
        nextClientId = 1;
        logActivity('حذف كامل للبيانات', 'حذف جميع بيانات النظام');
        saveDB();
        renderAll();
        toast('تم حذف جميع البيانات نهائياً', 'success');
    });
}

/* ═══════════════════════════════════════
   أدوات مساعدة
═══════════════════════════════════════ */
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function setTodayDate(id) {
    var el = document.getElementById(id);
    if (el && !el.value) el.value = todayStr();
}

function showModal(id) {
    closeAllModals();
    document.getElementById(id).classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(function(m) { m.classList.remove('show'); });
    document.body.style.overflow = '';
    document.querySelectorAll('.modal .modal-box').forEach(function(b) {
        b.style.transform = '';
        b.style.animation = '';
        b.classList.remove('dragging');
    });
}

function showConfirm(msg, cb) {
    document.getElementById('confirmText').innerHTML = msg.replace(/\n/g, '<br>');
    confirmCallback = cb;
    showModal('confirmModal');
}

function closeConfirm(val) {
    closeAllModals();
    if (confirmCallback) {
        confirmCallback(val);
        confirmCallback = null;
    }
}

/* ── سحب النوافذ المنبثقة (وصل تسجيل الدفعات) — سطح المكتب فقط ── */
function initModalDrag() {
    if (!window.PointerEvent) return;
    var modals = document.querySelectorAll('.modal');
    for (var i = 0; i < modals.length; i++) {
        var header = modals[i].querySelector('.modal-header');
        if (!header) continue;
        header.addEventListener('pointerdown', function(e) {
            if (window.innerWidth <= 768) return;
            if (e.target.closest && e.target.closest('.modal-close')) return;
            var modal = this.closest('.modal');
            var box = modal.querySelector('.modal-box');
            if (!modal.classList.contains('show') || !box) return;
            startModalDrag(e, box);
        });
    }
}

function startModalDrag(e, box) {
    var startX = e.clientX, startY = e.clientY;
    var baseX = 0, baseY = 0;
    var m = box.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    if (m) { baseX = parseFloat(m[1]); baseY = parseFloat(m[2]); }
    box.style.animation = 'none';
    box.classList.add('dragging');
    function onMove(ev) {
        box.style.transform = 'translate(' + (baseX + (ev.clientX - startX)) + 'px, ' + (baseY + (ev.clientY - startY)) + 'px)';
    }
    function onUp() {
        box.classList.remove('dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}

function toast(msg, type) {
    type = type || 'info';
    var wrap = document.getElementById('toastWrap');
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function() {
        el.style.animation = 'toastOut .3s forwards';
        setTimeout(function() { el.remove(); }, 300);
    }, 3000);
}

function downloadFile(content, name, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════
   المصاريف
═══════════════════════════════════════ */

var expenseCategories = [];

function loadExpenseCategories() {
    if (db && Array.isArray(db.expenseCategories)) {
        expenseCategories = db.expenseCategories;
    }
}

function saveExpenseCategories() {
    if (db) db.expenseCategories = expenseCategories;
}

function addExpenseCategory(name) {
    name = String(name || '').trim();
    if (!name) return;
    for (var i = 0; i < expenseCategories.length; i++) {
        if (expenseCategories[i] === name) return;
    }
    expenseCategories.push(name);
    saveExpenseCategories();
}

function getExpenseMonthKey() {
    var now = new Date();
    return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function getExpenseMonthName(monthKey) {
    var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    var parts = monthKey.split('-');
    var m = safeNum(parts[1]) - 1;
    return months[m] + ' ' + parts[0];
}

function generateMonthlyRecurringExpenses() {
    var exps = getExpenses();
    var changed = false;
    var currentMonth = getExpenseMonthKey();
    var today = new Date();
    var currentDay = today.getDate();

    for (var i = 0; i < exps.length; i++) {
        var ex = exps[i];
        if (!ex.isRecurring || !ex.dueDay) continue;

        var found = false;
        for (var j = 0; j < ex.monthlyRecords.length; j++) {
            if (ex.monthlyRecords[j].month === currentMonth) { found = true; break; }
        }

        if (!found && currentDay >= 1) {
            ex.monthlyRecords.push({
                month: currentMonth,
                status: 'unpaid',
                paidDate: null
            });
            changed = true;
        }
    }

    if (changed) {
        setExpenses(exps);
        saveDB();
    }
}

function getExpensePaidTotalForMonth(ex, monthKey) {
    if (!ex.isRecurring) {
        return ex.paymentStatus === 'paid' ? safeNum(ex.amount) : 0;
    }
    var total = 0;
    for (var i = 0; i < ex.monthlyRecords.length; i++) {
        if (ex.monthlyRecords[i].month === monthKey && ex.monthlyRecords[i].status === 'paid') {
            total += safeNum(ex.amount);
        }
    }
    return total;
}

function getExpenseStatusForMonth(ex, monthKey) {
    if (!ex.isRecurring) return ex.paymentStatus || 'paid';
    for (var i = 0; i < ex.monthlyRecords.length; i++) {
        if (ex.monthlyRecords[i].month === monthKey) return ex.monthlyRecords[i].status;
    }
    return 'unpaid';
}

function getExpenseTotals() {
    var exps = getExpenses();
    var totalPaid = 0, totalUnpaid = 0, totalPartial = 0;
    var monthPaid = 0, monthUnpaid = 0, monthPartial = 0;
    var today = 0, year = 0;
    var now = new Date();
    var todayStr2 = now.toISOString().split('T')[0];
    var currentMonth = getExpenseMonthKey();
    var yearPrefix = String(now.getFullYear());
    var recurringCount = 0, oneTimeCount = 0;
    var unpaidCount = 0;

    for (var i = 0; i < exps.length; i++) {
        var ex = exps[i];
        var amt = safeNum(ex.amount);
        var paidAmt = safeNum(ex.amountPaid);
        var remAmt = safeNum(ex.remaining);

        if (ex.isRecurring) {
            recurringCount++;
            for (var j = 0; j < ex.monthlyRecords.length; j++) {
                var rec = ex.monthlyRecords[j];
                if (rec.status === 'paid') {
                    totalPaid += amt;
                    if (rec.month === currentMonth) monthPaid += amt;
                    if (rec.month && rec.month.indexOf(yearPrefix) === 0) year += amt;
                } else {
                    totalUnpaid += amt;
                    if (rec.month === currentMonth) monthUnpaid += amt;
                }
            }
        } else {
            oneTimeCount++;
            var exDate = String(ex.date || '');
            var paySt = getExpensePaymentStatus(ex);
            if (paySt === 'paid') {
                totalPaid += amt;
                if (exDate === todayStr2) today += amt;
                if (exDate.indexOf(yearPrefix) === 0) year += amt;
                if (exDate.indexOf(currentMonth) === 0) monthPaid += amt;
            } else if (paySt === 'partial') {
                totalPartial += paidAmt;
                totalUnpaid += remAmt;
                unpaidCount++;
                if (exDate.indexOf(currentMonth) === 0) { monthPartial += paidAmt; monthUnpaid += remAmt; }
            } else {
                totalUnpaid += amt;
                unpaidCount++;
                if (exDate.indexOf(currentMonth) === 0) monthUnpaid += amt;
            }
        }
    }

    return {
        totalPaid: totalPaid,
        totalUnpaid: totalUnpaid,
        totalPartial: totalPartial,
        monthPaid: monthPaid,
        monthUnpaid: monthUnpaid,
        monthPartial: monthPartial,
        today: today,
        year: year,
        recurringCount: recurringCount,
        oneTimeCount: oneTimeCount,
        unpaidCount: unpaidCount
    };
}

function renderExpenses() {
    var exps = getExpenses();
    var body = document.getElementById('expenseBody');
    var empty = document.getElementById('expenseEmptyMsg');

    var totals = getExpenseTotals();
    var el1 = document.getElementById('expMonthPaid');
    var el2 = document.getElementById('expMonthUnpaid');
    var el3 = document.getElementById('expTotalPaid');
    var el4 = document.getElementById('expTotalUnpaid');
    var el5 = document.getElementById('expRecurringCount');
    var el6 = document.getElementById('expOneTimeCount');
    if (el1) el1.textContent = fmt(totals.monthPaid) + ' د.ع';
    if (el2) el2.textContent = fmt(totals.monthUnpaid) + ' د.ع';
    if (el3) el3.textContent = fmt(totals.totalPaid) + ' د.ع';
    if (el4) el4.textContent = fmt(totals.totalUnpaid) + ' د.ع';
    if (el5) el5.textContent = totals.recurringCount;
    if (el6) el6.textContent = totals.oneTimeCount;

    if (!body) return;

    var currentMonth = getExpenseMonthKey();
    var searchVal = (document.getElementById('expSearchText') || {}).value || '';
    var searchType = (document.getElementById('expFilterStatus') || {}).value || 'all';
    searchVal = searchVal.toLowerCase();

    var filtered = [];
    for (var k = 0; k < exps.length; k++) {
        var fex = exps[k];
        var matchSearch = true;
        var matchStatus = true;

        if (searchVal) {
            var hay = String((fex.name || '') + ' ' + (fex.category || '') + ' ' + (fex.description || '') + ' ' + (fex.notes || '') + ' ' + safeNum(fex.amount)).toLowerCase();
            if (hay.indexOf(searchVal) === -1) matchSearch = false;
        }

        if (searchType !== 'all') {
            if (searchType === 'recurring' && !fex.isRecurring) matchStatus = false;
            if (searchType === 'onetime' && fex.isRecurring) matchStatus = false;
            if (searchType !== 'recurring' && searchType !== 'onetime') {
                var st = getExpenseStatusForMonth(fex, currentMonth);
                var paySt = getExpensePaymentStatus(fex);
                if (searchType === 'paid' && paySt !== 'paid' && st !== 'paid') matchStatus = false;
                if (searchType === 'unpaid' && paySt === 'paid') matchStatus = false;
                if (searchType === 'partial' && paySt !== 'partial') matchStatus = false;
            }
        }

        if (matchSearch && matchStatus) filtered.push(fex);
    }

    if (filtered.length === 0) {
        body.innerHTML = '';
        if (empty) empty.style.display = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    filtered.sort(function(a, b) {
        var da = String(a.date || '');
        var db2 = String(b.date || '');
        if (da !== db2) return db2.localeCompare(da);
        return safeNum(b.id) - safeNum(a.id);
    });

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
        var ex = filtered[i];
        var status = getExpenseStatusForMonth(ex, currentMonth);
        var paySt = getExpensePaymentStatus(ex);
        var statusBadge;
        if (paySt === 'paid') {
            statusBadge = '<span class="badge badge-green">مدفوع بالكامل</span>';
        } else if (paySt === 'partial') {
            statusBadge = '<span class="badge badge-orange">جزئي</span>';
        } else {
            statusBadge = status === 'paid'
                ? '<span class="badge badge-green">مدفوع</span>'
                : '<span class="badge badge-red">غير مدفوع</span>';
        }
        var recurBadge = ex.isRecurring
            ? '<span class="badge badge-blue">شهري</span>'
            : '<span class="badge badge-orange">مرة واحدة</span>';
        var paidAmt = safeNum(ex.amountPaid);
        var remAmt = safeNum(ex.remaining);
        var payBtn = '';
        if (ex.isRecurring) {
            if (status === 'paid') {
                payBtn = '<button class="btn-sm btn-green-disabled" title="تم سداد المصروف بالكامل"><i data-lucide="circle-check-big"></i> تم السداد</button>';
            } else {
                payBtn = '<button class="btn-sm btn-green" onclick="event.stopPropagation();toggleExpenseMonthPayment(' + ex.id + ',\'' + currentMonth + '\')" title="تسجيل الدفع">تسجيل دفعة</button>';
            }
        } else {
            if (paySt === 'paid') {
                payBtn = '<button class="btn-sm btn-green-disabled" title="تم سداد المصروف بالكامل"><i data-lucide="circle-check-big"></i> تم السداد</button>';
            } else {
                payBtn = '<button class="btn-sm btn-green" onclick="event.stopPropagation();recordExpensePayment(' + ex.id + ')" title="تسجيل دفعة">تسجيل دفعة</button>';
            }
        }
        var lastPayment = '';
        if (ex.payments && ex.payments.length > 0) {
            var last = ex.payments[ex.payments.length - 1];
            lastPayment = '<span class="debt-truncate" title="' + (last.notes || last.date) + '">' + fmt(safeNum(last.amount)) + '</span>';
        }
        html += '<tr class="expense-row" onclick="showExpenseDetail(' + ex.id + ')" style="cursor:pointer">' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + (ex.date || '—') + '</td>' +
            '<td>' + (ex.name || ex.category || '—') + '</td>' +
            '<td class="num">' + fmt(safeNum(ex.amount)) + '</td>' +
            '<td class="num">' + fmt(paidAmt) + '</td>' +
            '<td class="num">' + fmt(remAmt) + '</td>' +
            '<td>' + recurBadge + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td>' + lastPayment + '</td>' +
            '<td class="debt-col-actions"><div class="debt-actions">' +
            '<button class="btn-sm btn-edit" onclick="event.stopPropagation();openExpenseEdit(' + ex.id + ')" title="تعديل"><i data-lucide="pencil"></i></button>' +
            payBtn +
            '<button class="btn-sm btn-del" onclick="event.stopPropagation();confirmDeleteExpense(' + ex.id + ')" title="حذف"><i data-lucide="trash-2"></i></button>' +
            '</div></td></tr>';
    }
    body.innerHTML = html;
}

function openExpenseDialog() {
    setTodayDate('expDate');
    document.getElementById('expEditId').value = '';
    document.getElementById('expName').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expPaid').value = '0';
    document.getElementById('expRemaining').value = '';
    document.getElementById('expDesc').value = '';
    document.getElementById('expNotes').value = '';
    document.getElementById('expIsRecurring').checked = false;
    document.getElementById('recurringFields').style.display = 'none';
    document.getElementById('expDueDay').value = '';
    document.getElementById('expPaymentStatus').value = 'paid';
    renderExpenseCategoryOptions('expName');
    showModal('expenseModal');
}

function toggleRecurringFields() {
    var checked = document.getElementById('expIsRecurring').checked;
    document.getElementById('recurringFields').style.display = checked ? '' : 'none';
    document.getElementById('oneTimeStatusField').style.display = checked ? 'none' : '';
}

function calcExpRemaining() {
    var total = safeNum(document.getElementById('expAmount').value);
    var paid = safeNum(document.getElementById('expPaid').value);
    document.getElementById('expRemaining').value = Math.max(0, total - paid);
}

function calcExpEditRemaining() {
    var total = safeNum(document.getElementById('expEditAmount').value);
    var paid = safeNum(document.getElementById('expEditPaid').value);
    document.getElementById('expEditRemaining').value = Math.max(0, total - paid);
}

function renderExpenseCategoryOptions(inputId) {
    var datalistId = inputId === 'expEditName' ? 'expEditCategoryList' : 'expCategoryList';
    var datalist = document.getElementById(datalistId);
    if (!datalist) return;
    var html = '';
    for (var i = 0; i < expenseCategories.length; i++) {
        html += '<option value="' + expenseCategories[i] + '">';
    }
    datalist.innerHTML = html;
}

function saveExpense(e) {
    e.preventDefault();
    var date = document.getElementById('expDate').value;
    var name = document.getElementById('expName').value.trim();
    var amount = safeNum(document.getElementById('expAmount').value);
    var amountPaid = safeNum(document.getElementById('expPaid').value);
    var remaining = Math.max(0, amount - amountPaid);
    var desc = document.getElementById('expDesc').value.trim();
    var notes = document.getElementById('expNotes').value.trim();
    var isRecurring = document.getElementById('expIsRecurring').checked;
    var dueDay = isRecurring ? safeNum(document.getElementById('expDueDay').value) : 0;
    var paymentStatus = isRecurring
        ? document.getElementById('expPaymentStatus').value
        : document.getElementById('expPaymentStatusOneTime').value;

    if (!date || !name || amount <= 0) {
        toast('يرجى إدخال البيانات بشكل صحيح', 'error');
        return;
    }
    if (amountPaid > amount) {
        toast('المبلغ المدفوع لا يمكن أن يتجاوز قيمة المصروف', 'error');
        return;
    }
    if (isRecurring && (dueDay < 1 || dueDay > 31)) {
        toast('يرجى إدخال يوم صحيح من 1 إلى 31', 'error');
        return;
    }

    addExpenseCategory(name);

    var exps = getExpenses();
    var newExp = {
        id: nextExpId++,
        date: String(date),
        category: String(name),
        name: String(name),
        amount: amount,
        amountPaid: amountPaid,
        remaining: remaining,
        payments: [],
        description: String(desc),
        notes: String(notes),
        isRecurring: isRecurring,
        dueDay: dueDay,
        paymentStatus: isRecurring ? 'unpaid' : paymentStatus,
        monthlyRecords: []
    };

    if (isRecurring) {
        var currentMonth = getExpenseMonthKey();
        newExp.monthlyRecords.push({
            month: currentMonth,
            status: paymentStatus,
            paidDate: paymentStatus === 'paid' ? todayStr() : null
        });
    }

    if (amountPaid > 0) {
        newExp.payments.push({ date: String(date), amount: amountPaid, notes: 'المبلغ المدفوع عند الإنشاء' });
    }

    exps.push(newExp);
    setExpenses(exps);
    refreshApplicationState();
    logActivity('إضافة مصروف', name + ' — ' + fmt(amount) + ' د.ع');
    closeAllModals();
    toast('تم حفظ المصروف — ' + fmt(amount) + ' د.ع', 'success');
}

function openExpenseEdit(id) {
    var exps = getExpenses();
    var ex = null;
    for (var i = 0; i < exps.length; i++) {
        if (safeNum(exps[i].id) === safeNum(id)) { ex = exps[i]; break; }
    }
    if (!ex) return;

    document.getElementById('expEditIdEdit').value = ex.id;
    document.getElementById('expEditName').value = ex.name || ex.category || '';
    document.getElementById('expEditAmount').value = safeNum(ex.amount);
    document.getElementById('expEditPaid').value = safeNum(ex.amountPaid);
    document.getElementById('expEditRemaining').value = safeNum(ex.remaining);
    document.getElementById('expEditDesc').value = ex.description || '';
    document.getElementById('expEditNotes').value = ex.notes || '';
    document.getElementById('expEditIsRecurring').checked = !!ex.isRecurring;
    document.getElementById('editRecurringFields').style.display = ex.isRecurring ? '' : 'none';
    document.getElementById('expEditDueDay').value = ex.dueDay || '';
    document.getElementById('expEditPaymentStatus').value = ex.paymentStatus || 'paid';
    renderExpenseCategoryOptions('expEditName');
    showModal('expenseEditModal');
}

function toggleEditRecurringFields() {
    var checked = document.getElementById('expEditIsRecurring').checked;
    document.getElementById('editRecurringFields').style.display = checked ? '' : 'none';
}

function submitExpenseEdit(e) {
    e.preventDefault();
    var id = safeNum(document.getElementById('expEditIdEdit').value);
    var exps = getExpenses();
    var ex = null;
    for (var i = 0; i < exps.length; i++) {
        if (safeNum(exps[i].id) === id) { ex = exps[i]; break; }
    }
    if (!ex) return;

    var name = document.getElementById('expEditName').value.trim();
    var amount = safeNum(document.getElementById('expEditAmount').value);
    var amountPaid = safeNum(document.getElementById('expEditPaid').value);
    var remaining = Math.max(0, amount - amountPaid);
    var desc = document.getElementById('expEditDesc').value.trim();
    var notes = document.getElementById('expEditNotes').value.trim();
    var isRecurring = document.getElementById('expEditIsRecurring').checked;
    var dueDay = isRecurring ? safeNum(document.getElementById('expEditDueDay').value) : 0;
    var paymentStatus = document.getElementById('expEditPaymentStatus').value;

    if (!name || amount <= 0) {
        toast('البيانات غير صحيحة', 'error');
        return;
    }
    if (amountPaid > amount) {
        toast('المبلغ المدفوع لا يمكن أن يتجاوز قيمة المصروف', 'error');
        return;
    }
    if (isRecurring && (dueDay < 1 || dueDay > 31)) {
        toast('يرجى إدخال يوم صحيح من 1 إلى 31', 'error');
        return;
    }

    addExpenseCategory(name);

    ex.name = String(name);
    ex.category = String(name);
    ex.amount = amount;
    ex.amountPaid = amountPaid;
    ex.remaining = remaining;
    ex.description = String(desc);
    ex.notes = String(notes);
    ex.isRecurring = isRecurring;
    ex.dueDay = dueDay;
    ex.paymentStatus = isRecurring ? 'unpaid' : paymentStatus;

    refreshApplicationState();
    logActivity('تعديل مصروف', name);
    closeAllModals();
    toast('تم تعديل المصروف بنجاح', 'success');
}

function toggleExpensePayment(id) {
    var exps = getExpenses();
    var ex = null;
    for (var i = 0; i < exps.length; i++) {
        if (safeNum(exps[i].id) === safeNum(id)) { ex = exps[i]; break; }
    }
    if (!ex) return;
    ex.paymentStatus = ex.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    setExpenses(exps);
    refreshApplicationState();
}

function toggleExpenseMonthPayment(id, monthKey) {
    var exps = getExpenses();
    var ex = null;
    for (var i = 0; i < exps.length; i++) {
        if (safeNum(exps[i].id) === safeNum(id)) { ex = exps[i]; break; }
    }
    if (!ex) return;

    var found = false;
    for (var j = 0; j < ex.monthlyRecords.length; j++) {
        if (ex.monthlyRecords[j].month === monthKey) {
            ex.monthlyRecords[j].status = ex.monthlyRecords[j].status === 'paid' ? 'unpaid' : 'paid';
            ex.monthlyRecords[j].paidDate = ex.monthlyRecords[j].status === 'paid' ? todayStr() : null;
            found = true;
            break;
        }
    }
    if (!found) {
        ex.monthlyRecords.push({
            month: monthKey,
            status: 'paid',
            paidDate: todayStr()
        });
    }

    setExpenses(exps);
    refreshApplicationState();
}

/* ═══════════════════════════════════════
   تسجيل دفعة مصروف جزئية
═══════════════════════════════════════ */

function getExpensePaymentStatus(ex) {
    var amount = safeNum(ex.amount);
    var paid = safeNum(ex.amountPaid);
    if (paid <= 0) return 'unpaid';
    if (paid >= amount) return 'paid';
    return 'partial';
}

function getExpensePaymentLabel(ex) {
    var st = getExpensePaymentStatus(ex);
    if (st === 'paid') return '<i data-lucide="circle-check-big"></i> مدفوع بالكامل';
    if (st === 'partial') return '<i data-lucide="circle-alert"></i> مدفوع جزئياً';
    return '<i data-lucide="circle-alert"></i> غير مدفوع';
}

function recordExpensePayment(id) {
    document.getElementById('expPayId').value = id;
    document.getElementById('expPayAmount').value = '';
    setTodayDate('expPayDate');
    document.getElementById('expPayNotes').value = '';
    var exps = getExpenses();
    var ex = null;
    for (var i = 0; i < exps.length; i++) {
        if (safeNum(exps[i].id) === safeNum(id)) { ex = exps[i]; break; }
    }
    if (ex) {
        document.getElementById('expPayRemaining').textContent = fmt(safeNum(ex.remaining)) + ' د.ع';
        document.getElementById('expPayAmount').max = ex.remaining;
    }
    showModal('expPayModal');
}

function submitExpensePayment(e) {
    e.preventDefault();
    var id = safeNum(document.getElementById('expPayId').value);
    var amount = safeNum(document.getElementById('expPayAmount').value);
    var date = document.getElementById('expPayDate').value;
    var notes = document.getElementById('expPayNotes').value.trim();

    if (amount <= 0 || !date) {
        toast('يرجى إدخال مبلغ وتاريخ صحيحين', 'error');
        return;
    }

    var exps = getExpenses();
    var ex = null;
    for (var i = 0; i < exps.length; i++) {
        if (safeNum(exps[i].id) === id) { ex = exps[i]; break; }
    }
    if (!ex) return;

    if (amount > safeNum(ex.remaining)) {
        toast('المبلغ أكبر من المتبقي', 'error');
        return;
    }

    if (!ex.payments) ex.payments = [];
    ex.payments.push({ date: String(date), amount: amount, notes: String(notes) });
    ex.amountPaid = safeNum(ex.amountPaid) + amount;
    ex.remaining = Math.max(0, safeNum(ex.amount) - safeNum(ex.amountPaid));

    setExpenses(exps);
    closeAllModals();
    refreshApplicationState();
    logActivity('تسجيل دفعة مصروف', 'مبلغ: ' + fmt(amount) + ' د.ع');
    toast('تم تسجيل الدفعة بنجاح', 'success');
}

function confirmDeleteExpense(id) {
    showConfirm('سيتم نقل هذا السجل إلى سلة المحذوفات ويمكن استرجاعه خلال 24 ساعة.', function(ok) {
        if (!ok) return;
        var exps = getExpenses();
        var item = null;
        for (var i = 0; i < exps.length; i++) {
            if (safeNum(exps[i].id) === safeNum(id)) { item = exps[i]; break; }
        }
        if (!item) return;
        moveToTrash('expense', JSON.parse(JSON.stringify(item)), item.name || 'مصروف #' + item.id);
        setExpenses(exps.filter(function(e) { return safeNum(e.id) !== safeNum(id); }));
        logActivity('حذف مصروف', item.name || 'مصروف #' + id);
        refreshApplicationState();
        toast('تم النقل إلى سلة المحذوفات', 'success');
    });
}

function showExpenseDetail(id) {
    var exps = getExpenses();
    var ex = null;
    for (var i = 0; i < exps.length; i++) {
        if (safeNum(exps[i].id) === safeNum(id)) { ex = exps[i]; break; }
    }
    if (!ex) return;

    document.getElementById('detailExpName').textContent = ex.name || ex.category || '—';
    document.getElementById('detailExpType').textContent = ex.isRecurring ? 'مصروف شهري متكرر' : 'مصروف لمرة واحدة';
    document.getElementById('detailExpDate').textContent = ex.date || '—';
    document.getElementById('detailExpAmount').textContent = fmt(safeNum(ex.amount)) + ' د.ع';

    var paidAmt = safeNum(ex.amountPaid);
    var remAmt = safeNum(ex.remaining);
    var paySt = getExpensePaymentStatus(ex);
    var payLabel = getExpensePaymentLabel(ex);

    document.getElementById('detailExpPaidAmt').textContent = fmt(paidAmt) + ' د.ع';
    document.getElementById('detailExpRemainingAmt').textContent = fmt(remAmt) + ' د.ع';
    document.getElementById('detailExpPayStatus').textContent = payLabel;

    if (ex.payments && ex.payments.length > 0) {
        var paymentsHtml = '';
        for (var p = ex.payments.length - 1; p >= 0; p--) {
            var pay = ex.payments[p];
            paymentsHtml += '<tr><td>' + (pay.date || '—') + '</td><td class="num">' + fmt(safeNum(pay.amount)) + ' د.ع</td><td>' + (pay.notes || '—') + '</td></tr>';
        }
        document.getElementById('detailExpPaymentsBody').innerHTML = paymentsHtml;
        document.getElementById('detailExpPaymentsSection').style.display = '';
    } else {
        document.getElementById('detailExpPaymentsBody').innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-3)">لا توجد مدفوعات مسجلة</td></tr>';
        document.getElementById('detailExpPaymentsSection').style.display = 'none';
    }

    if (ex.isRecurring) {
        var paid = 0, unpaid = 0;
        var recordsHtml = '';
        for (var j = ex.monthlyRecords.length - 1; j >= 0; j--) {
            var rec = ex.monthlyRecords[j];
            var recStatus = rec.status === 'paid'
                ? '<span class="badge badge-green">تم الدفع</span>'
                : '<span class="badge badge-red">لم يتم الدفع</span>';
            var recDate = rec.paidDate ? ' — ' + rec.paidDate : '';
            if (rec.status === 'paid') paid++; else unpaid++;
            recordsHtml += '<tr><td>' + getExpenseMonthName(rec.month) + '</td><td>' + recStatus + '</td><td>' + recDate + '</td></tr>';
        }
        document.getElementById('detailExpPaid').textContent = paid + ' شهر';
        document.getElementById('detailExpUnpaid').textContent = unpaid + ' شهر';
        document.getElementById('detailExpTotalPaid').textContent = fmt(paid * safeNum(ex.amount)) + ' د.ع';
        document.getElementById('detailExpRecordsBody').innerHTML = recordsHtml || '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-3)">لا توجد سجلات بعد</td></tr>';
        document.getElementById('detailExpRecurringSection').style.display = '';
    } else {
        document.getElementById('detailExpPaid').textContent = (paySt === 'paid' ? '1' : paySt === 'partial' ? 'جزئي' : '0') + ' مرة';
        document.getElementById('detailExpUnpaid').textContent = (paySt === 'unpaid' ? '1' : '0') + ' مرة';
        document.getElementById('detailExpTotalPaid').textContent = fmt(paidAmt) + ' د.ع';
        document.getElementById('detailExpRecordsBody').innerHTML = '';
        document.getElementById('detailExpRecurringSection').style.display = 'none';
    }

    document.getElementById('detailExpDesc').textContent = ex.description || '—';
    document.getElementById('detailExpNotes').textContent = ex.notes || '—';

    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('page-expense-detail').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    document.querySelector('[data-page="expenses"]').classList.add('active');
    closeSidebar();
}

function filterExpenses() {
    renderExpenses();
}

/* ═══════════════════════════════════════
   تقرير الديون
═══════════════════════════════════════ */
function generateDebtReport() {
    var filter = (document.getElementById('debtFilter') || {}).value || 'all';
    var clients = getClients();
    var txs = getTransactions();
    var rows = [];

    for (var i = 0; i < clients.length; i++) {
        var cl = clients[i];
        var debtSt = getClientDebtStats(cl);
        var svcSt = getClientStats(cl);
        if (debtSt.totalSale === 0 && svcSt.totalServices === 0) continue;
        if (filter === 'debtors' && debtSt.totalRemaining <= 0 && svcSt.remaining <= 0) continue;
        if (filter === 'settled' && (debtSt.totalRemaining > 0 || svcSt.remaining > 0)) continue;

        var totalValue = debtSt.totalSale + svcSt.totalServices;
        var totalPaid = debtSt.totalPaid + svcSt.totalPaid;
        var totalRemaining = debtSt.totalRemaining + svcSt.remaining;
        var lastPay = debtSt.lastPayment || '';

        rows.push({
            name: cl.name || '—',
            phone: cl.phone || '—',
            svcCount: (cl.services || []).length,
            ticketDebtCount: debtSt.debtCount,
            totalValue: totalValue,
            totalPaid: totalPaid,
            totalRemaining: totalRemaining,
            lastPayment: lastPay
        });
    }

    rows.sort(function(a, b) { return b.totalRemaining - a.totalRemaining; });

    var totalVal = 0, totalPd = 0, totalRem = 0;
    var html = '';
    for (var j = 0; j < rows.length; j++) {
        var r = rows[j];
        totalVal += r.totalValue;
        totalPd += r.totalPaid;
        totalRem += r.totalRemaining;
        var remClass = r.totalRemaining > 0 ? 'text-red' : 'text-green';
        var remBadge = r.totalRemaining > 0 ? '<span class="badge badge-orange"><i data-lucide="circle-alert"></i> عليه دين</span>' : '<span class="badge badge-green"><i data-lucide="circle-check-big"></i> مسدد</span>';
        html += '<tr>' +
            '<td>' + (j + 1) + '</td>' +
            '<td>' + r.name + '</td>' +
            '<td>' + r.phone + '</td>' +
            '<td class="num">' + r.svcCount + '</td>' +
            '<td class="num">' + fmt(r.totalValue) + '</td>' +
            '<td class="num">' + fmt(r.totalPaid) + '</td>' +
            '<td class="num ' + remClass + '">' + fmt(r.totalRemaining) + '</td>' +
            '<td>' + remBadge + '</td>' +
            '<td>' + (r.lastPayment || '—') + '</td>' +
            '</tr>';
    }

    var debtBody = document.getElementById('debtReportBody');
    var debtEmpty = document.getElementById('debtReportEmpty');
    if (debtBody) {
        if (rows.length === 0) {
            debtBody.innerHTML = '';
            if (debtEmpty) debtEmpty.style.display = '';
        } else {
            if (debtEmpty) debtEmpty.style.display = 'none';
            debtBody.innerHTML = html;
        }
    }

    var e1 = document.getElementById('debtReportTotalClients');
    var e2 = document.getElementById('debtReportTotalValue');
    var e3 = document.getElementById('debtReportTotalPaid');
    var e4 = document.getElementById('debtReportTotalRemaining');
    if (e1) e1.textContent = rows.length;
    if (e2) e2.textContent = fmt(totalVal) + ' د.ع';
    if (e3) e3.textContent = fmt(totalPd) + ' د.ع';
    if (e4) e4.textContent = fmt(totalRem) + ' د.ع';
}

function filterDebtClients() {
    generateDebtReport();
}

function printExpensesReport() {
    window.print();
}

function exportExpensesExcel() {
    var exps = getExpenses();
    if (exps.length === 0) { toast('لا توجد بيانات للتصدير', 'warning'); return; }
    var currentMonth = getExpenseMonthKey();

    var headers = ['#', 'اسم المصروف', 'التاريخ', 'المبلغ', 'المدفوع', 'المتبقي', 'نوع المصروف', 'حالة الدفع', 'الوصف', 'الملاحظات'];
    var data = [];
    var totalPaid = 0, totalUnpaid = 0, totalPartial = 0, totalAmount = 0;
    var monthlyCount = 0, oneTimeCount = 0;

    for (var i = 0; i < exps.length; i++) {
        var ex = exps[i];
        var type = ex.isRecurring ? 'شهري' : 'مرة واحدة';
        if (ex.isRecurring) monthlyCount++; else oneTimeCount++;
        var paySt = getExpensePaymentStatus(ex);
        var statusLabel;
        if (paySt === 'paid') statusLabel = 'مدفوع بالكامل';
        else if (paySt === 'partial') statusLabel = 'مدفوع جزئياً';
        else statusLabel = 'غير مدفوع';

        var paidAmt = safeNum(ex.amountPaid);
        var remAmt = safeNum(ex.remaining);
        var amt = safeNum(ex.amount);
        totalAmount += amt;
        if (paySt === 'paid') totalPaid += amt;
        else if (paySt === 'partial') { totalPartial += paidAmt; totalUnpaid += remAmt; }
        else totalUnpaid += amt;

        data.push([i + 1, ex.name || ex.category || '—', ex.date || '—', xlFormatNum(amt), xlFormatNum(paidAmt), xlFormatNum(remAmt), type, statusLabel, ex.description || '—', ex.notes || '—']);
    }

    var cards = [
        { label: 'إجمالي المصروفات', value: totalAmount, isCurrency: true, bgColor: 'FFEBEE', valueColor: 'C62828' },
        { label: 'المدفوع بالكامل', value: totalPaid, isCurrency: true, bgColor: 'E8F5E9', valueColor: '1A6B4E' },
        { label: 'المدفوع جزئياً', value: totalPartial, isCurrency: true, bgColor: 'FFF3E0', valueColor: 'E65100' },
        { label: 'غير المدفوع', value: totalUnpaid, isCurrency: true, bgColor: 'FFEBEE', valueColor: 'C62828' },
        { label: 'المصروفات الشهرية', value: monthlyCount, bgColor: 'E3F2FD', valueColor: '1565C0' },
        { label: 'المصروفات لمرة واحدة', value: oneTimeCount, bgColor: 'F3E5F5', valueColor: '6A1B9A' }
    ];

    var summaryItems = [
        { label: 'إجمالي المدفوع بالكامل', value: xlFormatNum(totalPaid), isCurrency: false },
        { label: 'إجمالي المدفوع جزئياً', value: xlFormatNum(totalPartial), isCurrency: false },
        { label: 'إجمالي غير المدفوع', value: xlFormatNum(totalUnpaid), isCurrency: false },
        { label: 'الإجمالي الكلي', value: xlFormatNum(totalAmount), isCurrency: false, valueColor: 'C62828' }
    ];

    xlExport({
        title: 'تقرير المصاريف - ' + currentMonth,
        filename: 'expenses_' + currentMonth + '.xlsx',
        sheetName: 'المصاريف',
        numCols: 10,
        cards: cards,
        headers: headers,
        data: data,
        summaryItems: summaryItems,
        landscape: true,
        tableOptions: { colWidths: [6, 20, 14, 16, 16, 16, 14, 16, 20, 20] }
    });
}

/* ═══════════════════════════════════════
   العملاء
═══════════════════════════════════════ */

function getClientStats(client) {
    var totalServices = 0;
    var svcs = client.services || [];
    for (var i = 0; i < svcs.length; i++) {
        totalServices += safeNum(svcs[i].amount);
    }
    return { totalServices: totalServices, totalPaid: totalServices, remaining: 0, svcCount: svcs.length };
}

function getClientDebtStats(client) {
    var txs = getTransactions();
    var totalSale = 0, totalPaid = 0, totalRemaining = 0;
    var debtCount = 0;
    var lastPayment = '';
    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        if (tx.type === 'ticket' && safeNum(tx.clientId) === safeNum(client.id)) {
            totalSale += safeNum(tx.salePrice);
            totalPaid += safeNum(tx.amountPaid);
            var rem = safeNum(tx.remainingAmount);
            totalRemaining += rem;
            if (rem > 0) debtCount++;
            var dp = tx.debtPayments || [];
            for (var j = 0; j < dp.length; j++) {
                if (dp[j].date && (!lastPayment || dp[j].date > lastPayment)) lastPayment = dp[j].date;
            }
        }
    }
    return { totalSale: totalSale, totalPaid: totalPaid, totalRemaining: totalRemaining, debtCount: debtCount, lastPayment: lastPayment };
}

function exportClientsExcel() {
    var clients = getClients();
    if (clients.length === 0) { toast('لا توجد بيانات للتصدير', 'warning'); return; }

    var headers = ['#', 'اسم العميل', 'الهاتف', 'العنوان', 'عدد الخدمات', 'إجمالي المدفوع', 'إجمالي المتبقي', 'ملاحظات'];
    var data = [];
    var totalClients = clients.length;
    var debtClients = 0;
    var totalReceivables = 0;

    for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        var st = getClientStats(c);
        var debtSt = getClientDebtStats(c);
        var svcCount = st.svcCount || 0;
        var paid = safeNum(st.totalPaid);
        var remaining = safeNum(st.remaining) + safeNum(debtSt.totalRemaining);
        if (remaining > 0) debtClients++;
        totalReceivables += remaining;

        data.push([i + 1, c.name || '—', c.phone || '—', c.address || '—', svcCount, xlFormatNum(paid), xlFormatNum(remaining), c.notes || '—']);
    }

    var cards = [
        { label: 'عدد العملاء', value: totalClients, bgColor: 'E8F5E9', valueColor: '1A6B4E' },
        { label: 'العملاء المدينين', value: debtClients, bgColor: 'FFEBEE', valueColor: 'C62828' },
        { label: 'العملاء غير المدينين', value: totalClients - debtClients, bgColor: 'E3F2FD', valueColor: '1565C0' },
        { label: 'إجمالي الذمم المدينة', value: totalReceivables, isCurrency: true, bgColor: 'FFF3E0', valueColor: 'E65100' }
    ];

    var summaryItems = [
        { label: 'عدد العملاء الإجمالي', value: totalClients, isCurrency: false },
        { label: 'العملاء المدينين', value: debtClients, isCurrency: false },
        { label: 'العملاء غير المدينين', value: totalClients - debtClients, isCurrency: false },
        { label: 'إجمالي الذمم المدينة', value: xlFormatNum(totalReceivables), isCurrency: false, valueColor: 'C62828' }
    ];

    xlExport({
        title: 'تقرير العملاء',
        filename: 'clients_' + todayStr() + '.xlsx',
        sheetName: 'العملاء',
        numCols: 8,
        cards: cards,
        headers: headers,
        data: data,
        summaryItems: summaryItems,
        landscape: true,
        tableOptions: { colWidths: [6, 18, 14, 16, 12, 16, 16, 20] }
    });
}

function exportStatementExcel() {
    var txs = getTransactions();
    if (txs.length === 0) { toast('لا توجد بيانات للتصدير', 'warning'); return; }

    var headers = ['#', 'التاريخ', 'النوع', 'العميل', 'الشركة', 'السعر الأساسي', 'سعر البيع', 'الربح', 'الرصيد', 'الملاحظات'];
    var data = [];
    var incTotal = 0, costTotal = 0, saleTotal = 0, profitTotal = 0;
    var ticketCount = 0, increaseCount = 0;

    var sorted = getSortedTransactions();
    for (var i = 0; i < sorted.length; i++) {
        var tx = sorted[i];
        var isT = tx.type === 'ticket';
        var type = isT ? getServiceInfo(tx).badge : 'تعزيز';
        var base = isT ? xlFormatNum(tx.basePrice) : '—';
        var sale = isT ? xlFormatNum(tx.salePrice) : '—';
        var prof = isT ? xlFormatNum(tx.profit) : '—';
        var bal = xlFormatNum(tx.balance);
        data.push([i + 1, tx.date || '—', type, tx.customer || '—', tx.airline || '—', base, sale, prof, bal, tx.notes || '—']);

        if (isT) { costTotal += safeNum(tx.basePrice); saleTotal += safeNum(tx.salePrice); profitTotal += safeNum(tx.profit); ticketCount++; }
        else { incTotal += safeNum(tx.amount); increaseCount++; }
    }

    var balance = sorted.length > 0 ? safeNum(sorted[sorted.length - 1].balance) : 0;

    var cards = [
        { label: 'إجمالي التعزيز', value: incTotal, isCurrency: true, bgColor: 'E8F5E9', valueColor: '1A6B4E' },
        { label: 'إجمالي القطع (المبيعات)', value: saleTotal, isCurrency: true, bgColor: 'E3F2FD', valueColor: '1565C0' },
        { label: 'إجمالي الأرباح', value: profitTotal, isCurrency: true, bgColor: 'FFF3E0', valueColor: 'E65100' },
        { label: 'الرصيد الحالي', value: balance, isCurrency: true, bgColor: 'E0F2F1', valueColor: '00695C' },
        { label: 'عدد التعزيز', value: increaseCount, bgColor: 'F3E5F5', valueColor: '6A1B9A' },
        { label: 'عدد التذاكر', value: ticketCount, bgColor: 'FFFDE7', valueColor: 'F9A825' }
    ];

    var summaryItems = [
        { label: 'إجمالي التعزيز', value: xlFormatNum(incTotal), isCurrency: false },
        { label: 'إجمالي تكلفة التذاكر', value: xlFormatNum(costTotal), isCurrency: false },
        { label: 'إجمالي المبيعات', value: xlFormatNum(saleTotal), isCurrency: false },
        { label: 'إجمالي الأرباح', value: xlFormatNum(profitTotal), isCurrency: false },
        { label: 'الرصيد الحالي', value: xlFormatNum(balance), isCurrency: false },
        { label: 'عدد العمليات', value: sorted.length, isCurrency: false }
    ];

    xlExport({
        title: 'كشف الحساب - جميع العمليات',
        filename: 'statement_' + todayStr() + '.xlsx',
        sheetName: 'كشف الحساب',
        numCols: 10,
        cards: cards,
        headers: headers,
        data: data,
        summaryItems: summaryItems,
        landscape: true,
        tableOptions: { colWidths: [6, 14, 14, 18, 16, 16, 16, 16, 16, 24] }
    });
}

function exportDebtClientsExcel() {
    var txs = getTransactions();
    var debtTxs = [];
    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        if (tx.type === 'ticket' && tx.paymentMethod === 'debt' && safeNum(tx.remainingAmount) > 0) {
            debtTxs.push(tx);
        }
    }
    if (debtTxs.length === 0) { toast('لا توجد ديون للتصدير', 'warning'); return; }

    var headers = ['#', 'التاريخ', 'العميل', 'الشركة', 'سعر البيع', 'المدفوع', 'المتبقي', 'الملاحظات'];
    var data = [];
    var totalDebt = 0, totalPaid = 0, totalRemaining = 0;

    for (var i = 0; i < debtTxs.length; i++) {
        var tx = debtTxs[i];
        var sale = safeNum(tx.salePrice);
        var paid = safeNum(tx.amountPaid);
        var rem = safeNum(tx.remainingAmount);
        totalDebt += sale;
        totalPaid += paid;
        totalRemaining += rem;
        data.push([i + 1, tx.date || '—', tx.customer || '—', tx.airline || '—', xlFormatNum(sale), xlFormatNum(paid), xlFormatNum(rem), tx.notes || '—']);
    }

    var cards = [
        { label: 'إجمالي الديون', value: totalDebt, isCurrency: true, bgColor: 'FFEBEE', valueColor: 'C62828' },
        { label: 'المبلغ المحصل', value: totalPaid, isCurrency: true, bgColor: 'E8F5E9', valueColor: '1A6B4E' },
        { label: 'المبلغ المتبقي', value: totalRemaining, isCurrency: true, bgColor: 'FFF3E0', valueColor: 'E65100' },
        { label: 'عدد المدينين', value: debtTxs.length, bgColor: 'E3F2FD', valueColor: '1565C0' }
    ];

    var summaryItems = [
        { label: 'إجمالي الديون', value: xlFormatNum(totalDebt), isCurrency: false, valueColor: 'C62828' },
        { label: 'المبلغ المحصل', value: xlFormatNum(totalPaid), isCurrency: false },
        { label: 'المبلغ المتبقي', value: xlFormatNum(totalRemaining), isCurrency: false, valueColor: 'E65100' },
        { label: 'نسبة التحصيل', value: totalDebt > 0 ? Math.round(totalPaid / totalDebt * 100) + '%' : '0%', isCurrency: false }
    ];

    xlExport({
        title: 'تقرير ديون العملاء',
        filename: 'debt_clients_' + todayStr() + '.xlsx',
        sheetName: 'ديون العملاء',
        numCols: 8,
        cards: cards,
        headers: headers,
        data: data,
        summaryItems: summaryItems,
        landscape: true,
        tableOptions: { colWidths: [6, 14, 18, 16, 16, 16, 16, 24] }
    });
}

function renderClients() {
    var clients = getClients();
    var body = document.getElementById('clientBody');
    var empty = document.getElementById('clientEmptyMsg');

    var totalCount = clients.length;
    var activeCount = 0, owedCount = 0, totalReceivables = 0;

    for (var k = 0; k < clients.length; k++) {
        var st = getClientStats(clients[k]);
        if (st.svcCount > 0) activeCount++;
        var debtSt = getClientDebtStats(clients[k]);
        if (st.remaining > 0 || debtSt.totalRemaining > 0) { owedCount++; totalReceivables += st.remaining + debtSt.totalRemaining; }
    }

    var e1 = document.getElementById('clientTotalCount');
    var e2 = document.getElementById('clientActiveCount');
    var e3 = document.getElementById('clientOwedCount');
    var e4 = document.getElementById('clientReceivables');
    if (e1) e1.textContent = totalCount;
    if (e2) e2.textContent = activeCount;
    if (e3) e3.textContent = owedCount;
    if (e4) e4.textContent = fmt(totalReceivables) + ' د.ع';

    if (!body) return;

    if (clients.length === 0) {
        body.innerHTML = '';
        if (empty) empty.style.display = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    var sorted = clients.slice().sort(function(a, b) { return safeNum(b.id) - safeNum(a.id); });
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
        var cl = sorted[i];
        var st2 = getClientStats(cl);
        var remClass = st2.remaining > 0 ? 'text-red' : 'text-green';
        html += '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td><a href="#" class="client-link" onclick="event.preventDefault();showClientDetail(' + cl.id + ')">' + (cl.name || '—') + '</a></td>' +
            '<td>' + (cl.phone || '—') + '</td>' +
            '<td class="num">' + st2.svcCount + '</td>' +
            '<td class="num">' + fmt(st2.totalPaid) + '</td>' +
            '<td class="num ' + remClass + '">' + fmt(st2.remaining) + '</td>' +
            '<td class="actions-cell">' +
            '<button class="btn-icon btn-edit" onclick="openClientEdit(' + cl.id + ')" title="تعديل"><i data-lucide="pencil"></i></button>' +
            '<button class="btn-icon btn-del" onclick="confirmDeleteClient(' + cl.id + ')" title="حذف"><i data-lucide="trash-2"></i></button>' +
            '</td></tr>';
    }
    body.innerHTML = html;
}

/* ═══════════════════════════════════════
   CRUD العملاء
═══════════════════════════════════════ */

function openClientDialog() {
    document.getElementById('clientModalTitle').textContent = 'إضافة عميل';
    document.getElementById('clientEditId').value = '';
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientAddress').value = '';
    document.getElementById('clientNotes').value = '';
    showModal('clientModal');
}

function submitClient(e) {
    e.preventDefault();
    var editId = document.getElementById('clientEditId').value;
    var name = document.getElementById('clientName').value.trim();
    var phone = document.getElementById('clientPhone').value.trim();
    var address = document.getElementById('clientAddress').value.trim();
    var notes = document.getElementById('clientNotes').value.trim();

    if (!name) {
        toast('يرجى إدخال اسم العميل', 'error');
        return;
    }

    var clients = getClients();

    if (editId) {
        var cl = null;
        for (var i = 0; i < clients.length; i++) {
            if (safeNum(clients[i].id) === safeNum(editId)) { cl = clients[i]; break; }
        }
        if (cl) {
            cl.name = String(name);
            cl.phone = String(phone);
            cl.address = String(address);
            cl.notes = String(notes);
        }
        toast('تم تعديل بيانات العميل', 'success');
    } else {
        clients.push({
            id: nextClientId++,
            name: String(name),
            phone: String(phone),
            address: String(address),
            notes: String(notes),
            services: [],
            payments: []
        });
        toast('تم إضافة العميل بنجاح', 'success');
    }

    logActivity(editId ? 'تعديل عميل' : 'إضافة عميل', name);
    setClients(clients);
    refreshApplicationState();
    closeAllModals();

    if (ticketContext) {
        ticketContext = false;
        var newId = clients[clients.length - 1].id;
        populateCustomerSelect();
        var sel = document.getElementById('tktClientSelect');
        if (sel) sel.value = newId;
        onTicketClientChange();
        showModal('ticketModal');
        toast('تم إضافة العميل — اكمل بيانات التذكرة', 'success');
    } else {
        toast(editId ? 'تم تعديل بيانات العميل' : 'تم إضافة العميل بنجاح', 'success');
    }
}

function openClientEdit(id) {
    var clients = getClients();
    var cl = null;
    for (var i = 0; i < clients.length; i++) {
        if (safeNum(clients[i].id) === safeNum(id)) { cl = clients[i]; break; }
    }
    if (!cl) return;

    document.getElementById('clientModalTitle').textContent = 'تعديل العميل';
    document.getElementById('clientEditId').value = cl.id;
    document.getElementById('clientName').value = cl.name || '';
    document.getElementById('clientPhone').value = cl.phone || '';
    document.getElementById('clientAddress').value = cl.address || '';
    document.getElementById('clientNotes').value = cl.notes || '';
    showModal('clientModal');
}

function confirmDeleteClient(id) {
    showConfirm('سيتم نقل هذا السجل إلى سلة المحذوفات ويمكن استرجاعه خلال 24 ساعة.', function(ok) {
        if (!ok) return;
        var clients = getClients();
        var item = null;
        for (var i = 0; i < clients.length; i++) {
            if (safeNum(clients[i].id) === safeNum(id)) { item = clients[i]; break; }
        }
        if (!item) return;
        moveToTrash('client', JSON.parse(JSON.stringify(item)), item.name || 'عميل #' + item.id);
        setClients(clients.filter(function(c) { return safeNum(c.id) !== safeNum(id); }));
        logActivity('حذف عميل', item.name || 'عميل #' + id);
        if (currentClientId === safeNum(id)) currentClientId = null;
        refreshApplicationState();
        toast('تم النقل إلى سلة المحذوفات', 'success');
    });
}

/* ═══════════════════════════════════════
   صفحة تفاصيل العميل
═══════════════════════════════════════ */

function showClientDetail(id) {
    currentClientId = safeNum(id);
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('page-client-detail').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    document.querySelector('[data-page="clients"]').classList.add('active');
    closeSidebar();
    renderClientDetail();
}

function renderClientDetail() {
    if (!currentClientId) return;
    var clients = getClients();
    var cl = null;
    for (var i = 0; i < clients.length; i++) {
        if (safeNum(clients[i].id) === currentClientId) { cl = clients[i]; break; }
    }
    if (!cl) { showPage('clients'); return; }

    document.getElementById('detailClientName').textContent = cl.name || '—';
    document.getElementById('detailClientSub').textContent = (cl.phone || '') + (cl.address ? ' — ' + cl.address : '');

    var infoHtml = '';
    infoHtml += '<div class="info-item"><span class="info-label">الاسم</span><span class="info-value">' + (cl.name || '—') + '</span></div>';
    infoHtml += '<div class="info-item"><span class="info-label">الهاتف</span><span class="info-value">' + (cl.phone || '—') + '</span></div>';
    infoHtml += '<div class="info-item"><span class="info-label">العنوان</span><span class="info-value">' + (cl.address || '—') + '</span></div>';
    infoHtml += '<div class="info-item"><span class="info-label">ملاحظات</span><span class="info-value">' + (cl.notes || '—') + '</span></div>';
    document.getElementById('clientInfoCard').innerHTML = infoHtml;

    var st = getClientStats(cl);
    var debtSt = getClientDebtStats(cl);
    var ticketInfo = getClientTicketStats(cl);
    var remClass = st.remaining > 0 ? 'kpi-orange' : 'kpi-green';
    var remIcon = st.remaining > 0 ? '<i data-lucide="clock"></i>' : '<i data-lucide="circle-check-big"></i>';
    document.getElementById('clientDetailKpis').innerHTML =
        '<div class="kpi kpi-blue"><div class="kpi-icon"><i data-lucide="plane"></i></div><div class="kpi-body"><span class="kpi-label">التذاكر</span><span class="kpi-value">' + ticketInfo.count + '</span></div></div>' +
        '<div class="kpi kpi-emerald"><div class="kpi-icon"><i data-lucide="banknote"></i></div><div class="kpi-body"><span class="kpi-label">أرباح التذاكر</span><span class="kpi-value">' + fmt(ticketInfo.totalProfit) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-blue"><div class="kpi-icon"><i data-lucide="notebook-pen"></i></div><div class="kpi-body"><span class="kpi-label">الخدمات</span><span class="kpi-value">' + fmt(st.totalServices) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-green"><div class="kpi-icon"><i data-lucide="circle-check-big"></i></div><div class="kpi-body"><span class="kpi-label">المدفوع</span><span class="kpi-value">' + fmt(st.totalPaid) + ' د.ع</span></div></div>' +
        '<div class="kpi ' + remClass + '"><div class="kpi-icon">' + remIcon + '</div><div class="kpi-body"><span class="kpi-label">المتبقي</span><span class="kpi-value">' + fmt(st.remaining) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-orange"><div class="kpi-icon"><i data-lucide="hand-coins"></i></div><div class="kpi-body"><span class="kpi-label">إجمالي قيمة التذاكر</span><span class="kpi-value">' + fmt(debtSt.totalSale) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-green"><div class="kpi-icon"><i data-lucide="banknote"></i></div><div class="kpi-body"><span class="kpi-label">المدفوع من التذاكر</span><span class="kpi-value">' + fmt(debtSt.totalPaid) + ' د.ع</span></div></div>' +
        '<div class="kpi kpi-red"><div class="kpi-icon"><i data-lucide="clock"></i></div><div class="kpi-body"><span class="kpi-label">الديون على التذاكر</span><span class="kpi-value">' + fmt(debtSt.totalRemaining) + ' د.ع</span></div></div>';

    renderClientTickets(cl);
    renderServices(cl);
}

function getClientTicketStats(cl) {
    var txs = getTransactions();
    var count = 0, totalProfit = 0, totalBase = 0, totalSale = 0;
    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        if (tx.type === 'ticket' && safeNum(tx.clientId) === safeNum(cl.id)) {
            count++;
            totalProfit += safeNum(tx.profit);
            totalBase += safeNum(tx.basePrice);
            totalSale += safeNum(tx.salePrice);
        }
    }
    return { count: count, totalProfit: totalProfit, totalBase: totalBase, totalSale: totalSale };
}

function renderClientTickets(cl) {
    var body = document.getElementById('clientTicketBody');
    var empty = document.getElementById('clientTicketEmptyMsg');
    if (!body) return;

    var txs = getTransactions();
    var tickets = [];
    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        if (tx.type === 'ticket' && safeNum(tx.clientId) === safeNum(cl.id)) {
            tickets.push(tx);
        }
    }

    if (tickets.length === 0) {
        body.innerHTML = '';
        if (empty) empty.style.display = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    tickets.sort(function(a, b) {
        var da = String(a.date || '');
        var db2 = String(b.date || '');
        if (da !== db2) return db2.localeCompare(da);
        return safeNum(b.id) - safeNum(a.id);
    });

    var html = '';
    for (var j = 0; j < tickets.length; j++) {
        var t = tickets[j];
        var profit = safeNum(t.profit);
        var profitClass = profit >= 0 ? 'text-green' : 'text-red';
        var statusBadge = profit >= 0
            ? '<span class="badge badge-green">مكتملة</span>'
            : '<span class="badge badge-red">خسارة</span>';
        html += '<tr>' +
            '<td>' + (j + 1) + '</td>' +
            '<td>' + (t.date || '—') + '</td>' +
            '<td class="num">' + fmt(safeNum(t.basePrice)) + '</td>' +
            '<td class="num">' + fmt(safeNum(t.salePrice)) + '</td>' +
            '<td class="num ' + profitClass + '">' + fmt(profit) + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td>' + (t.paymentMethod === 'debt' ? '<span class="badge badge-orange">دين</span>' : '<span class="badge badge-green">نقداً</span>') + '</td>' +
            '<td class="num">' + fmt(safeNum(t.amountPaid)) + '</td>' +
            '<td class="num ' + (safeNum(t.remainingAmount) > 0 ? 'text-red' : '') + '">' + fmt(safeNum(t.remainingAmount)) + '</td>' +
            '<td>' + (t.notes || '—') + '</td>' +
            '<td class="actions-cell">' +
            (safeNum(t.remainingAmount) > 0 ? '<button class="btn btn-sm btn-orange" onclick="recordDebtPayment(' + t.id + ')" style="margin-left:4px">تسجيل دفعة</button>' : '') +
            '<button class="btn-icon btn-edit" onclick="openEdit(' + t.id + ')" title="تعديل"><i data-lucide="pencil"></i></button>' +
            '<button class="btn-icon btn-del" onclick="confirmDelete(' + t.id + ')" title="حذف"><i data-lucide="trash-2"></i></button>' +
            '</td></tr>';
    }
    body.innerHTML = html;
}

/* ═══════════════════════════════════════
   الخدمات
═══════════════════════════════════════ */

function renderServices(cl) {
    var body = document.getElementById('serviceBody');
    var empty = document.getElementById('serviceEmptyMsg');
    if (!body) return;
    var svcs = cl.services || [];

    if (svcs.length === 0) {
        body.innerHTML = '';
        if (empty) empty.style.display = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    var sorted = svcs.slice().sort(function(a, b) {
        var da = String(a.date || '');
        var db2 = String(b.date || '');
        if (da !== db2) return db2.localeCompare(da);
        return safeNum(b.id) - safeNum(a.id);
    });

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
        var s = sorted[i];
        var methodLabel = 'نقداً';
        var methodBadge = '<span class="badge badge-green">نقداً</span>';
        html += '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + (s.date || '—') + '</td>' +
            '<td>' + (s.description || '—') + '</td>' +
            '<td class="num">' + fmt(safeNum(s.amount)) + '</td>' +
            '<td>' + methodBadge + '</td>' +
            '<td class="actions-cell">' +
            '<button class="btn-icon btn-edit" onclick="openServiceEdit(' + s.id + ')" title="تعديل"><i data-lucide="pencil"></i></button>' +
            '<button class="btn-icon btn-del" onclick="confirmDeleteService(' + s.id + ')" title="حذف"><i data-lucide="trash-2"></i></button>' +
            '</td></tr>';
    }
    body.innerHTML = html;
}

/* ═══════════════════════════════════════
   تسجيل دفعة دين
═══════════════════════════════════════ */
function recordDebtPayment(txId) {
    document.getElementById('debtPayTxId').value = txId;
    document.getElementById('debtPayAmount').value = '';
    setTodayDate('debtPayDate');
    document.getElementById('debtPayNotes').value = '';
    var txs = getTransactions();
    var tx = null;
    for (var i = 0; i < txs.length; i++) {
        if (safeNum(txs[i].id) === safeNum(txId)) { tx = txs[i]; break; }
    }
    if (tx) {
        document.getElementById('debtPayRemaining').textContent = fmt(safeNum(tx.remainingAmount)) + ' د.ع';
        document.getElementById('debtPayAmount').max = tx.remainingAmount;
    }
    showModal('debtPayModal');
}

function submitDebtPayment(e) {
    e.preventDefault();
    var txId = safeNum(document.getElementById('debtPayTxId').value);
    var amount = safeNum(document.getElementById('debtPayAmount').value);
    var date = document.getElementById('debtPayDate').value;
    var notes = document.getElementById('debtPayNotes').value.trim();

    if (amount <= 0 || !date) {
        toast('يرجى إدخال مبلغ وتاريخ صحيحين', 'error');
        return;
    }

    var txs = getTransactions();
    var tx = null;
    for (var i = 0; i < txs.length; i++) {
        if (safeNum(txs[i].id) === txId) { tx = txs[i]; break; }
    }
    if (!tx) return;

    if (amount > safeNum(tx.remainingAmount)) {
        toast('المبلغ أكبر من المتبقي', 'error');
        return;
    }

    if (!tx.debtPayments) tx.debtPayments = [];
    tx.debtPayments.push({ date: String(date), amount: amount, notes: String(notes) });

    tx.amountPaid = safeNum(tx.amountPaid) + amount;
    tx.remainingAmount = Math.max(0, safeNum(tx.salePrice) - safeNum(tx.amountPaid));

    logActivity('تسجيل دفعة دين', 'مبلغ: ' + fmt(amount) + ' د.ع — #' + txId);
    refreshApplicationState();
    closeAllModals();
    if (tx.remainingAmount <= 0) {
        toast('تم سداد الدين بالكامل', 'success');
    } else {
        toast('تم تسجيل الدفعة — المتبقي: ' + fmt(tx.remainingAmount) + ' د.ع', 'success');
    }
}

function openServiceDialog() {
    if (!currentClientId) return;
    document.getElementById('serviceModalTitle').textContent = 'إضافة خدمة';
    document.getElementById('serviceEditId').value = '';
    setTodayDate('serviceDate');
    document.getElementById('serviceDesc').value = '';
    document.getElementById('serviceAmount').value = '';
    document.getElementById('servicePaymentMethod').value = 'cash';
    showModal('clientServiceModal');
}

function submitService(e) {
    e.preventDefault();
    if (!currentClientId) return;
    var editId = document.getElementById('serviceEditId').value;
    var date = document.getElementById('serviceDate').value;
    var desc = document.getElementById('serviceDesc').value.trim();
    var amount = safeNum(document.getElementById('serviceAmount').value);
    var paymentMethod = document.getElementById('servicePaymentMethod').value;

    if (!date || !desc || amount <= 0) {
        toast('يرجى إدخال البيانات بشكل صحيح', 'error');
        return;
    }

    var clients = getClients();
    var cl = null;
    for (var i = 0; i < clients.length; i++) {
        if (safeNum(clients[i].id) === currentClientId) { cl = clients[i]; break; }
    }
    if (!cl) return;

    var svcData = {
        date: String(date),
        description: String(desc),
        amount: amount,
        paymentMethod: paymentMethod
    };

    if (editId) {
        var svc = null;
        for (var j = 0; j < cl.services.length; j++) {
            if (safeNum(cl.services[j].id) === safeNum(editId)) { svc = cl.services[j]; break; }
        }
        if (svc) {
            svc.date = svcData.date;
            svc.description = svcData.description;
            svc.amount = svcData.amount;
            svc.paymentMethod = svcData.paymentMethod;
        }
        toast('تم تعديل الخدمة', 'success');
    } else {
        var maxSvcId = 0;
        for (var k = 0; k < cl.services.length; k++) {
            var sid = safeNum(cl.services[k].id);
            if (sid > maxSvcId) maxSvcId = sid;
        }
        svcData.id = maxSvcId + 1;
        cl.services.push(svcData);
        toast('تم إضافة الخدمة بنجاح', 'success');
    }

    setClients(clients);
    logActivity(editId ? 'تعديل خدمة' : 'إضافة خدمة', desc);
    refreshApplicationState();
    closeAllModals();
}

function openServiceEdit(svcId) {
    if (!currentClientId) return;
    var clients = getClients();
    var cl = null;
    for (var i = 0; i < clients.length; i++) {
        if (safeNum(clients[i].id) === currentClientId) { cl = clients[i]; break; }
    }
    if (!cl) return;

    var svc = null;
    for (var j = 0; j < cl.services.length; j++) {
        if (safeNum(cl.services[j].id) === safeNum(svcId)) { svc = cl.services[j]; break; }
    }
    if (!svc) return;

    document.getElementById('serviceModalTitle').textContent = 'تعديل الخدمة';
    document.getElementById('serviceEditId').value = svc.id;
    document.getElementById('serviceDate').value = svc.date || '';
    document.getElementById('serviceDesc').value = svc.description || '';
    document.getElementById('serviceAmount').value = safeNum(svc.amount);
    document.getElementById('servicePaymentMethod').value = svc.paymentMethod || 'cash';

    showModal('clientServiceModal');
}

function confirmDeleteService(svcId) {
    showConfirm('سيتم نقل هذا السجل إلى سلة المحذوفات ويمكن استرجاعه خلال 24 ساعة.', function(ok) {
        if (!ok || !currentClientId) return;
        var clients = getClients();
        var cl = null;
        for (var i = 0; i < clients.length; i++) {
            if (safeNum(clients[i].id) === currentClientId) { cl = clients[i]; break; }
        }
        if (!cl) return;
        var svc = null;
        for (var j = 0; j < cl.services.length; j++) {
            if (safeNum(cl.services[j].id) === safeNum(svcId)) { svc = cl.services[j]; break; }
        }
        if (!svc) return;
        var svcCopy = JSON.parse(JSON.stringify(svc));
        svcCopy._clientId = currentClientId;
        svcCopy._clientName = cl.name || '';
        moveToTrash('service', svcCopy, svc.description || 'خدمة #' + svc.id);
        cl.services = cl.services.filter(function(s) { return safeNum(s.id) !== safeNum(svcId); });
        setClients(clients);
        logActivity('حذف خدمة', svc.description || 'خدمة #' + svcId);
        refreshApplicationState();
        toast('تم النقل إلى سلة المحذوفات', 'success');
    });
}

/* ═══════════════════════════════════════
   سلة المحذوفات — نقل واسترجاع وحذف نهائي
═══════════════════════════════════════ */

function moveToTrash(type, data, displayName) {
    var items = getDeletedItems();
    var maxId = 0;
    for (var i = 0; i < items.length; i++) {
        if (safeNum(items[i].id) > maxId) maxId = safeNum(items[i].id);
    }
    items.push({
        id: maxId + 1,
        type: type,
        data: data,
        displayName: displayName || '',
        deletedAt: Date.now()
    });
    setDeletedItems(items);
}

function restoreFromTrash(id) {
    var items = getDeletedItems();
    var item = null;
    for (var i = 0; i < items.length; i++) {
        if (safeNum(items[i].id) === safeNum(id)) { item = items[i]; break; }
    }
    if (!item) return;

    if (item.type === 'transaction') {
        var txs = getTransactions();
        txs.push(item.data);
        setTransactions(txs);
        recalculateAll();
    } else if (item.type === 'expense') {
        var exps = getExpenses();
        exps.push(item.data);
        setExpenses(exps);
    } else if (item.type === 'client') {
        var clients = getClients();
        clients.push(item.data);
        setClients(clients);
    } else if (item.type === 'service') {
        var clients2 = getClients();
        var clientId = item.data._clientId;
        var cl = null;
        for (var j = 0; j < clients2.length; j++) {
            if (safeNum(clients2[j].id) === safeNum(clientId)) { cl = clients2[j]; break; }
        }
        if (cl) {
            if (!Array.isArray(cl.services)) cl.services = [];
            var svcData = JSON.parse(JSON.stringify(item.data));
            delete svcData._clientId;
            delete svcData._clientName;
            cl.services.push(svcData);
            setClients(clients2);
        }
    } else if (item.type === 'manualDebt') {
        var debts = getManualDebts();
        debts.push(item.data);
        setManualDebts(debts);
    } else if (item.type === 'installmentContract') {
        var contracts = getInstallmentContracts();
        contracts.push(item.data);
        setInstallmentContracts(contracts);
    }

    setDeletedItems(items.filter(function(d) { return safeNum(d.id) !== safeNum(id); }));
    logActivity('استرجاع سجل', getTrashTypeLabel(item.type) + ' — ' + (item.displayName || ''));
    refreshApplicationState();
    toast('تم استرجاع السجل بنجاح', 'success');
}

function permanentDeleteItem(id) {
    var items = getDeletedItems();
    setDeletedItems(items.filter(function(d) { return safeNum(d.id) !== safeNum(id); }));
    saveDB();
    renderTrash();
    logActivity('حذف نهائي', 'سجل من سلة المحذوفات #' + id);
    toast('تم الحذف النهائي', 'success');
}

function cleanExpiredTrash() {
    var items = getDeletedItems();
    var now = Date.now();
    var cleaned = 0;
    var remaining = [];
    for (var i = 0; i < items.length; i++) {
        if ((now - items[i].deletedAt) >= TRASH_RETENTION_MS) {
            cleaned++;
        } else {
            remaining.push(items[i]);
        }
    }
    if (cleaned === 0) {
        toast('لا توجد سجلات منتهية الصلاحية', 'info');
        return;
    }
    setDeletedItems(remaining);
    saveDB();
    renderTrash();
    toast('تم تنظيف ' + cleaned + ' سجل(ات) منتهية', 'success');
}

function isTrashExpired(deletedAt) {
    return (Date.now() - deletedAt) >= TRASH_RETENTION_MS;
}

function formatTimeRemaining(deletedAt) {
    var remaining = TRASH_RETENTION_MS - (Date.now() - deletedAt);
    if (remaining <= 0) return 'انتهت مدة الاسترجاع';
    var hours = Math.floor(remaining / (1000 * 60 * 60));
    var minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return hours + ' ساعة و' + minutes + ' دقيقة';
    return minutes + ' دقيقة';
}

function getTrashTypeLabel(type) {
    if (type === 'transaction') return 'عملية';
    if (type === 'expense') return 'مصروف';
    if (type === 'client') return 'عميل';
    if (type === 'service') return 'خدمة';
    if (type === 'manualDebt') return 'دين يدوي';
    if (type === 'installmentContract') return 'عقد قسط';
    return type;
}

function renderTrash() {
    var body = document.getElementById('trashBody');
    var empty = document.getElementById('trashEmpty');
    var tableWrap = document.getElementById('trashTableWrap');
    if (!body) return;
    var items = getDeletedItems();
    if (items.length === 0) {
        body.innerHTML = '';
        if (empty) empty.style.display = '';
        if (tableWrap) tableWrap.style.display = 'none';
        return;
    }
    if (empty) empty.style.display = 'none';
    if (tableWrap) tableWrap.style.display = '';
    var html = '';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var expired = isTrashExpired(item.deletedAt);
        var d = new Date(item.deletedAt);
        var dateStr = d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
        var typeLabel = getTrashTypeLabel(item.type);
        html += '<tr>';
        html += '<td><span class="trash-type-badge">' + typeLabel + '</span></td>';
        html += '<td>' + (item.displayName || '-') + '</td>';
        html += '<td>' + dateStr + '</td>';
        html += '<td class="' + (expired ? 'text-red' : 'text-green') + '">' + formatTimeRemaining(item.deletedAt) + '</td>';
        html += '<td>';
        if (expired) {
            html += '<button class="btn btn-sm btn-danger" onclick="confirmPermanentDelete(' + item.id + ')">حذف نهائي</button>';
        } else {
            html += '<button class="btn btn-sm btn-green" onclick="restoreFromTrash(' + item.id + ')">استرجاع</button>';
        }
        html += '</td>';
        html += '</tr>';
    }
    body.innerHTML = html;
}

function confirmPermanentDelete(id) {
    showConfirm('هل أنت متأكد من الحذف النهائي؟ لا يمكن استرجاع السجل بعد الحذف.', function(ok) {
        if (!ok) return;
        permanentDeleteItem(id);
    });
}

/* ═══════════════════════════════════════
   الديون والأقساط
═══════════════════════════════════════ */

function getManualDebtStats() {
    var debts = getManualDebts();
    var totalDebt = 0, totalPaid = 0, totalRemaining = 0, debtorCount = 0;
    for (var i = 0; i < debts.length; i++) {
        var d = debts[i];
        totalDebt += safeNum(d.totalAmount);
        totalPaid += safeNum(d.amountPaid);
        totalRemaining += safeNum(d.remaining);
        if (safeNum(d.remaining) > 0) debtorCount++;
    }
    return {
        totalDebt: totalDebt, totalPaid: totalPaid, totalRemaining: totalRemaining,
        debtorCount: debtorCount
    };
}

function getManualDebtStatus(item) {
    return safeNum(item.remaining) <= 0 ? 'paid' : 'unpaid';
}

function calcManualDebtRemaining() {
    var total = safeNum(document.getElementById('manualDebtTotal').value);
    var paid = safeNum(document.getElementById('manualDebtPaid').value);
    document.getElementById('manualDebtRemaining').value = Math.max(0, total - paid);
}

function openManualDebtDialog() {
    document.getElementById('manualDebtEditId').value = '';
    document.getElementById('manualDebtModalTitle').textContent = 'إضافة دين جديد';
    document.getElementById('manualDebtName').value = '';
    document.getElementById('manualDebtPhone').value = '';
    setTodayDate('manualDebtDate');
    document.getElementById('manualDebtTotal').value = '';
    document.getElementById('manualDebtPaid').value = '0';
    document.getElementById('manualDebtRemaining').value = '';
    document.getElementById('manualDebtReason').value = '';
    document.getElementById('manualDebtNotes').value = '';
    showModal('manualDebtModal');
}

function openManualDebtEdit(id) {
    var debts = getManualDebts();
    var item = null;
    for (var i = 0; i < debts.length; i++) {
        if (safeNum(debts[i].id) === safeNum(id)) { item = debts[i]; break; }
    }
    if (!item) return;
    document.getElementById('manualDebtEditId').value = item.id;
    document.getElementById('manualDebtModalTitle').textContent = 'تعديل الدين';
    document.getElementById('manualDebtName').value = item.name || '';
    document.getElementById('manualDebtPhone').value = item.phone || '';
    document.getElementById('manualDebtDate').value = item.date || '';
    document.getElementById('manualDebtTotal').value = safeNum(item.totalAmount);
    document.getElementById('manualDebtPaid').value = safeNum(item.amountPaid);
    document.getElementById('manualDebtRemaining').value = safeNum(item.remaining);
    document.getElementById('manualDebtReason').value = item.reason || '';
    document.getElementById('manualDebtNotes').value = item.notes || '';
    showModal('manualDebtModal');
}

function saveManualDebt(e) {
    e.preventDefault();
    var editId = document.getElementById('manualDebtEditId').value;
    var name = document.getElementById('manualDebtName').value.trim();
    var phone = document.getElementById('manualDebtPhone').value.trim();
    var date = document.getElementById('manualDebtDate').value;
    var total = safeNum(document.getElementById('manualDebtTotal').value);
    var paid = safeNum(document.getElementById('manualDebtPaid').value);
    var reason = document.getElementById('manualDebtReason').value.trim();
    var notes = document.getElementById('manualDebtNotes').value.trim();

    if (!name || !date || total <= 0) { toast('يرجى ملء جميع الحقول المطلوبة', 'error'); return; }
    if (paid > total) { toast('المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي', 'error'); return; }

    var remaining = Math.max(0, total - paid);
    var debts = getManualDebts();

    if (editId) {
        for (var i = 0; i < debts.length; i++) {
            if (safeNum(debts[i].id) === safeNum(editId)) {
                debts[i].name = name; debts[i].phone = phone; debts[i].date = date;
                debts[i].totalAmount = total; debts[i].amountPaid = paid;
                debts[i].remaining = remaining; debts[i].reason = reason;
                debts[i].notes = notes; break;
            }
        }
        toast('تم تعديل الدين بنجاح', 'success');
    } else {
        var maxId = 0;
        for (var j = 0; j < debts.length; j++) { if (safeNum(debts[j].id) > maxId) maxId = safeNum(debts[j].id); }
        debts.push({ id: maxId + 1, name: name, phone: phone, date: date,
            totalAmount: total, amountPaid: paid, remaining: remaining,
            reason: reason, notes: notes, payments: [] });
        toast('تم إضافة الدين بنجاح', 'success');
    }

    setManualDebts(debts);
    closeAllModals();
    refreshApplicationState();
}

/* ═══════════════════════════════════════
   الحذف
═══════════════════════════════════════ */

function confirmDeleteManualDebt(id) {
    showConfirm('سيتم نقل هذا الدين إلى سلة المحذوفات ويمكن استرجاعه خلال 24 ساعة.', function(ok) {
        if (!ok) return;
        var debts = getManualDebts();
        var item = null;
        for (var i = 0; i < debts.length; i++) {
            if (safeNum(debts[i].id) === safeNum(id)) { item = debts[i]; break; }
        }
        if (!item) return;
        moveToTrash('manualDebt', JSON.parse(JSON.stringify(item)), item.name || 'دين #' + item.id);
        setManualDebts(debts.filter(function(d) { return safeNum(d.id) !== safeNum(id); }));
        logActivity('حذف دين', item.name || 'دين #' + id);
        refreshApplicationState();
        toast('تم النقل إلى سلة المحذوفات', 'success');
    });
}

function recordManualDebtPayment(id) {
    document.getElementById('manualDebtPayId').value = id;
    document.getElementById('manualDebtPayAmount').value = '';
    setTodayDate('manualDebtPayDate');
    document.getElementById('manualDebtPayNotes').value = '';
    var debts = getManualDebts();
    var item = null;
    for (var i = 0; i < debts.length; i++) {
        if (safeNum(debts[i].id) === safeNum(id)) { item = debts[i]; break; }
    }
    if (!item) return;
    document.getElementById('manualDebtPayRemaining').textContent = fmt(safeNum(item.remaining)) + ' د.ع';
    showModal('manualDebtPayModal');
}

function submitManualDebtPayment(e) {
    e.preventDefault();
    var id = safeNum(document.getElementById('manualDebtPayId').value);
    var amount = safeNum(document.getElementById('manualDebtPayAmount').value);
    var date = document.getElementById('manualDebtPayDate').value;
    var notes = document.getElementById('manualDebtPayNotes').value.trim();
    if (amount <= 0 || !date) { toast('يرجى إدخال مبلغ وتاريخ صحيحين', 'error'); return; }
    var debts = getManualDebts();
    var item = null;
    for (var i = 0; i < debts.length; i++) {
        if (safeNum(debts[i].id) === id) { item = debts[i]; break; }
    }
    if (!item) return;
    if (amount > safeNum(item.remaining)) { toast('المبلغ أكبر من المتبقي', 'error'); return; }
    if (!item.payments) item.payments = [];
    item.payments.push({ date: String(date), amount: amount, notes: String(notes) });
    item.amountPaid = safeNum(item.amountPaid) + amount;
    item.remaining = Math.max(0, safeNum(item.totalAmount) - safeNum(item.amountPaid));
    setManualDebts(debts);
    closeAllModals();
    refreshApplicationState();
    toast('تم تسجيل الدفعة بنجاح', 'success');
}

function showDebtDetail(id) {
    var debts = getManualDebts();
    var item = null;
    for (var i = 0; i < debts.length; i++) {
        if (safeNum(debts[i].id) === safeNum(id)) { item = debts[i]; break; }
    }
    if (!item) return;
    var st = getManualDebtStatus(item);
    var stText = st === 'paid' ? 'مسدد' : 'غير مسددة';
    var stColor = st === 'paid' ? '#1A6B4E' : '#1565C0';
    var html = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">';
    html += '<div class="detail-info-card" style="flex:1;min-width:150px"><span class="info-label">اسم العميل</span><span class="info-value">' + (item.name || '—') + '</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:150px"><span class="info-label">رقم الهاتف</span><span class="info-value">' + (item.phone || '—') + '</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:150px"><span class="info-label">الحالة</span><span class="info-value" style="color:' + stColor + ';font-weight:700">' + stText + '</span></div>';
    html += '</div>';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">';
    html += '<div class="detail-info-card" style="flex:1;min-width:120px"><span class="info-label">إجمالي المبلغ</span><span class="info-value">' + fmt(safeNum(item.totalAmount)) + ' د.ع</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:120px"><span class="info-label">المدفوع</span><span class="info-value" style="color:#1A6B4E">' + fmt(safeNum(item.amountPaid)) + ' د.ع</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:120px"><span class="info-label">المتبقي</span><span class="info-value" style="color:#C62828">' + fmt(safeNum(item.remaining)) + ' د.ع</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:120px"><span class="info-label">السبب</span><span class="info-value">' + (item.reason || '—') + '</span></div>';
    html += '</div>';
    if (item.payments && item.payments.length > 0) {
        html += '<div style="margin-top:16px"><h4 style="margin-bottom:8px"><i data-lucide="history" style="width:18px;height:18px;vertical-align:middle"></i> سجل الدفعات</h4>';
        html += '<table class="table"><thead><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th></tr></thead><tbody>';
        for (var p = 0; p < item.payments.length; p++) {
            var pay = item.payments[p];
            html += '<tr><td>' + pay.date + '</td><td>' + fmt(safeNum(pay.amount)) + '</td><td>' + (pay.notes || '—') + '</td></tr>';
        }
        html += '</tbody></table></div>';
    }
    document.getElementById('debtDetailTitle').textContent = 'تفاصيل — ' + (item.name || '');
    document.getElementById('debtDetailBody').innerHTML = html;
    showModal('debtDetailModal');
}

function renderManualDebts() {
    var body = document.getElementById('manualDebtBody');
    var empty = document.getElementById('manualDebtEmpty');
    var tableWrap = document.getElementById('manualDebtTableWrap');
    if (!body) return;
    var stats = getManualDebtStats();
    var el1 = document.getElementById('manualDebtTotalStat');
    var el2 = document.getElementById('manualDebtPaidStat');
    var el3 = document.getElementById('manualDebtRemainingStat');
    var el4 = document.getElementById('manualDebtCountStat');
    if (el1) el1.textContent = fmt(stats.totalDebt) + ' د.ع';
    if (el2) el2.textContent = fmt(stats.totalPaid) + ' د.ع';
    if (el3) el3.textContent = fmt(stats.totalRemaining) + ' د.ع';
    if (el4) el4.textContent = stats.debtorCount;
    var debts = getManualDebts();
    var search = (document.getElementById('manualDebtSearch') || {}).value || '';
    var filter = (document.getElementById('manualDebtFilter') || {}).value || 'all';
    var filtered = [];
    for (var i = 0; i < debts.length; i++) {
        var d = debts[i];
        var matchSearch = !search || (d.name || '').indexOf(search) !== -1 || (d.phone || '').indexOf(search) !== -1 || (d.reason || '').indexOf(search) !== -1;
        var st = getManualDebtStatus(d);
        var matchFilter = filter === 'all' || (filter === 'paid' && st === 'paid') || (filter === 'unpaid' && st === 'unpaid');
        if (matchSearch && matchFilter) filtered.push(d);
    }
    var resultsEl = document.getElementById('manualDebtResults');
    if (resultsEl) resultsEl.textContent = filtered.length + ' سجل';
    if (filtered.length === 0) { body.innerHTML = ''; if (empty) empty.style.display = ''; if (tableWrap) tableWrap.style.display = 'none'; return; }
    if (empty) empty.style.display = 'none';
    if (tableWrap) tableWrap.style.display = '';
    var html = '';
    for (var j = 0; j < filtered.length; j++) {
        var item = filtered[j];
        var st2 = getManualDebtStatus(item);
        var displayName = item.name || '-';
        var truncName = displayName.length > 22 ? displayName.substring(0, 22) + '…' : displayName;
        var statusHtml = st2 === 'paid'
            ? '<span class="debt-badge debt-badge-paid"><i data-lucide="circle-check-big"></i> مسدد</span>'
            : '<span class="debt-badge debt-badge-unpaid"><i data-lucide="clock"></i> غير مسددة</span>';
        html += '<tr>';
        html += '<td class="debt-col-name"><strong class="debt-truncate" title="' + displayName + '" style="cursor:pointer;text-decoration:underline" onclick="showDebtDetail(' + item.id + ')">' + truncName + '</strong><span class="debt-phone">' + (item.phone || '') + '</span></td>';
        html += '<td class="debt-col-amount">' + fmt(item.totalAmount) + '</td>';
        html += '<td class="debt-col-amount">' + fmt(item.amountPaid) + '</td>';
        html += '<td class="debt-col-amount">' + fmt(item.remaining) + '</td>';
        html += '<td class="debt-col-date">' + (item.date || '—') + '</td>';
        html += '<td class="debt-col-status">' + statusHtml + '</td>';
        html += '<td class="debt-col-actions"><div class="debt-actions">';
        html += '<button class="btn-sm btn-edit" onclick="openManualDebtEdit(' + item.id + ')" title="تعديل"><i data-lucide="pencil"></i></button>';
        if (st2 !== 'paid') html += '<button class="btn-sm btn-green" onclick="recordManualDebtPayment(' + item.id + ')">تسجيل دفعة</button>';
        else html += '<button class="btn-sm btn-green-disabled"><i data-lucide="circle-check-big"></i> تم السداد</button>';
        html += '<button class="btn-sm btn-del" onclick="confirmDeleteManualDebt(' + item.id + ')" title="حذف"><i data-lucide="trash-2"></i></button>';
        html += '</div></td></tr>';
    }
    body.innerHTML = html;
}

function exportManualDebtsExcel() {
    var debts = getManualDebts();
    if (debts.length === 0) { toast('لا توجد بيانات للتصدير', 'warning'); return; }
    var headers = ['#', 'اسم العميل', 'الهاتف', 'التاريخ', 'إجمالي المبلغ', 'المدفوع', 'المتبقي', 'السبب', 'الحالة'];
    var data = [];
    var totalDebt = 0, totalPaid = 0, totalRemaining = 0;
    var paidCount = 0, unpaidCount = 0;
    for (var i = 0; i < debts.length; i++) {
        var d = debts[i];
        var st = getManualDebtStatus(d);
        var stLabel = st === 'paid' ? 'مسدد' : 'غير مسددة';
        var amt = safeNum(d.totalAmount); var paid2 = safeNum(d.amountPaid); var rem = safeNum(d.remaining);
        totalDebt += amt; totalPaid += paid2; totalRemaining += rem;
        if (st === 'paid') paidCount++; else unpaidCount++;
        data.push([i + 1, d.name || '—', d.phone || '—', d.date || '—', xlFormatNum(amt), xlFormatNum(paid2), xlFormatNum(rem), d.reason || '—', stLabel]);
    }
    var cards = [
        { label: 'إجمالي الديون', value: totalDebt, isCurrency: true, bgColor: 'FFEBEE', valueColor: 'C62828' },
        { label: 'المبلغ المحصل', value: totalPaid, isCurrency: true, bgColor: 'E8F5E9', valueColor: '1A6B4E' },
        { label: 'المبلغ المتبقي', value: totalRemaining, isCurrency: true, bgColor: 'FFF3E0', valueColor: 'E65100' },
        { label: 'عدد المسددين', value: paidCount, bgColor: 'E0F2F1', valueColor: '00695C' },
        { label: 'عدد غير المسددين', value: unpaidCount, bgColor: 'E3F2FD', valueColor: '1565C0' }
    ];
    var summaryItems = [
        { label: 'إجمالي الديون', value: xlFormatNum(totalDebt), isCurrency: false, valueColor: 'C62828' },
        { label: 'المبلغ المحصل', value: xlFormatNum(totalPaid), isCurrency: false },
        { label: 'المبلغ المتبقي', value: xlFormatNum(totalRemaining), isCurrency: false, valueColor: 'E65100' },
        { label: 'عدد السجلات', value: debts.length, isCurrency: false },
        { label: 'النسبة المحصلة', value: totalDebt > 0 ? Math.round(totalPaid / totalDebt * 100) + '%' : '0%', isCurrency: false }
    ];
    xlExport({
        title: 'تقرير الديون',
        filename: 'debts_' + todayStr() + '.xlsx',
        sheetName: 'الديون',
        numCols: 9,
        cards: cards, headers: headers, data: data, summaryItems: summaryItems,
        landscape: true, tableOptions: { colWidths: [6, 18, 14, 14, 16, 16, 16, 18, 14] }
    });
}

function printManualDebts() { window.print(); }

/* ═══════════════════════════════════════════════════
   ═══════════════════════════════════════════════════
   نظام الأقساط المستقل
   ═══════════════════════════════════════════════════
   ═══════════════════════════════════════════════════ */

function getInstallmentContracts() { return db.installmentContracts || []; }
function setInstallmentContracts(c) { db.installmentContracts = c; }

function addDaysToDate(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addMonthsToDate(dateStr, months) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() + months);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function generateInstSchedule(totalAmount, advance, count, startDate, period) {
    var remaining = Math.max(0, safeNum(totalAmount) - safeNum(advance));
    var base = safeNum(count) > 0 ? Math.trunc(remaining / safeNum(count)) : 0;
    var schedule = [];
    var curDate = startDate;
    for (var i = 0; i < safeNum(count); i++) {
        var isLast = (i === safeNum(count) - 1);
        var amount = isLast ? remaining - (base * i) : base;
        if (amount < 0) amount = 0;
        schedule.push({ number: i + 1, dueDate: curDate, amount: amount, paid: 0, status: 'unpaid', payments: [] });
        switch (period) {
            case 'weekly': curDate = addDaysToDate(curDate, 7); break;
            case 'biweekly': curDate = addDaysToDate(curDate, 14); break;
            case 'bimonthly': curDate = addMonthsToDate(curDate, 2); break;
            case 'quarterly': curDate = addMonthsToDate(curDate, 3); break;
            case 'custom': curDate = addMonthsToDate(curDate, 1); break;
            default: curDate = addMonthsToDate(curDate, 1); break;
        }
    }
    return schedule;
}

function getInstTotalPaid(c) {
    var total = safeNum(c.advance);
    if (Array.isArray(c.installments)) {
        for (var i = 0; i < c.installments.length; i++) total += safeNum(c.installments[i].paid);
    }
    if (Array.isArray(c.payments)) {
        for (var j = 0; j < c.payments.length; j++) total += safeNum(c.payments[j].amount);
    }
    return total;
}

function getInstRemaining(c) {
    return Math.max(0, safeNum(c.total) - getInstTotalPaid(c));
}

function getInstPaidCount(c) {
    var count = 0;
    if (Array.isArray(c.installments)) {
        for (var i = 0; i < c.installments.length; i++) {
            if (c.installments[i].status === 'paid') count++;
        }
    }
    return count;
}

/* ── وقت الدفع + معرّف فريد لكل دفعة (لوصل مستقل لكل دفعة) ── */
function nowTimeString() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function genPaymentId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function instTimeFromDate(dt) {
    if (!dt) return '';
    var d = new Date(dt);
    if (isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function getInstStatus(c) {
    var rem = getInstRemaining(c);
    if (rem <= 0) return 'completed';
    if (!Array.isArray(c.installments) || c.installments.length === 0) {
        return 'unpaid';
    }
    var anyOverdue = false, anyPartial = false, anyUnpaid = false;
    for (var i = 0; i < c.installments.length; i++) {
        var s = c.installments[i].status;
        if (s === 'overdue') anyOverdue = true;
        if (s === 'partial') anyPartial = true;
        if (s === 'unpaid') anyUnpaid = true;
    }
    if (anyOverdue) return 'overdue';
    if (anyPartial) return 'partial';
    if (anyUnpaid) return 'active';
    return 'active';
}

function updateInstOverdue() {
    var contracts = getInstallmentContracts();
    var today = todayStr();
    var changed = false;
    for (var i = 0; i < contracts.length; i++) {
        var c = contracts[i];
        if (!Array.isArray(c.installments)) continue;
        for (var j = 0; j < c.installments.length; j++) {
            var inst = c.installments[j];
            if ((inst.status === 'unpaid' || inst.status === 'partial') && inst.dueDate && inst.dueDate < today) {
                inst.status = 'overdue';
                changed = true;
            }
        }
    }
    if (changed) setInstallmentContracts(contracts);
}

function calcInstPreview() {
    var total = safeNum(document.getElementById('instTotal').value);
    var advance = safeNum(document.getElementById('instAdvance').value);
    var count = safeNum(document.getElementById('instCount').value);
    var remaining = Math.max(0, total - advance);
    var el = document.getElementById('instValueDisplay');
    if (count > 0 && remaining > 0) {
        var base = Math.trunc(remaining / count);
        var leftover = remaining - (base * count);
        if (leftover > 0) el.value = fmt(base) + ' د.ع (آخر قسط: ' + fmt(base + leftover) + ' د.ع)';
        else el.value = fmt(base) + ' د.ع';
    } else { el.value = ''; }
}

function openInstallmentDialog() {
    document.getElementById('instEditId').value = '';
    document.getElementById('instModalTitle').textContent = 'إضافة قسط جديد';
    document.getElementById('instName').value = '';
    document.getElementById('instPhone').value = '';
    document.getElementById('instDescription').value = '';
    document.getElementById('instTotal').value = '';
    document.getElementById('instAdvance').value = '0';
    document.getElementById('instCount').value = '1';
    document.getElementById('instValueDisplay').value = '';
    document.getElementById('instStartDate').value = todayStr();
    document.getElementById('instPeriod').value = 'monthly';
    document.getElementById('instNotes').value = '';
    showModal('installmentModal');
}

function openInstallmentEdit(id) {
    var contracts = getInstallmentContracts();
    var c = null;
    for (var i = 0; i < contracts.length; i++) {
        if (safeNum(contracts[i].id) === safeNum(id)) { c = contracts[i]; break; }
    }
    if (!c) return;
    document.getElementById('instEditId').value = c.id;
    document.getElementById('instModalTitle').textContent = 'تعديل القسط';
    document.getElementById('instName').value = c.name || '';
    document.getElementById('instPhone').value = c.phone || '';
    document.getElementById('instDescription').value = c.description || '';
    document.getElementById('instTotal').value = safeNum(c.total);
    document.getElementById('instAdvance').value = safeNum(c.advance);
    document.getElementById('instCount').value = safeNum(c.count);
    document.getElementById('instStartDate').value = c.startDate || '';
    document.getElementById('instPeriod').value = c.period || 'monthly';
    document.getElementById('instNotes').value = c.notes || '';
    calcInstPreview();
    showModal('installmentModal');
}

function saveInstallment(e) {
    e.preventDefault();
    var editId = document.getElementById('instEditId').value;
    var name = document.getElementById('instName').value.trim();
    var phone = document.getElementById('instPhone').value.trim();
    var desc = document.getElementById('instDescription').value.trim();
    var total = safeNum(document.getElementById('instTotal').value);
    var advance = safeNum(document.getElementById('instAdvance').value);
    var count = safeNum(document.getElementById('instCount').value);
    var startDate = document.getElementById('instStartDate').value;
    var period = document.getElementById('instPeriod').value;
    var notes = document.getElementById('instNotes').value.trim();

    if (!name || total <= 0 || count <= 0 || !startDate) {
        toast('يرجى ملء جميع الحقول المطلوبة', 'error'); return;
    }
    if (advance >= total) { toast('الدفعة المقدمة يجب أن تكون أقل من المبلغ الكلي', 'error'); return; }

    var remaining = Math.max(0, total - advance);
    var instValue = Math.trunc(remaining / count);
    var schedule = generateInstSchedule(total, advance, count, startDate, period);
    var contracts = getInstallmentContracts();

    if (editId) {
        for (var i = 0; i < contracts.length; i++) {
            if (safeNum(contracts[i].id) === safeNum(editId)) {
                var old = contracts[i];
                contracts[i].name = name; contracts[i].phone = phone; contracts[i].description = desc;
                contracts[i].total = total; contracts[i].advance = advance; contracts[i].count = count;
                contracts[i].instValue = instValue; contracts[i].startDate = startDate;
                contracts[i].period = period; contracts[i].notes = notes;
                var oldInsts = old.installments || [];
                for (var k = 0; k < schedule.length; k++) {
                    if (k < oldInsts.length) {
                        schedule[k].id = oldInsts[k].id;
                        if (oldInsts[k].payments && oldInsts[k].payments.length > 0) {
                            schedule[k].paid = oldInsts[k].paid;
                            schedule[k].status = oldInsts[k].status;
                            schedule[k].payments = oldInsts[k].payments;
                            var totPaid = 0;
                            for (var p = 0; p < schedule[k].payments.length; p++) totPaid += safeNum(schedule[k].payments[p].amount);
                            schedule[k].paid = totPaid;
                            if (totPaid >= schedule[k].amount) schedule[k].status = 'paid';
                            else if (totPaid > 0) schedule[k].status = 'partial';
                        }
                    }
                }
                contracts[i].installments = schedule;
                break;
            }
        }
        toast('تم تعديل القسط بنجاح', 'success');
    } else {
        var maxId = 0;
        for (var j = 0; j < contracts.length; j++) { if (safeNum(contracts[j].id) > maxId) maxId = safeNum(contracts[j].id); }
        contracts.push({
            id: maxId + 1, name: name, phone: phone, description: desc,
            total: total, advance: advance, count: count, instValue: instValue,
            startDate: startDate, period: period, notes: notes,
            installments: schedule, createdAt: dbNowISO()
        });
        toast('تم إضافة القسط بنجاح', 'success');
    }
    setInstallmentContracts(contracts);
    closeAllModals();
    refreshApplicationState();
}

function confirmDeleteInstallment(id) {
    showConfirm('سيتم نقل عقد القسط إلى سلة المحذوفات ويمكن استرجاعه خلال 24 ساعة.', function(ok) {
        if (!ok) return;
        var contracts = getInstallmentContracts();
        var item = null;
        for (var i = 0; i < contracts.length; i++) {
            if (safeNum(contracts[i].id) === safeNum(id)) { item = contracts[i]; break; }
        }
        if (!item) return;
        moveToTrash('installmentContract', JSON.parse(JSON.stringify(item)), item.name || 'قسط #' + item.id);
        setInstallmentContracts(contracts.filter(function(c) { return safeNum(c.id) !== safeNum(id); }));
        logActivity('حذف عقد قسط', item.name || 'قسط #' + id);
        refreshApplicationState();
        toast('تم النقل إلى سلة المحذوفات', 'success');
    });
}

function recordInstPayment(contractId, instIdx) {
    document.getElementById('instPayContractId').value = contractId;
    document.getElementById('instPayIdx').value = instIdx;
    setTodayDate('instPayDate');
    document.getElementById('instPayEmployee').value = getEmployeeName() || '';
    document.getElementById('instPayNotes').value = '';
    var contracts = getInstallmentContracts();
    var c = null;
    for (var i = 0; i < contracts.length; i++) {
        if (safeNum(contracts[i].id) === safeNum(contractId)) { c = contracts[i]; break; }
    }
    if (!c) return;
    var totalPaid = getInstTotalPaid(c);
    var remaining = getInstRemaining(c);
    document.getElementById('instPayTotal').textContent = fmt(safeNum(c.total)) + ' د.ع';
    document.getElementById('instPayRemaining').textContent = fmt(remaining) + ' د.ع';
    var suggested = Math.min(safeNum(c.instValue), remaining);
    document.getElementById('instPayValue').value = suggested > 0 ? suggested : '';
    showModal('instPayModal');
}

function submitInstallmentPayment(e) {
    e.preventDefault();
    var contractId = safeNum(document.getElementById('instPayContractId').value);
    var amount = safeNum(document.getElementById('instPayValue').value);
    var date = document.getElementById('instPayDate').value;
    var employee = document.getElementById('instPayEmployee').value.trim();
    var notes = document.getElementById('instPayNotes').value.trim();
    if (amount <= 0 || !date) { toast('يرجى إدخال مبلغ وتاريخ صحيحين', 'error'); return; }
    var contracts = getInstallmentContracts();
    var c = null;
    for (var i = 0; i < contracts.length; i++) {
        if (safeNum(contracts[i].id) === contractId) { c = contracts[i]; break; }
    }
    if (!c) return;
    var remaining = getInstRemaining(c);
    if (amount > remaining) { toast('قيمة الدفعة أكبر من المبلغ المتبقي', 'error'); return; }
    var nowT = nowTimeString();
    var paymentObj = { id: genPaymentId(), date: String(date), time: nowT, amount: amount, employee: String(employee), notes: String(notes) };
    var leftover = amount;
    var instArr = Array.isArray(c.installments) ? c.installments : [];
    var startIdx = parseInt(document.getElementById('instPayIdx').value, 10);
    if (!(startIdx >= 0 && startIdx < instArr.length)) startIdx = 0;
    if (instArr.length > 0) {
        for (var step = 0; step < instArr.length && leftover > 0; step++) {
            var m = (startIdx + step) % instArr.length;
            var inst = instArr[m];
            if (inst.status === 'paid' || inst.status === 'cancelled') continue;
            var instRem = Math.max(0, safeNum(inst.amount) - safeNum(inst.paid));
            var portion = Math.min(leftover, instRem);
            if (portion <= 0) continue;
            inst.payments.push({ id: genPaymentId(), date: String(date), time: nowT, amount: portion, employee: String(employee), notes: String(notes) });
            inst.paid = safeNum(inst.paid) + portion;
            if (inst.paid >= inst.amount) inst.status = 'paid';
            else inst.status = 'partial';
            leftover -= portion;
        }
    }
    if (leftover > 0) {
        if (!Array.isArray(c.payments)) c.payments = [];
        c.payments.push(paymentObj);
    }
    setInstallmentContracts(contracts);
    closeAllModals();
    refreshApplicationState();
    toast('تم تسجيل الدفعة بنجاح', 'success');
}

function undoInstPayment(contractId, instIdx) {
    var contracts = getInstallmentContracts();
    var c = null;
    for (var i = 0; i < contracts.length; i++) {
        if (safeNum(contracts[i].id) === safeNum(contractId)) { c = contracts[i]; break; }
    }
    if (!c) return;
    if (Array.isArray(c.installments) && c.installments[instIdx]) {
        var inst = c.installments[instIdx];
        if (inst.payments && inst.payments.length > 0) {
            var lastPay = inst.payments.pop();
            inst.paid = Math.max(0, safeNum(inst.paid) - safeNum(lastPay.amount));
            inst.status = inst.paid <= 0 ? 'unpaid' : (inst.paid >= inst.amount) ? 'paid' : 'partial';
            setInstallmentContracts(contracts);
            refreshApplicationState();
            showInstDetail(contractId);
            toast('تم التراجع عن آخر دفعة', 'info');
            return;
        }
    }
    if (Array.isArray(c.payments) && c.payments.length > 0) {
        c.payments.pop();
        setInstallmentContracts(contracts);
        refreshApplicationState();
        showInstDetail(contractId);
        toast('تم التراجع عن آخر دفعة', 'info');
        return;
    }
    toast('لا توجد دفعات للتراجع', 'warning');
}

function showInstDetail(id) {
    var contracts = getInstallmentContracts();
    var c = null;
    for (var i = 0; i < contracts.length; i++) {
        if (safeNum(contracts[i].id) === safeNum(id)) { c = contracts[i]; break; }
    }
    if (!c) return;
    var totalPaid = getInstTotalPaid(c);
    var remaining = getInstRemaining(c);
    var paidCount = getInstPaidCount(c);
    var status = getInstStatus(c);
    var overdueCount = 0;
    if (Array.isArray(c.installments)) {
        for (var k = 0; k < c.installments.length; k++) {
            if (c.installments[k].status === 'overdue') overdueCount++;
        }
    }
    var stLabels = { completed: 'مكتمل السداد', active: 'جاري', overdue: 'متأخر', partial: 'مدفوع جزئياً', unpaid: 'غير مدفوع' };
    var stColors = { completed: '#1A6B4E', active: '#1565C0', overdue: '#C62828', partial: '#E65100', unpaid: '#94a3b8' };
    var html = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">';
    html += '<div class="detail-info-card" style="flex:1;min-width:140px"><span class="info-label">اسم العميل</span><span class="info-value">' + (c.name || '—') + '</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:140px"><span class="info-label">الهاتف</span><span class="info-value">' + (c.phone || '—') + '</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:140px"><span class="info-label">الوصف</span><span class="info-value">' + (c.description || '—') + '</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:140px"><span class="info-label">الحالة</span><span class="info-value" style="color:' + (stColors[status] || '#94a3b8') + ';font-weight:700">' + (stLabels[status] || status) + '</span></div>';
    html += '</div>';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">';
    html += '<div class="detail-info-card" style="flex:1;min-width:120px"><span class="info-label">المبلغ الكلي</span><span class="info-value">' + fmt(safeNum(c.total)) + ' د.ع</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:120px"><span class="info-label">المقدمة</span><span class="info-value">' + fmt(safeNum(c.advance)) + ' د.ع</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:120px"><span class="info-label">إجمالي المدفوع</span><span class="info-value" style="color:#1A6B4E">' + fmt(totalPaid) + ' د.ع</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:120px"><span class="info-label">المتبقي</span><span class="info-value" style="color:#C62828">' + fmt(remaining) + ' د.ع</span></div>';
    html += '</div>';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">';
    html += '<div class="detail-info-card" style="flex:1;min-width:100px"><span class="info-label">عدد الأقساط</span><span class="info-value">' + safeNum(c.count) + '</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:100px"><span class="info-label">المدفوعة</span><span class="info-value" style="color:#1A6B4E">' + paidCount + '</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:100px"><span class="info-label">المتبقية</span><span class="info-value">' + (safeNum(c.count) - paidCount) + '</span></div>';
    html += '<div class="detail-info-card" style="flex:1;min-width:100px"><span class="info-label">المتأخرة</span><span class="info-value" style="color:#C62828">' + overdueCount + '</span></div>';
    html += '</div>';
    if (Array.isArray(c.installments) && c.installments.length > 0) {
        /* عرض الأقساط دائمًا بترتيب رقم القسط تصاعديًا (number ASC) —
           حالة القسط وتاريخ الاستحقاق لا تؤثران على ترتيب الصف */
        c.installments.sort(function(a, b) { return safeNum(a.number) - safeNum(b.number); });
        html += '<h4 style="margin-bottom:8px"><i data-lucide="calendar-range" style="width:18px;height:18px;vertical-align:middle"></i> جدول الأقساط</h4>';
        html += '<div style="overflow-x:auto"><table class="table"><thead><tr><th>#</th><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
        for (var j = 0; j < c.installments.length; j++) {
            var inst = c.installments[j];
            var instRem = safeNum(inst.amount) - safeNum(inst.paid);
            var instStatus = inst.status === 'paid' ? '<span style="color:#1A6B4E;font-weight:700">مدفوع</span>'
                : inst.status === 'overdue' ? '<span style="color:#C62828;font-weight:700">متأخر</span>'
                : inst.status === 'partial' ? '<span style="color:#E65100;font-weight:700">مدفوع جزئياً</span>'
                : '<span style="color:#1565C0;font-weight:700">غير مدفوع</span>';
            html += '<tr><td>' + inst.number + '</td><td>' + inst.dueDate + '</td>';
            html += '<td>' + fmt(safeNum(inst.amount)) + '</td><td>' + fmt(safeNum(inst.paid)) + '</td>';
            html += '<td>' + fmt(instRem) + '</td><td>' + instStatus + '</td><td style="white-space:nowrap">';
            if (inst.status !== 'paid' && inst.status !== 'cancelled') {
                html += '<button class="btn-sm btn-green" onclick="recordInstPayment(' + c.id + ',' + j + ')">تسجيل دفعة</button>';
            }
            if (inst.payments && inst.payments.length > 0) {
                html += '<button class="btn-sm btn-edit" onclick="undoInstPayment(' + c.id + ',' + j + ')" title="تراجع">↩</button>';
            }
            html += '</td></tr>';
        }
        html += '</tbody></table></div>';
    } else if (remaining > 0) {
        html += '<div style="padding:16px;background:var(--warning-bg,#FFF8E1);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">';
        html += '<p style="margin:0 0 10px;color:var(--muted);font-size:14px">لا توجد أقساط مسجّلة لهذا العقد — يمكن تسجيل دفعة مباشرة على العقد.</p>';
        html += '<button class="btn btn-green" onclick="recordInstPayment(' + c.id + ',-1)">تسجيل دفعة على العقد</button>';
        html += '</div>';
    }
    var allPays = collectInstPayments(c);
    if (allPays.length > 0) {
        html += '<div style="margin-top:16px"><h4 style="margin-bottom:8px"><i data-lucide="history" style="width:18px;height:18px;vertical-align:middle"></i> سجل جميع الدفعات</h4>';
        html += '<div style="overflow-x:auto"><table class="table"><thead><tr><th>التاريخ</th><th>الوقت</th><th>القسط</th><th>المبلغ</th><th>المتبقي الكامل</th><th>الموظف</th><th>ملاحظات</th><th>وصل</th></tr></thead><tbody>';
        for (var q = 0; q < allPays.length; q++) {
            var py = allPays[q];
            var instLabel = py.instNumber != null ? 'القسط ' + py.instNumber : 'عقد';
            html += '<tr><td>' + (py.pay.date || '—') + '</td><td>' + (py.pay.time || '—') + '</td><td>' + instLabel + '</td><td>' + fmt(safeNum(py.pay.amount)) + '</td><td>' + fmt(py.remainingAfter) + '</td><td>' + (py.pay.employee || '—') + '</td><td>' + (py.pay.notes || '—') + '</td>';
            html += '<td style="white-space:nowrap"><button class="btn-sm btn-orange" onclick="openReceiptPreview(' + c.id + ',' + q + ')" title="فتح وطباعة وصل هذه الدفعة"><i data-lucide="receipt-text" style="width:14px;height:14px;vertical-align:middle"></i> طباعة وصل</button></td></tr>';
        }
        html += '</tbody></table></div></div>';
    }
    document.getElementById('instDetailTitle').textContent = 'تفاصيل — ' + (c.name || '');
    document.getElementById('instDetailBody').innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    showModal('instDetailModal');
}

/* ═══════════════════════════════════════
   وصل سداد الأقساط — جمع كل دفعات العقد بترتيبها الزمني
   مع احتساب المتبقي بعد كل دفعة (مستقل لكل دفعة)

   القاعدة: لا يُفترض أبداً أن الدفعة المعروضة هي الدفعة الأولى.
   يُجمع سجل الدفعات الكامل للعقد/العميل (من الأقساط ومن دفعات العقد)،
   يُرتب زمنياً، ثم يُستخرج ترتيب كل دفعة وكل المبالغ قبلياً —
   فيتحدد المتبقي = إجمالي العقد − المقدمة − جميع الدفعات حتى هذه الدفعة،
   وليس من قيمة القسط الحالي وحده.
   ═══════════════════════════════════════ */
function collectInstPayments(c) {
    var list = [];
    if (Array.isArray(c.installments)) {
        for (var i = 0; i < c.installments.length; i++) {
            var inst = c.installments[i];
            if (!Array.isArray(inst.payments)) continue;
            for (var j = 0; j < inst.payments.length; j++) {
                list.push({
                    pay: inst.payments[j],
                    contractId: safeNum(c.id),
                    clientName: c.name || '',
                    phone: c.phone || '',
                    description: c.description || '',
                    instNumber: inst.number,
                    instDueDate: inst.dueDate || '',
                    instAmount: safeNum(inst.amount)
                });
            }
        }
    }
    if (Array.isArray(c.payments)) {
        for (var k = 0; k < c.payments.length; k++) {
            list.push({
                pay: c.payments[k],
                contractId: safeNum(c.id),
                clientName: c.name || '',
                phone: c.phone || '',
                description: c.description || '',
                instNumber: null,
                instDueDate: '',
                instAmount: 0
            });
        }
    }
    list.sort(function(a, b) {
        var d = (a.pay.date || '').localeCompare(b.pay.date || '');
        if (d) return d;
        return (a.pay.time || '').localeCompare(b.pay.time || '');
    });
    var total = safeNum(c.total);
    var advance = safeNum(c.advance);
    var insts = Array.isArray(c.installments) ? c.installments : [];
    /* لكل دفعة: ترتيبها في السجل، عدد الدفعات السابقة، إجمالي المدفوع سابقاً،
       مبلغها، إجمالي المدفوع حتى هذه الدفعة، المتبقي الحقيقي، وعدد الدفعات المتبقية —
       وكلها كما كانت عليه في لحظة تسجيل الدفعة نفسها (وليس الحالة الحالية). */
    var instMeta = [];
    var instIndexByNumber = {};
    for (var m = 0; m < insts.length; m++) {
        if (safeNum(insts[m].amount) <= 0) continue;
        instIndexByNumber[safeNum(insts[m].number)] = instMeta.length;
        instMeta.push({ amount: safeNum(insts[m].amount) });
    }
    var paidUpTo = [];
    for (var u = 0; u < instMeta.length; u++) paidUpTo.push(0);
    var recordsSum = 0;
    for (var q = 0; q < list.length; q++) {
        var pay = list[q].pay;
        recordsSum += safeNum(pay.amount);
        if (list[q].instNumber != null && instIndexByNumber[list[q].instNumber] !== undefined) {
            paidUpTo[instIndexByNumber[list[q].instNumber]] += safeNum(pay.amount);
        }
        var remCount = 0;
        for (var r = 0; r < instMeta.length; r++) {
            if (paidUpTo[r] < instMeta[r].amount) remCount++;
        }
        list[q].seq = q + 1;
        list[q].prevCount = q;
        list[q].prevTotal = recordsSum - safeNum(pay.amount);
        list[q].curAmount = safeNum(pay.amount);
        list[q].cumTotal = advance + recordsSum;
        list[q].remainingAfter = Math.max(0, total - advance - recordsSum);
        list[q].remainingCount = remCount;
        list[q].index = q;
    }
    return list;
}

/* ── بيانات الشركة — تُعرض في رأس الوصل (عدّلها هنا حسب بيانات الشركة) ── */
var BARAKAT_COMPANY = {
    name: 'شركة بركات المناسك للسفر والسياحة',
    slogan: '',
    contacts: [
        { label: 'الحاج سالم اليساري', value: '07712441233' },
        { label: 'أحمد اليساري', value: '07744641155' },
        { label: 'خدمة الزبائن', value: '07801733892' }
    ]
};

var BARAKAT_LOGO_SRC = 'icons/logo-barakat.png';

function buildReceiptHTML(c, entry) {
    var pay = entry.pay || {};
    var co = BARAKAT_COMPANY;
    var contactBits = [];
    for (var ci = 0; ci < (co.contacts || []).length; ci++) {
        if (co.contacts[ci].value) contactBits.push(co.contacts[ci].label + ': ' + co.contacts[ci].value);
    }
    var dt = pay.date || '—';
    var tm = pay.time || '—';
    var receiptNo = 'RCP-' + (pay.id || (String(dt).replace(/-/g, '') + '-' + (entry.index + 1)));
    var instLabel = entry.instNumber != null ? 'القسط رقم ' + entry.instNumber : 'دفعة على العقد';
    var instRows = '';
    if (entry.instNumber != null) {
        instRows += '<div class="rc-row"><span>رقم القسط</span><b>' + entry.instNumber + '</b></div>';
        if (entry.instDueDate) instRows += '<div class="rc-row"><span>تاريخ استحقاق القسط</span><b>' + entry.instDueDate + '</b></div>';
        instRows += '<div class="rc-row"><span>قيمة القسط</span><b>' + fmt(entry.instAmount) + ' د.ع</b></div>';
    } else {
        instRows += '<div class="rc-row"><span>النوع</span><b>دفعة مباشرة على العقد</b></div>';
    }
    instRows += '<div class="rc-row"><span>ترتيب الدفعة في السجل</span><b>' + entry.seq + '</b></div>';
    var html = '<div class="receipt-sheet">';
    html += '<div class="rc-header">';
    html += '<img class="rc-logo" src="' + BARAKAT_LOGO_SRC + '" alt="' + co.name + '" onerror="this.style.display=\'none\'">';
    html += '<div class="rc-company">';
    html += '<div class="rc-name">' + co.name + '</div>';
    if (contactBits.length) html += '<div class="rc-contact">' + contactBits.join('<br>') + '</div>';
    html += '</div></div>';
    html += '<div class="rc-divider"></div>';
    html += '<div class="rc-title">وصل سداد قسط</div>';
    html += '<div class="rc-meta">رقم الوصل: ' + receiptNo + ' &nbsp;|&nbsp; تاريخ الدفع: ' + dt + ' &nbsp;|&nbsp; وقت الدفع: ' + tm + '</div>';
    html += '<div class="rc-grid">';
    html += '<div class="rc-box"><div class="rc-box-title">بيانات العميل</div>';
    html += '<div class="rc-row"><span>اسم العميل</span><b>' + (entry.clientName || '—') + '</b></div>';
    if (entry.phone) html += '<div class="rc-row"><span>الهاتف</span><b>' + entry.phone + '</b></div>';
    if (entry.description) html += '<div class="rc-row"><span>الوصف</span><b>' + entry.description + '</b></div>';
    html += '</div>';
    html += '<div class="rc-box"><div class="rc-box-title">بيانات القسط</div>' + instRows + '</div>';
    html += '</div>';
    html += '<div class="rc-amount">';
    html += '<div class="rc-amt rc-amt-paid"><div class="rc-amt-label">المبلغ المدفوع</div><div class="rc-amt-value">' + fmt(safeNum(pay.amount)) + ' د.ع</div></div>';
    html += '<div class="rc-amt rc-amt-rem"><div class="rc-amt-label">المبلغ المتبقي الكامل بعد الدفعة</div><div class="rc-amt-value">' + fmt(entry.remainingAfter) + ' د.ع</div></div>';
    html += '</div>';
    html += '<table class="rc-table"><thead><tr><th>بيان حساب المتبقي — حسب سجل الدفعات الفعلي</th><th></th></tr></thead><tbody>';
    html += '<tr><td>رقم الدفعة الحالية (ترتيبها في السجل)</td><td>' + entry.seq + '</td></tr>';
    html += '<tr><td>عدد الدفعات السابقة</td><td>' + entry.prevCount + '</td></tr>';
    if (safeNum(c.advance) > 0) html += '<tr><td>المقدمة المدفوعة عند التعاقد</td><td>' + fmt(safeNum(c.advance)) + ' د.ع</td></tr>';
    html += '<tr><td>إجمالي الدفعات السابقة</td><td>' + fmt(entry.prevTotal) + ' د.ع</td></tr>';
    html += '<tr><td>مبلغ الدفعة الحالية</td><td>' + fmt(entry.curAmount) + ' د.ع</td></tr>';
    html += '<tr><td>إجمالي المدفوع حتى هذه الدفعة</td><td>' + fmt(entry.cumTotal) + ' د.ع</td></tr>';
    html += '<tr><td>المبلغ المتبقي الحقيقي</td><td>' + fmt(entry.remainingAfter) + ' د.ع</td></tr>';
    html += '<tr><td>عدد الدفعات المتبقية</td><td>' + entry.remainingCount + '</td></tr>';
    html += '</tbody></table>';
    html += '<table class="rc-table"><thead><tr><th>البند</th><th>التفاصيل</th></tr></thead><tbody>';
    html += '<tr><td>تاريخ تسجيل الدفعة</td><td>' + dt + '</td></tr>';
    html += '<tr><td>وقت تسجيل الدفعة</td><td>' + tm + '</td></tr>';
    html += '<tr><td>مبلغ الدفعة</td><td>' + fmt(safeNum(pay.amount)) + ' د.ع</td></tr>';
    html += '<tr><td>الموظف المسؤول</td><td>' + (pay.employee || '—') + '</td></tr>';
    html += '<tr><td>القسط</td><td>' + instLabel + '</td></tr>';
    html += '<tr><td>ملاحظات</td><td>' + (pay.notes || '—') + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rc-notes">بيان: ' + instLabel + ' — ' + (pay.notes || 'لا توجد ملاحظات') + '</div>';
    html += '<div class="rc-sign">';
    html += '<div class="rc-sign-item"><div class="rc-sign-line">توقيع الموظف</div></div>';
    html += '<div class="rc-sign-item"><div class="rc-sign-line">توقيع العميل</div></div>';
    html += '</div>';
    html += '<div class="rc-footer">' + co.name + ' — شكراً لتعاملكم معنا</div>';
    html += '</div>';
    return html;
}

function openReceiptPreview(contractId, payIndex) {
    var contracts = getInstallmentContracts();
    var c = null;
    for (var i = 0; i < contracts.length; i++) {
        if (safeNum(contracts[i].id) === safeNum(contractId)) { c = contracts[i]; break; }
    }
    if (!c) { toast('تعذر العثور على العقد', 'error'); return; }
    var list = collectInstPayments(c);
    var entry = list[payIndex];
    if (!entry) { toast('تعذر العثور على الدفعة', 'error'); return; }
    var html = buildReceiptHTML(c, entry);
    var bodyEl = document.getElementById('receiptBody');
    var rootEl = document.getElementById('receiptPrintRoot');
    if (bodyEl) bodyEl.innerHTML = html;
    if (rootEl) rootEl.innerHTML = html;
    document.body.classList.add('printing-receipt');
    showModal('receiptModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeReceipt() {
    document.body.classList.remove('printing-receipt');
    closeAllModals();
}

function printReceiptNow() {
    window.print();
}

function renderInstallments() {
    var body = document.getElementById('instBody');
    var cardsEl = document.getElementById('instCardList');
    var empty = document.getElementById('instEmpty');
    var tableWrap = document.getElementById('instTableWrap');
    if (!body) return;
    updateInstOverdue();
    var contracts = getInstallmentContracts();
    var totalValue = 0, totalPaid = 0, totalRemaining = 0;
    var clientSet = {}, completedCount = 0, overdueCount = 0, activeCount = 0;
    for (var i = 0; i < contracts.length; i++) {
        var c = contracts[i];
        totalValue += safeNum(c.total);
        totalPaid += getInstTotalPaid(c);
        totalRemaining += getInstRemaining(c);
        if (c.name) clientSet[c.name] = true;
        var st = getInstStatus(c);
        if (st === 'completed') completedCount++;
        else if (st === 'overdue') overdueCount++;
        else activeCount++;
    }
    var el1 = document.getElementById('instCountStat');
    var el2 = document.getElementById('instContractStat');
    var el3 = document.getElementById('instTotalStat');
    var el4 = document.getElementById('instPaidStat');
    var el5 = document.getElementById('instRemainingStat');
    var el6 = document.getElementById('instOverdueStat');
    var el7 = document.getElementById('instCompletedStat');
    var el8 = document.getElementById('instActiveStat');
    if (el1) el1.textContent = Object.keys(clientSet).length;
    if (el2) el2.textContent = contracts.length;
    if (el3) el3.textContent = fmt(totalValue) + ' د.ع';
    if (el4) el4.textContent = fmt(totalPaid) + ' د.ع';
    if (el5) el5.textContent = fmt(totalRemaining) + ' د.ع';
    if (el6) el6.textContent = overdueCount;
    if (el7) el7.textContent = completedCount;
    if (el8) el8.textContent = activeCount;
    var search = (document.getElementById('instSearch') || {}).value || '';
    var filter = (document.getElementById('instFilter') || {}).value || 'all';
    var filtered = [];
    for (var j = 0; j < contracts.length; j++) {
        var c2 = contracts[j];
        var matchSearch = !search || (c2.name || '').indexOf(search) !== -1 || (c2.phone || '').indexOf(search) !== -1 || (c2.description || '').indexOf(search) !== -1;
        var st2 = getInstStatus(c2);
        var matchFilter = filter === 'all' || filter === st2;
        if (matchSearch && matchFilter) filtered.push(c2);
    }
    var resultsEl = document.getElementById('instResults');
    if (resultsEl) resultsEl.textContent = filtered.length + ' عقد';
    if (filtered.length === 0) { body.innerHTML = ''; if (cardsEl) cardsEl.innerHTML = ''; if (empty) empty.style.display = ''; if (tableWrap) tableWrap.style.display = 'none'; return; }
    if (empty) empty.style.display = 'none';
    if (tableWrap) tableWrap.style.display = '';
    var stLabels2 = { completed: 'مكتمل', active: 'جاري', overdue: 'متأخر', partial: 'جزئي', unpaid: 'غير مدفوع' };
    var stColors2 = { completed: 'debt-badge-paid', active: 'debt-badge-unpaid', overdue: 'debt-badge-overdue', partial: 'debt-badge-partial', unpaid: 'debt-badge-unpaid' };
    var html = '';
    var cardsHtml = '';
    for (var k = 0; k < filtered.length; k++) {
        var item = filtered[k];
        var totalP = getInstTotalPaid(item);
        var rem = getInstRemaining(item);
        var st3 = getInstStatus(item);
        var paidCnt = getInstPaidCount(item);
        var dn = item.name || '-';
        var tn = dn.length > 20 ? dn.substring(0, 20) + '…' : dn;
        var firstUnpaid = -1;
        if (rem > 0 && Array.isArray(item.installments)) {
            for (var m = 0; m < item.installments.length; m++) {
                if (item.installments[m].status !== 'paid' && item.installments[m].status !== 'cancelled') { firstUnpaid = m; break; }
            }
        }
        /* ── صف الجدول (سطح المكتب) ── */
        html += '<tr>';
        html += '<td class="debt-col-name"><strong class="debt-truncate" title="' + dn + '" style="cursor:pointer;text-decoration:underline" onclick="showInstDetail(' + item.id + ')">' + tn + '</strong><span class="debt-phone">' + (item.phone || '') + '</span></td>';
        html += '<td class="debt-col-amount">' + fmt(item.total) + '</td>';
        html += '<td class="debt-col-amount">' + fmt(totalP) + '</td>';
        html += '<td class="debt-col-amount">' + fmt(rem) + '</td>';
        html += '<td>' + paidCnt + ' / ' + safeNum(item.count) + '</td>';
        html += '<td><span class="debt-badge ' + (stColors2[st3] || 'debt-badge-unpaid') + '">' + (stLabels2[st3] || st3) + '</span></td>';
        html += '<td>' + (item.startDate || '—') + '</td>';
        html += '<td class="debt-col-actions"><div class="debt-actions">';
        html += '<button class="btn-sm btn-blue" onclick="showInstDetail(' + item.id + ')" title="فتح تفاصيل العقد والأقساط">تفاصيل</button>';
        html += '<button class="btn-sm btn-edit" onclick="openInstallmentEdit(' + item.id + ')" title="تعديل"><i data-lucide="pencil"></i></button>';
        if (rem > 0) {
            html += '<button class="btn-sm btn-green" onclick="recordInstPayment(' + item.id + ',' + firstUnpaid + ')">تسجيل دفعة</button>';
        } else {
            html += '<button class="btn-sm btn-green-disabled"><i data-lucide="circle-check-big"></i> تم السداد</button>';
        }
        html += '<button class="btn-sm btn-del" onclick="confirmDeleteInstallment(' + item.id + ')" title="حذف"><i data-lucide="trash-2"></i></button>';
        html += '</div></td></tr>';

        /* ── بطاقة الجوال ── */
        var pct = safeNum(item.total) > 0 ? Math.min(100, Math.round(totalP / safeNum(item.total) * 100)) : 0;
        var badgeCls = stColors2[st3] || 'debt-badge-unpaid';
        var badgeTxt = stLabels2[st3] || st3;
        cardsHtml += '<div class="inst-card">';
        cardsHtml += '<div class="inst-card-top"><div class="inst-card-name">' + dn + '</div><span class="debt-badge ' + badgeCls + '">' + badgeTxt + '</span></div>';
        if (item.phone) cardsHtml += '<div class="inst-card-phone">' + item.phone + '</div>';
        if (item.description) cardsHtml += '<div class="inst-card-desc">' + item.description + '</div>';
        cardsHtml += '<div class="inst-card-amounts">';
        cardsHtml += '<div class="inst-card-amt"><span>المبلغ الكلي</span><strong>' + fmt(item.total) + '</strong></div>';
        cardsHtml += '<div class="inst-card-amt"><span>المدفوع</span><strong class="inst-amt-paid">' + fmt(totalP) + '</strong></div>';
        cardsHtml += '<div class="inst-card-amt"><span>المتبقي</span><strong class="inst-amt-remaining">' + fmt(rem) + '</strong></div>';
        cardsHtml += '</div>';
        cardsHtml += '<div class="inst-card-progress"><div class="inst-card-progress-track"><div class="inst-card-progress-fill" style="width:' + pct + '%"></div></div><span class="inst-card-progress-label">' + pct + '%</span></div>';
        cardsHtml += '<div class="inst-card-meta">';
        cardsHtml += '<span><i data-lucide="calendar-range" style="width:14px;height:14px"></i> الأقساط: ' + paidCnt + ' / ' + safeNum(item.count) + '</span>';
        cardsHtml += '<span><i data-lucide="flag" style="width:14px;height:14px"></i> البداية: ' + (item.startDate || '—') + '</span>';
        cardsHtml += '</div>';
        cardsHtml += '<div class="inst-card-actions">';
        if (rem > 0) {
            cardsHtml += '<button class="btn btn-green inst-card-pay" onclick="recordInstPayment(' + item.id + ',' + firstUnpaid + ')"><i data-lucide="banknote" style="width:16px;height:16px"></i> تسجيل دفعة</button>';
        } else {
            cardsHtml += '<button class="btn btn-green inst-card-pay" onclick="showInstDetail(' + item.id + ')"><i data-lucide="circle-check-big" style="width:16px;height:16px"></i> تم السداد</button>';
        }
        cardsHtml += '<button class="btn btn-secondary inst-card-mini" onclick="showInstDetail(' + item.id + ')" title="تفاصيل"><i data-lucide="file-text"></i></button>';
        cardsHtml += '<button class="btn btn-secondary inst-card-mini" onclick="openInstallmentEdit(' + item.id + ')" title="تعديل"><i data-lucide="pencil"></i></button>';
        cardsHtml += '<button class="btn btn-secondary inst-card-mini inst-card-del" onclick="confirmDeleteInstallment(' + item.id + ')" title="حذف"><i data-lucide="trash-2"></i></button>';
        cardsHtml += '</div>';
        cardsHtml += '</div>';
    }
    body.innerHTML = html;
    if (cardsEl) cardsEl.innerHTML = cardsHtml;
}

function exportInstallmentsExcel() {
    var contracts = getInstallmentContracts();
    if (contracts.length === 0) { toast('لا توجد بيانات للتصدير', 'warning'); return; }
    var headers = ['#', 'اسم العميل', 'الهاتف', 'الوصف', 'المبلغ الكلي', 'المقدمة', 'المدفوع', 'المتبقي', 'عدد الأقساط', 'المدفوعة', 'الحالة', 'تاريخ البداية'];
    var data = [];
    var totalValue = 0, totalPaid = 0, totalRemaining = 0;
    var completedCount = 0, activeCount = 0, overdueCount = 0;
    for (var i = 0; i < contracts.length; i++) {
        var c = contracts[i];
        var tp = getInstTotalPaid(c); var rem = getInstRemaining(c); var st = getInstStatus(c);
        var stLabel = st === 'completed' ? 'مكتمل' : st === 'overdue' ? 'متأخر' : st === 'partial' ? 'جزئي' : st === 'active' ? 'جاري' : 'غير مدفوع';
        var paidCnt = getInstPaidCount(c);
        totalValue += safeNum(c.total); totalPaid += tp; totalRemaining += rem;
        if (st === 'completed') completedCount++; else if (st === 'overdue') overdueCount++; else activeCount++;
        data.push([i + 1, c.name || '—', c.phone || '—', c.description || '—', xlFormatNum(safeNum(c.total)), xlFormatNum(safeNum(c.advance)), xlFormatNum(tp), xlFormatNum(rem), safeNum(c.count), paidCnt, stLabel, c.startDate || '—']);
    }
    var cards = [
        { label: 'إجمالي قيمة الأقساط', value: totalValue, isCurrency: true, bgColor: 'F3F0FF', valueColor: '7C3AED' },
        { label: 'إجمالي المدفوع', value: totalPaid, isCurrency: true, bgColor: 'E8F5E9', valueColor: '1A6B4E' },
        { label: 'إجمالي المتبقي', value: totalRemaining, isCurrency: true, bgColor: 'FFF3E0', valueColor: 'E65100' },
        { label: 'عدد العقود', value: contracts.length, bgColor: 'E3F2FD', valueColor: '1565C0' },
        { label: 'مكتملة', value: completedCount, bgColor: 'E0F2F1', valueColor: '00695C' },
        { label: 'متأخرة', value: overdueCount, bgColor: 'FFEBEE', valueColor: 'C62828' }
    ];
    var summaryItems = [
        { label: 'إجمالي القيمة', value: xlFormatNum(totalValue), isCurrency: false, valueColor: '7C3AED' },
        { label: 'المدفوع', value: xlFormatNum(totalPaid), isCurrency: false },
        { label: 'المتبقي', value: xlFormatNum(totalRemaining), isCurrency: false, valueColor: 'E65100' },
        { label: 'عدد العقود', value: contracts.length, isCurrency: false },
        { label: 'نسبة التحصيل', value: totalValue > 0 ? Math.round(totalPaid / totalValue * 100) + '%' : '0%', isCurrency: false }
    ];
    xlExport({
        title: 'تقرير الأقساط',
        filename: 'installments_' + todayStr() + '.xlsx',
        sheetName: 'الأقساط',
        numCols: 12,
        cards: cards, headers: headers, data: data, summaryItems: summaryItems,
        landscape: true, tableOptions: { colWidths: [5, 16, 13, 16, 14, 14, 14, 14, 10, 10, 12, 13] }
    });
}

function printInstallments() { window.print(); }

/* ═══════════════════════════════════════
   استيراد الأقساط من ملف CSV
═══════════════════════════════════════ */

var CSV_MONTH_MAP = {
    'كانون الثاني': 1, 'شباط': 2, 'آذار': 3, 'نيسان': 4,
    'أيار': 5, 'حزيران': 6, 'تموز': 7, 'آب': 8,
    'أيلول': 9, 'تشرين الأول': 10, 'تشرين الثاني': 11, 'كانون الأول': 12
};

function parseArabicDate(dateStr) {
    if (!dateStr || !dateStr.trim()) return '';
    var parts = dateStr.trim().split('-');
    if (parts.length < 2) return '';
    var day = parseInt(parts[0], 10);
    var monthName = parts[1].trim().replace(/\u00A0/g, ' ');
    var month = CSV_MONTH_MAP[monthName];
    if (!month || isNaN(day)) return '';
    return { day: day, month: month };
}

function csvExtractNum(text) {
    if (!text) return 0;
    var m = text.replace(/[,]/g, '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

function csvExtractDuration(text) {
    if (!text) return 0;
    var m = text.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

function csvDetermineYear(month, startHint) {
    if (startHint && startHint.year) {
        var y = startHint.year;
        if (month >= startHint.month) return y;
        return y + 1;
    }
    if (month >= 9) return 2025;
    return 2026;
}

function csvIsMonthDay(text) {
    if (!text) return false;
    var t = text.trim();
    return /^\d{1,2}-(تشرين\s+الأول|تشرين\s+الثاني|كانون\s+الأول|كانون\s+الثاني|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول)/.test(t);
}

function csvIsHeaderRow(cols) {
    var leftName = (cols[0] || '').trim();
    var rightName = (cols[6] || '').trim();
    var leftOk = false;
    var rightOk = false;
    if (leftName && !csvIsMonthDay(leftName)) {
        for (var li = 1; li <= 4; li++) {
            if ((cols[li] || '').match(/شهر|سنة|للمدة|المدة/)) { leftOk = true; break; }
        }
    }
    var rn = rightName;
    if (!rn) { for (var ri = 7; ri <= 10; ri++) { if ((cols[ri] || '').trim()) { rn = cols[ri].trim(); break; } } }
    if (rn && !csvIsMonthDay(rn)) {
        for (var ri2 = 7; ri2 <= 10; ri2++) {
            if ((cols[ri2] || '').match(/شهر|سنة|للمدة|المدة/)) { rightOk = true; break; }
        }
    }
    return { left: leftOk, right: rightOk };
}

function csvIsColHeaderRow(cols) {
    var text = (cols[0] || '') + (cols[1] || '') + (cols[6] || '') + (cols[7] || '');
    return text.indexOf('تاريخ الاستحقاق') >= 0 || text.indexOf('المبلغ') >= 0;
}

function csvExtractHeaderFields(cols, startCol) {
    var name = '', total = 0, duration = 0, monthly = 0;
    for (var i = startCol; i < startCol + 4 && i < cols.length; i++) {
        var c = (cols[i] || '').trim();
        if (!c) continue;
        if (c.match(/كلي|إجمالي/)) { total = csvExtractNum(c); continue; }
        if (c.match(/كل شهر/)) { monthly = csvExtractNum(c); continue; }
        if (c.match(/شهر|سنة|للمدة/)) { duration = csvExtractDuration(c); continue; }
        if (!name) name = c;
    }
    return { name: name, total: total, duration: duration, monthly: monthly };
}

function parseInstallmentCSV(csvText) {
    var lines = csvText.split(/\r?\n/);
    var blocks = [];
    var i = 0;
    while (i < lines.length) {
        var line = lines[i].trim();
        if (!line) { i++; continue; }
        var cols = line.split(';');
        var hdr = csvIsHeaderRow(cols);
        if (!hdr.left && !hdr.right) { i++; continue; }
        var rightColStart = 6;
        if (hdr.right) {
            if (!(cols[6] || '').trim() && (cols[7] || '').trim()) rightColStart = 7;
        }
        var block = { row: i, left: null, right: null, rightColStart: rightColStart, scheduleStart: i + 2 };
        if (hdr.left) block.left = csvExtractHeaderFields(cols, 0);
        if (hdr.right) block.right = csvExtractHeaderFields(cols, rightColStart);
        blocks.push(block);
        i++;
    }
    var result = [];
    for (var b = 0; b < blocks.length; b++) {
        var blk = blocks[b];
        var nextBlockRow = b + 1 < blocks.length ? blocks[b + 1].row : lines.length;
        var schedEnd = nextBlockRow;
        for (var e = blk.scheduleStart; e < nextBlockRow; e++) {
            var el = lines[e].trim();
            if (!el) {
                var hasMore = false;
                for (var pk = e + 1; pk < Math.min(e + 4, nextBlockRow); pk++) {
                    var pl = lines[pk].trim();
                    if (pl) {
                        var pc = pl.split(';');
                        if (csvIsMonthDay(pc[0]) || csvIsMonthDay(pc[blk.rightColStart])) { hasMore = true; break; }
                        break;
                    }
                }
                if (!hasMore) { schedEnd = e; break; }
            }
        }
        if (blk.left) {
            var leftSched = [];
            for (var r = blk.scheduleStart; r < schedEnd; r++) {
                var rl = lines[r].trim();
                if (!rl) continue;
                var rc = rl.split(';');
                var d = (rc[0] || '').trim();
                if (!csvIsMonthDay(d)) continue;
                if (csvIsColHeaderRow(rc)) continue;
                leftSched.push({
                    dueDateRaw: d,
                    amount: csvExtractNum(rc[1] || ''),
                    paidDateRaw: (rc[2] || '').trim(),
                    notes: (rc[3] || '').trim()
                });
            }
            result.push(csvBuildContract(blk.left, leftSched));
        }
        if (blk.right) {
            var rcs = blk.rightColStart;
            var rightSched = [];
            for (var r2 = blk.scheduleStart; r2 < schedEnd; r2++) {
                var rl2 = lines[r2].trim();
                if (!rl2) continue;
                var rc2 = rl2.split(';');
                var d2 = (rc2[rcs] || '').trim();
                if (!csvIsMonthDay(d2)) continue;
                if (csvIsColHeaderRow(rc2)) continue;
                rightSched.push({
                    dueDateRaw: d2,
                    amount: csvExtractNum(rc2[rcs + 1] || ''),
                    paidDateRaw: (rc2[rcs + 2] || '').trim(),
                    notes: (rc2[rcs + 3] || '').trim()
                });
            }
            result.push(csvBuildContract(blk.right, rightSched));
        }
    }
    return result;
}

function csvBuildContract(meta, scheduleRows) {
    var filtered = [];
    for (var fi = 0; fi < scheduleRows.length; fi++) {
        if (scheduleRows[fi].amount > 0) filtered.push(scheduleRows[fi]);
    }
    var count = meta.duration > 0 ? meta.duration : filtered.length;
    if (filtered.length > count) filtered = filtered.slice(0, count);
    var instValue = meta.monthly > 0 ? meta.monthly : (count > 0 ? Math.trunc(meta.total / count) : 0);
    if (meta.total === 0 && instValue > 0) meta.total = count * instValue;
    var totalFromInst = filtered.length * instValue;
    var advance = Math.max(0, meta.total - totalFromInst);
    var firstDate = filtered.length > 0 ? parseArabicDate(filtered[0].dueDateRaw) : null;
    var startMonth = firstDate ? firstDate.month : 10;
    var startDay = firstDate ? firstDate.day : 1;
    var startYear = (startMonth >= 9) ? 2025 : 2026;
    var startDateStr = startYear + '-' + String(startMonth).padStart(2, '0') + '-' + String(startDay).padStart(2, '0');
    var instArr = [];
    var curMonth = startMonth;
    var curYear = startYear;
    for (var si = 0; si < filtered.length; si++) {
        var sr = filtered[si];
        if (si > 0) {
            curMonth++;
            if (curMonth > 12) { curMonth = 1; curYear++; }
        }
        var dueStr = curYear + '-' + String(curMonth).padStart(2, '0') + '-' + String(startDay).padStart(2, '0');
        var payments = [];
        var paidAmount = 0;
        if (sr.paidDateRaw) {
            var payD = parseArabicDate(sr.paidDateRaw);
            if (payD) {
                var payYear = curYear;
                if (payD.month < curMonth - 2) payYear = curYear + 1;
                var payStr = payYear + '-' + String(payD.month).padStart(2, '0') + '-' + String(payD.day).padStart(2, '0');
                paidAmount = instValue;
                payments.push({ date: payStr, amount: instValue, employee: '', notes: sr.notes || '' });
            }
        }
        var status = paidAmount >= instValue ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
        instArr.push({
            dueDate: dueStr,
            amount: instValue,
            paid: paidAmount,
            status: status,
            payments: payments
        });
    }
    return {
        name: meta.name, phone: '',
        description: meta.monthly > 0 ? 'كل شهر ' + fmt(meta.monthly) : '',
        total: meta.total, advance: advance, count: count,
        instValue: instValue, startDate: startDateStr,
        period: 'monthly', notes: '', installments: instArr
    };
}

function importInstallmentCSV(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        try {
            var raw = ev.target.result;
            var bytes = new Uint8Array(raw);
            var dec = new TextDecoder('windows-1256');
            var csvText = dec.decode(bytes);
            var parsed = parseInstallmentCSV(csvText);
            if (parsed.length === 0) { toast('لم يتم العثور على عقود في الملف', 'warning'); return; }
            var report = { imported: 0, updated: 0, skipped: 0, skippedReasons: [] };
            var existing = getInstallmentContracts();
            var maxId = 0;
            for (var e = 0; e < existing.length; e++) {
                if (safeNum(existing[e].id) > maxId) maxId = safeNum(existing[e].id);
            }
            var summary = parsed.length + ' عقود';
            showConfirm(
                'سيتم استيراد ' + summary + ' من ملف CSV.\n\nسيتم إنشاء نسخة احتياطية تلقائية أولاً.\n\nهل تريد المتابعة؟',
                function(ok) {
                    if (!ok) return;
                    for (var p = 0; p < parsed.length; p++) {
                        var contract = parsed[p];
                        var found = false;
                        for (var x = 0; x < existing.length; x++) {
                            if (existing[x].name && contract.name && existing[x].name.trim() === contract.name.trim()) {
                                existing[x].total = contract.total;
                                existing[x].advance = contract.advance;
                                existing[x].count = contract.count;
                                existing[x].instValue = contract.instValue;
                                existing[x].startDate = contract.startDate;
                                existing[x].installments = contract.installments;
                                existing[x].description = contract.description;
                                found = true;
                                report.updated++;
                                break;
                            }
                        }
                        if (!found) {
                            maxId++;
                            contract.id = maxId;
                            contract.createdAt = dbNowISO();
                            existing.push(contract);
                            report.imported++;
                        }
                    }
                    setInstallmentContracts(existing);
                    refreshApplicationState();
                    var msg = 'تم الاستيراد بنجاح!\n\n';
                    msg += '• مستوردة جديدة: ' + report.imported + '\n';
                    msg += '• محدّثة: ' + report.updated + '\n';
                    msg += '• متجاهلة: ' + report.skipped;
                    if (report.skippedReasons.length > 0) {
                        msg += '\n\nأسباب التجاهل:\n';
                        for (var r = 0; r < report.skippedReasons.length; r++) {
                            msg += '• ' + report.skippedReasons[r] + '\n';
                        }
                    }
                    toast(msg, 'success');
                }
            );
        } catch (err) {
            toast('خطأ في قراءة الملف: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}



