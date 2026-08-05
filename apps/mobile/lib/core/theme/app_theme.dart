import 'package:flutter/material.dart';

/// Zone App Theme
///
/// Design principles:
/// - Warm, friendly colours (not corporate)
/// - RTL-first layout
/// - Voice-first interaction (large touch targets)
/// - Vazirmatn font for Persian text

class AppTheme {
  AppTheme._();

  // ─── Colour Palette ───

  // Primary: warm amber/gold — neighbourhood warmth
  static const Color primaryLight = Color(0xFFE8A838);
  static const Color primaryDark = Color(0xFFF0B848);

  // Secondary: soft teal — calm, trust
  static const Color secondaryLight = Color(0xFF4DB6AC);
  static const Color secondaryDark = Color(0xFF80CBC4);

  // Surface
  static const Color surfaceLight = Color(0xFFFFFBF0);
  static const Color surfaceDark = Color(0xFF1A1A2E);

  // Background
  static const Color backgroundLight = Color(0xFFFFF8E7);
  static const Color backgroundDark = Color(0xFF0F0F1A);

  // Text
  static const Color textPrimaryLight = Color(0xFF2D2D3A);
  static const Color textPrimaryDark = Color(0xFFF0F0F5);
  static const Color textSecondaryLight = Color(0xFF6B6B80);
  static const Color textSecondaryDark = Color(0xFF9E9EB8);

  // Accent
  static const Color accentKnow = Color(0xFF4CAF50);      // Green — I know
  static const Color accentAsk = Color(0xFF2196F3);       // Blue — I ask
  static const Color accentUnknown = Color(0xFFFF9800);   // Orange — I don't know
  static const Color accentEmergency = Color(0xFFE53935); // Red — emergency

  // Professional
  static const Color professionalGold = Color(0xFFFFD700);
  static const Color professionalBadge = Color(0xFFB8860B);

  // ─── Light Theme ───

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: primaryLight,
      scaffoldBackgroundColor: backgroundLight,
      colorScheme: const ColorScheme.light(
        primary: primaryLight,
        secondary: secondaryLight,
        surface: surfaceLight,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: textPrimaryLight,
        error: Color(0xFFE53935),
        onError: Colors.white,
      ),
      textTheme: _buildTextTheme(textPrimaryLight, textSecondaryLight),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceLight,
        foregroundColor: textPrimaryLight,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontFamily: 'Vazirmatn',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: textPrimaryLight,
        ),
      ),
      cardTheme: CardThemeData(
        color: surfaceLight,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryLight,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontFamily: 'Vazirmatn',
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryLight, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(
          fontFamily: 'Vazirmatn',
          color: textSecondaryLight,
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surfaceLight,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primaryLight,
        foregroundColor: Colors.white,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surfaceLight,
        selectedItemColor: primaryLight,
        unselectedItemColor: textSecondaryLight,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: TextStyle(
          fontFamily: 'Vazirmatn',
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: 'Vazirmatn',
          fontSize: 12,
        ),
      ),
    );
  }

  // ─── Dark Theme ───

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      primaryColor: primaryDark,
      scaffoldBackgroundColor: backgroundDark,
      colorScheme: const ColorScheme.dark(
        primary: primaryDark,
        secondary: secondaryDark,
        surface: surfaceDark,
        onPrimary: Colors.black,
        onSecondary: Colors.black,
        onSurface: textPrimaryDark,
        error: Color(0xFFEF5350),
        onError: Colors.white,
      ),
      textTheme: _buildTextTheme(textPrimaryDark, textSecondaryDark),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceDark,
        foregroundColor: textPrimaryDark,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontFamily: 'Vazirmatn',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: textPrimaryDark,
        ),
      ),
      cardTheme: CardThemeData(
        color: surfaceDark,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryDark,
          foregroundColor: Colors.black,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontFamily: 'Vazirmatn',
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceDark,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryDark, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(
          fontFamily: 'Vazirmatn',
          color: textSecondaryDark,
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surfaceDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primaryDark,
        foregroundColor: Colors.black,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surfaceDark,
        selectedItemColor: primaryDark,
        unselectedItemColor: textSecondaryDark,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: TextStyle(
          fontFamily: 'Vazirmatn',
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: 'Vazirmatn',
          fontSize: 12,
        ),
      ),
    );
  }

  // ─── Text Theme ───

  static TextTheme _buildTextTheme(Color primary, Color secondary) {
    return TextTheme(
      displayLarge: TextStyle(fontFamily: 'Vazirmatn', fontSize: 32, fontWeight: FontWeight.w700, color: primary),
      displayMedium: TextStyle(fontFamily: 'Vazirmatn', fontSize: 28, fontWeight: FontWeight.w700, color: primary),
      displaySmall: TextStyle(fontFamily: 'Vazirmatn', fontSize: 24, fontWeight: FontWeight.w600, color: primary),
      headlineLarge: TextStyle(fontFamily: 'Vazirmatn', fontSize: 22, fontWeight: FontWeight.w600, color: primary),
      headlineMedium: TextStyle(fontFamily: 'Vazirmatn', fontSize: 20, fontWeight: FontWeight.w600, color: primary),
      headlineSmall: TextStyle(fontFamily: 'Vazirmatn', fontSize: 18, fontWeight: FontWeight.w500, color: primary),
      bodyLarge: TextStyle(fontFamily: 'Vazirmatn', fontSize: 16, fontWeight: FontWeight.w400, color: primary),
      bodyMedium: TextStyle(fontFamily: 'Vazirmatn', fontSize: 14, fontWeight: FontWeight.w400, color: primary),
      bodySmall: TextStyle(fontFamily: 'Vazirmatn', fontSize: 12, fontWeight: FontWeight.w300, color: secondary),
      labelLarge: TextStyle(fontFamily: 'Vazirmatn', fontSize: 14, fontWeight: FontWeight.w600, color: primary),
      labelMedium: TextStyle(fontFamily: 'Vazirmatn', fontSize: 12, fontWeight: FontWeight.w500, color: secondary),
      labelSmall: TextStyle(fontFamily: 'Vazirmatn', fontSize: 10, fontWeight: FontWeight.w400, color: secondary),
    );
  }
}

/// Zone-specific colour extensions for easy access
extension ZoneColors on BuildContext {
  Color get knowGreen => AppTheme.accentKnow;
  Color get askBlue => AppTheme.accentAsk;
  Color get unknownOrange => AppTheme.accentUnknown;
  Color get emergencyRed => AppTheme.accentEmergency;
  Color get professionalGold => AppTheme.professionalGold;
  Color get professionalBadge => AppTheme.professionalBadge;
}
