import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

function SignWithGoogle() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const googleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      console.log("🔄 Logging in with Google via Firebase...");

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      console.log("✅ Google login successful:", result.user.email);

      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);

      // USER CHƯA CÓ TRONG FIRESTORE
      if (!userSnap.exists()) {
        console.log("🆕 Creating new user document...");

        await setDoc(userRef, {
          email: result.user.email || "",
          name: result.user.displayName || "",
          avatar: result.user.photoURL || "",
          role: "STUDENT", // ✅ Đồng nhất với register.jsx
          points: 0,
          streak: 0,
          isSetupComplete: false,
        });

        console.log("✅ User document created");
        navigate("/setup");
        return;
      }

      // USER ĐÃ CÓ
      const userData = userSnap.data();
      console.log("📄 Existing user data:", userData);

      if (!userData.isSetupComplete) {
        navigate("/setup");
      } else {
        navigate("/");
      }
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

      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={googleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <img
          src="https://developers.google.com/identity/images/g-logo.png"
          alt="Google"
          className="w-5 h-5 mr-3"
        />
        {loading ? "Đang đăng nhập..." : "Đăng nhập bằng Google"}
      </button>
    </div>
  );
}

export default SignWithGoogle;
