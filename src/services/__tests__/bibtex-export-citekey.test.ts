/**
 * Reproduction tests for GitHub issue #29:
 * "BibTeX export does not preserve citation key"
 *
 * When exporting literature notes as BibTeX, the citation keys from the
 * frontmatter `id` field should be preserved in the BibTeX output.
 * Currently, citation-js regenerates keys (e.g. "Smith2023Test" instead
 * of the user's "smith2023") because `config.format.useIdAsLabel` defaults
 * to false and the CSL-JSON data lacks a `citation-key` field.
 *
 * @see https://github.com/callumacrae/biblib/issues/29  (adjust URL as needed)
 */
import Cite from 'citation-js';
import '@citation-js/plugin-bibtex';

describe('BibTeX export citation key preservation (issue #29)', () => {
    it.skip('reproduces issue #29: exported BibTeX should use the original citation key from the id field', () => {
        // This simulates the data flow in BibliographyBuilder.exportBibTeX():
        // Literature note frontmatter is collected and passed directly to citation-js.
        const frontmatterData = {
            id: 'mycustomkey2023',
            type: 'article-journal',
            title: 'A Study on Machine Learning',
            author: [{ family: 'Smith', given: 'John' }],
            issued: { 'date-parts': [[2023, 6, 15]] },
        };

        // This mirrors the exact call in bibliography-builder.ts line 388:
        //   new Cite(dataArray).get({ style: 'bibtex', type: 'string' })
        const bibtex = new Cite([frontmatterData]).get({ style: 'bibtex', type: 'string' });

        // The BibTeX entry should use "mycustomkey2023" as the citation key,
        // not a regenerated key like "Smith2023Study"
        expect(bibtex).toContain('@article{mycustomkey2023,');
    });

    it.skip('reproduces issue #29: multiple entries should each preserve their original keys', () => {
        const entries = [
            {
                id: 'jones-attention-2024',
                type: 'article-journal',
                title: 'Attention Mechanisms in NLP',
                author: [{ family: 'Jones', given: 'Mary' }],
                issued: { 'date-parts': [[2024]] },
            },
            {
                id: 'brown_deep_2022',
                type: 'paper-conference',
                title: 'Deep Learning for Vision',
                author: [{ family: 'Brown', given: 'Alice' }],
                issued: { 'date-parts': [[2022, 3]] },
            },
        ];

        const bibtex = new Cite(entries).get({ style: 'bibtex', type: 'string' });

        expect(bibtex).toContain('jones-attention-2024');
        expect(bibtex).toContain('brown_deep_2022');
    });

    it.skip('reproduces issue #29: keys with special but Pandoc-valid characters should be preserved', () => {
        // Pandoc citekeys can contain alphanumerics and: _ : . # $ % & - + ? < > ~ /
        const frontmatterData = {
            id: 'smith:2023-ml',
            type: 'article-journal',
            title: 'Machine Learning',
            author: [{ family: 'Smith', given: 'John' }],
            issued: { 'date-parts': [[2023]] },
        };

        const bibtex = new Cite([frontmatterData]).get({ style: 'bibtex', type: 'string' });

        // The key with colons and hyphens should be preserved
        expect(bibtex).toContain('smith:2023-ml');
    });
});
