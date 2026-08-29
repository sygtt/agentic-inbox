import React, { useEffect, useState } from 'react'
import { CheckIcon, PlusIcon } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { useInbox } from '../contexts/InboxContext'
import type { Email } from '../types/email'

interface TagSheetProps {
  email: Email | null
  open: boolean
  onClose: () => void
}

export function TagSheet({ email, open, onClose }: TagSheetProps) {
  const { allTags, setTags, showToast } = useInbox()
  const [selected, setSelected] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (open && email) {
      setSelected(email.tags)
      setDraft('')
    }
  }, [open, email])

  const toggle = (tag: string) =>
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))

  const save = () => {
    if (!email) return
    setTags(email.id, selected)
    showToast(selected.length ? `Tagged ${selected.length}× on this thread` : 'Tags cleared')
    onClose()
  }

  const options = Array.from(new Set([...allTags, ...selected]))

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Tags"
      subtitle={email ? email.subject : undefined}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-line text-[13.5px] font-semibold text-ink-muted transition-colors duration-150 ease-out active:bg-ink-faint/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="h-10 flex-[1.4] rounded-xl bg-accent text-[13.5px] font-semibold text-white transition-transform duration-100 ease-out active:scale-[0.98]"
          >
            Save tags
          </button>
        </div>
      }
    >
      <ul className="divide-y divide-line">
        {options.map((tag) => {
          const active = selected.includes(tag)
          return (
            <li key={tag}>
              <button
                type="button"
                onClick={() => toggle(tag)}
                aria-pressed={active}
                className="flex w-full items-center justify-between py-2.5 text-left transition-colors duration-150 ease-out active:bg-ink-faint/[0.08]"
              >
                <span
                  className={`text-[14px] ${active ? 'font-semibold text-ink' : 'text-ink-muted'}`}
                >
                  {tag}
                </span>
                <span
                  className={`flex h-[21px] w-[21px] items-center justify-center rounded-full border ${
                    active ? 'border-accent bg-accent text-white' : 'border-line text-transparent'
                  }`}
                >
                  <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const value = draft.trim()
          if (!value) return
          setSelected((prev) => (prev.includes(value) ? prev : [...prev, value]))
          setDraft('')
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="New tag"
          aria-label="Create a new tag"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-alt px-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors duration-150 ease-out active:bg-ink-faint/10"
          aria-label="Add tag"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </BottomSheet>
  )
}
