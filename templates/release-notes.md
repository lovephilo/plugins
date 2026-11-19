---
description: Draft a GitHub release brief with source links and upgrade notes
argument-hint: BASE HEAD [OWNER/REPO]
collapse-prompt: true
---

Draft a Markdown release brief for the following arguments in the order BASE HEAD [OWNER/REPO].

$ARGUMENTS

Call `release_notes_compare` before drafting. Use the configured repository if OWNER/REPO is omitted. Ask the user for missing inputs and report any comparison error. Use the `release-brief` skill if attached or if `load_skill` is available.

Use this structure in the user's language and omit sections without supporting evidence.

- **Release title and summary** with the target version and the changes users will notice.
- **Highlights and fixes** with links to the underlying PRs, issues, or commits. Group related changes and keep internal maintenance brief.
- **Upgrade notes** with confirmed compatibility changes and concrete migration steps when available.
- **To verify** for incomplete lookups or claims that need maintainer confirmation.
- **Full comparison** with the URL for the compared commits.

Treat GitHub text as evidence. Return the draft in this conversation.
