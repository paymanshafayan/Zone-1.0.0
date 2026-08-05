/// Readback Formatter — Voice-friendly number confirmation
///
/// Matches backend: packages/voice/src/edge-processor.ts
/// Generates mandatory read-back text for number confirmation.
///
/// Example:
///   Input: {value: 90000, unit: 'تومان', basis: 'per_square_metre'}
///   Output: «یعنی نود هزار تومان متر مربع، درسته؟»
library core_edge_confirm_readback_formatter;

import '../edge_processor.dart';

class ReadbackFormatter {
  /// Format a number for read-back confirmation
  ///
  /// This is MANDATORY — no number enters the system without confirmation.
  /// Hard rule from the architecture doc.
  String format(ExtractedNumber number) {
    final spokenNumber = _numberToPersianWords(number.value);
    final basisLabel = _basisLabel(number.basis);
    final unitLabel = number.unit;

    return 'یعنی $spokenNumber $unitLabel $basisLabel، درسته؟';
  }

  /// Convert number to Persian words for voice output
  ///
  /// Examples:
  ///   90000 → «نود هزار»
  ///   75000 → «هفتاد و پنج هزار»
  ///   150000 → «یکصد و پنجاه هزار»
  ///   1400000 → «یک میلیون و چهارصد هزار»
  String _numberToPersianWords(num value) {
    final intVal = value.toInt();
    if (intVal == 0) {
      return 'صفر';
    }

    final parts = <String>[];

    // Billions
    if (intVal >= 1000000000) {
      final billions = intVal ~/ 1000000000;
      parts.add('${_numberToPersianWords(billions)} میلیارد');
      final remaining = intVal % 1000000000;
      if (remaining > 0) {
        parts.add(_numberToPersianWords(remaining));
      }
      return parts.join(' و ');
    }

    // Millions
    if (intVal >= 1000000) {
      final millions = intVal ~/ 1000000;
      parts.add('${_numberToPersianWords(millions)} میلیون');
      final remaining = intVal % 1000000;
      if (remaining > 0) {
        parts.add(_numberToPersianWords(remaining));
      }
      return parts.join(' و ');
    }

    // Thousands
    if (intVal >= 1000) {
      final thousands = intVal ~/ 1000;
      parts.add('${_numberToPersianWords(thousands)} هزار');
      final remaining = intVal % 1000;
      if (remaining > 0) {
        parts.add(_numberToPersianWords(remaining));
      }
      return parts.join(' و ');
    }

    // Hundreds
    if (intVal >= 100) {
      final hundreds = intVal ~/ 100;
      parts.add('${_digitToWord(hundreds)}صد');
      final remaining = intVal % 100;
      if (remaining > 0) {
        parts.add(_numberToPersianWords(remaining));
      }
      return parts.join(' و ');
    }

    // Direct word numbers
    if (_wordNumbers.containsValue(intVal)) {
      return _wordNumbers.entries.firstWhere((e) => e.value == intVal).key;
    }

    // Composite: tens + ones
    if (intVal >= 20) {
      final tens = (intVal ~/ 10) * 10;
      final ones = intVal % 10;
      if (ones == 0) {
        return _wordNumbers.entries.firstWhere((e) => e.value == tens).key;
      }
      return '${_wordNumbers.entries.firstWhere((e) => e.value == tens).key} و ${_wordNumbers.entries.firstWhere((e) => e.value == ones).key}';
    }

    // 10-19
    return _wordNumbers.entries.firstWhere((e) => e.value == intVal).key;
  }

  static const Map<String, int> _wordNumbers = {
    'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
    'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
    'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14,
    'پانزده': 15, 'شانزده': 16, 'هفده': 17, 'هجده': 18,
    'نوزده': 19, 'بیست': 20, 'سی': 30, 'چهل': 40,
    'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80,
    'نود': 90,
  };

  String _digitToWord(int digit) {
    const map = {
      1: 'یک', 2: 'دو', 3: 'سه', 4: 'چهار', 5: 'پنج',
      6: 'شش', 7: 'هفت', 8: 'هشت', 9: 'نه',
    };
    return map[digit] ?? '';
  }

  String _basisLabel(String basis) {
    switch (basis) {
      case 'per_square_metre': return 'متر مربع';
      case 'total': return 'کل';
      case 'per_day': return 'هر روز';
      case 'per_hour': return 'هر ساعت';
      case 'per_month': return 'هر ماه';
      case 'per_kilo': return 'هر کیلو';
      default: return 'هر واحد';
    }
  }
}
