-- ═══════════════════════════════════════════════════
-- بركات المناسك — قاعدة بيانات Supabase (PostgreSQL)
-- الملف 1/6: البنية الأساسية (Schema)
--
-- مصمم لمطابقة بنية localStorage (DB_SCHEMA v15)
-- الوحدة النقدية: دينار عراقي (عدد صحيح BIGINT)
-- ═══════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ═══════════════════════════════════════
-- الملفات الشخصية للموظفين (مرتبط بـ auth.users)
-- ═══════════════════════════════════════
create table if not exists public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    full_name   text not null default '',
    role        text not null default 'employee'
                check (role in ('admin', 'employee')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- إعدادات التطبيق (مطابق: settings + metadata)
-- ═══════════════════════════════════════
create table if not exists public.app_settings (
    key         text primary key,
    value       text not null default ''
);

-- ═══════════════════════════════════════
-- العملاء (مطابق: clients)
-- ═══════════════════════════════════════
create table if not exists public.clients (
    id          bigserial primary key,
    name        text not null,
    phone       text not null default '',
    address     text not null default '',
    notes       text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- خدمات العميل (مطابق: clients[].services)
-- ═══════════════════════════════════════
create table if not exists public.client_services (
    id              bigserial primary key,
    client_id       bigint not null references public.clients (id) on delete cascade,
    date            date not null default current_date,
    description     text not null default '',
    amount          bigint not null default 0 check (amount >= 0),
    payment_method  text not null default 'cash'
                    check (payment_method in ('cash', 'debt')),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- العمليات (كشف الحساب) — مطابق: transactions
-- نوع العملية: increase (تعزيز) | ticket (قطع/خدمة)
-- service_type: ticket | visa | hotel | esim
-- ═══════════════════════════════════════
create table if not exists public.transactions (
    id               bigserial primary key,
    type             text not null default 'increase'
                     check (type in ('increase', 'ticket')),
    service_type     text not null default 'ticket'
                     check (service_type in ('ticket', 'visa', 'hotel', 'esim')),
    date             date not null default current_date,
    amount           bigint not null default 0 check (amount >= 0),
    base_price       bigint not null default 0 check (base_price >= 0),
    sale_price       bigint not null default 0 check (sale_price >= 0),
    profit           bigint not null default 0,
    balance          bigint not null default 0,
    customer         text not null default '',
    airline          text not null default '',
    notes            text not null default '',
    client_id        bigint references public.clients (id) on delete set null,
    payment_method   text not null default 'cash'
                     check (payment_method in ('cash', 'debt')),
    amount_paid      bigint not null default 0 check (amount_paid >= 0),
    down_payment     bigint not null default 0 check (down_payment >= 0),
    remaining_amount bigint not null default 0 check (remaining_amount >= 0),
    booking_ref      text not null default '',
    pnr              text not null default '',
    created_by       uuid references public.profiles (id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- دفعات الدين على التذاكر (مطابق: transactions[].debtPayments)
-- ═══════════════════════════════════════
create table if not exists public.debt_payments (
    id              bigserial primary key,
    transaction_id  bigint not null references public.transactions (id) on delete cascade,
    date            date not null default current_date,
    amount          bigint not null default 0 check (amount >= 0),
    notes           text not null default '',
    created_at      timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- فئات المصروفات (مطابق: expenseCategories)
-- ═══════════════════════════════════════
create table if not exists public.expense_categories (
    id          bigserial primary key,
    name        text not null unique,
    created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- المصروفات (مطابق: expenses)
-- payment_status: paid | partial | unpaid
-- ═══════════════════════════════════════
create table if not exists public.expenses (
    id             bigserial primary key,
    date           date not null default current_date,
    category       text not null default '',
    name           text not null default '',
    amount         bigint not null default 0 check (amount >= 0),
    amount_paid    bigint not null default 0 check (amount_paid >= 0),
    remaining      bigint not null default 0 check (remaining >= 0),
    description    text not null default '',
    notes          text not null default '',
    is_recurring   boolean not null default false,
    due_day        int not null default 0 check (due_day between 0 and 31),
    payment_status text not null default 'paid'
                   check (payment_status in ('paid', 'partial', 'unpaid')),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- دفعات المصروف (مطابق: expenses[].payments)
-- ═══════════════════════════════════════
create table if not exists public.expense_payments (
    id          bigserial primary key,
    expense_id  bigint not null references public.expenses (id) on delete cascade,
    date        date not null default current_date,
    amount      bigint not null default 0 check (amount >= 0),
    notes       text not null default '',
    created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- سجلات المصروفات الشهرية المتكررة (مطابق: expenses[].monthlyRecords)
-- month بصيغة 'YYYY-MM' — status: paid | unpaid
-- ═══════════════════════════════════════
create table if not exists public.expense_monthly_records (
    id          bigserial primary key,
    expense_id  bigint not null references public.expenses (id) on delete cascade,
    month       text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
    status      text not null default 'unpaid' check (status in ('paid', 'unpaid')),
    paid_date   date,
    created_at  timestamptz not null default now(),
    unique (expense_id, month)
);

-- ═══════════════════════════════════════
-- الديون اليدوية (مطابق: manualDebts)
-- ═══════════════════════════════════════
create table if not exists public.manual_debts (
    id           bigserial primary key,
    name         text not null,
    phone        text not null default '',
    date         date not null default current_date,
    total_amount bigint not null default 0 check (total_amount >= 0),
    amount_paid  bigint not null default 0 check (amount_paid >= 0),
    remaining    bigint not null default 0 check (remaining >= 0),
    reason       text not null default '',
    notes        text not null default '',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- دفعات الديون اليدوية (مطابق: manualDebts[].payments)
-- ═══════════════════════════════════════
create table if not exists public.manual_debt_payments (
    id              bigserial primary key,
    manual_debt_id  bigint not null references public.manual_debts (id) on delete cascade,
    date            date not null default current_date,
    amount          bigint not null default 0 check (amount >= 0),
    notes           text not null default '',
    created_at      timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- عقود الأقساط (مطابق: installmentContracts)
-- period: weekly | biweekly | monthly | bimonthly | quarterly | custom
-- ═══════════════════════════════════════
create table if not exists public.installment_contracts (
    id          bigserial primary key,
    name        text not null,
    phone       text not null default '',
    description text not null default '',
    total       bigint not null default 0 check (total >= 0),
    advance     bigint not null default 0 check (advance >= 0),
    count       int not null default 0 check (count >= 0),
    inst_value  bigint not null default 0 check (inst_value >= 0),
    start_date  date not null default current_date,
    period      text not null default 'monthly'
                check (period in ('weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'custom')),
    notes       text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- أقساط العقد (مطابق: installmentContracts[].installments)
-- status: paid | unpaid | partial | overdue | cancelled
-- ═══════════════════════════════════════
create table if not exists public.installments (
    id            bigserial primary key,
    contract_id   bigint not null references public.installment_contracts (id) on delete cascade,
    number        int not null default 1,
    due_date      date not null,
    amount        bigint not null default 0 check (amount >= 0),
    paid          bigint not null default 0 check (paid >= 0),
    status        text not null default 'unpaid'
                  check (status in ('paid', 'unpaid', 'partial', 'overdue', 'cancelled')),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- دفعات الأقساط (مطابق: installments[].payments)
-- ═══════════════════════════════════════
create table if not exists public.installment_payments (
    id              bigserial primary key,
    contract_id     bigint not null references public.installment_contracts (id) on delete cascade,
    installment_id  bigint references public.installments (id) on delete set null,
    date            date not null default current_date,
    amount          bigint not null default 0 check (amount >= 0),
    employee        text not null default '',
    notes           text not null default '',
    created_at      timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- سلة المحذوفات (مطابق: deletedItems)
-- item_type: transaction | expense | client | service | manualDebt | installmentContract
-- data: نسخة كاملة JSON من السجل المحذوف
-- ═══════════════════════════════════════
create table if not exists public.deleted_items (
    id           bigserial primary key,
    item_type    text not null
                 check (item_type in ('transaction', 'expense', 'client', 'service', 'manualDebt', 'installmentContract')),
    data         jsonb not null default '{}'::jsonb,
    display_name text not null default '',
    deleted_at   timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- سجل النشاط (مطابق: activityLog)
-- ═══════════════════════════════════════
create table if not exists public.activity_log (
    id          bigserial primary key,
    date        text not null default '',
    time        text not null default '',
    employee    text not null default '',
    action      text not null default '',
    description text not null default '',
    created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- سجل النسخ الاحتياطية (مطابق: backups)
-- ═══════════════════════════════════════
create table if not exists public.backups (
    id           bigserial primary key,
    backup_key   text not null,
    timestamp    timestamptz not null default now(),
    from_version int not null default 0,
    label        text not null default '',
    created_at   timestamptz not null default now()
);
