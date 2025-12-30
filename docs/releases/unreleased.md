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

## Added

- (#12) **Multiple tags support**: The "Literature note tag" setting now supports multiple comma or space-separated tags (e.g., "literature_note, excalidraw"). All specified tags are added to new literature notes, enabling workflows like Excalidraw flip notes.
  - Thanks to @bepolymathe for the feature request
- **Testing infrastructure**: Jest testing framework with initial test suites for citekey generator and template engine
- **Expanded test coverage**: Added 127 new tests across 5 test files (190 total tests), covering yaml-utils, citoid service, and template-variable-builder-service
- **New template variable `authorsDisplay`**: Formatted author string for display (e.g., "J. Smith", "J. Smith and B. Jones", "J. Smith et al.")
- (#21) **Citation-js fallback for Citoid service**: When Citoid (Wikipedia's citation API) lacks coverage for certain items (e.g., some ISBNs no longer available via WorldCat), the plugin now falls back to citation-js using Google APIs
  - Thanks to @platon-ivanov for this contribution
- (#21) **Additional identifier support**: PubMed IDs, PMC IDs, and Wikidata QIDs are now supported via the citation-js fallback
  - Thanks to @platon-ivanov for this contribution
- Comprehensive JSDoc documentation throughout the codebase

## Changed

- Improved MetadataCache usage patterns
- Enhanced error handling and validation in citoid service

## Fixed

- **Template engine: trailing whitespace preserved in formatter arguments** - Formatters like `join`, `prefix`, and `split` now correctly preserve trailing whitespace (e.g., `{{authors|join: and }}` produces "Smith and Jones" instead of "SmithandJones")
- (#11) **Template engine: object property access in array iteration** - When iterating over arrays of objects, properties are now directly accessible (e.g., `{{#authors}}{{family}}{{/authors}}` works correctly)
  - Thanks to @bepolymathe for reporting
- (#16) **Documentation fixes**: Fixed broken links and aligned documentation with actual plugin UI
  - Fixed 404 errors for Templating, Key Features, and Troubleshooting pages
  - Updated Settings documentation to match the actual tab names and order in the plugin
  - Section names now match the UI: "File Organization", "Templates", "Citation Keys", "Custom Fields", "Modal Configuration", "Zotero Integration", "Bibliography Export"
  - Thanks to @Zichen-Wang for reporting
