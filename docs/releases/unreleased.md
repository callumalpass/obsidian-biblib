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

- (#56) Fixed chained formatters being ignored
  - `{{title|lowercase|truncate:20}}` returned the title unchanged because `lowercase|truncate:20` was read as one unknown formatter; formatters now apply left to right
  - Templates that already contained a chain now give the intended output, so new citekeys and file names from such templates change (for example `{{author|abbr3|uppercase}}{{year}}` gives `SMI2023` instead of `smith2023`). Existing notes are not changed
  - A `|` inside a formatter argument keeps working, as in `{{title|replace:a|b:X}}` or `{{authors|join: | }}`
