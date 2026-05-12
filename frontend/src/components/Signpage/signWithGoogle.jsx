import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase.js";
import { useAuth } from "../../contexts/AuthContext";

function SignWithGoogle() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, isPro } = useAuth();

  const googleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      console.log("🔄 Logging in with Google via Firebase...");

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      console.log("✅ Google login successful:", result.user.email);

      // AuthContext will automatically handle the rest
      // Navigate to home page
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } catch (error) {
      console.error("❌ Google login error:", error);

      if (error.code === "auth/popup-closed-by-user") {
        setError("Đăng nhập bị hủy");
      } else if (error.code === "auth/popup-blocked") {
        setError("Popup bị chặn. Vui lòng cho phép popup và thử lại.");
      } else if (error.code === "auth/cancelled-popup-request") {
        setError("Yêu cầu đăng nhập bị hủy");
      } else {
        setError("Đăng nhập Google thất bại. Vui lòng thử lại.");
      }

      setTimeout(() => {
        setError("");
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        onClick={googleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <img
          src="https://developers.google.com/identity/images/g-logo.png"
          alt="Google"
          className="w-5 h-5 mr-2"
        />
        {loading ? "Đang đăng nhập..." : "Đăng nhập bằng Google"}
      </button>
    </div>
  );
}

export default SignWithGoogle;