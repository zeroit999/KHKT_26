import React, {
  useEffect,
  useRef,
  useState,
} from "react"

import { useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

const GOOGLE_SCRIPT_SRC =
  "https" + "://accounts.google.com/gsi/client"

let googleScriptPromise = null

function loadGoogleScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  if (googleScriptPromise) {
    return googleScriptPromise
  }

  googleScriptPromise = new Promise(
    (resolve, reject) => {
      const existing =
        document.querySelector(
          `script[src="${GOOGLE_SCRIPT_SRC}"]`
        )

      if (existing) {
        const checkReady = () => {
          if (window.google?.accounts?.id) {
            resolve()
          } else {
            googleScriptPromise = null
            reject(
              new Error(
                "Google Sign-In không khởi tạo được."
              )
            )
          }
        }

        existing.addEventListener(
          "load",
          checkReady,
          { once: true }
        )

        existing.addEventListener(
          "error",
          () => {
            googleScriptPromise = null
            reject(
              new Error(
                "Không thể tải Google Sign-In."
              )
            )
          },
          { once: true }
        )

        return
      }

      const script =
        document.createElement("script")

      script.src = GOOGLE_SCRIPT_SRC
      script.async = true
      script.defer = true

      script.onload = () => {
        if (window.google?.accounts?.id) {
          resolve()
        } else {
          googleScriptPromise = null
          reject(
            new Error(
              "Google Sign-In không khởi tạo được."
            )
          )
        }
      }

      script.onerror = () => {
        googleScriptPromise = null
        reject(
          new Error(
            "Không thể tải Google Sign-In."
          )
        )
      }

      document.head.appendChild(script)
    }
  )

  return googleScriptPromise
}

function SignWithGoogle() {
  const navigate = useNavigate()

  const {
    loginWithGoogleCredential,
  } = useAuth()

  const buttonRef = useRef(null)

  const [error, setError] =
    useState("")

  useEffect(() => {
    let cancelled = false

    async function setupGoogle() {
      try {
        setError("")

        if (!GOOGLE_CLIENT_ID) {
          throw new Error(
            "Chưa cấu hình Google Client ID."
          )
        }

        await loadGoogleScript()

        if (
          cancelled ||
          !buttonRef.current
        ) {
          return
        }

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,

          use_fedcm_for_button: true,

          button_auto_select: false,

          callback: async (response) => {
            if (
              cancelled ||
              !response?.credential
            ) {
              return
            }

            try {
              setError("")

              const user =
                await loginWithGoogleCredential(
                  response.credential,
                  "STUDENT"
                )

              if (cancelled) {
                return
              }

              navigate(
                user?.isSetupComplete
                  ? "/"
                  : "/setup"
              )
            } catch (loginError) {
              if (cancelled) {
                return
              }

              console.error(
                "Google login error:",
                loginError
              )

              setError(
                loginError?.message ||
                  "Đăng nhập Google thất bại."
              )
            }
          },
        })

        buttonRef.current.innerHTML = ""

        const buttonWidth = Math.min(
          400,
          Math.max(
            200,
            Math.floor(
              buttonRef.current.getBoundingClientRect().width
            )
          )
        )

        window.google.accounts.id.renderButton(
          buttonRef.current,
          {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: buttonWidth,
          }
        )
      } catch (setupError) {
        if (cancelled) {
          return
        }

        console.error(
          "Google Sign-In setup error:",
          setupError
        )

        setError(
          setupError?.message ||
            "Không thể khởi tạo Google Sign-In."
        )
      }
    }

    setupGoogle()

    return () => {
      cancelled = true
    }
  }, [
    loginWithGoogleCredential,
    navigate,
  ])

  return (
    <div className="w-full">
      {error && (
        <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div
        className="flex w-full justify-center overflow-hidden rounded-xl"
      >
        <div
          ref={buttonRef}
          className="w-full"
        />
      </div>
    </div>
  )
}

export default SignWithGoogle
