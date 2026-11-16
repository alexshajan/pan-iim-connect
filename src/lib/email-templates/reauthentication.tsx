import * as React from 'react'
import { Text } from '@react-email/components'
import { code, text } from './theme'
import { ConferenceShell } from './conference-shell'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <ConferenceShell
    preview="Your confirmation code"
    kicker="Confirm it's you"
    title="Your code"
    note="Didn't ask for this? Ignore this email."
  >
    <Text style={text}>Type this code in the app.</Text>
    <Text style={code}>{token}</Text>
  </ConferenceShell>
)

export default ReauthenticationEmail
