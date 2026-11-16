import * as React from 'react'
import { Text } from '@react-email/components'
import { brand, text } from './theme'
import { ConferenceShell } from './conference-shell'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address. For the NEW-recipient half of a
  // secure email_change fanout, `email` equals the recipient, so render oldEmail.
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <ConferenceShell
    preview={`Confirm your new email for ${siteName}`}
    kicker="Email change"
    title="Confirm your new email"
    cta={{ label: 'Confirm the change', href: confirmationUrl }}
    note="Didn't ask for this? Change your password in the app right away."
  >
    <Text style={text}>
      From <strong style={{ color: brand.ink }}>{oldEmail}</strong> to <strong style={{ color: brand.ink }}>{newEmail}</strong>.
    </Text>
  </ConferenceShell>
)

export default EmailChangeEmail
