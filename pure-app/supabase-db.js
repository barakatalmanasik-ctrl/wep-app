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
        date: tx.date || null,
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
        date: ex.date || null,
        category: _sbs(ex.category),
        name: _sbs(ex.name),
        amount: amount,
        amount_paid: paid,
        remaining: _sbn(ex.remaining),
        description: _sbs(ex.description),
        notes: _sbs(ex.notes),
        is_recurring: !!ex.isRecurring,
        due_day: _sbn(ex.dueDay),
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
        date: d.date || null,
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
        start_date: c.startDate || null,
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

function sbUpdateProfileName(name) {
    return supabaseReady().then(function(client) {
        return client.auth.getSession().then(function(res) {
            var user = res && res.data && res.data.session && res.data.session.user;
            if (!user) throw new Error('لا توجد جلسة نشطة');
            return client.from('profiles').upsert(
                [{ id: user.id, full_name: String(name || '').trim() || 'موظف', role: 'employee' }],
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
                    sbSelectIn(client, 'installments', 'contract_id', instIds),
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
        byContract[cid].push({ id: installs[i].id, number: installs[i].number, dueDate: installs[i].due_date, amount: _sbn(installs[i].amount), paid: _sbn(installs[i].paid), status: installs[i].status, payments: [] });
    }
    var instById = {};
    for (var j = 0; j < installs.length; j++) {
        instById[installs[j].id] = { contractId: installs[j].contract_id, instIndex: -1 };
    }
    for (var c = 0; c < contracts.length; c++) {
        var list = byContract[contracts[c].id];
        if (list) {
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
        var pay = { date: pays[p].date, amount: _sbn(pays[p].amount), employee: pays[p].employee || '', notes: pays[p].notes || '' };
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
    for (var c2 = 0; c2 < contracts.length; c2++) {
        if (byContractPay[contracts[c2].id]) contracts[c2].payments = byContractPay[contracts[c2].id];
    }
}

/* ═══════════════════════════════════════
   الحفظ الكامل (مزامنة كاملة)
═══════════════════════════════════════ */

function sbSaveAll() {
    if (!db) return Promise.resolve();
    return supabaseReady().then(function(client) {

        /* 1) الإعدادات + metadata */
        return sbSaveSettings(client).then(function(res) {
            if (res.error) throw res.error;

            /* 2) فئات المصروفات (بدون حذف الفئات الافتراضية) */
            return sbSaveCategories(client);
        }).then(function() {

            /* 3) الجداول الأم */
            return Promise.all([
                sbUpsertRows(client, 'transactions', db.transactions.map(txToRow)),
                sbUpsertRows(client, 'expenses', db.expenses.map(expenseToRow)),
                sbUpsertRows(client, 'clients', db.clients.map(clientToRow)),
                sbUpsertRows(client, 'manual_debts', db.manualDebts.map(manualDebtToRow)),
                sbUpsertRows(client, 'installment_contracts', db.installmentContracts.map(contractToRow))
            ]);
        }).then(function(parentResults) {
            for (var i = 0; i < parentResults.length; i++) {
                if (parentResults[i] && parentResults[i].error) throw parentResults[i].error;
            }

            var txIds = db.transactions.map(function(t) { return t.id; });
            var expIds = db.expenses.map(function(e) { return e.id; });
            var clientIds = db.clients.map(function(c) { return c.id; });
            var mdIds = db.manualDebts.map(function(d) { return d.id; });
            var instIds = db.installmentContracts.map(function(c) { return c.id; });

            /* 4) دفعات الديون على التذاكر */
            var debtPayRows = [];
            for (var t = 0; t < db.transactions.length; t++) {
                var tx = db.transactions[t];
                if (!Array.isArray(tx.debtPayments)) continue;
                for (var tp = 0; tp < tx.debtPayments.length; tp++) {
                    debtPayRows.push({ transaction_id: tx.id, date: tx.debtPayments[tp].date, amount: _sbn(tx.debtPayments[tp].amount), notes: tx.debtPayments[tp].notes || '' });
                }
            }

            /* 5) دفعات المصاريف + السجلات الشهرية */
            var expPayRows = [];
            var expMonthRows = [];
            for (var e = 0; e < db.expenses.length; e++) {
                var ex = db.expenses[e];
                if (Array.isArray(ex.payments)) {
                    for (var ep = 0; ep < ex.payments.length; ep++) {
                        expPayRows.push({ expense_id: ex.id, date: ex.payments[ep].date, amount: _sbn(ex.payments[ep].amount), notes: ex.payments[ep].notes || '' });
                    }
                }
                if (Array.isArray(ex.monthlyRecords)) {
                    for (var em = 0; em < ex.monthlyRecords.length; em++) {
                        expMonthRows.push({ expense_id: ex.id, month: ex.monthlyRecords[em].month, status: ex.monthlyRecords[em].status || 'unpaid', paid_date: ex.monthlyRecords[em].paidDate || null });
                    }
                }
            }

            /* 6) خدمات العملاء */
            var clientSvcRows = [];
            for (var c = 0; c < db.clients.length; c++) {
                var cl = db.clients[c];
                if (!Array.isArray(cl.services)) continue;
                for (var cs = 0; cs < cl.services.length; cs++) {
                    clientSvcRows.push({ id: _sbn(cl.services[cs].id), client_id: cl.id, date: cl.services[cs].date || null, description: cl.services[cs].description || '', amount: _sbn(cl.services[cs].amount), payment_method: cl.services[cs].paymentMethod || 'cash' });
                }
            }

            /* 7) دفعات الديون اليدوية */
            var mdPayRows = [];
            for (var d = 0; d < db.manualDebts.length; d++) {
                var debt = db.manualDebts[d];
                if (!Array.isArray(debt.payments)) continue;
                for (var dp = 0; dp < debt.payments.length; dp++) {
                    mdPayRows.push({ manual_debt_id: debt.id, date: debt.payments[dp].date, amount: _sbn(debt.payments[dp].amount), notes: debt.payments[dp].notes || '' });
                }
            }

            /* 8) أقساط العقود + دفعاتها */
            var instRows = [];
            var instPayRows = [];
            for (var i2 = 0; i2 < db.installmentContracts.length; i2++) {
                var con = db.installmentContracts[i2];
                if (Array.isArray(con.installments)) {
                    for (var ii = 0; ii < con.installments.length; ii++) {
                        var inst = con.installments[ii];
                        instRows.push({ id: _sbn(inst.id), contract_id: con.id, number: _sbn(inst.number), due_date: inst.dueDate || null, amount: _sbn(inst.amount), paid: _sbn(inst.paid), status: inst.status || 'unpaid' });
                        if (Array.isArray(inst.payments)) {
                            for (var ip = 0; ip < inst.payments.length; ip++) {
                                instPayRows.push({ contract_id: con.id, installment_id: _sbn(inst.id), date: inst.payments[ip].date, amount: _sbn(inst.payments[ip].amount), employee: inst.payments[ip].employee || '', notes: inst.payments[ip].notes || '' });
                            }
                        }
                    }
                }
                if (Array.isArray(con.payments)) {
                    for (var cp = 0; cp < con.payments.length; cp++) {
                        instPayRows.push({ contract_id: con.id, installment_id: null, date: con.payments[cp].date, amount: _sbn(con.payments[cp].amount), employee: con.payments[cp].employee || '', notes: con.payments[cp].notes || '' });
                    }
                }
            }

            /* 9) سلة المحذوفات + سجل النشاط + النسخ الاحتياطية */
            var deletedRows = db.deletedItems.map(function(item) {
                var ms = _sbn(item.deletedAt) || Date.now();
                return { id: _sbn(item.id), item_type: item.type, data: item.data, display_name: item.displayName || '', deleted_at: new Date(ms).toISOString() };
            });
            var activityRows = db.activityLog.map(function(entry) {
                return { id: _sbn(entry.id), date: entry.date || '', time: entry.time || '', employee: entry.employee || '', action: entry.action || '', description: entry.description || '' };
            });

            /* تنفيذ بالتسلسل لضمان ترتيب المفاتيح الأجنبية */
            return sbReplaceChildren(client, 'debt_payments', 'transaction_id', txIds, debtPayRows)
                .then(function(r) { if (r && r.error) throw r.error; return sbReplaceChildren(client, 'expense_payments', 'expense_id', expIds, expPayRows); })
                .then(function(r) { if (r && r.error) throw r.error; return sbReplaceChildren(client, 'expense_monthly_records', 'expense_id', expIds, expMonthRows); })
                .then(function(r) { if (r && r.error) throw r.error; return sbReplaceChildren(client, 'client_services', 'client_id', clientIds, clientSvcRows); })
                .then(function(r) { if (r && r.error) throw r.error; return sbReplaceChildren(client, 'manual_debt_payments', 'manual_debt_id', mdIds, mdPayRows); })
                .then(function(r) {
                    if (r && r.error) throw r.error;
                    /* دفعات الأقساط تُحذف أولاً ثم تُعاد إدراجها بعد الأقساط */
                    var delInstPay = instIds.length
                        ? client.from('installment_payments').delete().in('contract_id', instIds)
                        : Promise.resolve();
                    return delInstPay;
                })
                .then(function() {
                    return sbUpsertRows(client, 'installments', instRows);
                })
                .then(function(r) {
                    if (r && r.error) throw r.error;
                    if (instPayRows.length) {
                        return client.from('installment_payments').insert(instPayRows);
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
                toast('تعذر حفظ البيانات على الخادم — سيُعاد المحاولة تلقائياً', 'error');
            }
        }
    }).then(function() {
        _syncRunning = false;
        if (_syncQueued) {
            _syncQueued = false;
            _syncTimer = setTimeout(sbRunSync, 60);
        }
    });
}

window.addEventListener('pagehide', function() {
    if (_syncTimer) {
        clearTimeout(_syncTimer);
        _syncTimer = null;
    }
    if (db && !_syncRunning) sbRunSync();
});
