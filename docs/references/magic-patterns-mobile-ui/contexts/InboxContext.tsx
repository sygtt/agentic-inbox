import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { emails as seedEmails } from '../data/emails'
import { ALL_TAGS } from '../data/classifications'
import type { Email } from '../types/email'

export type Density = 'comfortable' | 'compact'

interface ToastState {
  id: number
  message: string
  undo?: () => void
}

interface InboxContextValue {
  emails: Email[]
  allTags: string[]
  density: Density
  showSummaries: boolean
  setShowSummaries: (value: boolean) => void
  autoArchivePromos: boolean
  setAutoArchivePromos: (value: boolean) => void
  getEmail: (id: string) => Email | undefined
  archive: (id: string) => void
  unarchive: (id: string) => void
  setRead: (id: string, read: boolean) => void
  toggleRead: (id: string) => void
  togglePin: (id: string) => void
  snooze: (id: string) => void
  setTags: (id: string, tags: string[]) => void
  toast: ToastState | null
  showToast: (message: string, undo?: () => void) => void
  dismissToast: () => void
}

const InboxContext = createContext<InboxContextValue | null>(null)

interface ProviderProps {
  children: React.ReactNode
  density: Density
  initialShowSummaries: boolean
}

export function InboxProvider({ children, density, initialShowSummaries }: ProviderProps) {
  const [list, setList] = useState<Email[]>(seedEmails)
  const [showSummaries, setShowSummaries] = useState(initialShowSummaries)
  const [autoArchivePromos, setAutoArchivePromos] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<number | null>(null)

  const patch = useCallback((id: string, changes: Partial<Email>) => {
    setList((prev) => prev.map((email) => (email.id === id ? { ...email, ...changes } : email)))
  }, [])

  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const showToast = useCallback((message: string, undo?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    const id = Date.now()
    setToast({ id, message, undo })
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  const archive = useCallback(
    (id: string) => {
      patch(id, { archived: true, unread: false })
      showToast('Archived', () => patch(id, { archived: false }))
    },
    [patch, showToast],
  )

  const unarchive = useCallback(
    (id: string) => {
      patch(id, { archived: false })
      showToast('Moved back to Inbox')
    },
    [patch, showToast],
  )

  const setRead = useCallback((id: string, read: boolean) => patch(id, { unread: !read }), [patch])

  const toggleRead = useCallback(
    (id: string) => {
      setList((prev) =>
        prev.map((email) => (email.id === id ? { ...email, unread: !email.unread } : email)),
      )
    },
    [],
  )

  const togglePin = useCallback((id: string) => {
    setList((prev) =>
      prev.map((email) => (email.id === id ? { ...email, pinned: !email.pinned } : email)),
    )
  }, [])

  const snooze = useCallback(
    (id: string) => {
      patch(id, { snoozed: true })
      showToast('Snoozed until 9:00 tomorrow', () => patch(id, { snoozed: false }))
    },
    [patch, showToast],
  )

  const setTags = useCallback((id: string, tags: string[]) => patch(id, { tags }), [patch])

  const getEmail = useCallback((id: string) => list.find((email) => email.id === id), [list])

  const allTags = useMemo(() => {
    const fromData = new Set<string>(ALL_TAGS)
    list.forEach((email) => email.tags.forEach((tag) => fromData.add(tag)))
    return Array.from(fromData)
  }, [list])

  const value = useMemo<InboxContextValue>(
    () => ({
      emails: list,
      allTags,
      density,
      showSummaries,
      setShowSummaries,
      autoArchivePromos,
      setAutoArchivePromos,
      getEmail,
      archive,
      unarchive,
      setRead,
      toggleRead,
      togglePin,
      snooze,
      setTags,
      toast,
      showToast,
      dismissToast,
    }),
    [
      list,
      allTags,
      density,
      showSummaries,
      autoArchivePromos,
      getEmail,
      archive,
      unarchive,
      setRead,
      toggleRead,
      togglePin,
      snooze,
      setTags,
      toast,
      showToast,
      dismissToast,
    ],
  )

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be used inside InboxProvider')
  return ctx
}
