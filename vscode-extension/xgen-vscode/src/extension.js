/**
 * XGEN VS Code Extension — 진입점
 *
 * OpenClaude의 3-파일 패턴을 따른다:
 *   state.js      — 데이터 수집 (서버, 인증, CLI 상태)
 *   presentation.js — 뷰모델 변환 (UI에 뿌릴 데이터 구조)
 *   extension.js   — VS Code 바인딩 (커맨드, 웹뷰, 터미널)
 *
 * 이 구조 덕분에 state + presentation은 VS Code 없이도 쓸 수 있다.
 * → 웹 프론트, Electron 앱, 다른 IDE 플러그인에 그대로 가져다 붙일 수 있음.
 */
const vscode = require('vscode');
const crypto = require('crypto');
const { collectXgenState, findCliPath, getServerUrl } = require('./state');
const { buildDashboardViewModel } = require('./presentation');

// ── HTML 유틸 ──

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 터미널 실행 ──

function launchInTerminal(command, args = '') {
  const config = vscode.workspace.getConfiguration('xgen');
  const terminalName = config.get('terminalName', 'XGEN');
  const cliCommand = config.get('cliCommand', 'xgen');

  const fullCommand = args ? `${cliCommand} ${args}` : cliCommand;

  const terminal = vscode.window.createTerminal({ name: terminalName });
  terminal.show(true);
  terminal.sendText(fullCommand, true);
}

// ── 워크플로우 실행 ──

async function runWorkflow() {
  const state = await collectXgenState(
    vscode.workspace.getConfiguration('xgen').get('serverUrl')
  );

  if (!state.loggedIn) {
    vscode.window.showWarningMessage('XGEN에 로그인이 필요합니다. xgen login 을 먼저 실행하세요.');
    return;
  }

  if (state.workflows.length === 0) {
    vscode.window.showInformationMessage('사용 가능한 워크플로우가 없습니다.');
    return;
  }

  // 워크플로우 선택 QuickPick
  const items = state.workflows.map((wf) => ({
    label: wf.workflow_name || wf.id,
    description: wf.deploy_status === 'deployed' ? '배포됨' : '',
    detail: wf.description || '',
    workflowId: wf.id,
    workflowName: wf.workflow_name,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '실행할 워크플로우를 선택하세요',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!selected) return;

  // 입력값 프롬프트
  const input = await vscode.window.showInputBox({
    prompt: `"${selected.label}" 워크플로우에 보낼 입력값`,
    placeHolder: '질문이나 명령을 입력하세요...',
  });

  if (input === undefined) return; // 취소

  // CLI로 실행
  launchInTerminal('xgen', `workflow run "${selected.workflowId}" "${input}"`);
}

// ── 대시보드 웹뷰 HTML ──

function renderDashboardHtml(viewModel, nonce) {
  const badgesHtml = viewModel.badges
    .map(
      (b) =>
        `<div class="badge tone-${b.tone}">
          <span class="badge-label">${escapeHtml(b.label)}</span>
          <span class="badge-value">${escapeHtml(b.value)}</span>
        </div>`
    )
    .join('');

  const cardsHtml = viewModel.summaryCards
    .map(
      (c) =>
        `<div class="card">
          <div class="card-label">${escapeHtml(c.label)}</div>
          <div class="card-value" title="${escapeHtml(c.value)}">${escapeHtml(c.value)}</div>
          ${c.detail ? `<div class="card-detail">${escapeHtml(c.detail)}</div>` : ''}
        </div>`
    )
    .join('');

  const workflowsHtml =
    viewModel.workflows.length > 0
      ? viewModel.workflows
          .map(
            (wf) =>
              `<button class="wf-item" data-id="${escapeHtml(wf.id)}" data-name="${escapeHtml(wf.name)}">
                <span class="wf-name">${escapeHtml(wf.name)}</span>
                ${wf.deployed ? '<span class="wf-badge-deployed">배포</span>' : ''}
              </button>`
          )
          .join('')
      : '<div class="empty">워크플로우 없음</div>';

  const actionsHtml = Object.values(viewModel.actions)
    .map(
      (a) =>
        `<button class="action-btn" id="${escapeHtml(a.id)}" ${a.disabled ? 'disabled' : ''}>
          <span class="action-label">${escapeHtml(a.label)}</span>
          <span class="action-detail">${escapeHtml(a.detail)}</span>
        </button>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    :root {
      --xg-bg: var(--vscode-sideBar-background, #1e1e1e);
      --xg-fg: var(--vscode-foreground, #cccccc);
      --xg-fg-dim: var(--vscode-descriptionForeground, #999);
      --xg-border: var(--vscode-panel-border, #333);
      --xg-accent: #4fc3f7;
      --xg-positive: #66bb6a;
      --xg-warning: #ffa726;
      --xg-critical: #ef5350;
    }
    * { box-sizing: border-box; margin: 0; }
    body {
      padding: 12px;
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--xg-fg);
      background: var(--xg-bg);
      font-size: 12px;
      line-height: 1.5;
    }
    .shell { display: grid; gap: 14px; }
    .header {
      padding: 14px;
      border-radius: 10px;
      background: var(--vscode-editor-background, #252526);
      border: 1px solid var(--xg-border);
    }
    .header h1 { font-size: 16px; font-weight: 700; color: var(--xg-accent); }
    .header p { font-size: 11px; color: var(--xg-fg-dim); margin-top: 2px; }
    .badge-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
    .badge {
      display: flex; gap: 4px; align-items: center;
      padding: 4px 8px; border-radius: 999px; font-size: 11px;
      border: 1px solid var(--xg-border);
      background: rgba(255,255,255,0.03);
    }
    .badge-label { color: var(--xg-fg-dim); }
    .badge-value { font-weight: 600; }
    .tone-positive .badge-value { color: var(--xg-positive); }
    .tone-warning .badge-value { color: var(--xg-warning); }
    .tone-critical .badge-value { color: var(--xg-critical); }
    .cards { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
    .card {
      padding: 10px;
      border-radius: 8px;
      background: var(--vscode-editor-background, #252526);
      border: 1px solid var(--xg-border);
    }
    .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--xg-fg-dim); }
    .card-value { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-detail { font-size: 10px; color: var(--xg-fg-dim); }
    .section-title {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--xg-fg-dim); margin-bottom: 6px; padding-top: 4px;
    }
    .wf-list { display: grid; gap: 4px; max-height: 300px; overflow-y: auto; }
    .wf-item {
      display: flex; align-items: center; gap: 6px;
      width: 100%; padding: 8px 10px; text-align: left;
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--xg-border);
      border-radius: 6px; color: var(--xg-fg); cursor: pointer;
      font: inherit; font-size: 12px;
    }
    .wf-item:hover { background: rgba(79, 195, 247, 0.08); border-color: var(--xg-accent); }
    .wf-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wf-badge-deployed {
      font-size: 9px; padding: 1px 6px; border-radius: 999px;
      background: rgba(102, 187, 106, 0.15); color: var(--xg-positive);
      border: 1px solid rgba(102, 187, 106, 0.3);
    }
    .empty { padding: 12px; text-align: center; color: var(--xg-fg-dim); font-size: 11px; }
    .actions { display: grid; gap: 6px; }
    .action-btn {
      width: 100%; display: grid; gap: 2px;
      padding: 10px; text-align: left;
      border: 1px solid var(--xg-border);
      border-radius: 8px; cursor: pointer;
      background: rgba(255,255,255,0.02);
      color: var(--xg-fg); font: inherit;
    }
    .action-btn:hover:enabled { background: rgba(79, 195, 247, 0.06); border-color: var(--xg-accent); }
    .action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .action-label { font-size: 12px; font-weight: 600; }
    .action-detail { font-size: 10px; color: var(--xg-fg-dim); }
    .refresh-row { display: flex; justify-content: flex-end; }
    .refresh-btn {
      padding: 4px 10px; border: 1px solid var(--xg-border);
      border-radius: 999px; background: transparent;
      color: var(--xg-fg-dim); cursor: pointer; font-size: 11px;
    }
    .refresh-btn:hover { border-color: var(--xg-accent); color: var(--xg-accent); }
  </style>
</head>
<body>
  <div class="shell">
    <header class="header">
      <h1>${escapeHtml(viewModel.header.title)}</h1>
      <p>${escapeHtml(viewModel.header.subtitle)}</p>
      <div class="badge-row">${badgesHtml}</div>
    </header>

    <section class="cards">${cardsHtml}</section>

    <div class="refresh-row">
      <button class="refresh-btn" id="refresh">새로고침</button>
    </div>

    <div>
      <div class="section-title">워크플로우</div>
      <div class="wf-list">${workflowsHtml}</div>
    </div>

    <div>
      <div class="section-title">액션</div>
      <div class="actions">${actionsHtml}</div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // 액션 버튼
    ['launch','chat','login','setServer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => vscode.postMessage({ type: id }));
    });

    // 새로고침
    document.getElementById('refresh').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    // 워크플로우 클릭 → 실행
    document.querySelectorAll('.wf-item').forEach(el => {
      el.addEventListener('click', () => {
        vscode.postMessage({
          type: 'runWorkflow',
          workflowId: el.dataset.id,
          workflowName: el.dataset.name,
        });
      });
    });
  </script>
</body>
</html>`;
}

// ── 대시보드 WebviewViewProvider ──

class XgenDashboardProvider {
  constructor() {
    this.webviewView = null;
  }

  async resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.onDidDispose(() => {
      if (this.webviewView === webviewView) this.webviewView = null;
    });

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message?.type) {
        case 'launch':
          launchInTerminal('xgen');
          break;

        case 'chat':
          launchInTerminal('xgen', 'chat');
          break;

        case 'login':
          launchInTerminal('xgen', 'login');
          break;

        case 'setServer': {
          const url = await vscode.window.showInputBox({
            prompt: 'XGEN 서버 URL',
            placeHolder: 'https://xgen.x2bee.com',
            value: getServerUrl() || '',
          });
          if (url) {
            launchInTerminal('xgen', `config set-server "${url}"`);
            // 잠시 대기 후 새로고침
            setTimeout(() => this.refresh(), 2000);
          }
          break;
        }

        case 'runWorkflow': {
          const input = await vscode.window.showInputBox({
            prompt: `"${message.workflowName}" 에 보낼 입력값`,
            placeHolder: '질문을 입력하세요...',
          });
          if (input !== undefined) {
            launchInTerminal('xgen', `workflow run "${message.workflowId}" "${input}"`);
          }
          break;
        }

        case 'refresh':
        default:
          break;
      }

      await this.refresh();
    });

    await this.refresh();
  }

  async refresh() {
    if (!this.webviewView) return;

    try {
      const serverUrl = vscode.workspace.getConfiguration('xgen').get('serverUrl');
      const state = await collectXgenState(serverUrl || undefined);
      const viewModel = buildDashboardViewModel(state);
      const nonce = crypto.randomBytes(16).toString('base64');
      this.webviewView.webview.html = renderDashboardHtml(viewModel, nonce);
    } catch (error) {
      const nonce = crypto.randomBytes(16).toString('base64');
      const msg = error instanceof Error ? error.message : '알 수 없는 오류';
      this.webviewView.webview.html = `<!DOCTYPE html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"/>
<style>body{padding:16px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);}</style>
</head><body>
<p style="color:var(--vscode-errorForeground)">대시보드 오류: ${escapeHtml(msg)}</p>
<button id="r" style="margin-top:8px;padding:6px 12px;">새로고침</button>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
document.getElementById('r').addEventListener('click',()=>vscode.postMessage({type:'refresh'}));
</script></body></html>`;
    }
  }
}

// ── activate / deactivate ──

function activate(context) {
  const provider = new XgenDashboardProvider();
  const refreshDashboard = () => void provider.refresh();

  context.subscriptions.push(
    // 커맨드 등록
    vscode.commands.registerCommand('xgen.launch', () => launchInTerminal('xgen')),
    vscode.commands.registerCommand('xgen.chat', () => launchInTerminal('xgen', 'chat')),
    vscode.commands.registerCommand('xgen.workflowRun', () => runWorkflow()),
    vscode.commands.registerCommand('xgen.login', () => launchInTerminal('xgen', 'login')),
    vscode.commands.registerCommand('xgen.openDashboard', () =>
      vscode.commands.executeCommand('workbench.view.extension.xgen')
    ),
    vscode.commands.registerCommand('xgen.setServer', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'XGEN 서버 URL',
        placeHolder: 'https://xgen.x2bee.com',
      });
      if (url) {
        launchInTerminal('xgen', `config set-server "${url}"`);
        setTimeout(refreshDashboard, 2000);
      }
    }),

    // 대시보드 웹뷰
    vscode.window.registerWebviewViewProvider('xgen.dashboard', provider),

    // 설정 변경 시 새로고침
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('xgen')) refreshDashboard();
    }),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  XgenDashboardProvider,
  renderDashboardHtml,
};
