// Central source of CSL field lists for AdditionalFieldComponent
// and related UI highlighting logic.
// Lists are derived from the Citation Style Language specification
// Appendix A: Variables, plus additional number and date fields.
export const CSL_STANDARD_FIELDS: string[] = [
  '',
  'abstract', 'annote', 'archive', 'archive_collection', 'archive_location', 'archive-place',
  'authority', 'call-number', 'citation-key', 'citation-label', 'collection-number', 'collection-title',
  'container-title', 'dimensions', 'division', 'doi', 'edition', 'event', 'event-date', 'event-place',
  'genre', 'isbn', 'issn', 'issue', 'jurisdiction', 'keyword', 'language', 'license', 'locator', 'medium',
  'note', 'number', 'number-of-pages', 'number-of-volumes', 'original-author', 'original-date',
  'original-publisher', 'original-publisher-place', 'original-title', 'page', 'page-first', 'part',
  'pmcid', 'pmid', 'publisher', 'publisher-place', 'references', 'reviewed-author', 'reviewed-title',
  'scale', 'section', 'source', 'status', 'supplement', 'title', 'title-short', 'url', 'version',
  'volume', 'year-suffix'
];
export const CSL_NUMBER_FIELDS: string[] = [
  '', 'chapter-number', 'citation-number', 'collection-number', 'edition', 'issue', 'locator',
  'number', 'number-of-pages', 'number-of-volumes', 'part-number', 'page', 'page-first',
  'printing-number', 'section', 'supplement-number', 'version', 'volume'
];
export const CSL_DATE_FIELDS: string[] = [
  '', 'accessed', 'available-date', 'event-date', 'issued', 'original-date', 'submitted'
];
// Master set of all recognized CSL variables for highlighting
export const CSL_ALL_CSL_FIELDS: Set<string> = new Set([
  ...CSL_STANDARD_FIELDS,
  ...CSL_NUMBER_FIELDS,
  ...CSL_DATE_FIELDS
]);