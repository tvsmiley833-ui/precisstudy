# Privacy policy — DRAFT for owner review

Status: **draft, not published.** `public/privacy/index.html` is unchanged. Items marked **[DECISION]** need your call; items marked **[VERIFY]** are statements about your accounts or contracts that only you can confirm. This is a plain-language policy written from what the code stores. It is not legal advice; have a lawyer or your school's counsel look at the children's-privacy and New York Education Law 2-d sections before you publish.

## What changed from the live policy

The live page is already accurate on most points. This draft fixes what is now out of date or missing:

1. **Export exists now.** Live text says "We don't have a one-click export yet." Settings now has "Download my data".
2. **Feedback email is opt-in.** Live text says the account email is attached when the field is blank. Now it is attached only if the visitor ticks "You can reply to my account email".
3. **IP-based counters.** The site keeps short-lived counters keyed by IP address (rate limits, daily AI-use caps, spam throttling, 1–2 days). The live policy doesn't say so.
4. **Error and speed logs are scrubbed.** Page addresses are cut to origin and path; emails and token-like strings are redacted before logging.
5. **Handle reservation.** Leaderboard handles are reserved so two students never share one; released on account deletion.
6. **Local data is cleared on sign-out.** Signing out removes saved progress and caches from the browser.
7. **Push devices are capped** at the five most recent.
8. **Ages and ads** — new section, needs your decision (below).
9. **Retention for requests and feedback** — now has a number if you choose one (below).
10. **Contact** — name a real address.

## Decisions only you can make

**[DECISION 1] Age.** The site doesn't ask age. Options:
- **A. Teen-and-up site (simplest).** State that PrecisStudy is for students 13 and older, add a birth-year screen before sign-in that blocks under-13s from creating an account, and keep guides usable without an account (no data collected). Under 13 can browse; they cannot sign in.
- **B. Under-13 with parental consent.** Requires verifiable parental consent (COPPA) and a separate flow. Not recommended for a one-person site.
- Either way, accounts for under-13s who already exist should be deleted on request.
The draft below assumes **A**.

**[DECISION 2] Ads.** Under A, the safest position for a student audience is non-personalized ads only (or no ads on signed-in pages). The draft assumes **non-personalized only, never on signed-in pages**. The code change is one flag; see `docs/owner/ADSENSE-NONPERSONALIZED.md`.

**[DECISION 3] Retention** for guide requests, feedback and attachments. The draft says **12 months**, then deleted. A cleanup job is already in the code and stays off until you set `RETENTION_DAYS`.

**[DECISION 4] Contact name and address** (must be a monitored inbox).

**[VERIFY]** whether Cloudflare Web Analytics is actually turned on for the site (the draft says "may").

---

# Privacy Policy — PrecisStudy

Last updated: [DATE]

PrecisStudy is a free study-guide site built and run by one high schooler. This page explains, in plain language, what the site stores about you, why, who else touches it, how long it stays, and how to remove it. Nothing here is sold to anyone.

## The short version

- You can use every study guide, flashcard deck, quiz and the AI Study Helper **without an account**.
- An account exists only to save your progress and unlock extras. **PrecisStudy is for students 13 and older**; we don't create accounts for children under 13.
- We never see or store a password. Sign-in is Google, GitHub, or a one-time email link.
- Optional features (leaderboards, share links, calendar sync, school connections) store extra data only if you turn them on, and each can be turned off again.
- You can **download** or **delete** your data yourself: Settings → Download my data, Settings → Delete account.
- Ads on PrecisStudy are **non-personalized** and never appear on pages you reach while signed in.

## Who this is for (ages)

PrecisStudy is built for high school students. You must be at least 13 to create an account. Before you sign in we ask your birth year; if you are under 13 we don't create an account (the guides still work without one). If you are a parent or guardian and believe your child under 13 has an account, email [CONTACT] and we will delete it. See also our Parents' Bill of Rights.

## What we collect

### When you sign in
- With Google or GitHub: your name and email address, as provided by that account (for Google we only accept a verified address).
- With an email link: your email address. The link works for 15 minutes.
- A sign-in record: which method you used and when, so we can tell a new account from a returning one.
- Your session lives in a browser cookie that expires after 30 days. "Sign out of all devices" ends every session at once. Signing out also clears the saved progress and caches this site keeps in your browser.

### Your study progress (saved only when you are signed in)
Per subject: questions answered and correct in each unit, worked examples finished, flashcards marked known, your spaced-repetition schedule, and a unit order from a syllabus you uploaded. Daily snapshots of your readiness and totals, your streak, XP and quests, your study goal and weekly schedule, notification preferences, and the list of subjects you enrolled in.

### Optional features, stored only if you use them
- **Leaderboards and study groups:** a random handle (or a nickname you choose), whether you opted in, and a group code. We reserve each handle so no two students share one. Other students see only your handle or nickname and weekly numbers, never your name or email, and only while you are opted in.
- **Peer challenges:** the questions picked, each side's score, and each participant's email so the challenge can find you. Challenges expire after about two weeks.
- **Share, calendar and invite links:** a random token. Anyone with your share link sees a read-only summary of your progress until you revoke it.
- **Study reminders:** your browser's push-notification address, for up to your five most recent devices.
- **AI flashcards and syllabus reading:** the notes, document or syllabus you provide is sent to an AI model (Cloudflare Workers AI) to make flashcards or find topics and dates. We keep the generated cards and extracted topics and dates; the file or text you provided is not kept.
- **Google Classroom and Calendar:** if you connect them, we keep an encrypted Google refresh token and your settings, read your coursework and due dates, and write study blocks to your calendar only if you ask. Disconnect in Settings or at your Google account's permissions page.
- **Canvas:** if you connect it, we keep your school's Canvas address and the access token you paste, encrypted. A Canvas token can see what your own login can see, so give it an expiry date and delete it in Canvas when you disconnect.

### Things you send us on purpose
- **Guide requests:** the class name and notes you type, an email if you add one, and up to three files (6 MB each).
- **Feedback:** your message, its category, the page you were on, and an email only if you typed one or ticked "You can reply to my account email".

### The AI Study Helper
The messages in your current conversation, plus which guide and topic you are on, are sent to an AI model (Cloudflare Workers AI) to write a reply. We don't save the conversation or link it to an account. Please don't type private information into it.

### Technical information
- Cloudflare, our host, processes standard connection data (IP address, browser type) to run and protect the site.
- To limit abuse and cost, we keep short-lived counters keyed by IP address or account (for example how many AI messages or form submissions were sent today). They expire within one to two days.
- Your browser sends us error reports and page-speed measurements. We keep only the page's address without its query string, with email addresses and token-like text removed. They are not tied to your account.
- We may use Cloudflare Web Analytics to count page views and measure load speed. It doesn't use advertising cookies. **[VERIFY]**

## Cookies and browser storage
- Sign-in cookies: your session (30 days) and short-lived cookies used while signing in (including a one-time sign-in check) or following an invite link.
- Your cookie choice about ads, remembered in your browser.
- Browser storage holds a copy of your progress, theme and display settings, timer and reading preferences, and your place in each guide. Signing out clears the progress; clearing site data removes everything.

## Advertising
PrecisStudy shows ads from Google AdSense to help cover hosting costs. We ask Google for **non-personalized ads only**: they are based on the page you're viewing, not on your history across sites. Ads never appear on pages you reach while signed in. Google may still use cookies to serve and measure ads; see Google's Privacy Policy and Ad Settings. On first visit you're asked to accept or decline ad cookies; ads only load if you accept, and you can change your choice any time via "Cookie preferences".

## Who else is involved
We don't sell your data or share it for marketing.
- **Cloudflare:** hosting, storage of your account data, AI models, sending sign-in emails, optional analytics.
- **Google:** sign-in, ads, and Classroom/Calendar if you connect them.
- **GitHub:** sign-in, if you choose it.
- **Your school's Canvas:** only if you connect it.
- **Browser push services:** deliver reminders if you turn them on.
- **jsDelivr** (math library on guide pages) and **Desmos** (only if you open the graphing calculator) can see your IP address when they load.

## How long we keep things
- Sign-in links: 15 minutes. Sessions: 30 days. Challenges: about two weeks. Spam and usage counters: one to two days.
- Account and progress data: until you delete your account.
- Guide requests and feedback (with attachments): **[DECISION 3] 12 months**, then deleted automatically; ask us to remove yours sooner.
- Error and speed logs: for the period Cloudflare keeps them.

## Your choices
- **Download your data:** Settings → Download my data gives you everything saved for your account as one file (sign-in tokens and share links are left out).
- **Delete your account:** Settings → Delete account removes your progress, sign-in record, share, calendar and invite links, Google and Canvas connections, leaderboard handle and group membership, challenges, and your email from any feedback or requests you sent. We also revoke our Google access. For Canvas, delete the token in Canvas too.
- **Reset progress, opt out, disconnect, turn off reminders:** all in Settings.
- **Ask us** about anything we hold, or to correct or delete it: [CONTACT].

## Changes to this policy
If what PrecisStudy collects changes in a meaningful way, this page is updated and the date above changes.

## Questions?
Email [CONTACT]. A real person — the person who built this — reads it.
