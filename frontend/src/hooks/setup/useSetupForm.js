import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";

import { normalizeGrade } from "../../utils/gradeUtils";

import { getProvinces, getWardsByProvince } from "../../services/locationService";

import { saveUserProfile } from "../../services/userService";

import { getSchoolsByLocation } from "../../services/schoolService";

export const teacherSubjects = [
  "Toán",
  "Vật lí",
  "Hóa học",
  "Sinh học",
  "Tin học",
  "Ngữ văn",
  "Lịch sử",
  "Địa lí",
  "Tiếng Anh",
  "Công nghệ",
  "Quốc phòng - An ninh",
  "Trải nghiệm hướng nghiệp",
  "Giáo dục địa phương",
  "Giáo dục thể chất",
  "Giáo dục Kinh tế và Pháp luật",
];

export const gradeOptions = [
  { value: "10", label: "Khối 10" },
  { value: "11", label: "Khối 11" },
  { value: "12", label: "Khối 12" },
];

const normalizeText = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function useSetupForm() {
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuth();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");

  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [schools, setSchools] = useState([]);
  const [grade, setGrade] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");

  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);

  const [provinceCode, setProvinceCode] = useState("");
  const [city, setCity] = useState("");
  const [wardCode, setWardCode] = useState("");
  const [ward, setWard] = useState("");

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const data = await getProvinces();
        setProvinces(data || []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được danh sách tỉnh/thành");
      }
    };

    loadProvinces();
  }, []);

  useEffect(() => {
    const loadWards = async () => {
      try {
        if (!provinceCode) {
          setWards([]);
          return;
        }

        const data = await getWardsByProvince(provinceCode);
        setWards(data || []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được danh sách phường/xã");
      }
    };

    loadWards();
  }, [provinceCode]);

  useEffect(() => {
    const loadSchools = async () => {
      try {
        if (!city) {
          setSchools([]);
          return;
        }

        const data = await getSchoolsByLocation(city, ward);
        setSchools(data || []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được danh sách trường");
      }
    };

    loadSchools();
  }, [city, ward]);

  const handleSelectProvince = (selectedCode) => {
    const selectedProvince = provinces.find(
      (item) => String(item.idProvince) === String(selectedCode)
    );

    setProvinceCode(selectedCode);
    setCity(selectedProvince?.name || "");

    setWardCode("");
    setWard("");
    setSchool("");
    setSchools([]);
  };

  const handleSelectWard = (selectedCode) => {
    const selectedWard = wards.find(
      (item) => String(item.idWard) === String(selectedCode)
    );

    const nextWardName = selectedWard?.name || "";

    setWardCode(selectedCode);
    setWard(nextWardName);

    if (!school) return;

    const selectedSchool = schools.find(
      (item) => normalizeText(item.name) === normalizeText(school)
    );

    if (!selectedSchool) {
      setSchool("");
      return;
    }

    const schoolWardExistsInNewWardList = wards.some(
      (item) => normalizeText(item.name) === normalizeText(selectedSchool.ward)
    );

    if (!schoolWardExistsInNewWardList) {
      setSchool("");
      return;
    }

    if (normalizeText(selectedSchool.ward) !== normalizeText(nextWardName)) {
      setSchool("");
    }
  };

  const handleSelectSchool = (selectedSchool) => {
    if (!selectedSchool) return;

    setSchool(selectedSchool.name || "");

    if (!selectedSchool.ward) {
      setWardCode("");
      setWard("");
      return;
    }

    const matchedWard = wards.find(
      (item) => normalizeText(item.name) === normalizeText(selectedSchool.ward)
    );

    if (matchedWard) {
      setWardCode(matchedWard.idWard);
      setWard(matchedWard.name);
      return;
    }

    setWardCode("");
    setWard("");
  };

  const handlePhoneChange = (value) => {
    const onlyNumbers = value.replace(/\D/g, "");

    if (onlyNumbers.length <= 10) {
      setPhone(onlyNumbers);
    }
  };

  const handleFinish = async () => {
    try {
      if (!user) {
        toast.error("Bạn chưa đăng nhập");
        return;
      }

      const finalEmail = user.email || email.trim();

      const selectedSchool = schools.find(
        (item) => normalizeText(item.name) === normalizeText(school)
      );

      if (!role || !fullName || !city || !provinceCode) {
        toast.error("Vui lòng nhập đầy đủ thông tin");
        return;
      }

      if (!phone && !finalEmail) {
        toast.error("Vui lòng nhập số điện thoại hoặc email");
        return;
      }

      if (school.trim() && !selectedSchool) {
        toast.error("Vui lòng chọn trường trong danh sách");
        return;
      }

      if (phone && phone.length !== 10) {
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

      const normalizedGrade =
        role === "STUDENT" ? normalizeGrade(grade) : "";

      const studentClassName = normalizedGrade
        ? `Khối ${normalizedGrade}`
        : "";

      const userData = {
        uid: user.uid,
        email: finalEmail,
        photoURL: user.photoURL || "",
        avatar: user.photoURL || "",

        role,
        fullName: fullName.trim(),
        name: fullName.trim(),

        school: selectedSchool?.name || "",
        schoolCode: selectedSchool?.school_code || "",
        schoolType: selectedSchool?.school_type || "",
        schoolAddress: selectedSchool?.address || "",
        schoolWard: selectedSchool?.ward || "",

        grade: normalizedGrade,
        khoi: normalizedGrade,
        gradeLevel: normalizedGrade,
        studentGrade: normalizedGrade,

        className: role === "STUDENT" ? studentClassName : "",
        studentClass: role === "STUDENT" ? studentClassName : "",
        classes:
          role === "STUDENT" && studentClassName
            ? [studentClassName]
            : [],

        subject: role === "TEACHER" ? subject : "",
        teacherSubject: role === "TEACHER" ? subject : "",

        phone: phone || "",

        isPhoneVerified: false,
        isEmailVerified: !!user.email,

        city,
        provinceCode,
        ward: ward || "",
        wardCode: wardCode || "",

        points: 0,
        learningStreak: 0,
        isSetupComplete: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await saveUserProfile(user.uid, userData);
      await refreshUserData(user);

      toast.success("Hoàn tất thiết lập");
      navigate("/", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  return {
    step,
    setStep,

    role,
    setRole,

    fullName,
    setFullName,
    school,
    setSchool,
    schools,
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
    city,
    wardCode,

    handleSelectProvince,
    handleSelectWard,
    handleSelectSchool,
    handlePhoneChange,
    handleFinish,
  };
}