-- ═══════════════════════════════════════════════════
-- بركات المناسك — ملف 7/7: إصلاح تكرار سجل النشاط
-- ═══════════════════════════════════════════════════
-- التطبيق يسجّل النشاط يدوياً (logActivity) ويحفظه عبر
-- المزامنة إلى activity_log. الـ trigger التالي كان يسجّل
-- أيضاً عند إدراج عمليات/عملاء فينتج إدخالات مكررة بعد
-- ربط التطبيق بـ Supabase. نزيلهما ونبقي التسجيل اليدوي فقط.
--
-- نفّذ هذا الملف في: Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════

drop trigger if exists trg_activity_transaction on public.transactions;
drop trigger if exists trg_activity_client on public.clients;
