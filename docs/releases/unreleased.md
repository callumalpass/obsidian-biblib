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

- (#56) Chained formatters such as `{{title|lowercase|truncate:20}}` are applied left to right, as the templating guide describes. Before, a chain left the value unformatted.
  - Templates that already contain a chain produce different output from now on, e.g. `{{author|abbr3|uppercase}}{{year}}` gives `SMI2023` rather than `smith2023`. This affects new citekeys, filenames and frontmatter values; existing notes are not changed.
  - A `|` followed by something other than a formatter name is still part of the previous formatter's parameter, so templates like `{{authors|join: | }}` and `{{title|replace:a|b:X}}` render as before.
  - Thanks to @dhmmasson for the report and the analysis
