import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  ClockIcon,
  CornerUpLeftIcon,
  FileSignatureIcon,
  InfoIcon,
  KeyRoundIcon,
  MegaphoneIcon,
  ReceiptTextIcon,
  ScanEyeIcon,
} from 'lucide-react'
import type { ActionKind, Classification, Tone } from '../types/email'

export const TONE_CHIP: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-ink',
  iris: 'bg-iris-soft text-iris-ink',
  azure: 'bg-azure-soft text-azure-ink',
  warm: 'bg-warm-soft text-warm-ink',
  moss: 'bg-moss-soft text-moss-ink',
  ruby: 'bg-ruby-soft text-ruby-ink',
  neutral: 'bg-ink-faint/15 text-ink-muted',
}

export const TONE_AVATAR: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-ink',
  iris: 'bg-iris-soft text-iris-ink',
  azure: 'bg-azure-soft text-azure-ink',
  warm: 'bg-warm-soft text-warm-ink',
  moss: 'bg-moss-soft text-moss-ink',
  ruby: 'bg-ruby-soft text-ruby-ink',
  neutral: 'bg-ink-faint/15 text-ink-muted',
}

export const CLASSIFICATIONS: Record<
  Classification,
  { label: string; tone: Tone; icon: typeof InfoIcon; blurb: string }
> = {
  needs_reply: {
    label: 'Needs reply',
    tone: 'accent',
    icon: CornerUpLeftIcon,
    blurb: 'A person is waiting on your answer.',
  },
  awaiting: {
    label: 'Awaiting them',
    tone: 'azure',
    icon: ClockIcon,
    blurb: 'You replied — nothing to do until they respond.',
  },
  verification: {
    label: 'Login code',
    tone: 'iris',
    icon: KeyRoundIcon,
    blurb: 'Short-lived passcode, safe to archive after use.',
  },
  receipt: {
    label: 'Receipt',
    tone: 'moss',
    icon: ReceiptTextIcon,
    blurb: 'Money movement or invoice record.',
  },
  calendar: {
    label: 'Scheduling',
    tone: 'warm',
    icon: CalendarClockIcon,
    blurb: 'Affects your calendar.',
  },
  alert: {
    label: 'Alert',
    tone: 'ruby',
    icon: AlertTriangleIcon,
    blurb: 'Time-sensitive, may need action right now.',
  },
  fyi: { label: 'FYI', tone: 'neutral', icon: InfoIcon, blurb: 'Read-only context, no action.' },
  promotion: {
    label: 'Promotion',
    tone: 'neutral',
    icon: MegaphoneIcon,
    blurb: 'Marketing — bulk archive candidate.',
  },
}

export const ACTION_ICON: Record<ActionKind, typeof InfoIcon> = {
  reply: CornerUpLeftIcon,
  copy: KeyRoundIcon,
  approve: CircleCheckIcon,
  sign: FileSignatureIcon,
  confirm: CalendarClockIcon,
  review: ScanEyeIcon,
  none: InfoIcon,
}

/** Classifications that belong in the "Needs you" group at the top of the inbox. */
export const ACTIONABLE: Classification[] = ['alert', 'needs_reply', 'verification', 'calendar']

export const ALL_TAGS = [
  'Work',
  'Finance',
  'Travel',
  'Family',
  'Legal',
  'Recruiting',
  'Vendors',
  'Follow-up',
  'Read later',
]

