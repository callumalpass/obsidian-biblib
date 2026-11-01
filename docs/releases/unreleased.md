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
- Bulk import's "Generate new citekeys" option now applies the citekey template even when "Use Zotero keys" is enabled
  - Previously the imported key was kept, because the generator returned it when "Use Zotero keys" was on
  - Thanks to @maddie-m for spotting this in #35
- DOI/URL/ISBN lookups in the new literature note modal now apply your citekey template
  - Previously the citekey field was filled with the BibTeX label Citoid generates (e.g. `smith_deep_2020`), so the template was ignored unless you pressed "Regenerate citekey"
  - Turn on "Use Zotero keys" to keep the previous behaviour
  - Thanks to @Noctis-Xu for reporting in #18
- Renaming a note after a citekey change now uses the same filename as note creation
  - Filename templates with subfolders (e.g. `{{type}}/@{{citekey}}`) move the note into that subfolder instead of renaming it to `article-journal-@key.md`
  - Notes at the vault root are renamed correctly
- `{{year}}` in filename templates now works for bulk-imported references and edited notes, which store the date only in `issued`
- (#26) Zotero Connector: the literature note modal now opens for items whose attachments never arrive
  - Saving without a snapshot left the "Receiving item from Zotero" notice with no modal; the modal now opens straight away
  - On sites such as PubMed Central, Zotero replaces an announced attachment with one under a new ID, so BibLib waited forever. The modal now opens after 10 seconds without new attachments, and files that arrive later are still added to it
  - Thanks to @ancaemcken for reporting and for the analysis in #28
