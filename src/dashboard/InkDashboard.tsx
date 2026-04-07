/**
 * OPEN XGEN Ink Dashboard — Gemini CLI 스타일
 */
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import { getServer, getAuth, getDefaultProvider } from "../config/store.js";

type Tab = "workflows" | "collections" | "nodes" | "prompts" | "tools";

interface WfItem { name: string; id: string; deployed: boolean; }
interface ColItem { name: string; docs: number; chunks: number; }

const TABS: { key: Tab; label: string; shortcut: string }[] = [
  { key: "workflows", label: "워크플로우", shortcut: "1" },
  { key: "collections", label: "컬렉션", shortcut: "2" },
  { key: "nodes", label: "노드", shortcut: "3" },
  { key: "prompts", label: "프롬프트", shortcut: "4" },
  { key: "tools", label: "도구", shortcut: "5" },
];

function Header({ tab, serverDisplay, model }: { tab: Tab; serverDisplay: string; model: string }) {
  const tabStr = TABS.map((t) => {
    const active = tab === t.key;
    return `[${t.shortcut}]${active ? "▸" : " "}${t.label}`;
  }).join("  ");

  return (
    <Box paddingX={1}>
      <Text bold>OPEN XGEN</Text>
      <Text dimColor>  {model}  {serverDisplay}  │  {tabStr}</Text>
    </Box>
  );
}

function ListPanel({ items, selected, onSelect }: {
  items: { label: string; dimLabel?: string }[];
  selected: number;
  onSelect?: (i: number) => void;
}) {
  const { stdout } = useStdout();
  const height = (stdout?.rows ?? 24) - 8;
  const visibleCount = Math.max(1, height);
  const start = Math.max(0, Math.min(selected - Math.floor(visibleCount / 2), items.length - visibleCount));
  const visible = items.slice(start, start + visibleCount);

  return (
    <Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray" paddingX={1}>
      {visible.map((item, i) => {
        const realIndex = start + i;
        const isSelected = realIndex === selected;
        return (
          <Text key={`item-${realIndex}`} inverse={isSelected}>
            {isSelected ? "▸ " : "  "}
            {item.label}
            {item.dimLabel ? <Text dimColor> {item.dimLabel}</Text> : null}
          </Text>
        );
      })}
      {items.length === 0 && <Text dimColor>  (없음)</Text>}
    </Box>
  );
}

function DetailPanel({ lines }: { lines: string[] }) {
  return (
    <Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray" paddingX={1}>
      {lines.map((line, i) => (
        <Text key={`line-${i}`}>{line}</Text>
      ))}
    </Box>
  );
}

function StatusBar({ message }: { message: string }) {
  return (
    <Box paddingX={1}>
      <Text dimColor>{message}</Text>
    </Box>
  );
}

function InputBar({ value, onChange, onSubmit, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>❯ </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={placeholder ?? "입력..."}
      />
    </Box>
  );
}

function Dashboard() {
  const { exit } = useApp();
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();
  const serverDisplay = auth && server
    ? `${auth.username}@${server.replace("https://", "").replace("http://", "")}`
    : "미연결";

  const [tab, setTab] = useState<Tab>("workflows");
  const [selected, setSelected] = useState(0);
  const [workflows, setWorkflows] = useState<WfItem[]>([]);
  const [collections, setCollections] = useState<ColItem[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [detail, setDetail] = useState<string[]>(["← 항목을 선택하세요"]);
  const [inputValue, setInputValue] = useState("");
  const [inputMode, setInputMode] = useState(false);
  const [runTarget, setRunTarget] = useState<WfItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("로딩...");

  // 데이터 로드
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setStatusMsg("로딩...");
    try {
      if (server && auth) {
        const [wfMod, docMod, extraMod] = await Promise.all([
          import("../api/workflow.js"),
          import("../api/document.js"),
          import("../api/xgen-extra.js"),
        ]);

        const [wfs, cols, nodeList, promptList, toolList] = await Promise.allSettled([
          wfMod.getWorkflowListDetail(),
          docMod.listCollections(),
          extraMod.listNodes(),
          extraMod.listPrompts(),
          extraMod.listToolStore(),
        ]);

        if (wfs.status === "fulfilled") {
          setWorkflows(wfs.value.map((w: any) => ({
            name: w.workflow_name, id: w.workflow_id ?? w.id ?? "", deployed: !!w.is_deployed,
          })));
        }
        if (cols.status === "fulfilled") {
          setCollections(cols.value.map((c: any) => ({
            name: c.collection_make_name, docs: c.total_documents, chunks: c.total_chunks,
          })));
        }
        if (nodeList.status === "fulfilled") setNodes(nodeList.value as any[]);
        if (promptList.status === "fulfilled") setPrompts(promptList.value as any[]);
        if (toolList.status === "fulfilled") setTools(toolList.value as any[]);
      }
    } catch {}
    setLoading(false);
    setStatusMsg("↑↓:이동  Enter:선택  1-5:탭  i:입력  r:새로고침  q:종료");
  }

  function getListItems() {
    switch (tab) {
      case "workflows":
        return workflows.map((w) => ({ label: `${w.deployed ? "●" : "○"} ${w.name}`, dimLabel: "" }));
      case "collections":
        return collections.map((c) => ({ label: c.name, dimLabel: `${c.docs}문서 ${c.chunks}청크` }));
      case "nodes":
        return nodes.map((n: any) => ({ label: n.nodeName ?? n.name ?? "?", dimLabel: (n.description ?? "").slice(0, 30) }));
      case "prompts":
        return prompts.map((p: any) => ({ label: p.name ?? p.title ?? "?", dimLabel: `[${p.prompt_type ?? ""}]` }));
      case "tools":
        return tools.map((t: any) => ({ label: t.name ?? t.tool_name ?? "?", dimLabel: (t.description ?? "").slice(0, 30) }));
      default:
        return [];
    }
  }

  function showDetail() {
    const items = getListItems();
    if (selected < 0 || selected >= items.length) return;

    if (tab === "workflows") {
      const w = workflows[selected];
      if (w) setDetail([w.name, "", `ID     ${w.id}`, `배포   ${w.deployed ? "Yes" : "No"}`, "", "Enter → 실행"]);
    } else if (tab === "collections") {
      const c = collections[selected];
      if (c) setDetail([c.name, "", `문서   ${c.docs}개`, `청크   ${c.chunks}개`]);
    } else if (tab === "nodes") {
      const n = nodes[selected] as any;
      if (n) setDetail([n.nodeName ?? n.name ?? "?", "", n.description ?? "", "", `ID: ${n.node_id ?? n.id ?? "?"}`]);
    } else if (tab === "prompts") {
      const p = prompts[selected] as any;
      if (p) setDetail([p.name ?? "?", `[${p.prompt_type ?? ""}]`, "", (p.content ?? "").slice(0, 200)]);
    } else if (tab === "tools") {
      const t = tools[selected] as any;
      if (t) setDetail([t.name ?? t.tool_name ?? "?", "", t.description ?? ""]);
    }
  }

  useEffect(() => { showDetail(); }, [selected, tab]);

  function switchTab(t: Tab) {
    setTab(t);
    setSelected(0);
    setInputMode(false);
    setRunTarget(null);
  }

  async function handleSubmit(value: string) {
    if (!value.trim()) {
      setInputMode(false);
      setRunTarget(null);
      return;
    }

    if (runTarget) {
      setDetail([`실행 중: ${runTarget.name}`, `입력: ${value}`, "", "..."]);
      setInputValue("");
      setInputMode(false);

      try {
        const { executeWorkflow } = await import("../api/workflow.js");
        const { randomUUID } = await import("node:crypto");
        const result = await executeWorkflow({
          workflow_id: runTarget.id,
          workflow_name: runTarget.name,
          input_data: value,
          interaction_id: `tui_${randomUUID().slice(0, 8)}`,
          user_id: auth?.userId ? parseInt(auth.userId) : 1,
        }) as any;

        const content = result.content ?? result.message ?? JSON.stringify(result).slice(0, 500);
        setDetail([`${runTarget.name}`, "", `입력: ${value}`, "", `결과:`, String(content)]);
      } catch (err) {
        setDetail([`실행 실패: ${(err as Error).message}`]);
      }
      setRunTarget(null);
    } else {
      setInputValue("");
      setInputMode(false);
    }
  }

  useInput((input, key) => {
    if (inputMode) {
      if (key.escape) { setInputMode(false); setRunTarget(null); }
      return;
    }

    if (input === "q" || (key.ctrl && input === "c")) { exit(); return; }
    if (input === "r") { loadAll(); return; }
    if (input === "i") { setInputMode(true); return; }

    // 탭 전환
    if (input === "1") switchTab("workflows");
    else if (input === "2") switchTab("collections");
    else if (input === "3") switchTab("nodes");
    else if (input === "4") switchTab("prompts");
    else if (input === "5") switchTab("tools");

    // 목록 이동
    const items = getListItems();
    if (key.upArrow) setSelected(Math.max(0, selected - 1));
    else if (key.downArrow) setSelected(Math.min(items.length - 1, selected + 1));
    else if (key.tab) switchTab(TABS[(TABS.findIndex((t) => t.key === tab) + 1) % TABS.length].key);

    // Enter
    if (key.return && items.length > 0) {
      if (tab === "workflows" && workflows[selected]) {
        setRunTarget(workflows[selected]);
        setInputMode(true);
        setStatusMsg(`${workflows[selected].name} — 입력 후 Enter로 실행, Esc 취소`);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Header tab={tab} serverDisplay={serverDisplay} model={provider?.model ?? ""} />
      <Box flexDirection="row" flexGrow={1}>
        <ListPanel items={getListItems()} selected={selected} />
        <DetailPanel lines={detail} />
      </Box>
      {inputMode ? (
        <InputBar
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder={runTarget ? `${runTarget.name}에 입력...` : "입력..."}
        />
      ) : (
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>❯ i를 눌러 입력 · Enter로 실행</Text>
        </Box>
      )}
      <StatusBar message={loading ? "로딩..." : statusMsg} />
    </Box>
  );
}

export async function startInkDashboard(): Promise<void> {
  // readline이 pause 상태에서 Ink가 stdin을 다시 제어
  if (process.stdin.isPaused?.()) {
    process.stdin.resume();
  }

  const { waitUntilExit } = render(<Dashboard />, {
    exitOnCtrlC: true,
  });
  await waitUntilExit();
}
