# PRIV-2 age gate and PRIV-4 ads: decisions

## Age (PRIV-2)
The site never asks age, so a child under 13 can sign in. In the US, collecting personal data from under-13s needs verifiable parental consent (COPPA).

- **Option A: 13+ only (recommended for a one-person site).** Before the first sign-in, ask birth year. Under 13: no account is created and the guides keep working without one. Policy states the site is for 13+. Existing accounts of under-13s are deleted on a parent's request.
  *I build:* a birth-year screen shown before Google/GitHub/email sign-in, a stored "age confirmed" marker (year only, no birthday), the block message, and the policy line. About half a day.
- **Option B: allow under-13 with consent.** Needs a parental-consent flow and a way to verify the parent. Not recommended.

If your school's students are in a district with its own data agreement (New York Ed Law 2-d, etc.), also check what that agreement asks of you.

**Tell me A or B and I'll build it.**

## Ads (PRIV-4)
Ads run only on the homepage and only after the visitor accepts cookies. For a student audience the safest setting is **non-personalized ads only**, never on signed-in pages.

Ready-to-use change in `public/index.html`'s `loadAdsense()`, before the script is appended:
```js
window.adsbygoogle = window.adsbygoogle || [];
window.adsbygoogle.requestNonPersonalizedAds = 1;          // no personalization
window.adsbygoogle.push({ google_tag_for_child_directed_treatment: 1 }); // optional: treat as child-directed (also disables personalization, may lower revenue)
```
and skip loading entirely when signed in (`window.__ssSignedIn`). Also set the same in your AdSense account: Privacy & messaging → disable personalized ads for the site.

**Tell me yes and I'll apply it.** Expect somewhat lower ad revenue.
