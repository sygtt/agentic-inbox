import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useInbox } from '../contexts/InboxContext'

export function Toast() {
  const { toast, dismissToast } = useInbox()

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="pointer-events-auto absolute bottom-[86px] left-3 right-3 z-30 flex items-center gap-3 rounded-xl bg-ink px-3.5 py-2.5"
        >
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-bg">
            {toast.message}
          </span>
          {toast.undo ? (
            <button
              type="button"
              onClick={() => {
                toast.undo?.()
                dismissToast()
              }}
              className="shrink-0 text-[13px] font-semibold text-accent"
            >
              Undo
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
