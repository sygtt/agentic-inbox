import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

const EASE = [0.23, 1, 0.32, 1] as const

export function BottomSheet({ open, onClose, title, subtitle, children, footer }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open ? (
        <React.Fragment key="sheet">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-x-0 bottom-0 z-50 max-h-[82%] overflow-hidden rounded-t-[22px] border-t border-line bg-surface"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.26, ease: EASE }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90) onClose()
            }}
          >
            <div className="flex justify-center pt-2">
              <span className="h-1 w-9 rounded-full bg-ink-faint/35" />
            </div>
            <header className="px-4 pb-2 pt-3">
              <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</p> : null}
            </header>
            <div className="max-h-[52vh] overflow-y-auto no-scrollbar px-4 pb-2">{children}</div>
            {footer ? <div className="border-t border-line px-4 py-3">{footer}</div> : null}
            <div className="h-4" />
          </motion.div>
        </React.Fragment>
      ) : null}
    </AnimatePresence>
  )
}

