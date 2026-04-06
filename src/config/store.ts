/**
 * XGEN CLI 설정 저장소
 * ~/.xgen/ 디렉토리에 설정과 인증 정보를 관리
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const XGEN_DIR = join(homedir(), ".xgen");
const CONFIG_FILE = join(XGEN_DIR, "config.json");
const AUTH_FILE = join(XGEN_DIR, "auth.json");
const PROVIDERS_FILE = join(XGEN_DIR, "providers.json");

export interface XgenConfig {
  server: string | null;
  defaultWorkflow: string | null;
  theme: string;
  streamLogs: boolean;
}

export interface XgenAuth {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
  isAdmin: boolean;
  expiresAt: string | null;
}

const DEFAULT_CONFIG: XgenConfig = {
  server: null,
  defaultWorkflow: null,
  theme: "default",
  streamLogs: false,
};

function ensureDir(): void {
  if (!existsSync(XGEN_DIR)) {
    mkdirSync(XGEN_DIR, { recursive: true, mode: 0o700 });
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    const data = readFileSync(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown, secure = false): void {
  ensureDir();
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  if (secure) {
    chmodSync(filePath, 0o600);
  }
}

// ── Config ──

export function getConfig(): XgenConfig {
  return { ...DEFAULT_CONFIG, ...readJson(CONFIG_FILE, {}) };
}

export function setConfig(partial: Partial<XgenConfig>): void {
  const current = getConfig();
  writeJson(CONFIG_FILE, { ...current, ...partial });
}

export function getServer(): string | null {
  return getConfig().server;
}

export function setServer(url: string): void {
  // URL 정규화: 끝의 / 제거
  const normalized = url.replace(/\/+$/, "");
  setConfig({ server: normalized });
}

// ── Auth ──

export function getAuth(): XgenAuth | null {
  const auth = readJson<XgenAuth | null>(AUTH_FILE, null);
  if (!auth || !auth.accessToken) return null;
  return auth;
}

export function setAuth(auth: XgenAuth): void {
  writeJson(AUTH_FILE, auth, true);
}

export function clearAuth(): void {
  writeJson(AUTH_FILE, {}, true);
}

export function getAccessToken(): string | null {
  return getAuth()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return getAuth()?.refreshToken ?? null;
}

// ── Providers ──

export interface ProviderConfig {
  id: string;
  name: string;
  type: "openai" | "gemini" | "ollama" | "anthropic" | "custom";
  baseUrl?: string;
  apiKey: string;
  model: string;
}

interface ProvidersStore {
  providers: ProviderConfig[];
  defaultId: string | null;
}

const DEFAULT_PROVIDERS: ProvidersStore = { providers: [], defaultId: null };

export function getProvidersStore(): ProvidersStore {
  return { ...DEFAULT_PROVIDERS, ...readJson(PROVIDERS_FILE, DEFAULT_PROVIDERS) };
}

export function getProviders(): ProviderConfig[] {
  return getProvidersStore().providers;
}

export function addProvider(provider: ProviderConfig): void {
  const store = getProvidersStore();
  store.providers = store.providers.filter((p) => p.id !== provider.id);
  store.providers.push(provider);
  store.defaultId = provider.id;  // 항상 새로 추가한 걸 기본으로
  writeJson(PROVIDERS_FILE, store, true);
}

export function removeProvider(id: string): boolean {
  const store = getProvidersStore();
  const before = store.providers.length;
  store.providers = store.providers.filter((p) => p.id !== id);
  if (store.defaultId === id) {
    store.defaultId = store.providers[0]?.id ?? null;
  }
  writeJson(PROVIDERS_FILE, store, true);
  return store.providers.length < before;
}

export function getDefaultProvider(): ProviderConfig | null {
  const store = getProvidersStore();
  if (!store.defaultId) return store.providers[0] ?? null;
  return store.providers.find((p) => p.id === store.defaultId) ?? null;
}

export function setDefaultProvider(id: string): boolean {
  const store = getProvidersStore();
  const exists = store.providers.some((p) => p.id === id);
  if (!exists) return false;
  store.defaultId = id;
  writeJson(PROVIDERS_FILE, store, true);
  return true;
}

// ── Environments ──

export interface XgenEnvironment {
  id: string;
  name: string;
  url: string;
  email?: string;
  description?: string;
}

const ENVIRONMENTS_FILE = join(XGEN_DIR, "environments.json");

interface EnvStore {
  environments: XgenEnvironment[];
  activeId: string | null;
}

const DEFAULT_ENV_STORE: EnvStore = { environments: [], activeId: null };

export function getEnvStore(): EnvStore {
  return { ...DEFAULT_ENV_STORE, ...readJson(ENVIRONMENTS_FILE, DEFAULT_ENV_STORE) };
}

export function getEnvironments(): XgenEnvironment[] {
  return getEnvStore().environments;
}

export function addEnvironment(env: XgenEnvironment): void {
  const store = getEnvStore();
  store.environments = store.environments.filter((e) => e.id !== env.id);
  store.environments.push(env);
  if (!store.activeId) store.activeId = env.id;
  writeJson(ENVIRONMENTS_FILE, store);
}

export function removeEnvironment(id: string): boolean {
  const store = getEnvStore();
  const before = store.environments.length;
  store.environments = store.environments.filter((e) => e.id !== id);
  if (store.activeId === id) store.activeId = store.environments[0]?.id ?? null;
  writeJson(ENVIRONMENTS_FILE, store);
  return store.environments.length < before;
}

export function switchEnvironment(id: string): boolean {
  const store = getEnvStore();
  const env = store.environments.find((e) => e.id === id);
  if (!env) return false;
  store.activeId = id;
  writeJson(ENVIRONMENTS_FILE, store);
  // 서버 URL도 같이 변경
  setServer(env.url);
  return true;
}

export function getActiveEnvironment(): XgenEnvironment | null {
  const store = getEnvStore();
  if (!store.activeId) return null;
  return store.environments.find((e) => e.id === store.activeId) ?? null;
}

// ── Helpers ──

export function requireServer(): string {
  const server = getServer();
  if (!server) {
    console.error("서버가 설정되지 않았습니다. 먼저 실행하세요:");
    console.error("  xgen config set-server <url>");
    process.exit(1);
  }
  return server;
}

export function requireAuth(): XgenAuth {
  const auth = getAuth();
  if (!auth) {
    console.error("로그인이 필요합니다. 먼저 실행하세요:");
    console.error("  xgen login");
    process.exit(1);
  }
  return auth;
}
