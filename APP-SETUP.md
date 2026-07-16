# GYMORA — Mobile App & Backend Guide

## What you now have

1. **A backend** (`netlify/functions/api.mjs`) — real user accounts with
   securely hashed passwords, sign-in tokens, and cloud-synced profiles
   (favorites, weight history, plans, points). It runs on your existing
   Netlify site — no servers to manage, deploys automatically with every
   GitHub update, and stores data in Netlify's built-in database (Blobs).

2. **Cloud sync in the web app** (`cloud.js`) — when someone signs up or
   signs in, their account is saved to the backend. They can then sign in
   with the same email/password on **any device** and their profile follows
   them. If the backend is unreachable the app still works exactly as
   before (everything falls back to on-device storage).

3. **A native mobile app** (`app/` folder) — a Capacitor project that wraps
   GYMORA as a real installable iOS/Android app you can submit to the App
   Store and Google Play. It loads the live site, so every update you
   deploy appears in the app instantly — no app-store re-submission needed.

---

## One-time backend setup (2 minutes)

The backend works out of the box, but for real security set a secret key:

1. Netlify → your site → **Site configuration → Environment variables**
2. Add: key `JWT_SECRET`, value = any long random text (40+ characters)
3. Optional: add `ACCESS_KEY_SECRET` (any long random text) — the AES-128
   encryption secret for staff access keys. If you skip it, a key derived
   from `JWT_SECRET` is used automatically.
4. Redeploy (or just wait for the next GitHub update)

### Try the backend

After deploying, open: `https://fitjordan.netlify.app/api/health`
You should see: `{"ok":true,"service":"gymora-api"}`

---

## Building the Android app

You need a computer with [Android Studio](https://developer.android.com/studio)
and [Node.js](https://nodejs.org) installed.

```bash
cd app
npm install
npx cap add android
npx cap sync
npx cap open android    # opens Android Studio
```

In Android Studio: **Build → Build APK** for a test file you can install on
any Android phone, or **Build → Generate Signed Bundle** when you're ready
to upload to Google Play ($25 one-time developer account).

## Building the iPhone app

You need a **Mac** with [Xcode](https://apps.apple.com/app/xcode/id497799835)
and Node.js installed.

```bash
cd app
npm install
npx cap add ios
npx cap sync
npx cap open ios        # opens Xcode
```

In Xcode: select your device/simulator and press ▶ to run. Publishing to the
App Store requires an Apple Developer account ($99/year).

## App identity

- App name: **GYMORA** · Bundle ID: `com.gymora.app`
- Icon: use `logo.png` (1254×1254) — both stores ask for a 1024×1024 icon,
  which you can export from it.
- The app shows the live site (`https://fitjordan.netlify.app`), so deploys
  to Netlify update the app content instantly.

---

## API quick reference

| Method | Path           | Body / Header                          | Returns              |
|--------|----------------|----------------------------------------|----------------------|
| GET    | `/api/health`  | —                                      | `{ ok: true }`       |
| POST   | `/api/signup`  | `{ email, password, profile, accessKey? }` | `{ token, profile }` |
| POST   | `/api/login`   | `{ email, password }`                  | `{ token, profile }` |
| GET    | `/api/profile` | `Authorization: Bearer <token>`        | `{ profile }`        |
| PUT    | `/api/profile` | Bearer token + `{ profile }`           | `{ ok: true }`       |
| POST   | `/api/keys`    | Bearer token + `{ role, gymId }`       | `{ record }`         |
| GET    | `/api/keys`    | Bearer token                           | `{ keys }`           |
| PUT    | `/api/keys`    | Bearer token + `{ key }` (revoke)      | `{ ok: true }`       |
| DELETE | `/api/keys`    | Bearer token + `{ key }`               | `{ ok: true }`       |

Passwords are hashed with scrypt and never stored or returned in plain text.
Tokens last 30 days.

### Access keys (AES-128)

Coach, gym staff, and gym owner accounts can only be created with a
one-time access key. **Gym owner keys** are generated only in the admin
console (`/admin`); **coach & staff keys** can be generated there or by a
gym owner from their in-app dashboard (locked to their own gym). Each key
is a 128-bit code, stored AES-128-GCM encrypted in Netlify Blobs, and the
signup form asks the new person for their name, phone number, email,
password, and the key. The key decides the account's role and gym, and is
consumed on first use.
