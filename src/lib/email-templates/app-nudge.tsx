import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { text } from './theme'
import { APP_URL, ConferenceShell, greet, listItem } from './conference-shell'

interface Props { name?: string; code?: string; session?: string }

const AppNudge = ({ name, code, session }: Props) => (
  <ConferenceShell
    preview="Two minutes now saves a queue at the registration desk"
    kicker="Before you travel"
    title="Sign in once, skip the queue"
    cta={{ label: 'Sign in to the app', href: `${APP_URL}/auth` }}
    code={code}
  >
    <Text style={text}>{greet(name)}</Text>
    <Text style={text}>
      You haven't opened the conference app yet. Signing in once with this email activates your pass, so check-in at
      IIM Shillong is a single scan.
    </Text>
    {session ? <Text style={{ ...listItem, marginBottom: '20px' }}>Your session: {session}</Text> : null}
    <Text style={text}>No download needed, it opens in your phone's browser.</Text>
  </ConferenceShell>
)

export const template = {
  component: AppNudge,
  subject: 'Activate your 11th Pan-IIM WMC pass before you travel',
  displayName: 'Adoption nudge',
  previewData: { name: 'Ananya Rao', code: 'WMC-NJEB', session: 'Track 4, Sat 28 Nov, 9:00 AM' },
} satisfies TemplateEntry
