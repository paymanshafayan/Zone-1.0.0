/// Edge Processor — On-device processing
///
/// Matches the backend EdgeProcessor (packages/voice/src/edge-processor.ts)
/// For MVP, uses keyword matching (same as backend dev mode).
/// Production: ONNX models for tag extraction and intent detection.
///
/// Privacy: Raw speech text NEVER leaves the device.
/// Only structured data is sent to the server.
library core_edge_edge_processor;

import 'tagger/tag_extractor.dart';
import 'intent/intent_detector.dart';
import 'number/number_extractor.dart';
import 'confirm/readback_formatter.dart';

class EdgeProcessingResult {
  final List<String> tags;
  final String intent; // 'KNOW', 'ASK', 'UNKNOWN'
  final List<ExtractedNumber> numbers;
  final String? readbackText;
  final double confidence;
  final Duration processingTime;

  const EdgeProcessingResult({
    required this.tags,
    required this.intent,
    required this.numbers,
    this.readbackText,
    required this.confidence,
    required this.processingTime,
  });

  /// Structured data to send to the server (no raw text!)
  Map<String, dynamic> toStructuredData() {
    return {
      'tags': tags,
      'intent': intent,
      'numbers': numbers.map((n) => n.toJson()).toList(),
      'confidence': confidence,
      // ⚠️ No raw text sent!
    };
  }
}

class ExtractedNumber {
  final num value;
  final String unit;
  final String basis; // 'per_square_metre', 'total', etc.
  final String? rawText;

  const ExtractedNumber({
    required this.value,
    required this.unit,
    required this.basis,
    this.rawText,
  });

  Map<String, dynamic> toJson() => {
    'value': value,
    'unit': unit,
    'basis': basis,
  };
}

/// Edge Processor — main entry point for on-device processing
class EdgeProcessor {
  final TagExtractor _tagExtractor = TagExtractor();
  final IntentDetector _intentDetector = IntentDetector();
  final NumberExtractor _numberExtractor = NumberExtractor();
  final ReadbackFormatter _readbackFormatter = ReadbackFormatter();

  /// Process raw speech text on device
  ///
  /// This is the ONLY method that receives raw text.
  /// Everything after this uses only structured data.
  EdgeProcessingResult process(String rawText) {
    final stopwatch = Stopwatch()..start();

    // 1. Extract tags (keyword matching for MVP, ONNX in production)
    final tags = _tagExtractor.extract(rawText);

    // 2. Detect intent (3-class classifier)
    final intent = _intentDetector.detect(rawText, tags);

    // 3. Extract numbers (regex-based)
    final numbers = _numberExtractor.extract(rawText);

    // 4. Generate readback if numbers found
    String? readbackText;
    if (numbers.isNotEmpty) {
      readbackText = _readbackFormatter.format(numbers.first);
    }

    // 5. Calculate confidence
    final confidence = _calculateConfidence(tags, intent, numbers);

    stopwatch.stop();

    return EdgeProcessingResult(
      tags: tags,
      intent: intent,
      numbers: numbers,
      readbackText: readbackText,
      confidence: confidence,
      processingTime: stopwatch.elapsed,
    );
  }

  double _calculateConfidence(
    List<String> tags,
    String intent,
    List<ExtractedNumber> numbers,
  ) {
    double confidence = 0.0;

    // Tag confidence
    if (tags.isNotEmpty) {
      confidence += 0.4;
    }

    // Intent confidence
    if (intent != 'UNKNOWN') {
      confidence += 0.3;
    }

    // Number confidence
    if (numbers.isNotEmpty) {
      confidence += 0.2;
    }

    // Both tags and numbers
    if (tags.isNotEmpty && numbers.isNotEmpty) {
      confidence += 0.1;
    }

    return confidence.clamp(0.0, 1.0);
  }
}
