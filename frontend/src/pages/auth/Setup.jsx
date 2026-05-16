import React, { useEffect, useState } from "react";
import { auth, db } from "../../components/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";

const teacherSubjects = [
  "Toán",
  "Vật lý",
  "Hóa học",
  "Sinh học",
  "Tin học",
  "Ngữ văn",
  "Lịch sử",
  "Địa lý",
  "Tiếng Anh",
  "Công nghệ",
  "Quốc phòng - An ninh",
  "Trải nghiệm hướng nghiệp",
  "Giáo dục địa phương",
  "Giáo dục thể chất",
  "Giáo dục Kinh tế và Pháp luật",
];

const provinces = [
  "Thành phố Hà Nội",
  "Thành phố Hải Phòng",
  "Thành phố Huế",
  "Thành phố Đà Nẵng",
  "Thành phố Hồ Chí Minh",
  "Thành phố Cần Thơ",
  "Thành phố Đồng Nai",
  "An Giang",
  "Bắc Ninh",
  "Cà Mau",
  "Cao Bằng",
  "Đắk Lắk",
  "Điện Biên",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Tĩnh",
  "Hưng Yên",
  "Khánh Hòa",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Nghệ An",
  "Ninh Bình",
  "Phú Thọ",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sơn La",
  "Tây Ninh",
  "Thái Nguyên",
  "Thanh Hóa",
  "Tuyên Quang",
  "Vĩnh Long",
];

function Setup() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");

  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [phone, setPhone] = useState("");
  const [facebook, setFacebook] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [subject, setSubject] = useState("");

  const navigate = useNavigate();

  const { refreshUserData } = useAuth();

  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains("dark")
  );

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

  const handleFinish = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        toast.error("Bạn chưa đăng nhập");
        return;
      }

      if (!role || !fullName || !school || !phone || !city) {
        toast.error("Vui lòng nhập đầy đủ thông tin");
        return;
      }

      if (phone.length !== 10) {
        toast.error("Số điện thoại phải gồm đúng 10 số");
        return;
      }

      if (role === "STUDENT" && !grade) {
        toast.error("Vui lòng chọn khối");
        return;
      }

      if (role === "TEACHER" && !subject) {
        toast.error("Vui lòng chọn chuyên môn");
        return;
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email || "",
          photoURL: user.photoURL || "",
          avatar: user.photoURL || "",
          role,
          fullName,
          name: fullName,
          school,
          grade: role === "STUDENT" ? grade : "",
          className: "",
          subject: role === "TEACHER" ? subject : "",
          phone,
          facebook,
          city,
          address,
          points: 0,
          learningStreak: 0,
          isSetupComplete: true,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // REFRESH USER DATA
      await refreshUserData(user);

      toast.success("Hoàn tất thiết lập");

      navigate("/", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  const inputClass = `w-full rounded-2xl border px-4 py-3 outline-none transition ${
    darkMode
      ? "border-white/10 bg-slate-900/70 text-white focus:border-cyan-400"
      : "border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500"
  }`;

  const selectClass = `${inputClass} appearance-none`;

  return (
    <div
      className={`flex min-h-screen items-center justify-center px-4 py-10 transition-colors duration-300 ${
        darkMode ? "bg-[#020817]" : "bg-slate-100"
      }`}
    >
      <div
        className={`w-full max-w-2xl rounded-3xl border p-8 shadow-2xl backdrop-blur-xl transition-colors duration-300 ${
          darkMode
            ? "border-white/10 bg-slate-950/80"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="mb-10 flex items-center justify-between">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex flex-1 items-center">
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

        {step === 1 && (
          <div>
            <h1
              className={`mb-4 text-4xl font-black ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Chào mừng 👋
            </h1>

            <p
              className={`mb-8 ${
                darkMode ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Hoàn tất vài bước để bắt đầu sử dụng EduSprint.
            </p>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full rounded-2xl bg-blue-600 py-4 font-semibold text-white transition hover:bg-blue-700"
            >
              Tiếp tục
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1
              className={`mb-4 text-4xl font-black ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Bạn là ai?
            </h1>

            <div className="mb-8 grid grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => setRole("STUDENT")}
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
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  Học sinh
                </h2>
              </button>

              <button
                type="button"
                onClick={() => setRole("TEACHER")}
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
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  Giáo viên
                </h2>
              </button>
            </div>

            <button
              type="button"
              disabled={!role}
              onClick={() => setStep(3)}
              className="w-full rounded-2xl bg-blue-600 py-4 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              Tiếp tục
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1
              className={`mb-6 text-4xl font-black ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Thông tin cá nhân
            </h1>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Họ và tên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />

              <input
                type="text"
                placeholder="Trường"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className={inputClass}
              />

              {role === "STUDENT" && (
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Chọn khối</option>
                  <option value="10">Khối 10</option>
                  <option value="11">Khối 11</option>
                  <option value="12">Khối 12</option>
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

              <input
                type="text"
                inputMode="numeric"
                placeholder="Số điện thoại"
                value={phone}
                onChange={(e) => {
                  const onlyNumbers = e.target.value.replace(/\D/g, "");

                  if (onlyNumbers.length <= 10) {
                    setPhone(onlyNumbers);
                  }
                }}
                maxLength={10}
                className={inputClass}
              />

              <input
                type="text"
                placeholder="Facebook"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className={inputClass}
              />

              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={selectClass}
              >
                <option value="">Chọn tỉnh / thành phố</option>
                {provinces.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Địa chỉ"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="button"
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