-- ═══════════════════════════════════════════════════
-- بركات المناسك — قاعدة بيانات Supabase (PostgreSQL)
-- الملف 6/6: البيانات الابتدائية (Seed)
--
-- إعدادات افتراضية وفئات مصروفات شائعة
-- ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- إعدادات التطبيق الافتراضية
-- مطابق: DB_SCHEMA.settings { currency: 'IQD', language: 'ar' }
-- و DB_SCHEMA.metadata
-- ═══════════════════════════════════════
insert into public.app_settings (key, value) values
    ('currency', 'IQD'),
    ('language', 'ar'),
    ('created_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    ('last_updated', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    ('migrated_from', 'localStorage:barakat_db')
on conflict (key) do nothing;

-- ═══════════════════════════════════════
-- فئات مصروفات افتراضية
-- ═══════════════════════════════════════
insert into public.expense_categories (name) values
    ('إيجار'),
    ('رواتب الموظفين'),
    ('كهرباء'),
    ('إنترنت'),
    ('دعاية وإعلان'),
    ('قرطاسية'),
    ('صيانة')
on conflict (name) do nothing;

-- ═══════════════════════════════════════
-- إعادة مزامنة عداد المعرّف الذاتي للفئات
-- ═══════════════════════════════════════
select setval(pg_get_serial_sequence('public.expense_categories', 'id'),
              (select max(id) from public.expense_categories));
