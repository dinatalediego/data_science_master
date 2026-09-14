# Google Sign-In — SÓCRATES DS

Google is the preferred authentication path for SÓCRATES DS. Email/password remains available as a backup.

## Identity policy

The product has one canonical Google identity for the primary learner account. Personal email addresses and Supabase user IDs must **not** be committed to this public repository.

The login uses an explicit Google account chooser so the learner can select the intended account.

## App behavior

The login screen calls:

```ts
supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: window.location.origin,
    queryParams: {
      access_type: "offline",
      prompt: "select_account",
    },
  },
})
```

## Supabase configuration

Project:

```text
tlyczyfsboqrtrdpwizp
```

Production site:

```text
https://socrates-ds.vercel.app
```

### 1. Authentication → URL Configuration

Site URL:

```text
https://socrates-ds.vercel.app
```

Redirect allowlist should include:

```text
https://socrates-ds.vercel.app/**
http://localhost:3000/**
https://*-dinatalediegos-projects.vercel.app/**
```

### 2. Google Cloud Console

Create an OAuth 2.0 Client ID of type **Web application**.

Authorized JavaScript origins:

```text
https://socrates-ds.vercel.app
http://localhost:3000
```

Authorized redirect URI:

```text
https://tlyczyfsboqrtrdpwizp.supabase.co/auth/v1/callback
```

The redirect URI is the Supabase Auth callback, not the Vercel homepage.

### 3. Supabase → Authentication → Providers → Google

Enable Google and provide:

- Google OAuth Client ID
- Google OAuth Client Secret

Save the provider configuration.

Never commit the client secret to GitHub or expose it in the browser.

## Acceptance test

1. Open the production Campus.
2. Click **Continuar con Google**.
3. Choose the canonical learner Google account.
4. Complete Google consent.
5. Return to the Campus.
6. Confirm the app shows all seven enrollments.
7. Complete one SÓCRATES attempt.
8. Verify the attempt belongs to the intended learner.
9. Inspect `auth.identities` and confirm a `google` identity is attached to the intended existing user.

## Identity-safety check

The learner already has an email/password identity in Supabase. After the first Google login, verify that Google resolves to the same intended user before writing substantial learning history.

If Google resolves to a different user ID, stop and reconcile identity ownership before continuing.

## Why Google-first

- avoids dependence on transactional email delivery for routine login;
- reduces password-recovery friction;
- keeps account selection explicit;
- preserves email/password as a fallback rather than the main path.
