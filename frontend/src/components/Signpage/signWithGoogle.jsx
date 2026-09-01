import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const GOOGLE_SCRIPT_SRC =
  "https://accounts.google.com/gsi/client";

/*
 * Google Identity Services dùng configuration global.
 *
 * React StrictMode có thể mount -> unmount -> mount component
 * trong development. Nếu initialize() nằm trực tiếp trong useEffect,
 * Google SDK sẽ bị initialize nhiều lần.
 *
 * Vì vậy trạng thái initialize được giữ ở module scope.
 */
let googleInitialized = false;
let googleScriptPromise = null;
let activeCredentialHandler = null;

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`
    );

    if (existingScript) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      const handleLoad = () => {
        cleanup();

        if (window.google?.accounts?.id) {
          resolve();
        } else {
          googleScriptPromise = null;
          reject(
            new Error(
              "Google Identity Services không khởi tạo được."
            )
          );
        }
      };

      const handleError = () => {
        cleanup();
        googleScriptPromise = null;

        reject(
          new Error(
            "Không thể tải dịch vụ đăng nhập Google."
          )
        );
      };

      const cleanup = () => {
        existingScript.removeEventListener(
          "load",
          handleLoad
        );

        existingScript.removeEventListener(
          "error",
          handleError
        );
      };

      existingScript.addEventListener(
        "load",
        handleLoad
      );

      existingScript.addEventListener(
        "error",
        handleError
      );

      return;
    }

    const script = document.createElement("script");

    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google?.accounts?.id) {
        resolve();
      } else {
        googleScriptPromise = null;

        reject(
          new Error(
            "Google Identity Services không khởi tạo được."
          )
        );
      }
    };

    script.onerror = () => {
      googleScriptPromise = null;

      reject(
        new Error(
          "Không thể tải dịch vụ đăng nhập Google."
        )
      );
    };

    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const ensureGoogleInitialized = () => {
  if (googleInitialized) {
    return;
  }

  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      "Chưa cấu hình Google Client ID."
    );
  }

  if (!window.google?.accounts?.id) {
    throw new Error(
      "Google Sign-In chưa sẵn sàng."
    );
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,

    callback: (response) => {
      if (
        typeof activeCredentialHandler ===
        "function"
      ) {
        activeCredentialHandler(response);
      }
    },
  });

  googleInitialized = true;
};

function SignWithGoogle() {
  const navigate = useNavigate();

  const {
    loginWithGoogleCredential,
  } = useAuth();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const googleButtonRef =
    useRef(null);

  const googleReadyRef =
    useRef(false);

  const credentialHandlerRef =
    useRef(null);

  useEffect(() => {
    let cancelled = false;

    const credentialHandler =
      async (response) => {
        if (cancelled) {
          return;
        }

        if (!response?.credential) {
          setLoading(false);

          setError(
            "Không nhận được thông tin đăng nhập từ Google."
          );

          window.setTimeout(
            () => setError(""),
            5000
          );

          return;
        }

        try {
          console.log(
            "🔄 Logging in with Google..."
          );

          const user =
            await loginWithGoogleCredential(
              response.credential,
              "STUDENT"
            );

          if (cancelled) {
            return;
          }

          console.log(
            "✅ Google login successful:",
            user?.email
          );

          navigate("/setup");
        } catch (loginError) {
          if (cancelled) {
            return;
          }

          console.error(
            "❌ Google login error:",
            loginError
          );

          setError(
            loginError?.message ||
              "Đăng nhập Google thất bại. Vui lòng thử lại."
          );

          window.setTimeout(
            () => setError(""),
            5000
          );
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    credentialHandlerRef.current =
      credentialHandler;

    activeCredentialHandler =
      credentialHandler;

    const setupGoogle = async () => {
      try {
        if (!GOOGLE_CLIENT_ID) {
          throw new Error(
            "Chưa cấu hình Google Client ID."
          );
        }

        await loadGoogleScript();

        if (
          cancelled ||
          !googleButtonRef.current
        ) {
          return;
        }

        ensureGoogleInitialized();

        googleButtonRef.current.innerHTML =
          "";

        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            type: "standard",
            theme: "outline",
            size: "large",
          }
        );

        googleReadyRef.current = true;
      } catch (setupError) {
        if (cancelled) {
          return;
        }

        console.error(
          "❌ Google Sign-In setup error:",
          setupError
        );

        googleReadyRef.current = false;

        setError(
          setupError?.message ||
            "Không thể khởi tạo đăng nhập Google."
        );

        window.setTimeout(
          () => setError(""),
          5000
        );
      }
    };

    setupGoogle();

    return () => {
      cancelled = true;

      googleReadyRef.current = false;

      if (
        activeCredentialHandler ===
        credentialHandlerRef.current
      ) {
        activeCredentialHandler = null;
      }
    };
  }, [
    loginWithGoogleCredential,
    navigate,
  ]);

  const googleLogin = async () => {
    setError("");

    if (!GOOGLE_CLIENT_ID) {
      setError(
        "Chưa cấu hình Google Client ID."
      );

      window.setTimeout(
        () => setError(""),
        5000
      );

      return;
    }

    if (
      !googleReadyRef.current ||
      !googleButtonRef.current
    ) {
      setError(
        "Google Sign-In chưa sẵn sàng. Vui lòng thử lại."
      );

      window.setTimeout(
        () => setError(""),
        5000
      );

      return;
    }

    const googleButton =
      googleButtonRef.current.querySelector(
        'div[role="button"]'
      ) ||
      googleButtonRef.current.querySelector(
        "iframe"
      );

    if (!googleButton) {
      setError(
        "Không thể mở cửa sổ đăng nhập Google."
      );

      window.setTimeout(
        () => setError(""),
        5000
      );

      return;
    }

    setLoading(true);

    googleButton.click();

    /*
     * Nếu người dùng đóng popup hoặc chưa hoàn tất,
     * không giữ nút ở trạng thái loading vô thời hạn.
     */
    window.setTimeout(() => {
      setLoading(false);
    }, 1500);
  };

  return (
    <div>
      {error && (
        <div className="mb-4 rounded border border-red-400 bg-red-100 p-3 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div
        ref={googleButtonRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      <button
        type="button"
        onClick={googleLogin}
        disabled={loading}
        className="flex w-full items-center justify-center rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        <img
          src="https://developers.google.com/identity/images/g-logo.png"
          alt="Google"
          className="mr-3 h-5 w-5"
        />

        {loading
          ? "Đang đăng nhập..."
          : "Đăng nhập bằng Google"}
      </button>
    </div>
  );
}

export default SignWithGoogle;
