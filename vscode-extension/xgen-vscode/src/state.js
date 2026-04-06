/**
 * XGEN VS Code Extension — 상태 관리
 *
 * 서버 연결 상태, 인증 상태, 워크플로우 목록 등을 관리한다.
 * 이 모듈은 VS Code API에 의존하지 않아서 어디서든 재사용 가능하다.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const XGEN_DIR = path.join(require('os').homedir(), '.xgen');
const CONFIG_FILE = path.join(XGEN_DIR, 'config.json');
const AUTH_FILE = path.join(XGEN_DIR, 'auth.json');

// ── 설정/인증 파일 읽기 ──

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getConfig() {
  return readJsonFile(CONFIG_FILE) || {};
}

function getAuth() {
  const auth = readJsonFile(AUTH_FILE);
  if (!auth || !auth.accessToken) return null;
  return auth;
}

function getServerUrl() {
  return getConfig().server || null;
}

// ── HTTP 요청 유틸리티 ──

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: 10000,
      // 자체 서명 인증서 허용 (개발 환경)
      rejectUnauthorized: false,
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// ── 서버 상태 확인 ──

async function checkServerHealth(serverUrl) {
  if (!serverUrl) return { online: false, message: '서버 미설정' };

  try {
    const res = await httpRequest(`${serverUrl}/api/health`, { method: 'GET' });
    return {
      online: res.status >= 200 && res.status < 400,
      message: res.status >= 200 && res.status < 400 ? '연결됨' : `상태 코드: ${res.status}`,
      statusCode: res.status,
    };
  } catch (err) {
    return { online: false, message: err.message || '연결 실패' };
  }
}

async function validateToken(serverUrl, accessToken) {
  if (!serverUrl || !accessToken) return { valid: false };

  try {
    const res = await httpRequest(`${serverUrl}/api/auth/validate`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data || { valid: false };
  } catch {
    return { valid: false };
  }
}

async function fetchWorkflowList(serverUrl, accessToken) {
  if (!serverUrl || !accessToken) return [];

  try {
    const res = await httpRequest(`${serverUrl}/api/workflow/list`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ── CLI 존재 여부 확인 ──

function findCliPath(command) {
  const normalized = (command || '').trim();
  if (!normalized) return null;

  // 절대 경로 또는 상대 경로
  if (normalized.includes(path.sep) || normalized.includes('/')) {
    try {
      fs.accessSync(normalized, fs.constants.X_OK);
      return normalized;
    } catch {
      return null;
    }
  }

  // PATH에서 검색
  const pathEnv = process.env.PATH || '';
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, normalized);
    try {
      fs.accessSync(candidate, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

// ── 전체 상태 수집 ──

async function collectXgenState(overrideServerUrl) {
  const config = getConfig();
  const auth = getAuth();
  const serverUrl = overrideServerUrl || config.server || null;

  // CLI 설치 여부
  const cliInstalled = Boolean(findCliPath('xgen'));

  // 서버 연결
  const serverHealth = await checkServerHealth(serverUrl);

  // 토큰 유효성
  let tokenState = { valid: false, username: null, isAdmin: false, userType: null };
  if (auth && serverHealth.online) {
    const validation = await validateToken(serverUrl, auth.accessToken);
    tokenState = {
      valid: validation.valid || false,
      username: validation.username || auth.username || null,
      isAdmin: validation.is_admin || false,
      userType: validation.user_type || null,
    };
  }

  // 워크플로우 목록
  let workflows = [];
  if (tokenState.valid) {
    workflows = await fetchWorkflowList(serverUrl, auth.accessToken);
  }

  return {
    // CLI
    cliInstalled,
    cliCommand: 'xgen',

    // 서버
    serverUrl,
    serverOnline: serverHealth.online,
    serverMessage: serverHealth.message,

    // 인증
    loggedIn: tokenState.valid,
    username: tokenState.username,
    userId: auth?.userId || null,
    isAdmin: tokenState.isAdmin,
    userType: tokenState.userType,

    // 워크플로우
    workflows,
    workflowCount: workflows.length,
  };
}

module.exports = {
  getConfig,
  getAuth,
  getServerUrl,
  checkServerHealth,
  validateToken,
  fetchWorkflowList,
  findCliPath,
  collectXgenState,
};
