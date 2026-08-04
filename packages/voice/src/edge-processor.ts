/**
 * Zone Edge Processing — On-Device Processing Module
 *
 * This module runs on the user's device (Flutter + ONNX) and processes
 * speech before it reaches the server. This means:
 * - Raw speech text never leaves the device
 * - Only structured data (tags, intent, numbers) is sent to the server
 * - 70% of processing is local from day one
 *
 * Server-side implementation is provided for testing and development.
 * The Flutter app will use ONNX Runtime for the actual on-device models.
 */

import { Logger } from '@zone/core';
import type { EdgeProcessingResult, ExtractedNumber } from '@zone/core';

// ─── Persian Number Patterns ───

const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

const PERSIAN_SCALE_WORDS: Record<string, number> = {
  'هزار': 1000,
  'میلیون': 1000000,
  'میلیارد': 1000000000,
  'ملیون': 1000000,
  'ملیارد': 1000000000,
};

const PERSIAN_UNIT_WORDS: Record<string, string> = {
  'تومان': 'toman',
  'تومن': 'toman',
  'ریال': 'rial',
  'متر': 'metre',
  'متر مربع': 'square_metre',
  'متر مکعب': 'cubic_metre',
  'کیلو': 'kilo',
  'کیلوگرم': 'kilogram',
  'لیتر': 'litre',
  'عدد': 'piece',
  'دانه': 'piece',
  'روز': 'day',
  'هفته': 'week',
  'ماه': 'month',
  'سال': 'year',
  'ساعت': 'hour',
};

const PERSIAN_NUMBER_WORDS: Record<string, number> = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4,
  'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9,
  'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13,
  'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17,
  'هجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30,
  'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70,
  'هشتاد': 80, 'نود': 90, 'صد': 100, 'دویست': 200,
  'سیصد': 300, 'چهارصد': 400, 'پانصد': 500,
};

// ─── Edge Processor ───

export class EdgeProcessor {
  private logger: Logger;
  private tagVocabulary: Map<string, string[]> = new Map();

  constructor(vocabulary?: string[]) {
    this.logger = new Logger({ context: { service: 'edge-processor' } });
    if (vocabulary) {
      this.loadVocabulary(vocabulary);
    }
  }

  /**
   * Load the closed vocabulary for tag matching
   */
  loadVocabulary(paths: string[]): void {
    for (const path of paths) {
      const branch = path.split('/')[0];
      if (!this.tagVocabulary.has(branch)) {
        this.tagVocabulary.set(branch, []);
      }
      this.tagVocabulary.get(branch)!.push(path);
    }
  }

  /**
   * Process raw speech text on-device
   * Returns structured data without sending the raw text to the server
   */
  async process(text: string): Promise<EdgeProcessingResult> {
    const startTime = Date.now();

    // 1. Extract tags
    const tags = this.extractTags(text);

    // 2. Detect intent
    const intent = this.detectIntent(text, tags);

    // 3. Extract numbers
    const numbers = this.extractNumbers(text);

    // 4. Calculate confidence
    const confidence = this.calculateConfidence(tags, intent, numbers);

    const duration = Date.now() - startTime;
    this.logger.debug('edge:processed', {
      textLength: text.length,
      tags: tags.length,
      intent,
      numbers: numbers.length,
      confidence,
      duration,
    });

    return {
      tags,
      intent,
      numbers,
      confidence,
    };
  }

  // ─── Tag Extraction ───

  /**
   * Extract tags from speech text using the closed vocabulary
   * In production, this uses an ONNX model on the device.
   * Here we use keyword matching for development/testing.
   */
  extractTags(text: string): string[] {
    const normalizedText = this.normalizePersian(text);
    const matchedTags: string[] = [];

    // Service keywords mapping
    const serviceKeywords: Record<string, string[]> = {
      'services/house_painting': ['نقاش', 'رنگ', 'رنگ‌آمیزی', 'نقاشی', 'دیوار', 'رنگ کردن', 'paint'],
      'services/plumbing': ['لوله', 'لوله‌کش', 'آب', 'شیرآلات', 'لوله‌کشی', 'plumb'],
      'services/electrical': ['برق', 'برقکار', 'سیم', 'سوکت', 'چراغ', 'برقکاری', 'electr'],
      'services/cleaning': ['نظافت', 'تمیز', 'نظافتچی', 'شستن', 'clean'],
      'services/repair': ['تعمیر', 'درست', 'خراب', 'تعمیرات', 'fix', 'repair'],
      'services/moving': ['اسباب', 'کشی', 'اسباب‌کشی', 'حمل', 'جابجایی', 'move'],
      'services/carpentry': ['نجار', 'چوب', 'نجاری', 'کابینت', 'carpent'],
      'services/tiling': ['سرامیک', 'کاشی', 'سرامیک‌کار', 'کاشی‌کار', 'tile'],
      'services/air_conditioning': ['کولر', 'تهویه', 'اسپلیت', 'کولر‌گاه', 'air cond'],
      'services/locksmith': ['قفل', 'کلید', 'قفل‌ساز', 'کلیدساز', 'lock'],
      'services/landscaping': ['باغ', 'چمن', 'گل', 'باغبانی', 'گلکاری', 'garden'],
      'services/appliance_repair': ['یخچال', 'لباسشویی', 'ماشین', 'لوازم', 'appliance'],
    };

    // Social keywords mapping
    const socialKeywords: Record<string, string[]> = {
      'social/sports': ['ورزش', 'فوتبال', 'والیبال', 'بسکتبال', 'دویدن', 'ورزش کردن'],
      'social/walking': ['پیاده', 'پیاده‌روی', 'قدم', 'گشت', 'walk'],
      'social/gaming': ['بازی', 'گیم', 'بازی کردن'],
      'social/food': ['غذا', 'خوراک', 'آشپز', 'پختن', 'رستوران', 'غذا خوردن'],
      'social/party': ['جشن', 'ولادت', 'تولد', 'مراسم', 'مهمانی', 'party'],
      'social/trip': ['سفر', 'تور', 'مسافرت', 'گردش', 'trip'],
      'social/study': ['درس', 'مطالعه', 'کتاب', 'خواندن', 'آموزش'],
      'social/volunteer': ['خیریه', 'کمک', 'داوطلب', 'نیکوکار'],
    };

    // Support keywords mapping
    const supportKeywords: Record<string, string[]> = {
      'support/advice': ['مشوره', 'مشاوره', 'نصیحت', 'راهنمایی', 'advice'],
      'support/brainstorm': ['همفکری', 'ایده', 'فکر', 'brainstorm'],
      'support/help': ['کمک', 'یاری', 'نجات', 'help'],
    };

    // Urgency keywords
    const urgencyKeywords: Record<string, string[]> = {
      'urgency/urgent': ['فوری', 'عجله', 'زود', 'فوراً'],
      'urgency/emergency': ['اضطراری', 'خطر', 'خون', 'تصادف', 'حریق', 'نفس'],
    };

    const allKeywords: Record<string, string[]> = {
      ...serviceKeywords,
      ...socialKeywords,
      ...supportKeywords,
      ...urgencyKeywords,
    };

    for (const [tag, keywords] of Object.entries(allKeywords)) {
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword)) {
          if (!matchedTags.includes(tag)) {
            matchedTags.push(tag);
          }
          break;
        }
      }
    }

    // Default: if no service tag matched but user is asking for something
    if (matchedTags.length === 0 && normalizedText.length > 0) {
      matchedTags.push('urgency/normal');
    }

    return matchedTags;
  }

  // ─── Intent Detection ───

  /**
   * Detect the user's intent from their speech
   * Three modes: KNOW (has info), ASK (needs help), UNKNOWN (can't help)
   *
   * In production, this uses an ONNX classifier on the device.
   * Here we use heuristics for development/testing.
   */
  detectIntent(text: string, tags: string[]): 'know' | 'ask' | 'unknown' {
    const normalizedText = this.normalizePersian(text);

    // KNOW patterns: user is sharing information
    const knowPatterns = [
      'معرفی می‌کنم', 'پیشنهاد می‌دم', 'شناخته‌ام', 'کار کرده',
      'خوب بود', 'عالی بود', 'راضی بودم', 'تأیید می‌کنم',
      'آقای', 'خانم', 'استاد', 'مهندس',
    ];

    // ASK patterns: user is requesting help
    const askPatterns = [
      'می‌خوام', 'میخوام', 'لازم دارم', 'نیاز دارم', 'کسی هست',
      'معرفی', 'پیدا', 'می‌شناسی', 'بلد هستی', 'کجاست',
      'نقاش', 'برقکار', 'لوله‌کش', 'تعمیر', 'نظافت',
      'بریم', 'بیام', 'بگید', 'کمک',
    ];

    // UNKNOWN patterns: user is expressing uncertainty
    const unknownPatterns = [
      'نمی‌دونم', 'نمیشناسم', 'کسی رو نمی‌شناسم', 'اطلاع ندارم',
      'راهی نیست', 'نمی‌تونم', 'امکانش نیست',
    ];

    // Score each intent
    let knowScore = 0;
    let askScore = 0;
    let unknownScore = 0;

    for (const pattern of knowPatterns) {
      if (normalizedText.includes(pattern)) knowScore++;
    }

    for (const pattern of askPatterns) {
      if (normalizedText.includes(pattern)) askScore++;
    }

    for (const pattern of unknownPatterns) {
      if (normalizedText.includes(pattern)) unknownScore++;
    }

    // Service/social tags strongly suggest ASK
    if (tags.some((t) => t.startsWith('services/') || t.startsWith('social/'))) {
      askScore += 2;
    }

    // Return the highest scoring intent
    if (unknownScore > knowScore && unknownScore > askScore) return 'unknown';
    if (knowScore > askScore) return 'know';
    return 'ask';
  }

  // ─── Number Extraction ───

  /**
   * Extract numbers from Persian speech text
   * Handles: Persian digits, number words, scale words, units
   *
   * CRITICAL: Numbers must be confirmed via read-back before entering the system.
   */
  extractNumbers(text: string): ExtractedNumber[] {
    const normalizedText = this.normalizePersian(text);
    const numbers: ExtractedNumber[] = [];

    // Pattern 1: Numeric values (Persian or Latin digits)
    const numericPattern = /([۰-۹0-9]+[\s]*(هزار|میلیون|میلیارد|ملیون|ملیارد)?)\s*(تومان|تومن|ریال|متر|مترمربع|کیلو|کیلوگرم|لیتر|عدد|دانه|روز|هفته|ماه|سال|ساعت)?/g;

    let match: RegExpExecArray | null;
    while ((match = numericPattern.exec(normalizedText)) !== null) {
      const raw = match[0].trim();
      const value = this.parseNumericValue(match[1], match[2]);
      const unit = this.mapUnit(match[3] || '');

      if (value > 0) {
        numbers.push({
          raw,
          value,
          unit,
          basis: 'per_unit', // default, will be refined
          isConfirmed: false,
        });
      }
    }

    // Pattern 2: Word-based numbers
    const wordNumbers = this.extractWordNumbers(normalizedText);
    numbers.push(...wordNumbers);

    return numbers;
  }

  /**
   * Parse a numeric string with optional scale word
   */
  private parseNumericValue(numStr: string, scaleWord?: string): number {
    // Convert Persian digits to Latin
    let latinStr = numStr;
    for (const [persian, latin] of Object.entries(PERSIAN_DIGITS)) {
      latinStr = latinStr.replace(new RegExp(persian, 'g'), latin);
    }

    let value = parseInt(latinStr.replace(/\s/g, ''), 10);
    if (isNaN(value)) return 0;

    // Apply scale
    if (scaleWord) {
      const scale = PERSIAN_SCALE_WORDS[scaleWord.trim()];
      if (scale) value *= scale;
    }

    return value;
  }

  /**
   * Extract numbers written as words (e.g. "نود هزار تومان")
   */
  private extractWordNumbers(text: string): ExtractedNumber[] {
    const numbers: ExtractedNumber[] = [];

    // Common patterns: "نود هزار تومان", "هشتاد و پنج", "دویست هزار"
    const wordPattern = /((?:دویست|سیصد|چهارصد|پانصد|صد|هزار|میلیون|میلیارد|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|و\s*)+)\s*(تومان|تومن|ریال|متر|مترمربع|کیلو|روز|هفته|ماه|سال|ساعت)?/g;

    let match: RegExpExecArray | null;
    while ((match = wordPattern.exec(text)) !== null) {
      const raw = match[0].trim();
      const value = this.parseWordNumber(match[1]);

      if (value > 0) {
        const unit = this.mapUnit(match[2] || '');
        numbers.push({
          raw,
          value,
          unit,
          basis: 'per_unit',
          isConfirmed: false,
        });
      }
    }

    return numbers;
  }

  /**
   * Parse a word-based number string
   */
  private parseWordNumber(wordStr: string): number {
    let total = 0;
    let current = 0;

    const words = wordStr.split(/\s+/).filter((w) => w !== 'و');

    for (const word of words) {
      const num = PERSIAN_NUMBER_WORDS[word];
      if (num === undefined) continue;

      if (num === 1000 || num === 1000000 || num === 1000000000) {
        // Scale word: multiply current by it
        current = (current || 1) * num;
        total += current;
        current = 0;
      } else if (num >= 100) {
        // Hundreds: add to current
        current += num;
      } else if (num >= 10) {
        // Tens: add to current
        current += num;
      } else {
        // Units: add to current
        current += num;
      }
    }

    total += current;
    return total;
  }

  // ─── Read-back Confirmation ───

  /**
   * Generate a read-back confirmation for extracted numbers
   * This is the MANDATORY step before any number enters the system.
   *
   * Example:
   *   Input: { value: 90000, unit: 'toman', basis: 'per_unit' }
   *   Output: "یعنی نود هزار تومان متر مربع؟"
   */
  generateReadback(number: ExtractedNumber): string {
    const valueText = this.valueToPersianText(number.value);
    const unitText = this.unitToPersianText(number.unit);
    const basisText = this.basisToPersianText(number.basis);

    return `یعنی ${valueText} ${unitText}${basisText ? ' ' + basisText : ''}، درسته؟`;
  }

  /**
   * Convert a numeric value to Persian text
   */
  private valueToPersianText(value: number): string {
    if (value >= 1000000) {
      const millions = value / 1000000;
      if (value % 1000000 === 0) {
        return `${this.smallNumberToText(millions)} میلیون`;
      }
      return `${this.smallNumberToText(Math.floor(millions))} میلیون ${this.smallNumberToText(value % 1000000)}`;
    }
    if (value >= 1000) {
      const thousands = value / 1000;
      if (value % 1000 === 0) {
        return `${this.smallNumberToText(thousands)} هزار`;
      }
      return `${this.smallNumberToText(Math.floor(thousands))} هزار ${this.smallNumberToText(value % 1000)}`;
    }
    return this.smallNumberToText(value);
  }

  private smallNumberToText(n: number): string {
    const reverseMap: Record<number, string> = {};
    for (const [k, v] of Object.entries(PERSIAN_NUMBER_WORDS)) {
      reverseMap[v] = k;
    }
    return reverseMap[n] || n.toString();
  }

  private unitToPersianText(unit: string): string {
    const unitMap: Record<string, string> = {
      'toman': 'تومان',
      'rial': 'ریال',
      'metre': 'متر',
      'square_metre': 'متر مربع',
      'cubic_metre': 'متر مکعب',
      'kilo': 'کیلو',
      'kilogram': 'کیلوگرم',
      'litre': 'لیتر',
      'piece': 'عدد',
      'day': 'روز',
      'week': 'هفته',
      'month': 'ماه',
      'year': 'سال',
      'hour': 'ساعت',
    };
    return unitMap[unit] || unit;
  }

  private basisToPersianText(basis: string): string {
    const basisMap: Record<string, string> = {
      'per_unit': 'هر واحد',
      'per_square_metre': 'متر مربع',
      'total': 'کل',
      'per_day': 'هر روز',
      'per_hour': 'هر ساعت',
    };
    return basisMap[basis] || '';
  }

  // ─── Confidence Calculation ───

  private calculateConfidence(
    tags: string[],
    intent: string,
    numbers: ExtractedNumber[]
  ): number {
    let confidence = 0.3; // base

    // Tags matched
    if (tags.length > 0) confidence += 0.2;
    if (tags.some((t) => t.startsWith('services/'))) confidence += 0.1;

    // Intent is clear
    if (intent !== 'unknown') confidence += 0.15;

    // Numbers found
    if (numbers.length > 0) confidence += 0.15;

    // Multiple tags suggest a clearer request
    if (tags.length >= 2) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  // ─── Bridging Response ───

  /**
   * Generate a bridging response while the system processes
   * This fills the perceptual gap and reduces perceived latency
   */
  getBridgingResponse(intent: string): string {
    const bridgingResponses: Record<string, string[]> = {
      'ask': [
        'بذار ببینم...',
        'صبر کن بپرسم...',
        'بذار چک کنم...',
        'یه لحظه...',
      ],
      'know': [
        'بذار یاد بیارم...',
        'بذار بگم...',
      ],
      'unknown': [
        'بذار فکر کنم...',
        'بذار ببینم...',
      ],
    };

    const responses = bridgingResponses[intent] || bridgingResponses['ask'];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // ─── Fast Path ───

  /**
   * Check if this request can be handled without a cloud model
   * Fast path is used for simple, structured requests
   */
  canUseFastPath(result: EdgeProcessingResult): boolean {
    // Fast path if: high confidence + clear intent + specific tags
    if (result.confidence >= 0.8 && result.intent === 'ask' && result.tags.length > 0) {
      return true;
    }

    // Fast path if: user is just sharing info (KNOW)
    if (result.intent === 'know') {
      return true;
    }

    return false;
  }

  // ─── Helpers ───

  private normalizePersian(text: string): string {
    return text
      .replace(/ي/g, 'ی')  // Arabic ye → Persian ye
      .replace(/ك/g, 'ک')  // Arabic kaf → Persian kaf
      .replace(/ة/g, 'ه')  // Arabic ta marbuta → he
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private mapUnit(unitStr: string): string {
    return PERSIAN_UNIT_WORDS[unitStr] || unitStr || 'unknown';
  }
}
