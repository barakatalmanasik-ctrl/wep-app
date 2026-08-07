-- ═══════════════════════════════════════════════════
-- بركات المناسك — قاعدة بيانات Supabase (PostgreSQL)
-- الملف 2/6: الفهارس (Indexes)
--
-- تحسين أداء الاستعلامات الأكثر شيوعاً:
-- كشف الحساب، التقارير الشهرية، ديون العملاء، الأقساط، السجل
-- ═══════════════════════════════════════════════════

-- العمليات: الفرز والتصفية حسب التاريخ والنوع
create index if not exists idx_transactions_date on public.transactions (date);
create index if not exists idx_transactions_type on public.transactions (type);
create index if not exists idx_transactions_service_type on public.transactions (service_type);
create index if not exists idx_transactions_client on public.transactions (client_id);
create index if not exists idx_transactions_created_at on public.transactions (created_at);
create index if not exists idx_transactions_remaining on public.transactions (remaining_amount) where remaining_amount > 0;

-- دفعات الديون
create index if not exists idx_debt_payments_tx on public.debt_payments (transaction_id);
create index if not exists idx_debt_payments_date on public.debt_payments (date);

-- المصروفات
create index if not exists idx_expenses_date on public.expenses (date);
create index if not exists idx_expenses_recurring on public.expenses (is_recurring);
create index if not exists idx_expenses_category on public.expenses (category);
create index if not exists idx_expense_payments_expense on public.expense_payments (expense_id);
create index if not exists idx_expense_monthly_month on public.expense_monthly_records (month);
create index if not exists idx_expense_monthly_expense on public.expense_monthly_records (expense_id);

-- الديون اليدوية
create index if not exists idx_manual_debts_name on public.manual_debts (name);
create index if not exists idx_manual_debts_remaining on public.manual_debts (remaining) where remaining > 0;
create index if not exists idx_manual_debt_payments_debt on public.manual_debt_payments (manual_debt_id);

-- عقود الأقساط والأقساط
create index if not exists idx_installment_contracts_name on public.installment_contracts (name);
create index if not exists idx_installments_contract on public.installments (contract_id);
create index if not exists idx_installments_due on public.installments (due_date);
create index if not exists idx_installments_status on public.installments (status);
create index if not exists idx_installment_payments_contract on public.installment_payments (contract_id);
create index if not exists idx_installment_payments_inst on public.installment_payments (installment_id);

-- سلة المحذوفات: تنظيف السجلات منتهية المدة
create index if not exists idx_deleted_items_deleted_at on public.deleted_items (deleted_at);
create index if not exists idx_deleted_items_type on public.deleted_items (item_type);

-- سجل النشاط: التصفية حسب الموظف والبحث
create index if not exists idx_activity_log_created_at on public.activity_log (created_at);
create index if not exists idx_activity_log_employee on public.activity_log (employee);

-- العملاء والخدمات
create index if not exists idx_clients_name on public.clients (name);
create index if not exists idx_client_services_client on public.client_services (client_id);
