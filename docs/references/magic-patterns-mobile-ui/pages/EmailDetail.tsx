import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlarmClockIcon,
  ArchiveIcon,
  ChevronLeftIcon,
  CornerUpLeftIcon,
  EllipsisIcon,
  PaperclipIcon,
  TagIcon,
} from 'lucide-react'
import { Avatar, ClassificationChip, TagChip } from '../components/Chip'
import { OtpChip } from '../components/OtpChip'
import { QuickActionsSheet } from '../components/QuickActionsSheet'
import { TagSheet } from '../components/TagSheet'
import { useInbox } from '../contexts/InboxContext'
import { ACTION_ICON, CLASSIFICATIONS } from '../data/classifications'
import { absoluteLabel } from '../utils/time'

export function EmailDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { getEmail, archive, snooze, showToast } = useInbox()
  const [tagsOpen, setTagsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const email = getEmail(id)

  if (!email) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-[14px] font-semibold text-ink">This thread is gone</p>
        <Link to="/" className="text-[13px] font-semibold text-accent">
          Back to Inbox
        </Link>
      </main>
    )
  }

  const meta = CLASSIFICATIONS[email.classification]
  const ActionIcon = ACTION_ICON[email.action.kind]

  return (
    <>
      <header className="flex shrink-0 items-center gap-1 border-b border-line bg-surface px-1.5 py-1.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 items-center gap-0.5 rounded-lg pl-1 pr-2 text-[13.5px] font-semibold text-accent transition-colors duration-150 ease-out active:bg-accent-soft"
        >
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
          Inbox
        </button>
        <span className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => {
              archive(email.id)
              navigate('/')
            }}
            aria-label="Archive"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 ease-out active:bg-ink-faint/10"
          >
            <ArchiveIcon className="h-[19px] w-[19px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setActionsOpen(true)}
            aria-label="More actions"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 ease-out active:bg-ink-faint/10"
          >
            <EllipsisIcon className="h-[19px] w-[19px]" aria-hidden="true" />
          </button>
        </span>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar bg-bg">
        <div className="bg-surface px-4 pb-3.5 pt-3">
          <h1 className="text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ink">
            {email.subject}
          </h1>
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar sender={email.sender} size={38} />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-ink">{email.sender.name}</p>
              <p className="truncate text-[11.5px] text-ink-faint">{email.sender.email}</p>
            </div>
            <span className="ml-auto shrink-0 text-right text-[11px] text-ink-faint">
              {absoluteLabel(email.minutesAgo)}
              {email.threadCount > 1 ? (
                <span className="block">{email.threadCount} messages</span>
              ) : null}
            </span>
          </div>
        </div>

        <section
          aria-label="Assistant summary"
          className="mt-2 border-y border-line bg-surface px-4 py-3"
        >
          <p className="text-[11px] font-semibold text-ink-faint">Assistant summary</p>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-ink">{email.summary}</p>

          <div className="mt-3 flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2.5">
            <ActionIcon
              className="mt-[1px] h-4 w-4 shrink-0 text-accent-ink"
              strokeWidth={2.4}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug text-accent-ink">
                {email.action.label}
              </p>
              <p className="mt-0.5 text-[11.5px] text-accent-ink/75">
                {email.action.due ? `Due ${email.action.due}` : 'No deadline detected'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <ClassificationChip classification={email.classification} />
            {email.tags.map((tag) => (
              <TagChip key={tag} label={tag} />
            ))}
            <button
              type="button"
              onClick={() => setTagsOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-1.5 py-[3px] text-[10.5px] font-semibold text-ink-muted transition-colors duration-150 ease-out active:bg-ink-faint/10"
            >
              <TagIcon className="h-3 w-3" aria-hidden="true" />
              Edit tags
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">{meta.blurb}</p>
        </section>

        {email.otp ? (
          <section aria-label="One-time code" className="mt-2 bg-surface px-4 py-3">
            <p className="text-[11px] font-semibold text-ink-faint">One-time code</p>
            <div className="mt-2">
              <OtpChip
                code={email.otp}
                expiresIn={email.otpExpiresIn}
                size="detail"
                onCopied={() => showToast(`Code ${email.otp} copied`)}
              />
            </div>
          </section>
        ) : null}

        <article className="mt-2 bg-surface px-4 py-4">
          {email.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mb-3 text-[14px] leading-[1.6] text-ink">
              {paragraph}
            </p>
          ))}
          {email.attachments?.length ? (
            <ul className="mt-1 space-y-2">
              {email.attachments.map((file) => (
                <li
                  key={file}
                  className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5"
                >
                  <PaperclipIcon className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                  <span className="truncate text-[13px] font-medium text-ink">{file}</span>
                  <span className="ml-auto shrink-0 text-[11.5px] font-semibold text-accent">
                    Open
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-[11.5px] text-ink-faint">
            — {email.sender.name.split(' ')[0]}
          </p>
        </article>
      </main>

      <div className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-3 pb-6 pt-2.5">
        <button
          type="button"
          onClick={() => showToast('Reply drafted with your summary')}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-[14px] font-semibold text-white transition-transform duration-100 ease-out active:scale-[0.98]"
        >
          <CornerUpLeftIcon className="h-4 w-4" aria-hidden="true" />
          Reply
        </button>
        <button
          type="button"
          onClick={() => {
            snooze(email.id)
            navigate('/')
          }}
          aria-label="Snooze"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors duration-150 ease-out active:bg-ink-faint/10"
        >
          <AlarmClockIcon className="h-[19px] w-[19px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setTagsOpen(true)}
          aria-label="Tags"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors duration-150 ease-out active:bg-ink-faint/10"
        >
          <TagIcon className="h-[19px] w-[19px]" aria-hidden="true" />
        </button>
      </div>

      <QuickActionsSheet
        email={email}
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onOpenTags={() => setTagsOpen(true)}
      />
      <TagSheet email={email} open={tagsOpen} onClose={() => setTagsOpen(false)} />
    </>
  )
}
