import { supabase } from '../supabase';
import { mediaUpload } from '../mediaUpload';
import { authService, fetchProfileRow } from '../authService';
import { AppError } from '../../utils/appError';
import { chain, ok, fail } from './supabaseTestUtils';
import type { UserProfile } from '../../types/user';

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
    functions: { invoke: jest.fn() },
    rpc: jest.fn(),
  },
}));

jest.mock('../mediaUpload', () => ({
  mediaUpload: {
    uploadPhoto: jest.fn(),
    uploadVideoIntro: jest.fn(),
    uploadVoiceIntro: jest.fn(),
    uploadCnicPhoto: jest.fn(),
    uploadSelfiePhoto: jest.fn(),
    verificationUrl: jest.fn(),
    isLocalUri: jest.fn(),
    removeFiles: jest.fn(),
  },
}));

const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const invoke = supabase.functions.invoke as jest.Mock;

/** What supabase-js hands back for a non-2xx function response. */
function functionError(body: unknown) {
  return { data: null, error: { name: 'FunctionsHttpError', context: { json: () => Promise.resolve(body) } } };
}

function fullProfileRows() {
  return {
    profile: ok({
      id: 'u1',
      fullName: 'Ayesha',
      dob: '1998-01-01',
      gender: 'female',
      city: 'Lahore',
      bio: '',
      intent: 'matrimonial',
      language: 'en',
      activeMode: 'rishta',
      datingVibeTags: [],
      datingIntentionLabel: null,
      rishtaReligion: 'Islam',
      rishtaSect: 'Sunni',
      rishtaFamilyBackground: '',
      rishtaEducation: '',
      rishtaReadiness: 'browsing',
      rishtaPrayerHabits: null,
      rishtaIncomeRange: null,
      rishtaLivingAbroad: null,
      heightCm: null,
      maritalStatus: null,
      hasChildren: null,
      occupation: null,
      practising: null,
      prayerHabits: null,
      halalOnly: null,
      smoking: null,
      drinking: null,
      religiousDress: null,
      openToRelocate: null,
      preferredCountry: null,
      careerPlans: null,
      educationLevel: null,
      degree: null,
      jobTitle: null,
      industry: null,
      languages: null,
      nationality: null,
      grewUpIn: null,
      country: null,
      selfieVerified: false,
      bureauVerified: false,
      lastActiveAt: null,
      photos: [],
      voiceIntroUrl: null,
      voiceIntroDurationSec: null,
      videoIntroUrl: null,
      waliName: null,
      waliInvitedAt: null,
      isExplorePlus: false,
      subscriptionPlan: null,
      hasUsedTrial: false,
      subscriptionRenewsAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    private: ok({ email: 'a@example.com', waliContact: null }),
    verification: ok({
      cnicNumber: '12345-1234567-8',
      cnicPhotoPath: null,
      cnicVerified: true,
      bureauVerified: false,
      selfiePhotoPath: null,
    }),
  };
}

/** Routes `supabase.from(table)` calls to per-table chains for a fetchFullProfile round trip. */
function mockProfileTables(rows: ReturnType<typeof fullProfileRows> = fullProfileRows()) {
  from.mockImplementation((table: string) => {
    if (table === 'profiles') return chain(rows.profile);
    if (table === 'profile_private') return chain(rows.private);
    if (table === 'profile_verification') return chain(rows.verification);
    return chain(ok(null));
  });
}

beforeEach(() => {
  from.mockReset();
  rpc.mockReset();
  invoke.mockReset();
  Object.values(auth).forEach((fn) => fn.mockReset());
  jest.clearAllMocks();
});

describe('fetchProfileRow / getCurrentUser', () => {
  it('returns null when there is no signed-in user', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await authService.getCurrentUser()).toBeNull();
  });

  it('assembles a full UserProfile from the three per-user tables', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockProfileTables();

    const profile = await authService.getCurrentUser();

    expect(profile).toMatchObject({
      id: 'u1',
      fullName: 'Ayesha',
      email: 'a@example.com',
      rishta: expect.objectContaining({ religion: 'Islam' }),
      cnicVerified: true,
    });
  });

  it('fetchProfileRow throws on a query error', async () => {
    from.mockReturnValue(chain(fail('denied')));
    await expect(fetchProfileRow('u1')).rejects.toThrow('denied');
  });
});

describe('authService.emailExists', () => {
  it('returns the RPC result', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await authService.emailExists('A@Example.com')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('email_exists', { p_email: 'a@example.com' });
  });

  it('returns false rather than throwing when the RPC errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await authService.emailExists('a@example.com')).toBe(false);
  });

  it('returns false rather than throwing when the RPC itself rejects', async () => {
    rpc.mockRejectedValue(new Error('network down'));
    expect(await authService.emailExists('a@example.com')).toBe(false);
  });
});

describe('authService.login', () => {
  it('signs in and returns the full profile', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockProfileTables();

    const profile = await authService.login('a@example.com', 'Password1!');
    expect(profile.id).toBe('u1');
  });

  it('throws AppError(invalidCredentials) on bad credentials', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    await expect(authService.login('a@example.com', 'wrong')).rejects.toMatchObject({
      key: 'authErrors.invalidCredentials',
    });
  });

  it('throws AppError(emailNotConfirmed) when the account has not confirmed', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Email not confirmed' } });
    await expect(authService.login('a@example.com', 'x')).rejects.toMatchObject({
      key: 'authErrors.emailNotConfirmed',
    });
  });

  it('seeds a placeholder profile when the auth user has no profile row yet', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    let profileCallCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profileCallCount += 1;
        // First read (fetchFullProfile via Promise.all): no row yet.
        // Second read (after the placeholder upsert): the seeded row.
        return profileCallCount <= 1
          ? chain(ok(null))
          : chain(fullProfileRows().profile);
      }
      if (table === 'profile_private') return chain(fullProfileRows().private);
      if (table === 'profile_verification') return chain(fullProfileRows().verification);
      return chain(ok(null));
    });

    const profile = await authService.login('new@example.com', 'Password1!');
    expect(profile).not.toBeNull();
  });

  it('signs out and throws AppError(clockSkew) when the profile fetch hits a JWT clock error', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    from.mockReturnValue(chain(fail('JWT issued at future')));
    auth.signOut.mockResolvedValue({ error: null });

    await expect(authService.login('a@example.com', 'Password1!')).rejects.toMatchObject({
      key: 'authErrors.clockSkew',
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('authService.logout', () => {
  it('calls supabase signOut', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await authService.logout();
    expect(auth.signOut).toHaveBeenCalledWith();
  });
});

describe('authService.setActiveMode / setIntent / setReadiness', () => {
  it('setActiveMode patches active_mode for the user', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);
    await authService.setActiveMode('u1', 'dating');
    expect(builder.update).toHaveBeenCalledWith({ active_mode: 'dating' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('setIntent patches intent and active_mode together', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);
    await authService.setIntent('u1', 'casual', 'dating');
    expect(builder.update).toHaveBeenCalledWith({ intent: 'casual', active_mode: 'dating' });
  });

  it('setReadiness patches rishta_readiness', async () => {
    const builder = chain(ok(null));
    from.mockReturnValue(builder);
    await authService.setReadiness('u1', 'ready_now');
    expect(builder.update).toHaveBeenCalledWith({ rishta_readiness: 'ready_now' });
  });
});

describe('authService.touchLastActive', () => {
  it('does nothing more once the RPC succeeds', async () => {
    rpc.mockResolvedValue({ error: null });
    await authService.touchLastActive('u1');
    expect(from).not.toHaveBeenCalled();
  });

  it('falls back to a direct update only on PGRST202 (RPC not deployed yet)', async () => {
    rpc.mockResolvedValue({ error: { code: 'PGRST202' } });
    const builder = chain(ok(null));
    from.mockReturnValue(builder);

    await authService.touchLastActive('u1');

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ last_active_at: expect.any(String) }));
    expect(builder.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('does not fall back for any other RPC error', async () => {
    rpc.mockResolvedValue({ error: { code: 'OTHER' } });
    await authService.touchLastActive('u1');
    expect(from).not.toHaveBeenCalled();
  });
});

describe('authService.requestOtp', () => {
  it('asks auth-otp for a code at the normalized address and returns the cooldown', async () => {
    invoke.mockResolvedValue({ data: { ok: true, resendIn: 60 }, error: null });
    await expect(authService.requestOtp('  A@Example.com  ', 'reset', 'roman')).resolves.toEqual({ resendIn: 60 });
    expect(invoke).toHaveBeenCalledWith('auth-otp', {
      body: { action: 'request', email: 'a@example.com', purpose: 'reset', language: 'roman' },
    });
  });

  it('maps a cooldown refusal to AppError(otpCooldown) carrying the seconds left', async () => {
    invoke.mockResolvedValue(functionError({ error: 'cooldown', retryAfter: 42 }));
    await expect(authService.requestOtp('a@example.com', 'signup', 'en')).rejects.toMatchObject({
      key: 'authErrors.otpCooldown',
      params: { seconds: 42 },
    });
  });

  it('maps the hourly cap to AppError(otpRateLimited) in whole minutes', async () => {
    invoke.mockResolvedValue(functionError({ error: 'rate_limited', retryAfter: 61 }));
    await expect(authService.requestOtp('a@example.com', 'signup', 'en')).rejects.toMatchObject({
      key: 'authErrors.otpRateLimited',
      params: { minutes: 2 },
    });
  });

  it('maps a taken signup address to AppError(emailTaken)', async () => {
    invoke.mockResolvedValue(functionError({ error: 'email_taken' }));
    await expect(authService.requestOtp('a@example.com', 'signup', 'en')).rejects.toMatchObject({
      key: 'authErrors.emailTaken',
    });
  });

  it('falls back to the generic message when the error body is unreadable', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', context: {} } });
    await expect(authService.requestOtp('a@example.com', 'signup', 'en')).rejects.toMatchObject({
      key: 'common.somethingWentWrong',
    });
  });
});

describe('authService.verifyOtp', () => {
  it('returns the ticket for a correct code', async () => {
    invoke.mockResolvedValue({ data: { ok: true, ticket: 'tkt' }, error: null });
    await expect(authService.verifyOtp('A@example.com', 'signup', ' 123456 ')).resolves.toBe('tkt');
    expect(invoke).toHaveBeenCalledWith('auth-otp', {
      body: { action: 'verify', email: 'a@example.com', purpose: 'signup', code: '123456' },
    });
  });

  it('reports how many attempts are left on a wrong code', async () => {
    invoke.mockResolvedValue(functionError({ error: 'invalid_code', remaining: 3 }));
    await expect(authService.verifyOtp('a@example.com', 'reset', '000000')).rejects.toMatchObject({
      key: 'authErrors.otpInvalid',
      params: { remaining: 3 },
    });
  });

  it('maps lockout and expiry to their own errors', async () => {
    invoke.mockResolvedValueOnce(functionError({ error: 'too_many_attempts' }));
    await expect(authService.verifyOtp('a@example.com', 'reset', '000000')).rejects.toMatchObject({
      key: 'authErrors.otpTooManyAttempts',
    });
    invoke.mockResolvedValueOnce(functionError({ error: 'code_expired' }));
    await expect(authService.verifyOtp('a@example.com', 'reset', '000000')).rejects.toMatchObject({
      key: 'authErrors.otpExpired',
    });
  });
});

describe('authService.resetPasswordWithOtp', () => {
  it('sends the ticket and new password to auth-otp', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await authService.resetPasswordWithOtp(' A@Example.com', 'tkt', 'NewPassword1!');
    expect(invoke).toHaveBeenCalledWith('auth-otp', {
      body: { action: 'reset', email: 'a@example.com', ticket: 'tkt', password: 'NewPassword1!' },
    });
  });

  it('maps a spent ticket to AppError(otpTicketInvalid)', async () => {
    invoke.mockResolvedValue(functionError({ error: 'ticket_invalid' }));
    await expect(authService.resetPasswordWithOtp('a@example.com', 'tkt', 'NewPassword1!')).rejects.toMatchObject({
      key: 'authErrors.otpTicketInvalid',
    });
  });
});

describe('authService.deleteAccount', () => {
  it('refuses to delete when the caller is not the signed-in user', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'someone-else' } } });
    await expect(authService.deleteAccount('u1')).rejects.toMatchObject({ key: 'authErrors.notSignedIn' });
  });

  it('removes stored photos then calls the delete_account RPC', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    from.mockReturnValue(chain(ok({ ...fullProfileRows().profile.data, photos: ['a.jpg', 'b.jpg'] })));
    rpc.mockResolvedValue({ error: null });

    await authService.deleteAccount('u1');

    expect(mediaUpload.removeFiles).toHaveBeenCalledWith(['a.jpg', 'b.jpg']);
    expect(rpc).toHaveBeenCalledWith('delete_account');
  });

  it('throws when the RPC reports an error', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    from.mockReturnValue(chain(ok(null)));
    rpc.mockResolvedValue({ error: { message: 'boom' } });
    await expect(authService.deleteAccount('u1')).rejects.toThrow('boom');
  });
});

describe('authService.signup', () => {
  const baseInput = {
    fullName: 'Ayesha',
    email: 'new@example.com',
    password: 'Password1!',
    dob: '1998-01-01',
    gender: 'female' as const,
    city: 'Lahore',
    intent: 'matrimonial' as const,
    language: 'en' as const,
    cnicNumber: '12345-1234567-8',
    emailTicket: 'tkt',
  };

  it('creates the account through auth-otp, signs in, writes the rows and returns the profile', async () => {
    invoke.mockResolvedValue({ data: { ok: true, userId: 'u1' }, error: null });
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockProfileTables();

    const profile = await authService.signup(baseInput);

    expect(profile.id).toBe('u1');
    expect(invoke).toHaveBeenCalledWith('auth-otp', {
      body: { action: 'signup', email: 'new@example.com', password: 'Password1!', fullName: 'Ayesha', ticket: 'tkt' },
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'new@example.com', password: 'Password1!' });
  });

  it('stops at an expired verification without signing in', async () => {
    invoke.mockResolvedValue(functionError({ error: 'ticket_invalid' }));

    await expect(authService.signup(baseInput)).rejects.toMatchObject({ key: 'authErrors.otpTicketInvalid' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('refuses to create anything without a verified email when there is no account to resume', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });

    await expect(authService.signup({ ...baseInput, emailTicket: undefined })).rejects.toMatchObject({
      key: 'authErrors.emailNotVerified',
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('resumes a half-finished signup when the existing account has no profile yet', async () => {
    invoke.mockResolvedValue(functionError({ error: 'email_taken' }));
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    // First `profiles` read is the placeholder check inside createAccount, before
    // the upsert has written anything — it must see no row. Every read after that
    // is `fetchFullProfile` assembling the response, once the upsert below it landed.
    let profileReads = 0;
    from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profileReads += 1;
        return chain(profileReads === 1 ? ok(null) : fullProfileRows().profile);
      }
      if (table === 'profile_private') return chain(fullProfileRows().private);
      if (table === 'profile_verification') return chain(fullProfileRows().verification);
      return chain(ok(null));
    });

    const profile = await authService.signup(baseInput);
    expect(profile.id).toBe('u1');
  });

  it('throws AppError(emailTaken) and signs back out when the address belongs to a finished account', async () => {
    invoke.mockResolvedValue(functionError({ error: 'email_taken' }));
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    mockProfileTables();

    await expect(authService.signup(baseInput)).rejects.toMatchObject({ key: 'authErrors.emailTaken' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('fails closed (does not log in) when the profile read errors instead of returning no row', async () => {
    invoke.mockResolvedValue(functionError({ error: 'email_taken' }));
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    from.mockImplementation((table: string) =>
      table === 'profiles' ? chain(fail('permission denied for table profiles')) : chain(ok(null))
    );

    await expect(authService.signup(baseInput)).rejects.toMatchObject({ key: 'authErrors.emailTaken' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('throws AppError(emailTaken) when the retry sign-in also fails', async () => {
    invoke.mockResolvedValue(functionError({ error: 'email_taken' }));
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'wrong password' } });

    await expect(authService.signup(baseInput)).rejects.toMatchObject({ key: 'authErrors.emailTaken' });
  });

  it('passes a weak-password rejection through as the password-rules message', async () => {
    invoke.mockResolvedValue(functionError({ error: 'weak_password' }));
    await expect(authService.signup(baseInput)).rejects.toMatchObject({ key: 'signup.passwordRequirementsError' });
  });
});
