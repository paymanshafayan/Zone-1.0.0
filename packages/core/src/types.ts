/**
 * Zone Core Types — Shared type definitions for the entire system
 */

// ─── Geographic ───

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoBounds {
  northEast: GeoPoint;
  southWest: GeoPoint;
}

// ─── Zone (Neighbourhood) ───

export interface Zone {
  id: string;
  name: string;
  nameEn: string;
  bounds: GeoBounds;
  city: string;
  province: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Person ───

export enum ProfessionalStatus {
  NORMAL = 'normal',
  PROFESSIONAL = 'professional',
}

export interface Person {
  id: string;
  displayName: string;
  zoneId: string;
  skills: string[];
  responseRate: number;
  professionalStatus: ProfessionalStatus;
  licenseId?: string;
  licenseNumber?: string;
  subscriptionExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Memory ───

export interface Memory {
  id: string;
  zoneId: string;
  personId: string;
  skill: string;
  description: string;
  outcome: string;
  sourcePersonId: string;
  confidence: number;
  createdAt: Date;
  /** Credibility with temporal decay applied */
  credibility: number;
}

// ─── Professional Post ───

export interface PostMedia {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  duration?: number; // seconds (for video, max 15)
}

export interface Post {
  id: string;
  zoneId: string;
  providerId: string;
  media: PostMedia[];
  description: string;
  tags: string[];
  isSponsored: boolean;
  isActive: boolean;
  publishedAt: Date;
  expiresAt?: Date;
}

// ─── Tag ───

export interface Tag {
  id: string;
  path: string; // e.g. "services/house_painting"
  label: string;
  labelEn: string;
  parentId: string | null;
  demandCount: number;
  isApproved: boolean;
  createdAt: Date;
}

export interface TagAlias {
  id: string;
  tagId: string;
  alias: string;
  createdAt: Date;
}

// ─── Subscription ───

export interface UserSubscription {
  id: string;
  personId: string;
  tagPattern: string; // e.g. "services/*" or "services/house_painting"
  createdAt: Date;
}

// ─── Request ───

export enum RequestUrgency {
  NORMAL = 'normal',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

export interface Request {
  id: string;
  zoneId: string;
  requesterId: string;
  description: string;
  tags: string[];
  urgency: RequestUrgency;
  radius: number; // meters
  status: RequestStatus;
  createdAt: Date;
  expiresAt: Date;
}

export enum RequestStatus {
  OPEN = 'open',
  WAVE1 = 'wave1',
  WAVE2 = 'wave2',
  WAVE3 = 'wave3',
  FULFILLED = 'fulfilled',
  UNKNOWN = 'unknown',
  CANCELLED = 'cancelled',
}

// ─── Offer ───

export interface Offer {
  id: string;
  requestId: string;
  providerId: string;
  amount?: number;
  unit?: string;
  basis?: string;
  duration?: string;
  isConfirmed: boolean;
  createdAt: Date;
}

// ─── Hearing Space ───

export enum SpaceType {
  DYNAMIC = 'dynamic',
  PERSISTENT = 'persistent',
}

export enum ReverberationDuration {
  URGENT = 15 * 60 * 1000,     // 15 minutes
  SERVICE = 2 * 60 * 60 * 1000, // 2 hours
  SOCIAL = 6 * 60 * 60 * 1000,  // 6 hours
}

export interface HearingSpace {
  id: string;
  zoneId: string;
  type: SpaceType;
  name?: string;
  tags: string[];
  radius?: number; // meters (for dynamic spaces)
  reverberationTtl: number; // ms
  createdAt: Date;
  expiresAt?: Date;
}

export interface SpaceMember {
  id: string;
  spaceId: string;
  personId: string;
  joinedAt: Date;
  isActive: boolean;
}

// ─── Events ───

export interface ZoneEvent {
  'user.speak': {
    personId: string;
    zoneId: string;
    text: string;
    tags: string[];
    intent: 'know' | 'ask' | 'unknown';
    numbers: ExtractedNumber[];
  };
  'user.join': {
    personId: string;
    zoneId: string;
    spaceId: string;
  };
  'user.leave': {
    personId: string;
    spaceId: string;
  };
  'wave.open': {
    requestId: string;
    zoneId: string;
    tags: string[];
    radius: number;
    waveLevel: 1 | 2 | 3;
  };
  'wave.response': {
    requestId: string;
    offerId: string;
    providerId: string;
  };
  'wave.unknown': {
    requestId: string;
    zoneId: string;
  };
  'wave.dispatched': {
    requestId: string;
    zoneId: string;
    waveLevel: 1 | 2 | 3;
    personIds: string[];
    count: number;
  };
  'professional.post': {
    postId: string;
    providerId: string;
    zoneId: string;
    tags: string[];
    postCount?: number; // for announcements
  };
  'plugin.registered': {
    name: string;
    version: string;
  };
  'plugin.unregistered': {
    name: string;
  };
  'plugin.enabled': {
    name: string;
  };
  'plugin.disabled': {
    name: string;
  };
  'memory.demand.created': {
    demandId: string;
    skill: string;
    zoneId: string;
    requesterId: string;
  };
  'memory.recorded': {
    memoryId: string;
    personId: string;
    skill: string;
    zoneId: string;
    outcome: string;
    confidence: number;
    fromLearningLoop: boolean;
  };
  'memory.demand.fulfilled': {
    demandId: string;
    memoryId: string;
    skill: string;
    zoneId: string;
    timeToLearn: number;
  };
  'memory.confidence.updated': {
    memoryId: string;
    oldConfidence: number;
    newConfidence: number;
    reason: string;
  };
  'license.submitted': {
    licenseId: string;
    personId: string;
    profession: string;
    licenseNumber: string;
  };
  'license.verified': {
    licenseId: string;
    personId: string;
    verifiedBy: string;
  };
  'license.rejected': {
    licenseId: string;
    personId: string;
    rejectionReason: string;
  };
  'subscription.activated': {
    subscriptionId: string;
    personId: string;
    planId: string;
    expiresAt: Date;
  };
  'subscription.expired': {
    subscriptionId: string;
    personId: string;
  };
  'subscription.cancelled': {
    subscriptionId: string;
    personId: string;
  };
  'professional.registered': {
    personId: string;
    zoneId: string;
    profession: string;
    subscriptionId: string;
  };
}

// ─── Extracted Number ───

export interface ExtractedNumber {
  raw: string;
  value: number;
  unit: string;
  basis: string;
  isConfirmed: boolean;
}

// ─── On-Device Processing Result ───

export interface EdgeProcessingResult {
  tags: string[];
  intent: 'know' | 'ask' | 'unknown';
  numbers: ExtractedNumber[];
  confidence: number;
}
