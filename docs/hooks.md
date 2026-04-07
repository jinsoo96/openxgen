# Hooks 시스템

## 개요

Hooks는 에이전트 컨텍스트 윈도우 **밖**에서 실행되어 컨텍스트를 소비하지 않는다.
도구 실행 전후 검증, 로깅, 안전장치를 제공한다.

## Hook 타입

| Hook | 시점 | 용도 |
|------|------|------|
| `PreToolUse` | 도구 실행 전 | 검증, 차단, 인자 변환 |
| `PostToolUse` | 도구 실행 후 | 로깅, 결과 요약, 부수효과 |
| `PreCompact` | 컨텍스트 압축 전 | 보존할 정보 지정 |
| `OnError` | 도구 실행 오류 | 에러 복구, 대체 실행 |

## PreToolUse 예시

```typescript
// XGEN 미연결 시 XGEN 도구 차단
{
  match: (name) => name.startsWith("xgen_"),
  handler: (name, args) => {
    if (!getServer() || !getAuth()) {
      return { blocked: true, message: "XGEN 미연결. /connect로 연결하세요." };
    }
    return { proceed: true };
  }
}

// 위험한 bash 명령 차단
{
  match: (name) => name === "bash",
  handler: (name, args) => {
    const cmd = args.command as string;
    if (/rm\s+-rf|dd\s+if=|mkfs|>\s*\/dev/.test(cmd)) {
      return { blocked: true, message: "위험한 명령어입니다." };
    }
    return { proceed: true };
  }
}
```

## PostToolUse 예시

```typescript
// 결과가 너무 길면 자동 요약
{
  match: () => true,
  handler: (name, result) => {
    if (result.length > 5000) {
      return {
        result: result.slice(0, 3000) + "\n\n[... 결과 잘림. 전체 결과가 필요하면 tool_search로 세부 조회하세요]",
        metadata: { originalLength: result.length, truncated: true }
      };
    }
    return { result };
  }
}

// 실행 로깅
{
  match: () => true,
  handler: (name, result) => {
    log(`[${new Date().toISOString()}] ${name} → ${result.length}자`);
    return { result };
  }
}
```

## 설정

```json
// ~/.xgen/hooks.json
{
  "preToolUse": [
    { "match": "xgen_*", "action": "check-connection" },
    { "match": "bash", "action": "safety-check" }
  ],
  "postToolUse": [
    { "match": "*", "action": "auto-truncate", "maxLength": 5000 },
    { "match": "*", "action": "log" }
  ]
}
```
