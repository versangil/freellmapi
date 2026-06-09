import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  Code2,
  FileCode,
  FolderOpen,
  ImageIcon,
  ListTree,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  Shield,
  Sparkles,
  Terminal,
  Undo2,
  WandSparkles,
  X,
} from 'lucide-react'
import { apiFetch, getToken } from '@/lib/api'
import {
  detectPlaygroundSkills,
  playgroundSkills as mediaSkills,
  type PlaygroundSkillId,
} from '@/lib/playground-skills'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  project: PlaygroundProject
  messages: PlaygroundMessage[]
}

interface ImportedSkill {
  id: number
  name: string
  path: string
  content: string
}

type ToolName = 'list_files' | 'read_file' | 'search_files' | 'write_file' | 'apply_patch' | 'run_command'

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
}

const codingSkills = [
  { id: 'implement', label: 'Implement Feature', icon: Code2, prompt: 'Implement this feature in the opened project. Inspect the code first, edit the needed files, then run a focused verification command.' },
  { id: 'debug', label: 'Debug', icon: Search, prompt: 'Debug this issue systematically. Reproduce or inspect the failing path, identify the cause, make the smallest fix, and verify it.' },
  { id: 'review', label: 'Code Review', icon: Shield, prompt: 'Review this project change. Lead with bugs, regressions, risks, and missing tests. Reference files precisely.' },
  { id: 'tests', label: 'Write Tests', icon: ListTree, prompt: 'Add or improve tests for this behavior. Start by inspecting existing test patterns, then write focused tests and run them.' },
  { id: 'frontend', label: 'Frontend App', icon: WandSparkles, prompt: 'Work as a senior frontend engineer. Preserve the existing design system, improve the UI, and verify responsive behavior.' },
  { id: 'docs', label: 'Docs', icon: FileCode, prompt: 'Update project documentation with concise, accurate instructions based on the current code.' },
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

function systemPrompt(project: PlaygroundProject, selectedSkills: string[], importedSkills: ImportedSkill[]) {
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
    `Opened project: ${project.name}`,
    `Project root: ${project.path}`,
    'Use tools to inspect files before editing. Keep edits scoped to the opened project.',
    'When editing, prefer precise file writes or exact text replacements. After edits, run a focused verification command when useful.',
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

export default function PlaygroundPage() {
  const queryClient = useQueryClient()
  const [projectPath, setProjectPath] = useState('')
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<PlaygroundMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('auto')
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['implement'])
  const [skillPath, setSkillPath] = useState('')
  const [toolActivity, setToolActivity] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<PlaygroundMessage[]>([])

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
    queryKey: ['playground-sessions', activeProjectId],
    queryFn: () => apiFetch(`/api/playground/sessions${activeProjectId ? `?projectId=${activeProjectId}` : ''}`),
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
  const availableModels = fallbackEntries.filter(e => e.keyCount > 0 && e.enabled)
  const detectedMediaSkills = useMemo(() => detectPlaygroundSkills(input), [input])

  useEffect(() => {
    if (!effectiveSessionId) return
    apiFetch<PlaygroundSessionDetail>(`/api/playground/sessions/${effectiveSessionId}`)
      .then(detail => {
        setMessages(detail.messages)
        setSelectedModel(detail.selectedModel)
      })
      .catch(() => setMessages([]))
  }, [effectiveSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    messagesRef.current = messages
  }, [messages])

  useEffect(() => () => revokeMessageAssets(messagesRef.current), [])

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

  async function patchSession(update: Partial<Pick<PlaygroundSession, 'fullAccess' | 'autoApproval' | 'selectedModel'>>) {
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
    const response = await apiFetch<{ result: unknown }>(`/api/playground/sessions/${sessionId}/tools/execute`, {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args }),
    })
    return response.result
  }

  async function runAgentTurn(seedMessages: PlaygroundMessage[], sessionId = effectiveSessionId) {
    if (!activeProject || !sessionId) return
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Session-Id': `playground-${sessionId}` }
    if (keyData?.apiKey) headers.Authorization = `Bearer ${keyData.apiKey}`
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    let wireMessages: WireMessage[] = [
      { role: 'system', content: systemPrompt(activeProject, selectedSkills, importedSkills) },
      ...seedMessages.filter(m => m.role !== 'system' && !m.asset).map(m => ({ role: m.role, content: m.content })),
    ]

    for (let round = 0; round < 5; round++) {
      const body: ChatRequestBody = { messages: wireMessages, tools: toolDefinitions, tool_choice: 'auto' }
      if (selectedModel !== 'auto') body.model = selectedModel
      const start = Date.now()
      const res = await fetch(`${base}/v1/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) })
      const latency = Date.now() - start
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        const errorMessage = { role: 'assistant' as const, content: `Error: ${err.error?.message ?? 'Unknown error'}` }
        setMessages(current => [...current, errorMessage])
        await saveMessage(errorMessage, sessionId)
        return
      }
      const data = await res.json()
      const assistant = data.choices?.[0]?.message
      const calls = assistant?.tool_calls ?? []
      if (calls.length === 0) {
        const finalMessage: PlaygroundMessage = {
          role: 'assistant',
          content: assistant?.content ?? '',
          meta: {
            platform: data._routed_via?.platform,
            model: data._routed_via?.model,
            latency,
          },
        }
        setMessages(current => [...current, finalMessage])
        await saveMessage(finalMessage, sessionId)
        return
      }

      wireMessages = [...wireMessages, { role: 'assistant', content: assistant.content ?? null, tool_calls: calls }]
      for (const call of calls) {
        const toolName = call.function.name as ToolName
        const args = JSON.parse(call.function.arguments || '{}')
        const result = await executeTool(toolName, args, sessionId)
        wireMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }

    const finalMessage = { role: 'assistant' as const, content: 'Stopped after 5 tool rounds. Please narrow the request and try again.' }
    setMessages(current => [...current, finalMessage])
    await saveMessage(finalMessage, sessionId)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    if (!activeProject) {
      setMessages([{ role: 'assistant', content: 'Open a project folder before starting a project session.' }])
      return
    }
    let sessionId = effectiveSessionId
    if (!sessionId) {
      const created = await createSession(activeProject)
      if (!created) throw new Error('Could not create a project session')
      sessionId = created.id
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

  const activeModelLabel = selectedModel === 'auto'
    ? 'Auto'
    : availableModels.find(m => m.modelId === selectedModel)?.displayName ?? selectedModel

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
          <Select value={selectedModel} onValueChange={(v) => { setSelectedModel(v ?? 'auto'); patchSession({ selectedModel: v ?? 'auto' }) }}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (fallback chain)</SelectItem>
              {availableModels.map(m => (
                <SelectItem key={m.modelDbId} value={m.modelId}>{m.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="h-8 rounded-lg">{activeModelLabel}</Badge>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border bg-card lg:grid-cols-[270px_minmax(0,1fr)_310px]">
        <aside className="flex min-h-0 flex-col border-b bg-sidebar/60 lg:border-b-0 lg:border-r">
          <div className="border-b p-3">
            <div className="flex gap-2">
              <Input value={projectPath} onChange={e => setProjectPath(e.target.value)} placeholder="D:\\path\\to\\project" />
              <Button size="icon" onClick={openProject} disabled={!projectPath.trim()} title="Open project">
                <FolderOpen />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">Projects</span>
              <Button size="icon-xs" variant="ghost" onClick={() => createSession()}>
                <Plus />
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              {projects.map(project => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => { setActiveProjectId(project.id); setActiveSessionId(null) }}
                  className={cn('rounded-lg px-2 py-2 text-left text-sm hover:bg-muted', activeProject?.id === project.id && 'bg-muted font-medium')}
                >
                  <div className="truncate">{project.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{project.path}</div>
                </button>
              ))}
            </div>

            <div className="mt-5 mb-2 text-xs font-medium uppercase text-muted-foreground">Sessions</div>
            <div className="flex flex-col gap-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveSessionId(session.id)}
                  className={cn('rounded-lg px-2 py-2 text-left text-sm hover:bg-muted', effectiveSessionId === session.id && 'bg-muted font-medium')}
                >
                  <div className="truncate">{session.title}</div>
                  <div className="text-[11px] text-muted-foreground">{session.fullAccess ? 'Full access' : 'Safe mode'} · {session.autoApproval ? 'Auto approval' : 'Manual mode'}</div>
                </button>
              ))}
            </div>

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
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Bot className="size-4" />
                <span className="truncate text-sm font-medium">{activeProject ? activeProject.name : 'No project open'}</span>
              </div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">{activeProject?.path ?? 'Open a folder to begin'}</div>
            </div>
            {activeSession && (
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-2">
                  <Switch checked={activeSession.fullAccess} onCheckedChange={v => patchSession({ fullAccess: v })} />
                  Full access
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={activeSession.autoApproval} onCheckedChange={v => patchSession({ autoApproval: v })} />
                  Auto approval
                </label>
              </div>
            )}
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
                {messages.filter(m => m.role !== 'system' && m.role !== 'tool').map((msg, i) => (
                  <div key={`${msg.id ?? i}-${msg.role}`} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                      {msg.role === 'assistant' ? <Markdown>{msg.content}</Markdown> : <div className="whitespace-pre-wrap">{msg.content}</div>}
                      {msg.asset && (
                        <div className="mt-3 overflow-hidden rounded-lg border bg-background">
                          {msg.asset.type === 'image'
                            ? <img src={msg.asset.url} alt="Generated result" className="aspect-square w-full max-w-[420px] object-cover" />
                            : <video src={msg.asset.url} controls className="aspect-video w-full max-w-[520px] bg-black" />}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && <div className="text-sm text-muted-foreground">Working through model and project tools...</div>}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {detectedMediaSkills.map(skill => (
                <Badge key={skill.id} variant="outline" className="h-6 gap-1 rounded-lg">
                  {skill.id === 'image' ? <ImageIcon /> : <Play />}
                  {skill.shortLabel}
                </Badge>
              ))}
              {mediaSkills.map(skill => (
                <Button key={skill.id} type="button" variant="outline" size="xs" onClick={() => setInput(skill.promptHint)}>
                  {skill.id === 'image' ? <ImageIcon /> : <Play />}
                  {skill.shortLabel}
                </Button>
              ))}
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
                placeholder="Ask the agent to inspect, edit, test, or explain this project..."
                className="max-h-40 min-h-12"
              />
              <Button onClick={handleSend} disabled={loading || !input.trim()}>
                <Send />
                Send
              </Button>
            </div>
          </div>
        </main>

        <aside className="hidden min-h-0 flex-col border-l bg-background/60 lg:flex">
          <div className="border-b p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Settings2 className="size-4" />
              Project Context
            </div>
            <div className="rounded-lg border bg-card p-2">
              <div className="text-xs text-muted-foreground">Selected files and diffs appear as the agent uses tools.</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <Terminal className="size-3.5" />
              Tool Activity
            </div>
            <div className="flex flex-col gap-2">
              {toolActivity.length === 0 ? (
                <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">No project tools have run yet.</div>
              ) : toolActivity.map((item, i) => (
                <div key={`${item}-${i}`} className="rounded-lg border bg-card p-2 font-mono text-[11px] text-muted-foreground">{item}</div>
              ))}
            </div>

            <div className="mt-5 mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <Undo2 className="size-3.5" />
              Imported Skills
            </div>
            <div className="mb-2 flex gap-2">
              <Input value={skillPath} onChange={e => setSkillPath(e.target.value)} placeholder="Path to SKILL.md or folder" />
              <Button size="icon" onClick={importSkill} disabled={!skillPath.trim()}>
                <Plus />
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              {importedSkills.map(skill => {
                const id = `import:${skill.id}`
                return (
                  <button key={skill.id} type="button" onClick={() => toggleSkill(id)} className={cn('rounded-lg px-2 py-2 text-left text-xs hover:bg-muted', selectedSkills.includes(id) && 'bg-muted font-medium')}>
                    <div className="truncate">{skill.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{skill.path}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t p-3">
            <Button type="button" variant="outline" size="sm" onClick={() => { revokeMessageAssets(messages); setMessages([]) }}>
              <X />
              Clear local view
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
