# COOKIE POLICY

**of the e-dietetyk.com Application**

**Version 2.0 · Effective date: 25 April 2026**

---

## 1. What are cookies?

**Cookies** are small text files that a website saves on your device (computer, tablet, smartphone) while you browse it. Cookies allow us to:

- Remember your preferences (e.g. site language)
- Keep you logged in across pages
- Protect you from attacks (e.g. CSRF)
- Analyze how you use the website (with your consent)

Apart from cookies, our website also uses similar technologies:
- **localStorage / sessionStorage** — local data storage in the browser
- **Device fingerprinting** — computed **locally in your browser**, without sending data to third parties (used to protect against abuse)

---

## 2. What cookies we use

We divide cookies into **four categories**:

### 2.1. Necessary cookies (always active)

Without these cookies the website cannot function properly. They do not require your consent (Art. 173(3)(2) of the Polish Telecommunications Act — cookies necessary for service provision).

| Name | Purpose | Lifetime | Provider |
|---|---|---|---|
| `__Secure-authjs.session-token` | Login session (production) | 7 days | e-dietetyk.com |
| `authjs.session-token` | Login session (development environment) | 7 days | e-dietetyk.com |
| `authjs.csrf-token` | CSRF attack protection | Session | e-dietetyk.com |
| `authjs.callback-url` | Redirect after login | Session | e-dietetyk.com |
| `idle_last_activity` | Auto-logout after 5 min of inactivity | 5 minutes | e-dietetyk.com |
| `cookie-consent` | Remembering your cookie choices | 1 year | e-dietetyk.com |

### 2.2. Functional cookies (optional)

Allow us to remember your preferences. We use them with your consent.

| Name | Purpose | Lifetime | Provider |
|---|---|---|---|
| `NEXT_LOCALE` | Language selection (PL/EN) | 1 year | e-dietetyk.com |

### 2.3. Analytics cookies (optional — with consent)

Help us understand how visitors use the website so we can improve it. We use them **only with your explicit consent**.

| Name | Purpose | Lifetime | Provider |
|---|---|---|---|
| `_ga` | Google Analytics — user identifier | 2 years | Google LLC (USA) |
| `_ga_<ID>` | Google Analytics — session | 2 years | Google LLC (USA) |
| `_gid` | Google Analytics — session identifier | 24 hours | Google LLC (USA) |

**Google Analytics 4 (GA4) details:**

- **Operator:** Google Ireland Limited (EEA) — data transferred to Google LLC (USA)
- **Transfer basis:** Standard Contractual Clauses (SCC) per European Commission decision 2021/914
- **Data collected:** pages visited, events, time spent, anonymized IP address
- **Privacy configuration:** `anonymize_ip: true` (the IP address is shortened before being sent to Google)
- **Purpose:** traffic analytics, content and feature optimization
- **GA4 data retention:** 14 months (minimum GA4 setting)
- **More about Google's policy:** https://policies.google.com/privacy

### 2.4. Marketing cookies

**We currently do not use any marketing cookies** (remarketing, personalized ads, advertising pixels).

If we introduce them in the future, we will update this Policy and ask for separate consent.

---

## 3. Other technologies (non-cookies)

### 3.1. FingerprintJS (locally in your browser)

We use the **FingerprintJS OSS** library (open-source), which **locally in your browser** computes a device "fingerprint" based on:
- User-Agent
- Canvas/WebGL
- Installed plugins

**This fingerprint is NOT sent to any third party** — it is computed entirely locally. It only reaches our server in order to:
- Detect attempts to bypass the trial period
- Identify suspicious devices attempting brute-force logins
- Limit the maximum to 3 accounts per device

**Legal basis:** Art. 6(1)(f) GDPR (legitimate interest — abuse protection).

### 3.2. Google Fonts

Our website uses Google Fonts (fonts.googleapis.com, fonts.gstatic.com) to load typefaces. In the standard HTTP request Google receives only:
- Your IP address
- Your browser User-Agent

Google does not receive any other identifying data from our website. If you do not want Google to receive your IP, you can block Google Fonts from loading (e.g. with the uBlock Origin plugin) — the website will still work, just with system fonts.

### 3.3. Stripe

When you make a payment, Stripe (an external payment provider) may set its own cookies for fraud prevention. This happens **only at the moment of payment** — it is not active during normal browsing of the website.

Stripe's policy: https://stripe.com/privacy

---

## 4. How to manage cookies

### 4.1. In our application

On your first visit we show a **cookie banner** with three options:

- ✅ **Accept all** — consent to all cookie categories
- ✅ **Necessary only** — we use only technically necessary cookies
- ⚙️ **Settings** — you choose which categories to accept

**Changing preferences at any time:**
Click the **"Cookie settings"** link in the footer of every page.

After changing your settings, the relevant cookies will be deactivated immediately and previously set cookies will be deleted.

### 4.2. In your browser settings

You can also manage cookies from your browser. Most browsers allow you to:
- See which cookies are saved
- Delete selected cookies
- Block cookies for specific sites
- Block all cookies (note — this may limit the functionality of many sites)

**Instructions for popular browsers:**

- **Chrome:** https://support.google.com/chrome/answer/95647
- **Firefox:** https://support.mozilla.org/en-US/kb/cookies
- **Safari (Mac):** https://support.apple.com/en-us/HT201265
- **Safari (iOS):** https://support.apple.com/en-us/HT201265
- **Edge:** https://support.microsoft.com/en-us/microsoft-edge/delete-cookies

### 4.3. Disabling GA — Google extension

If you want to completely block Google Analytics, install Google's official add-on:
https://tools.google.com/dlpage/gaoptout

---

## 5. Record of your consents

When you click "Accept" in the cookie banner, we save:
- Your choice (which categories you accepted)
- Date and time
- Version of the Policy document you consented to
- Your IP address (for accountability)

**If you have an account in the Application** — consents are additionally saved in our database and linked to your profile. You can review them at any time in the panel: Profile → "My consents".

**Withdrawing consent** does not affect the lawfulness of processing carried out before withdrawal (Art. 7(3) GDPR).

---

## 6. Cookie retention period

| Type | Maximum lifetime |
|---|---|
| Session (session cookies) | Until the browser is closed |
| Necessary persistent | 7 days |
| Functional | 1 year |
| Analytics (GA) | 2 years (or 14 months — depending on the specific cookie) |
| Cookie consent | 1 year |

After this time, cookies expire automatically.

---

## 7. Changes to the Cookie Policy

We update this Policy in case of:
- Adding/removing analytics tools
- Changes of service providers
- Changes in legal regulations

We will inform of significant changes via an on-site banner at least 14 days in advance.

**Change history:**
- Version 1.0 — 17 April 2026 — first version
- Version 2.0 — 25 April 2026 — update reflecting the actual technical state (addition of GA4, correction of NextAuth v5 cookie names, sub-processor list update)

---

## 8. Contact

For matters related to cookies and data protection:

**E-mail:** rodo@e-dietetyk.com

**Data controller:**
e-dietetyk Wirgiliusz Ładziński
os. Pod Brzozami 16/8a, 03-995 Warsaw, Poland

**See also:**
- [Privacy Policy](/legal/polityka-prywatnosci)
- [Terms of Service](/legal/regulamin)
