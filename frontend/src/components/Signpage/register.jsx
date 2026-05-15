import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import React, { useState } from "react";
import { auth, db } from "../firebase.js";
import { setDoc, doc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import SignWithGoogle from "./signWithGoogle";
import defaultAvatar from "../../assets/favicon-light-mode.png";
import lightLogo from "../../assets/favicon-light-mode.png";
import darkLogo from "../../assets/favicon-dark-mode.png";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      const user = credential.user;
      console.log(user);

      if (user) {
        await updateProfile(user, {
          displayName: fname,
          photoURL: defaultAvatar,
        });

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: email,
          name: fname,
          fullName: fname,
          role: "STUDENT",
          avatar: defaultAvatar,
          photoURL: defaultAvatar,
          points: 0,
          streak: 0,
          isSetupComplete: false,
        });

        await signInWithEmailAndPassword(auth, email, password);
      }

      setTimeout(() => {
        navigate("/setup");
      }, 500);

      console.log("User Registered Successfully!!");
    } catch (error) {
      console.log(error.message);
      setError(error.message);
    }
  };

  // Class dùng chung cho tất cả input — đồng nhất kích thước và dark mode
  const inputClass =
    "w-full pl-10 pr-4 py-3 border-2 border-blue-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-blue-50/30 dark:bg-gray-700 hover:bg-blue-50/50 dark:hover:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";

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
                Tạo tài khoản mới
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Đăng ký để bắt đầu sử dụng EduSprint
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">

              {/* Tên tài khoản */}
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                  Tên tài khoản
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 dark:text-blue-400" />
                  <input
                    maxLength="20"
                    type="text"
                    value={fname}
                    onChange={(e) => setFname(e.target.value)}
                    placeholder="Nhập tên của bạn"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

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
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 dark:text-blue-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    className={`${inputClass} pr-12`}
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
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Tạo tài khoản
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
                Đã có tài khoản?{" "}
                <Link
                  to="/login"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  Đăng nhập
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>


    </div>
  );
}

export default Register;
