/**
 * Zone License Verification Service — Professional License Verification
 *
 * Handles the professional license verification flow:
 * 1. Provider uploads license image + unique number
 * 2. System submits to external verification site
 * 3. License is verified or rejected
 * 4. If verified, provider can proceed to subscription
 *
 * Architecture Rule:
 * - License image + unique number → external verification site
 * - Payment is via external link (NOT in-app purchase)
 * - The app never stores payment information
 */

import { Logger } from '@zone/core';

// ─── Types ───

export type LicenseStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface ProfessionalLicense {
  id: string;
  /** Person ID of the license holder */
  personId: string;
  /** Person display name */
  personName: string;
  /** Unique license number from the union */
  licenseNumber: string;
  /** URL to the license image */
  licenseImageUrl: string;
  /** Profession/skill the license covers */
  profession: string;
  /** Zone ID where the license is valid */
  zoneId: string;
  /** Current status */
  status: LicenseStatus;
  /** When the license was verified */
  verifiedAt?: Date;
  /** Who verified it (admin or external system) */
  verifiedBy?: string;
  /** Reason for rejection (if rejected) */
  rejectionReason?: string;
  /** When the license expires */
  expiresAt?: Date;
  /** When the license was created */
  createdAt: Date;
  /** External verification reference */
  verificationReference?: string;
}

export interface SubmitLicenseParams {
  personId: string;
  personName: string;
  licenseNumber: string;
  licenseImageUrl: string;
  profession: string;
  zoneId: string;
}

export interface VerifyLicenseParams {
  /** The license ID to verify */
  licenseId: string;
  /** Whether the verification passed */
  approved: boolean;
  /** Admin or external system that verified */
  verifiedBy: string;
  /** Reason for rejection (if rejected) */
  rejectionReason?: string;
  /** External verification reference */
  verificationReference?: string;
  /** License expiry date */
  expiresAt?: Date;
}

export interface LicenseSearchParams {
  personId?: string;
  zoneId?: string;
  status?: LicenseStatus;
  profession?: string;
}

// ─── Iranian Union License Numbers ───

/**
 * Iranian professional licenses have specific formats:
 * - Order of Engineers (سازمان نظام مهندسی): ۱۲۳۴۵/م
 * - Union of Craftsmen (اتحادیه صنف): ۱۲۳۴۵/ص
 * - Medical Council (سازمان نظام پزشکی): ۱۲۳۴۵/پ
 * - etc.
 *
 * The unique number + image must be verified against the
 * external verification site of the relevant union.
 */
const LICENSE_NUMBER_PATTERNS = [
  /^[\d۰-۹]+\/[مصپخب]$/,  // Union format: 12345/م
  /^[\d۰-۹]{5,10}$/,       // Simple numeric: 12345
  /^[\d۰-۹]+-[\d۰-۹]+$/,  // Range format: 123-456
];

// ─── External Verification Site ───

/**
 * In production, this calls the external verification site.
 * For development, we simulate the verification.
 *
 * The external verification site is configured per profession:
 * - Engineers: https://nezam.org.ir/verify
 * - Craftsmen: https://sanat.ir/verify
 * - etc.
 */
const VERIFICATION_SITES: Record<string, string> = {
  house_painting: 'https://sanat.ir/verify',
  plumbing: 'https://sanat.ir/verify',
  electrical: 'https://sanat.ir/verify',
  cleaning: 'https://sanat.ir/verify',
  repair: 'https://sanat.ir/verify',
  moving: 'https://sanat.ir/verify',
  carpentry: 'https://sanat.ir/verify',
  tiling: 'https://sanat.ir/verify',
  air_conditioning: 'https://sanat.ir/verify',
  locksmith: 'https://sanat.ir/verify',
  landscaping: 'https://sanat.ir/verify',
  appliance_repair: 'https://sanat.ir/verify',
};

// ─── License Verification Service ───

export class LicenseVerificationService {
  private logger: Logger;
  /** In-memory store for development (production: PostgreSQL) */
  private licenses: Map<string, ProfessionalLicense> = new Map();
  /** Index: personId → licenseIds */
  private personIndex: Map<string, string[]> = new Map();
  /** Index: licenseNumber → licenseId */
  private numberIndex: Map<string, string> = new Map();

  constructor() {
    this.logger = new Logger({ context: { service: 'license-verification' } });
  }

  /**
   * Submit a professional license for verification
   *
   * The provider uploads:
   * 1. License image (photo of the physical license)
   * 2. Unique license number (from the union)
   *
   * The system then submits to the external verification site.
   */
  async submitLicense(params: SubmitLicenseParams): Promise<ProfessionalLicense> {
    const { personId, personName, licenseNumber, licenseImageUrl, profession, zoneId } = params;

    this.logger.info('license:submit', { personId, licenseNumber, profession, zoneId });

    // Validate license number format
    const normalizedNumber = this.normalizeLicenseNumber(licenseNumber);
    if (!this.isValidLicenseNumber(normalizedNumber)) {
      throw new Error('شماره مجوز معتبر نیست. لطفاً شماره مجوز اتحادیه رو وارد کنید.');
    }

    // Check for duplicate license number
    const existingLicense = this.numberIndex.get(normalizedNumber);
    if (existingLicense) {
      const existing = this.licenses.get(existingLicense);
      if (existing && existing.status === 'verified' && existing.personId !== personId) {
        throw new Error('این شماره مجوز قبلاً توسط شخص دیگری ثبت و تأیید شده.');
      }
      // If same person, allow re-submission (they might be renewing)
    }

    // Create the license record
    const license: ProfessionalLicense = {
      id: `license_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      personId,
      personName,
      licenseNumber: normalizedNumber,
      licenseImageUrl,
      profession,
      zoneId,
      status: 'pending',
      createdAt: new Date(),
    };

    // Store
    this.licenses.set(license.id, license);
    this.personIndex.set(personId, [...(this.personIndex.get(personId) || []), license.id]);
    this.numberIndex.set(normalizedNumber, license.id);

    // Submit to external verification site
    const verificationSite = VERIFICATION_SITES[profession] || 'https://sanat.ir/verify';
    this.logger.info('license:submitted_to_external', {
      licenseId: license.id,
      verificationSite,
      licenseNumber: normalizedNumber,
    });

    // In development: auto-verify after a short delay simulation
    // In production: this would be an async webhook callback
    await this.simulateExternalVerification(license);

    return license;
  }

  /**
   * Verify or reject a license
   * Called by admin or external verification callback
   */
  async verifyLicense(params: VerifyLicenseParams): Promise<ProfessionalLicense | null> {
    const { licenseId, approved, verifiedBy, rejectionReason, verificationReference, expiresAt } = params;

    const license = this.licenses.get(licenseId);
    if (!license) {
      this.logger.warn('license:not_found', { licenseId });
      return null;
    }

    if (license.status !== 'pending') {
      this.logger.warn('license:not_pending', { licenseId, status: license.status });
      return null;
    }

    if (approved) {
      license.status = 'verified';
      license.verifiedAt = new Date();
      license.verifiedBy = verifiedBy;
      license.verificationReference = verificationReference;
      license.expiresAt = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Default 1 year

      this.logger.info('license:verified', {
        licenseId,
        licenseNumber: license.licenseNumber,
        verifiedBy,
      });
    } else {
      license.status = 'rejected';
      license.rejectionReason = rejectionReason || 'تأیید نشد توسط سایت استعلام';

      this.logger.info('license:rejected', {
        licenseId,
        licenseNumber: license.licenseNumber,
        rejectionReason,
      });
    }

    return license;
  }

  /**
   * Get a license by ID
   */
  get(licenseId: string): ProfessionalLicense | undefined {
    return this.licenses.get(licenseId);
  }

  /**
   * Get licenses for a specific person
   */
  getByPerson(personId: string): ProfessionalLicense[] {
    const licenseIds = this.personIndex.get(personId) || [];
    const results: ProfessionalLicense[] = [];

    for (const id of licenseIds) {
      const license = this.licenses.get(id);
      if (license) results.push(license);
    }

    return results;
  }

  /**
   * Get the verified license for a person (if any)
   */
  getVerifiedLicense(personId: string): ProfessionalLicense | undefined {
    const licenses = this.getByPerson(personId);
    return licenses.find((l) => l.status === 'verified');
  }

  /**
   * Search licenses with flexible filters
   */
  search(params: LicenseSearchParams): ProfessionalLicense[] {
    let results = Array.from(this.licenses.values());

    if (params.personId) {
      results = results.filter((l) => l.personId === params.personId);
    }
    if (params.zoneId) {
      results = results.filter((l) => l.zoneId === params.zoneId);
    }
    if (params.status) {
      results = results.filter((l) => l.status === params.status);
    }
    if (params.profession) {
      results = results.filter((l) => l.profession === params.profession);
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get the external verification URL for a profession
   */
  getVerificationUrl(profession: string): string {
    return VERIFICATION_SITES[profession] || 'https://sanat.ir/verify';
  }

  /**
   * Check if a license number is valid format
   */
  isValidLicenseNumber(licenseNumber: string): boolean {
    const normalized = this.normalizeLicenseNumber(licenseNumber);
    return LICENSE_NUMBER_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  /**
   * Get license statistics
   */
  getStats(): {
    total: number;
    pending: number;
    verified: number;
    rejected: number;
    expired: number;
  } {
    let pending = 0;
    let verified = 0;
    let rejected = 0;
    let expired = 0;

    for (const license of this.licenses.values()) {
      // Check if verified license has expired
      if (license.status === 'verified' && license.expiresAt && license.expiresAt < new Date()) {
        license.status = 'expired';
      }

      switch (license.status) {
        case 'pending': pending++; break;
        case 'verified': verified++; break;
        case 'rejected': rejected++; break;
        case 'expired': expired++; break;
      }
    }

    return { total: this.licenses.size, pending, verified, rejected, expired };
  }

  // ─── Private Helpers ───

  private normalizeLicenseNumber(licenseNumber: string): string {
    // Replace Persian digits with Latin digits
    return licenseNumber
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .trim();
  }

  /**
   * Simulate external verification for development
   * In production, this would be a webhook callback from the external site
   */
  private async simulateExternalVerification(license: ProfessionalLicense): Promise<void> {
    // In development: auto-verify licenses with valid format
    // In production: this would wait for the external site to callback

    // For now, we just mark it as pending and let the admin verify it
    // The simulation is that the license is "submitted" to the external site
    // and the admin will manually verify it

    this.logger.info('license:simulated_submission', {
      licenseId: license.id,
      note: 'In production, external verification site would callback',
    });
  }
}
