/**
 * Zone Number Service — Number Lifecycle Management
 *
 * Handles the complete lifecycle of numbers in the system:
 *   Extract → Read-back → Confirm → Lock → Compare
 *
 * ⚠️ CRITICAL RULE: No number enters the system without confirmation.
 * This is a hard rule. Every number must go through read-back.
 *
 * The voice channel is linear; comparison is parallel.
 * Reading five offers back-to-back is useless.
 * Instead: cheapest, fastest, most trusted.
 */

import { Logger } from '@zone/core';
import type { ExtractedNumber } from '@zone/core';

// ─── Types ───

export enum NumberStatus {
  EXTRACTED = 'extracted',
  READBACK = 'readback',
  CONFIRMED = 'confirmed',
  LOCKED = 'locked',
  EXPIRED = 'expired',
}

export interface LockedNumber {
  id: string;
  /** The confirmed value */
  value: number;
  /** Unit (toman, metre, etc.) */
  unit: string;
  /** Basis (per_unit, per_square_metre, total, per_day, per_hour) */
  basis: string;
  /** Who said it */
  providerId: string;
  /** Provider display name */
  providerName: string;
  /** Which request it belongs to */
  requestId: string;
  /** When it was locked */
  lockedAt: Date;
  /** Current status */
  status: NumberStatus;
  /** Original raw text */
  raw: string;
  /** Duration (e.g. "3 days") */
  duration?: string;
  /** Confidence score */
  confidence: number;
}

export interface NumberComparison {
  /** The axis of comparison */
  axis: 'cheapest' | 'fastest' | 'most_trusted';
  /** The winner */
  winner: LockedNumber;
  /** All numbers in this comparison */
  candidates: LockedNumber[];
  /** Voice-friendly text */
  voiceText: string;
  /** Label in Persian */
  label: string;
}

export interface ComparisonResult {
  /** The request being compared */
  requestId: string;
  /** Comparison axes */
  comparisons: NumberComparison[];
  /** Total number of offers */
  totalOffers: number;
  /** Voice-friendly summary */
  summary: string;
}

// ─── Basis Detection ───

const BASIS_PATTERNS: Array<{
  pattern: string[];
  basis: string;
  label: string;
}> = [
  {
    pattern: ['متر مربع', 'مترمربع', 'هر متر', 'متری', 'متر مربعی'],
    basis: 'per_square_metre',
    label: 'متر مربع',
  },
  {
    pattern: ['کل', 'جمع', 'همه', 'مجموع', 'کلی'],
    basis: 'total',
    label: 'کل',
  },
  {
    pattern: ['هر روز', 'روزانه', 'در روز', 'روزی'],
    basis: 'per_day',
    label: 'هر روز',
  },
  {
    pattern: ['هر ساعت', 'ساعتی', 'در ساعت'],
    basis: 'per_hour',
    label: 'هر ساعت',
  },
  {
    pattern: ['هر واحد', 'واحد', 'عددی'],
    basis: 'per_unit',
    label: 'هر واحد',
  },
  {
    pattern: ['هر ماه', 'ماهانه', 'در ماه'],
    basis: 'per_month',
    label: 'هر ماه',
  },
  {
    pattern: ['هر کیلو', 'کیلویی', 'هر کیلوگرم'],
    basis: 'per_kilo',
    label: 'هر کیلو',
  },
];

// ─── Number Service ───

export class NumberService {
  private logger: Logger;
  /** Locked numbers: id → LockedNumber */
  private lockedNumbers: Map<string, LockedNumber> = new Map();
  /** Index: requestId → numberIds */
  private requestIndex: Map<string, string[]> = new Map();
  /** Index: providerId → numberIds */
  private providerIndex: Map<string, string[]> = new Map();
  /** Pending confirmations: numberId → ExtractedNumber */
  private pendingConfirmations: Map<string, ExtractedNumber> = new Map();

  constructor() {
    this.logger = new Logger({ context: { service: 'number-service' } });
  }

  /**
   * Extract basis from text
   * Detects pricing basis like "per square metre", "total", etc.
   */
  detectBasis(text: string): { basis: string; label: string } {
    const normalized = text
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .toLowerCase();

    for (const { pattern, basis, label } of BASIS_PATTERNS) {
      for (const p of pattern) {
        if (normalized.includes(p)) {
          return { basis, label };
        }
      }
    }

    // Default: per_unit
    return { basis: 'per_unit', label: 'هر واحد' };
  }

  /**
   * Create a pending number for confirmation
   * This is the first step — the number is extracted but not yet confirmed.
   */
  createPending(extracted: ExtractedNumber, requestId: string): string {
    const id = `num_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.pendingConfirmations.set(id, {
      ...extracted,
      basis: extracted.basis || 'per_unit',
    });

    this.logger.info('number:pending_created', {
      id,
      value: extracted.value,
      unit: extracted.unit,
      requestId,
    });

    return id;
  }

  /**
   * Generate a read-back confirmation for a pending number
   * This is the MANDATORY step before any number enters the system.
   *
   * Example:
   *   Input: { value: 90000, unit: 'toman', basis: 'per_square_metre' }
   *   Output: "یعنی نود هزار تومان متر مربع، درسته؟"
   */
  generateReadback(number: ExtractedNumber): string {
    const valueText = this.valueToPersianText(number.value);
    const unitText = this.unitToPersianText(number.unit);
    const basisText = this.basisToPersianText(number.basis);

    const parts = [valueText, unitText];
    if (basisText) parts.push(basisText);

    return `یعنی ${parts.join(' ')}، درسته؟`;
  }

  /**
   * Confirm a pending number
   * This is the MANDATORY step. After confirmation, the number is LOCKED.
   *
   * ⚠️ No number enters the system without this confirmation.
   */
  confirmNumber(
    numberId: string,
    providerId: string,
    providerName: string,
    requestId: string,
    duration?: string
  ): LockedNumber {
    const pending = this.pendingConfirmations.get(numberId);
    if (!pending) {
      throw new Error(`Pending number ${numberId} not found`);
    }

    const locked: LockedNumber = {
      id: numberId,
      value: pending.value,
      unit: pending.unit,
      basis: pending.basis,
      providerId,
      providerName,
      requestId,
      lockedAt: new Date(),
      status: NumberStatus.LOCKED,
      raw: pending.raw,
      duration,
      confidence: 1.0, // Confirmed = full confidence
    };

    // Store
    this.lockedNumbers.set(numberId, locked);

    // Update indices
    if (!this.requestIndex.has(requestId)) {
      this.requestIndex.set(requestId, []);
    }
    this.requestIndex.get(requestId)!.push(numberId);

    if (!this.providerIndex.has(providerId)) {
      this.providerIndex.set(providerId, []);
    }
    this.providerIndex.get(providerId)!.push(numberId);

    // Remove from pending
    this.pendingConfirmations.delete(numberId);

    this.logger.info('number:locked', {
      id: numberId,
      value: pending.value,
      unit: pending.unit,
      basis: pending.basis,
      providerId,
      requestId,
    });

    return locked;
  }

  /**
   * Reject a number (user said "no" to read-back)
   */
  rejectNumber(numberId: string): boolean {
    const deleted = this.pendingConfirmations.delete(numberId);
    if (deleted) {
      this.logger.info('number:rejected', { id: numberId });
    }
    return deleted;
  }

  /**
   * Get all locked numbers for a request
   */
  getNumbersForRequest(requestId: string): LockedNumber[] {
    const ids = this.requestIndex.get(requestId) || [];
    return ids.map((id) => this.lockedNumbers.get(id)!).filter(Boolean);
  }

  /**
   * Get all locked numbers for a provider
   */
  getNumbersForProvider(providerId: string): LockedNumber[] {
    const ids = this.providerIndex.get(providerId) || [];
    return ids.map((id) => this.lockedNumbers.get(id)!).filter(Boolean);
  }

  /**
   * Get a specific locked number
   */
  get(numberId: string): LockedNumber | undefined {
    return this.lockedNumbers.get(numberId);
  }

  /**
   * Compare multiple locked numbers for a request
   * Generates voice-friendly comparison across three axes.
   *
   * ⚠️ The voice channel is linear. Reading five offers back-to-back is useless.
   * Instead: cheapest, fastest, most trusted.
   */
  compare(requestId: string, trustScores?: Map<string, number>): ComparisonResult {
    const numbers = this.getNumbersForRequest(requestId);

    if (numbers.length === 0) {
      return {
        requestId,
        comparisons: [],
        totalOffers: 0,
        summary: 'هنوز پیشنهادی ثبت نشده.',
      };
    }

    const comparisons: NumberComparison[] = [];

    // ─── Axis 1: Cheapest ───
    // Normalize to per-unit basis for comparison
    const normalized = numbers.map((n) => ({
      number: n,
      normalizedValue: this.normalizeForComparison(n),
    }));

    const cheapest = normalized.reduce((min, curr) =>
      curr.normalizedValue < min.normalizedValue ? curr : min
    );

    comparisons.push({
      axis: 'cheapest',
      winner: cheapest.number,
      candidates: numbers,
      voiceText: `ارزان‌ترین ${cheapest.number.providerName} با ${this.valueToPersianText(cheapest.number.value)} ${this.unitToPersianText(cheapest.number.unit)}.`,
      label: 'ارزان‌ترین',
    });

    // ─── Axis 2: Fastest ───
    // Use duration if available
    const withDuration = numbers.filter((n) => n.duration);
    if (withDuration.length > 0) {
      const fastest = withDuration.reduce((best, curr) => {
        const bestDays = this.parseDurationToDays(best.duration!);
        const currDays = this.parseDurationToDays(curr.duration!);
        return currDays < bestDays ? curr : best;
      });

      comparisons.push({
        axis: 'fastest',
        winner: fastest,
        candidates: withDuration,
        voiceText: `سریع‌ترین ${fastest.providerName} با ${fastest.duration}.`,
        label: 'سریع‌ترین',
      });
    }

    // ─── Axis 3: Most Trusted ───
    // Use trust scores if available
    if (trustScores && trustScores.size > 0) {
      const withTrust = numbers.filter((n) => trustScores.has(n.providerId));
      if (withTrust.length > 0) {
        const mostTrusted = withTrust.reduce((best, curr) =>
          (trustScores.get(curr.providerId) || 0) > (trustScores.get(best.providerId) || 0)
            ? curr : best
        );

        comparisons.push({
          axis: 'most_trusted',
          winner: mostTrusted,
          candidates: withTrust,
          voiceText: `معتمدترین ${mostTrusted.providerName} با ${trustScores.get(mostTrusted.providerId)} معرفی.`,
          label: 'معتمدترین',
        });
      }
    }

    // ─── Summary ───
    const summary = this.generateComparisonSummary(numbers, comparisons);

    return {
      requestId,
      comparisons,
      totalOffers: numbers.length,
      summary,
    };
  }

  /**
   * Get stats
   */
  getStats(): { totalLocked: number; pendingConfirmations: number } {
    return {
      totalLocked: this.lockedNumbers.size,
      pendingConfirmations: this.pendingConfirmations.size,
    };
  }

  // ─── Private Helpers ───

  /**
   * Normalize a number to per-unit basis for comparison
   * This handles the case where some numbers are per-unit and others are total
   */
  private normalizeForComparison(number: LockedNumber): number {
    switch (number.basis) {
      case 'total':
        return number.value; // Total is the total
      case 'per_square_metre':
      case 'per_unit':
      case 'per_day':
      case 'per_hour':
      case 'per_month':
      case 'per_kilo':
        return number.value; // Per-unit is the base rate
      default:
        return number.value;
    }
  }

  /**
   * Parse a duration string to days
   * Examples: "3 روز", "2 هفته", "1 ماه"
   */
  private parseDurationToDays(duration: string): number {
    const normalized = duration
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .toLowerCase();

    // Match number + unit
    const match = normalized.match(/(\d+)\s*(روز|هفته|ماه|سال)/);
    if (!match) return 999; // Unknown duration → slowest

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'روز': return value;
      case 'هفته': return value * 7;
      case 'ماه': return value * 30;
      case 'سال': return value * 365;
      default: return 999;
    }
  }

  /**
   * Generate a voice-friendly comparison summary
   *
   * ⚠️ The voice channel is linear. Reading five offers back-to-back is useless.
   * Instead: "X نفر جواب دادن. ارزان‌ترین X. سریع‌ترین Y. کدوم رو بیشتر توضیح بدم؟"
   */
  private generateComparisonSummary(
    numbers: LockedNumber[],
    comparisons: NumberComparison[]
  ): string {
    if (numbers.length === 0) return 'هنوز پیشنهادی ثبت نشده.';

    const parts: string[] = [];

    // Number of offers
    if (numbers.length === 1) {
      parts.push('یک نفر جواب داد.');
    } else {
      parts.push(`${numbers.length} نفر جواب دادن.`);
    }

    // Add comparison axes
    for (const comp of comparisons) {
      parts.push(comp.voiceText);
    }

    // Ask which to elaborate
    if (comparisons.length > 1) {
      parts.push('کدوم رو بیشتر توضیح بدم؟');
    }

    return parts.join(' ');
  }

  // ─── Persian Text Conversion ───

  private valueToPersianText(value: number): string {
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

    const reverseMap: Record<number, string> = {};
    for (const [k, v] of Object.entries(PERSIAN_NUMBER_WORDS)) {
      reverseMap[v] = k;
    }

    if (value >= 1000000) {
      const millions = value / 1000000;
      if (value % 1000000 === 0) {
        return `${reverseMap[millions] || millions} میلیون`;
      }
      return `${reverseMap[Math.floor(millions)] || Math.floor(millions)} میلیون ${reverseMap[value % 1000000] || value % 1000000}`;
    }
    if (value >= 1000) {
      const thousands = value / 1000;
      if (value % 1000 === 0) {
        return `${reverseMap[thousands] || thousands} هزار`;
      }
      return `${reverseMap[Math.floor(thousands)] || Math.floor(thousands)} هزار ${reverseMap[value % 1000] || value % 1000}`;
    }
    return reverseMap[value] || value.toString();
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
      'per_month': 'هر ماه',
      'per_kilo': 'هر کیلو',
    };
    return basisMap[basis] || '';
  }
}
