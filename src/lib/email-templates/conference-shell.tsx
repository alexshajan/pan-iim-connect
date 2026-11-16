import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import { brand, button, code as codeStyle, container, darkModeCss, fontHref, footer, h1, loom, main, text } from './theme'

export const APP_URL = 'https://paniim.planos.in'

/** Shared look for every email: loom seam, pass header, body, torn stub footer. */
export function ConferenceShell({
  preview,
  kicker,
  title,
  children,
  cta,
  afterCta,
  code,
  note,
}: {
  preview: string
  kicker: string
  title: string
  children?: React.ReactNode
  cta?: { label: string; href: string } | undefined
  afterCta?: React.ReactNode
  code?: string | undefined
  note?: string | undefined
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <link rel="stylesheet" href={fontHref} />
        <style>{darkModeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={{ ...container, overflow: 'hidden' }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                {loom.map((c, i) => (
                  <td key={i} style={{ backgroundColor: c, height: '4px', lineHeight: '4px', fontSize: '0' }}>&nbsp;</td>
                ))}
              </tr>
            </tbody>
          </table>
          <Section style={band}>
            <Text style={bandTop}>11th Pan-IIM WMC</Text>
            <Text style={bandDates}>27 to 29 November 2026, IIM Shillong</Text>
          </Section>
          <Section style={{ padding: '26px 28px 4px' }}>
            <Text style={chip}>{kicker}</Text>
            <Heading style={h1}>{title}</Heading>
            {children}
            {cta ? (
              <Button className="dm-btn" style={button} href={cta.href}>
                {cta.label}
              </Button>
            ) : null}
            {afterCta}
            {note ? <Text style={footer}>{note}</Text> : null}
          </Section>
          <Section style={stub}>
            <Text style={stubText}>
              {code ? <>Delegate code <strong style={{ color: brand.ink, letterSpacing: '0.08em' }}>{code}</strong>. </> : null}
              The conference app lives at paniim.planos.in
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/** "Or use this code" divider plus the big code box. */
export function CodeFallback({ token, label = 'Or type this code in the app' }: { token?: string | undefined; label?: string }) {
  if (!token) return null
  return (
    <>
      <Text style={divider}>{label}</Text>
      <Text style={codeStyle}>{token}</Text>
    </>
  )
}

/** Turns organizer-written text into paragraphs; blank lines split them. Plain text only. */
export function Paragraphs({ body }: { body?: string }) {
  const parts = (body ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <>
      {parts.map((p, i) => (
        <Text key={i} style={text}>{p}</Text>
      ))}
    </>
  )
}

export const greet = (name?: string) => (name ? `Dear ${name.split(' ')[0]},` : 'Dear delegate,')

export const listItem = {
  ...text,
  margin: '0 0 8px',
  padding: '10px 14px',
  backgroundColor: brand.paper,
  border: `1px solid ${brand.line}`,
  borderRadius: '8px',
  color: brand.ink,
}

const band = { backgroundColor: brand.green, padding: '16px 28px 14px' }
const bandTop = { margin: '0', fontSize: '14px', fontWeight: 700 as const, color: '#ffffff' }
const bandDates = { margin: '2px 0 0', fontSize: '13px', color: '#cfe8dc' }
const chip = {
  display: 'inline-block',
  margin: '0 0 12px',
  padding: '3px 9px',
  fontSize: '12px',
  fontWeight: 600 as const,
  color: brand.green,
  backgroundColor: brand.tint,
  borderRadius: '4px',
}
const divider = {
  fontSize: '13px',
  fontWeight: 600 as const,
  color: brand.muted,
  borderTop: `1px solid ${brand.line}`,
  paddingTop: '18px',
  margin: '24px 0 10px',
}
const stub = { borderTop: `2px dashed ${brand.seam}`, backgroundColor: brand.paper, padding: '14px 28px 18px', marginTop: '22px' }
const stubText = { margin: '0', fontSize: '12px', color: brand.muted, lineHeight: '1.6' }
