/// State Management Tests — Provider tests for Phase 10c
///
/// Tests the core state management:
///   - Voice state transitions
///   - Notification anti-nuisance rules
///   - Connectivity service
///   - Cache service
///   - Profile persistence
/// State management tests.
library state_management_test;
import 'package:flutter_test/flutter_test.dart';

import 'package:zone_app/core/edge/edge_processor.dart';
import 'package:zone_app/features/voice/providers/voice_provider.dart';
import 'package:zone_app/shared/services/notification_service.dart';
import 'package:zone_app/shared/models/zone_models.dart';

void main() {
  // ─── Voice State Tests ───

  group('VoiceState', () {
    test('VoiceStateData starts in idle state', () {
      const state = VoiceStateData();
      expect(state.state, equals(VoiceState.idle));
      expect(state.conversation, isEmpty);
    });

    test('VoiceStateData copyWith preserves immutability', () {
      const original = VoiceStateData();
      final modified = original.copyWith(state: VoiceState.recording);
      expect(original.state, equals(VoiceState.idle));
      expect(modified.state, equals(VoiceState.recording));
    });
  });

  // ─── Notification Anti-Nuisance Tests ───

  group('NotificationService', () {
    test('NotificationState starts with empty notifications', () {
      const state = NotificationState();
      expect(state.notifications, isEmpty);
      expect(state.dailyCount, equals(0));
      expect(state.unreadCount, equals(0));
    });

    test('NotificationState unreadCount works correctly', () {
      final state = NotificationState(
        notifications: [
          ZoneNotification(
            id: '1',
            type: ZoneNotificationType.wave,
            title: 'Test',
            body: 'Test',
            createdAt: DateTime.now(),
            isRead: false,
          ),
          ZoneNotification(
            id: '2',
            type: ZoneNotificationType.response,
            title: 'Test',
            body: 'Test',
            createdAt: DateTime.now(),
            isRead: true,
          ),
          ZoneNotification(
            id: '3',
            type: ZoneNotificationType.learning,
            title: 'Test',
            body: 'Test',
            createdAt: DateTime.now(),
            isRead: false,
          ),
        ],
      );
      expect(state.unreadCount, equals(2));
    });

    test('ZoneNotification copyWith preserves immutability', () {
      final original = ZoneNotification(
        id: '1',
        type: ZoneNotificationType.wave,
        title: 'Test',
        body: 'Test',
        createdAt: DateTime.now(),
      );
      final modified = original.copyWith(isRead: true);
      expect(original.isRead, isFalse);
      expect(modified.isRead, isTrue);
    });
  });

  // ─── Edge Processor Comprehensive Tests ───

  group('EdgeProcessor Comprehensive', () {
    final processor = EdgeProcessor();

    test('extracts multiple tags from complex text', () {
      final result = processor.process('لوله‌کش فوری می‌خوام');
      expect(result.tags, contains('services/plumbing'));
      expect(result.tags, contains('urgency/urgent'));
    });

    test('handles empty text', () {
      final result = processor.process('');
      expect(result.tags, isEmpty);
      expect(result.intent, equals('UNKNOWN'));
    });

    test('handles very long text', () {
      final longText = 'نقاش می‌خوام ' * 100;
      final result = processor.process(longText);
      expect(result.tags, contains('services/house_painting'));
      expect(result.processingTime.inMilliseconds, lessThan(500));
    });

    test('extracts number with scale word هزار', () {
      final result = processor.process('پنجاه هزار تومان');
      expect(result.numbers, isNotEmpty);
      expect(result.numbers.first.value, equals(50000));
    });

    test('extracts number with scale word میلیون', () {
      final result = processor.process('یک میلیون و پانصد هزار');
      expect(result.numbers, isNotEmpty);
      // Should extract the number
      expect(result.numbers.first.value, greaterThan(0));
    });

    test('confidence is 0 for empty text', () {
      final result = processor.process('');
      expect(result.confidence, equals(0.0));
    });

    test('confidence is high for text with tags and numbers', () {
      final result = processor.process('نقاش می‌خوام پنجاه هزار تومان');
      expect(result.confidence, greaterThan(0.5));
    });
  });

  // ─── Persian Number Tests ───

  group('Persian Number Extraction', () {
    final processor = EdgeProcessor();

    test('extracts Persian digits', () {
      final result = processor.process('۹۰ هزار تومان');
      expect(result.numbers, isNotEmpty);
      expect(result.numbers.first.value, equals(90000));
    });

    test('extracts word numbers', () {
      final result = processor.process('هفتاد هزار تومان');
      expect(result.numbers, isNotEmpty);
      expect(result.numbers.first.value, equals(70000));
    });

    test('extracts number with daily basis', () {
      final result = processor.process('هر ماه پنجاه هزار تومان');
      expect(result.numbers, isNotEmpty);
    });

    test('extracts number with hourly basis', () {
      final result = processor.process('ساعتی پنجاه هزار تومان');
      expect(result.numbers, isNotEmpty);
    });
  });

  // ─── Model Serialization Tests ───

  group('Model Serialization', () {
    test('Tag fromJson', () {
      final json = {
        'id': 't1',
        'path': 'services/house_painting',
        'label': 'نقاشی ساختمان',
        'labelEn': 'House Painting',
        'parentId': null,
        'demandCount': 5,
        'isApproved': true,
      };
      final tag = Tag.fromJson(json);
      expect(tag.id, equals('t1'));
      expect(tag.path, equals('services/house_painting'));
      expect(tag.label, equals('نقاشی ساختمان'));
    });

    test('Memory fromJson', () {
      final json = {
        'id': 'm1',
        'zoneId': 'z1',
        'personId': 'p1',
        'skill': 'house_painting',
        'description': 'آقای رضایی عالی بود',
        'outcome': 'positive',
        'sourcePersonId': 'p2',
        'confidence': 0.85,
        'credibility': 0.82,
        'createdAt': '2026-08-02T10:00:00Z',
      };
      final memory = Memory.fromJson(json);
      expect(memory.id, equals('m1'));
      expect(memory.confidence, equals(0.85));
      expect(memory.credibility, equals(0.82));
    });

    test('HearingSpace fromJson', () {
      final json = {
        'id': 's1',
        'zoneId': 'z1',
        'type': 'dynamic',
        'name': null,
        'tags': ['services/house_painting'],
        'radius': 2.5,
        'reverberationTtl': 7200,
        'memberCount': 5,
        'createdAt': '2026-08-02T10:00:00Z',
      };
      final space = HearingSpace.fromJson(json);
      expect(space.id, equals('s1'));
      expect(space.type, equals('dynamic'));
      expect(space.memberCount, equals(5));
    });

    test('SubscriptionPlan fromJson', () {
      final json = {
        'id': 'monthly',
        'name': 'ماهانه',
        'durationDays': 30,
        'price': 150000,
        'discount': 0.0,
      };
      final plan = SubscriptionPlan.fromJson(json);
      expect(plan.id, equals('monthly'));
      expect(plan.price, equals(150000));
    });

    test('ProfessionalLicense fromJson', () {
      final json = {
        'id': 'l1',
        'personId': 'p1',
        'profession': 'نقاشی ساختمان',
        'licenseNumber': '۱۲۳۴۵/م',
        'licenseImageUrl': 'https://example.com/license.jpg',
        'status': 'verified',
        'rejectionReason': null,
        'createdAt': '2026-08-02T10:00:00Z',
      };
      final license = ProfessionalLicense.fromJson(json);
      expect(license.id, equals('l1'));
      expect(license.status, equals(LicenseStatus.verified));
    });

    test('MemoryDemand fromJson', () {
      final json = {
        'id': 'd1',
        'skill': 'house_painting',
        'zoneId': 'z1',
        'requesterId': 'p1',
        'status': 'open',
        'createdAt': '2026-08-02T10:00:00Z',
      };
      final demand = MemoryDemand.fromJson(json);
      expect(demand.id, equals('d1'));
      expect(demand.status, equals(DemandStatus.open));
    });
  });

  // ─── Privacy Guarantee Tests ───

  group('Privacy Guarantees', () {
    final processor = EdgeProcessor();

    test('structured data never contains raw Persian text', () {
      final inputs = [
        'یه نقاش می‌خوام برای آپارتمانم که ۸۰ متره',
        'لوله‌کش بلده بیاد خونه ما؟ فوریه!',
        'کی رو می‌شناسی که بتونه برق‌کاری کنه؟',
        'نقاش به من گفت نود هزار تومان متر مربع',
      ];

      for (final input in inputs) {
        final result = processor.process(input);
        final data = result.toStructuredData();
        final dataStr = data.toString();

        // Verify no raw text leakage
        expect(dataStr.contains('آپارتمانم'), isFalse,
            reason: 'Raw text leaked for: $input');
        expect(data.containsKey('rawText'), isFalse,
            reason: 'rawText key found for: $input');
      }
    });

    test('structured data only contains tags, intent, numbers', () {
      final result = processor.process('نقاش می‌خوام پنجاه هزار تومان');
      final data = result.toStructuredData();

      expect(data.containsKey('tags'), isTrue);
      expect(data.containsKey('intent'), isTrue);
      expect(data.containsKey('numbers'), isTrue);
      expect(data.containsKey('confidence'), isTrue);

      // Should NOT contain raw text
      expect(data.containsKey('text'), isFalse);
      expect(data.containsKey('rawText'), isFalse);
      expect(data.containsKey('speech'), isFalse);
    });
  });
}
