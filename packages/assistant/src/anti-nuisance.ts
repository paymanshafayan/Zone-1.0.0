/**
 * Zone Anti-Nuisance Service — Protects Users from Over-Notification
 *
 * This is the most critical part of the wave system.
 * A user who mutes notifications never comes back.
 *
 * Rules:
 * - Max 3 notifications/day per user
 * - Quiet hours: 22:00 – 08:00 (Iran time = UTC+3:30)
 * - Stop after ≥2 responses to a request
 * - Down-weight after 3 consecutive silences
 * - Tag opt-out (always respected)
 * - Emergency channel: max 1/week per user, with abuse reporting
 */

import { Logger } from '@zone/core';

// ─── Constants ───

/** Maximum notifications a user can receive per day */
export const MAX_DAILY_NOTIFICATIONS = 3;

/** Quiet hours start (Iran time) */
export const QUIET_HOURS_START = 22;

/** Quiet hours end (Iran time) */
export const QUIET_HOURS_END = 8;

/** Minimum responses to stop a wave */
export const MIN_RESPONSES_TO_STOP = 2;

/** Consecutive silences before down-weighting */
export const SILENCE_THRESHOLD = 3;

/** Maximum emergency notifications per user per week */
export const MAX_WEEKLY_EMERGENCY = 1;

/** Iran timezone offset (UTC+3:30) */
const IRAN_OFFSET_HOURS = 3.5;

// ─── Types ───

export interface NotificationRecord {
  personId: string;
  requestId: string;
  waveLevel: number;
  sentAt: Date;
  type: 'wave' | 'emergency';
}

export interface AntiNuisanceConfig {
  maxDailyNotifications: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  minResponsesToStop: number;
  silenceThreshold: number;
  maxWeeklyEmergency: number;
}

// ─── Anti-Nuisance Service ───

export class AntiNuisanceService {
  private logger: Logger;
  private config: AntiNuisanceConfig;

  /** Track daily notification count: personId → date → count */
  private dailyCounts: Map<string, Map<string, number>> = new Map();

  /** Track weekly emergency count: personId → week → count */
  private weeklyEmergencyCounts: Map<string, Map<string, number>> = new Map();

  /** Track response counts: requestId → count */
  private responseCounts: Map<string, number> = new Map();

  /** Track silence counts: personId → count */
  private silenceCounts: Map<string, number> = new Map();

  /** Notification history: personId → NotificationRecord[] */
  private notificationHistory: Map<string, NotificationRecord[]> = new Map();

  constructor(config?: Partial<AntiNuisanceConfig>) {
    this.logger = new Logger({ context: { service: 'anti-nuisance' } });
    this.config = {
      maxDailyNotifications: config?.maxDailyNotifications ?? MAX_DAILY_NOTIFICATIONS,
      quietHoursStart: config?.quietHoursStart ?? QUIET_HOURS_START,
      quietHoursEnd: config?.quietHoursEnd ?? QUIET_HOURS_END,
      minResponsesToStop: config?.minResponsesToStop ?? MIN_RESPONSES_TO_STOP,
      silenceThreshold: config?.silenceThreshold ?? SILENCE_THRESHOLD,
      maxWeeklyEmergency: config?.maxWeeklyEmergency ?? MAX_WEEKLY_EMERGENCY,
    };
  }

  /**
   * Check if a user can receive a notification
   * Returns true if the notification is allowed
   */
  canNotify(personId: string, type: 'wave' | 'emergency' = 'wave'): boolean {
    // Check quiet hours
    if (this.isInQuietHours() && type !== 'emergency') {
      this.logger.debug('anti_nuisance:quiet_hours', { personId });
      return false;
    }

    // Check daily limit
    if (type === 'wave') {
      const dailyCount = this.getDailyCount(personId);
      if (dailyCount >= this.config.maxDailyNotifications) {
        this.logger.debug('anti_nuisance:daily_limit', { personId, dailyCount });
        return false;
      }
    }

    // Check weekly emergency limit
    if (type === 'emergency') {
      const weeklyCount = this.getWeeklyEmergencyCount(personId);
      if (weeklyCount >= this.config.maxWeeklyEmergency) {
        this.logger.debug('anti_nuisance:weekly_emergency_limit', { personId, weeklyCount });
        return false;
      }
    }

    return true;
  }

  /**
   * Record that a notification was sent to a user
   */
  recordNotification(personId: string, requestId: string, waveLevel: number, type: 'wave' | 'emergency' = 'wave'): void {
    // Increment daily count
    const today = this.getTodayKey();
    if (!this.dailyCounts.has(personId)) {
      this.dailyCounts.set(personId, new Map());
    }
    const personDaily = this.dailyCounts.get(personId)!;
    personDaily.set(today, (personDaily.get(today) || 0) + 1);

    // Increment weekly emergency count if applicable
    if (type === 'emergency') {
      const week = this.getWeekKey();
      if (!this.weeklyEmergencyCounts.has(personId)) {
        this.weeklyEmergencyCounts.set(personId, new Map());
      }
      const personWeekly = this.weeklyEmergencyCounts.get(personId)!;
      personWeekly.set(week, (personWeekly.get(week) || 0) + 1);
    }

    // Add to notification history
    const record: NotificationRecord = {
      personId,
      requestId,
      waveLevel,
      sentAt: new Date(),
      type,
    };

    if (!this.notificationHistory.has(personId)) {
      this.notificationHistory.set(personId, []);
    }
    this.notificationHistory.get(personId)!.push(record);

    this.logger.debug('anti_nuisance:notification_recorded', {
      personId,
      requestId,
      waveLevel,
      type,
    });
  }

  /**
   * Record a response to a request
   * Returns true if the wave should stop (≥2 responses)
   */
  recordResponse(requestId: string): boolean {
    const count = (this.responseCounts.get(requestId) || 0) + 1;
    this.responseCounts.set(requestId, count);

    const shouldStop = count >= this.config.minResponsesToStop;

    if (shouldStop) {
      this.logger.info('anti_nuisance:wave_stopped', {
        requestId,
        responseCount: count,
      });
    }

    return shouldStop;
  }

  /**
   * Get the current response count for a request
   */
  getResponseCount(requestId: string): number {
    return this.responseCounts.get(requestId) || 0;
  }

  /**
   * Check if a request has enough responses to stop
   */
  hasEnoughResponses(requestId: string): boolean {
    return this.getResponseCount(requestId) >= this.config.minResponsesToStop;
  }

  /**
   * Record that a person was silent (didn't respond to a wave)
   */
  recordSilence(personId: string): void {
    const count = (this.silenceCounts.get(personId) || 0) + 1;
    this.silenceCounts.set(personId, count);

    if (count >= this.config.silenceThreshold) {
      this.logger.info('anti_nuisance:down_weighted', {
        personId,
        silenceCount: count,
      });
    }
  }

  /**
   * Reset silence count (when person responds)
   */
  resetSilence(personId: string): void {
    this.silenceCounts.set(personId, 0);
  }

  /**
   * Get silence count for a person
   */
  getSilenceCount(personId: string): number {
    return this.silenceCounts.get(personId) || 0;
  }

  /**
   * Check if a person is down-weighted (3+ silences)
   */
  isDownWeighted(personId: string): boolean {
    return this.getSilenceCount(personId) >= this.config.silenceThreshold;
  }

  /**
   * Check if we're currently in quiet hours (Iran time)
   */
  isInQuietHours(): boolean {
    const now = new Date();
    // Convert to Iran time (UTC+3:30)
    const iranTime = new Date(now.getTime() + IRAN_OFFSET_HOURS * 60 * 60 * 1000);
    const hour = iranTime.getUTCHours();

    return hour >= this.config.quietHoursStart || hour < this.config.quietHoursEnd;
  }

  /**
   * Calculate the delay until quiet hours end
   */
  getQuietHoursDelay(): number {
    const now = new Date();
    const iranTime = new Date(now.getTime() + IRAN_OFFSET_HOURS * 60 * 60 * 1000);
    const target = new Date(iranTime);

    target.setUTCHours(this.config.quietHoursEnd, 0, 0, 0);
    if (iranTime.getUTCHours() >= this.config.quietHoursStart) {
      target.setUTCDate(target.getUTCDate() + 1);
    }

    return target.getTime() - iranTime.getTime();
  }

  /**
   * Get daily notification count for a person
   */
  getDailyCount(personId: string): number {
    const today = this.getTodayKey();
    const personDaily = this.dailyCounts.get(personId);
    if (!personDaily) return 0;
    return personDaily.get(today) || 0;
  }

  /**
   * Get weekly emergency count for a person
   */
  getWeeklyEmergencyCount(personId: string): number {
    const week = this.getWeekKey();
    const personWeekly = this.weeklyEmergencyCounts.get(personId);
    if (!personWeekly) return 0;
    return personWeekly.get(week) || 0;
  }

  /**
   * Get notification history for a person
   */
  getNotificationHistory(personId: string): NotificationRecord[] {
    return this.notificationHistory.get(personId) || [];
  }

  /**
   * Get the configuration
   */
  getConfig(): AntiNuisanceConfig {
    return { ...this.config };
  }

  // ─── Private Helpers ───

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getWeekKey(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${weekNumber}`;
  }
}
