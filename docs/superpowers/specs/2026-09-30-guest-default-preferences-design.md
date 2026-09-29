# Guest defaults, account-owned preferences

**Date:** 2026-09-30
**Status:** approved

## Problem

The site already opens in English + light for a browser that has never chosen
anything. But every visitor's choice — signed in or not — is written to
`localStorage` (`fursatly_theme`, `fursatly_locale`) and wins forever after. A
guest who tapped UZ or the moon once gets Uzbek/dark on every later visit, and a
shared computer opens in whatever the last person picked.

## Rule

English + light is what every visitor sees on opening the site. The only thing
that overrides it is a choice saved on a signed-in account.

| Who | Opens with | A change is kept in |
|---|---|---|
| Guest | English + light, every fresh visit | `sessionStorage` — survives page-to-page navigation and reloads in that tab, gone when the tab closes |
| Signed in, never changed anything | English + light (or whatever the tab was already showing) | nothing until they change something |
| Signed in, changed language/theme | their saved choice, on any device they sign in on | Supabase `user_metadata.preferences`, plus a local copy |
| Just signed out | English + light | local copy and tab choices are cleared |

## Design

### Storage

- **Account (source of truth):** `user.user_metadata.preferences = { theme?, locale? }`,
  written with `supabase.auth.updateUser({ data: { preferences } })`. No migration,
  no extra fetch — it arrives with the session. GoTrue merges `data` at the top
  level, so the whole `preferences` object is sent each time.
- **Account copy:** `localStorage['fursatly_account_prefs']` = JSON of the same
  object. Exists only while an account is signed in on this browser. It lets the
  pre-paint probe apply dark mode before first paint (no flash) and keeps the
  device right if a save to Supabase fails.
- **Guest choice:** `sessionStorage['fursatly_theme' | 'fursatly_locale']`.
- **Legacy keys:** the old `localStorage` `fursatly_theme` / `fursatly_locale`
  are never read again and are deleted on load, so every existing guest
  returns to English + light.

Resolution, per field: account copy → this tab's guest choice → default. Invalid
or corrupt values at any layer are ignored.

### Units

- `src/lib/preferences.ts` (pure, tested)
  - `resolveTheme` / `resolveLocale` / `isTheme` / `isLocale` — validation.
  - `accountPreferences(metadata)` — the sanitised `preferences` from a user's metadata.
  - `PreferenceStore` — wraps injected `localStorage` / `sessionStorage` (either may be
    missing or throw): `load()`, `save(change, signedIn)`, `readAccount()`,
    `writeAccount()`, `forgetAll()`, `dropLegacy()`.
  - `themeProbeScript()` — the pre-paint script as a string, built from the same
    key constants so the two cannot drift.
- `ThemeContext` / `LanguageContext` — state and DOM only. They read their
  starting value from `PreferenceStore.load()` and no longer write storage.
  `toggleTheme()` returns the new theme; `setTheme` / `setLocale` are stable.
- `src/context/PreferencesSync.tsx`
  - `<PreferencesSync />` (renders nothing): when auth resolves to a user it
    applies that account's saved fields and refreshes the copy; when it resolves
    to nobody while a copy exists (sign-out, or a session that expired) it clears
    everything and returns to English + light. Runs once per user id, so token
    refreshes and our own saves never re-apply stale values. Also mirrors a
    signed-in change made in another tab and drops the legacy keys.
  - `usePreferences()` — what the UI calls: `toggleTheme()` and `setLocale()`
    apply the change, then persist it (guest → tab, account → copy + Supabase).
- `ThemeToggle` and `LanguageSwitcher` switch to `usePreferences()`.
- `layout.tsx` uses `themeProbeScript()` and mounts `<PreferencesSync />`.

### Errors

A failed `updateUser` (offline, expired token) logs a warning; the change stays on
screen and in the local copy. The next sign-in takes the account's value.

## Testing

- Vitest (`tests/default-preferences.test.mjs`): resolution order, tab-only guest
  choices, legacy keys ignored + dropped, account copy precedence and partial
  fields, sign-out clearing, corrupt/throwing storage, metadata sanitising, and the
  pre-paint probe agreeing with `load()` across the same cases.
- Browser (localhost): guest opens EN + light; guest choice survives navigation and
  reload; a fresh tab/session is EN + light again; legacy keys are ignored; a
  signed-in session (local fixture, no real credentials) opens in the account's
  saved choice before first paint; a signed-in change writes the copy and calls
  Supabase; sign-out returns to EN + light.
