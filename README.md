# المساعد الذكي — جامعة السلطان قابوس
## SQU Digital Assistant

---

## خطوات النشر على Netlify

### الخطوة 1: إنشاء حساب OpenAI
1. اذهب إلى https://platform.openai.com
2. أنشئ حساباً جديداً باسم الجامعة
3. من القائمة الجانبية اختر **API Keys** ← **Create new secret key**
4. انسخ المفتاح (يبدأ بـ `sk-...`)

### الخطوة 2: نشر التطبيق على Netlify
1. اذهب إلى https://netlify.com وأنشئ حساباً مجانياً
2. اضغط **Add new site** ← **Deploy manually**
3. اسحب مجلد `squ-assistant` بالكامل وأفلته في الصفحة
4. انتظر انتهاء النشر (دقيقة واحدة)

### الخطوة 3: إضافة مفتاح OpenAI (مهم جداً)
1. من لوحة Netlify اضغط على **Site configuration** ← **Environment variables**
2. اضغط **Add a variable**
3. اكتب: **Key** = `OPENAI_API_KEY`
4. الصق: **Value** = مفتاح الـ API الذي نسخته
5. اضغط **Save**
6. اذهب إلى **Deploys** واضغط **Trigger deploy** ← **Deploy site**

### الخطوة 4: استخدام التطبيق
- ستحصل على رابط مثل: `https://amazing-app-123.netlify.app`
- يمكنك تغيير الاسم من: **Site configuration** ← **General** ← **Change site name**

---

## بيانات الدخول

| الاسم | البريد الإلكتروني | كلمة المرور |
|---|---|---|
| أ. الرياحي | a.alriyami2@squ.edu.om | 1023 |
| المدير | alzidi@squ.edu.om | 6192 |
| د. وضاح | wadhah@squ.edu.om | 9871 |

---

## هيكل الملفات

```
squ-assistant/
├── public/
│   ├── index.html          # التطبيق الكامل
│   └── favicon.svg         # أيقونة التطبيق
├── netlify/
│   └── functions/
│       ├── chat.js         # الخادم الخفي (يخفي مفتاح API)
│       └── docs_data.json  # نص اللوائح المستخرج
├── netlify.toml            # إعدادات Netlify
└── package.json
```

---

## إضافة لوائح جديدة مستقبلاً
1. أضف نص اللائحة الجديدة إلى `docs_data.json`
2. أضف زر جديد في `index.html` في قسم الـ sidebar
3. أضف أسئلة مقترحة في مصفوفة `SUGGESTIONS`
4. أعد نشر التطبيق على Netlify
