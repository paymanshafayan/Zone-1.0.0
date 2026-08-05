/// Professional Providers — Registration, license, subscription management
///
/// Flow:
///   1. Submit license (image + unique number)
///   2. External verification
///   3. Pay subscription (external link, NOT in-app)
///   4. Active professional account
///   5. Subscription expiry → posts hidden
///   6. Renewal → posts reactivated
library features_professional_providers_professional_provider;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/logger.dart';
import '../../../shared/models/zone_models.dart';

// ─── Professional State ───

class ProfessionalState {
  final ProfessionalStatus status;
  final ProfessionalLicense? license;
  final SubscriptionPlan? currentPlan;
  final List<SubscriptionPlan> plans;
  final bool isLoading;
  final String? errorMessage;

  const ProfessionalState({
    this.status = ProfessionalStatus.normal,
    this.license,
    this.currentPlan,
    this.plans = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  ProfessionalState copyWith({
    ProfessionalStatus? status,
    ProfessionalLicense? license,
    SubscriptionPlan? currentPlan,
    List<SubscriptionPlan>? plans,
    bool? isLoading,
    String? errorMessage,
  }) {
    return ProfessionalState(
      status: status ?? this.status,
      license: license ?? this.license,
      currentPlan: currentPlan ?? this.currentPlan,
      plans: plans ?? this.plans,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

// ─── Professional Provider ───

final professionalProvider = StateNotifierProvider<ProfessionalNotifier, ProfessionalState>((ref) {
  return ProfessionalNotifier(ref.read(apiClientProvider));
});

class ProfessionalNotifier extends StateNotifier<ProfessionalState> {
  final ApiClient _api;
  final ZoneLogger _logger = ZoneLogger('Professional');

  ProfessionalNotifier(this._api) : super(const ProfessionalState()) {
    _loadPlans();
  }

  /// Load subscription plans
  Future<void> _loadPlans() async {
    final response = await _api.getSubscriptionPlans();
    if (response.isSuccess) {
      final data = response.data as Map<String, dynamic>;
      final plansList = (data['plans'] as List?)?.map((p) => SubscriptionPlan.fromJson(p)).toList() ?? [];
      state = state.copyWith(plans: plansList);
    }
  }

  /// Check professional status
  Future<void> checkStatus(String personId) async {
    state = state.copyWith(isLoading: true);
    final response = await _api.getProfessionalStatus(personId: personId);
    if (response.isSuccess) {
      final data = response.data as Map<String, dynamic>;
      state = state.copyWith(
        status: data['professionalStatus'] == 'professional'
            ? ProfessionalStatus.professional
            : ProfessionalStatus.normal,
        isLoading: false,
      );
    } else {
      state = state.copyWith(isLoading: false, errorMessage: response.errorMessage);
    }
  }

  /// Register as professional
  Future<bool> register({
    required String personId,
    required String profession,
    required String licenseNumber,
    required String licenseImageUrl,
  }) async {
    state = state.copyWith(isLoading: true);
    final response = await _api.registerProfessional(
      personId: personId,
      profession: profession,
      licenseNumber: licenseNumber,
      licenseImageUrl: licenseImageUrl,
    );
    if (response.isSuccess) {
      state = state.copyWith(isLoading: false);
      return true;
    }
    state = state.copyWith(isLoading: false, errorMessage: response.errorMessage);
    return false;
  }

  /// Activate subscription (after external payment)
  Future<bool> activateSubscription({
    required String personId,
    required String planId,
    required String paymentReference,
  }) async {
    state = state.copyWith(isLoading: true);
    final response = await _api.activateSubscription(
      personId: personId,
      planId: planId,
      paymentReference: paymentReference,
    );
    if (response.isSuccess) {
      state = state.copyWith(
        status: ProfessionalStatus.professional,
        isLoading: false,
      );
      return true;
    }
    state = state.copyWith(isLoading: false, errorMessage: response.errorMessage);
    return false;
  }

  /// Renew subscription
  Future<bool> renewSubscription({
    required String subscriptionId,
    required String paymentReference,
  }) async {
    state = state.copyWith(isLoading: true);
    final response = await _api.renewSubscription(
      subscriptionId: subscriptionId,
      paymentReference: paymentReference,
    );
    if (response.isSuccess) {
      state = state.copyWith(isLoading: false);
      return true;
    }
    state = state.copyWith(isLoading: false, errorMessage: response.errorMessage);
    return false;
  }

  /// Cancel subscription
  Future<bool> cancelSubscription(String subscriptionId) async {
    state = state.copyWith(isLoading: true);
    final response = await _api.cancelSubscription(subscriptionId: subscriptionId);
    if (response.isSuccess) {
      state = state.copyWith(
        status: ProfessionalStatus.normal,
        isLoading: false,
      );
      return true;
    }
    state = state.copyWith(isLoading: false, errorMessage: response.errorMessage);
    return false;
  }
}
