import React from 'react'
import { CLASSIFICATIONS, TONE_AVATAR, TONE_CHIP } from '../data/classifications'
import type { Classification, Sender } from '../types/email'

interface ChipProps {
  children: React.ReactNode
  className?: string
}

export function Chip({ children, className = '' }: ChipProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-[2px] text-[10.5px] font-semibold leading-none ${className}`}
    >
      {children}
    </span>
  )
}

export function ClassificationChip({
  classification,
  withIcon = true,
}: {
  classification: Classification
  withIcon?: boolean
}) {
  const meta = CLASSIFICATIONS[classification]
  const Icon = meta.icon
  return (
    <Chip className={TONE_CHIP[meta.tone]}>
      {withIcon ? <Icon className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" /> : null}
      {meta.label}
    </Chip>
  )
}

export function TagChip({ label }: { label: string }) {
  return (
    <Chip className="border border-line bg-transparent font-medium text-ink-muted">{label}</Chip>
  )
}

export function Avatar({ sender, size = 34 }: { sender: Sender; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${TONE_AVATAR[sender.tone]}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {sender.initials}
    </span>
  )
}

