import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, XIcon } from 'lucide-react'
import { EmailRow } from '../components/EmailRow'
import { QuickActionsSheet } from '../components/QuickActionsSheet'
import { TagSheet } from '../components/TagSheet'
import { useInbox } from '../contexts/InboxContext'
import type { Email } from '../types/email'

const SUGGESTIONS = ['invoice', 'code', 'NDA', 'headcount', 'Sunday']

export function Search() {
  const navigate = useNavigate()
  const { emails, allTags, setRead } = useInbox()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [actionsFor, setActionsFor] = useState<Email | null>(null)
  const [tagsFor, setTagsFor] = useState<Email | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q && !tag) return []
    return emails.filter((email) => {
      const matchesTag = !tag || email.tags.includes(tag)
      const haystack = [
        email.sender.name,
        email.sender.email,
        email.subject,
        email.summary,
        email.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return matchesTag && (!q || haystack.includes(q))
    })
  }, [emails, query, tag])

  const searching = Boolean(query.trim() || tag)

  return (
    <>
      <header className="shrink-0 bg-bg px-4 pb-2 pt-2">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, subjects, summaries"
            aria-label="Search mail"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-ink-faint/15 text-ink-muted"
            >
              <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="-mx-4 mt-2 overflow-x-auto no-scrollbar px-4">
          <div className="flex gap-1.5">
            {allTags.map((item) => {
              const isActive = tag === item
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setTag(isActive ? null : item)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150 ease-out ${
                    isActive
                      ? 'bg-ink text-bg'
                      : 'border border-line bg-surface text-ink-muted active:bg-ink-faint/10'
                  }`}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-6">
        {!searching ? (
          <div className="px-4 pt-3">
            <h2 className="text-[11.5px] font-semibold text-ink-faint">Try</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuery(item)}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors duration-150 ease-out active:bg-surface-alt"
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
              Search reads the assistant's summaries too, so a thread matches even when the keyword
              never appears in its subject line.
            </p>
          </div>
        ) : results.length === 0 ? (
          <p className="px-4 pt-8 text-center text-[13px] text-ink-muted">No matching threads.</p>
        ) : (
          <>
            <h2 className="px-4 py-1.5 text-[11.5px] font-semibold text-ink-faint">
              {results.length} result{results.length === 1 ? '' : 's'}
            </h2>
            <ul>
              {results.map((email) => (
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
          </>
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
