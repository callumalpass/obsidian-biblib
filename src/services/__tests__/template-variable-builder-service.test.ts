import { TemplateVariableBuilderService } from '../template-variable-builder-service';
import { Citation, Contributor } from '../../types/citation';

describe('TemplateVariableBuilderService', () => {
  let service: TemplateVariableBuilderService;

  beforeEach(() => {
    service = new TemplateVariableBuilderService();
  });

  describe('buildVariables', () => {
    const baseCitation: Citation = {
      id: 'smith2023',
      type: 'article-journal',
      title: 'A Great Paper',
      'container-title': 'Journal of Testing',
      DOI: '10.1234/test'
    };

    const baseContributors: Contributor[] = [
      { family: 'Smith', given: 'John', role: 'author' },
      { family: 'Jones', given: 'Jane', role: 'author' }
    ];

    it('should include citation fields directly', () => {
      const result = service.buildVariables(baseCitation, baseContributors);

      expect(result.id).toBe('smith2023');
      expect(result.type).toBe('article-journal');
      expect(result.title).toBe('A Great Paper');
      expect(result['container-title']).toBe('Journal of Testing');
      expect(result.DOI).toBe('10.1234/test');
    });

    it('should set citekey from citation id', () => {
      const result = service.buildVariables(baseCitation, baseContributors);
      expect(result.citekey).toBe('smith2023');
    });

    it('should handle missing citation id', () => {
      const { id, ...citationWithoutId } = baseCitation;

      const result = service.buildVariables(citationWithoutId as Citation, baseContributors);
      expect(result.citekey).toBe('');
    });

    it('should include currentDate in YYYY-MM-DD format', () => {
      const result = service.buildVariables(baseCitation, baseContributors);
      expect(result.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should include currentTime in HH:MM:SS format', () => {
      const result = service.buildVariables(baseCitation, baseContributors);
      expect(result.currentTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    describe('authorsDisplay formatting', () => {
      // authorsDisplay is the formatted display string (e.g., "J. Smith et al.")
      // authors is the array of full names from buildContributorLists

      it('should format single author for display', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authorsDisplay).toBe('J. Smith');
      });

      it('should format two authors with "and"', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' },
          { family: 'Jones', given: 'Jane', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authorsDisplay).toBe('J. Smith and J. Jones');
      });

      it('should format three+ authors with "et al."', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' },
          { family: 'Jones', given: 'Jane', role: 'author' },
          { family: 'Brown', given: 'Bob', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authorsDisplay).toBe('J. Smith et al.');
      });

      it('should handle authors with only family name', () => {
        const contributors = [
          { family: 'Smith', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authorsDisplay).toBe('Smith');
      });

      it('should handle institutional authors (literal)', () => {
        const contributors = [
          { literal: 'World Health Organization', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authorsDisplay).toBe('World Health Organization');
      });

      it('should return empty string for no contributors', () => {
        const result = service.buildVariables(baseCitation, []);
        expect(result.authorsDisplay).toBe('');
      });

      it('should only include authors, not editors', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' },
          { family: 'Editor', given: 'Ed', role: 'editor' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authorsDisplay).toBe('J. Smith');
      });
    });

    describe('authors array', () => {
      // authors is an array of full names from buildContributorLists

      it('should create authors array with full names', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authors).toEqual(['John Smith']);
      });

      it('should create authors array for multiple authors', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' },
          { family: 'Jones', given: 'Jane', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authors).toEqual(['John Smith', 'Jane Jones']);
      });

      it('should include all authors in array (no truncation)', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' },
          { family: 'Jones', given: 'Jane', role: 'author' },
          { family: 'Brown', given: 'Bob', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authors).toEqual(['John Smith', 'Jane Jones', 'Bob Brown']);
      });

      it('should separate authors from editors', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' },
          { family: 'Editor', given: 'Ed', role: 'editor' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authors).toEqual(['John Smith']);
        expect(result.editors).toEqual(['Ed Editor']);
      });
    });

    describe('contributor lists by role', () => {
      it('should create authors list with full names', () => {
        const result = service.buildVariables(baseCitation, baseContributors);
        expect(result.authors_raw).toHaveLength(2);
        expect(result.authors).toEqual(['John Smith', 'Jane Jones']);
      });

      it('should create authors_family list', () => {
        const result = service.buildVariables(baseCitation, baseContributors);
        expect(result.authors_family).toEqual(['Smith', 'Jones']);
      });

      it('should create authors_given list', () => {
        const result = service.buildVariables(baseCitation, baseContributors);
        expect(result.authors_given).toEqual(['John', 'Jane']);
      });

      it('should create editors lists', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' },
          { family: 'Editor', given: 'Ed', role: 'editor' }
        ];
        const result = service.buildVariables(baseCitation, contributors);

        expect(result.editors).toEqual(['Ed Editor']);
        expect(result.editors_family).toEqual(['Editor']);
        expect(result.editors_given).toEqual(['Ed']);
      });

      it('should handle contributors with only literal name', () => {
        const contributors = [
          { literal: 'World Health Organization', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);

        expect(result.authors).toEqual(['World Health Organization']);
        expect(result.authors_family).toEqual(['World Health Organization']);
      });
    });

    describe('attachment handling', () => {
      it('should initialize empty attachment variables when no attachments', () => {
        const result = service.buildVariables(baseCitation, baseContributors);

        expect(result.pdflink).toEqual([]);
        expect(result.attachments).toEqual([]);
        expect(result.attachment).toBe('');
        expect(result.raw_pdflink).toBe('');
      });

      it('should format PDF attachments', () => {
        const attachmentPaths = ['path/to/file.pdf'];
        const result = service.buildVariables(baseCitation, baseContributors, attachmentPaths);

        expect(result.pdflink).toEqual(['path/to/file.pdf']);
        expect(result.attachments).toEqual(['[[path/to/file.pdf|PDF]]']);
        expect(result.attachment).toBe('[[path/to/file.pdf|PDF]]');
        expect(result.raw_pdflink).toBe('path/to/file.pdf');
      });

      it('should format EPUB attachments', () => {
        const attachmentPaths = ['path/to/book.epub'];
        const result = service.buildVariables(baseCitation, baseContributors, attachmentPaths);

        expect(result.attachments).toEqual(['[[path/to/book.epub|EPUB]]']);
      });

      it('should format other file types by extension', () => {
        const attachmentPaths = ['path/to/doc.docx'];
        const result = service.buildVariables(baseCitation, baseContributors, attachmentPaths);

        expect(result.attachments).toEqual(['[[path/to/doc.docx|DOCX]]']);
      });

      it('should handle multiple attachments', () => {
        const attachmentPaths = ['file1.pdf', 'file2.epub', 'file3.docx'];
        const result = service.buildVariables(baseCitation, baseContributors, attachmentPaths);

        expect(result.pdflink).toHaveLength(3);
        expect(result.attachments).toHaveLength(3);
        // First attachment is used for single-value variables
        expect(result.attachment).toBe('[[file1.pdf|PDF]]');
        expect(result.raw_pdflink).toBe('file1.pdf');
      });

      it('should create quoted_attachments', () => {
        const attachmentPaths = ['file.pdf'];
        const result = service.buildVariables(baseCitation, baseContributors, attachmentPaths);

        expect(result.quoted_attachments).toEqual(['"[[file.pdf|PDF]]"']);
        expect(result.quoted_attachment).toBe('"[[file.pdf|PDF]]"');
      });
    });

    describe('related notes handling', () => {
      it('should initialize empty link variables when no related notes', () => {
        const result = service.buildVariables(baseCitation, baseContributors);

        expect(result.links).toEqual([]);
        expect(result.linkPaths).toEqual([]);
        expect(result.links_string).toBe('');
      });

      it('should format related notes as wikilinks', () => {
        const relatedNotePaths = ['path/to/note.md'];
        const result = service.buildVariables(baseCitation, baseContributors, undefined, relatedNotePaths);

        expect(result.links).toEqual(['[[path/to/note.md]]']);
        expect(result.linkPaths).toEqual(['path/to/note.md']);
      });

      it('should create comma-separated links_string', () => {
        const relatedNotePaths = ['note1.md', 'note2.md', 'note3.md'];
        const result = service.buildVariables(baseCitation, baseContributors, undefined, relatedNotePaths);

        expect(result.links_string).toBe('[[note1.md]], [[note2.md]], [[note3.md]]');
      });
    });

    describe('edge cases', () => {
      it('should handle empty contributors array', () => {
        const result = service.buildVariables(baseCitation, []);
        // With empty contributors, authorsDisplay is '', authors is undefined
        expect(result.authorsDisplay).toBe('');
        expect(result.authors).toBeUndefined();
        expect(result.authors_raw).toBeUndefined();
      });

      it('should handle contributors with whitespace in names', () => {
        const contributors = [
          { family: '  Smith  ', given: '  John  ', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        // authorsDisplay trims the names
        expect(result.authorsDisplay).toBe('J. Smith');
        // authors array preserves whitespace: "${given} ${family}"
        expect(result.authors).toEqual(['  John     Smith  ']);
        // authors_family preserves original family value
        expect(result.authors_family).toEqual(['  Smith  ']);
      });

      it('should handle contributors with only given name', () => {
        const contributors = [
          { given: 'Madonna', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        expect(result.authorsDisplay).toBe('Madonna');
        expect(result.authors).toEqual(['Madonna']);
      });

      it('should handle contributors with empty strings', () => {
        const contributors = [
          { family: '', given: '', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        // Empty strings result in empty display and array
        expect(result.authorsDisplay).toBe('');
        expect(result.authors).toEqual([]);
      });

      it('should handle mixed valid and empty contributors', () => {
        const contributors = [
          { family: 'Smith', given: 'John', role: 'author' },
          { family: '', given: '', role: 'author' }
        ];
        const result = service.buildVariables(baseCitation, contributors);
        // Only valid names are included
        expect(result.authorsDisplay).toBe('J. Smith');
        expect(result.authors).toEqual(['John Smith']);
      });
    });
  });
});
