-- ═══════════════════════════════════════════════════
-- بركات المناسك — قاعدة بيانات Supabase (PostgreSQL)
-- الملف 5/6: أمان مستوى الصفوف (RLS)
--
-- جميع الجداول محمية عبر RLS.
-- السياسة الأساسية: أي مستخدم مصادق (authenticated) يملك
-- صلاحية كاملة (Select/Insert/Update/Delete) — نشاط تجاري
-- صغير أحادي المستأجر، مع إمكانية التوسع لاحقاً بأدوار.
-- ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- الملفات الشخصية: كل مستخدم يقرأ/يعدّل ملفه فقط
-- ═══════════════════════════════════════
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
    for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id);

-- ═══════════════════════════════════════
-- الإعدادات
-- ═══════════════════════════════════════
alter table public.app_settings enable row level security;

drop policy if exists "app_settings_all_authenticated" on public.app_settings;
create policy "app_settings_all_authenticated" on public.app_settings
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- العملاء والخدمات
-- ═══════════════════════════════════════
alter table public.clients enable row level security;
alter table public.client_services enable row level security;

drop policy if exists "clients_all_authenticated" on public.clients;
create policy "clients_all_authenticated" on public.clients
    for all to authenticated using (true) with check (true);

drop policy if exists "client_services_all_authenticated" on public.client_services;
create policy "client_services_all_authenticated" on public.client_services
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- العمليات (كشف الحساب) ودفعات الديون
-- ═══════════════════════════════════════
alter table public.transactions enable row level security;
alter table public.debt_payments enable row level security;

drop policy if exists "transactions_all_authenticated" on public.transactions;
create policy "transactions_all_authenticated" on public.transactions
    for all to authenticated using (true) with check (true);

drop policy if exists "debt_payments_all_authenticated" on public.debt_payments;
create policy "debt_payments_all_authenticated" on public.debt_payments
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- المصروفات والدفعات والسجلات الشهرية
-- ═══════════════════════════════════════
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_payments enable row level security;
alter table public.expense_monthly_records enable row level security;

drop policy if exists "expense_categories_all_authenticated" on public.expense_categories;
create policy "expense_categories_all_authenticated" on public.expense_categories
    for all to authenticated using (true) with check (true);

drop policy if exists "expenses_all_authenticated" on public.expenses;
create policy "expenses_all_authenticated" on public.expenses
    for all to authenticated using (true) with check (true);

drop policy if exists "expense_payments_all_authenticated" on public.expense_payments;
create policy "expense_payments_all_authenticated" on public.expense_payments
    for all to authenticated using (true) with check (true);

drop policy if exists "expense_monthly_all_authenticated" on public.expense_monthly_records;
create policy "expense_monthly_all_authenticated" on public.expense_monthly_records
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- الديون اليدوية
-- ═══════════════════════════════════════
alter table public.manual_debts enable row level security;
alter table public.manual_debt_payments enable row level security;

drop policy if exists "manual_debts_all_authenticated" on public.manual_debts;
create policy "manual_debts_all_authenticated" on public.manual_debts
    for all to authenticated using (true) with check (true);

drop policy if exists "manual_debt_payments_all_authenticated" on public.manual_debt_payments;
create policy "manual_debt_payments_all_authenticated" on public.manual_debt_payments
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- عقود الأقساط والأقساط والدفعات
-- ═══════════════════════════════════════
alter table public.installment_contracts enable row level security;
alter table public.installments enable row level security;
alter table public.installment_payments enable row level security;

drop policy if exists "installment_contracts_all_authenticated" on public.installment_contracts;
create policy "installment_contracts_all_authenticated" on public.installment_contracts
    for all to authenticated using (true) with check (true);

drop policy if exists "installments_all_authenticated" on public.installments;
create policy "installments_all_authenticated" on public.installments
    for all to authenticated using (true) with check (true);

drop policy if exists "installment_payments_all_authenticated" on public.installment_payments;
create policy "installment_payments_all_authenticated" on public.installment_payments
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- سلة المحذوفات
-- ═══════════════════════════════════════
alter table public.deleted_items enable row level security;

drop policy if exists "deleted_items_all_authenticated" on public.deleted_items;
create policy "deleted_items_all_authenticated" on public.deleted_items
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- سجل النشاط
-- ═══════════════════════════════════════
alter table public.activity_log enable row level security;

drop policy if exists "activity_log_all_authenticated" on public.activity_log;
create policy "activity_log_all_authenticated" on public.activity_log
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- النسخ الاحتياطية
-- ═══════════════════════════════════════
alter table public.backups enable row level security;

drop policy if exists "backups_all_authenticated" on public.backups;
create policy "backups_all_authenticated" on public.backups
    for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════
-- صلاحيات تنفيذ الدوال للمستخدم المصادق
-- ═══════════════════════════════════════
grant execute on function public.recalculate_balances() to authenticated;
grant execute on function public.mark_overdue_installments() to authenticated;
grant execute on function public.installment_contract_status(bigint) to authenticated;
grant execute on function public.generate_monthly_recurring_expenses() to authenticated;
grant execute on function public.expense_payment_status(bigint, bigint) to authenticated;
grant execute on function public.expense_totals() to authenticated;
grant execute on function public.client_debt_report() to authenticated;
grant execute on function public.current_balance() to authenticated;
grant execute on function public.account_summary() to authenticated;
