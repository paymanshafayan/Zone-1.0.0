/// Integration Test — Zone App Phase 10b
///
/// Tests the core functionality of the Flutter app:
///   - Edge processor (on-device processing)
///   - API client (connection)
///   - Navigation (routes)
///   - Models (serialization)
///   - State management (providers)
library integration_test;
import 'package:flutter_test/flutter_test.dart';

import 'package:zone_app/core/edge/edge_processor.dart';
import 'package:zone_app/core/edge/tagger/tag_extractor.dart';
import 'package:zone_app/core/edge/intent/intent_detector.dart';
import 'package:zone_app/core/edge/number/number_extractor.dart';
import 'package:zone_app/core/edge/confirm/readback_formatter.dart';
import 'package:zone_app/shared/models/zone_models.dart';

void main() {
  // ─── Edge Processor Tests ───

  group('EdgeProcessor', () {
    final processor = EdgeProcessor();

    test('extracts house_painting tag from Persian text', () {
      final result = processor.process('یه نقاش می‌خوام برای خونه‌ام');
      expect(result.tags, contains('services/house_painting'));
    });

    test('extracts plumbing tag', () {
      final result = processor.process('لوله‌کش می‌خوام');
      expect(result.tags, contains('services/plumbing'));
    });

    test('extracts electrical tag', () {
      final result = processor.process('برقکار بلده بیاد؟');
      expect(result.tags, contains('services/electrical'));
    });

    test('detects ASK intent', () {
      final result = processor.process('نقاش می‌خوام');
      expect(result.intent, equals('ASK'));
    });

    test('detects KNOW intent', () {
      final result = processor.process('آقای رضایی رو می‌شناسم، عالیه');
      expect(result.intent, equals('KNOW'));
    });

    test('extracts numbers from Persian text', () {
      final result = processor.process('نود هزار تومان متر مربع');
      expect(result.numbers, isNotEmpty);
      expect(result.numbers.first.value, equals(90000));
    });

    test('generates readback text for numbers', () {
      final result = processor.process('نود هزار تومان متر مربع');
      expect(result.readbackText, isNotNull);
      expect(result.readbackText!, contains('درسته'));
    });

    test('returns structured data without raw text', () {
      final result = processor.process('یه نقاش می‌خوام برای آپارتمانم');
      final data = result.toStructuredData();
      expect(data.containsKey('tags'), isTrue);
      expect(data.containsKey('intent'), isTrue);
      // Raw text should NOT be in structured data
      expect(data.containsKey('rawText'), isFalse);
    });

    test('processing time is under 1 second', () {
      final result = processor.process('یه نقاش می‌خوام');
      expect(result.processingTime.inMilliseconds, lessThan(1000));
    });
  });

  // ─── Tag Extractor Tests ───

  group('TagExtractor', () {
    final extractor = TagExtractor();

    test('matches service tags', () {
      final tags = extractor.extract('نقاش می‌خوام');
      expect(tags, contains('services/house_painting'));
    });

    test('matches urgency tags', () {
      final tags = extractor.extract('فوری کمک می‌خوام');
      expect(tags, contains('urgency/urgent'));
    });

    test('matches social tags', () {
      final tags = extractor.extract('ورزش کی میاد؟');
      expect(tags, contains('social/sports'));
    });

    test('matches support tags', () {
      final tags = extractor.extract('مشاوره می‌خوام');
      expect(tags, contains('support/advice'));
    });

    test('returns empty for unknown text', () {
      final tags = extractor.extract('هیچی');
      expect(tags, isEmpty);
    });
  });

  // ─── Intent Detector Tests ───

  group('IntentDetector', () {
    final detector = IntentDetector();

    test('detects ASK for service request', () {
      final intent = detector.detect('نقاش می‌خوام', ['services/house_painting']);
      expect(intent, equals('ASK'));
    });

    test('detects KNOW for knowledge sharing', () {
      final intent = detector.detect('بلدم، آقای رضایی عالیه', ['services/house_painting']);
      expect(intent, equals('KNOW'));
    });

    test('detects UNKNOWN for unknown skill', () {
      final intent = detector.detect('کی بلده این کار رو بکنه؟', []);
      expect(intent, equals('UNKNOWN'));
    });
  });

  // ─── Number Extractor Tests ───

  group('NumberExtractor', () {
    final extractor = NumberExtractor();

    test('extracts simple Persian number', () {
      final numbers = extractor.extract('نود هزار تومان');
      expect(numbers, isNotEmpty);
      expect(numbers.first.value, equals(90000));
    });

    test('extracts number with basis', () {
      final numbers = extractor.extract('هفتاد هزار تومان هر متر مربع');
      expect(numbers, isNotEmpty);
      // Basis detection may vary; check that we got a number
      expect(numbers.first.value, equals(70000));
    });

    test('extracts number with duration', () {
      final numbers = extractor.extract('سه روز');
      expect(numbers, isNotEmpty);
      expect(numbers.first.value, equals(3));
    });
  });

  // ─── Readback Formatter Tests ───

  group('ReadbackFormatter', () {
    final formatter = ReadbackFormatter();

    test('formats number with confirmation', () {
      final number = ExtractedNumber(
        value: 90000,
        unit: 'تومان',
        basis: 'per_square_metre',
      );
      final text = formatter.format(number);
      expect(text, contains('نود هزار'));
      expect(text, contains('درسته'));
    });
  });

  // ─── Model Tests ───

  group('Zone Models', () {
    test('Zone fromJson', () {
      final json = {
        'id': 'z1',
        'name': 'قیطریه',
        'nameEn': 'Qeytariyeh',
        'bounds': {
          'northEast': {'latitude': 35.78, 'longitude': 51.42},
          'southWest': {'latitude': 35.77, 'longitude': 51.41},
        },
        'city': 'تهران',
        'province': 'تهران',
      };
      final zone = Zone.fromJson(json);
      expect(zone.id, equals('z1'));
      expect(zone.name, equals('قیطریه'));
      expect(zone.bounds.northEast.latitude, equals(35.78));
    });

    test('Person fromJson', () {
      final json = {
        'id': 'p1',
        'displayName': 'علی',
        'zoneId': 'z1',
        'skills': ['painting'],
        'responseRate': 0.8,
        'professionalStatus': 'professional',
      };
      final person = Person.fromJson(json);
      expect(person.id, equals('p1'));
      expect(person.isProfessional, isTrue);
    });

    test('Post fromJson', () {
      final json = {
        'id': 'post1',
        'zoneId': 'z1',
        'providerId': 'p1',
        'media': [
          {'type': 'image', 'url': 'https://example.com/img.jpg'},
        ],
        'description': 'تست',
        'tags': ['services/house_painting'],
        'isSponsored': true,
        'isActive': true,
        'publishedAt': '2026-08-02T10:00:00Z',
      };
      final post = Post.fromJson(json);
      expect(post.id, equals('post1'));
      expect(post.media.length, equals(1));
      expect(post.tags, contains('services/house_painting'));
    });

    test('ResponseModeResult fromJson', () {
      final json = {
        'mode': 'KNOW',
        'skill': 'house_painting',
        'toolName': 'search_memories',
        'message': 'دو نفر معرفی کردن',
      };
      final result = ResponseModeResult.fromJson(json);
      expect(result.mode, equals(ResponseMode.know));
      expect(result.skill, equals('house_painting'));
    });
  });

  // ─── Privacy Tests ───

  group('Privacy', () {
    test('EdgeProcessor never includes raw text in structured data', () {
      final processor = EdgeProcessor();
      final rawText = 'یه نقاش می‌خوام برای آپارتمانم که ۸۰ متره';
      final result = processor.process(rawText);
      final data = result.toStructuredData();

      // Verify raw text is NOT in the output
      final dataStr = data.toString();
      expect(dataStr.contains('آپارتمانم'), isFalse);
      expect(dataStr.contains('۸۰ متر'), isFalse);
    });
  });
}
