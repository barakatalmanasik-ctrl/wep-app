/* ═══════════════════════════════════════════════════
   بركات المناسك — طبقة الوصول إلى بيانات Supabase
   ═══════════════════════════════════════════════════
   تحويل DB_SCHEMA (v15) إلى جداول Supabase والعكس،
   مع مزامنة غير متزامنة كاملة بعد كل saveDB().

   الجداول المستخدمة (من 01_schema.sql):
   app_settings, expense_categories, clients, client_services,
   transactions, debt_payments, expenses, expense_payments,
   expense_monthly_records, manual_debts, manual_debt_payments,
   installment_contracts, installments, installment_payments,
   deleted_items, activity_log, backups
   ═══════════════════════════════════════════════════ */

'use strict';

function _sbn(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : Math.trunc(n);
}

function _sbs(v) {
    if (v === undefined || v === null) return '';
    return String(v);
}

function _instPayTime(createdAt) {
    if (!createdAt) return '';
    var d = new Date(createdAt);
    if (isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* ═══════════════════════════════════════
   تحويل الصف (row) ← كائن JS
═══════════════════════════════════════ */

function rowToTx(r) {
    return {
        id: r.id,
        type: r.type,
        date: r.date || '',
        amount: _sbn(r.amount),
        basePrice: _sbn(r.base_price),
        salePrice: _sbn(r.sale_price),
        profit: _sbn(r.profit),
        balance: _sbn(r.balance),
        customer: _sbs(r.customer),
        airline: _sbs(r.airline),
        notes: _sbs(r.notes),
        clientId: r.client_id || 0,
        paymentMethod: r.payment_method,
        amountPaid: _sbn(r.amount_paid),
        remainingAmount: _sbn(r.remaining_amount),
        debtPayments: [],
        serviceType: r.service_type || 'ticket',
        bookingRef: _sbs(r.booking_ref),
        pnr: _sbs(r.pnr)
    };
}

function rowToExpense(r) {
    return {
        id: r.id,
        date: r.date || '',
        category: _sbs(r.category),
        name: _sbs(r.name),
        amount: _sbn(r.amount),
        amountPaid: _sbn(r.amount_paid),
        remaining: _sbn(r.remaining),
        payments: [],
        description: _sbs(r.description),
        notes: _sbs(r.notes),
        isRecurring: !!r.is_recurring,
        dueDay: _sbn(r.due_day),
        paymentStatus: r.payment_status || 'paid',
        monthlyRecords: []
    };
}

function rowToClient(r) {
    return {
        id: r.id,
        name: _sbs(r.name),
        phone: _sbs(r.phone),
        address: _sbs(r.address),
        notes: _sbs(r.notes),
        services: [],
        payments: []
    };
}

function rowToManualDebt(r) {
    return {
        id: r.id,
        name: _sbs(r.name),
        phone: _sbs(r.phone),
        date: r.date || '',
        totalAmount: _sbn(r.total_amount),
        amountPaid: _sbn(r.amount_paid),
        remaining: _sbn(r.remaining),
        reason: _sbs(r.reason),
        notes: _sbs(r.notes),
        payments: []
    };
}

function rowToContract(r) {
    return {
        id: r.id,
        name: _sbs(r.name),
        phone: _sbs(r.phone),
        description: _sbs(r.description),
        total: _sbn(r.total),
        advance: _sbn(r.advance),
        count: _sbn(r.count),
        instValue: _sbn(r.inst_value),
        startDate: r.start_date || '',
        period: r.period || 'monthly',
        notes: _sbs(r.notes),
        installments: [],
        payments: []
    };
}

function rowToDeletedItem(r) {
    var ms = Date.parse(r.deleted_at);
    return {
        id: r.id,
        type: r.item_type,
        data: r.data,
        displayName: _sbs(r.display_name),
        deletedAt: isNaN(ms) ? Date.now() : ms
    };
}

function rowToActivity(r) {
    return {
        id: r.id,
        date: _sbs(r.date),
        time: _sbs(r.time),
        employee: _sbs(r.employee),
        action: _sbs(r.action),
        description: _sbs(r.description)
    };
}

function rowToBackup(r) {
    return {
        key: _sbs(r.backup_key),
        timestamp: r.timestamp,
        fromVersion: _sbn(r.from_version),
        label: _sbs(r.label)
    };
}

/* ═══════════════════════════════════════
   تحويل كائن JS ← صف (row)
═══════════════════════════════════════ */

function txToRow(tx) {
    var paidSum = 0;
    if (Array.isArray(tx.debtPayments)) {
        for (var i = 0; i < tx.debtPayments.length; i++) paidSum += _sbn(tx.debtPayments[i].amount);
    }
    var amountPaid = _sbn(tx.amountPaid);
    var downPay = Math.max(0, amountPaid - paidSum);
    return {
        id: _sbn(tx.id),
        type: tx.type === 'increase' ? 'increase' : 'ticket',
        service_type: tx.serviceType || 'ticket',
        date: tx.date || new Date().toISOString().slice(0, 10),
        amount: _sbn(tx.amount),
        base_price: _sbn(tx.basePrice),
        sale_price: _sbn(tx.salePrice),
        profit: _sbn(tx.profit),
        balance: _sbn(tx.balance),
        customer: _sbs(tx.customer),
        airline: _sbs(tx.airline),
        notes: _sbs(tx.notes),
        client_id: _sbn(tx.clientId) > 0 ? _sbn(tx.clientId) : null,
        payment_method: tx.paymentMethod === 'debt' ? 'debt' : 'cash',
        down_payment: downPay,
        amount_paid: amountPaid,
        remaining_amount: _sbn(tx.remainingAmount),
        booking_ref: _sbs(tx.bookingRef),
        pnr: _sbs(tx.pnr)
    };
}

function expenseToRow(ex) {
    var amount = _sbn(ex.amount);
    var paid = _sbn(ex.amountPaid);
    var status = ex.paymentStatus || (paid >= amount && amount > 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'));
    return {
        id: _sbn(ex.id),
        date: ex.date || new Date().toISOString().slice(0, 10),
        category: _sbs(ex.category),
        name: _sbs(ex.name),
        amount: amount,
        amount_paid: paid,
        remaining: _sbn(ex.remaining),
        description: _sbs(ex.description),
        notes: _sbs(ex.notes),
        is_recurring: !!ex.isRecurring,
        due_day: Math.min(31, Math.max(0, _sbn(ex.dueDay))),
        payment_status: status
    };
}

function clientToRow(cl) {
    return {
        id: _sbn(cl.id),
        name: _sbs(cl.name),
        phone: _sbs(cl.phone),
        address: _sbs(cl.address),
        notes: _sbs(cl.notes)
    };
}

function manualDebtToRow(d) {
    return {
        id: _sbn(d.id),
        name: _sbs(d.name),
        phone: _sbs(d.phone),
        date: d.date || new Date().toISOString().slice(0, 10),
        total_amount: _sbn(d.totalAmount),
        amount_paid: _sbn(d.amountPaid),
        remaining: _sbn(d.remaining),
        reason: _sbs(d.reason),
        notes: _sbs(d.notes)
    };
}

function contractToRow(c) {
    return {
        id: _sbn(c.id),
        name: _sbs(c.name),
        phone: _sbs(c.phone),
        description: _sbs(c.description),
        total: _sbn(c.total),
        advance: _sbn(c.advance),
        count: _sbn(c.count),
        inst_value: _sbn(c.instValue),
        start_date: c.startDate || new Date().toISOString().slice(0, 10),
        period: c.period || 'monthly',
        notes: _sbs(c.notes)
    };
}

/* ═══════════════════════════════════════
   أدوات استعلام مساعدة
═══════════════════════════════════════ */

function sbSelect(client, table) {
    return client.from(table).select('*');
}

function sbSelectIn(client, table, col, ids) {
    if (!ids.length) return Promise.resolve([]);
    return client.from(table).select('*').in(col, ids);
}

/* جلب أقساط العقود بترتيب رقم القسط تصاعديًا (number ASC) */
function sbSelectInstallments(client, ids) {
    if (!ids.length) return Promise.resolve([]);
    return client.from('installments').select('*').in('contract_id', ids).order('number', { ascending: true });
}

function sbUpsertRows(client, table, rows, onConflict) {
    if (!rows.length) return Promise.resolve();
    return client.from(table).upsert(rows, { onConflict: onConflict || 'id' });
}

function sbDeleteOrphans(client, table, jsIds) {
    return client.from(table).select('id').then(function(res) {
        var set = {};
        for (var i = 0; i < jsIds.length; i++) set[jsIds[i]] = true;
        var toDelete = [];
        for (var j = 0; j < (res.data || []).length; j++) {
            if (!set[res.data[j].id]) toDelete.push(res.data[j].id);
        }
        if (!toDelete.length) return Promise.resolve();
        return client.from(table).delete().in('id', toDelete);
    });
}

function sbReplaceChildren(client, table, fk, parentIds, rows) {
    var del = parentIds.length
        ? client.from(table).delete().in(fk, parentIds)
        : Promise.resolve();
    return del.then(function() {
        if (!rows.length) return Promise.resolve();
        return client.from(table).insert(rows);
    });
}

/* ═══════════════════════════════════════
   الإعدادات (app_settings) + جلسة الموظف
═══════════════════════════════════════ */

function sbGetSettingsMap(client) {
    return client.from('app_settings').select('key,value').then(function(res) {
        var map = {};
        for (var i = 0; i < (res.data || []).length; i++) map[res.data[i].key] = res.data[i].value;
        return map;
    });
}

function sbSaveSettings(client) {
    var rows = [
        { key: 'currency', value: (db.settings && db.settings.currency) || 'IQD' },
        { key: 'language', value: (db.settings && db.settings.language) || 'ar' },
        { key: 'ui_theme', value: (db.settings && db.settings.ui_theme) || 'light' },
        { key: 'ui_font_size', value: (db.settings && db.settings.ui_font_size) || 'md' },
        { key: 'ui_density', value: (db.settings && db.settings.ui_density) || 'default' },
        { key: 'ui_layout', value: (db.settings && db.settings.ui_layout) || 'wide' },
        { key: 'created_at', value: (db.metadata && db.metadata.createdAt) || '' },
        { key: 'last_updated', value: (db.metadata && db.metadata.lastUpdated) || '' },
        { key: 'migrated_from', value: (db.metadata && db.metadata.migratedFrom) || '' }
    ];
    return client.from('app_settings').upsert(rows, { onConflict: 'key' });
}

function sbGetEmployeeSession() {
    return supabaseReady().then(function(client) {
        return client.auth.getSession().then(function(res) {
            var user = res && res.data && res.data.session && res.data.session.user;
            if (!user) return null;
            return client.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
        }).then(function(p) {
            if (!p || p.error || !p.data) return null;
            var name = String(p.data.full_name || '').trim();
            if (!name) return null;
            return { name: name, date: new Date().toISOString().split('T')[0] };
        });
    });
}

/* تحديث اسم الموظف في سجل profiles الخاص به فقط.
   السبب الجذري لخلط الأسماء: كان الكود يقرأ هوية المستخدم لحظة تنفيذ
   getSession() (بعد انتظار غير متزامن)، فإذا دخل موظف آخر في هذه الأثناء
   يُكتب اسم الأول على حساب الثاني. الحل: تثبيت user_id (auth.uid())
   عند طلب التحديث (uid) والكتابة على هذا السجل فقط مهما تغيّرت الجلسة لاحقاً. */
function sbUpdateProfileName(name, uid) {
    var targetId = String(uid || '');
    return supabaseReady().then(function(client) {
        var idPromise;
        if (targetId) {
            idPromise = Promise.resolve(targetId);
        } else {
            idPromise = client.auth.getSession().then(function(res) {
                var user = res && res.data && res.data.session && res.data.session.user;
                if (!user) throw new Error('لا توجد جلسة نشطة');
                return String(user.id);
            });
        }
        return idPromise.then(function(id) {
            return client.from('profiles').upsert(
                [{ id: id, full_name: String(name || '').trim() || 'موظف', role: 'employee' }],
                { onConflict: 'id' }
            );
        });
    });
}

/* ═══════════════════════════════════════
   تحميل كل البيانات (تحميل أولي)
═══════════════════════════════════════ */

function sbLoadAll() {
    return supabaseReady().then(function(client) {
        var fresh = (typeof createEmptyDB === 'function')
            ? createEmptyDB()
            : JSON.parse(JSON.stringify(window.DB_SCHEMA || { version: 15, settings: { currency: 'IQD', language: 'ar' }, transactions: [], expenses: [], expenseCategories: [], clients: [], manualDebts: [], installmentContracts: [], deletedItems: [], activityLog: [], backups: [], metadata: {} }));

        return sbGetSettingsMap(client).then(function(settingsMap) {
            fresh.settings.currency = settingsMap['currency'] || 'IQD';
            fresh.settings.language = settingsMap['language'] || 'ar';
            fresh.settings.ui_theme = settingsMap['ui_theme'] || 'light';
            fresh.settings.ui_font_size = settingsMap['ui_font_size'] || 'md';
            fresh.settings.ui_density = settingsMap['ui_density'] || 'default';
            fresh.settings.ui_layout = settingsMap['ui_layout'] || 'wide';
            fresh.metadata.createdAt = settingsMap['created_at'] || '';
            fresh.metadata.lastUpdated = settingsMap['last_updated'] || '';
            fresh.metadata.migratedFrom = settingsMap['migrated_from'] || null;
            if (!fresh.metadata.createdAt) fresh.metadata.createdAt = new Date().toISOString();
            if (!fresh.metadata.lastUpdated) fresh.metadata.lastUpdated = new Date().toISOString();

            return Promise.all([
                sbSelect(client, 'expense_categories'),
                sbSelect(client, 'transactions'),
                sbSelect(client, 'expenses'),
                sbSelect(client, 'clients'),
                sbSelect(client, 'manual_debts'),
                sbSelect(client, 'installment_contracts'),
                sbSelect(client, 'deleted_items'),
                sbSelect(client, 'activity_log'),
                sbSelect(client, 'backups')
            ]).then(function(results) {
                var cats = results[0].data || [];
                var txs = results[1].data || [];
                var exps = results[2].data || [];
                var clts = results[3].data || [];
                var mds = results[4].data || [];
                var insts = results[5].data || [];
                var dels = results[6].data || [];
                var acts = results[7].data || [];
                var bks = results[8].data || [];

                fresh.expenseCategories = cats.map(function(c) { return c.name; });
                fresh.transactions = txs.map(rowToTx);
                fresh.expenses = exps.map(rowToExpense);
                fresh.clients = clts.map(rowToClient);
                fresh.manualDebts = mds.map(rowToManualDebt);
                fresh.installmentContracts = insts.map(rowToContract);
                fresh.deletedItems = dels.map(rowToDeletedItem);
                fresh.activityLog = acts.map(rowToActivity);
                fresh.backups = bks.map(rowToBackup);

                var txIds = fresh.transactions.map(function(t) { return t.id; });
                var expIds = fresh.expenses.map(function(e) { return e.id; });
                var clientIds = fresh.clients.map(function(c) { return c.id; });
                var mdIds = fresh.manualDebts.map(function(d) { return d.id; });
                var instIds = fresh.installmentContracts.map(function(c) { return c.id; });

                return Promise.all([
                    sbSelectIn(client, 'debt_payments', 'transaction_id', txIds),
                    sbSelectIn(client, 'expense_payments', 'expense_id', expIds),
                    sbSelectIn(client, 'expense_monthly_records', 'expense_id', expIds),
                    sbSelectIn(client, 'client_services', 'client_id', clientIds),
                    sbSelectIn(client, 'manual_debt_payments', 'manual_debt_id', mdIds),
                    sbSelectInstallments(client, instIds),
                    sbSelectIn(client, 'installment_payments', 'contract_id', instIds)
                ]).then(function(childResults) {
                    var debtPays = childResults[0].data || [];
                    var expPays = childResults[1].data || [];
                    var expMonths = childResults[2].data || [];
                    var clientSvcs = childResults[3].data || [];
                    var mdPays = childResults[4].data || [];
                    var installs = childResults[5].data || [];
                    var instPays = childResults[6].data || [];

                    attachDebtPayments(fresh.transactions, debtPays);
                    attachExpenseChildren(fresh.expenses, expPays, expMonths);
                    attachClientServices(fresh.clients, clientSvcs);
                    attachManualDebtPayments(fresh.manualDebts, mdPays);
                    attachInstallmentChildren(fresh.installmentContracts, installs, instPays);

                    return fresh;
                });
            });
        });
    });
}

function attachDebtPayments(txs, rows) {
    var byId = {};
    for (var i = 0; i < rows.length; i++) {
        var txId = rows[i].transaction_id;
        if (!byId[txId]) byId[txId] = [];
        byId[txId].push({ id: rows[i].id, date: rows[i].date, amount: _sbn(rows[i].amount), notes: rows[i].notes || '' });
    }
    for (var j = 0; j < txs.length; j++) {
        if (byId[txs[j].id]) txs[j].debtPayments = byId[txs[j].id];
    }
}

function attachExpenseChildren(exps, pays, months) {
    var byPay = {};
    for (var i = 0; i < pays.length; i++) {
        var eid = pays[i].expense_id;
        if (!byPay[eid]) byPay[eid] = [];
        byPay[eid].push({ date: pays[i].date, amount: _sbn(pays[i].amount), notes: pays[i].notes || '' });
    }
    var byMonth = {};
    for (var j = 0; j < months.length; j++) {
        var mid = months[j].expense_id;
        if (!byMonth[mid]) byMonth[mid] = [];
        byMonth[mid].push({ month: months[j].month, status: months[j].status, paidDate: months[j].paid_date });
    }
    for (var k = 0; k < exps.length; k++) {
        var eid2 = exps[k].id;
        if (byPay[eid2]) exps[k].payments = byPay[eid2];
        if (byMonth[eid2]) exps[k].monthlyRecords = byMonth[eid2];
    }
}

function attachClientServices(clients, rows) {
    var byId = {};
    for (var i = 0; i < rows.length; i++) {
        var cid = rows[i].client_id;
        if (!byId[cid]) byId[cid] = [];
        byId[cid].push({ id: rows[i].id, date: rows[i].date, description: rows[i].description || '', amount: _sbn(rows[i].amount), paymentMethod: rows[i].payment_method });
    }
    for (var j = 0; j < clients.length; j++) {
        if (byId[clients[j].id]) clients[j].services = byId[clients[j].id];
    }
}

function attachManualDebtPayments(debts, rows) {
    var byId = {};
    for (var i = 0; i < rows.length; i++) {
        var did = rows[i].manual_debt_id;
        if (!byId[did]) byId[did] = [];
        byId[did].push({ date: rows[i].date, amount: _sbn(rows[i].amount), notes: rows[i].notes || '' });
    }
    for (var j = 0; j < debts.length; j++) {
        if (byId[debts[j].id]) debts[j].payments = byId[debts[j].id];
    }
}

function attachInstallmentChildren(contracts, installs, pays) {
    var byContract = {};
    for (var i = 0; i < installs.length; i++) {
        var cid = installs[i].contract_id;
        if (!byContract[cid]) byContract[cid] = [];
        byContract[cid].push({ id: installs[i].id, number: _sbn(installs[i].number), dueDate: installs[i].due_date, amount: _sbn(installs[i].amount), paid: _sbn(installs[i].paid), status: installs[i].status, payments: [] });
    }
    var instById = {};
    for (var j = 0; j < installs.length; j++) {
        instById[installs[j].id] = { contractId: installs[j].contract_id, instIndex: -1 };
    }
    for (var c = 0; c < contracts.length; c++) {
        var list = byContract[contracts[c].id];
        if (list) {
            /* الترتيب الرسمي للأقساط هو رقم القسط (number) — دائمًا تصاعديًا،
               ولا يتأثر بحالة القسط ولا بتاريخ الاستحقاق ولا بترتيب الصفوف القادمة من الخادم. */
            list.sort(function(a, b) { return _sbn(a.number) - _sbn(b.number); });
            contracts[c].installments = list;
            for (var k = 0; k < list.length; k++) {
                if (instById[list[k].id]) instById[list[k].id].instIndex = k;
            }
        }
    }
    var byContractPay = {};
    for (var p = 0; p < pays.length; p++) {
        var pcid = pays[p].contract_id;
        if (!byContractPay[pcid]) byContractPay[pcid] = [];
        var pay = {
            id: (pays[p].id !== undefined && pays[p].id !== null) ? ('r' + pays[p].id) : undefined,
            date: pays[p].date,
            time: _instPayTime(pays[p].created_at),
            amount: _sbn(pays[p].amount),
            employee: pays[p].employee || '',
            notes: pays[p].notes || ''
        };
        var iid = pays[p].installment_id;
        if (iid !== null && iid !== undefined && instById[iid]) {
            var holder = byContract[instById[iid].contractId];
            if (holder && holder[instById[iid].instIndex]) {
                holder[instById[iid].instIndex].payments.push(pay);
                continue;
            }
        }
        byContractPay[pcid].push(pay);
    }
    /* المدفوع الفعلي لكل قسط = سجل الدفعات المرتبط به (المصدر الموثوق)،
       مع الاحتفاظ بالعمود المحفوظ كمكمّل فقط — فيُعالج أي تباين قديم. */
    for (var n = 0; n < contracts.length; n++) {
        var instList = contracts[n].installments;
        if (!Array.isArray(instList)) continue;
        for (var o = 0; o < instList.length; o++) {
            var instP = instList[o];
            if (!Array.isArray(instP.payments)) continue;
            var sumP = 0;
            for (var r2 = 0; r2 < instP.payments.length; r2++) sumP += _sbn(instP.payments[r2].amount);
            instP.paid = Math.max(_sbn(instP.paid), sumP);
        }
    }
    for (var c2 = 0; c2 < contracts.length; c2++) {
        if (byContractPay[contracts[c2].id]) contracts[c2].payments = byContractPay[contracts[c2].id];
    }
}

/* ═══════════════════════════════════════
   الحفظ الكامل (مزامنة كاملة)
═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   قواعد التحقق من الصفوف قبل إرسالها إلى الخادم
   — مطابقة للقيود الفعلية في supabase/01_schema.sql —
   الهدف: لا يُوقف سجل معطوب حفظ الدفعة كلها؛ يُستثنى ويُسجَّل خطؤه.
═══════════════════════════════════════ */

var _SB_ENUM = {
    transactions: { type: ['increase', 'ticket'], service_type: ['ticket', 'visa', 'hotel', 'esim'], payment_method: ['cash', 'debt'] },
    expenses: { payment_status: ['paid', 'partial', 'unpaid'] },
    installment_contracts: { period: ['weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'custom'] },
    installments: { status: ['paid', 'unpaid', 'partial', 'overdue', 'cancelled'] },
    expense_monthly_records: { status: ['paid', 'unpaid'] },
    deleted_items: { item_type: ['transaction', 'expense', 'client', 'service', 'manualDebt', 'installmentContract'] },
    client_services: { payment_method: ['cash', 'debt'] }
};

var _SB_REQUIRED = {
    clients: ['name'],
    manual_debts: ['name'],
    installment_contracts: ['name'],
    installments: ['due_date']
};

var _SB_NONNEG = {
    transactions: ['amount', 'base_price', 'sale_price', 'amount_paid', 'down_payment', 'remaining_amount'],
    expenses: ['amount', 'amount_paid', 'remaining'],
    manual_debts: ['total_amount', 'amount_paid', 'remaining'],
    installment_contracts: ['total', 'advance', 'count', 'inst_value'],
    installments: ['amount', 'paid'],
    installment_payments: ['amount'],
    debt_payments: ['amount'],
    expense_payments: ['amount'],
    manual_debt_payments: ['amount'],
    client_services: ['amount']
};

var _SB_RANGES = {
    expenses: { due_day: [0, 31] }
};

function _sbValidateRow(table, row) {
    if (!row || typeof row !== 'object') return 'سجل فارغ';
    var errs = [];
    var req = _SB_REQUIRED[table];
    if (req) {
        for (var r = 0; r < req.length; r++) {
            var v = row[req[r]];
            if (v === undefined || v === null || v === '') {
                errs.push('الحقل ' + req[r] + ' مطلوب');
            }
        }
    }
    var en = _SB_ENUM[table];
    if (en) {
        for (var col in en) {
            if (en[col].indexOf(row[col]) === -1) {
                errs.push('الحقل ' + col + ' = ' + JSON.stringify(row[col]) + ' غير مسموح');
            }
        }
    }
    var nn = _SB_NONNEG[table];
    if (nn) {
        for (var i = 0; i < nn.length; i++) {
            var v2 = row[nn[i]];
            if (typeof v2 !== 'number' || !(v2 >= 0) || Math.floor(v2) !== v2) {
                errs.push('الحقل ' + nn[i] + ' = ' + JSON.stringify(v2) + ' يجب أن يكون عدداً غير سالب');
            }
        }
    }
    var rg = _SB_RANGES[table];
    if (rg) {
        for (var col2 in rg) {
            var v3 = row[col2];
            if (v3 < rg[col2][0] || v3 > rg[col2][1]) {
                errs.push('الحقل ' + col2 + ' = ' + JSON.stringify(v3) + ' خارج النطاق ' + rg[col2][0] + '-' + rg[col2][1]);
            }
        }
    }
    if (table === 'expense_monthly_records') {
        if (!/^[0-9]{4}-[0-9]{2}$/.test(String(row.month || ''))) {
            errs.push('شهر غير صالح: ' + JSON.stringify(row.month));
        }
    }
    return errs.join('؛ ');
}

function _sbBuildParentRows(table, items, mapper, errors) {
    var rows = [];
    var seen = {};
    for (var i = 0; i < items.length; i++) {
        var row = mapper(items[i]);
        var err = _sbValidateRow(table, row);
        if (err) {
            errors.push({ table: table, id: (items[i] && items[i].id !== undefined) ? items[i].id : i, error: err });
            continue;
        }
        if (row.id > 0) {
            if (seen[row.id]) continue;
            seen[row.id] = true;
        }
        rows.push(row);
    }
    return rows;
}

function _sbDedupById(rows) {
    var seen = {};
    var out = [];
    for (var i = 0; i < rows.length; i++) {
        var id = rows[i].id;
        if (id > 0 && seen[id]) continue;
        if (id > 0) seen[id] = true;
        out.push(rows[i]);
    }
    return out;
}

function _sbFilterByIds(items, ids) {
    var set = {};
    for (var i = 0; i < ids.length; i++) set[ids[i]] = true;
    var out = [];
    for (var j = 0; j < items.length; j++) if (set[items[j].id]) out.push(items[j]);
    return out;
}

/* تاريخ استحقاق آمن للقسط قبل الحفظ:
   يُبقي تاريخ القسط الحقيقي كما هو إن وُجد، وإن نقص أو كان غير صالح
   يستند إلى تاريخ بدء العقد ثم تاريخ اليوم — بدل استبعاد القسط كلياً،
   وهو ما كان يسبب صامتاً فقدان دفعاته أيضاً من الحفظ. */
function _sbSafeDueDate(con, inst) {
    var iso = /^[0-9]{4}-[0-9]{2}-[0-9]{2}/;
    if (inst && iso.test(String(inst.dueDate || ''))) return String(inst.dueDate).slice(0, 10);
    if (con && iso.test(String(con.startDate || ''))) return String(con.startDate).slice(0, 10);
    return new Date().toISOString().slice(0, 10);
}

function _sbBuildPayRows(table, parents, fk, childKey, errors) {
    var rows = [];
    for (var i = 0; i < parents.length; i++) {
        var p = parents[i];
        if (!Array.isArray(p[childKey])) continue;
        for (var j = 0; j < p[childKey].length; j++) {
            var c = p[childKey][j];
            var row = {};
            row[fk] = p.id;
            row.date = c.date || new Date().toISOString().slice(0, 10);
            row.amount = _sbn(c.amount);
            row.notes = c.notes || '';
            var err = _sbValidateRow(table, row);
            if (err) {
                errors.push({ table: table, id: p.id, error: err });
                continue;
            }
            rows.push(row);
        }
    }
    return rows;
}

function sbSaveAll() {
    if (!db) return Promise.resolve();
    return supabaseReady().then(function(client) {

        /* 1) الإعدادات + metadata */
        return sbSaveSettings(client).then(function(res) {
            if (res.error) throw res.error;

            /* 2) فئات المصروفات (بدون حذف الفئات الافتراضية) */
            return sbSaveCategories(client);
        }).then(function() {

            /* 3) الجداول الأم — تُرفع بالتسلسل بترتيب المفاتيح الأجنبية:
               clients ← manual_debts ← installment_contracts ← transactions ← expenses
               (transactions.client_id يشير إلى clients؛ الرفع المتوازي سابقاً كان
               يجعل transactions تسبق clients على قاعدة فارغة فيفشل بخطأ FK) */

            var parentErrors = [];

            /* 3.1) تعقيم الإشارات الشاردة: client_id لعميل غير موجود يُحذف بدل إفشال الحفظ */
            var validClientIds = {};
            for (var vci = 0; vci < db.clients.length; vci++) validClientIds[db.clients[vci].id] = true;

            /* 3.2) بناء صفوف الجداول الأم مع التحقق — لا يُوقف سجل معطوب الدفعة كلها */
            var clientRows = _sbBuildParentRows('clients', db.clients, clientToRow, parentErrors);
            var mdRows = _sbBuildParentRows('manual_debts', db.manualDebts, manualDebtToRow, parentErrors);
            var conRows = _sbBuildParentRows('installment_contracts', db.installmentContracts, contractToRow, parentErrors);

            var txRows = [];
            for (var ti = 0; ti < db.transactions.length; ti++) {
                var trow = txToRow(db.transactions[ti]);
                if (trow.client_id !== null && !validClientIds[trow.client_id]) trow.client_id = null;
                var terr = _sbValidateRow('transactions', trow);
                if (terr) parentErrors.push({ table: 'transactions', id: db.transactions[ti].id, error: terr });
                else txRows.push(trow);
            }
            txRows = _sbDedupById(txRows);

            var expRows = [];
            for (var ei = 0; ei < db.expenses.length; ei++) {
                var erow = expenseToRow(db.expenses[ei]);
                var eerr = _sbValidateRow('expenses', erow);
                if (eerr) parentErrors.push({ table: 'expenses', id: db.expenses[ei].id, error: eerr });
                else expRows.push(erow);
            }
            expRows = _sbDedupById(expRows);

            if (parentErrors.length) {
                console.warn('[sbSaveAll] سجلات مستثناة من الحفظ بسبب بيانات معطوبة:', parentErrors);
            }

            return sbUpsertRows(client, 'clients', clientRows)
                .then(function(r) { if (r && r.error) throw r.error; return sbUpsertRows(client, 'manual_debts', mdRows); })
                .then(function(r) { if (r && r.error) throw r.error; return sbUpsertRows(client, 'installment_contracts', conRows); })
                .then(function(r) { if (r && r.error) throw r.error; return sbUpsertRows(client, 'transactions', txRows); })
                .then(function(r) { if (r && r.error) throw r.error; return sbUpsertRows(client, 'expenses', expRows); })
                .then(function() {

                    /* 3.3) قوائم المعرفات والجداول الأبناء — فقط للصفوف المضمّنة في الحفظ */
                    var txIds = txRows.map(function(r) { return r.id; });
                    var expIds = expRows.map(function(r) { return r.id; });
                    var clientIds = clientRows.map(function(r) { return r.id; });
                    var mdIds = mdRows.map(function(r) { return r.id; });
                    var instIds = conRows.map(function(r) { return r.id; });

                    var dbTx = _sbFilterByIds(db.transactions, txIds);
                    var dbExp = _sbFilterByIds(db.expenses, expIds);
                    var dbCli = _sbFilterByIds(db.clients, clientIds);
                    var dbMd = _sbFilterByIds(db.manualDebts, mdIds);
                    var dbCon = _sbFilterByIds(db.installmentContracts, instIds);

                    var childErrors = [];

                    /* 4) دفعات الديون على التذاكر */
                    var debtPayRows = _sbBuildPayRows('debt_payments', dbTx, 'transaction_id', 'debtPayments', childErrors);

                    /* 5) دفعات المصاريف + السجلات الشهرية */
                    var expPayRows = _sbBuildPayRows('expense_payments', dbExp, 'expense_id', 'payments', childErrors);
                    var expMonthRows = [];
                    for (var e = 0; e < dbExp.length; e++) {
                        var ex = dbExp[e];
                        if (!Array.isArray(ex.monthlyRecords)) continue;
                        var seenMonths = {};
                        for (var em = 0; em < ex.monthlyRecords.length; em++) {
                            var mr = ex.monthlyRecords[em];
                            var mk = String(mr.month || '');
                            if (seenMonths[mk]) continue;
                            seenMonths[mk] = true;
                            var mrow = { expense_id: ex.id, month: mk, status: mr.status === 'paid' ? 'paid' : 'unpaid', paid_date: mr.paidDate || null };
                            var merr = _sbValidateRow('expense_monthly_records', mrow);
                            if (merr) childErrors.push({ table: 'expense_monthly_records', id: mk, error: merr });
                            else expMonthRows.push(mrow);
                        }
                    }

                    /* 6) خدمات العملاء */
                    var clientSvcRows = [];
                    for (var c = 0; c < dbCli.length; c++) {
                        var cl = dbCli[c];
                        if (!Array.isArray(cl.services)) continue;
                        for (var cs = 0; cs < cl.services.length; cs++) {
                            var sv = cl.services[cs];
                            var srow = { id: _sbn(sv.id), client_id: cl.id, date: sv.date || new Date().toISOString().slice(0, 10), description: sv.description || '', amount: _sbn(sv.amount), payment_method: sv.paymentMethod === 'debt' ? 'debt' : 'cash' };
                            var serr = _sbValidateRow('client_services', srow);
                            if (serr) childErrors.push({ table: 'client_services', id: _sbn(sv.id), error: serr });
                            else clientSvcRows.push(srow);
                        }
                    }

                    /* 7) دفعات الديون اليدوية */
                    var mdPayRows = _sbBuildPayRows('manual_debt_payments', dbMd, 'manual_debt_id', 'payments', childErrors);

                    /* 8) أقساط العقود + دفعاتها
                       الأقساط الناقصة number (صيغة CSV مثلاً) تُرقَّم تلقائياً بدل إرسال 0 المكرر؛
                       والأقساط الجديدة (بلا معرف محلي) تُدرج دون id ليولّدها الخادم (bigserial)،
                       ثم تُربط المعرفات الحقيقية بواسطة contract_id + number (المضمون تفرده بالترقيم)،
                       ثم تُبنى دفعات الأقساط بالمعرفات الحقيقية. */
                    var instRows = [];
                    var excludedInstIds = {};
                    for (var i2 = 0; i2 < dbCon.length; i2++) {
                        var con = dbCon[i2];
                        if (!Array.isArray(con.installments)) continue;
                        for (var ii = 0; ii < con.installments.length; ii++) {
                            var inst = con.installments[ii];
                            if (!inst) continue;
                            var instNum = _sbn(inst.number);
                            if (instNum < 1) { instNum = ii + 1; inst.number = instNum; }
                            var irow = {
                                contract_id: con.id,
                                number: instNum,
                                due_date: _sbSafeDueDate(con, inst),
                                amount: _sbn(inst.amount),
                                paid: _sbn(inst.paid),
                                status: ['paid', 'unpaid', 'partial', 'overdue', 'cancelled'].indexOf(inst.status) !== -1 ? inst.status : 'unpaid'
                            };
                            var instId = _sbn(inst.id);
                            if (instId > 0) irow.id = instId;
                            var ierr = _sbValidateRow('installments', irow);
                            if (ierr) {
                                excludedInstIds[instId] = true;
                                parentErrors.push({ table: 'installments', id: instId, error: ierr });
                                continue;
                            }
                            instRows.push(irow);
                        }
                    }

                    /* 9) سلة المحذوفات + سجل النشاط */
                    var deletedRows = [];
                    var seenDeleted = {};
                    for (var dm = 0; dm < db.deletedItems.length; dm++) {
                        var item = db.deletedItems[dm];
                        var did = _sbn(item.id);
                        if (did > 0 && seenDeleted[did]) continue;
                        if (did > 0) seenDeleted[did] = true;
                        if (_SB_ENUM.deleted_items.item_type.indexOf(item.type) === -1) continue;
                        var ms = _sbn(item.deletedAt) || Date.now();
                        deletedRows.push({ id: did, item_type: item.type, data: item.data || {}, display_name: item.displayName || '', deleted_at: new Date(ms).toISOString() });
                    }
                    var activityRows = db.activityLog.map(function(entry) {
                        return { id: _sbn(entry.id), date: entry.date || '', time: entry.time || '', employee: entry.employee || '', action: entry.action || '', description: entry.description || '' };
                    });

                    if (childErrors.length) {
                        console.warn('[sbSaveAll] سجلات أبناء مستثناة من الحفظ بسبب بيانات معطوبة:', childErrors);
                    }

                    /* تنفيذ بالتسلسل لضمان ترتيب المفاتيح الأجنبية */
                    return sbReplaceChildren(client, 'debt_payments', 'transaction_id', txIds, debtPayRows)
                        .then(function(r) { if (r && r.error) throw r.error; return sbReplaceChildren(client, 'expense_payments', 'expense_id', expIds, expPayRows); })
                        .then(function(r) { if (r && r.error) throw r.error; return sbReplaceChildren(client, 'expense_monthly_records', 'expense_id', expIds, expMonthRows); })
                        .then(function(r) { if (r && r.error) throw r.error; return sbReplaceChildren(client, 'client_services', 'client_id', clientIds, clientSvcRows); })
                        .then(function(r) { if (r && r.error) throw r.error; return sbReplaceChildren(client, 'manual_debt_payments', 'manual_debt_id', mdIds, mdPayRows); })
                        .then(function(r) {
                            if (r && r.error) throw r.error;
                            /* دفعات الأقساط تُحذف أولاً ثم تُعاد إدراجها بعد الأقساط —
                               خطأ الحذف يُفحص ولا يُبتلع (الحذف فشل = تكرار الدفعات) */
                            var delInstPay = instIds.length
                                ? client.from('installment_payments').delete().in('contract_id', instIds)
                                : Promise.resolve();
                            return delInstPay.then(function(dr) {
                                if (dr && dr.error) throw dr.error;
                            });
                        })
                        .then(function() {
                            /* .select() ضروري — بدونه يُرجع Supabase data:null ولا نستطيع
                               التقاط معرّفات الخادم لتوثيقها على الأقساط في الذاكرة */
                            return client.from('installments').upsert(instRows, { onConflict: 'id' }).select();
                        })
                        .then(function(r) {
                            if (r && r.error) throw r.error;
                            /* ربط المعرفات الصادرة من الخادم بالأقساط في الذاكرة */
                            if (r && Array.isArray(r.data) && r.data.length) {
                                var idMap = {};
                                for (var bi = 0; bi < r.data.length; bi++) {
                                    var row2 = r.data[bi];
                                    idMap[String(row2.contract_id) + ':' + _sbn(row2.number)] = _sbn(row2.id);
                                }
                                for (var ci = 0; ci < db.installmentContracts.length; ci++) {
                                    var con2 = db.installmentContracts[ci];
                                    if (!Array.isArray(con2.installments)) continue;
                                    for (var cj = 0; cj < con2.installments.length; cj++) {
                                        var inst2 = con2.installments[cj];
                                        var realId = idMap[String(con2.id) + ':' + _sbn(inst2.number)];
                                        if (realId) inst2.id = realId;
                                    }
                                }
                            }
                            /* بناء دفعات الأقساط بالمعرفات الحقيقية بعد معرفتها */
                            var instPayRows = [];
                            var mkInstPayRow = function(cid, iid, py) {
                                if (_sbn(py.amount) < 0) return null;
                                /* تاريخ الدفعة يُحفظ كما هو إن كان صالحاً (Y-M-D)؛
                                   وإن نقص/خالف الصيغة يُعوَّض بتاريخ اليوم كي لا تُسقط
                                   الدفعة ولا يتعطل حفظ بقية الدفعات على الإدراج */
                                var iso = /^[0-9]{4}-[0-9]{2}-[0-9]{2}/;
                                var safeDate = (py.date && iso.test(String(py.date)))
                                    ? String(py.date).slice(0, 10)
                                    : new Date().toISOString().slice(0, 10);
                                var row = {
                                    contract_id: cid,
                                    installment_id: iid,
                                    date: safeDate,
                                    amount: _sbn(py.amount),
                                    employee: py.employee || '',
                                    notes: py.notes || ''
                                };
                                if (py.time) {
                                    var ts = new Date(String(safeDate) + 'T' + String(py.time) + ':00');
                                    if (!isNaN(ts.getTime())) row.created_at = ts.toISOString();
                                }
                                return row;
                            };
                            for (var i3 = 0; i3 < dbCon.length; i3++) {
                                var con3 = dbCon[i3];
                                if (Array.isArray(con3.installments)) {
                                    for (var i4 = 0; i4 < con3.installments.length; i4++) {
                                        var inst3 = con3.installments[i4];
                                        if (excludedInstIds[_sbn(inst3.id)]) continue;
                                        if (!Array.isArray(inst3.payments)) continue;
                                        for (var i5 = 0; i5 < inst3.payments.length; i5++) {
                                            var p3 = mkInstPayRow(con3.id, _sbn(inst3.id), inst3.payments[i5]);
                                            if (p3) instPayRows.push(p3);
                                        }
                                    }
                                }
                                if (Array.isArray(con3.payments)) {
                                    for (var i6 = 0; i6 < con3.payments.length; i6++) {
                                        var p4 = mkInstPayRow(con3.id, null, con3.payments[i6]);
                                        if (p4) instPayRows.push(p4);
                                    }
                                }
                            }
                            if (instPayRows.length) {
                                /* فحص خطأ إدراج دفعات الأقساط — لا يُبتلع خطأ الدفعات صامتاً،
                                   وإلا يُظهر النظام «تم الحفظ بنجاح» والدفعات مفقودة فعلاً */
                                return client.from('installment_payments').insert(instPayRows).then(function(pr) {
                                    if (pr && pr.error) throw pr.error;
                                });
                            }
                            return Promise.resolve();
                        })
                        .then(function() {
                            /* 9.5) سلة المحذوفات + سجل النشاط — إدراج/تحديث */
                            return sbUpsertRows(client, 'deleted_items', deletedRows);
                        })
                        .then(function(r) {
                            if (r && r.error) throw r.error;
                            return sbUpsertRows(client, 'activity_log', activityRows);
                        });
                });
        }).then(function() {
            /* 10) حذف الأيتام (السجلات غير الموجودة في الذاكرة) */
            return Promise.all([
                sbDeleteOrphans(client, 'transactions', db.transactions.map(function(t) { return t.id; })),
                sbDeleteOrphans(client, 'expenses', db.expenses.map(function(e) { return e.id; })),
                sbDeleteOrphans(client, 'clients', db.clients.map(function(c) { return c.id; })),
                sbDeleteOrphans(client, 'manual_debts', db.manualDebts.map(function(d) { return d.id; })),
                sbDeleteOrphans(client, 'installment_contracts', db.installmentContracts.map(function(c) { return c.id; })),
                sbDeleteOrphans(client, 'installments', collectInstallmentIds(db.installmentContracts)),
                sbDeleteOrphans(client, 'deleted_items', db.deletedItems.map(function(i) { return i.id; })),
                sbDeleteOrphans(client, 'activity_log', db.activityLog.map(function(a) { return a.id; }))
            ]);
        }).then(function(orphanResults) {
            for (var i = 0; i < orphanResults.length; i++) {
                if (orphanResults[i] && orphanResults[i].error) throw orphanResults[i].error;
            }

            /* 11) النسخ الاحتياطية — إعادة بناء كاملة (أيضاً حذف النسخ القديمة) */
            return client.from('backups').delete().gte('id', 0);
        }).then(function(res) {
            if (res.error) throw res.error;
            if (Array.isArray(db.backups) && db.backups.length) {
                var bkRows = db.backups.map(function(b) {
                    return { backup_key: b.key, timestamp: b.timestamp || new Date().toISOString(), from_version: _sbn(b.fromVersion), label: b.label || '' };
                });
                return client.from('backups').insert(bkRows);
            }
            return Promise.resolve();
        });
    });
}

function collectInstallmentIds(contracts) {
    var ids = [];
    for (var i = 0; i < contracts.length; i++) {
        if (Array.isArray(contracts[i].installments)) {
            for (var j = 0; j < contracts[i].installments.length; j++) {
                ids.push(_sbn(contracts[i].installments[j].id));
            }
        }
    }
    return ids;
}

function sbSaveCategories(client) {
    var list = [];
    for (var i = 0; i < (db.expenseCategories || []).length; i++) {
        var name = String(db.expenseCategories[i] || '').trim();
        if (name) list.push(name);
    }
    return client.from('expense_categories').select('id,name').then(function(res) {
        if (res.error) throw res.error;
        var cur = res.data || [];
        var curNames = {};
        for (var c = 0; c < cur.length; c++) curNames[cur[c].name] = cur[c].id;
        var toInsert = [];
        for (var i2 = 0; i2 < list.length; i2++) {
            if (!curNames[list[i2]]) toInsert.push({ name: list[i2] });
        }
        var toDelete = [];
        for (var c2 = 0; c2 < cur.length; c2++) {
            if (list.indexOf(cur[c2].name) === -1) toDelete.push(cur[c2].id);
        }
        return Promise.resolve()
            .then(function() {
                if (!toInsert.length) return Promise.resolve();
                return client.from('expense_categories').insert(toInsert);
            })
            .then(function(r) {
                if (r && r.error) throw r.error;
                if (!toDelete.length) return Promise.resolve();
                return client.from('expense_categories').delete().in('id', toDelete);
            });
    });
}

/* ═══════════════════════════════════════
   قائمة المزامنة غير المتزامنة
   (يستدعيها saveDB في script.js)
═══════════════════════════════════════ */

var _syncTimer = null;
var _syncRunning = false;
var _syncQueued = false;
var _syncToastShown = false;

function sbScheduleSync() {
    if (!isSupabaseConfigured()) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(sbRunSync, 400);
}

function sbRunSync() {
    if (!db) return Promise.resolve();
    if (_syncRunning) {
        _syncQueued = true;
        return Promise.resolve();
    }
    _syncRunning = true;
    return sbSaveAll().then(function() {
        if (_syncToastShown) _syncToastShown = false;
    }).catch(function(err) {
        console.error('Supabase sync failed:', err);
        if (!_syncToastShown) {
            _syncToastShown = true;
            if (typeof toast === 'function') {
                var detail = (err && err.message) ? String(err.message) : ((err && err.details) ? String(err.details) : '');
                if (detail && detail.length > 220) detail = detail.slice(0, 220) + '…';
                toast('تعذر حفظ البيانات على الخادم' + (detail ? ' — ' + detail : ''), 'error');
            }
        }
    }).then(_sbFinishSync, _sbFinishSync);
}

/* إنهاء دورة المزامنة دائماً (نجاحاً أو فشلاً):
   تحرير القفل، إشعار المنتظرين، وتشغيل أي مزامنة مُجدولة لاحقاً */
function _sbFinishSync() {
    _syncRunning = false;
    var waiters = _sbSyncWaiters;
    _sbSyncWaiters = [];
    for (var w = 0; w < waiters.length; w++) waiters[w]();
    if (_syncQueued) {
        _syncQueued = false;
        _syncTimer = setTimeout(sbRunSync, 60);
    }
}

var _sbSyncWaiters = [];

function sbWaitForSyncIdle() {
    if (!_syncRunning) return Promise.resolve();
    return new Promise(function(resolve) { _sbSyncWaiters.push(resolve); });
}

/* مزامنة فورية تُرجع Promise بحفظ فعلي مكتمل — يستخدمها تدفق الاستيراد
   للانتظار والتحقق من النتيجة قبل إعادة تحميل الصفحة.
   تتقاسم قائمة المزامنة مع sbRunSync لمنع تداخل الحفظ المتزامن،
   وتُعيد الخطأ للاستدعاء بدل عرض رسالة عامة. */
function sbSyncNow() {
    if (!db) return Promise.resolve();
    if (!isSupabaseConfigured()) return Promise.resolve();

    var run = function() {
        _syncRunning = true;
        return sbSaveAll().then(function() {
            if (_syncToastShown) _syncToastShown = false;
        }).catch(function(err) {
            console.error('Supabase sync failed:', err);
            throw err;
        }).then(_sbFinishSync, _sbFinishSync);
    };

    if (_syncRunning) {
        _syncQueued = true;
        return sbWaitForSyncIdle().then(run);
    }
    return run();
}

window.addEventListener('pagehide', function() {
    if (_syncTimer) {
        clearTimeout(_syncTimer);
        _syncTimer = null;
    }
    if (db && !_syncRunning) sbSyncNow().catch(function() {});
});
