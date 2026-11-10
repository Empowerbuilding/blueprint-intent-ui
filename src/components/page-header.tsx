import Link from 'next/link'

// Consistent page sub-header: breadcrumb back-link + title + contextual actions.
// The global shell (logo + nav) lives in (app)/layout.tsx — this is per-page.

export function PageHeader({
  back,
  backLabel,
  eyebrow,
  title,
  children,
}: {
  back?: string
  backLabel?: string
  eyebrow?: string
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="border-b border-bh-border bg-bh-panel/40">
      <div className="app-container py-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {back && (
            <Link
              href={back}
              className="text-xs text-slate-500 hover:text-white transition-colors"
            >
              ← {backLabel || 'Back'}
            </Link>
          )}
          {eyebrow && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mt-1">
              {eyebrow}
            </div>
          )}
          <h1 className="text-xl font-semibold text-white mt-0.5 truncate">{title}</h1>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  )
}
