---
name: dashboard-review
description: Reusable review checklist for the PrecisStudy signed-in study dashboard — UX, accessibility, and "what do I do next" clarity. Use before shipping any change to the dashboard, scheduler, or progress views, or when the user asks to review/improve the dashboard.
---

# Dashboard review

Run this checklist against the signed-in dashboard, scheduler, and progress
views. Report findings as: **problem → fix → priority (P0/P1/P2)**, one
prioritised list, no code unless asked.

## 1. Next action & orientation
- [ ] Today's single highest-value study action is shown **above** the schedule-setup UI.
- [ ] "Resume" returns the student to their exact last activity (unit, card, question).
- [ ] A course with no diagnostic/practice yet has an explicit "start here" flow, not a blank card.
- [ ] Every automated recommendation states *why* (the data signal) and can be dismissed/postponed.
- [ ] Unfamiliar areas carry one line of orientation text.

## 2. Metrics honesty
- [ ] Engagement metrics (time, streak, logins) are visually separate from learning metrics (accuracy, mastery, readiness).
- [ ] Mastery shows the evidence: how many questions contributed, over what window.
- [ ] "Unassessed" is used until there is enough evidence — never a fake 0%.
- [ ] Skill states are transparent (e.g. Attempted → Familiar → Proficient → Mastered).
- [ ] Streak language is neutral; no shame framing for a broken streak.

## 3. State coverage
- [ ] Distinct, useful **empty / loading / error / offline** states — never bare text.
- [ ] Skeletons match the final layout (no cumulative layout shift when data lands).
- [ ] Save feedback: saving → saved → failed, with a retry action on failure.
- [ ] A 7-day completion strip is present and independent of login streak.

## 4. Accessibility (WCAG 2.2 AA)
- [ ] Keyboard-only: every control reachable and operable; focus visible in both themes.
- [ ] Focus is not lost across client-side route changes; scroll position restored on back.
- [ ] Live regions announce save status and quiz feedback without stealing focus.
- [ ] No information by colour alone (correct/incorrect/known/weak all have text or icon).
- [ ] Charts have a text or table alternative.
- [ ] `prefers-reduced-motion` respected on every transition and auto-scroll.
- [ ] Touch targets ≥ 24×24 CSS px (aim 44×44 for primary actions); layout holds at 200% zoom.
- [ ] Document title updates on client-side navigation.

## 5. Mobile / responsive
- [ ] Bottom or persistent nav for Library / Today / Dashboard / Settings on narrow screens.
- [ ] Key study controls stay visible during a long session; no horizontal overflow.
- [ ] Scheduler is usable at small-phone and portrait-tablet widths.

## 6. Consistency
- [ ] Primary action is the same shape/label pattern across home, course, and dashboard.
- [ ] Generic labels replaced with context ("Start Geometry Diagnostic", not "Start").
- [ ] Button / card / badge / alert components match the rest of the app.
