import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../constants/app_constants.dart';
import '../utils/logger.dart';

// ─── API Client Provider ───

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});

final wsProvider = Provider.family<WebSocketChannel, String>((ref, path) {
  final uri = Uri.parse('${AppConstants.wsBaseUrl}$path');
  return WebSocketChannel.connect(uri);
});

/// Zone API Client
///
/// Centralized HTTP client for all API communication.
/// Uses Dio for HTTP and WebSocket for real-time.
class ApiClient {
  late final Dio _dio;
  final ZoneLogger _logger = ZoneLogger('ApiClient');

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Request interceptor for logging
    _dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
        logPrint: (obj) => _logger.debug(obj.toString()),
      ),
    );
  }

  // ─── Auth ───

  void setAuthToken(String token) {
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  void clearAuthToken() {
    _dio.options.headers.remove('Authorization');
  }

  // ─── Health ───

  Future<ApiResponse> healthCheck() async {
    return _get('/api/health');
  }

  // ─── Voice ───

  Future<ApiResponse> processVoice({
    required String text,
    String? personId,
    String? zoneId,
  }) async {
    return _post('/api/voice/process', {
      'text': text,
      'personId': personId,
      'zoneId': zoneId,
    });
  }

  Future<ApiResponse> extractTags({required String text}) async {
    return _post('/api/voice/extract-tags', {'text': text});
  }

  Future<ApiResponse> readbackNumber({
    required String rawSpeech,
    required num amount,
    required String unit,
    required String basis,
  }) async {
    return _post('/api/voice/readback', {
      'rawSpeech': rawSpeech,
      'amount': amount,
      'unit': unit,
      'basis': basis,
    });
  }

  Future<ApiResponse> confirmNumber({
    required String numberId,
    required bool confirmed,
  }) async {
    return _post('/api/voice/confirm-number', {
      'numberId': numberId,
      'confirmed': confirmed,
    });
  }

  // ─── Response Mode ───

  Future<ApiResponse> decideResponseMode({
    required String skill,
    required String zoneId,
    String? personId,
  }) async {
    return _post('/api/response-mode/decide', {
      'skill': skill,
      'zoneId': zoneId,
      'personId': personId,
    });
  }

  Future<ApiResponse> getToolDefinitions() async {
    return _get('/api/response-mode/tools');
  }

  // ─── Tags ───

  Future<ApiResponse> searchTags({required String query}) async {
    return _get('/api/tags/search?q=$query');
  }

  Future<ApiResponse> getTagPaths() async {
    return _get('/api/tags/paths');
  }

  Future<ApiResponse> getTagBranch({required String branch}) async {
    return _get('/api/tags/branch/$branch');
  }

  Future<ApiResponse> getTagStats() async {
    return _get('/api/tags/stats');
  }

  Future<ApiResponse> syncVocabulary() async {
    return _get('/api/tags/sync');
  }

  Future<ApiResponse> requestTagDemand({required String tagPath}) async {
    return _post('/api/tags/demand', {'tagPath': tagPath});
  }

  // ─── Spaces ───

  Future<ApiResponse> getSpace({required String spaceId}) async {
    return _get('/api/spaces/$spaceId');
  }

  Future<ApiResponse> getSpaceMembers({required String spaceId}) async {
    return _get('/api/spaces/$spaceId/members');
  }

  Future<ApiResponse> getSpacePresence({required String spaceId}) async {
    return _get('/api/spaces/$spaceId/presence');
  }

  // ─── Memories ───

  Future<ApiResponse> searchMemories({
    required String skill,
    required String zoneId,
    double? minConfidence,
  }) async {
    final params = 'skill=$skill&zoneId=$zoneId'
        '${minConfidence != null ? '&minConfidence=$minConfidence' : ''}';
    return _get('/api/memories/search?$params');
  }

  Future<ApiResponse> recordMemory({
    required String zoneId,
    required String personId,
    required String skill,
    required String description,
    required String outcome,
    required String sourcePersonId,
  }) async {
    return _post('/api/memories', {
      'zoneId': zoneId,
      'personId': personId,
      'skill': skill,
      'description': description,
      'outcome': outcome,
      'sourcePersonId': sourcePersonId,
    });
  }

  Future<ApiResponse> getMemoryStats() async {
    return _get('/api/memories/stats');
  }

  // ─── Posts ───

  Future<ApiResponse> getPosts({
    required String zoneId,
    String? tag,
    int? limit,
    int? offset,
  }) async {
    final params = 'zoneId=$zoneId'
        '${tag != null ? '&tag=$tag' : ''}'
        '${limit != null ? '&limit=$limit' : ''}'
        '${offset != null ? '&offset=$offset' : ''}';
    return _get('/api/posts?$params');
  }

  Future<ApiResponse> getPost({required String postId}) async {
    return _get('/api/posts/$postId');
  }

  Future<ApiResponse> createPost(Map<String, dynamic> data) async {
    return _post('/api/posts', data);
  }

  Future<ApiResponse> updatePost({
    required String postId,
    required Map<String, dynamic> data,
  }) async {
    return _put('/api/posts/$postId', data);
  }

  Future<ApiResponse> deactivatePost({required String postId}) async {
    return _delete('/api/posts/$postId');
  }

  Future<ApiResponse> getPostCount({required String zoneId}) async {
    return _get('/api/posts/count?zoneId=$zoneId');
  }

  Future<ApiResponse> likePost({required String postId}) async {
    return _post('/api/posts/$postId/like', {});
  }

  // ─── Learning ───

  Future<ApiResponse> learnFromUser({
    required String zoneId,
    required String personId,
    required String skill,
    required String outcome,
    String? description,
    String? demandId,
  }) async {
    return _post('/api/learning/learn', {
      'zoneId': zoneId,
      'personId': personId,
      'skill': skill,
      'outcome': outcome,
      'description': description,
      'demandId': demandId,
    });
  }

  Future<ApiResponse> getLearningDemands({
    String? personId,
    String? status,
  }) async {
    final params = '${personId != null ? 'personId=$personId&' : ''}'
        '${status != null ? 'status=$status' : ''}';
    return _get('/api/learning/demands?$params');
  }

  Future<ApiResponse> cancelDemand({required String demandId}) async {
    return _post('/api/learning/demands/$demandId/cancel', {});
  }

  Future<ApiResponse> getLearningStats() async {
    return _get('/api/learning/stats');
  }

  // ─── Professional ───

  Future<ApiResponse> registerProfessional({
    required String personId,
    required String profession,
    required String licenseNumber,
    required String licenseImageUrl,
  }) async {
    return _post('/api/professional/register', {
      'personId': personId,
      'profession': profession,
      'licenseNumber': licenseNumber,
      'licenseImageUrl': licenseImageUrl,
    });
  }

  Future<ApiResponse> activateSubscription({
    required String personId,
    required String planId,
    required String paymentReference,
  }) async {
    return _post('/api/professional/activate', {
      'personId': personId,
      'planId': planId,
      'paymentReference': paymentReference,
    });
  }

  Future<ApiResponse> verifyLicense({
    required String licenseId,
    required bool approved,
    String? rejectionReason,
  }) async {
    return _post('/api/professional/license/verify', {
      'licenseId': licenseId,
      'approved': approved,
      'rejectionReason': rejectionReason,
    });
  }

  Future<ApiResponse> getProfessionalStatus({required String personId}) async {
    return _get('/api/professional/status/$personId');
  }

  Future<ApiResponse> getSubscriptionPlans() async {
    return _get('/api/professional/plans');
  }

  Future<ApiResponse> getSubscription({required String subscriptionId}) async {
    return _get('/api/professional/subscription/$subscriptionId');
  }

  Future<ApiResponse> renewSubscription({
    required String subscriptionId,
    required String paymentReference,
  }) async {
    return _post('/api/professional/renew', {
      'subscriptionId': subscriptionId,
      'paymentReference': paymentReference,
    });
  }

  Future<ApiResponse> cancelSubscription({required String subscriptionId}) async {
    return _post('/api/professional/cancel/$subscriptionId', {});
  }

  // ─── HTTP Helpers ───

  Future<ApiResponse> _get(String path) async {
    try {
      final response = await _dio.get(path);
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  Future<ApiResponse> _post(String path, Map<String, dynamic> data) async {
    try {
      final response = await _dio.post(path, data: data);
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  Future<ApiResponse> _put(String path, Map<String, dynamic> data) async {
    try {
      final response = await _dio.put(path, data: data);
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  Future<ApiResponse> _delete(String path) async {
    try {
      final response = await _dio.delete(path);
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  ApiResponse _handleError(DioException e) {
    _logger.error('API Error: ${e.message}', e);
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiResponse.error('اتصال قطع شد. دوباره تلاش کنید.');
      case DioExceptionType.connectionError:
        return ApiResponse.error('اتصال به سرور برقرار نیست.');
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        if (statusCode == 401) {
          return ApiResponse.error('لطفاً دوباره وارد شوید.');
        }
        if (statusCode == 404) {
          return ApiResponse.error('پیدا نشد.');
        }
        return ApiResponse.error('خطای سرور. لطفاً بعداً تلاش کنید.');
      default:
        return ApiResponse.error('خطای ناشناخته.');
    }
  }
}

/// API Response wrapper
class ApiResponse {
  final bool isSuccess;
  final dynamic data;
  final String? errorMessage;

  const ApiResponse.success(this.data)
      : isSuccess = true,
        errorMessage = null;

  const ApiResponse.error(this.errorMessage)
      : isSuccess = false,
        data = null;

  bool get isError => !isSuccess;
}
