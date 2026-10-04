# UI/UX review, 2026-10-04

Looked at on the local signed-in copy (test student with sample progress) at 1024 px, plus the 375 px phone pass done earlier the same day. Dark theme only. Not reviewed: light theme, the signed-out homepage, Google/Canvas-connected states, real phones.

Priority: **P1** hurts a core task, **P2** is noticeable friction, **P3** is polish.

## Guide pages (where students spend their time)

1. **P1 Tab bar is cut off.** The theme, font, focus and timer controls share the tab row, so "Quick Reference" and "Memory Tricks" are clipped ("C…") with no hint that the row scrolls. Move the tools to their own row or into the Tools menu.
2. **P1 Toolbar icons are unlabelled.** "A", the eye, and three tiny timer buttons (about 20 px) give no clue what they do. Add labels or tooltips and make them 32 px or larger.
3. **P1 Quiz answer choices look like text inputs.** Dark boxes with no letter or number, although the hint says "Press 1–4". Add 1–4 (or A–D) badges and a clearer hover/selected state.
4. **P2 Three banners sit above the quiz on desktop** (study-plan teaser, Start Diagnostic, "skip the diagnostic"). On phones they now sit below the question; do the same on desktop, or collapse them after the first visit.
5. **P2 "I'm just guessing" and "Hint" sit between the question and the answers** in faint dashed chips. Move them below the answers.
6. **P2 Unit progress is almost invisible.** The per-unit track is a faint hairline and the percent is tiny monospace text. Make the bar thicker with a visible track.
7. **P2 Two floating buttons (Tools, Feedback) cover text** at the bottom right of the reading column. Merge Feedback into Tools on guides, or shrink both to icons.
8. **P2 Flashcard controls all look the same.** Prev, Shuffle, Next, Know it, Still learning, Show: All, Type it, Export and Print are nine outline pills. Make "Know it" and "Still learning" the two primary buttons (green and amber), and tuck export/print into a menu.
9. **P3 "Rate cards to start your review schedule." looks like a button** but is a note. Style it as plain text.
10. **P3 The study-tips and related-guides block at the bottom** is plain underlined links with no spacing between the two lists and a large gap above. Turn it into two small card rows.
11. **P3 The hero meta line is long** ("11 Units · 439 Quiz Questions · 82 Flashcards · Diagnostic · …") and wraps. Keep the three counts; drop the feature list.
12. **P3 The expand chevron on each unit is a tiny "▾".** Use a larger icon and make the whole header row clearly clickable.

## Homepage

13. **P1 Signed-in students still see the first-visit pitch.** "Hi, I'm Sage! Tell me your class…", "Pick your class →" and "How It Works" all show for a student who already has classes and progress. Swap these for their next step (the dashboard's Up next) when signed in.
14. **P2 The hero fades in piece by piece**, leaving a large empty gap for about a second, and the search box appears last. Show the search box immediately; shorten or drop the stagger.
15. **P2 Sections fade in on scroll**, so fast scrolling shows blank areas. Reveal sooner or skip the effect below the first screen.
16. **P2 "Your classes" view wastes space.** Each enrolled class is a full-width card under its own subject heading, so three classes take three screens. Use one "Your classes" grid without group headings.
17. **P2 The readiness bar on class cards is about 60 px wide** and hard to see. Make it span the card.
18. **P2 Orphan cards.** Study Tools and Study Tips each show four cards in a three-column grid, leaving one alone on a second row. Use four columns, or show three or six.
19. **P2 The coverage chart fills half its card.** Let it use the full width or put the stats beside it.
20. **P3 Naming mismatch:** the filter pill says "AP Courses" but the group heading says "Advanced Placement".
21. **P3 "The Original" label on Geometry** means nothing to a new visitor. Remove or explain it.
22. **P3 The footer's last link wraps mid-phrase** ("Questions or / feedback?") and the Feedback button overlaps it.
23. **P3 The pin star only appears on hover**, so the feature is hard to discover. Show it faintly at rest.

## Dashboard

24. **P1 Too many planning tools.** A student meets four: the homepage calculator, "Plan my study" in Up next, a "Study Schedule" form inside every class card, and the weekly planner. Keep the planner and Up next; remove the per-class form or link it to the planner.
25. **P2 The left sidebar holds only a density switch** and takes about 200 px, pushing the content off-centre. Move density into a small menu and drop the sidebar.
26. **P2 The heatmap fills half its card.** Put the summary sentence and the day detail beside it.
27. **P2 "early read" is unexplained** next to the readiness percent. Add a tooltip or say "based on 3 of 11 units".
28. **P2 "Not yet assessed (1) → Science 1"** is an accordion holding a single class. Below about five classes, list them directly.
29. **P3 The assignments card repeats itself** in two sentences before the Connect button. Keep one.
30. **P3 Two XP systems are visible.** The dashboard and guides show the main level; Compete shows a separate quest level ("Level 1 Novice"). Pick one, or label the quest one "Quest level".

## Settings

31. **P2 The content column is narrow** (about 320 px of form) with empty space to the right, so the email and the Canvas fields are cut off ("yourschool.instructure.c"). Widen the panel to about 560 px.
32. **P3 The devices list can get long.** Show the three most recent and a "Show all" link.

## Across the site

33. **P1 The top navigation differs from page to page.** The dashboard has a Flashcards link, the homepage and tips do not, guides have no site header at all, and the tips pages show no active item. Use one header everywhere.
34. **P2 The footer differs too.** The homepage lists nine links; the dashboard lists three. Share one footer.
35. **P2 On the 404 page the announcement banner floats as a box in the middle of the screen.** Hide it there or pin it to the top.
36. **P2 Study Tips index has no way to filter** by subject, and the cards are in no clear order. Add subject chips and group by subject.
37. **P3 The account button's caret is a barely visible dot.** Use a proper chevron.
38. **P3 The exam-date field is a raw browser date input**, which looks different from every other control.

## Phones (remaining after today's fixes)

39. **P2 The guide breadcrumb wraps to three lines** on a 375 px screen. Show only "‹ All Guides".
40. **P2 The flashcard hint text runs under the floating buttons.**
41. **P3 The homepage header groups the logo, menu, theme and avatar on the left**, leaving the right edge empty. Spread them across the row.
