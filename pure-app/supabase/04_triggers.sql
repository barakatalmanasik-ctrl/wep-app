-- ═══════════════════════════════════════════════════
-- بركات المناسك — قاعدة بيانات Supabase (PostgreSQL)
-- الملف 4/6: المحفزات (Triggers)
--
-- تنفيذ منطق الحسابات تلقائياً عند الإدراج أو التحديث
-- ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- تحديث updated_at تلقائياً
-- ═══════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
    before update on public.clients
    for each row execute function public.set_updated_at();

drop trigger if exists trg_client_services_updated_at on public.client_services;
create trigger trg_client_services_updated_at
    before update on public.client_services
    for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
    before update on public.transactions
    for each row execute function public.set_updated_at();

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
    before update on public.expenses
    for each row execute function public.set_updated_at();

drop trigger if exists trg_manual_debts_updated_at on public.manual_debts;
create trigger trg_manual_debts_updated_at
    before update on public.manual_debts
    for each row execute function public.set_updated_at();

drop trigger if exists trg_installment_contracts_updated_at on public.installment_contracts;
create trigger trg_installment_contracts_updated_at
    before update on public.installment_contracts
    for each row execute function public.set_updated_at();

drop trigger if exists trg_installments_updated_at on public.installments;
create trigger trg_installments_updated_at
    before update on public.installments
    for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════
-- مزامنة حسابات العملية (الربح والمتبقي)
-- مطابق: recalculateAll() داخل script.js
-- ═══════════════════════════════════════
drop trigger if exists trg_transactions_sync_totals on public.transactions;
create trigger trg_transactions_sync_totals
    before insert or update on public.transactions
    for each row execute function public.sync_transaction_totals();

-- ═══════════════════════════════════════
-- إعادة حساب الرصيد المتدرج بعد كل تغيير في العمليات
-- ═══════════════════════════════════════
drop trigger if exists trg_transactions_recalc_balance on public.transactions;
create trigger trg_transactions_recalc_balance
    after insert or update or delete on public.transactions
    for each statement execute function public.recalc_balance_statement();

-- ═══════════════════════════════════════
-- مزامنة دفعة دين تذكرة → amount_paid / remaining_amount
-- ═══════════════════════════════════════
create or replace function public.sync_debt_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    v_tx_id bigint;
begin
    v_tx_id := coalesce(new.transaction_id, old.transaction_id);
    -- amount_paid = الدفعة المقدمة + مجموع دفعات الدين
    update public.transactions
    set amount_paid = down_payment + greatest(0,
            (select coalesce(sum(amount), 0) from public.debt_payments where transaction_id = v_tx_id)),
        updated_at = now()
    where id = v_tx_id;
    return null;
end;
$$;

drop trigger if exists trg_debt_payment_sync on public.debt_payments;
create trigger trg_debt_payment_sync
    after insert or update or delete on public.debt_payments
    for each row execute function public.sync_debt_payment();

-- ═══════════════════════════════════════
-- مزامنة دفعة مصروف → amount_paid / remaining / payment_status
-- ═══════════════════════════════════════
create or replace function public.sync_expense_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    v_expense_id bigint;
begin
    v_expense_id := coalesce(new.expense_id, old.expense_id);
    update public.expenses
    set amount_paid = greatest(0,
            (select coalesce(sum(amount), 0) from public.expense_payments where expense_id = v_expense_id))
    where id = v_expense_id;

    update public.expenses
    set remaining = greatest(0, amount - amount_paid),
        payment_status = public.expense_payment_status(amount, amount_paid),
        updated_at = now()
    where id = v_expense_id
      and is_recurring = false;

    return null;
end;
$$;

drop trigger if exists trg_expense_payment_sync on public.expense_payments;
create trigger trg_expense_payment_sync
    after insert or update or delete on public.expense_payments
    for each row execute function public.sync_expense_payment();

-- ═══════════════════════════════════════
-- مزامنة دفعة دين يدوي → amount_paid / remaining
-- ═══════════════════════════════════════
create or replace function public.sync_manual_debt_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    v_debt_id bigint;
begin
    v_debt_id := coalesce(new.manual_debt_id, old.manual_debt_id);
    update public.manual_debts
    set amount_paid = greatest(0,
            (select coalesce(sum(amount), 0) from public.manual_debt_payments where manual_debt_id = v_debt_id)),
        updated_at = now()
    where id = v_debt_id;

    update public.manual_debts
    set remaining = greatest(0, total_amount - amount_paid),
        updated_at = now()
    where id = v_debt_id;

    return null;
end;
$$;

drop trigger if exists trg_manual_debt_payment_sync on public.manual_debt_payments;
create trigger trg_manual_debt_payment_sync
    after insert or update or delete on public.manual_debt_payments
    for each row execute function public.sync_manual_debt_payment();

-- ═══════════════════════════════════════
-- مزامنة دفعة قسط → paid / status للقسط
-- ═══════════════════════════════════════
create or replace function public.sync_installment_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    v_installment_paid bigint;
    v_installment_amount bigint;
    v_installment_id bigint;
begin
    v_installment_id := coalesce(new.installment_id, old.installment_id);
    if v_installment_id is not null then
        select i.amount,
               greatest(0, (select coalesce(sum(amount), 0)
                            from public.installment_payments
                            where installment_id = v_installment_id))
        into v_installment_amount, v_installment_paid
        from public.installments i
        where i.id = v_installment_id;

        update public.installments
        set paid = v_installment_paid,
            status = case
                when v_installment_paid >= v_installment_amount then 'paid'
                when v_installment_paid > 0 then 'partial'
                else 'unpaid'
            end,
            updated_at = now()
        where id = v_installment_id;
    end if;
    return null;
end;
$$;

drop trigger if exists trg_installment_payment_sync on public.installment_payments;
create trigger trg_installment_payment_sync
    after insert or update or delete on public.installment_payments
    for each row execute function public.sync_installment_payment();

-- ═══════════════════════════════════════
-- إنشاء سجل نشاط تلقائي عند إدراج عملية أو عميل أو مصروف
-- (اختياري — مكمّل لـ logActivity اليدوي في JS)
-- ═══════════════════════════════════════
create or replace function public.auto_log_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.activity_log (date, time, employee, action, description)
    values (
        to_char(now(), 'DD/MM/YYYY'),
        to_char(now(), 'HH24:MI'),
        coalesce(nullif((select full_name from public.profiles where id = auth.uid()), ''), '—'),
        TG_ARGV[0],
        coalesce(TG_ARGV[1], '')
    );
    return new;
end;
$$;

drop trigger if exists trg_activity_transaction on public.transactions;
create trigger trg_activity_transaction
    after insert on public.transactions
    for each row execute function public.auto_log_activity('إضافة عملية', 'رصيد محدث');

drop trigger if exists trg_activity_client on public.clients;
create trigger trg_activity_client
    after insert on public.clients
    for each row execute function public.auto_log_activity('إضافة عميل', '');
