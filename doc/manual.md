# XGEN CLI 사용 매뉴얼

## 설치 (최초 1회)

```bash
cd ~/xgen-cli
npm install
npm run build
```

설치 끝. 어디서든 `xgen` 치면 됩니다.
(`~/.local/bin/xgen` → `~/xgen-cli/bin/xgen` 심볼릭 링크 설정됨)

---

## AI 에이전트 모드

### 프로바이더 추가
```bash
xgen provider add
# → 타입 선택 (openai/gemini/ollama/anthropic/custom)
# → API Key 입력
# → 모델 선택
```

### 프로바이더 관리
```bash
xgen provider ls              # 목록 (● = 기본)
xgen provider use <id>        # 기본 프로바이더 변경
xgen provider remove <id>     # 제거
```

### 에이전트 시작
```bash
xgen agent                    # 에이전트 모드
xgen                          # 프로바이더 설정시 자동으로 에이전트 모드
```

에이전트가 사용하는 도구:
- `file_read` — 파일 읽기
- `file_write` — 파일 생성
- `file_edit` — 파일 수정 (텍스트 교체)
- `bash` — 셸 명령어 실행
- `grep` — 코드 검색
- `list_files` — 디렉토리/파일 목록

에이전트 내 슬래시 커맨드:
- `/clear` — 대화 초기화
- `/tools` — 도구 목록
- `/provider` — 현재 프로바이더 확인
- `/exit` 또는 `exit` — 종료

---

## XGEN 플랫폼 모드

### 서버 설정 & 로그인
```bash
xgen config set-server https://xgen.x2bee.com
xgen login -e admin@plateer.com -p admin123
xgen whoami
```

### 워크플로우
```bash
xgen wf ls                        # 목록
xgen wf ls --detail               # 상세 (배포 상태, 날짜)
xgen wf info <workflow_id>        # 상세 정보
xgen wf run <id> "안녕하세요"     # 실행 (SSE 스트리밍)
xgen wf run -i <id>               # 인터랙티브 입력
xgen wf run -l <id> "테스트"      # 디버그 로그
xgen wf history                   # 전체 이력
xgen wf history <id>              # 특정 워크플로우 이력
```

### 채팅
```bash
xgen chat                         # 워크플로우 선택 → 반복 대화
xgen chat <workflow_id>           # 특정 워크플로우로 시작
```

### 문서
```bash
xgen doc ls                       # 문서 목록
xgen doc ls -c <collection_id>    # 컬렉션별 목록
xgen doc upload <file>            # 업로드
xgen doc upload <file> -c <id>    # 컬렉션에 업로드
xgen doc info <id>                # 문서 상세
```

### 온톨로지 (GraphRAG)
```bash
xgen ont query "질문"             # 원샷 질의
xgen ont query "질문" -g <id>     # 특정 그래프에 질의
xgen ont chat                     # 멀티턴 대화
xgen ont stats <graph-id>         # 그래프 통계
```

---

## 설정

```bash
xgen config set-server <url>      # 서버 URL
xgen config get-server            # 현재 서버
xgen config list                  # 전체 설정
xgen config set <key> <value>     # 설정 변경
```

### 설정 파일 위치

| 파일 | 용도 |
|------|------|
| `~/.xgen/config.json` | 서버 URL, 테마 등 |
| `~/.xgen/auth.json` | XGEN 로그인 토큰 |
| `~/.xgen/providers.json` | AI 프로바이더 설정 |

---

## 문제 해결

| 증상 | 해결 |
|------|------|
| `서버가 설정되지 않았습니다` | `xgen config set-server <url>` |
| `로그인이 필요합니다` | `xgen login` |
| `프로바이더가 설정되지 않았습니다` | `xgen provider add` |
| `토큰 만료` | 자동 갱신. 안 되면 `xgen login` |
| 코드 수정 후 반영 안 됨 | `npm run build` |
