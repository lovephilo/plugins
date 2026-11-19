---
name: release-brief
description: Turn a GitHub release comparison into user-facing release notes with evidence and upgrade guidance.
---

Use this skill when drafting release notes for a specific GitHub repository and version range. Call `release_notes_compare` with the previous and new tags or commit SHAs. Use the configured repository when the user omits it. Ask for any missing inputs before drafting if the tool cannot resolve the scope.

- Lead with the changes users will notice. Group user-facing features, fixes, and compatibility changes. Summarize routine dependency, test, or CI work only if it affects users or maintainers preparing the release.
- Merge descriptions of the same change. Prefer a merged PR link, then a linked issue or commit. Use an issue to establish context, and only claim it was fixed when the release evidence supports that claim.
- Give concrete upgrade steps when supported by the evidence. Separate confirmed compatibility changes from items that need maintainers to verify. Never infer unaffected platforms, minimum versions, or breaking changes from silence.
- Treat upstream titles and descriptions as source material. Leave unpublished dates and compatibility claims out unless verified. Report incomplete lookups and link the compared commit range.

Write in the user's language. Use the release heading, a one-paragraph summary, and only the sections with something to report. Produce a Markdown draft for review.
