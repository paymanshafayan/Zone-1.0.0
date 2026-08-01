📐 سند معماری Zone 1.0.0
Markdown

# Zone App — Architecture Document
**Version:** 1.0.0  
**Last Updated:** Phase 1  
**Status:** Living Document (با هر فاز آپدیت می‌شود)

---

## ۱. معرفی پروژه

### چیست؟
Zone یک اپلیکیشن محله‌ای هوشمند است که:
- کسب‌وکارهای اطراف کاربر را بر اساس موقعیت جغرافیایی نشان می‌دهد
- با AI مکالمه می‌کند و نیاز کاربر را می‌فهمد
- اگر دسته‌بندی مورد نیاز کاربر وجود نداشت، خودش آن را می‌سازد
- در صورت نبود نتیجه در دیتابیس، از وب سرچ استفاده می‌کند

### مشکل چیست که Zone حل می‌کند؟
کاربر وارد Zone می‌شود و می‌گوید:
"دنبال کسی می‌گردم که پهپادم را تعمیر کند"

سیستم‌های قدیمی:
→ می‌گویند "یافت نشد"

Zone:
→ دسته‌بندی "تعمیر پهپاد" را می‌سازد
→ در شعاع ۲.۵ کیلومتری جستجو می‌کند
→ اگر نیافت از وب سرچ استفاده می‌کند
→ به ارائه‌دهندگان پیشنهاد ثبت‌نام می‌دهد

---

## ۲. Tech Stack

| لایه | ابزار | دلیل انتخاب |
|------|-------|------------|
| Runtime | Node.js 18+ | Non-blocking I/O برای AI calls |
| Framework | Express.js | سبک، انعطاف‌پذیر، production-ready |
| Database | MongoDB 7 | Document-based برای dynamic schemas |
| ODM | Mongoose 7 | Schema validation + middleware |
| AI | OpenAI API (GPT-4) | Function Calling برای tool use |
| Logging | Winston | Structured logging |
| Security | Helmet + CORS | HTTP security headers |
| Rate Limiting | express-rate-limit | محافظت از API |
| Search Fallback | Serper API / Google Places | وقتی DB نتیجه ندارد |

---

## ۳. ساختار پوشه‌ها
Zone-1.0.0/
│
├── src/
│ ├── app.js # Entry point سرور
│ │
│ ├── config/
│ │ └── db.js # اتصال MongoDB
│ │
│ ├── models/
│ │ ├── Category.model.js # مدل دسته‌بندی (داینامیک)
│ │ └── Provider.model.js # مدل کسب‌وکار (پلی‌مورفیک)
│ │
│ ├── controllers/
│ │ └── expansion.controller.js # منطق AI Expansion
│ │
│ ├── routes/
│ │ ├── chat.routes.js # مسیر گفتگوی AI
│ │ ├── category.routes.js # مسیرهای دسته‌بندی
│ │ └── provider.routes.js # مسیرهای کسب‌وکار
│ │
│ ├── services/
│ │ ├── openai.service.js # ارتباط با OpenAI
│ │ ├── search.service.js # Web Search Fallback
│ │ └── conversation.service.js # مدیریت مکالمه
│ │
│ ├── middleware/
│ │ ├── auth.middleware.js # احراز هویت
│ │ └── sanitize.middleware.js # پاکسازی ورودی
│ │
│ ├── utils/
│ │ ├── logger.js # سیستم لاگ
│ │ └── schemaValidator.js # اعتبارسنجی
│ │
│ └── prompts/
│ └── systemPrompts.js # System Prompts برای AI
│
├── scripts/
│ ├── testConnection.js # تست اتصال DB
│ └── seedDatabase.js # دیتای تستی
│
├── docs/
│ ├── ARCHITECTURE.md # این سند
│ └── HANDOFF.md # راهنمای فاز به فاز
│
├── tests/
│ ├── unit/
│ └── integration/
│
├── logs/ # لاگ‌ها (در gitignore)
│
├── .env.example # نمونه env
├── .env # واقعی (در gitignore)
├── .gitignore
├── package.json
└── README.md

text


---

## ۴. معماری کلی سیستم
┌─────────────────────────────────────────────────────────────┐
│ CLIENT │
│ (Mobile App / Web / API Client) │
└──────────────────────────┬──────────────────────────────────┘
│ HTTP Request
▼
┌─────────────────────────────────────────────────────────────┐
│ EXPRESS SERVER │
│ ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│ │ Helmet │ │ CORS │ │ Rate Limiter │ │
│ └─────────────┘ └──────────────┘ └───────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Sanitize Middleware │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ ROUTES LAYER │
│ │
│ POST /api/chat GET /api/providers/nearby │
│ GET /api/categories POST /api/providers │
└──────────────────────────┬──────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ AI AGENT CORE │
│ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ OpenAI GPT-4 │ │
│ │ (Function Calling Mode) │ │
│ │ │ │
│ │ System Prompt: "Boredom Buster" │ │
│ │ - می‌پرسد، می‌فهمد، عمل می‌کند │ │
│ └──────────────────┬─────────────────────────────────┘ │
│ │ │
│ ┌───────────┴────────────┐ │
│ ▼ ▼ │
│ ┌─────────────┐ ┌──────────────────┐ │
│ │getNearby │ │createCategoryOn │ │
│ │Providers() │ │TheFly() │ │
│ └──────┬──────┘ └────────┬─────────┘ │
└──────────┼─────────────────────────┼───────────────────────┘
│ │
▼ ▼
┌──────────────────┐ ┌──────────────────────────────────┐
│ MongoDB │ │ MongoDB │
│ Geospatial │ │ Dynamic Category Creation │
│ Query │ │ (Atomic Transaction) │
│ (2dsphere) │ │ │
└────────┬─────────┘ └──────────────────────────────────┘
│
▼
نتیجه یافت شد؟
┌────┴────┐
بله خیر
│ │
▼ ▼
Return Web Search
Results Fallback
│
▼
┌─────────────┐
│ Serper API │
│ یا │
│Google Places│
└─────────────┘

text


---

## ۵. MongoDB Schema Design

### ۵.۱ Category Model

```javascript
// این model دسته‌بندی‌های کسب‌وکار را نگه می‌دارد
// مهم‌ترین ویژگی: AI می‌تواند دسته‌بندی جدید بسازد
{
  slug: "drone-repair",           // unique ID قابل خواندن
  displayName: "تعمیر پهپاد",    // نام نمایشی
  localizedNames: {              // چندزبانه
    fa: "تعمیر پهپاد",
    en: "Drone Repair",
    ar: "إصلاح الطائرات"
  },
  dynamicFields: [               // فیلدهای اختصاصی این دسته
    {
      name: "maxFlightRange",
      type: "Number",
      required: true,
      description: "حداکثر برد پرواز قابل تعمیر (کیلومتر)"
    },
    {
      name: "certificationLevel",
      type: "String",
      required: false,
      description: "سطح گواهینامه تعمیرکار"
    }
  ],
  isAIGenerated: true,           // آیا AI ساخته؟
  status: "pending_review",      // نیاز به تأیید admin
  icon: "🚁",
  colorTheme: "#6366f1",
  searchTags: ["پهپاد", "drone", "UAV", "تعمیر"],
  aiMetadata: {                  // اطلاعات AI که ساخت
    model: "gpt-4",
    prompt: "متن اصلی درخواست کاربر",
    confidence: 0.92,
    requestedBy: "userId"
  }
}
۵.۲ Provider Model
JavaScript

// هر کسب‌وکار یک Provider است
// مهم‌ترین ویژگی: location با 2dsphere index
{
  businessName: "تعمیرگاه پهپاد تهران",
  category: ObjectId,             // ارجاع به Category
  categorySlug: "drone-repair",   // برای جستجوی سریع

  location: {                     // ❤️ قلب سیستم Zone
    type: "Point",
    coordinates: [51.389, 35.689] // [longitude, latitude]
    // MongoDB ابتدا longitude می‌خواهد!
  },

  contact: {
    phone: "09121234567",
    email: "info@example.ir",
    instagram: "drone_repair_tehran"
  },

  dynamicAttributes: {           // فیلدهای اختصاصی دسته‌بندی
    maxFlightRange: 15,          // از Category.dynamicFields می‌آید
    certificationLevel: "expert",
    droneTypes: ["DJI", "Parrot"]
  },

  ratings: {
    average: 4.7,
    count: 43
  },

  isActive: true,
  isVerified: false
}
۵.۳ Index Strategy
JavaScript

// Geospatial Index - مهم‌ترین index سیستم
ProviderSchema.index({ location: "2dsphere" });

// Compound Index - جستجوی رایج
ProviderSchema.index({
  categorySlug: 1,
  isActive: 1,
  location: "2dsphere"
});

// Category Indexes
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ status: 1, popularityScore: -1 });
CategorySchema.index({
  displayName: "text",
  searchTags: "text"
});
۶. AI Self-Expansion Flow
text

کاربر: "کجا می‌تونم پهپادم رو تعمیر کنم؟"
                    │
                    ▼
        AI درخواست را تحلیل می‌کند
                    │
                    ▼
        در Category registry چک می‌کند
                    │
              ┌─────┴──────┐
          یافت شد       یافت نشد
              │               │
              ▼               ▼
         جستجوی      createCategoryOnTheFly({
         providers      categoryName: "تعمیر پهپاد",
                        requiredMetadata: [
                          {name: "maxFlightRange", type: "Number"},
                          {name: "certificationLevel", type: "String"},
                          {name: "droneTypes", type: "Array"}
                        ]
                      })
                           │
                    ┌──────┴──────┐
                 موفق          خطا
                    │              │
                    ▼              ▼
              Category         بازگشت
              در MongoDB       پیغام خطا
              ذخیره شد
                    │
                    ▼
              جستجوی providers
              در category جدید
                    │
              ┌─────┴──────┐
          یافت شد       یافت نشد
              │               │
              ▼               ▼
          نمایش          Web Search
          نتایج          Fallback
۷. Security Architecture
text

Request
   │
   ▼
[Helmet] — HTTP Security Headers
   │
   ▼
[CORS] — Only allowed origins
   │
   ▼
[Rate Limiter] — Max 100 req/15min
   │
   ▼
[Payload Size Check] — Max 50KB
   │
   ▼
[Sanitize Middleware]
   ├── حذف $where, $regex (NoSQL injection)
   ├── حذف __proto__, constructor (prototype pollution)
   ├── محدودیت عمق nested objects
   └── حذف null bytes
   │
   ▼
[Input Validation]
   ├── Type checking
   ├── Length limits
   └── Pattern matching
   │
   ▼
Business Logic
محافظت‌های کلیدی:
تهدید	راه‌حل
NoSQL Injection	Sanitize middleware + key filtering
Prototype Pollution	حذف proto از inputs
Rate Abuse	express-rate-limit per IP
Oversized Payload	50KB limit
Secret Exposure	.env in .gitignore
Dynamic Field Abuse	Whitelist for field types
۸. API Endpoints
text

Health
  GET  /api/health

Chat (فاز ۳)
  POST /api/chat

Categories
  GET  /api/categories
  GET  /api/categories/:slug
  POST /api/categories          (admin only)

Providers
  GET  /api/providers/nearby    (geospatial)
  GET  /api/providers/:id
  POST /api/providers           (register)
  PUT  /api/providers/:id       (update)
نمونه Request/Response:
JavaScript

// POST /api/chat
Request:
{
  "message": "دنبال تعمیرکار پهپاد می‌گردم",
  "location": {
    "latitude": 35.6892,
    "longitude": 51.3890
  },
  "conversationId": "uuid"
}

Response:
{
  "success": true,
  "message": "دسته‌بندی جدید 'تعمیر پهپاد' ایجاد شد!",
  "category": {
    "slug": "drone-repair",
    "displayName": "تعمیر پهپاد",
    "isNew": true
  },
  "providers": [],
  "webSearchResults": [...],
  "followUp": "آیا می‌خواهید کسب‌وکارتان را در این دسته ثبت کنید؟"
}
۹. فازبندی توسعه
فاز	عنوان	وضعیت	فایل‌های اصلی
۱	Core Infrastructure	✅ در حال انجام	app.js, db.js, logger.js
۲	MongoDB Schemas	⏳ بعدی	Category.model.js, Provider.model.js
۳	AI Expansion Controller	⏳	expansion.controller.js
۴	Conversational AI Agent	⏳	chat.routes.js, openai.service.js
۵	Web Search Integration	⏳	search.service.js
۶	Testing & Production	⏳	tests/, Dockerfile
۱۰. Environment Variables
Bash

# Database
MONGODB_URI=             # آدرس اتصال MongoDB

# Server
PORT=3000
NODE_ENV=development

# AI
OPENAI_API_KEY=          # کلید OpenAI
OPENAI_MODEL=gpt-4-turbo-preview

# Security
JWT_SECRET=              # حداقل ۳۲ کاراکتر

# External APIs
SERPER_API_KEY=          # برای web search
GOOGLE_PLACES_API_KEY=   # برای جستجوی مکان

# Limits
MAX_AI_EXPANSIONS_PER_HOUR=10
۱۱. نکات مهم برای توسعه‌دهندگان
text

⚠️  هرگز .env را commit نکنید
⚠️  Coordinates همیشه [longitude, latitude] است (نه lat, lng)
⚠️  Category های AI-generated باید admin تأیید کند
⚠️  dynamicAttributes باید sanitize شود
⚠️  2dsphere index باید قبل از query وجود داشته باشد
⚠️  Rate limiting روی AI expansion حیاتی است
