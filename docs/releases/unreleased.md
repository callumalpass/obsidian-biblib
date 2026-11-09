# BibLib - Unreleased

<!--

**Added** for new features.
**Changed** for changes in existing functionality.
**Deprecated** for soon-to-be removed features.
**Removed** for now removed features.
**Fixed** for any bug fixes.
**Security** in case of vulnerabilities.

Always acknowledge contributors and those who report issues.

Example:

```
## Fixed

- (#14) Fixed author-links property formatting in edit literature note command
  - The property was not being formatted correctly when multiple authors were present
  - Thanks to @username for reporting
```

-->

## Fixed

- (#53) Fixed the default `related` custom frontmatter field writing a nested list
  - New notes got `related: [[]]`, or `[["[[A.md]]","[[B.md]]"]]` with related notes selected, because `{{links}}` already renders as a list
  - The default template is now `{{links|json}}`, which writes `related: []` or `["[[A.md]]", "[[B.md]]"]`, including for note names that contain commas or quotes
  - If your `related` field still uses the old default `[{{links}}]`, it is updated when the plugin loads. Customised templates are not changed, and existing notes are not rewritten
  - Thanks to @dhmmasson for the diagnosis and the proposed fix
