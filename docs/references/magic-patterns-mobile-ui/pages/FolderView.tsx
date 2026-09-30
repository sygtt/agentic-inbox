import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon } from 'lucide-react'
import { EmailRow } from '../components/EmailRow'
import { QuickActionsSheet } from '../components/QuickActionsSheet'
import { TagSheet } from '../components/TagSheet'
import { useInbox } from '../contexts/InboxContext'
import type { Email, FolderKey } from '../types/email'

const TITLES: Record<FolderKey, string> = {
  inbox: 'Inbox',
  archive: 'Archive',
  snoozed: 'Snoozed',
  sent: 'Sent',
  drafts: 'Drafts',
  spam: 'Spam',
  trash: 'Trash',
}

export function FolderView() {
  const { key = 'archive' } = useParams()
  const folderKey = (Object.keys(TITLES) as FolderKey[]).includes(key as FolderKey)
    ? (key as FolderKey)
    : 'archive'
  const navigate = useNavigate()
  const { emails, setRead } = useInbox()
  const [actionsFor, setActionsFor] = useState<Email | null>(null)
  const [tagsFor, setTagsFor] = useState<Email | null>(null)

  const items = emails.filter((email) => {
    if (folderKey === 'inbox') return !email.archived && !email.snoozed
    if (folderKey === 'archive') return email.archived
    if (folderKey === 'snoozed') return email.snoozed
    return false
  })

  return (
    <>
      <header className="relative flex shrink-0 items-center gap-1 border-b border-line bg-surface px-1.5 py-1.5">
        <button
          type="button"
          onClick={() => navigate('/folders')}
          className="flex h-9 items-center gap-0.5 rounded-lg pl-1 pr-2 text-[13.5px] font-semibold text-accent transition-colors duration-150 ease-out active:bg-accent-soft"
        >
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
          Folders
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[14px] font-semibold text-ink">
          {TITLES[folderKey]}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-6">
        {items.length === 0 ? (
          <div className="mx-4 mt-10 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
            <p className="text-[14px] font-semibold text-ink">{TITLES[folderKey]} is empty</p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Threads you archive or snooze from the inbox land here.
            </p>
          </div>
        ) : (
          <ul>
            {items.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                swipeable={false}
                onOpen={(item) => {
                  setRead(item.id, true)
                  navigate(`/email/${item.id}`)
                }}
                onLongPress={setActionsFor}
              />
            ))}
          </ul>
        )}
      </main>

      <QuickActionsSheet
        email={actionsFor}
        open={Boolean(actionsFor)}
        onClose={() => setActionsFor(null)}
        onOpenTags={() => setTagsFor(actionsFor)}
      />
      <TagSheet email={tagsFor} open={Boolean(tagsFor)} onClose={() => setTagsFor(null)} />
    </>
  )
}
