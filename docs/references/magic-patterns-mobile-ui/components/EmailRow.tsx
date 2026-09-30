import React, { useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { ArchiveIcon, MailOpenIcon, MailIcon, PaperclipIcon, PinIcon } from 'lucide-react'
import { Avatar, ClassificationChip, TagChip } from './Chip'
import { OtpChip } from './OtpChip'
import { ACTION_ICON } from '../data/classifications'
import { useInbox } from '../contexts/InboxContext'
import { relativeLabel } from '../utils/time'
import type { Email } from '../types/email'

interface EmailRowProps {
  email: Email
  onOpen: (email: Email) => void
  onLongPress: (email: Email) => void
  swipeable?: boolean
}

const ARCHIVE_THRESHOLD = 96
const READ_THRESHOLD = 84

export function EmailRow({ email, onOpen, onLongPress, swipeable = true }: EmailRowProps) {
  const { density, showSummaries, archive, toggleRead, showToast } = useInbox()
  const x = useMotionValue(0)
  const archiveOpacity = useTransform(x, [-ARCHIVE_THRESHOLD, -18], [1, 0.25])
  const readOpacity = useTransform(x, [18, READ_THRESHOLD], [0.25, 1])
  const draggedRef = useRef(false)
  const pressTimer = useRef<number | null>(null)
  const [pressing, setPressing] = useState(false)

  const compact = density === 'compact'
  const ActionIcon = ACTION_ICON[email.action.kind]
  const visibleTags = email.tags.slice(0, 2)
  const extraTags = email.tags.length - visibleTags.length

  const clearPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current)
    pressTimer.current = null
    setPressing(false)
  }

  const startPress = () => {
    setPressing(true)
    pressTimer.current = window.setTimeout(() => {
      draggedRef.current = true
      onLongPress(email)
      clearPress()
    }, 420)
  }

  /** Keeps the tap-to-open click from firing right after a swipe or long press. */
  const releaseGuard = () => {
    clearPress()
    window.setTimeout(() => {
      draggedRef.current = false
    }, 240)
  }

  return (
    <li className="relative isolate overflow-hidden bg-surface-alt">
      {swipeable ? (
        <div className="absolute inset-0 flex items-center justify-between" aria-hidden="true">
          <motion.span
            style={{ opacity: readOpacity }}
            className="flex items-center gap-1.5 pl-5 text-[12px] font-semibold text-moss-ink"
          >
            {email.unread ? (
              <MailOpenIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <MailIcon className="h-4 w-4" aria-hidden="true" />
            )}
            {email.unread ? 'Read' : 'Unread'}
          </motion.span>
          <motion.span
            style={{ opacity: archiveOpacity }}
            className="flex items-center gap-1.5 pr-5 text-[12px] font-semibold text-warm-ink"
          >
            Archive
            <ArchiveIcon className="h-4 w-4" aria-hidden="true" />
          </motion.span>
        </div>
      ) : null}

      <motion.div
        style={{ x, backgroundColor: pressing ? 'var(--surface-2)' : 'var(--surface)' }}
        drag={swipeable ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: -130, right: 130 }}
        dragElastic={0.08}
        onDragStart={() => {
          draggedRef.current = true
          clearPress()
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -ARCHIVE_THRESHOLD) {
            archive(email.id)
          } else if (info.offset.x > READ_THRESHOLD) {
            toggleRead(email.id)
          }
          animate(x, 0, { duration: 0.22, ease: [0.23, 1, 0.32, 1] })
          window.setTimeout(() => {
            draggedRef.current = false
          }, 60)
        }}
        onPointerDown={startPress}
        onPointerUp={releaseGuard}
        onPointerCancel={releaseGuard}
        onPointerLeave={releaseGuard}
        onClick={() => {
          if (draggedRef.current) return
          onOpen(email)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(email)
          }
        }}
        aria-label={`${email.sender.name}: ${email.subject}`}
        className={`relative flex cursor-pointer gap-2.5 border-b border-line pl-3 pr-3.5 ${
          compact ? 'py-2' : 'py-2.5'
        }`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-[2.5px] ${email.unread ? 'bg-accent' : 'bg-transparent'}`}
          aria-hidden="true"
        />

        <Avatar sender={email.sender} size={compact ? 28 : 32} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={`truncate text-[13.5px] leading-tight ${
                email.unread ? 'font-semibold text-ink' : 'font-medium text-ink-muted'
              }`}
            >
              {email.sender.name}
            </span>
            {email.threadCount > 1 ? (
              <span className="shrink-0 text-[11px] font-medium text-ink-faint">
                {email.threadCount}
              </span>
            ) : null}
            {email.pinned ? (
              <PinIcon className="h-3 w-3 shrink-0 text-accent" aria-label="Pinned" />
            ) : null}
            {email.attachments?.length ? (
              <PaperclipIcon
                className="h-3 w-3 shrink-0 text-ink-faint"
                aria-label="Has attachment"
              />
            ) : null}
            <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-ink-faint">
              {relativeLabel(email.minutesAgo)}
            </span>
          </div>

          <p
            className={`truncate text-[13px] leading-snug ${
              email.unread ? 'font-medium text-ink' : 'text-ink'
            }`}
          >
            {email.subject}
          </p>

          {showSummaries && !compact ? (
            <p className="mt-[3px] line-clamp-2 text-[12px] leading-[1.4] text-ink-muted">
              {email.summary}
            </p>
          ) : null}

          <div className="mt-[5px] flex items-center gap-1.5 overflow-hidden">
            <ClassificationChip classification={email.classification} />
            {visibleTags.map((tag) => (
              <TagChip key={tag} label={tag} />
            ))}
            {extraTags > 0 ? <TagChip label={`+${extraTags}`} /> : null}
          </div>

          <div className="mt-[5px] flex items-center gap-2">
            {email.otp ? (
              <OtpChip
                code={email.otp}
                expiresIn={email.otpExpiresIn}
                onCopied={() => showToast(`Code ${email.otp} copied`)}
              />
            ) : (
              <span
                className={`flex min-w-0 items-center gap-1 text-[11.5px] leading-tight ${
                  email.action.kind === 'none' ? 'text-ink-faint' : 'font-semibold text-accent-ink'
                }`}
              >
                <ActionIcon className="h-3 w-3 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                <span className="truncate">{email.action.label}</span>
                {email.action.due ? (
                  <span className="shrink-0 font-medium text-ink-faint">{email.action.due}</span>
                ) : null}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </li>
  )
}
