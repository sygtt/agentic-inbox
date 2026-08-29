import React, { useEffect, useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'

interface OtpChipProps {
  code: string
  expiresIn?: string
  onCopied: () => void
  size?: 'row' | 'detail'
}

function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(value)
  }
}

export function OtpChip({ code, expiresIn, onCopied, size = 'row' }: OtpChipProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handle = (event: React.MouseEvent) => {
    event.stopPropagation()
    copyToClipboard(code)
    setCopied(true)
    onCopied()
  }

  const expired = expiresIn === 'expired'

  if (size === 'detail') {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={expired}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-150 ease-out ${
          expired
            ? 'border-line bg-surface-alt'
            : 'border-iris-soft bg-iris-soft active:bg-iris-soft/70'
        }`}
      >
        <span className="text-left">
          <span
            className={`block font-mono text-[24px] font-semibold tracking-[0.18em] ${
              expired ? 'text-ink-faint line-through' : 'text-iris-ink'
            }`}
          >
            {code}
          </span>
          <span className="mt-0.5 block text-[11.5px] font-medium text-ink-muted">
            {expired ? 'Code expired — request a new one' : `Expires in ${expiresIn}`}
          </span>
        </span>
        {!expired ? (
          <span className="flex items-center gap-1.5 rounded-lg bg-iris-ink px-3 py-2 text-[12.5px] font-semibold text-white">
            {copied ? (
              <CheckIcon className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <CopyIcon className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={expired}
      aria-label={expired ? 'Code expired' : `Copy one-time code ${code}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold transition-colors duration-150 ease-out ${
        expired
          ? 'bg-ink-faint/10 text-ink-faint'
          : 'bg-iris-soft text-iris-ink active:bg-iris-ink active:text-white'
      }`}
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden="true" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
      )}
      <span className={`font-mono tracking-[0.14em] ${expired ? 'line-through' : ''}`}>{code}</span>
      <span className="font-sans font-medium opacity-80">{copied ? 'copied' : 'tap to copy'}</span>
    </button>
  )
}
