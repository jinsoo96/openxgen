/**
 * XGEN API 클라이언트
 * axios 인스턴스 + 토큰 자동 갱신 인터셉터
 */
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import {
  getAccessToken,
  getRefreshToken,
  getServer,
  setAuth,
  getAuth,
  clearAuth,
} from "../config/store.js";

let client: AxiosInstance | null = null;

export function getClient(): AxiosInstance {
  if (client) return client;

  const server = getServer();
  if (!server) {
    throw new Error("서버가 설정되지 않았습니다. xgen config set-server <url>");
  }

  client = axios.create({
    baseURL: server,
    timeout: 120_000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request 인터셉터: 토큰 자동 추가
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response 인터셉터: 401 시 토큰 갱신
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        getRefreshToken()
      ) {
        originalRequest._retry = true;

        try {
          const refreshToken = getRefreshToken()!;
          const server = getServer()!;
          const res = await axios.post(`${server}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });

          if (res.data.success && res.data.access_token) {
            const auth = getAuth()!;
            setAuth({
              ...auth,
              accessToken: res.data.access_token,
            });

            originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
            return client!(originalRequest);
          }
        } catch {
          clearAuth();
          console.error("\n세션이 만료되었습니다. 다시 로그인하세요: xgen login");
          process.exit(1);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

/** 클라이언트 리셋 (서버 변경 시) */
export function resetClient(): void {
  client = null;
}
