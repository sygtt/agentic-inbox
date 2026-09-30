import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SparklesIcon } from 'lucide-react'
import { EmailRow } from '../components/EmailRow'
import { QuickActionsSheet } from '../components/QuickActionsSheet'
import { TagSheet } from '../components/TagSheet'
import { useInbox } from '../contexts/InboxContext'
import { ACTIONABLE } from '../data/classifications'
import type { Classification, Email } from '../types/email'

type FilterKey = 'all' | 'needs' | 'awaiting' | 'codes' | 'receipts' | 'quiet'

const FILTERS: { key: FilterKey; label: string; match: (email: Email) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  {
    key: 'needs',
    label: 'Needs you',
    match: (email) => ACTIONABLE.includes(email.classification) && email.action.kind !== 'none',
  },
  { key: 'awaiting', label: 'Awaiting', match: (email) => email.classification === 'awaiting' },
  { key: 'codes', label: 'Codes', match: (email) => email.classification === 'verification' },
  { key: 'receipts', label: 'Receipts', match: (email) => email.classification === 'receipt' },
  {
    key: 'quiet',
    label: 'Low priority',
    match: (email) =>
      (['fyi', 'promotion'] as Classification[]).includes(email.classification),
  },
]

export function Inbox() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { emails, archive, showToast, setRead } = useInbox()
  const [actionsFor, setActionsFor] = useState<Email | null>(null)
  const [tagsFor, setTagsFor] = useState<Email | null>(null)

  const activeKey = (params.get('filter') as FilterKey) ?? 'all'
  const active = FILTERS.find((filter) => filter.key === activeKey) ?? FILTERS[0]

  const inbox = useMemo(
    () =>
      emails
        .filter((email) => !email.archived && !email.snoozed)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.minutesAgo - b.minutesAgo),
    [emails],
  )

  const filtered = inbox.filter(active.match)
  const needsYou = inbox.filter(FILTERS[1].match)
  const rest = inbox.filter((email) => !FILTERS[1].match(email))
  const unread = inbox.filter((email) => email.unread).length
  const promos = inbox.filter((email) => email.classification === 'promotion')

  const open = (email: Email) => {
    setRead(email.id, true)
    navigate(`/email/${email.id}`)
  }

  const sweepPromos = () => {
    promos.forEach((email) => archive(email.id))
    showToast(`Archived ${promos.length} promotional email${promos.length === 1 ? '' : 's'}`)
  }

  const groups =
    active.key === 'all'
      ? [
          { title: 'Needs you', hint: `${needsYou.length}`, items: needsYou },
          { title: 'Everything else', hint: `${rest.length}`, items: rest },
        ]
      : [{ title: active.label, hint: `${filtered.length}`, items: filtered }]

  return (
    <>
      <header className="shrink-0 bg-bg px-4 pb-2 pt-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h1 className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">
              Inbox
            </h1>
            <p className="mt-1.5 text-[12px] text-ink-muted">
              <span className="font-semibold text-accent-ink">{needsYou.length} need you</span>
              <span className="text-ink-faint"> · {unread} unread · {inbox.length} total</span>
            </p>
          </div>
          {promos.length > 0 ? (
            <button
              type="button"
              onClick={sweepPromos}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-muted transition-colors duration-150 ease-out active:bg-ink-faint/10"
            >
              <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Sweep {promos.length}
            </button>
          ) : null}
        </div>

        <div className="-mx-4 mt-2.5 overflow-x-auto no-scrollbar px-4">
          <div className="flex gap-1.5">
            {FILTERS.map((filter) => {
              const isActive = filter.key === active.key
              const count = inbox.filter(filter.match).length
              return (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    setParams(filter.key === 'all' ? {} : { filter: filter.key }, { replace: true })
                  }
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150 ease-out ${
                    isActive
                      ? 'bg-ink text-bg'
                      : 'border border-line bg-surface text-ink-muted active:bg-ink-faint/10'
                  }`}
                >
                  {filter.label}
                  <span className={isActive ? 'text-bg/60' : 'text-ink-faint'}> {count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-6">
        {filtered.length === 0 ? (
          <div className="mx-4 mt-10 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
            <p className="text-[14px] font-semibold text-ink">Nothing here</p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Triaged everything in this view. Swipe left on any thread to archive it.
            </p>
          </div>
        ) : (
          groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.title}>
                <h2 className="sticky top-0 z-10 flex items-center gap-1.5 bg-bg/95 px-4 py-1.5 text-[11.5px] font-semibold text-ink-faint backdrop-blur">
                  {group.title}
                  <span className="text-ink-faint/70">{group.hint}</span>
                </h2>
                <ul>
                  {group.items.map((email) => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      onOpen={open}
                      onLongPress={setActionsFor}
                    />
                  ))}
                </ul>
              </section>
            ))
        )}
        <p className="px-4 pt-4 text-center text-[11px] text-ink-faint">
          Swipe left to archive · swipe right to toggle read · hold for quick actions
        </p>
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
