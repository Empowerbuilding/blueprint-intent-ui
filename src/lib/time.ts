// Times are shown in the VIEWER's time zone, not the server's (the server runs in UTC).
// The browser reports its zone once in a "tz" cookie (components/time-zone.tsx); until it has,
// pages use Central time, where Barnhaus works.
import { cookies } from 'next/headers'

export const DEFAULT_TZ = 'America/Chicago'

export function validTimeZone(tz: string | null | undefined): string | null {
  if (!tz || tz.length > 64) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return null
  }
}

export async function viewerTimeZone(): Promise<string> {
  let raw: string | undefined
  try {
    raw = (await cookies()).get('tz')?.value
  } catch {
    raw = undefined
  }
  let decoded = raw
  try {
    decoded = raw ? decodeURIComponent(raw) : raw
  } catch {
    decoded = raw
  }
  return validTimeZone(decoded) || DEFAULT_TZ
}

/** Nov 9, 2026 */
export const fmtDate = (iso: string | null | undefined, tz: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' }) : ''

/** 10:47 PM CST */
export const fmtTime = (iso: string | null | undefined, tz: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : ''

/** Nov 9, 2026, 10:47 PM CST */
export const fmtDateTime = (iso: string | null | undefined, tz: string) => (iso ? fmtDate(iso, tz) + ', ' + fmtTime(iso, tz) : '')

/** the calendar day an instant falls on for the viewer, as YYYY-MM-DD (for grouping) */
export const dayKey = (iso: string, tz: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Wednesday, November 11, 2026 — for a dayKey() value */
export const fmtDayHeading = (key: string) =>
  new Date(key + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
