# Guest Default Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every visitor opens Fursatly in English + light; only a choice saved on a signed-in account overrides that.

**Architecture:** A pure `PreferenceStore` (lib) decides what to show and where a change is kept: guests → `sessionStorage`, accounts → Supabase `user_metadata.preferences` plus a `localStorage` copy for the pre-paint probe. Theme/Language contexts become state + DOM only; a `PreferencesSync` component bridges auth to them, and a `usePreferences()` hook is what the controls call.

**Tech Stack:** Next.js 15 App Router, React 19, @supabase/ssr, Vitest (node env).

## Global Constraints

- Defaults: theme `light`, locale `en`.
- Keys: account copy `localStorage['fursatly_account_prefs']`; guest `sessionStorage['fursatly_theme' | 'fursatly_locale']`; legacy `localStorage['fursatly_theme' | 'fursatly_locale']` never read, deleted on load.
- Account field: `user_metadata.preferences = { theme?, locale? }`, whole object sent on every save.
- Storage may be missing or throw — every access guarded.
- Spec: `docs/superpowers/specs/2026-09-30-guest-default-preferences-design.md`.

---

### Task 1: PreferenceStore, account parsing and pre-paint probe

**Files:**
- Modify: `src/lib/preferences.ts` (whole file)
- Test: `tests/default-preferences.test.mjs` (whole file)

**Interfaces:**
- Produces:
  - `type Theme = 'light' | 'dark'`, `type Preferences = { theme: Theme; locale: Locale }`
  - `DEFAULT_PREFERENCES: Preferences`, `ACCOUNT_PREFS_KEY: string`
  - `isTheme(v): v is Theme`, `isLocale(v): v is Locale`, `resolveTheme(v): Theme`, `resolveLocale(v): Locale`
  - `accountPreferences(metadata: unknown): Partial<Preferences>`
  - `class PreferenceStore(local, session)` with `static browser()`, `load(): Preferences`, `save(change, signedIn): Partial<Preferences> | null`, `readAccount(): Partial<Preferences> | null`, `writeAccount(prefs): void`, `forgetAll(): void`, `dropLegacy(): void`
  - `themeProbeScript(): string`

- [ ] **Step 1: Write the failing tests** — replace `tests/default-preferences.test.mjs` with the suite covering: first visit (defaults, legacy keys ignored + dropped), guest (tab-only, new tab resets, never touches localStorage), signed in (copy + merged account payload, new tab opens saved choice, copy beats tab, per-field fallback, readAccount null vs `{}`), signing out (`forgetAll`), bad data (corrupt JSON, invalid values, throwing and missing storage, invalid fields dropped from `save`), `accountPreferences`, and `themeProbeScript` run via `new Function('localStorage','sessionStorage','document', script)` agreeing with `load().theme` across the same storage states, painting `#141210` chrome, and surviving blocked storage.
- [ ] **Step 2: Run** `npx vitest run tests/default-preferences.test.mjs` — expect FAIL (`PreferenceStore` / `accountPreferences` / `themeProbeScript` not exported).
- [ ] **Step 3: Implement** `src/lib/preferences.ts` per the interface above (see the committed file for the exact code).
- [ ] **Step 4: Run** the same command — expect all PASS.
- [ ] **Step 5: Commit** `git add src/lib/preferences.ts tests/default-preferences.test.mjs && git commit`.

### Task 2: Wire contexts, sync, controls and layout

**Files:**
- Modify: `src/context/ThemeContext.tsx` — drop storage reads/writes + storage listener; add stable `setTheme(theme)`; `toggleTheme()` returns the new `Theme`; mount effect uses `PreferenceStore.browser().load().theme`.
- Modify: `src/context/LanguageContext.tsx` — drop `localStorage`; `setLocale` is the raw state setter; mount effect uses `PreferenceStore.browser().load().locale`.
- Create: `src/context/PreferencesSync.tsx` — `PreferencesSync` component + `usePreferences()` hook.
- Modify: `src/components/ThemeToggle.tsx:74` — `const { toggleTheme } = usePreferences();`
- Modify: `src/components/LanguageSwitcher.tsx:18` — `setLocale` from `usePreferences()`.
- Modify: `src/app/layout.tsx` — `themeProbeScript()` replaces the inline probe; `<PreferencesSync />` mounted inside `LanguageProvider`.

**Interfaces:**
- Consumes: everything Task 1 produces; `useAuth()` / `useDb()` from `@/supabase`.
- Produces: `usePreferences(): { toggleTheme: () => void; setLocale: (l: Locale) => void }`.

`PreferencesSync` behaviour:
1. On mount: `PreferenceStore.browser().dropLegacy()`.
2. When auth resolves, once per user id (ref-guarded so `USER_UPDATED` / token refresh never re-apply):
   - user → `writeAccount(accountPreferences(user.user_metadata))`, then show those fields.
   - no user and `readAccount() !== null` → `forgetAll()`, show `DEFAULT_PREFERENCES`.
3. `storage` event on `ACCOUNT_PREFS_KEY` with a value → show `readAccount()`.

`usePreferences().keep(change)`: `store.save(change, user !== null)`; a non-null result is sent with `db.auth.updateUser({ data: { preferences } })`, failures logged with `console.warn`.

- [ ] **Step 1:** Make the edits above.
- [ ] **Step 2:** `npm run typecheck` — expect no errors.
- [ ] **Step 3:** `npm test` — expect all suites PASS.
- [ ] **Step 4:** `npm run build` — expect success.
- [ ] **Step 5: Commit.**

### Task 3: Verify in the browser, then ship

- [ ] Dev server on localhost; check with DOM reads:
  - fresh visit → `html` has no `dark`, switcher shows EN pressed.
  - legacy `localStorage` dark/uz set → reload → still light/EN, legacy keys removed.
  - guest toggles dark + UZ → navigate to an event and reload → still dark/UZ; `sessionStorage` cleared (new tab) → light/EN; `localStorage` untouched.
  - signed-in fixture (local fake `sb-…-auth-token` cookie whose user carries `user_metadata.preferences = { theme: 'dark', locale: 'ru' }`, far-future expiry, no real credentials) → reload → dark before hydration (probe) and RU; toggles write the copy and attempt `PUT /auth/v1/user` with `preferences`.
  - sign-out → light/EN, copy and tab keys gone.
- [ ] `graphify update .`
- [ ] Push branch, open PR, merge, confirm production serves the new probe.
