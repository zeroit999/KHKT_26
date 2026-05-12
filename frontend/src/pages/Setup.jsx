import React, { useState } from "react";
import { auth, db } from "../components/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

function Setup() {
  const [step, setStep] = useState(1);

  const [role, setRole] = useState("");

  const [name, setName] = useState("");

  const [school, setSchool] = useState("");

  const [className, setClassName] = useState("");

  const [phone, setPhone] = useState("");

  const [facebook, setFacebook] = useState("");

  const [city, setCity] = useState("");

  const [address, setAddress] = useState("");

  const [subject, setSubject] = useState("");

  const navigate = useNavigate();

  // GLOBAL DARKMODE
  const darkMode =
    document.documentElement.classList.contains(
      "dark"
    );

  const handleFinish = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        toast.error("Bạn chưa đăng nhập");
        return;
      }

      if (
        !name ||
        !school ||
        !phone ||
        !city ||
        !address
      ) {
        toast.error(
          "Vui lòng nhập đầy đủ thông tin"
        );
        return;
      }

      if (
        role === "STUDENT" &&
        !className
      ) {
        toast.error("Vui lòng nhập lớp");
        return;
      }

      if (
        role === "TEACHER" &&
        !subject
      ) {
        toast.error(
          "Vui lòng nhập môn giảng dạy"
        );
        return;
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,

          email: user.email || "",

          photoURL:
            user.photoURL || "",

          role,

          name,

          school,

          className:
            role === "STUDENT"
              ? className
              : "",

          phone,

          facebook,

          city,

          address,

          subject:
            role === "TEACHER"
              ? subject
              : "",

          points: 0,

          learningStreak: 0,

          isSetupComplete: true,

          createdAt:
            new Date().toISOString(),
        },
        { merge: true }
      );

      toast.success(
        "Hoàn tất onboarding"
      );

      // FORCE REFRESH AUTH STATE
      window.location.href =
        "/profile";
    } catch (error) {
      console.error(error);

      toast.error(
        error.message ||
          "Có lỗi xảy ra"
      );
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 py-10 transition-colors duration-300 ${
        darkMode
          ? "bg-[#020817]"
          : "bg-slate-100"
      }`}
    >
      <div
        className={`w-full max-w-2xl rounded-3xl border p-8 shadow-2xl backdrop-blur-xl transition-colors duration-300 ${
          darkMode
            ? "border-white/10 bg-slate-950/80"
            : "border-slate-200 bg-white"
        }`}
      >
        {/* STEP */}
        <div className="mb-10 flex items-center justify-between">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="flex flex-1 items-center"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full font-bold ${
                  step >= item
                    ? "bg-blue-600 text-white"
                    : darkMode
                    ? "bg-slate-800 text-slate-400"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {item}
              </div>

              {item !== 3 && (
                <div
                  className={`h-1 flex-1 ${
                    step > item
                      ? "bg-blue-600"
                      : darkMode
                      ? "bg-slate-700"
                      : "bg-slate-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <h1
              className={`mb-4 text-4xl font-black ${
                darkMode
                  ? "text-white"
                  : "text-slate-900"
              }`}
            >
              Chào mừng 👋
            </h1>

            <p
              className={`mb-8 ${
                darkMode
                  ? "text-slate-300"
                  : "text-slate-600"
              }`}
            >
              Hoàn tất vài bước để bắt
              đầu sử dụng EduSprint.
            </p>

            <button
              onClick={() =>
                setStep(2)
              }
              className="w-full rounded-2xl bg-blue-600 py-4 font-semibold text-white transition hover:bg-blue-700"
            >
              Tiếp tục
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <h1
              className={`mb-4 text-4xl font-black ${
                darkMode
                  ? "text-white"
                  : "text-slate-900"
              }`}
            >
              Bạn là ai?
            </h1>

            <p
              className={`mb-8 ${
                darkMode
                  ? "text-slate-300"
                  : "text-slate-600"
              }`}
            >
              Chọn vai trò để hệ thống
              phân quyền.
            </p>

            <div className="mb-8 grid grid-cols-2 gap-5">
              {/* STUDENT */}
              <button
                onClick={() =>
                  setRole("STUDENT")
                }
                className={`rounded-3xl border-2 p-6 transition ${
                  role === "STUDENT"
                    ? "border-blue-500 bg-blue-500/10"
                    : darkMode
                    ? "border-white/10 bg-slate-900/50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <h2
                  className={`text-2xl font-bold ${
                    darkMode
                      ? "text-white"
                      : "text-slate-900"
                  }`}
                >
                  Học sinh
                </h2>

                <p
                  className={`mt-2 ${
                    darkMode
                      ? "text-slate-400"
                      : "text-slate-500"
                  }`}
                >
                  Quyền User
                </p>
              </button>

              {/* TEACHER */}
              <button
                onClick={() =>
                  setRole("TEACHER")
                }
                className={`rounded-3xl border-2 p-6 transition ${
                  role === "TEACHER"
                    ? "border-blue-500 bg-blue-500/10"
                    : darkMode
                    ? "border-white/10 bg-slate-900/50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <h2
                  className={`text-2xl font-bold ${
                    darkMode
                      ? "text-white"
                      : "text-slate-900"
                  }`}
                >
                  Giáo viên
                </h2>

                <p
                  className={`mt-2 ${
                    darkMode
                      ? "text-slate-400"
                      : "text-slate-500"
                  }`}
                >
                  Quyền Giáo viên
                </p>
              </button>
            </div>

            <button
              disabled={!role}
              onClick={() =>
                setStep(3)
              }
              className="w-full rounded-2xl bg-blue-600 py-4 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              Tiếp tục
            </button>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <h1
              className={`mb-6 text-4xl font-black ${
                darkMode
                  ? "text-white"
                  : "text-slate-900"
              }`}
            >
              Thông tin cá nhân
            </h1>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Họ và tên"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${
                  darkMode
                    ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
                    : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
                }`}
              />

              <input
                type="text"
                placeholder="Trường"
                value={school}
                onChange={(e) =>
                  setSchool(
                    e.target.value
                  )
                }
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${
                  darkMode
                    ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
                    : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
                }`}
              />

              {role === "STUDENT" && (
                <input
                  type="text"
                  placeholder="Lớp"
                  value={className}
                  onChange={(e) =>
                    setClassName(
                      e.target.value
                    )
                  }
                  className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${
                    darkMode
                      ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
                      : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
                  }`}
                />
              )}

              {role === "TEACHER" && (
                <input
                  type="text"
                  placeholder="Môn giảng dạy"
                  value={subject}
                  onChange={(e) =>
                    setSubject(
                      e.target.value
                    )
                  }
                  className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${
                    darkMode
                      ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
                      : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
                  }`}
                />
              )}

              <input
                type="text"
                placeholder="Số điện thoại"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                  )
                }
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${
                  darkMode
                    ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
                    : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
                }`}
              />

              <input
                type="text"
                placeholder="Facebook (không bắt buộc)"
                value={facebook}
                onChange={(e) =>
                  setFacebook(
                    e.target.value
                  )
                }
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${
                  darkMode
                    ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
                    : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
                }`}
              />

              <input
                type="text"
                placeholder="Tỉnh / Thành phố"
                value={city}
                onChange={(e) =>
                  setCity(
                    e.target.value
                  )
                }
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${
                  darkMode
                    ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
                    : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
                }`}
              />

              <input
                type="text"
                placeholder="Địa chỉ"
                value={address}
                onChange={(e) =>
                  setAddress(
                    e.target.value
                  )
                }
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${
                  darkMode
                    ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
                    : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
                }`}
              />
            </div>

            <button
              onClick={handleFinish}
              className="mt-8 w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition hover:bg-blue-700"
            >
              Hoàn tất
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Setup;