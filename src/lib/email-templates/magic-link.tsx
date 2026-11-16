import * as React from 'react'
import { Text } from '@react-email/components'
import { text } from './theme'
import { CodeFallback, ConferenceShell } from './conference-shell'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string | undefined
}

export const MagicLinkEmail = ({ siteName, confirmationUrl, token }: MagicLinkEmailProps) => (
  <ConferenceShell
    preview={`Tap to sign in to ${siteName}, no code needed`}
    kicker="Sign in"
    title="Sign in with one tap"
    cta={{ label: 'Sign in now, no code needed', href: confirmationUrl }}
    afterCta={<CodeFallback token={token} label="Or type this code in the app" />}
    note="Works for one hour. Asked more than once? Only the newest email works. Didn't ask? Ignore this email."
  >
    <Text style={text}>Tap the button and you're in. No code to type.</Text>
  </ConferenceShell>
)

export default MagicLinkEmail
