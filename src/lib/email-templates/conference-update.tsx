import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { text } from './theme'
import { APP_URL, ConferenceShell, greet, Paragraphs } from './conference-shell'

interface Props { name?: string; code?: string; title?: string; body?: string; ctaLabel?: string; ctaUrl?: string }

const ConferenceUpdate = ({ name, code, title, body, ctaLabel, ctaUrl }: Props) => (
  <ConferenceShell
    preview={title || 'An update from the organizing team'}
    kicker="Update"
    title={title || 'An update from the organizing team'}
    cta={{ label: ctaLabel || 'See it in the app', href: ctaUrl?.startsWith('https://') ? ctaUrl : `${APP_URL}/updates` }}
    code={code}
  >
    <Text style={text}>{greet(name)}</Text>
    <Paragraphs body={body || 'Details of the update appear here.'} />
  </ConferenceShell>
)

export const template = {
  component: ConferenceUpdate,
  subject: (d: Record<string, any>) => d['title'] || 'Update, 11th Pan-IIM WMC',
  displayName: 'Update / notification',
  previewData: {
    name: 'Ananya Rao',
    title: 'Saturday paper sessions move to 9:15 AM',
    body: 'The morning paper block on 28 November now starts at 9:15 AM so the shuttle from town can arrive in time.\n\nYour Calendar already shows the new times.',
    ctaLabel: 'Open Calendar',
    ctaUrl: 'https://paniim.planos.in/calendar',
  },
} satisfies TemplateEntry
