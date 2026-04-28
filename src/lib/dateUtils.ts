/**
 * IST Date Utilities
 * 
 * Problem: Supabase stores timestamps in UTC.
 * toLocaleString with timeZone:'Asia/Kolkata' is the CORRECT way.
 * Manual offset (+ 5.5hrs) causes double-offset on servers already in IST.
 * 
 * Solution: Always use Intl / toLocaleString with timeZone:'Asia/Kolkata'
 */

const TZ = 'Asia/Kolkata'

/**
 * Format time in IST — "9:30 AM"
 */
export function formatTimeIST(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleTimeString('en-IN', {
      timeZone: TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '—'
  }
}

/**
 * Format date in IST — "21 Apr 2026"
 */
export function formatDateIST(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      timeZone: TZ,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

/**
 * Format date + time in IST — "21 Apr, 9:30 AM"
 */
export function formatDateTimeIST(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = new Date(date)
    const datePart = d.toLocaleDateString('en-IN', {
      timeZone: TZ, day: 'numeric', month: 'short',
    })
    const timePart = d.toLocaleTimeString('en-IN', {
      timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true,
    })
    return `${datePart}, ${timePart}`
  } catch {
    return '—'
  }
}

/**
 * Today's date as YYYY-MM-DD in IST
 */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  // en-CA gives YYYY-MM-DD format
}

/**
 * Minutes → "2h 30m"
 */
export function minutesToHHMM(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

/**
 * "2 min pehle" style relative time
 */
export function timeAgoIST(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'abhi abhi'
  if (diff < 3600) return `${Math.floor(diff / 60)} min pehle`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ghante pehle`
  return `${Math.floor(diff / 86400)} din pehle`
}

/**
 * Get current IST hour (0-23) for greeting
 */
export function currentHourIST(): number {
  return parseInt(
    new Date().toLocaleString('en-IN', { timeZone: TZ, hour: 'numeric', hour12: false })
  )
}
