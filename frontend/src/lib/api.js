import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true, timeout: 15000 });


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bahiastay_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function fileUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/api/")) return `${BACKEND_URL}${url}`;
  return url;
}
