import type { ComponentType } from 'react'
import { template as welcomePass } from './welcome-pass'
import { template as missingInfo } from './missing-info'
import { template as conferenceUpdate } from './conference-update'
import { template as appNudge } from './app-nudge'
import { template as presentationSlot } from './presentation-slot'
import { template as accountLinked } from './account-linked'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient, overrides caller-provided recipientEmail when set. */
  to?: string
}

/** Template registry, maps template names to their React Email components. */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-pass': welcomePass,
  'missing-info': missingInfo,
  'conference-update': conferenceUpdate,
  'app-nudge': appNudge,
  'presentation-slot': presentationSlot,
  'account-linked': accountLinked,
}
