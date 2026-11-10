// Status pill — one shape, tone by state (see globals.css .pill-*)

const TONES = [
  'neutral',
  'gold',
  'green',
  'blue',
  'violet',
  'red',
  'outline',
] as const

export function Pill({
  tone,
  children,
  title,
}: {
  tone: (typeof TONES)[number]
  children: React.ReactNode
  title?: string
}) {
  return (
    <span className={`pill pill-${tone}`} title={title}>
      {children}
    </span>
  )
}

// canonical status → tone maps (keep these consistent app-wide)
export const PROJECT_STATUS_TONE: Record<string, (typeof TONES)[number]> = {
  intake: 'neutral',
  review: 'gold',
  locked: 'green',
  building: 'blue',
  done: 'green',
}

export const REVIEW_STATE_TONE: Record<string, (typeof TONES)[number]> = {
  unreviewed: 'gold',
  defaults_accepted: 'blue',
  confirmed: 'green',
  '2d_approved': 'violet',
}
