import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import React, { useState } from "react";
import { auth, db } from "../firebase.js";
import { setDoc, doc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Upload,
  Camera,
} from "lucide-react";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(""); // State to hold error message
  const navigate = useNavigate(); // Hook to manage navigation

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      const user = auth.currentUser;
      console.log(user);

      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          email: email,
          firstName: fname,
        });

        await signInWithEmailAndPassword(auth, email, password);
      }

      navigate("/profile"); // Redirect to home or another desired page
      console.log("User Registered Successfully!!");
    } catch (error) {
      console.log(error.message);
      setError(error.message); // Set error message to state
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex">
      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Tên tài khoản
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500" />
                  <input
                    maxLength="20"
                    type="text"
                    value={fname}
                    onChange={(e) => setFname(e.target.value)}
                    placeholder="Nhập tên của bạn"
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gradient-to-r from-blue-50/30 to-blue-50/50 hover:from-blue-50/50 hover:to-blue-50/70"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập địa chỉ email của bạn"
                    className="w-full pl-10 pr-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gradient-to-r from-blue-50/30 to-blue-50/50 hover:from-blue-50/50 hover:to-blue-50/70"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    className="w-full pl-10 pr-12 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gradient-to-r from-blue-50/30 to-blue-50/50 hover:from-blue-50/50 hover:to-blue-50/70"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-700"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Tạo tài khoản
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">hoặc</span>
                </div>
              </div>

              {/* Google Sign In Button Placeholder */}
              <button
                type="button"
                className="w-full flex items-center justify-center px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium text-gray-700"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Đăng ký với Google
              </button>

              <p className="text-center text-gray-600">
                Đã có tài khoản?{" "}
                <Link
                  to="/login"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Đăng nhập
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
      {/* Left Side - Illustration/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>

        {/* Modern Abstract Illustration */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Large Central Graphic */}
            <div className="relative">
              {/* Main Circle with Glassmorphism */}
              <div className="w-96 h-96 bg-gradient-to-br from-white/20 via-white/10 to-transparent rounded-full backdrop-blur-xl border border-white/30 shadow-2xl relative">
                {/* Inner Circles */}
                <div className="absolute top-8 left-8 w-80 h-80 bg-gradient-to-tr from-white/15 to-transparent rounded-full backdrop-blur-lg border border-white/20"></div>
                <div className="absolute top-16 left-16 w-64 h-64 bg-gradient-to-bl from-white/25 to-transparent rounded-full backdrop-blur-md border border-white/40"></div>

                {/* Central Logo Area */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-32 h-32 bg-gradient-to-br from-white/40 via-white/30 to-white/20 rounded-3xl backdrop-blur-2xl border-2 border-white/50 shadow-2xl flex items-center justify-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 rounded-2xl shadow-inner flex items-center justify-center">
                      <span className="text-white font-bold text-3xl drop-shadow-2xl">
                        Q
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating Elements Around Circle */}
                <div className="absolute -top-6 left-1/3 w-12 h-12 bg-white/30 rounded-2xl backdrop-blur-md shadow-lg rotate-12 animate-pulse"></div>
                <div className="absolute top-1/4 -right-6 w-16 h-16 bg-white/25 rounded-full backdrop-blur-lg shadow-xl animate-pulse delay-500"></div>
                <div className="absolute bottom-1/4 -left-8 w-14 h-14 bg-white/35 rounded-2xl backdrop-blur-md shadow-lg -rotate-12 animate-pulse delay-1000"></div>
                <div className="absolute -bottom-4 right-1/3 w-10 h-10 bg-white/40 rounded-full backdrop-blur-sm shadow-md animate-pulse delay-700"></div>
              </div>

              {/* Decorative Lines/Paths */}
              <div className="absolute top-0 left-0 w-full h-full">
                {/* Curved lines */}
                <div className="absolute top-20 left-10 w-40 h-1 bg-gradient-to-r from-white/30 to-transparent rounded-full rotate-45"></div>
                <div className="absolute bottom-20 right-10 w-32 h-1 bg-gradient-to-l from-white/40 to-transparent rounded-full -rotate-45"></div>
                <div className="absolute top-1/2 -left-20 w-60 h-0.5 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full rotate-12"></div>
                <div className="absolute top-1/3 -right-20 w-50 h-0.5 bg-gradient-to-l from-transparent via-white/25 to-transparent rounded-full -rotate-12"></div>
              </div>
            </div>

            {/* Background Decorative Elements */}
            <div className="absolute top-10 left-10 w-6 h-6 bg-white/20 rounded-full animate-ping"></div>
            <div className="absolute top-20 right-20 w-4 h-4 bg-white/30 rounded-full animate-ping delay-300"></div>
            <div className="absolute bottom-32 left-16 w-5 h-5 bg-white/25 rounded-full animate-ping delay-700"></div>
            <div className="absolute bottom-16 right-32 w-3 h-3 bg-white/35 rounded-full animate-ping delay-1000"></div>
            <div className="absolute top-40 left-32 w-2 h-2 bg-white/40 rounded-full animate-ping delay-500"></div>

            {/* Abstract Shapes */}
            <div className="absolute top-24 right-16 w-20 h-20 bg-white/10 rounded-3xl backdrop-blur-sm rotate-45 animate-pulse delay-200"></div>
            <div className="absolute bottom-24 left-20 w-24 h-24 bg-white/8 rounded-2xl backdrop-blur-sm -rotate-12 animate-pulse delay-800"></div>
            <div className="absolute top-1/2 left-8 w-16 h-16 bg-white/15 rounded-full backdrop-blur-sm animate-pulse delay-1200"></div>
            <div className="absolute top-1/3 right-8 w-18 h-18 bg-white/12 rounded-2xl backdrop-blur-sm rotate-30 animate-pulse delay-400"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;