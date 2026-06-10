import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/page-header'
import { FloatingBar } from '@/components/floating-bar'
import { ModelsTabs } from '@/components/models-tabs'
import { Tooltip } from '@/components/tooltip'

interface ProviderEntry {
  id: number
  platform: string
  modelId: string
  displayName: string
  priority: number
  enabled: boolean
  quotaLabel: string
  keyCount: number
}

interface Family {
  family: string
  dimensions: number
  maxInputTokens: number | null
  isDefault: boolean
  providers: ProviderEntry[]
}

interface EmbeddingsData {
  defaultFamily: string
  families: Family[]
}

interface UsageData {
  families: { family: string; requestsToday: number; tokensMonth: number }[]
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function EmbeddingsPage() {
  const queryClient = useQueryClient()
  // Local unsaved edits, same pattern as the chat fallback page.
  const [localFamilies, setLocalFamilies] = useState<Family[] | null>(null)
  const [localDefault, setLocalDefault] = useState<string | null>(null)

  const { data, isLoading } = useQuery<EmbeddingsData>({
    queryKey: ['embeddings'],
    queryFn: () => apiFetch('/api/embeddings'),
  })

  const { data: usage } = useQuery<UsageData>({
    queryKey: ['embeddings', 'usage'],
    queryFn: () => apiFetch('/api/embeddings/usage'),
    refetchInterval: 30_000,
  })
  const usageByFamily = new Map((usage?.families ?? []).map(u => [u.family, u]))

  const saveMutation = useMutation({
    mutationFn: (body: { defaultFamily?: string; providers?: { id: number; priority: number; enabled: boolean }[] }) =>
      apiFetch('/api/embeddings', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embeddings'] })
      setLocalFamilies(null)
      setLocalDefault(null)
    },
  })

  const families = localFamilies ?? data?.families ?? []
  const defaultFamily = localDefault ?? data?.defaultFamily ?? ''
  const hasChanges = localFamilies !== null || localDefault !== null

  function updateProvider(familyName: string, id: number, patch: Partial<ProviderEntry>) {
    setLocalFamilies(families.map(f =>
      f.family === familyName
        ? { ...f, providers: f.providers.map(p => (p.id === id ? { ...p, ...patch } : p)) }
        : f,
    ))
  }

  function moveProvider(familyName: string, index: number, dir: -1 | 1) {
    setLocalFamilies(families.map(f => {
      if (f.family !== familyName) return f
      const list = [...f.providers]
      const j = index + dir
      if (j < 0 || j >= list.length) return f
      ;[list[index], list[j]] = [list[j], list[index]]
      return { ...f, providers: list.map((p, i) => ({ ...p, priority: i + 1 })) }
    }))
  }

  function handleSave() {
    saveMutation.mutate({
      ...(localDefault !== null ? { defaultFamily: localDefault } : {}),
      ...(localFamilies !== null
        ? { providers: families.flatMap(f => f.providers.map(p => ({ id: p.id, priority: p.priority, enabled: p.enabled }))) }
        : {}),
    })
  }

  function discard() {
    setLocalFamilies(null)
    setLocalDefault(null)
  }

  return (
    <div>
      <PageHeader
        title="Models"
        description="Embeddings fail over within a family only: the same model served by another provider. Vectors from different models are incompatible, so the router never swaps models on you."
        divider={false}
        actions={<ModelsTabs />}
      />

      <div className="space-y-6">
        <p className="text-xs text-muted-foreground">
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono">model: "auto"</code> on{' '}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono">POST /v1/embeddings</code> routes to the
          default family. Naming a family (or a provider model id) pins that family; providers inside it are tried in order.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          families.map(f => {
            const u = usageByFamily.get(f.family)
            const noKeys = f.providers.every(p => p.keyCount === 0)
            return (
              <section key={f.family} className={`rounded-3xl border bg-card p-5 ${noKeys ? 'opacity-60' : ''}`}>
                <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
                  <div className="flex items-baseline gap-2.5 min-w-0">
                    <Tooltip text="Model family name. Vectors from different families cannot be mixed or compared.">
                      <h2 className="text-sm font-medium font-mono truncate cursor-help">{f.family}</h2>
                    </Tooltip>
                    <Tooltip text="Output dimensions (size of the embedding vector).">
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground tabular-nums cursor-help">
                        {f.dimensions}d
                      </span>
                    </Tooltip>
                    {f.maxInputTokens && (
                      <Tooltip text="Maximum text length in tokens allowed per request.">
                        <span className="text-[11px] text-muted-foreground/70 tabular-nums cursor-help">
                          {formatTokens(f.maxInputTokens)} tok max
                        </span>
                      </Tooltip>
                    )}
                    {f.family === defaultFamily ? (
                      <Tooltip text="The default model family used when calling /v1/embeddings with model: 'auto'.">
                        <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-foreground text-background font-medium cursor-help">
                          Default · auto
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip text="Make this the default auto-routing model family.">
                        <button
                          onClick={() => setLocalDefault(f.family)}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2 transition-colors cursor-help"
                        >
                          Make default
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  <Tooltip text="Cumulative embedding requests and tokens successfully processed this month.">
                    <span className="text-xs text-muted-foreground tabular-nums cursor-help">
                      {u ? <>{u.requestsToday} req today · {formatTokens(u.tokensMonth)} tok this month</> : '—'}
                    </span>
                  </Tooltip>
                </div>

                <div className="divide-y">
                  {f.providers.map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-3 py-2 ${p.enabled ? '' : 'opacity-50'}`}>
                      <Tooltip text="Provider priority order (tried top to bottom).">
                        <span className="w-5 text-center font-mono text-xs text-muted-foreground tabular-nums cursor-help">{i + 1}</span>
                      </Tooltip>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Tooltip text="API provider platform name.">
                            <span className="text-sm font-medium cursor-help">{p.platform}</span>
                          </Tooltip>
                          <Tooltip text="Internal model identifier for requests sent to this provider.">
                            <span className="truncate font-mono text-[11px] text-muted-foreground cursor-help">{p.modelId}</span>
                          </Tooltip>
                          {p.keyCount === 0 && (
                            <Tooltip text="No active API keys configured for this platform on the Keys page.">
                              <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-amber-600/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400 cursor-help">
                                no key
                              </span>
                            </Tooltip>
                          )}
                        </div>
                        <Tooltip text="Known rate limits and pricing tier information.">
                          <div className="text-[11px] text-muted-foreground/70 cursor-help">{p.quotaLabel}</div>
                        </Tooltip>
                      </div>
                      {f.providers.length > 1 && (
                        <div className="flex gap-0.5">
                          <Tooltip text="Move up to increase fallback priority.">
                            <button
                              onClick={() => moveProvider(f.family, i, -1)}
                              disabled={i === 0}
                              aria-label="Move up"
                              className="rounded-md p-1 text-muted-foreground/60 hover:text-foreground disabled:opacity-25 transition-colors"
                            >
                              <ArrowUp className="size-3.5" />
                            </button>
                          </Tooltip>
                          <Tooltip text="Move down to decrease fallback priority.">
                            <button
                              onClick={() => moveProvider(f.family, i, 1)}
                              disabled={i === f.providers.length - 1}
                              aria-label="Move down"
                              className="rounded-md p-1 text-muted-foreground/60 hover:text-foreground disabled:opacity-25 transition-colors"
                            >
                              <ArrowDown className="size-3.5" />
                            </button>
                          </Tooltip>
                        </div>
                      )}
                      <Tooltip text={p.enabled ? "Disable this provider option." : "Enable this provider option."}>
                        <span>
                          <Switch
                            checked={p.enabled}
                            onCheckedChange={(c) => updateProvider(f.family, p.id, { enabled: c })}
                          />
                        </span>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </section>
            )
          })
        )}

        <FloatingBar show={hasChanges}>
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
          <Button variant="outline" size="sm" onClick={discard}>Discard</Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </FloatingBar>
      </div>
    </div>
  )
}
