/// Number Extractor — On-device Persian number extraction
///
/// Matches backend: packages/voice/src/edge-processor.ts
/// Supports: Persian digits, word numbers, scale words, units
///
/// Example inputs:
///   «نود هزار تومان متر مربع» → {value: 90000, unit: 'تومان', basis: 'per_square_metre'}
///   «هفتاد و پنج هزار» → {value: 75000, unit: 'تومان', basis: 'per_unit'}
///   «سه روز» → {value: 3, unit: 'روز', basis: 'per_unit'}
library core_edge_number_number_extractor;

import '../edge_processor.dart';

class NumberExtractor {
  /// Persian digit mapping
  static const Map<String, int> _persianDigits = {
    '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4,
    '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9,
  };

  /// Word number mapping
  static const Map<String, int> _wordNumbers = {
    'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4,
    'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9,
    'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13,
    'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17,
    'هجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30,
    'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70,
    'هشتاد': 80, 'نود': 90, 'صد': 100,
  };

  /// Scale words
  static const Map<String, int> _scaleWords = {
    'هزار': 1000,
    'میلیون': 1000000,
    'میلیارد': 1000000000,
  };

  /// Basis detection patterns (matches backend)
  static const Map<String, String> _basisPatterns = {
    'متر مربع': 'per_square_metre',
    'هر متر': 'per_square_metre',
    'متری': 'per_square_metre',
    'کل': 'total',
    'جمع': 'total',
    'مجموع': 'total',
    'هر روز': 'per_day',
    'روزانه': 'per_day',
    'هر ساعت': 'per_hour',
    'ساعتی': 'per_hour',
    'هر ماه': 'per_month',
    'ماهانه': 'per_month',
    'هر کیلو': 'per_kilo',
    'کیلویی': 'per_kilo',
  };

  /// Unit mapping
  static const Map<String, String> _unitMap = {
    'تومان': 'تومان',
    'تومن': 'تومان',
    'متر': 'متر',
    'متر مربع': 'متر مربع',
    'کیلو': 'کیلوگرم',
    'کیلوگرم': 'کیلوگرم',
    'روز': 'روز',
    'هفته': 'هفته',
    'ماه': 'ماه',
    'سال': 'سال',
    'ساعت': 'ساعت',
  };

  /// Extract numbers from text
  List<ExtractedNumber> extract(String text) {
    final numbers = <ExtractedNumber>[];
    final words = text.split(RegExp(r'\s+'));

    // Try to find numbers in the text
    int? currentValue;
    int? currentScale;
    String? unit;
    String basis = 'per_unit';

    int i = 0;
    while (i < words.length) {
      final word = _normalizeWord(words[i]);

      // Check for Persian digits
      final persianNum = _parsePersianDigits(word);
      if (persianNum != null) {
        currentValue = persianNum;
        i++;
        // Check for scale word next
        if (i < words.length) {
          final nextWord = _normalizeWord(words[i]);
          if (_scaleWords.containsKey(nextWord)) {
            currentValue = currentValue * _scaleWords[nextWord]!;
            currentScale = _scaleWords[nextWord];
            i++;
          }
        }
        continue;
      }

      // Check for word numbers
      if (_wordNumbers.containsKey(word)) {
        currentValue = _wordNumbers[word];
        i++;

        // Check for "و" (and) followed by more numbers
        if (i < words.length && _normalizeWord(words[i]) == 'و') {
          i++;
          if (i < words.length) {
            final nextWord = _normalizeWord(words[i]);
            if (_wordNumbers.containsKey(nextWord)) {
              currentValue = (currentValue ?? 0) + _wordNumbers[nextWord]!;
              i++;
            }
          }
        }

        // Check for scale word
        if (i < words.length) {
          final nextWord = _normalizeWord(words[i]);
          if (_scaleWords.containsKey(nextWord)) {
            currentValue = (currentValue ?? 0) * _scaleWords[nextWord]!;
            currentScale = _scaleWords[nextWord];
            i++;
          }
        }
        continue;
      }

      // Check for unit
      if (_unitMap.containsKey(word) && currentValue != null) {
        unit = _unitMap[word];
        i++;
        continue;
      }

      // Check for basis patterns (multi-word)
      if (i + 1 < words.length) {
        final twoWords = '${word} ${_normalizeWord(words[i + 1])}';
        if (_basisPatterns.containsKey(twoWords)) {
          basis = _basisPatterns[twoWords]!;
          i += 2;
          continue;
        }
      }
      if (_basisPatterns.containsKey(word)) {
        basis = _basisPatterns[word]!;
        i++;
        continue;
      }

      // If we have a value and hit a non-number word, save it
      if (currentValue != null) {
        numbers.add(ExtractedNumber(
          value: currentValue,
          unit: unit ?? 'تومان',
          basis: basis,
          rawText: _reconstructNumber(currentValue, unit, basis),
        ));
        currentValue = null;
        currentScale = null;
        unit = null;
        basis = 'per_unit';
      }

      i++;
    }

    // Don't forget the last number
    if (currentValue != null) {
      numbers.add(ExtractedNumber(
        value: currentValue,
        unit: unit ?? 'تومان',
        basis: basis,
        rawText: _reconstructNumber(currentValue, unit, basis),
      ));
    }

    return numbers;
  }

  /// Parse Persian digits (e.g., «۹۰» → 90)
  int? _parsePersianDigits(String word) {
    int result = 0;
    bool hasPersianDigit = false;

    for (final char in word.split('')) {
      if (_persianDigits.containsKey(char)) {
        result = result * 10 + _persianDigits[char]!;
        hasPersianDigit = true;
      } else if (RegExp(r'\d').hasMatch(char)) {
        result = result * 10 + int.parse(char);
        hasPersianDigit = true;
      } else {
        return null; // Non-digit character found
      }
    }

    return hasPersianDigit ? result : null;
  }

  String _normalizeWord(String word) {
    return word
        .replaceAll('ی', 'ی')
        .replaceAll('ک', 'ک')
        .replaceAll(',', '')
        .replaceAll('،', '')
        .trim();
  }

  String _reconstructNumber(int value, String? unit, String basis) {
    return '$value ${unit ?? 'تومان'} (${_basisLabel(basis)})';
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
