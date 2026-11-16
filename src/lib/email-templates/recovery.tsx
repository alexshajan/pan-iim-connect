import * as React from 'react'
import { Text } from '@react-email/components'
import { text } from './theme'
import { CodeFallback, ConferenceShell } from './conference-shell'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string | undefined
}

export const RecoveryEmail = ({ siteName, confirmationUrl, token }: RecoveryEmailProps) => (
  <ConferenceShell
    preview={`Reset your password for ${siteName}`}
    kicker="Password"
    title="Set a new password"
    cta={{ label: 'Choose a new password', href: confirmationUrl }}
    afterCta={<CodeFallback token={token} />}
    note="Didn't ask for this? Ignore this email. Your password stays the same."
  >
    <Text style={text}>Tap the button to pick a new password.</Text>
  </ConferenceShell>
)

export default RecoveryEmail
