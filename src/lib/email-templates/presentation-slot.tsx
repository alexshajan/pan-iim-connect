import * as React from 'react'
import { Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, text } from './theme'
import { APP_URL, ConferenceShell, greet } from './conference-shell'

export type SlotPaper = { code: string; title: string; session: string; when: string; where: string; online: boolean }
interface Props { name?: string; code?: string; papers?: SlotPaper[] }

const PresentationSlot = ({ name, code, papers }: Props) => {
  const list = papers?.length ? papers : []
  const anyOnline = list.some((p) => p.online)
  const anyOffline = list.some((p) => !p.online)
  return (
    <ConferenceShell
      preview={list.length ? `${list[0]!.when}, ${list[0]!.where}` : 'Your presentation slot'}
      kicker={list.length > 1 ? `Your ${list.length} presentations` : 'Your presentation'}
      title="Your slot is confirmed"
      cta={{ label: 'Open my slot in the app', href: `${APP_URL}/calendar?mine=true` }}
      code={code}
    >
      <Text style={text}>{greet(name)}</Text>
      <Text style={text}>Here is where and when you present at the 11th Pan-IIM WMC.</Text>
      {list.map((p) => (
        <Section key={p.code} style={card}>
          <Text style={cardKicker}>Paper #{p.code}, {p.online ? 'Online' : 'In person'}</Text>
          <Text style={cardTitle}>{p.title}</Text>
          <Text style={row}><strong>When</strong>&nbsp;&nbsp;{p.when}</Text>
          <Text style={row}><strong>Where</strong>&nbsp;&nbsp;{p.where}</Text>
          <Text style={{ ...row, marginBottom: 0 }}><strong>Session</strong>&nbsp;&nbsp;{p.session}</Text>
        </Section>
      ))}
      {anyOffline ? (
        <Text style={text}>Please reach the room 10 minutes early and bring your slides on a USB drive as a backup.</Text>
      ) : null}
      {anyOnline ? (
        <Text style={text}>For online sessions, the joining link reaches you by email before the day. Test your camera and microphone in advance.</Text>
      ) : null}
      <Text style={text}>Need to switch between online and in person? Reply to this email and the team will help.</Text>
    </ConferenceShell>
  )
}

const card = { border: `1px solid ${brand.line}`, borderRadius: '12px', padding: '14px 16px', margin: '0 0 14px' }
const cardKicker = { fontSize: '11px', fontWeight: 600, color: brand.muted, margin: '0 0 4px' }
const cardTitle = { fontSize: '16px', lineHeight: '22px', color: brand.ink, margin: '0 0 10px', fontWeight: 600 }
const row = { fontSize: '14px', lineHeight: '20px', color: brand.ink, margin: '0 0 4px' }

export const template = {
  component: PresentationSlot,
  subject: (d: Record<string, any>) => {
    const p = (d["papers"] as SlotPaper[] | undefined)?.[0]
    return p ? `Your presentation slot, ${p.when}` : 'Your presentation slot, 11th Pan-IIM WMC'
  },
  displayName: 'Presentation slot',
  previewData: {
    name: 'Ananya Rao',
    code: 'WMC-NJEB',
    papers: [{ code: '1042', title: 'ESG disclosure and the cost of equity in emerging markets', session: 'Capital Markets & Asset Pricing', when: 'Sat 28 Nov, 9:00–10:30 AM', where: 'Room G03, New Academic Block', online: false }],
  },
} satisfies TemplateEntry
