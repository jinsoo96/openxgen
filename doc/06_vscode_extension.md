# XGEN VS Code Extension 설계

## OpenClaude 패턴 분석 & 적용

### 핵심: 3-파일 아키텍처
OpenClaude가 쓰는 패턴의 핵심은 **관심사 분리**:

```
state.js        — 데이터 수집 (순수 Node.js, VS Code 의존 없음)
presentation.js — 뷰모델 변환 (순수 JS, 어디서든 재사용)
extension.js    — VS Code 바인딩 (커맨드, 웹뷰, 터미널)
```

**왜 이게 좋은가**: `state.js`와 `presentation.js`는 VS Code 없이도 동작한다.
→ 웹 프론트, Electron 앱, JetBrains 플러그인, CLI의 TUI 등 어디든 붙일 수 있음.

### XGEN에 적용한 구조

| 파일 | OpenClaude | XGEN |
|------|-----------|------|
| `state.js` | 프로바이더 감지, 프로필 파싱, CLI 경로 확인 | **서버 연결, 인증 검증, 워크플로우 목록 조회** |
| `presentation.js` | 프로바이더 라벨, 런타임 상태, 액션 모델 | **대시보드 뷰모델, 워크플로우 목록, 상태 뱃지** |
| `extension.js` | 터미널 실행, 웹뷰 HTML, 커맨드 등록 | **터미널 CLI 실행, 대시보드 웹뷰, QuickPick** |

## Extension 기능

### 사이드바 대시보드 (Activity Bar)
- 서버 연결 상태 (온라인/오프라인)
- 인증 상태 (로그인됨/미로그인)
- CLI 설치 상태
- 워크플로우 목록 (클릭 → 바로 실행)
- 액션 버튼: CLI 실행, 채팅, 로그인, 서버 설정

### 커맨드 팔레트
| 커맨드 | 설명 |
|--------|------|
| `XGEN: CLI 실행` | 터미널에서 `xgen` 실행 |
| `XGEN: 채팅 모드 실행` | `xgen chat` 실행 |
| `XGEN: 워크플로우 실행` | QuickPick으로 선택 → 입력 → 실행 |
| `XGEN: 로그인` | `xgen login` 실행 |
| `XGEN: 서버 URL 설정` | URL 입력 → `xgen config set-server` |
| `XGEN: 대시보드 열기` | 사이드바 패널 포커스 |

### VS Code 설정
```json
{
  "xgen.serverUrl": "https://xgen.x2bee.com",
  "xgen.cliCommand": "xgen",
  "xgen.terminalName": "XGEN"
}
```

## 재사용 포인트

### state.js를 다른 곳에서 쓰려면:
```js
const { collectXgenState } = require('./state');

// 어디서든 XGEN 상태 수집
const state = await collectXgenState('https://xgen.x2bee.com');
console.log(state.serverOnline);  // true
console.log(state.workflows);     // [{id, workflow_name, ...}, ...]
```

### presentation.js를 다른 곳에서 쓰려면:
```js
const { buildDashboardViewModel } = require('./presentation');

// 상태 → 뷰모델 변환
const viewModel = buildDashboardViewModel(state);
// viewModel.badges, viewModel.workflows, viewModel.actions 등
// → React, Vue, Svelte, 터미널 TUI 어디든 렌더링 가능
```

## 빌드 & 테스트

```bash
cd vscode-extension/xgen-vscode

# VS Code에서 디버그:
# F5 누르면 Extension Development Host 실행

# VSIX 패키징:
npx @vscode/vsce package --no-dependencies
# → xgen-vscode-0.1.0.vsix 생성

# 설치:
code --install-extension xgen-vscode-0.1.0.vsix
```

## 파일 구조

```
vscode-extension/xgen-vscode/
├── .vscode/launch.json     # 디버그 설정
├── media/xgen.svg          # Activity Bar 아이콘
├── src/
│   ├── extension.js        # VS Code 바인딩 (362줄)
│   ├── state.js            # 상태 수집 — 재사용 가능 (170줄)
│   └── presentation.js     # 뷰모델 — 재사용 가능 (105줄)
└── package.json            # Extension manifest
```
