/// Zone Domain Models
///
/// Mirrors the backend types from packages/core/src/types.ts
/// These are the data models used throughout the Flutter app.
library shared_models_zone_models;

// ─── Geographic ───

class GeoPoint {
  final double latitude;
  final double longitude;

  const GeoPoint({required this.latitude, required this.longitude});
}

class GeoBounds {
  final GeoPoint northEast;
  final GeoPoint southWest;

  const GeoBounds({required this.northEast, required this.southWest});
}

// ─── Zone (Neighbourhood) ───

class Zone {
  final String id;
  final String name;
  final String nameEn;
  final GeoBounds bounds;
  final String city;
  final String province;

  const Zone({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.bounds,
    required this.city,
    required this.province,
  });

  factory Zone.fromJson(Map<String, dynamic> json) => Zone(
    id: json['id'],
    name: json['name'],
    nameEn: json['nameEn'],
    bounds: GeoBounds(
      northEast: GeoPoint(
        latitude: json['bounds']['northEast']['latitude'],
        longitude: json['bounds']['northEast']['longitude'],
      ),
      southWest: GeoPoint(
        latitude: json['bounds']['southWest']['latitude'],
        longitude: json['bounds']['southWest']['longitude'],
      ),
    ),
    city: json['city'],
    province: json['province'],
  );
}

// ─── Person ───

enum ProfessionalStatus { normal, professional }

class Person {
  final String id;
  final String displayName;
  final String zoneId;
  final List<String> skills;
  final double responseRate;
  final ProfessionalStatus professionalStatus;
  final String? licenseId;
  final String? licenseNumber;
  final DateTime? subscriptionExpiresAt;

  const Person({
    required this.id,
    required this.displayName,
    required this.zoneId,
    required this.skills,
    required this.responseRate,
    required this.professionalStatus,
    this.licenseId,
    this.licenseNumber,
    this.subscriptionExpiresAt,
  });

  factory Person.fromJson(Map<String, dynamic> json) => Person(
    id: json['id'],
    displayName: json['displayName'],
    zoneId: json['zoneId'],
    skills: List<String>.from(json['skills'] ?? []),
    responseRate: (json['responseRate'] ?? 0).toDouble(),
    professionalStatus: json['professionalStatus'] == 'professional'
        ? ProfessionalStatus.professional
        : ProfessionalStatus.normal,
    licenseId: json['licenseId'],
    licenseNumber: json['licenseNumber'],
    subscriptionExpiresAt: json['subscriptionExpiresAt'] != null
        ? DateTime.parse(json['subscriptionExpiresAt'])
        : null,
  );

  bool get isProfessional => professionalStatus == ProfessionalStatus.professional;
}

// ─── Memory ───

class Memory {
  final String id;
  final String zoneId;
  final String personId;
  final String skill;
  final String description;
  final String outcome;
  final String sourcePersonId;
  final double confidence;
  final double credibility;
  final DateTime createdAt;

  const Memory({
    required this.id,
    required this.zoneId,
    required this.personId,
    required this.skill,
    required this.description,
    required this.outcome,
    required this.sourcePersonId,
    required this.confidence,
    required this.credibility,
    required this.createdAt,
  });

  factory Memory.fromJson(Map<String, dynamic> json) => Memory(
    id: json['id'],
    zoneId: json['zoneId'],
    personId: json['personId'],
    skill: json['skill'],
    description: json['description'],
    outcome: json['outcome'],
    sourcePersonId: json['sourcePersonId'],
    confidence: (json['confidence'] ?? 0).toDouble(),
    credibility: (json['credibility'] ?? 0).toDouble(),
    createdAt: DateTime.parse(json['createdAt']),
  );
}

// ─── Professional Post ───

class PostMedia {
  final String type; // 'image' | 'video'
  final String url;
  final String? thumbnailUrl;
  final int? duration; // seconds (for video, max 15)

  const PostMedia({
    required this.type,
    required this.url,
    this.thumbnailUrl,
    this.duration,
  });

  factory PostMedia.fromJson(Map<String, dynamic> json) => PostMedia(
    type: json['type'],
    url: json['url'],
    thumbnailUrl: json['thumbnailUrl'],
    duration: json['duration'],
  );
}

class Post {
  final String id;
  final String zoneId;
  final String providerId;
  final List<PostMedia> media;
  final String description;
  final List<String> tags;
  final bool isSponsored;
  final bool isActive;
  final DateTime publishedAt;
  final DateTime? expiresAt;

  const Post({
    required this.id,
    required this.zoneId,
    required this.providerId,
    required this.media,
    required this.description,
    required this.tags,
    required this.isSponsored,
    required this.isActive,
    required this.publishedAt,
    this.expiresAt,
  });

  factory Post.fromJson(Map<String, dynamic> json) => Post(
    id: json['id'],
    zoneId: json['zoneId'],
    providerId: json['providerId'],
    media: (json['media'] as List?)?.map((m) => PostMedia.fromJson(m)).toList() ?? [],
    description: json['description'],
    tags: List<String>.from(json['tags'] ?? []),
    isSponsored: json['isSponsored'] ?? false,
    isActive: json['isActive'] ?? true,
    publishedAt: DateTime.parse(json['publishedAt']),
    expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt']) : null,
  );
}

// ─── Tag ───

class Tag {
  final String id;
  final String path;
  final String label;
  final String labelEn;
  final String? parentId;
  final int demandCount;
  final bool isApproved;

  const Tag({
    required this.id,
    required this.path,
    required this.label,
    required this.labelEn,
    this.parentId,
    required this.demandCount,
    required this.isApproved,
  });

  factory Tag.fromJson(Map<String, dynamic> json) => Tag(
    id: json['id'],
    path: json['path'],
    label: json['label'],
    labelEn: json['labelEn'],
    parentId: json['parentId'],
    demandCount: json['demandCount'] ?? 0,
    isApproved: json['isApproved'] ?? true,
  );
}

// ─── Hearing Space ───

class HearingSpace {
  final String id;
  final String zoneId;
  final String type; // 'dynamic' | 'persistent'
  final String? name;
  final List<String> tags;
  final double? radius;
  final int reverberationTtl;
  final int memberCount;
  final DateTime createdAt;
  final DateTime? expiresAt;

  const HearingSpace({
    required this.id,
    required this.zoneId,
    required this.type,
    this.name,
    required this.tags,
    this.radius,
    required this.reverberationTtl,
    required this.memberCount,
    required this.createdAt,
    this.expiresAt,
  });

  factory HearingSpace.fromJson(Map<String, dynamic> json) => HearingSpace(
    id: json['id'],
    zoneId: json['zoneId'],
    type: json['type'],
    name: json['name'],
    tags: List<String>.from(json['tags'] ?? []),
    radius: json['radius']?.toDouble(),
    reverberationTtl: json['reverberationTtl'] ?? 0,
    memberCount: json['memberCount'] ?? 0,
    createdAt: DateTime.parse(json['createdAt']),
    expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt']) : null,
  );
}

// ─── Response Mode ───

enum ResponseMode { know, ask, unknown }

class ResponseModeResult {
  final ResponseMode mode;
  final String skill;
  final String? toolName;
  final Map<String, dynamic>? toolResult;
  final String? message;

  const ResponseModeResult({
    required this.mode,
    required this.skill,
    this.toolName,
    this.toolResult,
    this.message,
  });

  factory ResponseModeResult.fromJson(Map<String, dynamic> json) {
    ResponseMode mode;
    switch (json['mode']) {
      case 'KNOW': mode = ResponseMode.know; break;
      case 'ASK': mode = ResponseMode.ask; break;
      default: mode = ResponseMode.unknown;
    }
    return ResponseModeResult(
      mode: mode,
      skill: json['skill'],
      toolName: json['toolName'],
      toolResult: json['toolResult'],
      message: json['message'],
    );
  }
}

// ─── Voice Pipeline ───

class VoicePipelineResult {
  final String responseText;
  final ResponseMode? mode;
  final List<String>? tags;
  final bool isFastPath;
  final Duration? processingTime;

  const VoicePipelineResult({
    required this.responseText,
    this.mode,
    this.tags,
    this.isFastPath = false,
    this.processingTime,
  });
}

// ─── Subscription ───

class SubscriptionPlan {
  final String id;
  final String name;
  final int durationDays;
  final int price;
  final double discount;

  const SubscriptionPlan({
    required this.id,
    required this.name,
    required this.durationDays,
    required this.price,
    required this.discount,
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) => SubscriptionPlan(
    id: json['id'],
    name: json['name'],
    durationDays: json['durationDays'],
    price: json['price'],
    discount: (json['discount'] ?? 0).toDouble(),
  );
}

// ─── Professional License ───

enum LicenseStatus { pending, verified, rejected }

class ProfessionalLicense {
  final String id;
  final String personId;
  final String profession;
  final String licenseNumber;
  final String licenseImageUrl;
  final LicenseStatus status;
  final String? rejectionReason;
  final DateTime createdAt;

  const ProfessionalLicense({
    required this.id,
    required this.personId,
    required this.profession,
    required this.licenseNumber,
    required this.licenseImageUrl,
    required this.status,
    this.rejectionReason,
    required this.createdAt,
  });

  factory ProfessionalLicense.fromJson(Map<String, dynamic> json) {
    LicenseStatus status;
    switch (json['status']) {
      case 'verified': status = LicenseStatus.verified; break;
      case 'rejected': status = LicenseStatus.rejected; break;
      default: status = LicenseStatus.pending;
    }
    return ProfessionalLicense(
      id: json['id'],
      personId: json['personId'],
      profession: json['profession'],
      licenseNumber: json['licenseNumber'],
      licenseImageUrl: json['licenseImageUrl'],
      status: status,
      rejectionReason: json['rejectionReason'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}

// ─── Learning Demand ───

enum DemandStatus { open, fulfilled, expired, cancelled }

class MemoryDemand {
  final String id;
  final String skill;
  final String zoneId;
  final String requesterId;
  final DemandStatus status;
  final DateTime createdAt;
  final DateTime? expiresAt;

  const MemoryDemand({
    required this.id,
    required this.skill,
    required this.zoneId,
    required this.requesterId,
    required this.status,
    required this.createdAt,
    this.expiresAt,
  });

  factory MemoryDemand.fromJson(Map<String, dynamic> json) {
    DemandStatus status;
    switch (json['status']) {
      case 'fulfilled': status = DemandStatus.fulfilled; break;
      case 'expired': status = DemandStatus.expired; break;
      case 'cancelled': status = DemandStatus.cancelled; break;
      default: status = DemandStatus.open;
    }
    return MemoryDemand(
      id: json['id'],
      skill: json['skill'],
      zoneId: json['zoneId'],
      requesterId: json['requesterId'],
      status: status,
      createdAt: DateTime.parse(json['createdAt']),
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt']) : null,
    );
  }
}
