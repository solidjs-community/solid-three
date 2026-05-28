# API reference page templates

Two page archetypes, two templates. Both share the same language rules and both end in a `## See also`. Use Template A for a page documenting one export; Template B for a page documenting a whole subsystem.

Reference implementations already in the repo: `hooks/use-props.mdx` (Template A), `events/overview.mdx` (Template B).

## Shared language rules

1. **Lead with the answer, not the machinery.** State what the reader gets, then explain why.
2. **Organize by what the reader does**, not by how the code branches internally.
3. **One idea per paragraph.** Density comes from structure (a row, a heading), never from cramming clauses into one sentence.
4. **Delete internals vocabulary** — no `finally`, "rule 7", internal function names. Say what happens, not which code path produces it.
5. **Show a type once, then translate it.** Never make a raw type the explanation. For a hairy type, lead with the plain-language translation and tuck the exact type in a collapsible "Exact type" footnote.

Also: sentence-case headings; `**bold**` labels, never backtick labels, for any prose list. Types use markdown primitives — a field table for the common case, a collapsible `<details><summary>Exact type</summary>` for the full type. (No custom components; that approach is deferred.)

## Template A — Reference page (one export)

For the hooks, components, and utilities. Fixed order; omit a section when it doesn't apply, never reorder.

1. **H1 + one-line summary** — what the export is and when you reach for it.
2. **`## Signature`** — the TypeScript signature, uncollapsed, directly under the summary, with a one-line plain-language translation. For a component, the **`## Props`** field table plays this role and the full interface goes in an "Exact type" footnote.
3. **`## Parameters` / `## Props` / `## Returns`** — a field table, one row per field: name, type, default/required, one-line description.
4. **`## Behavior`** — what happens when you use it: reactivity, lifecycle, what re-runs. Short paragraphs, one mechanism each.
5. **`## Usage` / `## Examples`** — worked code, smallest-useful first.
6. **Concept / gotcha sections as needed** — named sections for everything else (`## args`, `## Constructor args are applied once`, …). Never bury a gotcha inside a prop bullet.
7. **`## See also`** — related tutorial chapter and sibling pages.

## Template B — Topic page (a subsystem)

For pages documenting a whole system rather than one export (`events/overview`; arguably the `api` index).

1. **H1 + one-line summary** — what the subsystem is and how you engage with it.
2. **A logical sequence of concept sections**, ordered the way a reader meets the subject: the catalog of what's available → the data/object they work with (type shown, then translated) → how it behaves → the sub-rules and edge cases → filtering / extras.
3. **`## See also`** — related tutorial chapter and sibling pages.
