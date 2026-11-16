import { afterEach, describe, expect, it, vi } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@lovable.dev/email-js', () => ({
  sendLovableEmail: send,
  EmailAPIError: class extends Error {},
}))
vi.mock('@react-email/render', () => ({ render: vi.fn().mockResolvedValue('Rendered email') }))
vi.mock('./registry', () => ({
  TEMPLATES: { 'welcome-pass': { component: () => null, subject: 'Your pass' } },
}))

import { sendTemplateEmail } from './send-email'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('conference email sender', () => {
  it('sends through notify.paniim.planos.in', async () => {
    vi.stubEnv('LOVABLE_API_KEY', 'test-only-key')
    await expect(sendTemplateEmail('welcome-pass', 'delegate@example.com', {
      idempotencyKey: 'welcome-test',
    })).resolves.toEqual({ sent: true })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      sender_domain: 'notify.paniim.planos.in',
      from: { name: '11th Pan-IIM WMC', address: 'noreply@notify.paniim.planos.in' },
      idempotency_key: 'welcome-test',
    }), expect.any(Object))
  })
})