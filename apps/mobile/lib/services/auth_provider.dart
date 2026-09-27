import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class AuthProvider extends ChangeNotifier {
  String? _token;
  String? _userEmail;
  String? _userName;
  String? _userRole;
  bool _isLoading = true;

  String? get token => _token;
  String? get userEmail => _userEmail;
  String? get userName => _userName;
  String? get userRole => _userRole;
  bool get isAuthenticated => _token != null;
  bool get isLoading => _isLoading;

  AuthProvider() {
    _loadStoredAuth();
  }

  Future<void> _loadStoredAuth() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    _userEmail = prefs.getString('user_email');
    _userName = prefs.getString('user_name');
    _userRole = prefs.getString('user_role');
    _isLoading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final res = await ApiService.login(email, password);
    _token = res['token'] as String;
    final user = res['user'] as Map<String, dynamic>;
    _userEmail = user['email'] as String;
    _userName = user['full_name'] as String;
    _userRole = user['role'] as String;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', _token!);
    await prefs.setString('user_email', _userEmail!);
    await prefs.setString('user_name', _userName!);
    await prefs.setString('user_role', _userRole!);

    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    _userEmail = null;
    _userName = null;
    _userRole = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_email');
    await prefs.remove('user_name');
    await prefs.remove('user_role');

    notifyListeners();
  }
}
