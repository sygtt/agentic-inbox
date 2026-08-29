import React from 'react'
import { BatteryFullIcon, SignalHighIcon, WifiIcon } from 'lucide-react'
import { clockLabel } from '../utils/time'

interface PhoneFrameProps {
  appearance: 'light' | 'dark'
  children: React.ReactNode
}

export function PhoneFrame({ appearance, children }: PhoneFrameProps) {
  return (
    <div
      data-theme={appearance}
      className="flex min-h-full w-full items-center justify-center bg-shell p-0 sm:p-6"
    >
      <div className="relative flex h-[100svh] w-full max-w-[390px] flex-col overflow-hidden bg-bg text-ink sm:h-[844px] sm:rounded-phone sm:border-[9px] sm:border-black sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-6 pb-1 pt-3 text-[12px] font-semibold text-ink">
          <span className="tabular-nums">{clockLabel()}</span>
          <span className="flex items-center gap-1.5 text-ink">
            <SignalHighIcon className="h-[13px] w-[13px]" aria-hidden="true" />
            <WifiIcon className="h-[13px] w-[13px]" aria-hidden="true" />
            <BatteryFullIcon className="h-[15px] w-[15px]" aria-hidden="true" />
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
