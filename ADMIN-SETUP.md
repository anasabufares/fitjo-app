# FitJo secure admin setup

The public app no longer contains an admin account or shared admin code. The standalone admin area is available at `/admin` and requires both:

- the private admin password; and
- a current six-digit code from an authenticator app.

## One-time setup

1. In a Windows terminal opened in this project, run:

   ```text
   powershell -ExecutionPolicy Bypass -File scripts/configure-admin.ps1
   ```

   On macOS or Linux, run `node scripts/configure-admin.mjs` instead.

2. Choose a unique password with at least 12 characters. The terminal hides it while you type.
3. Add the displayed account to Google Authenticator, Microsoft Authenticator, Authy, or 1Password. Enter the current code when prompted.
4. In Netlify, open **Project configuration → Environment variables**. Add the three values printed by the setup tool:

   - `ADMIN_PASSWORD_HASH`
   - `ADMIN_TOTP_SECRET`
   - `ADMIN_SESSION_SECRET`

   If your plan supports variable scopes, select **Functions**. Mark the values as secret when that option is available.
5. Redeploy the site, then open `https://your-site.example/admin`.

Never commit the three values or paste them into public files. Changing any one of them requires a new deploy. Changing `ADMIN_SESSION_SECRET` also signs out existing admin sessions.

## What the dashboard can do

- **Access keys** — generate a one-time key for a coach or gym owner and send it to them. They must enter it when creating their account; without a valid key, those account types cannot sign up. Keys can be copied, revoked before use, and show which email used them.
- **Add member** — create a member account with a name, email, and temporary password, then share those with the member.
- **Suspend / restore / remove** — suspend an account temporarily, restore it, or remove it permanently (with a confirmation prompt).
- **Broadcast & giveaway** — send an announcement to members or pick a random giveaway winner.

Note: while the app is still in its browser-stored prototype phase, accounts and access keys live in each browser's local storage. A key generated on one device is used by members of that same browser profile; the shared backend arrives in Phase 2.

## Security behavior

- Passwords are stored as a salted scrypt hash, not as readable text.
- Authenticator codes use standard 30-second TOTP and allow one time step of clock drift.
- Successful sign-in creates an eight-hour, signed, `HttpOnly`, `SameSite=Strict` cookie that is restricted to `/admin`.
- Login requests are rate-limited by IP on Netlify.
- Admin responses are not cached and include restrictive browser security headers.
