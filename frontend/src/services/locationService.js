import {
  getAllProvince,
  getWardsByProvinceId,
} from "new-vn-provinces/provinces";

export const getProvinces = async () => {
  return await getAllProvince();
};

export const getWardsByProvince = async (provinceCode) => {
  if (!provinceCode) return [];
  return await getWardsByProvinceId(provinceCode);
};