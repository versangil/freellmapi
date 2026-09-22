import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileCode,
  FolderOpen,
  ListTree,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  Square,
  Zap,
  Layers,
  Brackets,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { apiFetch, getToken, estimateTokenCost } from '@/lib/api'
import {
  detectPlaygroundSkills,
  type PlaygroundSkillId,
} from '@/lib/playground-skills'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/utils'

interface FallbackEntry {
  modelDbId: number
  enabled: boolean
  platform: string
  modelId: string
  displayName: string
  keyCount: number
  contextWindow?: number | null
  isFree: boolean
}

interface PlaygroundProject {
  id: number
  name: string
  path: string
  lastOpenedAt: string
}

interface PlaygroundSession {
  id: number
  projectId: number
  title: string
  selectedModel: string
  fullAccess: boolean
  autoApproval: boolean
  thinking: 'off' | 'low' | 'medium' | 'high'
  updatedAt: string
}

interface PlaygroundMessage {
  id?: number
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  meta?: Record<string, unknown>
  asset?: {
    type: PlaygroundSkillId
    url: string
    model: string
  }
}

interface PlaygroundSessionDetail extends PlaygroundSession {
  project: PlaygroundProject | null
  messages: PlaygroundMessage[]
  fileSnapshots: any[]
  toolEvents: any[]
}

interface ImportedSkill {
  id: number
  name: string
  path: string
  content: string
}

type ToolName = 'list_files' | 'read_file' | 'search_files' | 'write_file' | 'apply_patch' | 'run_command'
type PlaygroundMode = 'chat' | 'plan' | 'goal' | 'ide'

interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

interface ChatRequestBody {
  model?: string
  messages: WireMessage[]
  tools: typeof toolDefinitions
  tool_choice: 'auto'
  thinking?: 'off' | 'low' | 'medium' | 'high'
  stream?: boolean
}

const codingSkills = [
  {
    id: 'master',
    label: 'Full Cycle Development',
    icon: Sparkles,
    prompt: `You are a comprehensive development assistant. Analyze the request and execute the complete workflow:

1. UNDERSTAND: Read and understand the project structure, requirements, and current state
2. PLAN: Determine which tasks are needed (architecture, implementation, testing, optimization, docs)
3. ARCHITECT: If needed, design the solution and explain the approach
4. IMPLEMENT: Build/refactor the code following best practices
5. TEST: Write or improve tests with good coverage
6. OPTIMIZE: Profile and optimize for performance if relevant
7. REVIEW: Conduct self-review for bugs, regressions, and edge cases
8. DOCUMENT: Update documentation and code comments
9. VERIFY: Run final tests and demonstrate the solution works

Work systematically through each phase. Be thorough but efficient. Ask clarifying questions if the requirement is ambiguous.`
  },
  {
    id: 'implement',
    label: 'Build Feature',
    icon: Code2,
    prompt: 'Implement this feature end-to-end. Inspect the codebase structure first, write or modify the necessary files, add tests, then verify with a focused test run.'
  },
  {
    id: 'debug',
    label: 'Troubleshoot Issue',
    icon: Search,
    prompt: 'Diagnose and fix this issue systematically. Reproduce the problem, trace through the code path, pinpoint the root cause, apply the minimal fix, and verify it resolves the issue.'
  },
  {
    id: 'refactor',
    label: 'Refactor Code',
    icon: Zap,
    prompt: 'Refactor this code for clarity and maintainability. Identify code smells, improve naming and structure, remove duplication, and ensure all tests pass.'
  },
  {
    id: 'review',
    label: 'Review Code',
    icon: Shield,
    prompt: 'Conduct a thorough code review. Identify bugs, potential regressions, security issues, performance concerns, and missing test coverage. Reference specific files and line numbers.'
  },
  {
    id: 'tests',
    label: 'Add Tests',
    icon: ListTree,
    prompt: 'Improve test coverage for this code. Analyze existing test patterns, write focused unit and integration tests for edge cases, and verify they all pass.'
  },
  {
    id: 'optimize',
    label: 'Optimize Performance',
    icon: Zap,
    prompt: 'Profile and optimize this code for performance. Identify bottlenecks, implement improvements, measure impact, and document the changes.'
  },
  {
    id: 'frontend',
    label: 'Frontend Development',
    icon: WandSparkles,
    prompt: 'Develop this frontend feature as a senior UI engineer. Follow the design system, implement responsive layouts, ensure accessibility, and test across devices.'
  },
  {
    id: 'api',
    label: 'Design API',
    icon: Layers,
    prompt: 'Design a clean, scalable API. Define endpoints, request/response schemas, error handling, and document with examples. Consider backwards compatibility and versioning.'
  },
  {
    id: 'docs',
    label: 'Write Documentation',
    icon: FileCode,
    prompt: 'Create clear, accurate documentation. Include setup instructions, API references, code examples, troubleshooting guides, and keep it synchronized with the actual code.'
  },
  {
    id: 'analyze',
    label: 'Analyze Architecture',
    icon: Brackets,
    prompt: 'Analyze this project\'s architecture. Map dependencies, identify design patterns, assess scalability, and suggest improvements with specific reasoning.'
  },
]

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List project files relative to the opened project root.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file inside the opened project.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search text across project files.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write a complete text file inside the opened project.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_patch',
      description: 'Replace an exact text span in a project file.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, find: { type: 'string' }, replace: { type: 'string' } }, required: ['path', 'find', 'replace'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a terminal command in the opened project directory.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  },
]

function systemPrompt(project: PlaygroundProject | null, selectedSkills: string[], importedSkills: ImportedSkill[], claudeMd?: string | null) {
  const activeSkillText = codingSkills
    .filter(skill => selectedSkills.includes(skill.id))
    .map(skill => `- ${skill.label}: ${skill.prompt}`)
    .join('\n')
  const importedText = importedSkills
    .filter(skill => selectedSkills.includes(`import:${skill.id}`))
    .map(skill => `\nImported skill: ${skill.name}\n${skill.content.slice(0, 6000)}`)
    .join('\n')

  return [
    'You are a Codex-like coding agent inside the FreeLLMAPI Playground.',
    project ? `Opened project: ${project.name}` : 'No project open',
    project ? `Project root: ${project.path}` : 'Open a folder to enable project tools',
    project ? 'Use tools to inspect files before editing. Keep edits scoped to the opened project.' : 'Send messages to chat with the model.',
    'When editing, prefer precise file writes or exact text replacements. After edits, run a focused verification command when useful.',
    claudeMd ? `Project Guidelines (CLAUDE.md):\n${claudeMd}` : '',
    activeSkillText ? `Active built-in skills:\n${activeSkillText}` : '',
    importedText,
  ].filter(Boolean).join('\n\n')
}

async function generateMediaBlob(type: PlaygroundSkillId, prompt: string, model: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const token = getToken()
  const res = await fetch(`${base}/api/media/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ type, prompt, model }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
    throw new Error(body.error?.message ?? `HTTP ${res.status}`)
  }
  return URL.createObjectURL(await res.blob())
}

function revokeMessageAssets(messages: PlaygroundMessage[]) {
  messages.forEach(message => {
    if (message.asset?.url.startsWith('blob:')) URL.revokeObjectURL(message.asset.url)
  })
}

function isImageRelatedError(errorText: string | undefined): boolean {
  if (!errorText) return false
  const lower = errorText.toLowerCase()
  return lower.includes('image') || lower.includes('vision') || lower.includes('picture') || lower.includes('png') || lower.includes('jpeg') || lower.includes('base64')
}

export default function PlaygroundPage() {
  const queryClient = useQueryClient()
  const [projectPath, setProjectPath] = useState('')
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<PlaygroundMessage[]>([])
  const [claudeMdContent, setClaudeMdContent] = useState<string | null>(null)
  const [pendingToolCall, setPendingToolCall] = useState<{
    name: ToolName
    arguments: Record<string, unknown>
    resolve: (approved: boolean) => void
  } | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('auto')
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [modelOpen, setModelOpen] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['implement'])
  const [skillPath, setSkillPath] = useState('')
  const [toolActivity, setToolActivity] = useState<string[]>([])
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [pinnedProjects, setPinnedProjects] = useState<Set<number>>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('playground-pinned-projects') : null
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [pinnedSessions, setPinnedSessions] = useState<Set<number>>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('playground-pinned-sessions') : null
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [compactView, setCompactView] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('playground-compact-view') === 'true'
  })

    useEffect(() => {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('playground-compact-view', String(compactView))
        }
      } catch {}
    }, [compactView])
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(() => new Set())
  const [undoState, setUndoState] = useState<{ type: 'project' | 'session'; id: number; name: string; payload: any; secondsLeft?: number } | null>(null)
  const undoTimerRef = useRef<number | null>(null)
  const [playgroundMode, setPlaygroundMode] = useState<PlaygroundMode>(() => {
    if (typeof window === 'undefined') return 'chat'
    const saved = localStorage.getItem('playground-mode')
    return saved === 'plan' || saved === 'goal' || saved === 'ide' ? saved : 'chat'
  })
  const [goalText, setGoalText] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('playground-goal-text') ?? ''
  })
  const [planText, setPlanText] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('playground-plan-text') ?? ''
  })
  const [wideLayout, setWideLayout] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('playground-wide-layout') === 'true'
  })

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('playground-wide-layout', String(wideLayout))
    } catch {}
  }, [wideLayout])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('playground-mode', playgroundMode)
    } catch {}
  }, [playgroundMode])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('playground-goal-text', goalText)
    } catch {}
  }, [goalText])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('playground-plan-text', planText)
    } catch {}
  }, [planText])

  function pursueGoal() {
    const trimmedGoal = goalText.trim()
    if (!trimmedGoal) return
    handleSend()
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setStreamingContent(null)
  }

  const undoCountdownRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<PlaygroundMessage[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  const { data: keyData } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })
  const { data: fallbackEntries = [] } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })
  const { data: projects = [] } = useQuery<PlaygroundProject[]>({
    queryKey: ['playground-projects'],
    queryFn: () => apiFetch('/api/playground/projects'),
  })
  const { data: sessions = [] } = useQuery<PlaygroundSession[]>({
    queryKey: ['playground-sessions'],
    queryFn: () => apiFetch('/api/playground/sessions'),
  })
  const { data: importedSkills = [] } = useQuery<ImportedSkill[]>({
    queryKey: ['playground-imported-skills'],
    queryFn: () => apiFetch('/api/playground/skills/imports'),
  })

  const effectiveProjectId = activeProjectId ?? projects[0]?.id ?? null
  const effectiveSessionId = activeSessionId ?? sessions[0]?.id ?? null
  const activeProject = useMemo(
    () => projects.find(project => project.id === effectiveProjectId) ?? projects[0],
    [projects, effectiveProjectId],
  )
  const activeSession = useMemo(
    () => sessions.find(session => session.id === effectiveSessionId),
    [sessions, effectiveSessionId],
  )
  const activeSessionProject = useMemo(() => {
    if (!activeSession || !activeSession.projectId) return null
    return projects.find(p => p.id === activeSession.projectId) ?? null
  }, [projects, activeSession])
  const availableModels = fallbackEntries.filter(e => e.keyCount > 0 && e.enabled)
  const estimatedTokens = useMemo(() => {
    let upload = 0
    let download = 0
    messages.forEach(m => {
      const chars = m.content?.length ?? 0
      const tokens = Math.ceil(chars / 4)
      if (m.role === 'assistant') {
        download += tokens
      } else {
        upload += tokens
      }
    })
    return { upload, download, total: upload + download }
  }, [messages])

  const activeModelContextWindow = useMemo(() => {
    if (selectedModel === 'auto') return 131072
    const m = fallbackEntries.find(e => e.modelId === selectedModel)
    return m?.contextWindow ?? 131072
  }, [selectedModel, fallbackEntries])

  const contextPct = Math.min(100, Math.round((estimatedTokens.total / activeModelContextWindow) * 100))

  const filteredModels = useMemo(() => {
    const q = modelSearchQuery.trim().toLowerCase()
    if (!q) return availableModels
    return availableModels.filter(m =>
      m.displayName.toLowerCase().includes(q) ||
      m.modelId.toLowerCase().includes(q) ||
      m.platform.toLowerCase().includes(q)
    )
  }, [availableModels, modelSearchQuery])

  const [fileSnapshots, setFileSnapshots] = useState<any[]>([])
  const [rightTab, setRightTab] = useState<'context' | 'changes' | 'activity'>('context')
  const [browserMode, setBrowserMode] = useState<'project' | 'skill' | null>(null)
  const [browserPath, setBrowserPath] = useState('')
  const [browserData, setBrowserData] = useState<{ currentPath: string; parentPath: string | null; directories: any[]; files: any[] } | null>(null)
  const [activeDiffFile, setActiveDiffFile] = useState<any | null>(null)

  const fetchSessionDetails = async (sessionId: number) => {
    try {
      const detail = await apiFetch<PlaygroundSessionDetail & { fileSnapshots: any[]; toolEvents: any[]; claudeMd?: string | null }>(`/api/playground/sessions/${sessionId}`)
      setMessages(detail.messages || [])
      setSelectedModel(detail.selectedModel || 'auto')
      setFileSnapshots(detail.fileSnapshots || [])
      setClaudeMdContent(detail.claudeMd || null)
      if (detail.toolEvents) {
        const activity = detail.toolEvents.map((t: any) => `${t.toolName} (${t.status})`).slice(0, 10)
        setToolActivity(activity)
      }
    } catch (err) {
      setMessages([])
      setFileSnapshots([])
      setClaudeMdContent(null)
    }
  }

  useEffect(() => {
    if (!effectiveSessionId) {
      setMessages([])
      setFileSnapshots([])
      return
    }
    fetchSessionDetails(effectiveSessionId)
  }, [effectiveSessionId])

  async function openPathBrowser(mode: 'project' | 'skill', startPath?: string) {
    setBrowserMode(mode)
    const initialPath = startPath || (mode === 'project' ? projectPath : skillPath) || ''
    await loadBrowserPath(initialPath)
  }

  async function loadBrowserPath(targetPath: string) {
    try {
      const data = await apiFetch<any>(`/api/playground/browse?path=${encodeURIComponent(targetPath)}`)
      setBrowserData(data)
      setBrowserPath(data.currentPath)
    } catch (err) {
      try {
        const data = await apiFetch<any>(`/api/playground/browse`)
        setBrowserData(data)
        setBrowserPath(data.currentPath)
      } catch (e) {
        console.error('Failed to browse directory', e)
      }
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    messagesRef.current = messages
  }, [messages])

  useEffect(() => () => revokeMessageAssets(messagesRef.current), [])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('playground-pinned-projects', JSON.stringify([...pinnedProjects]))
      }
    } catch {}
  }, [pinnedProjects])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('playground-pinned-sessions', JSON.stringify([...pinnedSessions]))
      }
    } catch {}
  }, [pinnedSessions])

  function clearUndoTimer() {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    if (undoCountdownRef.current) {
      window.clearInterval(undoCountdownRef.current)
      undoCountdownRef.current = null
    }
  }

  function startUndoCountdown() {
    setUndoState(current => (current ? { ...current, secondsLeft: 3 } : current))
    let remaining = 3
    undoCountdownRef.current = window.setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearUndoTimer()
        setUndoState(null)
      } else {
        setUndoState(current => (current ? { ...current, secondsLeft: remaining } : current))
      }
    }, 1000) as unknown as number
  }

  async function restoreUndo() {
    if (!undoState) return
    clearUndoTimer()
    try {
      if (undoState.type === 'project') {
        await apiFetch('/api/playground/projects', {
          method: 'POST',
          body: JSON.stringify(undoState.payload),
        })
        await queryClient.invalidateQueries({ queryKey: ['playground-projects'] })
      } else if (undoState.type === 'session') {
        await apiFetch('/api/playground/sessions', {
          method: 'POST',
          body: JSON.stringify(undoState.payload),
        })
        await queryClient.invalidateQueries({ queryKey: ['playground-sessions'] })
      }
    } catch (err) {
      console.error('undo restore failed', err)
    } finally {
      setUndoState(null)
    }
  }

  async function deleteProjectWithUndo(projectId: number, project: PlaygroundProject) {
    setUndoState({
      type: 'project',
      id: project.id,
      name: project.name,
      payload: { path: project.path, name: project.name },
      secondsLeft: 3,
    })
    clearUndoTimer()
    startUndoCountdown()
    await deleteProject(projectId)
  }

  async function deleteSessionWithUndo(sessionId: number, session: PlaygroundSession) {
    setUndoState({
      type: 'session',
      id: session.id,
      name: session.title,
      payload: {
        projectId: session.projectId || undefined,
        title: session.title,
        selectedModel: session.selectedModel,
      },
      secondsLeft: 3,
    })
    clearUndoTimer()
    startUndoCountdown()
    await deleteSession(sessionId)
  }

  async function openProject() {
    const project = await apiFetch<PlaygroundProject>('/api/playground/projects', {
      method: 'POST',
      body: JSON.stringify({ path: projectPath }),
    })
    setProjectPath('')
    setActiveProjectId(project.id)
    setActiveSessionId(null)
    await queryClient.invalidateQueries({ queryKey: ['playground-projects'] })
    await queryClient.invalidateQueries({ queryKey: ['playground-sessions'] })
  }

  async function createSession(project = activeProject) {
    if (!project) return null
    const session = await apiFetch<PlaygroundSession>('/api/playground/sessions', {
      method: 'POST',
      body: JSON.stringify({ projectId: project.id, title: `Session in ${project.name}`, selectedModel }),
    })
    setActiveSessionId(session.id)
    await queryClient.invalidateQueries({ queryKey: ['playground-sessions'] })
    return session
  }

  async function createConversation() {
    const session = await apiFetch<PlaygroundSession>('/api/playground/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Conversation', selectedModel }),
    })
    setActiveSessionId(session.id)
    setActiveProjectId(null)
    await queryClient.invalidateQueries({ queryKey: ['playground-sessions'] })
    return session
  }

  async function deleteProject(projectId: number) {
    await apiFetch(`/api/playground/projects/${projectId}`, { method: 'DELETE' })
    if (activeProject?.id === projectId) {
      setActiveProjectId(null)
      setActiveSessionId(null)
    }
    await queryClient.invalidateQueries({ queryKey: ['playground-projects'] })
  }

async function deleteSession(sessionId: number) {
    await apiFetch(`/api/playground/sessions/${sessionId}`, { method: 'DELETE' })
    if (effectiveSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
    }
    await queryClient.invalidateQueries({ queryKey: ['playground-sessions'] })
  }

  async function patchSession(update: Partial<Pick<PlaygroundSession, 'fullAccess' | 'autoApproval' | 'selectedModel' | 'thinking'>>) {
    if (!effectiveSessionId) return
    const session = await apiFetch<PlaygroundSession>(`/api/playground/sessions/${effectiveSessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
    setSelectedModel(session.selectedModel)
    await queryClient.invalidateQueries({ queryKey: ['playground-sessions'] })
  }

  async function saveMessage(message: PlaygroundMessage, sessionId = effectiveSessionId) {
    if (!sessionId || message.asset) return
    await apiFetch(`/api/playground/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role: message.role, content: message.content, meta: message.meta }),
    })
  }

  async function executeTool(name: ToolName, args: Record<string, unknown>, sessionId = effectiveSessionId) {
    if (!sessionId) throw new Error('No active session')
    setToolActivity(current => [`${name} ${JSON.stringify(args).slice(0, 80)}`, ...current].slice(0, 8))

    if (activeSession && !activeSession.autoApproval) {
      const approved = await new Promise<boolean>((resolve) => {
        setPendingToolCall({
          name,
          arguments: args,
          resolve,
        })
      })
      setPendingToolCall(null)
      if (!approved) {
        return { error: 'Tool execution rejected by user.' }
      }
    }

    try {
      const response = await apiFetch<{ result: unknown }>(`/api/playground/sessions/${sessionId}/tools/execute`, {
        method: 'POST',
        body: JSON.stringify({ name, arguments: args }),
      })
      fetchSessionDetails(sessionId).catch(() => {})
      return response.result
    } catch (err: any) {
      fetchSessionDetails(sessionId).catch(() => {})
      return { error: err.message || 'Tool execution failed' }
    }
  }

  async function autoCompactConversation(sessionId: number) {
    try {
      const detail = await apiFetch<PlaygroundSessionDetail>(`/api/playground/sessions/${sessionId}`)
      const currentMessages = detail.messages || []
      if (currentMessages.length < 6) return

      setLoading(true)
      const toastMessage: PlaygroundMessage = { role: 'system', content: '⚡ Context threshold met. Auto-compacting conversation history...' }
      setMessages(prev => [...prev, toastMessage])

      const oldestToCompact = currentMessages.slice(0, currentMessages.length - 4)
      const systemPromptText = 'You are a professional assistant. Write a concise summary of the conversation history above. Focus on the main objective, the specific actions completed, files modified, and any pending requirements. Keep the summary under 300 words.'
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Session-Id': `playground-${sessionId}` }
      if (keyData?.apiKey) headers.Authorization = `Bearer ${keyData.apiKey}`
      const base = import.meta.env.BASE_URL.replace(/\/$/, '')
      
      const body = {
        model: selectedModel !== 'auto' ? selectedModel : undefined,
        messages: [
          { role: 'system', content: systemPromptText },
          ...oldestToCompact.filter(m => m.role !== 'system' && !m.asset).map(m => ({ role: m.role, content: m.content }))
        ]
      }

      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      if (!res.ok) throw new Error(`Compaction failed: HTTP ${res.status}`)
      const data = await res.json()
      const summaryContent = data.choices?.[0]?.message?.content?.trim()

      if (summaryContent) {
        await apiFetch(`/api/playground/sessions/${sessionId}/compact`, {
          method: 'POST',
          body: JSON.stringify({ summary: summaryContent, keepCount: 4 })
        })
      }
    } catch (err) {
      console.error('Auto-compaction failed:', err)
    } finally {
      await fetchSessionDetails(sessionId)
      setLoading(false)
    }
  }

  /** Stream one round of the agent loop. Returns the assistant message + usage or null on abort. */
  async function streamRound(
    wireMessages: WireMessage[],
    sessionId: number,
    signal: AbortSignal,
  ): Promise<{
    content: string
    toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>
    platform?: string
    model?: string
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
    latency: number
  } | null> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Session-Id': `playground-${sessionId}` }
    if (keyData?.apiKey) headers.Authorization = `Bearer ${keyData.apiKey}`
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const body: ChatRequestBody = {
      messages: wireMessages,
      tools: activeSessionProject ? toolDefinitions : [],
      tool_choice: 'auto',
      thinking: activeSession?.thinking ?? 'medium',
      stream: true,
    }
    if (selectedModel !== 'auto' && selectedModel !== 'auto-free') body.model = selectedModel

    const start = Date.now()
    const res = await fetch(`${base}/v1/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body), signal })
    // Capture model+platform from X-Routed-Via header (format: "platform/modelId")
    let platform: string | undefined
    let model: string | undefined
    const routedHeader = res.headers.get('X-Routed-Via')
    if (routedHeader) {
      const slashIdx = routedHeader.indexOf('/')
      if (slashIdx !== -1) {
        platform = routedHeader.slice(0, slashIdx)
        model = routedHeader.slice(slashIdx + 1)
      }
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
      const errorMessage = { role: 'assistant' as const, content: `Error: ${err.error?.message ?? 'Unknown error'}` }
      setMessages(current => [...current, errorMessage])
      await saveMessage(errorMessage, sessionId)
      return null
    }

    const reader = res.body?.getReader()
    if (!reader) {
      const errorMessage = { role: 'assistant' as const, content: 'Error: No response body from stream' }
      setMessages(current => [...current, errorMessage])
      await saveMessage(errorMessage, sessionId)
      return null
    }

    // SSE line decoder
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulatedContent = ''
    const toolCalls: Map<number, { id?: string; name?: string; args: string }> = new Map()
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined

    const flushLine = (line: string) => {
      if (!line.startsWith('data: ')) return
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') return

      let parsed: any
      try { parsed = JSON.parse(payload) } catch { return }

      const delta = parsed.choices?.[0]?.delta
      if (!delta) return

      // Capture model from standard SSE chunk fields
      if (parsed.model && !model) model = parsed.model
      if (parsed.usage) {
        usage = {
          promptTokens: parsed.usage.prompt_tokens,
          completionTokens: parsed.usage.completion_tokens,
          totalTokens: parsed.usage.total_tokens,
        }
      }

      if (delta.content) {
        accumulatedContent += delta.content
        setStreamingContent(accumulatedContent)
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          let entry = toolCalls.get(tc.index)
          if (!entry) {
            entry = { args: '' }
            toolCalls.set(tc.index, entry)
          }
          if (tc.id) entry.id = tc.id
          if (tc.function?.name) entry.name = tc.function.name
          if (tc.function?.arguments) entry.args += tc.function.arguments
        }
      }
    }

    // Read the stream
    let streamExhausted = false
    while (!streamExhausted) {
      const { done, value } = await reader.read()
      if (done) { streamExhausted = true; break }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const l of lines) flushLine(l)
    }
    // Flush remaining buffer
    if (buffer.trim()) flushLine(buffer)

    const latency = Date.now() - start

    // Build final tool call list
    const finalToolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
    for (const entry of toolCalls.values()) {
      if (entry.id && entry.name) {
        let parsedArgs: Record<string, unknown>
        try { parsedArgs = JSON.parse(entry.args) } catch { parsedArgs = {} }
        finalToolCalls.push({ id: entry.id, name: entry.name, args: parsedArgs })
      }
    }

    return { content: accumulatedContent, toolCalls: finalToolCalls, platform, model, usage, latency }
  }

  async function runAgentTurn(seedMessages: PlaygroundMessage[], sessionId = effectiveSessionId) {
    if (!sessionId) return
    let wireMessages: WireMessage[] = [
      { role: 'system', content: systemPrompt(activeSessionProject, selectedSkills, importedSkills, claudeMdContent) },
      ...seedMessages.filter(m => m.role !== 'system' && !m.asset).map(m => ({ role: m.role, content: m.content })),
    ]

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    for (let round = 0; round < 5; round++) {
      if (abortController.signal.aborted) {
        setStreamingContent(null)
        return
      }

      const result = await streamRound(wireMessages, sessionId, abortController.signal)
      if (!result) {
        // streamRound already saved an error message
        setStreamingContent(null)
        return
      }
      if (abortController.signal.aborted) {
        setStreamingContent(null)
        return
      }

      setStreamingContent(null)

      // Resolve pricing from routed model/platform metadata
      const pricingPlatform = result.platform
      const pricingModel = result.model
      const costEstimate = estimateTokenCost(pricingPlatform, pricingModel, result.usage?.promptTokens, result.usage?.completionTokens)

      if (result.toolCalls.length === 0) {
        // Final text response
        const latency = result.latency
        const promptTokens = result.usage?.promptTokens
        const completionTokens = result.usage?.completionTokens
        const totalTokens = result.usage?.totalTokens ?? ((promptTokens ?? 0) + (completionTokens ?? 0))
        const tokensPerSec = completionTokens && latency > 0 ? Number(((completionTokens / latency) * 1000).toFixed(1)) : undefined

        const finalMessage: PlaygroundMessage = {
          role: 'assistant',
          content: result.content,
          meta: {
            platform: result.platform,
            model: result.model,
            latency,
            usage: { promptTokens, completionTokens, totalTokens },
            tokensPerSec,
            costEstimate,
          },
        }
        setMessages(current => [...current, finalMessage])
        await saveMessage(finalMessage, sessionId)
        abortControllerRef.current = null
        return
      }

      // Tool calls — push assistant message + execute tools sequentially
      wireMessages = [
        ...wireMessages,
        { role: 'assistant', content: result.content || null, tool_calls: result.toolCalls.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: JSON.stringify(tc.args) } })) },
      ]

      for (const tc of result.toolCalls) {
        if (abortController.signal.aborted) {
          setStreamingContent(null)
          return
        }
        const toolResult = await executeTool(tc.name as ToolName, tc.args, sessionId)
        wireMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResult) })
      }
    }

    // Exceeded max rounds
    const finalMessage = { role: 'assistant' as const, content: 'Stopped after 5 tool rounds. Please narrow the request and try again.' }
    setMessages(current => [...current, finalMessage])
    await saveMessage(finalMessage, sessionId)
    abortControllerRef.current = null
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    let sessionId = effectiveSessionId
    if (!sessionId) {
      if (activeProject) {
        const created = await createSession(activeProject)
        if (!created) throw new Error('Could not create a project session')
        sessionId = created.id
      } else {
        const created = await createConversation()
        if (!created) throw new Error('Could not create a conversation')
        sessionId = created.id
      }
    }
    const userMessage: PlaygroundMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      await saveMessage(userMessage, sessionId)
      const mediaSkill = detectPlaygroundSkills(text)[0]
      if (mediaSkill) {
        const start = Date.now()
        const url = await generateMediaBlob(mediaSkill.id, text, mediaSkill.model)
        const mediaMessage: PlaygroundMessage = {
          role: 'assistant',
          content: `${mediaSkill.label} generated with ${mediaSkill.model}.`,
          meta: { platform: 'pollinations', model: mediaSkill.model, latency: Date.now() - start, skill: mediaSkill.label },
          asset: { type: mediaSkill.id, url, model: mediaSkill.model },
        }
        setMessages([...nextMessages, mediaMessage])
        return
      }
      await runAgentTurn(nextMessages, sessionId)

      const threshold = Math.min(20000, activeModelContextWindow * 0.7)
      if (estimatedTokens.total >= threshold && nextMessages.length >= 6) {
        await autoCompactConversation(sessionId)
      }
    } catch (err) {
      const errorMessage = { role: 'assistant' as const, content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }
      setMessages(current => [...current, errorMessage])
    } finally {
      setLoading(false)
      await queryClient.invalidateQueries({ queryKey: ['playground-sessions'] })
    }
  }

  async function importSkill() {
    if (!skillPath.trim()) return
    await apiFetch('/api/playground/skills/imports', {
      method: 'POST',
      body: JSON.stringify({ path: skillPath }),
    })
    setSkillPath('')
    await queryClient.invalidateQueries({ queryKey: ['playground-imported-skills'] })
  }

  function toggleSkill(id: string) {
    setSelectedSkills(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  function toggleProjectPin(projectId: number) {
    setPinnedProjects(current => {
      const next = new Set(current)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  function toggleSessionPin(sessionId: number) {
    setPinnedSessions(current => {
      const next = new Set(current)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  function toggleProjectExpand(projectId: number) {
    setExpandedProjects(current => {
      const next = new Set(current)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const activeModelLabel = selectedModel === 'auto'
    ? 'Auto'
    : selectedModel === 'auto-free'
    ? 'Auto Free'
    : availableModels.find(m => m.modelId === selectedModel)?.displayName ?? selectedModel

  function AssistantBubble({
    content,
    asset,
    meta,
    compactView,
    wideLayout,
  }: {
    content: string
    asset?: PlaygroundMessage['asset']
    meta?: Record<string, unknown>
    compactView: boolean
    wideLayout: boolean
  }) {
    const [expanded, setExpanded] = useState(false)

    const usage =
      (meta?.usage as
        | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
        | undefined) ?? undefined
    const platform = meta?.platform as string | undefined
    const latency = typeof meta?.latency === 'number' ? (meta.latency as number) : undefined
    const model = meta?.model as string | undefined
    const error = meta?.error as string | undefined
    const tokensPerSec =
      typeof meta?.tokensPerSec === 'number' ? (meta.tokensPerSec as number) : undefined
    const costEstimate = meta?.costEstimate as number | string | undefined
    const hasExtra = usage !== undefined || tokensPerSec !== undefined || costEstimate !== undefined

    const lineCount = content.split('\n').length
    const isTruncated = compactView && lineCount > 6 && !expanded
    const displayContent = isTruncated ? content.split('\n').slice(0, 6).join('\n') + '...' : content

    return (
      <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-muted break-words overflow-wrap-anywhere", wideLayout ? "max-w-[95%]" : "max-w-[82%]")}>
        <Markdown>{displayContent}</Markdown>
        {isTruncated && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Show more
          </button>
        )}
        {asset && (
          <div className="mt-3 overflow-hidden rounded-lg border bg-background">
            {asset.type === 'image' ? (
              <img src={asset.url} alt="Generated result" className="aspect-square w-full max-w-[420px] object-cover" />
            ) : (
              <video src={asset.url} controls className="aspect-video w-full max-w-[520px] bg-black" />
            )}
          </div>
        )}
        {error && isImageRelatedError(error) ? (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span className="font-medium">Image input error:</span> {error}
          </div>
        ) : null}
        <div className="mt-2">
          {hasExtra ? (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition hover:text-foreground"
            >
              <span>Model: {model ?? 'completion'}</span>
              {typeof latency === 'number' && <span>Latency: {latency}ms</span>}
              {platform && <span>Via: {platform}</span>}
              {error && !isImageRelatedError(error) && <span className="text-destructive">Error: {error}</span>}
              {error && isImageRelatedError(error) && <span className="inline-flex items-center gap-1 text-destructive">Error</span>}
              {hasExtra && (
                <span className="inline-flex items-center">
                  <ChevronDown className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </span>
              )}
            </button>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span>Model: {model ?? 'completion'}</span>
              {typeof latency === 'number' && <span>Latency: {latency}ms</span>}
              {platform && <span>Via: {platform}</span>}
              {error && !isImageRelatedError(error) && <span className="text-destructive">Error: {error}</span>}
              {error && isImageRelatedError(error) && <span className="text-destructive">Error</span>}
            </div>
          )}
          {expanded && hasExtra && (
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              {usage !== undefined && (
                <>
                  <span>Prompt tokens: {usage.promptTokens ?? '—'}</span>
                  <span>Completion tokens: {usage.completionTokens ?? '—'}</span>
                  <span className="col-span-2">Total tokens: {usage.totalTokens ?? '—'}</span>
                </>
              )}
              {tokensPerSec !== undefined && <span>Tokens/sec: {tokensPerSec}</span>}
              {costEstimate !== undefined && (
                <span>
                  Cost:{' '}
                  {typeof costEstimate === 'number' ? `~$${costEstimate.toFixed(4)}` : String(costEstimate)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
          <p className="text-sm text-muted-foreground">
            Project sessions, coding skills, and routed model access in one workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
            <PopoverTrigger className="sm:w-[280px] w-full max-w-full h-9 px-3 py-2 inline-flex items-center justify-between text-left font-normal border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg text-sm transition-colors outline-none focus:ring-1 focus:ring-ring">
              {selectedModel === 'auto' ? (
                <div className="flex items-baseline gap-1.5 overflow-hidden">
                  <span className="text-sm font-medium truncate">Auto</span>
                  <span className="text-[10px] text-muted-foreground font-light shrink-0">fallback chain</span>
                </div>
              ) : selectedModel === 'auto-free' ? (
                <div className="flex items-baseline gap-1.5 overflow-hidden">
                  <span className="text-sm font-medium truncate">Auto Free</span>
                  <span className="text-[10px] text-muted-foreground font-light shrink-0">free models only</span>
                </div>
              ) : (() => {
                const m = availableModels.find(m => m.modelId === selectedModel);
                if (!m) return <span className="truncate text-sm">{selectedModel}</span>;
                return (
                  <div className="flex items-baseline gap-1.5 overflow-hidden">
                    <span className="text-sm font-medium truncate">{m.displayName}</span>
                    <span className="text-[10px] text-muted-foreground font-light shrink-0">{m.platform}</span>
                  </div>
                );
              })()}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent align="end" className="sm:w-[300px] w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] p-2 bg-popover border shadow-lg rounded-xl">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                <Input
                  placeholder="Search models..."
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                  autoFocus
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-0.5 pr-1">
                {/* Auto option */}
                {('auto'.includes(modelSearchQuery.toLowerCase()) || 'fallback chain'.includes(modelSearchQuery.toLowerCase())) && (
                  <button
                    key="auto"
                    onClick={() => {
                      setSelectedModel('auto');
                      patchSession({ selectedModel: 'auto' });
                      setModelOpen(false);
                      setModelSearchQuery('');
                    }}
                    className={cn(
                      "w-full flex items-baseline justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors text-sm hover:bg-muted/80",
                      selectedModel === 'auto' ? "bg-muted font-medium" : "text-foreground"
                    )}
                  >
                    <span className="text-sm">Auto</span>
                    <span className="text-[10px] text-muted-foreground font-light">fallback chain</span>
                  </button>
                )}

                {/* Auto Free option */}
                {('auto free'.includes(modelSearchQuery.toLowerCase()) || 'free models'.includes(modelSearchQuery.toLowerCase())) && (
                  <button
                    key="auto-free"
                    onClick={() => {
                      setSelectedModel('auto-free');
                      patchSession({ selectedModel: 'auto-free' });
                      setModelOpen(false);
                      setModelSearchQuery('');
                    }}
                    className={cn(
                      "w-full flex items-baseline justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors text-sm hover:bg-muted/80",
                      selectedModel === 'auto-free' ? "bg-muted font-medium" : "text-foreground"
                    )}
                  >
                    <span className="text-sm">Auto Free</span>
                    <span className="text-[10px] text-emerald-500 font-light">free models only</span>
                  </button>
                )}

                {/* Filtered models with free/premium tags */}
                {filteredModels.map(m => (
                  <button
                    key={m.modelDbId}
                    onClick={() => {
                      setSelectedModel(m.modelId);
                      patchSession({ selectedModel: m.modelId });
                      setModelOpen(false);
                      setModelSearchQuery('');
                    }}
                    className={cn(
                      "w-full flex items-baseline justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors text-sm hover:bg-muted/80",
                      selectedModel === m.modelId ? "bg-muted font-medium" : "text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm truncate">{m.displayName}</span>
                      {m.isFree ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">Free</span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">Premium</span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-light shrink-0 ml-2">{m.platform}</span>
                  </button>
                ))}

                {filteredModels.length === 0 && !('auto'.includes(modelSearchQuery.toLowerCase()) || 'fallback chain'.includes(modelSearchQuery.toLowerCase()) || 'auto free'.includes(modelSearchQuery.toLowerCase()) || 'free models'.includes(modelSearchQuery.toLowerCase())) && (
                  <div className="py-6 text-center text-sm text-muted-foreground">No models found.</div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Badge className="h-8 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">{activeModelLabel}</Badge>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card">

        {leftOpen && (
          <>
            <div className="fixed inset-0 z-20 bg-background/40 backdrop-blur-sm lg:hidden" onClick={() => setLeftOpen(false)} />
            <aside className={cn("absolute lg:relative left-0 top-0 bottom-0 z-30 flex min-h-0 flex-col border-r bg-sidebar lg:border-b-0", wideLayout ? "w-[220px]" : "w-[280px]")}>
            <div className="border-b p-3">
              <div className="flex gap-2">
                <Input value={projectPath} onChange={e => setProjectPath(e.target.value)} placeholder="D:\\path\\to\\project" className="flex-1" />
                <Tooltip text="Browse folders" side="bottom">
                  <Button size="icon" variant="outline" onClick={() => openPathBrowser('project')} aria-label="Browse folders">
                    <FolderOpen className="size-4" />
                  </Button>
                </Tooltip>
                <Tooltip text="Open project" side="bottom">
                  <Button size="icon" onClick={openProject} disabled={!projectPath.trim()} aria-label="Open project">
                    <Plus className="size-4" />
                  </Button>
                </Tooltip>
                <Tooltip text="Hide sidebar" side="bottom">
                  <Button size="icon" variant="ghost" onClick={() => setLeftOpen(false)} aria-label="Hide sidebar">
                    <PanelLeftClose className="size-4" />
                  </Button>
                </Tooltip>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-muted-foreground">Projects</span>
                <div className="flex items-center gap-1">
                  <Tooltip text="New chat" side="bottom">
                    <Button size="icon-xs" variant="ghost" onClick={() => createConversation()} aria-label="New chat">
                      <MessageSquare className="size-3.5" />
                    </Button>
                  </Tooltip>
                  <Tooltip text="New project chat" side="bottom">
                    <Button size="icon-xs" variant="ghost" onClick={() => createSession(activeProject)} disabled={!activeProject} aria-label="New project chat">
                      <Plus />
                    </Button>
                  </Tooltip>
                </div>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-lg border bg-card p-3 text-center text-xs text-muted-foreground">
                  No projects yet. Open a folder to begin.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {projects.map(project => {
                    const projectSessions = sessions.filter(s => s.projectId === project.id)
                    const isPinned = pinnedProjects.has(project.id)
                    const isExpanded = expandedProjects.has(project.id)
                    const isActive = activeProject?.id === project.id

                    return (
                      <div key={project.id} className="rounded-lg border bg-card">
                        <div className="flex items-center gap-1 p-2">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => toggleProjectExpand(project.id)}
                            className="shrink-0"
                            title="Toggle project"
                            aria-label="Toggle project"
                          >
                            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </Button>
                          <button
                            type="button"
                            onClick={() => { setActiveProjectId(project.id); setActiveSessionId(null) }}
                            className={cn('flex-1 truncate text-left text-sm hover:bg-muted rounded px-2 py-1.5', isActive && 'bg-muted font-medium')}
                          >
                            <div className="truncate">{project.name}</div>
                            <div className="truncate font-mono text-[10px] text-muted-foreground">{project.path}</div>
                          </button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => toggleProjectPin(project.id)}
                            title={isPinned ? 'Unpin project' : 'Pin project'}
                          >
                            {isPinned ? <Pin className="size-3.5 fill-primary text-primary" /> : <PinOff className="size-3.5" />}
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => createSession(project)}
                            title="New project chat"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => deleteProjectWithUndo(project.id, project)}
                            title="Delete project"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>

                        {isExpanded && projectSessions.length > 0 && (
                          <div className="border-t px-2 pb-2 pt-1">
                            <div className="flex flex-col gap-0.5">
                              {projectSessions.map(session => {
                                const isSessionActive = effectiveSessionId === session.id
                                const isSessionPinned = pinnedSessions.has(session.id)
                                return (
                                  <div key={session.id} className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setActiveSessionId(session.id)}
                                      className={cn('flex-1 truncate rounded px-2 py-1.5 text-left text-xs hover:bg-muted', isSessionActive && 'bg-muted font-medium')}
                                    >
                                      <div className="truncate">{session.title}</div>
                                      <div className="text-[10px] text-muted-foreground">{session.fullAccess ? 'Full' : 'Safe'} · {session.autoApproval ? 'Auto appr.' : 'Manual'}</div>
                                    </button>
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      onClick={() => toggleSessionPin(session.id)}
                                      title={isSessionPinned ? 'Unpin conversation' : 'Pin conversation'}
                                    >
                                      {isSessionPinned ? <Pin className="size-3 fill-primary text-primary" /> : <PinOff className="size-3" />}
                                    </Button>
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      onClick={() => deleteSessionWithUndo(session.id, session)}
                                      title="Delete conversation"
                                    >
                                      <Trash2 className="size-3" />
                                    </Button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {sessions.filter(s => !s.projectId).length > 0 && (
                <>
                  <div className="mt-5 mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <MessageSquare className="size-3.5" />
                    Other Chats
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {sessions.filter(s => !s.projectId).map(session => {
                      const isActive = effectiveSessionId === session.id
                      const isPinned = pinnedSessions.has(session.id)
                      return (
                        <div key={session.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setActiveSessionId(session.id); setActiveProjectId(null) }}
                            className={cn('flex-1 truncate rounded px-2 py-1.5 text-left text-xs hover:bg-muted', isActive && 'bg-muted font-medium')}
                          >
                            <div className="truncate">{session.title}</div>
                            <div className="text-[10px] text-muted-foreground">{session.fullAccess ? 'Full' : 'Safe'} · {session.autoApproval ? 'Auto appr.' : 'Manual'}</div>
                          </button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => toggleSessionPin(session.id)}
                            title={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                          >
                            {isPinned ? <Pin className="size-3 fill-primary text-primary" /> : <PinOff className="size-3" />}
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => deleteSessionWithUndo(session.id, session)}
                            title="Delete conversation"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="mt-5 mb-2 text-xs font-medium uppercase text-muted-foreground">Coding Skills</div>
              <div className="flex flex-col gap-1">
                {codingSkills.map(skill => {
                  const Icon = skill.icon
                  const active = selectedSkills.includes(skill.id)
                  return (
                    <button key={skill.id} type="button" onClick={() => toggleSkill(skill.id)} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted', active && 'bg-primary text-primary-foreground')}>
                      <Icon />
                      <span className="truncate">{skill.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="border-t p-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setLeftOpen(true)}>
                <PanelLeftOpen />
                Show sidebar
              </Button>
            </div>
          </aside>
          </>
        )}

        <main className="flex min-w-0 min-h-0 flex-col" style={{ flex: '1 1 auto' }}>
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              {!leftOpen && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setLeftOpen(true)}
                  className="gap-2 shadow-md"
                >
                  <PanelLeftOpen className="size-4" />
                  <span className="hidden sm:inline">Projects</span>
                </Button>
              )}
              <div className={cn('min-w-0', !leftOpen && 'sm:ml-2')}>
                <div className="flex items-center gap-2">
                  <Bot className="size-4" />
                  <span className="truncate text-sm font-medium">{activeSessionProject ? activeSessionProject.name : 'No project open'}</span>
                </div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">{activeSessionProject?.path ?? 'Open a folder or select a project chat'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!rightOpen && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setRightOpen(true)}
                  className="gap-2 shadow-md"
                >
                  <PanelRightOpen className="size-4" />
                  <span className="hidden sm:inline">Context</span>
                </Button>
              )}
              {activeSession && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 font-medium text-muted-foreground select-none whitespace-nowrap">
                    <span>Thinking:</span>
                    <select
                      value={activeSession.thinking ?? 'medium'}
                      onChange={e => patchSession({ thinking: e.target.value as any })}
                      className="bg-background border rounded px-1.5 py-0.5 text-xs text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="off">Off</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                    <Switch checked={activeSession.fullAccess} onCheckedChange={v => patchSession({ fullAccess: v })} />
                    <span className="font-medium text-muted-foreground select-none">Full access</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                    <Switch checked={activeSession.autoApproval} onCheckedChange={v => patchSession({ autoApproval: v })} />
                    <span className="font-medium text-muted-foreground select-none">Auto approval</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Visual Guide on Token Consumption */}
          <div className="border-b px-5 py-2 bg-muted/10 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground select-none">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-foreground/80">Context Usage:</span>
              <span className="tabular-nums font-mono">{estimatedTokens.total.toLocaleString()} / {activeModelContextWindow.toLocaleString()} ({contextPct}%)</span>
              <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden border shrink-0">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${contextPct}%` }} />
              </div>
            </div>
            <div className="flex gap-4 text-[10px] tabular-nums">
              <span>Uploaded (Prompt): <span className="font-mono text-foreground/80">{estimatedTokens.upload.toLocaleString()} tok</span></span>
              <span>Downloaded (Response): <span className="font-mono text-foreground/80">{estimatedTokens.download.toLocaleString()} tok</span></span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div className="max-w-xl">
                  <Sparkles className="mx-auto mb-4 size-8 text-muted-foreground" />
                  <p className="font-medium">Open a project, pick a skill, and ask for a coding task.</p>
                  <p className="mt-2 text-sm text-muted-foreground">The Playground will save the session and use project tools when the model asks for files, edits, or commands.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                 {messages.filter(m => m.role !== 'system').map((msg, i) => {
                   if (msg.role === 'tool') {
                     // Collapsible tool result
                     return (
                       <div key={`${msg.id ?? i}-tool`} className="flex justify-start">
                         <details className="max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed bg-muted/50 border break-words overflow-wrap-anywhere">
                           <summary className="cursor-pointer font-mono text-muted-foreground hover:text-foreground select-none">
                             <ChevronRight className="inline size-3 mr-1" />Tool result
                           </summary>
                           <pre className="mt-1.5 max-h-48 overflow-y-auto text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">{msg.content?.slice(0, 2000)}{(msg.content?.length ?? 0) > 2000 ? '... (truncated)' : ''}</pre>
                         </details>
                       </div>
                     )
                   }
                   return (
                     <div key={`${msg.id ?? i}-${msg.role}`} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
{msg.role === 'assistant' && msg.meta ? (
                         <AssistantBubble content={msg.content} asset={msg.asset} meta={msg.meta} compactView={compactView} wideLayout={wideLayout} />
                       ) : (
                        <div className={cn('rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words overflow-wrap-anywhere', msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted', wideLayout ? 'max-w-[95%]' : 'max-w-[82%]')}>
                          {msg.role === 'assistant' ? <Markdown>{msg.content}</Markdown> : <div className="whitespace-pre-wrap">{msg.content}</div>}
                        </div>
                      )}
                    </div>
                    )
                  })}
                {loading && streamingContent !== null && (
                  <div className="flex justify-start">
                    <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-muted break-words overflow-wrap-anywhere", wideLayout ? "max-w-[95%]" : "max-w-[82%]")}>
                      <Markdown>{streamingContent}</Markdown>
                      <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-pulse" />
                    </div>
                  </div>
                )}
                {loading && (
                  <div className="flex items-center gap-2 justify-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-block size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="inline-block size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="inline-block size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t bg-background/60 p-3">
            {pendingToolCall && (
              <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col gap-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Settings2 className="size-3.5 animate-spin animate-infinite" style={{ animationDuration: '3s' }} />
                    <span>Approve Tool Call: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{pendingToolCall.name}</code></span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => pendingToolCall.resolve(false)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => pendingToolCall.resolve(true)}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
                <pre className="text-[10px] font-mono bg-muted/60 p-2.5 rounded-lg overflow-x-auto max-h-32 leading-relaxed text-muted-foreground">
                  {JSON.stringify(pendingToolCall.arguments, null, 2)}
                </pre>
              </div>
            )}
            <div className="flex items-end gap-2">
              {selectedSkills.filter(id => id.startsWith('import:')).length > 0 && (
                <div className="mr-1 flex items-center gap-1">
                  <Shield className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">Skills</span>
                </div>
              )}
              {selectedSkills.filter(id => id.startsWith('import:')).map(id => {
                const skill = importedSkills.find(s => `import:${s.id}` === id)
                if (!skill) return null
                return (
                  <Badge key={id} variant="secondary" className="h-7 gap-1 rounded-lg">
                    <span className="truncate">{skill.name}</span>
                    <button type="button" onClick={() => toggleSkill(id)} className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )
              })}
              {selectedSkills.filter(id => !id.startsWith('import:')).length > 0 && (
                <div className="mr-1 flex items-center gap-1">
                  <Code2 className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">Presets</span>
                </div>
              )}
              {selectedSkills.filter(id => !id.startsWith('import:')).map(id => {
                const skill = codingSkills.find(s => s.id === id)
                if (!skill) return null
                return (
                  <Badge key={id} variant="secondary" className="h-7 gap-1 rounded-lg">
                    <span className="truncate">{skill.label}</span>
                    <button type="button" onClick={() => toggleSkill(id)} className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={activeProject ? `Ask ${activeProject.name} to inspect, edit, test, or explain...` : 'Start a conversation without a project...'}
                className="max-h-40 min-h-12 flex-1"
              />
              <Button
                type="button"
                variant={wideLayout ? 'default' : 'outline'}
                size="icon"
                onClick={() => setWideLayout(v => !v)}
                title={wideLayout ? 'Disable wide layout' : 'Enable wide layout'}
                className="shrink-0"
              >
                {wideLayout ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                type="button"
                variant={compactView ? 'default' : 'outline'}
                size="icon"
                onClick={() => setCompactView(v => !v)}
                title={compactView ? 'Disable compact view' : 'Enable compact view'}
              >
                <span className="text-xs font-bold">C</span>
              </Button>
              {loading ? (
                <Button onClick={handleStop} variant="destructive" className="gap-2">
                  <Square className="size-4" />
                  <span className="hidden sm:inline">Stop</span>
                </Button>
              ) : (
                <Button onClick={handleSend} disabled={!input.trim()} className="gap-2">
                  <Send className="size-4" />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground/80">Model: {activeModelLabel}</span>
              {activeSessionProject && <span className="truncate">Project: {activeSessionProject.name}</span>}
              {activeSession && (
                <span>
                  Mode: {activeSession.fullAccess ? 'Full access' : 'Safe'} · {activeSession.autoApproval ? 'Auto appr.' : 'Manual'}
                </span>
              )}
              {(() => {
                const last = [...messages].reverse().find(m => m.role === 'assistant' && m.meta)
                if (!last?.meta) return null
                const meta = last.meta as any
                const parts: string[] = []
                if (meta.model) parts.push(String(meta.model))
                if (typeof meta.latency === 'number') parts.push(`${meta.latency}ms`)
                return parts.length ? <span>Last: {parts.join(' · ')}</span> : null
              })()}
            </div>
          </div>
        </main>

        {rightOpen && (
          <>
            <div className="fixed inset-0 z-20 bg-background/40 backdrop-blur-sm lg:hidden" onClick={() => setRightOpen(false)} />
            <aside className={cn("absolute lg:relative right-0 top-0 bottom-0 z-30 flex min-h-0 flex-col border-l bg-background shadow-lg shrink-0", wideLayout ? "w-[220px]" : "w-[300px]")}>
          <div className="border-b p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
              <div className="flex items-center gap-2">
                <Settings2 className="size-4 text-primary" />
                <span>Project Detail</span>
              </div>
              <Button size="icon-xs" variant="ghost" onClick={() => setRightOpen(false)} title="Hide panel">
                <PanelRightClose className="size-3.5" />
              </Button>
            </div>
            <div className="flex rounded-lg border bg-muted/40 p-0.5">
              {(['context', 'changes', 'activity'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRightTab(tab)}
                  className={cn(
                    'flex-1 rounded-md py-1 text-center text-xs font-medium transition capitalize',
                    rightTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {rightTab === 'context' && (
              <div className="flex flex-col gap-4">
                {/* Plan Artifact */}
                <div className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan Artifact</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => handleSend()}
                        disabled={loading}
                        title="Ask model to generate plan"
                      >
                        <Sparkles className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => {
                          setGoalText(planText)
                          setPlaygroundMode('goal')
                        }}
                        disabled={!planText.trim()}
                        title="Use plan as Goal"
                      >
                        <Code2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={planText}
                    onChange={e => setPlanText(e.target.value)}
                    placeholder="Refine plan here..."
                    className="min-h-24 text-xs font-mono"
                  />
                </div>

                {/* Goal Text */}
                <div className="rounded-lg border bg-card p-3">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Goal</span>
                  <Input
                    value={goalText}
                    onChange={e => setGoalText(e.target.value)}
                    placeholder="Goal to pursue..."
                    className="mb-2 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full text-xs"
                    onClick={pursueGoal}
                    disabled={loading || !goalText.trim()}
                  >
                    Pursue Active Goal
                  </Button>
                </div>
              </div>
            )}

            {rightTab === 'changes' && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modified Files</span>
                {fileSnapshots.length === 0 ? (
                  <div className="rounded-lg border bg-card p-3 text-center text-xs text-muted-foreground">
                    No files modified in this session yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {fileSnapshots.map((snap, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveDiffFile(snap)}
                        className="flex items-center justify-between rounded-lg border bg-card hover:bg-muted/50 p-2.5 text-left text-xs transition group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-foreground">{snap.filePath.split('/').pop()}</div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate">{snap.filePath}</div>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {rightTab === 'activity' && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tool Events</div>
                  <div className="flex flex-col gap-2">
                    {toolActivity.length === 0 ? (
                      <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">No project tools have run yet.</div>
                    ) : toolActivity.map((item, i) => (
                      <div key={`${item}-${i}`} className="rounded-lg border bg-card p-2.5 font-mono text-[10px] text-muted-foreground leading-normal">{item}</div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Imported Skills</div>
                  <div className="mb-2 flex gap-2">
                    <Input value={skillPath} onChange={e => setSkillPath(e.target.value)} placeholder="Path or folder" className="text-xs h-8 flex-1" />
                    <Button size="icon-xs" variant="outline" onClick={() => openPathBrowser('skill')} title="Browse skills">
                      <FolderOpen className="size-3.5" />
                    </Button>
                    <Button size="icon-xs" onClick={importSkill} disabled={!skillPath.trim()} title="Import skill">
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {importedSkills.map(skill => {
                      const id = `import:${skill.id}`
                      return (
                        <button key={skill.id} type="button" onClick={() => toggleSkill(id)} className={cn('rounded-lg px-2.5 py-2 text-left text-xs transition border hover:bg-muted/50', selectedSkills.includes(id) && 'bg-primary/5 border-primary/20 font-medium')}>
                          <div className="truncate text-foreground font-medium">{skill.name}</div>
                          <div className="truncate font-mono text-[9px] text-muted-foreground">{skill.path}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3 bg-muted/10">
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { revokeMessageAssets(messages); setMessages([]) }}>
                <X className="size-4" />
                Clear Local View
              </Button>
            </div>
          </div>
        </aside>
          </>
        )}
        {undoState && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive px-4 py-2 shadow-lg">
              <span className="text-sm font-medium text-destructive-foreground">Deleted {undoState.name}</span>
              <span className="text-xs font-bold text-destructive-foreground/80">{undoState.secondsLeft ?? 3}s</span>
              <Button size="sm" variant="secondary" onClick={restoreUndo}>Undo</Button>
            </div>
          </div>
        )}
      </div>

      {/* Path Browser Modal */}
      {browserMode && browserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FolderOpen className="text-primary size-5" />
                <span>Select {browserMode === 'project' ? 'Project Folder' : 'Skill Path'}</span>
              </h2>
              <Button size="icon" variant="ghost" onClick={() => setBrowserMode(null)} title="Close" aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>

            {/* Path Breadcrumbs */}
            <div className="flex items-center gap-1.5 border-b bg-muted/30 px-4 py-2.5 text-xs font-mono overflow-x-auto whitespace-nowrap scrollbar-none">
              {browserData.parentPath && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => loadBrowserPath(browserData.parentPath!)}
                  title="Go up one folder"
                  className="mr-1"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              )}
              {browserData.currentPath.split(/[\\/]/).map((part, index, arr) => {
                if (!part && index === 0) return null;
                const fullSubPath = arr.slice(0, index + 1).join('\\') || '\\';
                return (
                  <span key={index} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => loadBrowserPath(fullSubPath)}
                      className="hover:text-foreground text-muted-foreground transition font-medium hover:underline hover:underline-offset-4"
                    >
                      {part || 'Root'}
                    </button>
                    {index < arr.length - 1 && <span className="text-muted-foreground/35">/</span>}
                  </span>
                );
              })}
            </div>

            {/* Directory/File List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5">
              {browserData.directories.length === 0 && browserData.files.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">This folder is empty.</div>
              )}
              {browserData.directories.map(dir => (
                <button
                  key={dir.path}
                  type="button"
                  onClick={() => loadBrowserPath(dir.path)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left hover:bg-muted/80 text-sm group transition-all"
                >
                  <FolderOpen className="size-4 text-primary shrink-0 group-hover:scale-105 transition-transform" />
                  <span className="truncate font-medium text-foreground">{dir.name}</span>
                </button>
              ))}
              {browserData.files.map(file => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => {
                    if (browserMode === 'skill') {
                      setSkillPath(file.path)
                      setBrowserMode(null)
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm group transition-all",
                    browserMode === 'skill' ? "hover:bg-muted/80" : "opacity-55 cursor-default"
                  )}
                >
                  <FileCode className="size-4 text-muted-foreground shrink-0" />
                  <span className="truncate text-foreground/80">{file.name}</span>
                </button>
              ))}
            </div>

            <div className="border-t p-4 flex items-center justify-between bg-muted/20">
              <div className="text-[11px] truncate max-w-[60%] font-mono text-muted-foreground">
                Selected: {browserPath}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setBrowserMode(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (browserMode === 'project') {
                      setProjectPath(browserPath)
                    } else {
                      setSkillPath(browserPath)
                    }
                    setBrowserMode(null)
                  }}
                >
                  Select Folder
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diff Visualizer Modal */}
      {activeDiffFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Code2 className="text-primary size-5" />
                  <span>File Changes: {activeDiffFile.filePath.split('/').pop()}</span>
                </h2>
                <p className="text-[11px] font-mono text-muted-foreground">{activeDiffFile.filePath}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setActiveDiffFile(null)} title="Close" aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/20 p-4 font-mono text-xs leading-relaxed">
              <div className="rounded-xl border bg-background overflow-hidden">
                {(() => {
                  const diff = (() => {
                    const before = activeDiffFile.beforeContent;
                    const after = activeDiffFile.afterContent;
                    if (before === null) {
                      return (after ?? '').split('\n').map((line: string) => ({ type: 'add', text: line }));
                    }
                    if (after === null) {
                      return (before ?? '').split('\n').map((line: string) => ({ type: 'remove', text: line }));
                    }
                    const beforeLines = before.split('\n');
                    const afterLines = after.split('\n');
                    const result: { type: 'add' | 'remove' | 'normal'; text: string }[] = [];
                    let i = 0, j = 0;
                    while (i < beforeLines.length || j < afterLines.length) {
                      if (i < beforeLines.length && j < afterLines.length) {
                        if (beforeLines[i] === afterLines[j]) {
                          result.push({ type: 'normal', text: beforeLines[i] });
                          i++;
                          j++;
                        } else {
                          const nextBeforeIndex = beforeLines.indexOf(afterLines[j], i);
                          if (nextBeforeIndex !== -1 && nextBeforeIndex - i < 5) {
                            while (i < nextBeforeIndex) {
                              result.push({ type: 'remove', text: beforeLines[i] });
                              i++;
                            }
                          } else {
                            result.push({ type: 'add', text: afterLines[j] });
                            j++;
                          }
                        }
                      } else if (i < beforeLines.length) {
                        result.push({ type: 'remove', text: beforeLines[i] });
                        i++;
                      } else {
                        result.push({ type: 'add', text: afterLines[j] });
                        j++;
                      }
                    }
                    return result;
                  })();

                  return diff.map((line: { type: string; text: string }, idx: number) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex px-4 py-0.5 border-l-4",
                        line.type === 'add' && "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400",
                        line.type === 'remove' && "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400",
                        line.type === 'normal' && "border-transparent text-muted-foreground/90"
                      )}
                    >
                      <span className="w-8 shrink-0 select-none opacity-45 text-right pr-3">{idx + 1}</span>
                      <span className="w-4 shrink-0 select-none opacity-60">
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      </span>
                      <span className="whitespace-pre-wrap flex-1">{line.text}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="border-t p-4 flex justify-end bg-muted/20">
              <Button onClick={() => setActiveDiffFile(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}