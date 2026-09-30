import { format, subMinutes } from 'date-fns'

export function relativeLabel(minutesAgo: number): string {
  if (minutesAgo < 1) return 'now'
  if (minutesAgo < 60) return `${minutesAgo}m`
  const hours = Math.floor(minutesAgo / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yest'
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

export function absoluteLabel(minutesAgo: number): string {
  const date = subMinutes(new Date(), minutesAgo)
  return format(date, 'MMM d • h:mm a')
}

export function clockLabel(): string {
  return format(new Date(), 'h:mm')
}

