import { vi, describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  company: { create: vi.fn(), findUnique: vi.fn() },
  passwordResetToken: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  emailVerificationToken: { updateMany: vi.fn() },
  // email
  sendClientInviteEmail: vi.fn(),
  sendEmailVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  // misc
  logAudit: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
  bcryptHash: vi.fn(),
  bcryptCompare: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    user: m.user,
    company: m.company,
    passwordResetToken: m.passwordResetToken,
    emailVerificationToken: m.emailVerificationToken,
  },
  Prisma: {},
}));

vi.mock('../../utils/email', () => ({
  sendClientInviteEmail: m.sendClientInviteEmail,
  sendEmailVerificationEmail: m.sendEmailVerificationEmail,
  sendPasswordResetEmail: m.sendPasswordResetEmail,
}));

vi.mock('../../services/audit.service', () => ({ logAudit: m.logAudit }));
vi.mock('../../utils/redis', () => ({ redis: { set: m.redisSet, del: m.redisDel, get: vi.fn() } }));
vi.mock('../../services/antiAbuse.service', () => ({
  isDisposableEmail: vi.fn().mockReturnValue(false),
  checkIpAbuse: vi.fn().mockResolvedValue(false),
  recordRegistrationIp: vi.fn(),
  checkAccountLockout: vi.fn().mockResolvedValue(undefined),
  recordFailedLogin: vi.fn(),
  clearLockout: vi.fn(),
}));
vi.mock('bcryptjs', () => ({
  default: { hash: m.bcryptHash, compare: m.bcryptCompare },
}));

// ── imports (after mocks) ─────────────────────────────────────────────────────
import { createUser } from '../../services/admin.service';
import { login, resetPassword } from '../../services/auth.service';

const EMAIL = 'klient@example.com';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'https://bambooit.pl';
  process.env.JWT_SECRET = 'test-secret';
  m.user.findFirst.mockResolvedValue(null); // no existing user
  m.user.create.mockResolvedValue({ id: 'user-1', email: EMAIL, role: 'CLIENT' });
  m.company.create.mockResolvedValue({ id: 'company-1' });
  m.sendClientInviteEmail.mockResolvedValue(undefined);
  m.bcryptHash.mockImplementation(async (pw: string) => `hashed:${pw}`);
});

describe('admin.createUser — invite flow', () => {
  it('without a password: creates an invite token + sends invite email', async () => {
    const result = await createUser({ email: EMAIL, firstName: 'Jan', lastName: 'Kowal' });

    expect(result).toMatchObject({ userId: 'user-1', email: EMAIL, role: 'CLIENT', invited: true });

    // user created as a verified CLIENT, no password hash
    expect(m.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: EMAIL, role: 'CLIENT', passwordHash: undefined }),
    });

    // a reset token was persisted with a far-future expiry (~7 days)
    expect(m.passwordResetToken.create).toHaveBeenCalledOnce();
    const tokenArg = m.passwordResetToken.create.mock.calls[0][0].data;
    expect(tokenArg.userId).toBe('user-1');
    expect(tokenArg.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const daysOut = (tokenArg.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(daysOut).toBeGreaterThan(6);

    // invite email points to the set-password page with the raw token
    expect(m.sendClientInviteEmail).toHaveBeenCalledOnce();
    const inviteUrl: string = m.sendClientInviteEmail.mock.calls[0][1];
    expect(inviteUrl).toContain('https://bambooit.pl/pl/resetuj-haslo?token=');
  });

  it('with a password: no invite token, no email, password is hashed', async () => {
    const result = await createUser({ email: EMAIL, password: 'Sup3rTajne!' });

    expect(result).toMatchObject({ invited: false });
    expect(m.passwordResetToken.create).not.toHaveBeenCalled();
    expect(m.sendClientInviteEmail).not.toHaveBeenCalled();
    expect(m.bcryptHash).toHaveBeenCalledWith('Sup3rTajne!', 12);
  });

  it('still creates the account (invited=false) when the invite email fails', async () => {
    m.sendClientInviteEmail.mockRejectedValue(new Error('SMTP down'));

    const result = await createUser({ email: EMAIL });

    expect(result.invited).toBe(false);
    expect(m.user.create).toHaveBeenCalledOnce();
    expect(m.passwordResetToken.create).toHaveBeenCalledOnce(); // token still stored
  });

  it('whole path: invite token can set a password, then the client can log in', async () => {
    // 1. admin creates the client (no password) — capture the real token round-trip
    let storedHash = '';
    let storedUserId = '';
    m.passwordResetToken.create.mockImplementation(async ({ data }: { data: { tokenHash: string; userId: string; expiresAt: Date } }) => {
      storedHash = data.tokenHash;
      storedUserId = data.userId;
      return { id: 'reset-1', ...data, usedAt: null };
    });

    await createUser({ email: EMAIL });
    const inviteUrl: string = m.sendClientInviteEmail.mock.calls[0][1];
    const rawToken = new URL(inviteUrl).searchParams.get('token')!;
    expect(rawToken).toBeTruthy();

    // sanity: the stored hash matches sha256(rawToken)
    expect(crypto.createHash('sha256').update(rawToken).digest('hex')).toBe(storedHash);

    // 2. login is blocked before a password is set
    m.user.findFirst.mockResolvedValueOnce({
      id: storedUserId, email: EMAIL, passwordHash: null, role: 'CLIENT', emailVerified: new Date(), deletedAt: null,
    });
    await expect(login(EMAIL, 'whatever'))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    // 3. client uses the invite token to set a password
    m.passwordResetToken.findFirst.mockResolvedValue({ id: 'reset-1', userId: storedUserId, tokenHash: storedHash, usedAt: null, expiresAt: new Date(Date.now() + 1000) });
    m.user.update.mockResolvedValue({ id: storedUserId });
    await resetPassword(rawToken, 'NoweHaslo123!');
    expect(m.user.update).toHaveBeenCalledWith({
      where: { id: storedUserId },
      data: { passwordHash: 'hashed:NoweHaslo123!' },
    });

    // 4. now login succeeds
    m.user.findFirst.mockResolvedValue({
      id: storedUserId, email: EMAIL, passwordHash: 'hashed:NoweHaslo123!', role: 'CLIENT', emailVerified: new Date(), deletedAt: null,
    });
    m.bcryptCompare.mockResolvedValue(true);
    m.company.findUnique.mockResolvedValue({ id: 'company-1', contactFirstName: 'Jan' });

    const result = await login(EMAIL, 'NoweHaslo123!');
    expect(result.token).toBeTruthy();
    expect(result.user).toMatchObject({ id: storedUserId, email: EMAIL, role: 'CLIENT' });
  });
});
