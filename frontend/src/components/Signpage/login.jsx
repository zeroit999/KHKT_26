import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase.js';
import { useAuth } from '../../contexts/AuthContext';
import SignWithGoogle from './signWithGoogle';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import lightLogo from '../../assets/favicon-light-mode.png';
import darkLogo from '../../assets/favicon-dark-mode.png';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔄 Logging in with Firebase...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase login successful:', userCredential.user.email);

      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists() || !userDoc.data()?.isSetupComplete) {
        navigate('/setup');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      if (error.code === 'auth/user-not-found') {
        setError('Không tìm thấy tài khoản với email này');
      } else if (error.code === 'auth/wrong-password') {
        setError('Mật khẩu không chính xác');
      } else if (error.code === 'auth/invalid-email') {
        setError('Email không hợp lệ');
      } else if (error.code === 'auth/invalid-credential') {
        setError('Thông tin đăng nhập không chính xác');
      } else {
        setError('Đăng nhập thất bại. Vui lòng thử lại.');
      }
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      console.log('✅ User already logged in, redirecting...');
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex">


      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="text-center mb-6 flex flex-col items-center">
              <div className="mb-5 flex items-center justify-center gap-3">
                <div className="rounded-md bg-gradient-to-r from-cyan-400 to-blue-500 p-[2px] shadow-lg">
                  <img
                    src={lightLogo}
                    alt="EduSprint Logo"
                    className="h-9 w-9 rounded-sm object-cover dark:hidden"
                  />
                  <img
                    src={darkLogo}
                    alt="EduSprint Logo"
                    className="hidden h-9 w-9 rounded-sm object-cover dark:block"
                  />
                </div>

              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                Chào mừng bạn trở lại!
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Rất vui được gặp bạn! Vui lòng đăng nhập để tiếp tục
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 dark:text-blue-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập địa chỉ email của bạn"
                    className="w-full pl-10 pr-4 py-3 border-2 border-blue-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-blue-50/30 dark:bg-gray-700 hover:bg-blue-50/50 dark:hover:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    Mật khẩu
                  </label>
                  <Link
                    to="/forgotpass"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 dark:text-blue-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    className="w-full pl-10 pr-12 py-3 border-2 border-blue-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-blue-50/30 dark:bg-gray-700 hover:bg-blue-50/50 dark:hover:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full px-6 py-3 font-medium rounded-xl transition-all duration-200 shadow-md hover:shadow-lg ${
                  loading
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                }`}
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    hoặc
                  </span>
                </div>
              </div>

              <SignWithGoogle />

              <p className="text-center text-gray-600 dark:text-gray-400">
                Chưa có tài khoản?{' '}
                <Link
                  to="/register"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  Đăng ký
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
