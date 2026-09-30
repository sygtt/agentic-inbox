import React, { useState } from 'react'
import { ArchiveIcon, ArrowLeftRightIcon, ChevronRightIcon } from 'lucide-react'
import { useInbox } from '../contexts/InboxContext'
import { Avatar } from '../components/Chip'

interface ToggleRowProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({ label, hint, checked, onChange }: ToggleRowProps) {
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out active:bg-surface-alt"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-ink">{label}</span>
          {hint ? (
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">{hint}</span>
          ) : null}
        </span>
        <span
          className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200 ease-out ${
            checked ? 'bg-accent' : 'bg-ink-faint/30'
          }`}
        >
          <span
            className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-transform duration-200 ease-out ${
              checked ? 'translate-x-[21px]' : 'translate-x-[3px]'
            }`}
          />
        </span>
      </button>
    </li>
  )
}

export function Settings() {
  const {
    showSummaries,
    setShowSummaries,
    autoArchivePromos,
    setAutoArchivePromos,
    emails,
    showToast,
  } = useInbox()
  const [otpAutoCopy, setOtpAutoCopy] = useState(true)
  const [actionBadges, setActionBadges] = useState(true)

  const archived = emails.filter((email) => email.archived).length

  return (
    <>
      <header className="shrink-0 bg-bg px-4 pb-2 pt-2">
        <h1 className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">
          Settings
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-6">
        <div className="mx-4 flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
          <Avatar
            sender={{ name: 'Alex Rivera', email: '', initials: 'AR', tone: 'accent' }}
            size={40}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-ink">Alex Rivera</p>
            <p className="truncate text-[11.5px] text-ink-faint">alex@brightloop.dev</p>
          </div>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
        </div>

        <h2 className="px-4 pb-1.5 pt-4 text-[11.5px] font-semibold text-ink-faint">Assistant</h2>
        <ul className="border-y border-line bg-surface">
          <ToggleRow
            label="Summaries in the list"
            hint="Two lines of plain-language summary under each subject."
            checked={showSummaries}
            onChange={setShowSummaries}
          />
          <ToggleRow
            label="Required-action line"
            hint="Show the single next step the assistant extracted."
            checked={actionBadges}
            onChange={setActionBadges}
          />
          <ToggleRow
            label="Surface one-time codes"
            hint="Pull login codes onto the row for one-tap copy."
            checked={otpAutoCopy}
            onChange={setOtpAutoCopy}
          />
          <ToggleRow
            label="Auto-archive promotions"
            hint="Marketing mail skips the inbox and lands in Archive."
            checked={autoArchivePromos}
            onChange={(value) => {
              setAutoArchivePromos(value)
              showToast(value ? 'Promotions will skip the inbox' : 'Promotions stay in the inbox')
            }}
          />
        </ul>

        <h2 className="px-4 pb-1.5 pt-4 text-[11.5px] font-semibold text-ink-faint">Swipes</h2>
        <ul className="border-y border-line bg-surface">
          <li className="flex items-center gap-3 border-b border-line px-4 py-3">
            <ArrowLeftRightIcon className="h-[18px] w-[18px] text-ink-muted" aria-hidden="true" />
            <span className="flex-1 text-[14px] font-medium text-ink">Swipe right</span>
            <span className="text-[12.5px] text-ink-faint">Toggle read</span>
          </li>
          <li className="flex items-center gap-3 px-4 py-3">
            <ArchiveIcon className="h-[18px] w-[18px] text-ink-muted" aria-hidden="true" />
            <span className="flex-1 text-[14px] font-medium text-ink">Swipe left</span>
            <span className="text-[12.5px] text-ink-faint">Archive</span>
          </li>
        </ul>

        <p className="px-4 pt-4 text-[11.5px] leading-relaxed text-ink-faint">
          {archived} thread{archived === 1 ? '' : 's'} archived this session · agentic-inbox 1.0
        </p>
      </main>
    </>
  )
}
