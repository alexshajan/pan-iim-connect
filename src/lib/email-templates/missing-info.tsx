import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { text } from './theme'
import { APP_URL, ConferenceShell, greet, listItem } from './conference-shell'

interface Props { name?: string; code?: string; missing?: string[]; deadline?: string }

const MissingInfo = ({ name, code, missing, deadline }: Props) => {
  const items = missing?.length ? missing : ['A few profile details']
  return (
    <ConferenceShell
      preview="A couple of details are missing from your conference record"
      kicker="Quick check"
      title="Help us finish your record"
      cta={{ label: 'Update my details', href: `${APP_URL}/me` }}
      code={code}
    >
      <Text style={text}>{greet(name)}</Text>
      <Text style={text}>We're preparing badges, rooms and certificates. These details are still missing:</Text>
      {items.map((m, i) => (
        <Text key={i} style={i === items.length - 1 ? { ...listItem, marginBottom: '20px' } : listItem}>{m}</Text>
      ))}
      <Text style={text}>
        It takes about a minute in the app{deadline ? `; please do it by ${deadline}` : ''}. Reply to this email if anything looks wrong.
      </Text>
    </ConferenceShell>
  )
}

export const template = {
  component: MissingInfo,
  subject: 'A few details missing for the 11th Pan-IIM WMC',
  displayName: 'Missing information',
  previewData: { name: 'Ananya Rao', code: 'WMC-NJEB', missing: ['Phone number', 'Institution'], deadline: '10 November' },
} satisfies TemplateEntry
