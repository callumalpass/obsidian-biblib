import { DateParser } from './date-parser';
import { asRecordArray, isRecord, getString } from './type-guards';

/**
 * Build the template variables available to filename templates
 * (literature note filenames and attachment filenames).
 * @param citekey The citekey of the reference
 * @param citation Optional CSL citation data
 */
export function buildFilenameVariables(citekey: string, citation?: unknown): Record<string, unknown> {
  const variables: Record<string, unknown> = {
    citekey,
    // Add date-related variables
    currentDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
  };

  // If citation data is available, add those variables too
  const citationRecord = isRecord(citation) ? citation : undefined;
  if (!citationRecord) return variables;

  Object.assign(variables, {
    title: getString(citationRecord, 'title') || '',
    // Bulk imports and edited notes carry the date only in CSL `issued`
    year: DateParser.extractFields(citationRecord).year,
    type: getString(citationRecord, 'type') || '',
    'container-title': getString(citationRecord, 'container-title') || '',
  });

  // Add author-related template variables
  // Extract authors from citation.author (CSL-JSON format)
  const authors = asRecordArray(citationRecord.author);
  if (authors.length > 0) {
    // authors: Array of formatted full names (e.g., ["John Smith", "Jane Doe"])
    variables.authors = authors.map((a) => {
      const literal = getString(a, 'literal');
      if (literal) return literal;
      const family = getString(a, 'family') || '';
      const given = getString(a, 'given') || '';
      if (family && given) return `${given} ${family}`;
      return family || given || '';
    }).filter(Boolean);

    // authors_family: Array of family names only
    variables.authors_family = authors
      .map((a) => getString(a, 'family') || getString(a, 'literal') || '')
      .filter(Boolean);

    // authors_given: Array of given names only
    variables.authors_given = authors
      .map((a) => getString(a, 'given') || '')
      .filter(Boolean);

    // author: First author's family name (for citekey-style templates)
    const firstAuthor = authors[0];
    if (firstAuthor) {
      variables.author = getString(firstAuthor, 'family') || getString(firstAuthor, 'literal') || '';
    }
  }

  return variables;
}
