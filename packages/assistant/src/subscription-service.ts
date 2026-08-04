/**
 * Zone Professional Subscription Service
 *
 * Manages professional provider subscriptions:
 * 1. Registration flow: submit license → verify → subscribe
 * 2. Subscription payment via external link (NOT in-app purchase)
 * 3. Subscription activation → professional account status
 * 4. Subscription expiry → post hiding + account downgrade
 * 5. Subscription renewal → post reactivation
 *
 * Architecture Rules:
 * - Payment is via EXTERNAL LINK (not in-app purchase)
 * - The app never stores payment information
 * - Professional providers pay subscription
 * - Friendly recommendations are NEVER influenced by payment
 * - Principle 5: Friendly recommendations are never purchasable;
 *   professionals are in a SEPARATE, clearly marked category
 */

import { Logger } from '@zone/core';
import {
  LicenseVerificationService,
  type ProfessionalLicense,
  type SubmitLicenseParams,
} from './license-service';
import type { PostService } from './post-service';

// ─── Types ───

export type SubscriptionStatus = 'none' | 'pending' | 'active' | 'expired' | 'cancelled';
export type ProfessionalStatus = 'normal' | 'professional';

export interface SubscriptionPlan {
  id: string;
  name: string;
  nameEn: string;
  /** Duration in days */
  durationDays: number;
  /** Price in toman */
  price: number;
  /** External payment URL */
  paymentUrl: string;
  /** Features included */
  features: string[];
}

export interface ProfessionalSubscription {
  id: string;
  /** Person ID */
  personId: string;
  /** Person display name */
  personName: string;
  /** Zone ID */
  zoneId: string;
  /** License ID (verified) */
  licenseId: string;
  /** Profession */
  profession: string;
  /** Plan ID */
  planId: string;
  /** Current status */
  status: SubscriptionStatus;
  /** When the subscription started */
  startedAt?: Date;
  /** When the subscription expires */
  expiresAt?: Date;
  /** External payment reference */
  paymentReference?: string;
  /** When the subscription was created */
  createdAt: Date;
  /** When the subscription was cancelled */
  cancelledAt?: Date;
}

export interface RegisterProfessionalParams {
  /** Person ID */
  personId: string;
  /** Person display name */
  personName: string;
  /** Zone ID */
  zoneId: string;
  /** License details */
  license: SubmitLicenseParams;
  /** Subscription plan ID */
  planId: string;
}

export interface ActivateSubscriptionParams {
  /** Subscription ID */
  subscriptionId: string;
  /** External payment reference (from payment gateway) */
  paymentReference: string;
}

export interface SubscriptionSearchParams {
  personId?: string;
  zoneId?: string;
  status?: SubscriptionStatus;
  profession?: string;
}

// ─── Subscription Plans ───

/**
 * Available subscription plans for professional providers.
 * Prices are in toman. Payment is via external link.
 *
 * ⚠️ The app NEVER processes payment directly.
 * It only links to the external payment site.
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'ماهانه',
    nameEn: 'Monthly',
    durationDays: 30,
    price: 150000, // 150,000 toman
    paymentUrl: 'https://pay.zone.ir/subscribe/monthly',
    features: [
      'پست حرفه‌ای نامحدود',
      'نمایش در فید حرفه‌ای',
      'اعلام در کانال صوتی',
    ],
  },
  {
    id: 'quarterly',
    name: 'سه‌ماهه',
    nameEn: 'Quarterly',
    durationDays: 90,
    price: 400000, // 400,000 toman (10% discount)
    paymentUrl: 'https://pay.zone.ir/subscribe/quarterly',
    features: [
      'پست حرفه‌ای نامحدود',
      'نمایش در فید حرفه‌ای',
      'اعلام در کانال صوتی',
      '۱۰٪ تخفیف',
    ],
  },
  {
    id: 'annual',
    name: 'سالانه',
    nameEn: 'Annual',
    durationDays: 365,
    price: 1400000, // 1,400,000 toman (22% discount)
    paymentUrl: 'https://pay.zone.ir/subscribe/annual',
    features: [
      'پست حرفه‌ای نامحدود',
      'نمایش در فید حرفه‌ای',
      'اعلام در کانال صوتی',
      '۲۲٪ تخفیف',
      'اولویت نمایش',
    ],
  },
];

// ─── Professional Subscription Service ───

export class ProfessionalSubscriptionService {
  private logger: Logger;
  private licenseService: LicenseVerificationService;
  private postService: PostService | null;
  /** In-memory store for development (production: PostgreSQL) */
  private subscriptions: Map<string, ProfessionalSubscription> = new Map();
  /** Index: personId → subscriptionIds */
  private personIndex: Map<string, string[]> = new Map();

  constructor(
    licenseService: LicenseVerificationService,
    postService?: PostService
  ) {
    this.logger = new Logger({ context: { service: 'professional-subscription' } });
    this.licenseService = licenseService;
    this.postService = postService || null;
  }

  /**
   * Get the license service
   */
  getLicenseService(): LicenseVerificationService {
    return this.licenseService;
  }

  /**
   * Step 1: Register as a professional provider
   *
   * Flow:
   * 1. Submit license (image + unique number)
   * 2. License is verified by external site
   * 3. If verified, create pending subscription
   * 4. Redirect to external payment link
   * 5. After payment, activate subscription
   */
  async registerProfessional(params: RegisterProfessionalParams): Promise<{
    subscription: ProfessionalSubscription;
    license: ProfessionalLicense;
    paymentUrl: string;
    responseText: string;
  }> {
    const { personId, personName, zoneId, license: licenseParams, planId } = params;

    this.logger.info('professional:register', { personId, zoneId, profession: licenseParams.profession });

    // Check if already has active subscription
    const activeSub = this.getActiveSubscription(personId);
    if (activeSub) {
      throw new Error('شما اشتراک حرفه‌ای فعال دارید.');
    }

    // Get the plan
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) {
      throw new Error('طرح اشتراک معتبر نیست.');
    }

    // Check if person already has a verified license
    const existingLicense = this.licenseService.getVerifiedLicense(personId);
    let license: ProfessionalLicense;

    if (existingLicense) {
      // Use existing verified license
      license = existingLicense;
      this.logger.info('professional:existing_license', {
        licenseId: license.id,
        personId,
      });
    } else {
      // Submit new license for verification
      license = await this.licenseService.submitLicense({
        ...licenseParams,
        personId,
        personName,
      });
    }

    // Step 2: Create pending subscription
    const subscription: ProfessionalSubscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      personId,
      personName,
      zoneId,
      licenseId: license.id,
      profession: licenseParams.profession,
      planId,
      status: 'pending',
      createdAt: new Date(),
    };

    this.subscriptions.set(subscription.id, subscription);
    this.personIndex.set(personId, [...(this.personIndex.get(personId) || []), subscription.id]);

    // Step 3: Generate payment URL
    const paymentUrl = `${plan.paymentUrl}?personId=${personId}&subscriptionId=${subscription.id}&planId=${planId}`;

    const responseText = this.generateRegistrationResponse(license, plan, paymentUrl);

    this.logger.info('professional:registered', {
      subscriptionId: subscription.id,
      licenseId: license.id,
      licenseStatus: license.status,
      planId,
    });

    return {
      subscription,
      license,
      paymentUrl,
      responseText,
    };
  }

  /**
   * Step 2: Activate subscription after payment
   * Called when the external payment gateway confirms payment.
   *
   * ⚠️ The app NEVER processes payment.
   * It only receives a confirmation from the external site.
   */
  async activateSubscription(params: ActivateSubscriptionParams): Promise<ProfessionalSubscription | null> {
    const { subscriptionId, paymentReference } = params;

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn('subscription:not_found', { subscriptionId });
      return null;
    }

    // Check that the license is verified
    const license = this.licenseService.get(subscription.licenseId);
    if (!license || license.status !== 'verified') {
      this.logger.warn('subscription:license_not_verified', { subscriptionId, licenseId: subscription.licenseId });
      throw new Error('مجوز شما هنوز تأیید نشده. لطفاً منتظر تأیید مجوز بمانید.');
    }

    // Get the plan
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === subscription.planId);
    if (!plan) {
      throw new Error('طرح اشتراک معتبر نیست.');
    }

    // Activate the subscription
    subscription.status = 'active';
    subscription.startedAt = new Date();
    subscription.expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
    subscription.paymentReference = paymentReference;

    this.logger.info('subscription:activated', {
      subscriptionId,
      personId: subscription.personId,
      expiresAt: subscription.expiresAt,
    });

    // Reactivate any previously deactivated posts
    if (this.postService) {
      const providerPosts = await this.postService.getByProvider(subscription.personId, true);
      for (const post of providerPosts) {
        if (!post.isActive) {
          await this.postService.reactivate(post.id);
        }
      }
    }

    return subscription;
  }

  /**
   * Check and expire subscriptions that have passed their expiry date
   */
  async checkExpirations(): Promise<string[]> {
    const expiredIds: string[] = [];
    const now = new Date();

    for (const subscription of this.subscriptions.values()) {
      if (subscription.status === 'active' && subscription.expiresAt && subscription.expiresAt < now) {
        subscription.status = 'expired';

        // Deactivate all posts for this provider
        if (this.postService) {
          const providerPosts = await this.postService.getByProvider(subscription.personId);
          for (const post of providerPosts) {
            await this.postService.deactivate(post.id);
          }
        }

        expiredIds.push(subscription.id);

        this.logger.info('subscription:expired', {
          subscriptionId: subscription.id,
          personId: subscription.personId,
          expiredAt: subscription.expiresAt,
        });
      }
    }

    return expiredIds;
  }

  /**
   * Renew a subscription
   * Same as activate but for an existing expired subscription
   */
  async renewSubscription(
    subscriptionId: string,
    planId: string,
    paymentReference: string
  ): Promise<ProfessionalSubscription | null> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return null;

    // Check that the license is still valid
    const license = this.licenseService.get(subscription.licenseId);
    if (!license || license.status !== 'verified') {
      throw new Error('مجوز شما معتبر نیست. لطفاً مجوز جدیدی ثبت کنید.');
    }

    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) {
      throw new Error('طرح اشتراک معتبر نیست.');
    }

    // Renew the subscription
    subscription.status = 'active';
    subscription.startedAt = new Date();
    subscription.expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
    subscription.paymentReference = paymentReference;
    subscription.planId = planId;

    // Reactivate posts
    if (this.postService) {
      const providerPosts = await this.postService.getByProvider(subscription.personId, true);
      for (const post of providerPosts) {
        if (!post.isActive) {
          await this.postService.reactivate(post.id);
        }
      }
    }

    this.logger.info('subscription:renewed', {
      subscriptionId,
      personId: subscription.personId,
      newExpiresAt: subscription.expiresAt,
    });

    return subscription;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();

    // Deactivate all posts
    if (this.postService) {
      const providerPosts = await this.postService.getByProvider(subscription.personId);
      for (const post of providerPosts) {
        await this.postService.deactivate(post.id);
      }
    }

    this.logger.info('subscription:cancelled', {
      subscriptionId,
      personId: subscription.personId,
    });

    return true;
  }

  /**
   * Get the active subscription for a person (if any)
   */
  getActiveSubscription(personId: string): ProfessionalSubscription | undefined {
    const subscriptionIds = this.personIndex.get(personId) || [];

    for (const id of subscriptionIds) {
      const subscription = this.subscriptions.get(id);
      if (subscription && subscription.status === 'active') {
        // Check if expired
        if (subscription.expiresAt && subscription.expiresAt < new Date()) {
          subscription.status = 'expired';
          continue;
        }
        return subscription;
      }
    }

    return undefined;
  }

  /**
   * Get the professional status of a person
   */
  getProfessionalStatus(personId: string): {
    status: ProfessionalStatus;
    subscription?: ProfessionalSubscription;
    license?: ProfessionalLicense;
  } {
    const subscription = this.getActiveSubscription(personId);
    const license = this.licenseService.getVerifiedLicense(personId);

    if (subscription && subscription.status === 'active') {
      return {
        status: 'professional',
        subscription,
        license,
      };
    }

    return {
      status: 'normal',
      license,
    };
  }

  /**
   * Get a specific subscription
   */
  get(subscriptionId: string): ProfessionalSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Search subscriptions
   */
  search(params: SubscriptionSearchParams): ProfessionalSubscription[] {
    let results = Array.from(this.subscriptions.values());

    if (params.personId) {
      results = results.filter((s) => s.personId === params.personId);
    }
    if (params.zoneId) {
      results = results.filter((s) => s.zoneId === params.zoneId);
    }
    if (params.status) {
      results = results.filter((s) => s.status === params.status);
    }
    if (params.profession) {
      results = results.filter((s) => s.profession === params.profession);
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get subscription plans
   */
  getPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  /**
   * Get subscription statistics
   */
  getStats(): {
    total: number;
    active: number;
    pending: number;
    expired: number;
    cancelled: number;
    revenue: number;
  } {
    let active = 0;
    let pending = 0;
    let expired = 0;
    let cancelled = 0;
    let revenue = 0;

    for (const sub of this.subscriptions.values()) {
      // Check if active subscription has expired
      if (sub.status === 'active' && sub.expiresAt && sub.expiresAt < new Date()) {
        sub.status = 'expired';
      }

      switch (sub.status) {
        case 'active':
          active++;
          const plan = SUBSCRIPTION_PLANS.find((p) => p.id === sub.planId);
          if (plan) revenue += plan.price;
          break;
        case 'pending': pending++; break;
        case 'expired': expired++; break;
        case 'cancelled': cancelled++; break;
      }
    }

    return { total: this.subscriptions.size, active, pending, expired, cancelled, revenue };
  }

  // ─── Private Helpers ───

  private generateRegistrationResponse(
    license: ProfessionalLicense,
    plan: SubscriptionPlan,
    paymentUrl: string
  ): string {
    if (license.status === 'verified') {
      return `مجوز شما تأیید شد! برای فعال‌سازی اشتراک ${plan.name}، لطفاً پرداخت رو انجام بدید. لینک پرداخت: ${paymentUrl}`;
    }

    if (license.status === 'rejected') {
      return `متأسفانه مجوز شما تأیید نشد. ${license.rejectionReason || ''} لطفاً مجوز معتبر رو دوباره ثبت کنید.`;
    }

    // Pending
    return `مجوز شما ثبت شد و در حال بررسی‌ست. بعد از تأیید، لینک پرداخت اشتراک ${plan.name} ارسال میشه.`;
  }
}
