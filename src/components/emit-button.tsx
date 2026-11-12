'use client'

import { useFormStatus } from 'react-dom'

// The submit button of Lock & Emit. While the emission is being written it is disabled and says so,
// so a second press in the same moment has nothing to press (flag 52). The server refuses a repeat as well.
export function EmitButton({ label, busy, enabled = true, className }: { label: string; busy: string; enabled?: boolean; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={!enabled || pending} aria-busy={pending} className={className + (pending ? ' opacity-60 cursor-wait' : '')}>
      {pending ? busy : label}
    </button>
  )
}
