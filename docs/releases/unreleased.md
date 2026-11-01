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

- (#18) Citekey templates can now use `{{authors_family}}` and `{{authors_given}}`
  - Templates such as `{{authors_family.0|lowercase}}{{year}}`, which the settings tab suggests, previously dropped the author and produced keys like `2023`
  - The citekey template's "Reset to default" button now restores the actual default template
  - Thanks to @Noctis-Xu for reporting
- Citekeys generated in the new literature note modal now use the full form data
  - When the citekey field was left empty, the key was generated from only the title and authors, so templates using `{{year}}` produced keys without a year
  - The "Regenerate citekey" button now applies the template even when "Use Zotero keys" is enabled
  - Thanks to @maddie-m for the original fix in #35
