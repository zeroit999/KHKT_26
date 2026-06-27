import { schoolModules } from "../data/index.js";

const normalizeText = (value = "") => {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^thanh pho\s+/i, "")
    .replace(/^tinh\s+/i, "");
};

export const getSchoolsByLocation = async (provinceName, wardName) => {
  if (!provinceName) return [];

  const loader = schoolModules[provinceName];

  if (!loader) return [];

  const module = await loader();
  const schools = module.default || [];

  const provinceSchools = schools.filter(
    (school) =>
      normalizeText(school.province) === normalizeText(provinceName) ||
      normalizeText(provinceName).includes(normalizeText(school.province)) ||
      normalizeText(school.province).includes(normalizeText(provinceName))
  );

  if (!wardName) return provinceSchools;

  return provinceSchools
    .map((school) => ({
      ...school,
      matchedWard: normalizeText(school.ward) === normalizeText(wardName),
    }))
    .sort((a, b) => Number(b.matchedWard) - Number(a.matchedWard));
};