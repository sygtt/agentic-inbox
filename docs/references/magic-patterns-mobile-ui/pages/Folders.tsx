import React from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClockIcon,
  ArchiveIcon,
  ChevronRightIcon,
  FileTextIcon,
  InboxIcon,
  SendIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from 'lucide-react'
import { useInbox } from '../contexts/InboxContext'
import { ACTIONABLE } from '../data/classifications'
import type { FolderKey } from '../types/email'

export function Folders() {
  const { emails } = useInbox()
  const inbox = emails.filter((email) => !email.archived && !email.snoozed)

  const folders: { key: FolderKey; label: string; icon: typeof InboxIcon; count: number }[] = [
    { key: 'inbox', label: 'Inbox', icon: InboxIcon, count: inbox.length },
    {
      key: 'archive',
      label: 'Archive',
      icon: ArchiveIcon,
      count: emails.filter((email) => email.archived).length,
    },
    {
      key: 'snoozed',
      label: 'Snoozed',
      icon: AlarmClockIcon,
      count: emails.filter((email) => email.snoozed).length,
    },
    { key: 'sent', label: 'Sent', icon: SendIcon, count: 214 },
    { key: 'drafts', label: 'Drafts', icon: FileTextIcon, count: 3 },
    { key: 'spam', label: 'Spam', icon: ShieldAlertIcon, count: 18 },
    { key: 'trash', label: 'Trash', icon: Trash2Icon, count: 42 },
  ]

  const views = [
    {
      to: '/?filter=needs',
      label: 'Needs you',
      count: inbox.filter(
        (email) => ACTIONABLE.includes(email.classification) && email.action.kind !== 'none',
      ).length,
    },
    {
      to: '/?filter=awaiting',
      label: 'Awaiting others',
      count: inbox.filter((email) => email.classification === 'awaiting').length,
    },
    {
      to: '/?filter=codes',
      label: 'Login codes',
      count: inbox.filter((email) => email.classification === 'verification').length,
    },
    {
      to: '/?filter=receipts',
      label: 'Receipts',
      count: inbox.filter((email) => email.classification === 'receipt').length,
    },
  ]

  return (
    <>
      <header className="shrink-0 bg-bg px-4 pb-2 pt-2">
        <h1 className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">
          Folders
        </h1>
        <p className="mt-1.5 text-[12px] text-ink-faint">alex@brightloop.dev</p>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-6">
        <h2 className="px-4 py-1.5 text-[11.5px] font-semibold text-ink-faint">
          Smart views from the assistant
        </h2>
        <div className="mx-4 grid grid-cols-2 gap-2">
          {views.map((view) => (
            <Link
              key={view.label}
              to={view.to}
              className="rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors duration-150 ease-out active:bg-surface-alt"
            >
              <span className="block text-[19px] font-semibold leading-none tabular-nums text-ink">
                {view.count}
              </span>
              <span className="mt-1 block truncate text-[12px] font-medium text-ink-muted">
                {view.label}
              </span>
            </Link>
          ))}
        </div>

        <h2 className="px-4 pb-1.5 pt-4 text-[11.5px] font-semibold text-ink-faint">Mailboxes</h2>
        <ul className="border-y border-line bg-surface">
          {folders.map((folder) => (
            <li key={folder.key} className="border-b border-line last:border-b-0">
              <Link
                to={`/folder/${folder.key}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out active:bg-surface-alt"
              >
                <folder.icon className="h-[18px] w-[18px] text-ink-muted" aria-hidden="true" />
                <span className="flex-1 truncate text-[14px] font-medium text-ink">
                  {folder.label}
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-ink-faint">
                  {folder.count}
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
