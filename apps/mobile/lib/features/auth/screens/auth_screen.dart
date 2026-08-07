/// Auth Screen — Simple phone number authentication
///
/// For MVP: simple phone number entry
/// Production: OTP verification via Iranian SMS gateway
library features_auth_screens_auth_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/services/navigation_service.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _phoneController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ─── Logo ───
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.hearing,
                  size: 56,
                  color: AppTheme.primaryLight,
                ),
              ),
              const SizedBox(height: 32),

              // ─── Title ───
              Text(
                'زون',
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  color: AppTheme.primaryLight,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'رفیق محله‌ات',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppTheme.textSecondaryLight,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),

              // ─── Phone Input ───
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  hintText: 'شماره موبایل',
                  prefixIcon: const Icon(Icons.phone_android),
                  prefixText: '+98 ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // ─── Submit ───
              ElevatedButton(
                onPressed: _isLoading ? null : _handleLogin,
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('ورود'),
              ),
              const SizedBox(height: 16),

              // ─── Privacy note ───
              Text(
                'متن خام گفتار هرگز دیوایس رو ترک نمی‌کنه.\n'
                'فقط داده‌های ساختاریافته به سرور ارسال میشه.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondaryLight,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleLogin() {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('اول شماره موبایلت رو بنویس 📱'),
          backgroundColor: AppTheme.accentEmergency,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    // For MVP: skip OTP, just login. A first-time login always goes
    // through onboarding, so mark the account as a new user.
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) {
        ref.read(authProvider.notifier).login(
          'user_$phone',
          'کاربر',
          'default_zone',
          isNewUser: true,
        );
      }
    });
  }
}
