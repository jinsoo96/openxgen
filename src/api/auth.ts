/**
 * 인증 API
 */
import axios from "axios";
import { createHash } from "node:crypto";
import { getServer } from "../config/store.js";

export interface LoginResult {
  success: boolean;
  message: string;
  access_token?: string;
  refresh_token?: string;
  token_type: string;
  user_id?: string;
  username?: string;
}

export interface ValidateResult {
  valid: boolean;
  user_id?: string;
  username?: string;
  is_admin?: boolean;
  user_type?: string;
  available_user_sections?: string;
  new_access_token?: string;
}

export async function apiLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  const server = getServer();
  if (!server) throw new Error("서버가 설정되지 않았습니다");

  const hashedPassword = createHash("sha256").update(password).digest("hex");

  const res = await axios.post(`${server}/api/auth/login`, {
    email,
    password: hashedPassword,
  });

  return res.data;
}

export async function apiValidate(
  accessToken: string
): Promise<ValidateResult> {
  const server = getServer();
  if (!server) throw new Error("서버가 설정되지 않았습니다");

  const res = await axios.get(`${server}/api/auth/validate`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return res.data;
}

export async function apiRefresh(
  refreshToken: string
): Promise<{ success: boolean; access_token?: string }> {
  const server = getServer();
  if (!server) throw new Error("서버가 설정되지 않았습니다");

  const res = await axios.post(`${server}/api/auth/refresh`, {
    refresh_token: refreshToken,
  });

  return res.data;
}
