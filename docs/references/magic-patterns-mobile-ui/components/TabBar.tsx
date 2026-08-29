import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { FolderIcon, InboxIcon, SearchIcon, SettingsIcon } from 'lucide-react'
import { useInbox } from '../contexts/InboxContext'

const TABS = [
  { to: '/', label: 'Inbox', icon: InboxIcon },
  { to: '/folders', label: 'Folders', icon: FolderIcon },
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function TabBar() {
  const { emails } = useInbox()
  const { pathname } = useLocation()
  const unread = emails.filter((email) => email.unread && !email.archived && !email.snoozed).length

  // Detail and folder views own their full height, including their own bottom bar.
  if (pathname.startsWith('/email/') || pathname.startsWith('/folder/')) return null

  return (
    <nav
      aria-label="Primary"
      className="shrink-0 border-t border-line bg-surface/95 pb-5 pt-1.5 backdrop-blur"
    >
      <ul className="flex">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-[3px] py-1 text-[10.5px] font-medium transition-colors duration-150 ease-out ${
                  isActive ? 'text-accent' : 'text-ink-faint'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <tab.icon
                      className="h-[21px] w-[21px]"
                      strokeWidth={isActive ? 2.4 : 1.9}
                      aria-hidden="true"
                    />
                    {tab.label === 'Inbox' && unread > 0 ? (
                      <span className="absolute -right-2 -top-1 min-w-[15px] rounded-full bg-accent px-1 text-center text-[9px] font-bold leading-[15px] text-white">
                        {unread}
                      </span>
                    ) : null}
                  </span>
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
