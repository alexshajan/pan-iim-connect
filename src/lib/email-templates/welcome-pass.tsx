import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { text } from './theme'
import { APP_URL, ConferenceShell, greet, listItem } from './conference-shell'

interface Props { name?: string; code?: string; role?: string }

const WelcomePass = ({ name, code, role }: Props) => (
  <ConferenceShell
    preview="Your 11th Pan-IIM WMC pass is ready in the app"
    kicker="Hello from Shillong"
    title="Your delegate pass is ready"
    cta={{ label: 'Open my pass', href: `${APP_URL}/me` }}
    code={code}
  >
    <Text style={text}>{greet(name)}</Text>
    <Text style={text}>
      Welcome to the 11th Pan-IIM WMC{role ? `, we have you down as ${role}` : ''}. Your pass, the
      full Calendar and live updates now live in one place. Sign in with this email address to see them.
    </Text>
    <Text style={listItem}>Home, what's on next, and anything urgent</Text>
    <Text style={listItem}>Calendar, every session, with your own plan</Text>
    <Text style={{ ...listItem, marginBottom: '22px' }}>Me, your pass and QR for check-in</Text>
  </ConferenceShell>
)

export const template = {
  component: WelcomePass,
  subject: 'Your 11th Pan-IIM WMC pass is ready',
  displayName: 'Hello, pass ready',
  previewData: { name: 'Ananya Rao', code: 'WMC-NJEB', role: 'a presenter' },
} satisfies TemplateEntry
