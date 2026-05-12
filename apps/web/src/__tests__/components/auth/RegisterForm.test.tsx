import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockRegister = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
  api: {
    auth: {
      register: (...args: unknown[]) => mockRegister(...args),
    },
  },
}));

// ── import after mocks ────────────────────────────────────────────────────────

import { RegisterForm } from '@/components/auth/RegisterForm';

// ── helpers ───────────────────────────────────────────────────────────────────

async function fillForm(user: ReturnType<typeof userEvent.setup>, overrides: Partial<{
  firstName: string; lastName: string; email: string;
  password: string; confirmPassword: string;
}> = {}) {
  const vals = {
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: 'jan@example.com',
    password: 'Tajne123',
    confirmPassword: 'Tajne123',
    ...overrides,
  };

  await user.type(screen.getByLabelText(/firstNameLabel/i), vals.firstName);
  await user.type(screen.getByLabelText(/lastNameLabel/i), vals.lastName);
  await user.type(screen.getByRole('textbox', { name: /emailLabel/i }), vals.email);

  const passwordInputs = screen.getAllByLabelText(/passwordLabel/i);
  await user.type(passwordInputs[0], vals.password);
  await user.type(screen.getByLabelText(/confirmPasswordLabel/i), vals.confirmPassword);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required fields', () => {
    render(React.createElement(RegisterForm));
    expect(screen.getByLabelText(/firstNameLabel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lastNameLabel/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /emailLabel/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmPasswordLabel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dietitianCodeLabel/i)).toBeInTheDocument();
  });

  it('shows error when password is too short (< 6 chars)', async () => {
    const user = userEvent.setup();
    render(React.createElement(RegisterForm));

    await fillForm(user, { password: 'abc', confirmPassword: 'abc' });
    await user.click(screen.getByRole('button', { name: /registerButton/i }));

    await waitFor(() => {
      expect(screen.getByText('errorPasswordTooShort')).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    render(React.createElement(RegisterForm));

    await fillForm(user, { password: 'Haslo123', confirmPassword: 'Haslo999' });
    await user.click(screen.getByRole('button', { name: /registerButton/i }));

    await waitFor(() => {
      expect(screen.getByText('errorPasswordMismatch')).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows success state with email after successful registration', async () => {
    mockRegister.mockResolvedValue({ ok: true, user: { id: '1', email: 'jan@example.com', role: 'CLIENT' } });
    const user = userEvent.setup();
    render(React.createElement(RegisterForm));

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /registerButton/i }));

    await waitFor(() => {
      expect(screen.getByText('registerSuccessTitle')).toBeInTheDocument();
    });
  });

  it('shows errorEmailTaken on 409 API error', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRegister.mockRejectedValue(new ApiError(409, 'Conflict'));
    const user = userEvent.setup();
    render(React.createElement(RegisterForm));

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /registerButton/i }));

    await waitFor(() => {
      expect(screen.getByText('errorEmailTaken')).toBeInTheDocument();
    });
  });

  it('shows errorInvalidDietitianCode on 400 API error', async () => {
    const { ApiError } = await import('@/lib/api');
    mockRegister.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const user = userEvent.setup();
    render(React.createElement(RegisterForm));

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /registerButton/i }));

    await waitFor(() => {
      expect(screen.getByText('errorInvalidDietitianCode')).toBeInTheDocument();
    });
  });

  it('shows errorGeneral on unknown API error', async () => {
    mockRegister.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(React.createElement(RegisterForm));

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /registerButton/i }));

    await waitFor(() => {
      expect(screen.getByText('errorGeneral')).toBeInTheDocument();
    });
  });

  it('calls api.auth.register with correct payload', async () => {
    mockRegister.mockResolvedValue({ ok: true, user: { id: '1', email: 'jan@example.com', role: 'CLIENT' } });
    const user = userEvent.setup();
    render(React.createElement(RegisterForm));

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /registerButton/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
        email: 'jan@example.com',
        password: 'Tajne123',
        firstName: 'Jan',
        lastName: 'Kowalski',
      }));
    });
  });

  it('does not include dietitianCode when field is empty', async () => {
    mockRegister.mockResolvedValue({ ok: true, user: { id: '1', email: 'jan@example.com', role: 'CLIENT' } });
    const user = userEvent.setup();
    render(React.createElement(RegisterForm));

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /registerButton/i }));

    await waitFor(() => {
      const call = mockRegister.mock.calls[0][0] as Record<string, unknown>;
      expect(call.dietitianCode).toBeUndefined();
    });
  });
});
