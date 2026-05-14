import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockSignIn = vi.fn();
const mockGetSession = vi.fn().mockResolvedValue(null);

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'pl',
}));

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  getSession: () => mockGetSession(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
  useRouter: () => ({ push: vi.fn() }),
}));

// ── import after mocks ────────────────────────────────────────────────────────

import { LoginForm } from '@/components/auth/LoginForm';

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location.href mock
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  it('renders email and password fields', () => {
    render(React.createElement(LoginForm));
    expect(screen.getByRole('textbox', { name: /emailLabel/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/passwordLabel/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(React.createElement(LoginForm));
    expect(screen.getByRole('button', { name: /submitButton/i })).toBeInTheDocument();
  });

  it('renders forgot password link', () => {
    render(React.createElement(LoginForm));
    expect(screen.getByRole('link', { name: /forgotPassword/i })).toBeInTheDocument();
  });

  it('toggles password visibility on eye button click', async () => {
    const user = userEvent.setup();
    render(React.createElement(LoginForm));

    const passwordInput = screen.getByLabelText(/passwordLabel/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /pokaż hasło/i });
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /ukryj hasło/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('calls signIn with credentials on form submit', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(React.createElement(LoginForm));

    await user.type(screen.getByRole('textbox', { name: /emailLabel/i }), 'test@example.com');
    await user.type(screen.getByLabelText(/passwordLabel/i), 'haslo123');
    await user.click(screen.getByRole('button', { name: /submitButton/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', expect.objectContaining({
        email: 'test@example.com',
        password: 'haslo123',
        redirect: false,
      }));
    });
  });

  it('displays error message when signIn returns error', async () => {
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin' });
    const user = userEvent.setup();
    render(React.createElement(LoginForm));

    await user.type(screen.getByRole('textbox', { name: /emailLabel/i }), 'bad@example.com');
    await user.type(screen.getByLabelText(/passwordLabel/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /submitButton/i }));

    await waitFor(() => {
      expect(screen.getByText('errorInvalid')).toBeInTheDocument();
    });
  });

  it('redirects to /pl/panel/subskrypcja on successful client login', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(React.createElement(LoginForm));

    await user.type(screen.getByRole('textbox', { name: /emailLabel/i }), 'ok@example.com');
    await user.type(screen.getByLabelText(/passwordLabel/i), 'pass1234');
    await user.click(screen.getByRole('button', { name: /submitButton/i }));

    await waitFor(() => {
      expect(window.location.href).toBe('/pl/panel/subskrypcja');
    });
  });

  it('disables submit button while loading', async () => {
    // signIn never resolves during this check
    mockSignIn.mockImplementation(() => new Promise(() => undefined));
    const user = userEvent.setup();
    render(React.createElement(LoginForm));

    await user.type(screen.getByRole('textbox', { name: /emailLabel/i }), 'x@x.com');
    await user.type(screen.getByLabelText(/passwordLabel/i), 'pass');
    await user.click(screen.getByRole('button', { name: /submitButton/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ładowanie/i })).toBeDisabled();
    });
  });
});
