-- ═══════════════════════════════════════════════════
-- بركات المناسك — قاعدة بيانات Supabase (PostgreSQL)
-- الملف 3/6: الدوال (Functions)
--
-- تعكس منطق الحسابات الموجود في script.js:
-- recalculateAll / getExpensePaymentStatus / updateInstOverdue / getInstStatus
-- ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- حساب الربح والمتبقي لعملية واحدة
-- (مطابق: recalculateAll — الجزء الأول)
-- ═══════════════════════════════════════
create or replace function public.sync_transaction_totals()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    if new.type = 'ticket' then
        new.profit := new.sale_price - new.base_price;
        if new.payment_method = 'debt' then
            new.remaining_amount := greatest(0, new.sale_price - new.amount_paid);
        else
            new.remaining_amount := 0;
        end if;
    else
        new.profit := 0;
        new.remaining_amount := 0;
    end if;
    return new;
end;
$$;

-- ═══════════════════════════════════════
-- إعادة حساب الرصيد المتدرج لكشف الحساب
-- (مطابق: recalculateAll — الرصيد التشغيلي)
-- التعزيز يزيد الرصيد، والبيع نقداً ينقصه بالتكلفة،
-- والبيع بالدين ينقصه بالمبلغ المدفوع فقط
-- ═══════════════════════════════════════
create or replace function public.recalculate_balances()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
    r record;
    running bigint := 0;
    v_delta bigint;
begin
    for r in
        select id
        from public.transactions
        order by date asc, id asc
        for update
    loop
        select
            case
                when t.type = 'increase' then t.amount
                when t.type = 'ticket' and t.payment_method = 'debt' then -t.amount_paid
                when t.type = 'ticket' then -t.base_price
                else 0
            end
        into v_delta
        from public.transactions t
        where t.id = r.id;

        running := running + coalesce(v_delta, 0);
        update public.transactions set balance = running where id = r.id;
    end loop;
end;
$$;

-- ═══════════════════════════════════════
-- محفز بيان (statement) لإعادة حساب الرصيد بعد أي تغيير
-- ═══════════════════════════════════════
create or replace function public.recalc_balance_statement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    -- حماية من التكرار: إذا كنا نعيد الحساب حالياً، نتخطى التنفيذ
    if current_setting('app.balance_recalc_lock', true) = '1' then
        return null;
    end if;
    perform set_config('app.balance_recalc_lock', '1', true);
    perform public.recalculate_balances();
    perform set_config('app.balance_recalc_lock', '0', true);
    return null;
end;
$$;

-- ═══════════════════════════════════════
-- حالة دفع المصروف (paid / partial / unpaid)
-- (مطابق: getExpensePaymentStatus)
-- ═══════════════════════════════════════
create or replace function public.expense_payment_status(p_amount bigint, p_amount_paid bigint)
returns text
language sql
immutable
as $$
    select case
        when p_amount_paid <= 0 then 'unpaid'
        when p_amount_paid >= p_amount then 'paid'
        else 'partial'
    end;
$$;

-- ═══════════════════════════════════════
-- تعليم الأقساط المتأخرة
-- (مطابق: updateInstOverdue)
-- كل قسط حالته unpaid/partial وتاريخ استحقاقه قبل اليوم يصبح overdue
-- ═══════════════════════════════════════
create or replace function public.mark_overdue_installments()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
    updated_count int := 0;
begin
    update public.installments
    set status = 'overdue',
        updated_at = now()
    where status in ('unpaid', 'partial')
      and due_date < current_date;
    get diagnostics updated_count = row_count;
    return updated_count;
end;
$$;

-- ═══════════════════════════════════════
-- حالة عقد القسط الكلية
-- (مطابق: getInstStatus)
-- النتيجة: completed | active | overdue | partial | unpaid
-- ═══════════════════════════════════════
create or replace function public.installment_contract_status(p_contract_id bigint)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
    v_total_paid bigint;
    v_remaining  bigint;
    v_count      int;
    v_any_overdue boolean := false;
    v_any_partial boolean := false;
    v_any_unpaid  boolean := false;
    v_result     text;
begin
    select c.total - c.advance - coalesce(sum(i.paid), 0)
    into v_remaining
    from public.installment_contracts c
    left join public.installments i on i.contract_id = c.id
    where c.id = p_contract_id
    group by c.total, c.advance;

    v_remaining := greatest(0, coalesce(v_remaining, 0));

    if v_remaining <= 0 then
        return 'completed';
    end if;

    select count(*)
    into v_count
    from public.installments
    where contract_id = p_contract_id;

    if v_count = 0 then
        return 'unpaid';
    end if;

    select
        bool_or(i.status = 'overdue'),
        bool_or(i.status = 'partial'),
        bool_or(i.status = 'unpaid')
    into v_any_overdue, v_any_partial, v_any_unpaid
    from public.installments i
    where i.contract_id = p_contract_id;

    if v_any_overdue then
        v_result := 'overdue';
    elsif v_any_partial then
        v_result := 'partial';
    elsif v_any_unpaid then
        v_result := 'active';
    else
        v_result := 'active';
    end if;
    return v_result;
end;
$$;

-- ═══════════════════════════════════════
-- توليد سجلات المصروفات الشهرية المتكررة للشهر الحالي
-- (مطابق: generateMonthlyRecurringExpenses)
-- ═══════════════════════════════════════
create or replace function public.generate_monthly_recurring_expenses()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
    v_month text := to_char(current_date, 'YYYY-MM');
    r record;
    inserted_count int := 0;
begin
    for r in
        select e.id
        from public.expenses e
        where e.is_recurring = true
          and e.due_day between 1 and 31
          and not exists (
              select 1
              from public.expense_monthly_records m
              where m.expense_id = e.id and m.month = v_month
          )
    loop
        insert into public.expense_monthly_records (expense_id, month, status, paid_date)
        values (r.id, v_month, 'unpaid', null);
        inserted_count := inserted_count + 1;
    end loop;
    return inserted_count;
end;
$$;

-- ═══════════════════════════════════════
-- إجماليات المصروفات (مدفوع / غير مدفوع / جزئي / شهري / سنوي)
-- (مطابق: getExpenseTotals)
-- ═══════════════════════════════════════
create or replace function public.expense_totals()
returns table (
    total_paid      bigint,
    total_unpaid    bigint,
    total_partial   bigint,
    today_paid      bigint,
    month_paid      bigint,
    month_unpaid    bigint,
    year_paid       bigint,
    recurring_count bigint,
    one_time_count  bigint,
    unpaid_count    bigint
)
language plpgsql
security definer set search_path = public
as $$
declare
    v_today   text := to_char(current_date, 'YYYY-MM-DD');
    v_month   text := to_char(current_date, 'YYYY-MM');
    v_year    text := to_char(current_date, 'YYYY');
    v_today_paid bigint := 0;
    v_month_paid bigint := 0;
    v_month_unpaid bigint := 0;
    v_year_paid bigint := 0;
begin
    with base as (
        select
            e.id,
            e.amount,
            e.amount_paid,
            e.is_recurring,
            e.date,
            public.expense_payment_status(e.amount, e.amount_paid) as pay_st
        from public.expenses e
    ),
    monthly as (
        select
            e.id,
            sum(e.amount) filter (where m.status = 'paid') as paid,
            sum(e.amount) filter (where m.status = 'unpaid') as unpaid
        from public.expenses e
        join public.expense_monthly_records m on m.expense_id = e.id
        where e.is_recurring
        group by e.id
    )
    select
        coalesce(sum(
            case
                when b.is_recurring then coalesce(m.paid, 0)
                when b.pay_st = 'paid' then b.amount
                else 0
            end
        ), 0)::bigint,
        coalesce(sum(
            case
                when b.is_recurring then coalesce(m.unpaid, 0)
                when b.pay_st = 'unpaid' then b.amount
                when b.pay_st = 'partial' then b.amount - b.amount_paid
                else 0
            end
        ), 0)::bigint,
        coalesce(sum(
            case when not b.is_recurring and b.pay_st = 'partial' then b.amount_paid else 0 end
        ), 0)::bigint,
        coalesce(sum(
            case when not b.is_recurring and b.pay_st = 'paid' and to_char(b.date, 'YYYY-MM-DD') = v_today then b.amount else 0 end
        ), 0)::bigint,
        coalesce(sum(
            case when not b.is_recurring and b.pay_st = 'paid' and to_char(b.date, 'YYYY-MM') = v_month then b.amount else 0 end
        ), 0)::bigint,
        0::bigint,
        coalesce(sum(
            case when not b.is_recurring and b.pay_st = 'paid' and to_char(b.date, 'YYYY') = v_year then b.amount else 0 end
        ), 0)::bigint,
        count(*) filter (where b.is_recurring),
        count(*) filter (where not b.is_recurring),
        count(*) filter (where not b.is_recurring and b.pay_st in ('unpaid', 'partial'))
    into total_paid, total_unpaid, total_partial, v_today_paid, v_month_paid, v_month_unpaid, v_year_paid,
         recurring_count, one_time_count, unpaid_count
    from base b
    left join monthly m on m.id = b.id;

    -- المدفوع وغير المدفوع للشهر الحالي (المصروفات المتكررة)
    select
        coalesce(sum(e.amount) filter (where mr.status = 'paid'), 0)::bigint,
        coalesce(sum(e.amount) filter (where mr.status = 'unpaid'), 0)::bigint
    into v_month_paid, v_month_unpaid
    from public.expenses e
    join public.expense_monthly_records mr on mr.expense_id = e.id
    where mr.month = v_month;

    -- المدفوع لهذا العام (المصروفات المتكررة)
    select coalesce(sum(e.amount), 0)::bigint
    into v_year_paid
    from public.expenses e
    join public.expense_monthly_records mr on mr.expense_id = e.id
    where mr.month like v_year || '-%' and mr.status = 'paid';

    today_paid := v_today_paid;
    month_paid := month_paid + v_month_paid;
    month_unpaid := month_unpaid + v_month_unpaid;
    year_paid := year_paid + v_year_paid;

    return next;
end;
$$;

-- ═══════════════════════════════════════
-- تقرير الديون — لكل عميل: إجمالي قيمة التذاكر / المدفوع / المتبقي
-- (مطابق: getClientDebtStats عبر جميع العملاء)
-- ═══════════════════════════════════════
create or replace function public.client_debt_report()
returns table (
    client_id       bigint,
    client_name     text,
    client_phone    text,
    total_sale      bigint,
    total_paid      bigint,
    total_remaining bigint,
    debt_count      bigint
)
language plpgsql
security definer set search_path = public
as $$
begin
    return query
    select
        c.id,
        c.name,
        c.phone,
        coalesce(sum(t.sale_price), 0)::bigint,
        coalesce(sum(t.amount_paid), 0)::bigint,
        coalesce(sum(t.remaining_amount), 0)::bigint,
        count(t.id) filter (where t.remaining_amount > 0)
    from public.clients c
    left join public.transactions t
        on t.client_id = c.id
       and t.type = 'ticket'
    group by c.id, c.name, c.phone;
end;
$$;

-- ═══════════════════════════════════════
-- الرصيد الحالي (آخر رصيد في كشف الحساب)
-- (مطابق: getTotals().balance)
-- ═══════════════════════════════════════
create or replace function public.current_balance()
returns bigint
language sql
security definer set search_path = public
as $$
    select coalesce(balance, 0)
    from public.transactions
    order by date asc, id asc
    limit 1
    offset (select greatest(0, count(*) - 1) from public.transactions);
$$;

-- ═══════════════════════════════════════
-- ملخص كشف الحساب (مطابق: getTotals)
-- ═══════════════════════════════════════
create or replace function public.account_summary()
returns table (
    balance        bigint,
    increase_total bigint,
    ticket_cost    bigint,
    sales_total    bigint,
    profit_total   bigint,
    ticket_count   bigint,
    increase_count bigint,
    total_debt     bigint,
    debt_count     bigint
)
language plpgsql
security definer set search_path = public
as $$
begin
    return query
    select
        public.current_balance() as balance,
        coalesce(sum(t.amount) filter (where t.type = 'increase'), 0)::bigint,
        coalesce(sum(t.base_price) filter (where t.type = 'ticket'), 0)::bigint,
        coalesce(sum(t.sale_price) filter (where t.type = 'ticket'), 0)::bigint,
        coalesce(sum(t.profit) filter (where t.type = 'ticket'), 0)::bigint,
        count(*) filter (where t.type = 'ticket'),
        count(*) filter (where t.type = 'increase'),
        coalesce(sum(t.remaining_amount) filter (where t.type = 'ticket' and t.payment_method = 'debt' and t.remaining_amount > 0), 0)::bigint,
        count(*) filter (where t.type = 'ticket' and t.payment_method = 'debt' and t.remaining_amount > 0)
    from public.transactions t;
end;
$$;
