/**
 * XGEN VS Code Extension — 프레젠테이션 (뷰모델)
 *
 * 상태 데이터를 UI 렌더링 가능한 뷰모델로 변환한다.
 * VS Code API에 의존하지 않아서 다른 프론트엔드에서도 재사용 가능.
 */

function truncate(text, maxLen) {
  const s = String(text || '');
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

function buildDashboardViewModel(state = {}) {
  const serverBadge = {
    key: 'server',
    label: '서버',
    value: state.serverOnline ? '연결됨' : '오프라인',
    tone: state.serverOnline ? 'positive' : 'critical',
  };

  const authBadge = {
    key: 'auth',
    label: '인증',
    value: state.loggedIn ? state.username : '미로그인',
    tone: state.loggedIn ? 'positive' : 'warning',
  };

  const cliBadge = {
    key: 'cli',
    label: 'CLI',
    value: state.cliInstalled ? '설치됨' : '미설치',
    tone: state.cliInstalled ? 'positive' : 'critical',
  };

  const workflowItems = (state.workflows || []).map((wf, i) => ({
    id: wf.id,
    index: i + 1,
    name: wf.workflow_name || wf.name || `워크플로우 ${i + 1}`,
    description: truncate(wf.description || '', 60),
    deployed: wf.deploy_status === 'deployed',
  }));

  return {
    header: {
      title: 'XGEN Platform',
      subtitle: '워크플로우 실행 · 문서 관리 · 온톨로지 질의',
    },
    badges: [serverBadge, authBadge, cliBadge],
    summaryCards: [
      {
        key: 'serverUrl',
        label: '서버 URL',
        value: state.serverUrl || '미설정',
        detail: state.serverMessage || '',
      },
      {
        key: 'user',
        label: '사용자',
        value: state.loggedIn
          ? `${state.username}${state.isAdmin ? ' (관리자)' : ''}`
          : '로그인 필요',
        detail: state.userType || '',
      },
      {
        key: 'workflows',
        label: '워크플로우',
        value: `${state.workflowCount || 0}개`,
        detail: '',
      },
    ],
    workflows: workflowItems,
    actions: {
      launch: {
        id: 'launch',
        label: 'XGEN CLI 실행',
        detail: '통합 터미널에서 XGEN CLI를 실행합니다',
        disabled: !state.cliInstalled,
      },
      chat: {
        id: 'chat',
        label: '채팅 모드',
        detail: '워크플로우와 대화형 채팅을 시작합니다',
        disabled: !state.loggedIn,
      },
      login: {
        id: 'login',
        label: state.loggedIn ? '재로그인' : '로그인',
        detail: state.loggedIn
          ? `현재: ${state.username}`
          : '서버에 로그인합니다',
        disabled: !state.serverUrl,
      },
      setServer: {
        id: 'setServer',
        label: '서버 설정',
        detail: state.serverUrl || 'URL을 입력하세요',
        disabled: false,
      },
    },
  };
}

module.exports = {
  truncate,
  buildDashboardViewModel,
};
