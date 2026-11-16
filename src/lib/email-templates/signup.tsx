import * as React from 'react'
import { Text } from '@react-email/components'
import { text } from './theme'
import { CodeFallback, ConferenceShell } from './conference-shell'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string | undefined
}

export const SignupEmail = ({ siteName, recipient, confirmationUrl, token }: SignupEmailProps) => (
  <ConferenceShell
    preview={`Confirm your email for ${siteName}`}
    kicker="Confirm email"
    title="One tap to confirm"
    cta={{ label: 'Confirm and sign in, no code needed', href: confirmationUrl }}
    afterCta={<CodeFallback token={token} />}
    note="Works for one hour. Only the newest email works. Didn't sign up? Ignore this email."
  >
    <Text style={text}>Tap the button to confirm {recipient} and open the app.</Text>
  </ConferenceShell>
)

export default SignupEmail
