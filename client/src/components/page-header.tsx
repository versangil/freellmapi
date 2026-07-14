import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  divider = true,
}: {
  title: string
  description?: string
  actions?: ReactNode
  divider?: boolean
}) {
  return (
    <div className={`flex flex-wrap md:flex-nowrap items-end justify-between gap-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500 ${divider ? 'pb-6 border-b' : ''}`}>
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{title}</h1>
        {description && (
          <p className="text-[15px] text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 animate-in fade-in slide-in-from-right-4 duration-500 delay-150 fill-mode-both">{actions}</div>}
    </div>
  )
}
