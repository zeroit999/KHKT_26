import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";
import {
  useSetupForm,
  teacherSubjects,
  gradeOptions,
} from "../../hooks/setup/useSetupForm";

const normalizeText = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function Setup() {
  const {
    step,
    setStep,

    role,
    setRole,

    fullName,
    setFullName,
    school,
    setSchool,
    schools = [],

    grade,
    setGrade,
    phone,
    email,
    setEmail,
    subject,
    setSubject,

    provinces,
    wards,
    provinceCode,
    wardCode,

    handleSelectProvince,
    handleSelectWard,
    handleSelectSchool,
    handlePhoneChange,
    handleFinish,
  } = useSetupForm();

  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains("dark")
  );

  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const schoolBoxRef = useRef(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDarkMode(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        schoolBoxRef.current &&
        !schoolBoxRef.current.contains(event.target)
      ) {
        setSchoolDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSchools = useMemo(() => {
    const keyword = normalizeText(school);

    if (!keyword) return schools.slice(0, 80);

    return schools
      .filter((item) => {
        const name = normalizeText(item.name);
        const ward = normalizeText(item.ward);
        const address = normalizeText(item.address);

        return (
          name.includes(keyword) ||
          ward.includes(keyword) ||
          address.includes(keyword)
        );
      })
      .slice(0, 80);
  }, [school, schools]);

  const pageBg = darkMode
    ? "bg-[radial-gradient(circle_at_top_left,#2563eb33,transparent_30%),radial-gradient(circle_at_bottom_right,#06b6d433,transparent_30%),#020817]"
    : "bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_35%),radial-gradient(circle_at_bottom_right,#ccfbf1,transparent_35%),#f8fafc]";

  const inputClass = `w-full rounded-2xl border px-5 py-4 text-base outline-none transition ${
    darkMode
      ? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
  }`;

  const selectClass = `${inputClass} cursor-pointer appearance-none disabled:cursor-not-allowed disabled:opacity-50`;

  const helperTextClass = darkMode ? "text-slate-400" : "text-slate-500";

  const steps = [
    { number: 1, label: "Chào mừng" },
    { number: 2, label: "Vai trò" },
    { number: 3, label: "Thông tin" },
  ];

  return (
    <div
      className={`relative flex h-screen items-center justify-center overflow-hidden px-4 transition-colors duration-300 ${pageBg}`}
    >
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />

      <div
        className={`relative w-full max-w-4xl rounded-[2rem] border p-6 shadow-2xl backdrop-blur-2xl sm:p-8 ${
          darkMode
            ? "border-white/10 bg-slate-950/80 shadow-blue-950/30"
            : "border-white/80 bg-white/90 shadow-slate-300/50"
        }`}
      >
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            {steps.map((item) => (
              <div key={item.number} className="flex flex-1 items-center">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-base font-black transition ${
                    step >= item.number
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
                      : darkMode
                      ? "bg-white/10 text-slate-400"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step > item.number ? (
                    <CheckCircle2 size={22} />
                  ) : (
                    item.number
                  )}
                </div>

                {item.number !== 3 && (
                  <div
                    className={`h-1 flex-1 rounded-full ${
                      step > item.number
                        ? "bg-gradient-to-r from-blue-600 to-cyan-500"
                        : darkMode
                        ? "bg-white/10"
                        : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 text-center text-sm font-bold">
            {steps.map((item) => (
              <span
                key={item.number}
                className={
                  step >= item.number
                    ? "text-blue-500"
                    : darkMode
                    ? "text-slate-500"
                    : "text-slate-400"
                }
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25">
              <Sparkles size={28} />
            </div>

            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-500">
              <Sparkles size={16} />
              Bắt đầu với Zuny
            </div>

            <h1
              className={`mx-auto max-w-xl text-3xl font-black leading-tight sm:text-4xl ${
                darkMode ? "text-white" : "text-slate-950"
              }`}
            >
              Chào mừng bạn đến với Zuny
            </h1>

            <p
              className={`mx-auto mt-4 max-w-xl text-base leading-7 ${
                darkMode ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Hoàn tất hồ sơ để hệ thống cá nhân hóa trải nghiệm học tập, bài
              kiểm tra và thông tin trường học phù hợp với bạn.
            </p>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-4 font-black text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]"
            >
              Tiếp tục
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="mb-6 text-center">
              <p className="mb-2 text-sm font-black uppercase tracking-[0.25em] text-blue-500">
                Chọn vai trò
              </p>

              <h1
                className={`text-3xl font-black sm:text-4xl ${
                  darkMode ? "text-white" : "text-slate-950"
                }`}
              >
                Bạn là học sinh hay giáo viên?
              </h1>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRole("STUDENT")}
                className={`relative rounded-3xl border-2 p-5 text-left transition hover:-translate-y-1 hover:shadow-xl ${
                  role === "STUDENT"
                    ? "border-blue-500 bg-blue-500/10"
                    : darkMode
                    ? "border-white/10 bg-white/5 hover:border-blue-400/60"
                    : "border-slate-200 bg-white hover:border-blue-400"
                }`}
              >
                {role === "STUDENT" && (
                  <CheckCircle2 className="absolute right-5 top-5 text-blue-500" />
                )}

                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
                  <GraduationCap size={27} />
                </div>

                <h2
                  className={`text-2xl font-black ${
                    darkMode ? "text-white" : "text-slate-950"
                  }`}
                >
                  Học sinh
                </h2>

                <p
                  className={`mt-2 text-sm leading-6 ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Lưu khối học, trường học và khu vực để nhận nội dung học tập
                  phù hợp.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole("TEACHER")}
                className={`relative rounded-3xl border-2 p-5 text-left transition hover:-translate-y-1 hover:shadow-xl ${
                  role === "TEACHER"
                    ? "border-cyan-500 bg-cyan-500/10"
                    : darkMode
                    ? "border-white/10 bg-white/5 hover:border-cyan-400/60"
                    : "border-slate-200 bg-white hover:border-cyan-400"
                }`}
              >
                {role === "TEACHER" && (
                  <CheckCircle2 className="absolute right-5 top-5 text-cyan-500" />
                )}

                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/25">
                  <Users size={27} />
                </div>

                <h2
                  className={`text-2xl font-black ${
                    darkMode ? "text-white" : "text-slate-950"
                  }`}
                >
                  Giáo viên
                </h2>

                <p
                  className={`mt-2 text-sm leading-6 ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Lưu chuyên môn, trường học và thông tin liên hệ để quản lý tốt
                  hơn.
                </p>
              </button>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`w-32 rounded-2xl py-4 font-bold transition ${
                  darkMode
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Quay lại
              </button>

              <button
                type="button"
                disabled={!role}
                onClick={() => setStep(3)}
                className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-4 font-black text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                Tiếp tục
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-5 text-center">
              <p className="mb-2 text-sm font-black uppercase tracking-[0.35em] text-blue-500">
                Hồ sơ cá nhân
              </p>

              <h1
                className={`text-4xl font-black sm:text-5xl ${
                  darkMode ? "text-white" : "text-slate-950"
                }`}
              >
                Hoàn tất thông tin
              </h1>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                placeholder="Họ và tên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />

              <input
                type="text"
                inputMode="numeric"
                placeholder="Số điện thoại"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                maxLength={10}
                className={inputClass}
              />

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />

              {role === "STUDENT" && (
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Chọn khối</option>
                  {gradeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              )}

              {role === "TEACHER" && (
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Chọn chuyên môn</option>
                  {teacherSubjects.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={provinceCode}
                onChange={(e) => handleSelectProvince(e.target.value)}
                className={selectClass}
              >
                <option value="">Chọn tỉnh / thành phố</option>
                {provinces.map((item) => (
                  <option key={item.idProvince} value={item.idProvince}>
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                value={wardCode}
                disabled={!provinceCode}
                onChange={(e) => handleSelectWard(e.target.value)}
                className={`${selectClass} md:col-span-2`}
              >
                <option value="">
                  {!provinceCode
                    ? "Chọn tỉnh / thành phố trước"
                    : "Chọn phường / xã"}
                </option>

                {wards.map((item) => (
                  <option key={item.idWard} value={item.idWard}>
                    {item.name}
                  </option>
                ))}
              </select>

              <div ref={schoolBoxRef} className="relative md:col-span-2">
                <p className="mb-2 px-1 text-xs font-black uppercase tracking-[0.25em] text-blue-500">
                  Trường học
                </p>

                <div className="relative">
                  <input
                    type="text"
                    value={school}
                    disabled={!provinceCode}
                    onFocus={() => setSchoolDropdownOpen(true)}
                    onChange={(e) => {
                      setSchool(e.target.value);
                      setSchoolDropdownOpen(true);
                    }}
                    placeholder={
                      !provinceCode
                        ? "Chọn tỉnh/thành trước"
                        : schools.length > 0
                        ? "Gõ tên trường để tìm"
                        : "Chưa có dữ liệu trường cho tỉnh/thành này"
                    }
                    className={`${inputClass} pr-12`}
                  />

                  <button
                    type="button"
                    disabled={!provinceCode}
                    onClick={() => setSchoolDropdownOpen((prev) => !prev)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition disabled:opacity-40 ${
                      schoolDropdownOpen ? "rotate-180" : ""
                    } ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    <ChevronDown size={22} />
                  </button>
                </div>

                {schoolDropdownOpen && provinceCode && (
                  <div
                    className={`absolute z-50 mt-3 max-h-72 w-full overflow-y-auto rounded-2xl border p-2 shadow-2xl ${
                      darkMode
                        ? "border-white/10 bg-slate-950 text-white shadow-black/40"
                        : "border-slate-200 bg-white text-slate-900 shadow-slate-300/60"
                    }`}
                  >
                    {filteredSchools.length > 0 ? (
                      filteredSchools.map((item) => (
                        <button
                          type="button"
                          key={`${item.school_code || item.name}-${
                            item.ward || ""
                          }`}
                          onClick={() => {
                            handleSelectSchool(item);
                            setSchoolDropdownOpen(false);
                          }}
                          className={`w-full rounded-xl px-4 py-3 text-left transition ${
                            darkMode
                              ? "hover:bg-white/10"
                              : "hover:bg-blue-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                item.matchedWard
                                  ? "bg-blue-600 text-white"
                                  : darkMode
                                  ? "bg-white/10 text-slate-400"
                                  : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {item.matchedWard ? "✓" : ""}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-black">
                                {item.name}
                              </p>

                              <p
                                className={`mt-1 truncate text-sm ${
                                  darkMode
                                    ? "text-slate-400"
                                    : "text-slate-500"
                                }`}
                              >
                                {item.ward || "Chưa có phường/xã"}
                                {item.school_type
                                  ? ` • ${item.school_type}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div
                        className={`px-4 py-5 text-center text-sm ${
                          darkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Không tìm thấy trường phù hợp
                      </div>
                    )}
                  </div>
                )}
              </div>

              <p
                className={`md:col-span-2 -mt-2 px-1 text-sm ${helperTextClass}`}
              >
                Bạn chỉ cần nhập số điện thoại hoặc email. Sau này Zuny sẽ yêu
                cầu xác minh.
              </p>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className={`w-40 rounded-2xl py-5 font-black transition ${
                  darkMode
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Quay lại
              </button>

              <button
                type="button"
                onClick={handleFinish}
                className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-5 font-black text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]"
              >
                <UserRoundCheck size={22} />
                Hoàn tất
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Setup;