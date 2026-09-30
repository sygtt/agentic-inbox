export type Tone = 'accent' | 'iris' | 'azure' | 'warm' | 'moss' | 'ruby' | 'neutral'

export type Classification =
  | 'needs_reply'
  | 'awaiting'
  | 'verification'
  | 'receipt'
  | 'calendar'
  | 'alert'
  | 'fyi'
  | 'promotion'

export type ActionKind = 'reply' | 'copy' | 'approve' | 'sign' | 'confirm' | 'review' | 'none'

export interface RequiredAction {
  /** Short imperative sentence: what the human must actually do. */
  label: string
  kind: ActionKind
  /** Optional deadline shown next to the action. */
  due?: string
}

export interface Sender {
  name: string
  email: string
  initials: string
  tone: Tone
}

export interface Email {
  id: string
  sender: Sender
  subject: string
  summary: string
  action: RequiredAction
  classification: Classification
  tags: string[]
  minutesAgo: number
  unread: boolean
  pinned: boolean
  archived: boolean
  snoozed: boolean
  /** One-time passcode extracted by the assistant, if any. */
  otp?: string
  otpExpiresIn?: string
  threadCount: number
  attachments?: string[]
  body: string[]
}

export type FolderKey = 'inbox' | 'archive' | 'snoozed' | 'sent' | 'drafts' | 'spam' | 'trash'

