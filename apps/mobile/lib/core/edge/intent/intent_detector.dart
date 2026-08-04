/// Intent Detector — On-device intent classification
///
/// Matches backend: packages/voice/src/edge-processor.ts
/// Three-class classifier: KNOW / ASK / UNKNOWN
/// For MVP: rule-based. Production: ONNX model.
library core_edge_intent_intent_detector;

class IntentDetector {
  /// ASK patterns — user is looking for something
  static const List<String> _askPatterns = [
    'می‌خوام', 'میخوام', 'آیا', 'کسی', 'کجا', 'چطور',
    'معرفی', 'پیدا', 'بشه', 'دارید', 'میشه', 'بلده',
    'یکی', 'نفر', 'کس', 'کدوم', 'چی', 'کمک',
  ];

  /// KNOW patterns — user is sharing information
  static const List<String> _knowPatterns = [
    'من می‌تونم', 'بلدم', 'می‌شناسم', 'معرفی می‌کنم',
    'گرفتم', 'پیدا کردم', 'عالی بود', 'خیلی خوب',
    'بد نبود', 'راضی بودم', 'ناراضی بودم', 'کار کرده',
    'خبر دارم', 'می‌دونم', 'عالیه', 'خوبه', 'خوب بود',
    'توصیه می‌کنم', 'پیشنهاد می‌کنم',
  ];

  /// Detect intent from text and extracted tags
  String detect(String text, List<String> tags) {
    final normalizedText = _normalize(text);

    // Count pattern matches
    int askScore = 0;
    int knowScore = 0;

    for (final pattern in _askPatterns) {
      if (normalizedText.contains(_normalize(pattern))) {
        askScore++;
      }
    }

    for (final pattern in _knowPatterns) {
      if (normalizedText.contains(_normalize(pattern))) {
        knowScore++;
      }
    }

    // Decision logic
    if (knowScore > askScore && knowScore >= 1) {
      return 'KNOW';
    }

    if (knowScore > 0 && knowScore == askScore) {
      return 'KNOW'; // Tie: prefer KNOW (more useful)
    }

    if (askScore > 0 && tags.isNotEmpty) {
      return 'ASK';
    }

    if (askScore > 0 && tags.isEmpty) {
      return 'UNKNOWN'; // Asking about something not in vocabulary
    }

    // Default: if tags found but no clear intent, assume ASK
    if (tags.isNotEmpty) {
      return 'ASK';
    }

    return 'UNKNOWN';
  }

  String _normalize(String text) {
    return text
        .replaceAll('\u06CC', '\u06CC') // Arabic yeh → Persian yeh
        .replaceAll('\u0643', '\u06A9') // Arabic kaf → Persian kaf
        .trim()
        .toLowerCase();
  }
}
