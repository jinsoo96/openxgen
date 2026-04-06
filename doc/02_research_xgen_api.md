# XGEN 2.0 API 조사 결과

## 아키텍처 개요

```
[클라이언트] → [xgen-backend-gateway :8000] → [xgen-core :8001]
                                             → [xgen-workflow :8002]
                                             → [xgen-documents :8003]
                                             → [xgen-mcp-station :8004]
```

- 게이트웨이(Rust/Axum)가 모든 요청을 프록시
- JWT 토큰 기반 인증 (게이트웨이에서 처리)
- 프록시 경로: `/api/{service}/{path}` → 해당 서비스로 전달

## 인증 플로우 (게이트웨이 레벨)

### 로그인
```
POST /api/auth/login
Body: { "email": "xxx", "password": "xxx" }
Response: {
  "success": true,
  "access_token": "jwt...",
  "refresh_token": "jwt...",
  "token_type": "bearer",
  "user_id": "1",
  "username": "admin"
}
```

### 토큰 갱신
```
POST /api/auth/refresh
Body: { "refresh_token": "xxx" }
Response: { "success": true, "access_token": "new_jwt", "token_type": "bearer" }
```

### 토큰 검증
```
GET /api/auth/validate
Header: Authorization: Bearer {access_token}
Response: {
  "valid": true,
  "user_id": "1",
  "username": "admin",
  "is_admin": true,
  "user_type": "superuser",
  "available_user_sections": "...",
  "available_admin_sections": "..."
}
```

### 토큰 만료
- Access Token: 환경변수 `ACCESS_TOKEN_EXPIRE_MIN` (기본 1440분 = 24시간)
- Refresh Token: 환경변수 `REFRESH_TOKEN_EXPIRE_DAYS` (기본 7일)
- Redis에 토큰 해시 저장 → 무효화 가능

### 프록시 동작
- 게이트웨이가 JWT에서 user_id, username 추출
- `X-User-ID`, `X-Username` 등 헤더를 주입하여 백엔드로 전달
- 백엔드 서비스들은 이 헤더를 신뢰

---

## 워크플로우 API (xgen-workflow :8002)

### 기본 CRUD — `/api/workflow/`
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/list` | GET | 워크플로우 목록 |
| `/list/detail` | GET | 상세 목록 |
| `/list/admin` | GET | 관리자 목록 |
| `/load/{workflow_id}` | GET | 워크플로우 로드 |
| `/save` | POST | 워크플로우 저장 |
| `/update/{workflow_id}` | POST | 워크플로우 업데이트 |
| `/delete/{workflow_id}` | DELETE | 워크플로우 삭제 |
| `/duplicate/{workflow_id}` | GET | 워크플로우 복제 |
| `/rename/workflow` | POST | 이름 변경 |
| `/version/list` | GET | 버전 목록 |
| `/version/change` | POST | 버전 변경 |
| `/upload/{workflow_id}` | POST | 워크플로우 업로드 |

### 실행 — `/api/workflow/execute/`
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/based_id` | POST | 레거시 실행 |
| `/based_id/stream` | POST | **핵심: 스트리밍 실행** |
| `/based_id/stream/deploy` | POST | 배포 모드 스트리밍 실행 |
| `/deploy/stream` | POST | 배포 스트리밍 |
| `/deploy/result` | POST | 배포 결과 조회 |
| `/status` | GET | 전체 실행 상태 |
| `/status/{execution_id}` | GET | 특정 실행 상태 |
| `/cleanup` | POST | 실행 정리 |

### 워크플로우 실행 요청 형식
```json
{
  "workflow_id": "uuid",
  "workflow_name": "워크플로우명",
  "input_data": "사용자 입력 텍스트",
  "interaction_id": "세션_ID",
  "parameters": {}
}
```

### 스트리밍 응답 (SSE)
- Content-Type: text/event-stream
- 이벤트 타입: token, log, node_status, tool, complete, error

### 테스터 — `/api/workflow/execute/tester/`
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/stream` | POST | 테스트 스트리밍 실행 |
| `/io_logs` | GET | IO 로그 조회 |
| `/cancel/{batch_id}` | POST | 배치 취소 |
| `/status/{batch_id}` | GET | 배치 상태 |
| `/results/{batch_id}` | GET | 배치 결과 |

### 배포 — `/api/workflow/deploy/`
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/status/{workflow_id}` | POST | 배포 상태 변경 |
| `/key/{workflow_name}` | GET | 배포 키 조회 |
| `/update/{workflow_id}` | POST | 배포 설정 업데이트 |
| `/load/{user_id}/{workflow_id}` | GET | 배포된 워크플로우 로드 |

---

## xgen-core API (:8001)

### 인증 — `/api/auth/`
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/signup` | POST | 회원가입 |
| `/signup/guest` | POST | 게스트 가입 |
| `/superuser` | GET | 슈퍼유저 존재 확인 |
| `/available-group` | GET | 사용 가능 그룹 |

### 관리자 — `/api/admin/`
- 사용자 관리, 워크플로우 관리, 시스템 설정, DB 관리, 그룹 관리 등

### 설정 — `/api/config/`
- 설정 조회/변경, PII 정책 관리

### 데이터베이스 — `/api/database/`
- 일반 CRUD, 설정 관리

### Session Station — `/api/session-station/v1/`
- Auth Profile CRUD, Auth Context 관리

---

## WebSocket 엔드포인트

| 경로 | 서비스 | 용도 |
|------|--------|------|
| `/ws/local-cli/{user_id}` | workflow | 로컬 CLI 브릿지 |
| `/ws/recording/{session_id}` | workflow | 시나리오 녹화 실시간 |
| `/ws/execution/{execution_id}` | workflow | 실행 실시간 모니터링 |

---

## CLI 개발에 필요한 핵심 API

### MVP (Phase 1-2)
1. `POST /api/auth/login` — 로그인
2. `GET /api/auth/validate` — 토큰 검증
3. `POST /api/auth/refresh` — 토큰 갱신
4. `GET /api/workflow/list` — 워크플로우 목록
5. `GET /api/workflow/load/{id}` — 워크플로우 상세
6. `POST /api/workflow/execute/based_id/stream` — 스트리밍 실행
7. `GET /api/workflow/execute/status/{id}` — 실행 상태

### Phase 3+ (인터랙티브/문서)
8. `GET /api/workflow/io_logs` — 실행 이력
9. `POST /api/workflow/execute/tester/stream` — 테스트 실행
10. 문서 API (xgen-documents 추가 조사 필요)
11. 온톨로지 API (`/graph-rag`, `/graph-rag/multi-turn`)
