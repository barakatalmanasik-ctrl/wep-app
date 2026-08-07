/* ═══════════════════════════════════════════════════
   بركات المناسك — ملف الاتصال الوحيد بـ Supabase
   ═══════════════════════════════════════════════════
   - يقرأ الإعدادات من config.js (متغيرات البيئة)
     window.SUPABASE_URL / window.SUPABASE_ANON_KEY
   - ينشئ عميل واحد فقط (getSupabaseClient)
   - المصادقة: بريد إلكتروني + كلمة مرور (signInWithPassword)
     وهوية الموظف تُقرأ من جدول profiles
   - لا يُستخدم localStorage نهائياً (persistSession: false)
   ═══════════════════════════════════════════════════ */

'use strict';

function getSupabaseConfig() {
    return {
        url: String(window.SUPABASE_URL || '').trim(),
        anonKey: String(window.SUPABASE_ANON_KEY || '').trim()
    };
}

var _sbClient = null;

function isSupabaseConfigured() {
    var cfg = getSupabaseConfig();
    return !!(cfg.url && cfg.anonKey);
}

function getSupabaseClient() {
    if (_sbClient) return _sbClient;
    if (typeof supabase === 'undefined' || !supabase.createClient) {
        throw new Error('مكتبة supabase غير محمّلة');
    }
    var cfg = getSupabaseConfig();
    if (!cfg.url || !cfg.anonKey) {
        throw new Error('مفقود SUPABASE_URL أو SUPABASE_ANON_KEY — املأ config.js (محلياً) أو متغيرات بيئة Vercel (للنشر)');
    }
    _sbClient = supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });
    return _sbClient;
}

/* ── الجلسة الحالية (بدون حفظ في localStorage) ── */

function supabaseGetSession() {
    return Promise.resolve().then(function() {
        return getSupabaseClient().auth.getSession();
    }).then(function(res) {
        return (res && res.data && res.data.session) ? res.data.session : null;
    });
}

/* ── تسجيل الدخول ── */

function _authErrorMessage(code, fallback) {
    var map = {
        invalid_credentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        email_not_confirmed: 'لم يتم تأكيد البريد الإلكتروني بعد',
        user_not_found: 'لا يوجد حساب بهذا البريد الإلكتروني',
        weak_password: 'كلمة المرور ضعيفة',
        email_exists: 'يوجد حساب مسجّل بهذا البريد مسبقاً',
        refresh_token_not_found: 'انتهت الجلسة، سجّل الدخول مجدداً',
        invalid_jwt: 'انتهت الجلسة، سجّل الدخول مجدداً',
        signup_disabled: 'التسجيل معطّل في المشروع'
    };
    return map[code] || (fallback ? String(fallback) : 'فشل تسجيل الدخول');
}

function supabaseSignIn(email, password) {
    return Promise.resolve().then(function() {
        var client = getSupabaseClient();
        return client.auth.signInWithPassword({
            email: String(email || '').trim(),
            password: String(password || '')
        });
    }).then(function(res) {
        if (res && res.error) {
            var code = res.error.code || '';
            throw new Error(_authErrorMessage(code, res.error.message));
        }
        if (!res || !res.data || !res.data.session) {
            throw new Error('فشل تسجيل الدخول');
        }
        return res.data.session;
    });
}

function supabaseSignOut() {
    return Promise.resolve().then(function() {
        return getSupabaseClient().auth.signOut();
    }).catch(function() {
        /* تجاهل أخطاء إنهاء الجلسة */
    });
}

/* ── جاهزية العميل للقراءة/الكتابة (تتطلب جلسة) ── */

function supabaseReady() {
    return supabaseGetSession().then(function(session) {
        if (!session) throw new Error('يجب تسجيل الدخول أولاً');
        return getSupabaseClient();
    });
}
