import * as React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, displayStack, link, text } from './theme'
import { APP_URL, ConferenceShell, greet } from './conference-shell'

interface Props {
  name?: string
  code?: string
  primaryEmail?: string
  addedEmail?: string
  recipient?: string
  papers?: { code: string; title: string }[]
}

const cell = { padding: '12px 14px', verticalAlign: 'top' as const, borderBottom: `1px solid ${brand.line}` }
const label = { margin: '0', fontSize: '11px', fontWeight: 600 as const, color: brand.muted, letterSpacing: '0.04em', textTransform: 'uppercase' as const }
const val = { margin: '2px 0 0', fontSize: '15px', fontWeight: 600 as const, color: brand.ink, wordBreak: 'break-all' as const }
const tag = { display: 'inline-block', marginTop: '6px', padding: '2px 7px', fontSize: '11px', fontWeight: 600 as const, borderRadius: '4px' }
const way = { padding: '10px 12px', border: `1px solid ${brand.line}`, borderRadius: '8px', backgroundColor: brand.paper, verticalAlign: 'top' as const }
const wayT = { margin: '0', fontSize: '14px', fontWeight: 700 as const, color: brand.ink, fontFamily: displayStack }
const wayS = { margin: '2px 0 0', fontSize: '12px', color: brand.muted, lineHeight: '1.45' }

function EmailRow({ title, email, you, kind }: { title: string; email?: string | undefined; you: boolean; kind: 'old' | 'new' }) {
  return (
    <tr>
      <td style={{ ...cell, width: '6px', padding: '0', backgroundColor: kind === 'old' ? brand.green : '#d9a33a' }} />
      <td style={cell}>
        <Text style={label}>{title}</Text>
        <Text style={val}>{email || '—'}</Text>
        <span style={{ ...tag, color: brand.green, backgroundColor: brand.tint }}>Signs you in</span>
        {you ? <span style={{ ...tag, marginLeft: '6px', color: brand.muted, backgroundColor: brand.paper, border: `1px solid ${brand.line}` }}>This inbox</span> : null}
      </td>
    </tr>
  )
}

const AccountLinked = ({ name, code, primaryEmail, addedEmail, recipient, papers = [] }: Props) => (
  <ConferenceShell
    preview={`Both ${primaryEmail ?? 'your'} and ${addedEmail ?? 'your new email'} now open the same pass`}
    kicker="Account linked"
    title="Either email now opens your pass"
    cta={{ label: 'Sign in now', href: `${APP_URL}/auth${recipient ? `?email=${encodeURIComponent(recipient)}` : ''}` }}
    code={code}
    note="Didn't expect this? Reply to the Help Desk in the app or tell us at the registration desk, and we'll undo it."
  >
    <Text style={text}>{greet(name)}</Text>
    <Text style={text}>
      You signed in with an email we hadn't seen, so our desk matched it to your registration. Both
      addresses below now lead to one profile, one pass{code ? ` (${code})` : ''} and one set of connections.
    </Text>

    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'separate', border: `1px solid ${brand.line}`, borderRadius: '8px', overflow: 'hidden', margin: '0 0 20px' }}>
      <tbody>
        <EmailRow title="Registered email" email={primaryEmail} you={recipient === primaryEmail} kind="old" />
        <EmailRow title="Added just now" email={addedEmail} you={recipient === addedEmail} kind="new" />
      </tbody>
    </table>

    {papers.length ? (
      <>
        <Text style={{ ...label, margin: '0 0 8px' }}>Linked to your profile</Text>
        {papers.map((p) => (
          <Text key={p.code} style={{ ...text, margin: '0 0 6px', color: brand.ink, fontSize: '14px' }}>
            <strong style={{ color: brand.green }}>#{p.code}</strong>&nbsp; {p.title}
          </Text>
        ))}
        <div style={{ height: '14px' }} />
      </>
    ) : null}

    <Text style={{ ...label, margin: '0 0 8px' }}>Three ways in, pick any</Text>
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={6} style={{ margin: '0 -6px 18px' }}>
      <tbody>
        <tr>
          <td style={way} width="33%"><Text style={wayT}>One-click link</Text><Text style={wayS}>We email a sign-in button to either address.</Text></td>
          <td style={way} width="33%"><Text style={wayT}>6-digit code</Text><Text style={wayS}>Type the code from the same email instead.</Text></td>
          <td style={way} width="33%"><Text style={wayT}>Google or Microsoft</Text><Text style={wayS}>If either address is a Google or Microsoft account.</Text></td>
        </tr>
      </tbody>
    </table>

    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 22px', backgroundColor: brand.tint, borderRadius: '8px' }}>
      <tbody>
        <tr>
          <td style={{ padding: '14px 16px' }}>
            <Text style={{ ...wayT, color: brand.green }}>One more step: check your details</Text>
            <Text style={{ ...wayS, color: brand.ink, fontSize: '13px' }}>
              A card at the top of Home shows your name as it prints on your ID card, your affiliation and who
              is presenting each paper. Tap Confirm, or ask for a correction right there.
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
    <Text style={{ ...text, fontSize: '13px' }}>
      Signed in already? Nothing changes for you. Open <Link href={`${APP_URL}/`} style={link}>paniim.planos.in</Link> as usual.
    </Text>
  </ConferenceShell>
)

export const template = {
  component: AccountLinked,
  subject: 'Your two emails now open one 11th Pan-IIM WMC pass',
  displayName: 'Account linked (after merge)',
  previewData: {
    name: 'Sribalaji M', code: 'WMC-WZ5X', primaryEmail: 'sribalaji@iimx.ac.in', addedEmail: 'sribalaji.m@gmail.com',
    recipient: 'sribalaji.m@gmail.com', papers: [{ code: '79', title: 'Platform labour and the gig economy in tier-2 India' }],
  },
} satisfies TemplateEntry
