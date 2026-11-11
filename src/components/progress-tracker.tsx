import Link from 'next/link'
import type { Progress } from '@/lib/progress'
import { Pill } from '@/components/pill'

// Where a project stands (derived from the data) and the one thing to do next.

export function ProgressTracker({ progress }: { progress: Progress }) {
  return (
    <ol className="flex flex-wrap gap-y-3">
      {progress.steps.map((s, i) => (
        <li key={s.key} className="flex items-start">
          {i > 0 && (
            <span
              aria-hidden
              className={'mt-3 mx-2 h-px w-6 sm:w-10 ' + (s.state === 'todo' ? 'bg-bh-border' : 'bg-gold/60')}
            />
          )}
          <div className="flex items-start gap-2.5">
            <span
              className={
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' +
                (s.state === 'done'
                  ? 'bg-emerald-900/60 text-emerald-300'
                  : s.state === 'current'
                    ? 'bg-gold text-slate-950'
                    : 'border border-bh-border text-slate-600')
              }
            >
              {s.state === 'done' ? '✓' : i + 1}
            </span>
            <div className="leading-tight">
              <div
                className={
                  'text-sm font-semibold ' +
                  (s.state === 'current' ? 'text-white' : s.state === 'done' ? 'text-slate-300' : 'text-slate-600')
                }
              >
                {s.label}
              </div>
              <div className={'text-[11px] ' + (s.state === 'todo' ? 'text-slate-700' : 'text-slate-500')}>{s.detail}</div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function WhoPill({ who }: { who: Progress['next']['who'] }) {
  if (who === 'you') return <Pill tone="gold">Waiting on you</Pill>
  if (who === 'blueprint') return <Pill tone="blue">Waiting on Blueprint</Pill>
  return <Pill tone="green">Complete</Pill>
}

export function NextStep({ progress, compact = false }: { progress: Progress; compact?: boolean }) {
  const n = progress.next
  return (
    <div className={'flex flex-wrap items-center justify-between gap-3 ' + (compact ? '' : 'card p-4')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <WhoPill who={n.who} />
          {/* when it is on you, the button carries the action — do not say it twice */}
          {n.who !== 'you' && <span className="text-sm font-semibold text-white">{n.label}</span>}
        </div>
        <div className="text-xs text-slate-500 mt-1">{n.detail}</div>
      </div>
      {n.who === 'you' && (
        <Link href={n.href} className={compact ? 'btn-primary-sm shrink-0' : 'btn-primary shrink-0'}>
          {n.label} →
        </Link>
      )}
    </div>
  )
}
