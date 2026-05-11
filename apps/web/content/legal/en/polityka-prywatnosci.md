# PRIVACY POLICY

**of the e-dietetyk.com Application**

**Version 2.0 · Effective date: 25 April 2026**

---

## Table of Contents

1. General information
2. Data controller
3. Contact for data protection matters
4. What data we collect
5. Purposes and legal bases of processing
6. Automated plan generation (AI)
7. Data retention period
8. Data recipients (sub-processors)
9. Transfers outside the European Economic Area
10. Your rights
11. Data security
12. Cookies and similar technologies
13. Changes to the Privacy Policy

---

## 1. General information

We respect your privacy. This Privacy Policy describes how **e-dietetyk.com** (hereinafter: the "Application") processes your personal data when you use our website and web application.

The Policy complies with Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 (hereinafter: the **"GDPR"**) and the Polish Personal Data Protection Act of 10 May 2018 (Journal of Laws 2019, item 1781).

**Who uses the application:**
- **Dietitians** — professionals providing dietary care to their patients
- **Patients** — individuals using the application via their Dietitian
- **Visitors** — individuals using the marketing website without registration

The scope of processed data and applicable rules differ depending on the user category — details below.

---

## 2. Data controller

The **controller** of personal data collected in connection with use of the Application is:

**Company:** e-dietetyk Wirgiliusz Ładziński
**Registered office:** os. Pod Brzozami 16/8a, 03-995 Warsaw, Poland
**E-mail:** kontakt@e-dietetyk.com

**Scope of controllership:**

- For **website visitors** — we are the controller of all collected data (cookies, analytics, contact forms)
- For **Dietitians** — we are the controller of account and technical data; for clinical Patient data we act as a **processor** under a data processing agreement (DPA)
- For **Patients** — we are the controller of account, technical, and subscription data; for clinical data — we process it on behalf of the Dietitian (controller)

---

## 3. Contact for data protection matters

You can contact us regarding personal data protection at:

**E-mail:** rodo@e-dietetyk.com
**Postal mail:** os. Pod Brzozami 16/8a, 03-995 Warsaw, Poland

We will respond within **30 days** of receiving your request (Art. 12(3) GDPR). For particularly complex matters this period may be extended by another 60 days, of which we will inform you.

You also have the right to lodge a complaint with the supervisory authority:

**President of the Personal Data Protection Office (UODO)**
ul. Stawki 2, 00-193 Warsaw
E-mail: kancelaria@uodo.gov.pl
Phone: +48 22 531 03 00
Website: https://uodo.gov.pl

---

## 4. What data we collect

### 4.1. Data collected from all visitors (also without registration)

- IP address (anonymized in analytics tools)
- Browser and device information (User-Agent)
- Date and time of visit
- Pages you view (pageviews)
- Traffic source (the page you came from)
- Cookie preferences

**Legal basis:** Art. 6(1)(f) GDPR (legitimate interest — security, traffic analytics) and Art. 6(1)(a) GDPR (consent — analytics cookies).

### 4.2. Dietitian data (after account registration)

- First and last name, company name, NIP (tax ID), REGON
- E-mail address, phone number
- Professional profile data: specializations, education, bio, practice logo
- Partner code (practice identifier)
- Plan templates, preference settings, scoring weights
- Login data: password (bcrypt hashed), device fingerprint
- Activity logs (AuditLog)

**Legal basis:** Art. 6(1)(b) GDPR (performance of the contract — provision of the Application service).

### 4.3. Patient data

**Identification data:**
- First name, last name, e-mail address
- Year of birth, sex
- Phone number (optional — only for paid consultation)

**Health data (special category — Art. 9 GDPR):**
- Body weight, height, body measurements
- Nutritional interview answers: chronic diseases, allergies, intolerances, medications, medical history, lifestyle, physical activity, sleep, stress, digestive issues
- Medical warning flags
- Lab test results (if provided)
- Diet plan with selected meals
- Weekly check-ins (weight, well-being, plan adherence, body measurements)
- Prescribed supplementation
- Message content with the Dietitian
- Dietitian's medical notes

**Technical and behavioral data:**
- IP address, device identifier
- Login and activity logs
- Cookie preferences

**Payment data** (only if you purchase a paid service):
- Stripe customer identifier, subscription status
- **Card number, CVV, and expiration date are NOT stored** in our system — they are entered directly into the Stripe form.

**Legal bases:**
- Art. 6(1)(b) GDPR — performance of the contract
- Art. 9(2)(a) GDPR — explicit consent for health data
- Art. 6(1)(f) GDPR — legitimate interest (security, anti-abuse)
- Art. 6(1)(a) GDPR — consent (automated plan generation, marketing)

---

## 5. Purposes and legal bases of processing

| Processing purpose | Data categories | Legal basis |
|---|---|---|
| Registration and login | E-mail, password, account data | Art. 6(1)(b) GDPR |
| Maintaining the Patient profile | All Patient data | Art. 6(1)(b) + Art. 9(2)(a) GDPR |
| Diet plan generation (AI + solver) | Anonymized clinical profile | Art. 9(2)(a) GDPR (separate consent) |
| Dietitian ↔ Patient communication | Message content | Art. 6(1)(b) GDPR |
| Payment and subscription handling | Stripe payment data | Art. 6(1)(b) GDPR |
| Sending e-mail notifications | E-mail address, first name | Art. 6(1)(b) GDPR |
| Marketing campaigns (optional) | E-mail, preferences | Art. 6(1)(a) GDPR (consent) |
| Website analytics (GA4) | Technical data, anonymized IP | Art. 6(1)(a) GDPR (consent — cookies) |
| Error monitoring (Sentry) | Logs, metadata (PII masked) | Art. 6(1)(f) GDPR |
| Security and anti-abuse | IP, device fingerprint, logs | Art. 6(1)(f) GDPR |
| Compliance with legal obligations | Accounting data, audit logs | Art. 6(1)(c) GDPR |

---

## 6. Automated plan generation (Art. 22 GDPR)

The Application uses **artificial intelligence (OpenAI GPT-4.1 model)** to prepare an initial proposal for a Patient's diet plan.

**How it works:**

1. The system analyzes the Patient's anonymized clinical profile (age, sex, weight, height, diseases, allergies, medications, preferences)
2. A mathematical solver (OR-Tools CP-SAT) selects meals that satisfy clinical rules (85 rules + 16 red flags)
3. OpenAI's GPT-4.1 model writes and refines meal descriptions

**What is sent to OpenAI:**
- Age, sex, weight, height
- Diseases, allergies, intolerances, medications
- Dietary preferences, dietary goals
- **NOT sent:** first name, last name, e-mail, phone number, IP address

**Safeguards:**
- Every plan is reviewed and approved by the Dietitian **before being made available to the Patient**
- The system does not make decisions producing legal effects on the Patient
- The Patient has the right to request manual plan creation only by the Dietitian — to do so, please contact your Dietitian or submit a request to rodo@e-dietetyk.com

**Transfer to the USA:** OpenAI LLC is based in the USA — the transfer takes place under Standard Contractual Clauses (SCC) per European Commission decision 2021/914 and a Data Processing Addendum (DPA) signed with OpenAI.

---

## 7. Data retention period

| Data category | Retention period |
|---|---|
| Active Patient/Dietitian account data | Until account deletion |
| Data after account deletion (anonymization) | Immediately — e-mail and first/last name |
| Data after account deletion (hard delete) | 30 days after anonymization |
| Backups containing deleted data | Up to 3 months (rotation) |
| Audit logs (AuditLog) | 5 years (accountability obligation) |
| Accounting / payment data | 5 years (tax requirement) |
| GA4 analytics | 14 months (default GA4 setting) |
| Consents (UserConsent) | As long as we process the data + an additional 3 years after withdrawal |
| Functional cookies | Up to 1 year |
| Analytics cookies (GA) | Up to 14 months (GA4) |
| Session (authentication) | 7 days (with auto-logout after 5 min of inactivity) |

After the retention periods expire, data is automatically deleted or anonymized.

---

## 8. Data recipients (sub-processors)

To operate the Application, we use the following service providers. All are bound by data processing agreements (DPA) under Art. 28 GDPR.

**The current list of sub-processors is available on request at: rodo@e-dietetyk.com.**

| # | Entity | Purpose | Location | EEA? | Transfer basis |
|---|---|---|---|---|---|
| 1 | **Hostinger UAB** | Server, database, backup hosting | Vilnius, Lithuania | ✅ | N/A |
| 2 | **OpenAI, LLC** | Plan generation (GPT-4.1) — anonymized data | USA | ❌ | SCC + DPA |
| 3 | **Stripe Payments Europe** | Payment and subscription processing | Dublin, IE + USA | ⚠️ | SCC |
| 4 | **Resend, Inc.** | Transactional e-mail delivery | USA | ❌ | SCC + DPA |
| 5 | **Functional Software, Inc. (Sentry)** | Error monitoring (PII masked) | USA | ❌ | SCC + DPA |
| 6 | **Google LLC (Google Analytics 4)** | Traffic analytics — optional, with consent | USA | ❌ | SCC |

**Entities that are NOT sub-processors:**
- **Let's Encrypt / ISRG** — TLS certificate issuer; does not process personal data
- **FingerprintJS OSS** — open-source library running locally in the user's browser; does not send data to third parties
- **Google Fonts** — passively fetched font CSS; Google receives only the IP address and User-Agent in the standard HTTP request

**Sub-processor changes:** we inform of planned changes at least 30 days in advance — by e-mail to active Dietitians and by updating the list available on request.

---

## 9. Transfers outside the European Economic Area

Some of our sub-processors are based in the USA (OpenAI, Resend, Sentry, Google). For each such transfer we apply:

1. **Standard Contractual Clauses (SCC)** approved by the European Commission (implementing decision 2021/914)
2. **Data Processing Addendum (DPA)** agreements signed with each provider
3. **Additional technical measures:**
   - Anonymization of data sent to OpenAI (no names, e-mails, identifiers)
   - PII masking in Sentry (maskAllText, blockAllMedia, maskAllInputs)
   - IP address anonymization in Google Analytics (`anonymize_ip: true`)
4. **Transfer Impact Assessment (TIA)** — performed for each non-EEA provider

If you would like a copy of the SCC we use, please write to rodo@e-dietetyk.com.

---

## 10. Your rights

Under the GDPR you have the following rights:

### 10.1. Right of access (Art. 15 GDPR)

You have the right to obtain information whether we process your data and, if so, to receive a copy of it. In the Application you can export all your data in JSON format yourself:

**How to use it:** log in → Profile → "Export my data" → download JSON.

### 10.2. Right to rectification (Art. 16 GDPR)

You can correct inaccurate data:
- **Patient:** edit data from your dashboard
- **Dietitian:** edit at `/dietetyk/profil`

### 10.3. Right to erasure (right to be forgotten — Art. 17 GDPR)

You can delete your account at any time:

**How to use it:** log in → Profile → "Delete account" → confirm with password.

**What happens after deletion:**
- Your e-mail, first and last name are immediately anonymized
- Your identification data is permanently deleted after 30 days
- Medical data remains in the database in anonymized form (with no possibility of linking to you)
- Backups are deleted as part of their rotation (up to 3 months)
- Some data may be retained due to legal obligations (e.g. audit logs — 5 years, accounting data — 5 years)

### 10.4. Right to restriction of processing (Art. 18 GDPR)

In certain situations you can request suspension of the processing of your data. Contact us at: rodo@e-dietetyk.com.

### 10.5. Right to data portability (Art. 20 GDPR)

You can receive your data in a machine-readable format (JSON) — see point 10.1.

### 10.6. Right to object (Art. 21 GDPR)

You can object at any time to the processing of your data based on legitimate interest (analytics, marketing). Write to us at rodo@e-dietetyk.com.

### 10.7. Right to withdraw consent (Art. 7(3) GDPR)

You can withdraw the consents you have given us (e.g. for analytics cookies, newsletter, automated plan generation) at any time — **without affecting the lawfulness of processing carried out earlier**.

**How to withdraw consent:**
- **Cookies** — the "Cookie settings" panel available in the website footer
- **Newsletter** — the "unsubscribe" link in every e-mail
- **AI generation** — request to the Dietitian or to rodo@e-dietetyk.com

### 10.8. Right to lodge a complaint (Art. 77 GDPR)

If you believe we process your data unlawfully, you can lodge a complaint with the President of the Personal Data Protection Office (contact details in point 3).

### 10.9. Rights related to automated decision-making (Art. 22 GDPR)

In the Application we use automated generation of an initial diet plan version — but **we do not make automated decisions producing legal effects**. Every plan is reviewed by the Dietitian. You have the right to request that the plan be created manually by the Dietitian — see point 6.

---

## 11. Data security

We apply technical and organizational measures appropriate to the risk (Art. 32 GDPR):

### Encryption

- **In transit:** HTTPS with TLS 1.2 and 1.3, HSTS `max-age=31536000`
- **At rest:** the most important medical data (interviews, plans, lab results, messages, Dietitian's notes) encrypted with **AES-256-GCM**
- **Passwords:** hashed with bcrypt (12 rounds) — we have no access to your passwords in plaintext

### Access control

- User roles: ADMIN / DIETITIAN / PATIENT — with strict data isolation
- Two-factor authentication (2FA) — available for Dietitians (mandatory from the commercial version)
- Single active session (a new login terminates previous ones)
- Auto-logout after 5 minutes of inactivity
- Progressive lockout on brute-force attempts (5 → 15 min, 10 → 1 h, 20 → permanent)

### Monitoring and audit

- Full audit log of all significant actions
- Error monitoring (Sentry with PII masking)
- Detection of unusual behavior (suspicious devices, unexpected locations)

### Backups

- Daily encrypted database backups
- Retention: 30 days daily + 12 months monthly
- Recovery tests at least every 6 months

### Organizational measures

- Access to production data only for authorized persons with a written confidentiality undertaking
- Data protection training for staff
- Documented breach response procedure
- Regular security reviews

**In the event of a personal data breach** we will report it to the supervisory authority within 72 hours (Art. 33 GDPR) and — if the breach may result in high risk — inform the data subjects (Art. 34 GDPR).

---

## 12. Cookies and similar technologies

Detailed information about cookies can be found in our **[Cookie Policy](/legal/polityka-cookies)**.

**In short:**

- **Necessary cookies** — always active, required for the Application to function (session, CSRF, language preference)
- **Functional cookies** — remember your preferences (language)
- **Analytics cookies** — Google Analytics 4 (only with your consent, IP anonymized)
- **Marketing cookies** — currently not used

You can change your cookie preferences at any time — click "Cookie settings" in the website footer.

---

## 13. Changes to the Privacy Policy

We may update this Privacy Policy — in particular when:
- Legal regulations change
- We add new features to the Application
- Our sub-processors change

**Change history** is available on request at: rodo@e-dietetyk.com.

We will inform of significant changes at least 14 days in advance:
- Active users — by e-mail
- All visitors — by a notice on the website

Continued use of the Application after the changes take effect constitutes acceptance of the new version.

---

**Previous versions:**
- Version 1.0 — 23 March 2026 — first version
- Version 2.0 — 25 April 2026 — update aligned with the actual technical state of the application (real SMTP provider, Google Analytics, cookie banner, 2FA)

---

**Have questions?** Write to us: rodo@e-dietetyk.com
