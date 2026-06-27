export const normalizeGrade = (value = "") => {
  const match = String(value).match(/10|11|12/);
  return match ? match[0] : "";
};