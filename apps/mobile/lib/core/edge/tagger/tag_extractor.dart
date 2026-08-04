/// Tag Extractor — On-device tag extraction
///
/// Matches backend: packages/voice/src/edge-processor.ts
/// For MVP: keyword matching against closed vocabulary.
/// Production: ONNX model for semantic extraction.
library core_edge_tagger_tag_extractor;

class TagExtractor {
  /// Closed vocabulary — same as backend INITIAL_VOCABULARY
  /// Synced from server via GET /api/tags/sync
  static const Map<String, List<String>> _keywordMap = {
    // ─── Services ───
    'services/house_painting': ['نقاش', 'رنگ', 'رنگ‌آمیزی', 'دیوار', 'نقاشی ساختمان', 'رنگ خونه'],
    'services/plumbing': ['لوله‌کش', 'لوله', 'آب', 'شیرآلات', 'لوله‌کشی', 'نشتی'],
    'services/electrical': ['برق', 'برقکار', 'سیم‌کشی', 'سوکت', 'چراغ', 'فیوز', 'برق‌کار'],
    'services/carpentry': ['نجار', 'چوب', 'کابینت', 'درب', 'نجاری', 'چوب‌کار'],
    'services/locksmith': ['قفل‌ساز', 'قفل', 'کلید', 'کلیدسازی', 'قفل‌سازی'],
    'services/tiling': ['کاشی', 'سرامیک', 'کاشی‌کار', 'سرامیک‌کار', 'کاشی‌کاری'],
    'services/repair': ['تعمیر', 'تعمیرکار', 'تعمیرات', 'فنی'],
    'services/appliance_repair': ['تعمیرات لوازم', 'یخچال', 'ماشین لباسشویی', 'اجاق', 'لوازم خانگی'],
    'services/air_conditioning': ['کولر', 'اسپلیت', 'کولرگازی', 'تهویه', 'کولر آبی'],
    'services/cleaning': ['نظافت', 'تمیز', 'نظافتچی', 'خانه‌داری', 'تمیزکاری'],
    'services/moving': ['باربری', 'اکسپرس', 'حمل بار', 'باربر'],
    'services/tutoring': ['معلم', 'دریافت', 'تدریس', 'کلاس', 'آموزش'],

    // ─── Urgency ───
    'urgency/urgent': ['فوری', 'زود', 'الهام', 'الان', 'هرچه سریع‌تر'],
    'urgency/emergency': ['اضطراری', 'خطر', 'کمک', 'نور', 'فوریت'],
    'urgency/normal': ['عادی', 'معمولی', 'وقت دارم'],

    // ─── Social ───
    'social/sports': ['ورزش', 'فوتبال', 'والیبال', 'بسکتبال', 'دویدن', 'ورزشی'],
    'social/study': ['مطالعه', 'کتاب', 'درس', 'هم‌درسی'],
    'social/walk': ['پیاده‌روی', 'قدم', 'گردش', 'پارک'],
    'social/tea': ['چای', 'قهوه', 'کافه', 'نشستن'],
    'social/games': ['بازی', 'بازی‌های فکری', 'شطرنج', 'کارت'],
    'social/cooking': ['آشپزی', 'غذا', 'آشپز', 'خوراک'],
    'social/garden': ['باغ', 'گل', 'گلکاری', 'سبزیجات'],
    'social/pet': ['حیوان', 'سگ', 'گربه', 'حیوان خانگی'],

    // ─── Support ───
    'support/advice': ['مشاوره', 'راهنمایی', 'نصیحت', 'پیشنهاد'],
    'support/companionship': ['همراهی', 'رفیق', 'دوستی', 'هم‌صحبت'],
    'support/help': ['کمک', 'یاری', 'دستگیری', 'نیاز'],
  };

  /// Extract tags from raw text
  List<String> extract(String text) {
    final normalizedText = _normalize(text);
    final matchedTags = <String>{};

    for (final entry in _keywordMap.entries) {
      for (final keyword in entry.value) {
        if (normalizedText.contains(_normalize(keyword))) {
          matchedTags.add(entry.key);
          break; // One match per tag is enough
        }
      }
    }

    return matchedTags.toList();
  }

  /// Normalize Persian text for matching
  String _normalize(String text) {
    return text
        .replaceAll('\u06CC', '\u06CC') // Arabic yeh → Persian yeh
        .replaceAll('\u0643', '\u06A9') // Arabic kaf → Persian kaf
        .replaceAll('\u0647\u200C', '\u0647') // Arabic heh + ZWNJ → heh
        .replaceAll('\u0629', '\u0647') // Arabic ta marbuta → heh
        .replaceAll('\u0624', '\u0648') // Arabic waw with hamza
        .replaceAll('\u0625', '\u0627') // Arabic alef with hamza below
        .replaceAll('\u0623', '\u0627') // Arabic alef with hamza above
        .replaceAll('\u0622', '\u0627') // Arabic alef with madda
        .trim()
        .toLowerCase();
  }
}
