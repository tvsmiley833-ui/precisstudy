---
name: content-quality
description: Editorial checklist for PrecisStudy study content — units, concepts, questions, explanations, flashcards, and practice exams. Use when authoring or reviewing guide JSON, question banks, or explanations, or when the user asks to check content quality / accuracy / alignment.
---

# Content quality

Apply to any unit, concept, question, explanation, flashcard, or exam item.
Report as: **issue → fix → severity (blocker / fix-soon / polish)**.

## Pedagogy
- [ ] Each unit states student-friendly learning objectives before the content.
- [ ] Concepts are labelled by importance (must-know / good-to-know / extension) and rough difficulty.
- [ ] Common misconceptions are called out next to the concept they trip up.
- [ ] Sequence is worked example → guided practice → independent practice.
- [ ] Explanations give the *why* (conceptual reasoning), not only the procedure.
- [ ] Quantitative items include a reasonableness / estimation check.
- [ ] At least some items are transfer questions in an unfamiliar context.

## Question integrity
- [ ] Tagged by skill, difficulty, standard/framework reference, and expected solve time.
- [ ] Distractors are plausible and map to real misconceptions — no throwaway options.
- [ ] No unintended clues (grammar agreement, length, "all of the above", absolutes).
- [ ] Numeric answers accept equivalent forms and sensible rounding; units required where appropriate.
- [ ] No duplicate / near-duplicate of an existing item in the same bank.
- [ ] Image-based questions have a text description of the image.

## Provenance & governance
- [ ] Released exam material is clearly distinguished from platform-authored practice.
- [ ] Historical quotations, data, science claims, and excerpts are cited.
- [ ] Alignment claims use "aligned to the published AP/course framework" with a review date — never "certified" unless formally certified.
- [ ] Material changes to a question carry a version note (what changed, why, when).
- [ ] Inline "report this question" path exists and is wired to a review queue.
- [ ] High-abandonment / high-miss items are *flagged for editorial review*, never auto-hidden.

## Coverage
- [ ] Every learning objective has practice, an explanation, and at least one assessment item.
- [ ] Coverage gaps (objective with no practice / no explanation / no assessment) are listed.

## Scaffold check
- [ ] The content is real, not generator stub text. Tells: "The essential framework of X",
      "Unit N core term", "Practice exam question N — which answer applies the unit's core idea".
      A ~450 KB guide JSON with no literal word "placeholder" can still be all scaffold — open a unit and read it.
