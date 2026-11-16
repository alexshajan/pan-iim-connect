import * as React from 'react'
import { Text } from '@react-email/components'
import { text } from './theme'
import { ConferenceShell } from './conference-shell'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, confirmationUrl }: InviteEmailProps) => (
  <ConferenceShell
    preview={`You're invited to the ${siteName} app`}
    kicker="Invitation"
    title="You're invited"
    cta={{ label: 'Accept and sign in', href: confirmationUrl }}
    note="Not expecting this? Ignore this email."
  >
    <Text style={text}>Tap the button to join the conference app. No password needed.</Text>
  </ConferenceShell>
)

export default InviteEmail
