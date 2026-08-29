import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { InboxProvider, type Density } from './contexts/InboxContext'
import { PhoneFrame } from './components/PhoneFrame'
import { TabBar } from './components/TabBar'
import { Toast } from './components/Toast'
import { Inbox } from './pages/Inbox'
import { EmailDetail } from './pages/EmailDetail'
import { Folders } from './pages/Folders'
import { FolderView } from './pages/FolderView'
import { Search } from './pages/Search'
import { Settings } from './pages/Settings'

interface AppProps {
  /** Row density for one-handed scanning. */
  density?: Density
  /** Show the assistant's two-line summary on every inbox row. */
  showAiSummaries?: boolean
  /** Light or dark treatment for the whole app. */
  appearance?: 'light' | 'dark'
}

export function App({
  density = 'comfortable',
  showAiSummaries = true,
  appearance = 'light',
}: AppProps) {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <InboxProvider density={density} initialShowSummaries={showAiSummaries}>
          <PhoneFrame appearance={appearance}>
            <div className="flex min-h-0 flex-1 flex-col">
              <Routes>
                <Route path="/" element={<Inbox />} />
                <Route path="/email/:id" element={<EmailDetail />} />
                <Route path="/folders" element={<Folders />} />
                <Route path="/folder/:key" element={<FolderView />} />
                <Route path="/search" element={<Search />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Inbox />} />
              </Routes>
            </div>
            <TabBar />
            <Toast />
          </PhoneFrame>
        </InboxProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}

