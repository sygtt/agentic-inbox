import React from 'react'
import {
  AlarmClockIcon,
  ArchiveIcon,
  BellOffIcon,
  MailOpenIcon,
  MailIcon,
  PinIcon,
  PinOffIcon,
  TagIcon,
} from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { useInbox } from '../contexts/InboxContext'
import type { Email } from '../types/email'

interface QuickActionsSheetProps {
  email: Email | null
  open: boolean
  onClose: () => void
  onOpenTags: () => void
}

export function QuickActionsSheet({ email, open, onClose, onOpenTags }: QuickActionsSheetProps) {
  const { archive, toggleRead, togglePin, snooze, showToast } = useInbox()
  if (!email) return <BottomSheet open={false} onClose={onClose} title="Quick actions" children={null} />

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const items = [
    { label: 'Archive', icon: ArchiveIcon, onClick: run(() => archive(email.id)) },
    { label: 'Snooze to 9:00 tomorrow', icon: AlarmClockIcon, onClick: run(() => snooze(email.id)) },
    {
      label: email.unread ? 'Mark as read' : 'Mark as unread',
      icon: email.unread ? MailOpenIcon : MailIcon,
      onClick: run(() => toggleRead(email.id)),
    },
    {
      label: email.pinned ? 'Unpin from top' : 'Pin to top',
      icon: email.pinned ? PinOffIcon : PinIcon,
      onClick: run(() => togglePin(email.id)),
    },
    {
      label: 'Tags',
      icon: TagIcon,
      onClick: () => {
        onClose()
        onOpenTags()
      },
    },
    {
      label: `Mute ${email.sender.name}`,
      icon: BellOffIcon,
      onClick: run(() => showToast(`Muted ${email.sender.name}`)),
    },
  ]

  return (
    <BottomSheet open={open} onClose={onClose} title="Quick actions" subtitle={email.subject}>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={item.onClick}
              className="flex w-full items-center gap-3 py-3 text-left transition-colors duration-150 ease-out active:bg-ink-faint/[0.08]"
            >
              <item.icon className="h-[18px] w-[18px] text-ink-muted" aria-hidden="true" />
              <span className="text-[14px] font-medium text-ink">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
