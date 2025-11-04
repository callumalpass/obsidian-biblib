import { CitekeyGenerator } from '../citekey-generator';

describe('CitekeyGenerator', () => {
  describe('generate - basic functionality', () => {
    it('should generate citekey from author and year', () => {
      const citation = {
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toBe('smith2023');
    });

    it('should use Zotero key when enabled and available', () => {
      const citation = {
        id: 'ZOTERO123',
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        useZoteroKeys: true,
        citekeyTemplate: '{{author}}{{year}}',
        minCitekeyLength: 6
      });

      expect(result).toBe('ZOTERO123');
    });

    it('should not use Zotero key when disabled', () => {
      const citation = {
        id: 'ZOTERO123',
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        useZoteroKeys: false,
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        minCitekeyLength: 6
      });

      expect(result).toBe('smith2023');
    });

    it('should handle missing citation data gracefully', () => {
      const result = CitekeyGenerator.generate(null);
      expect(result).toBe('error_no_data');
    });
  });

  describe('generate - template patterns', () => {
    it('should support author-title-year pattern', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        title: 'The Art of Programming',
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{title|titleword}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('smith');
      expect(result).toContain('2023');
      expect(result).toContain('art');
    });

    it('should support abbreviated author names', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|abbr3}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Author is already extracted as lowercase "smith"
      expect(result).toBe('smi2023');
    });

    it('should handle multiple authors', () => {
      const citation = {
        author: [
          { family: 'Smith' },
          { family: 'Jones' }
        ],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should use first author
      expect(result).toBe('smith2023');
    });
  });

  describe('generate - Pandoc compliance', () => {
    it('should start with valid character', () => {
      const citation = {
        author: [{ family: '@#$Invalid' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should start with letter, digit, or underscore
      expect(result.charAt(0)).toMatch(/[a-zA-Z0-9_]/);
    });

    it('should allow Pandoc-permitted punctuation', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}-{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Pandoc allows some punctuation like hyphen
      expect(result).toBe('smith-2023');
    });

    it('should not have trailing punctuation', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation);

      // Should not end with punctuation
      expect(result).not.toMatch(/[:.#$%&\-+?<>~/]+$/);
    });
  });

  describe('generate - minimum length enforcement', () => {
    it('should add random suffix if below minimum length', () => {
      const citation = {
        author: [{ family: 'Li' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 10
      });

      // li2023 = 6 chars, adds 3-digit suffix = 9 chars total
      expect(result.length).toBeGreaterThanOrEqual(9);
      expect(result).toContain('li');
      expect(result).toContain('2023');
    });

    it('should not add suffix if already meets minimum', () => {
      const citation = {
        author: [{ family: 'Smithson' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toBe('smithson2023');
    });
  });

  describe('generate - legacy template conversion', () => {
    it('should convert square bracket syntax to handlebars', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '[auth:lower][year]',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toBe('smith2023');
    });

    it('should convert abbr function syntax', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '[auth:abbr(3)][year]',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Author is already extracted as lowercase, then abbreviated
      expect(result).toBe('smi2023');
    });
  });

  describe('generate - fallback behavior', () => {
    it('should use fallback format when no template provided', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('smith');
      expect(result).toContain('2023');
    });

    it('should return "unknown" for missing author', () => {
      const citation = {
        title: 'Some Title',
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('unknown');
    });

    it('should handle missing year', () => {
      const citation = {
        author: [{ family: 'Smith' }]
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('smith');
    });
  });

  describe('generate - various date formats', () => {
    it('should extract year from date-parts', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023, 1, 15]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('2023');
    });

    it('should extract year from direct year field', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        year: 2023
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('2023');
    });

    it('should extract year from literal string', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { literal: 'January 2023' }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('2023');
    });
  });

  describe('generate - various author formats', () => {
    it('should handle CSL-JSON author format', () => {
      const citation = {
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toBe('smith2023');
    });

    it('should handle Zotero creator format', () => {
      const citation = {
        creators: [
          { creatorType: 'author', lastName: 'Smith', firstName: 'John' }
        ],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toBe('smith2023');
    });

    it('should handle institutional authors (literal)', () => {
      const citation = {
        author: [{ literal: 'MIT Press' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('mit');
      expect(result).toContain('2023');
    });
  });

  describe('generate - error handling', () => {
    it('should return error citekey on exception', () => {
      const result = CitekeyGenerator.generate({}, {
        citekeyTemplate: '{{invalid..syntax}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should still return a valid citekey even if template has issues
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle malformed citation data', () => {
      const result = CitekeyGenerator.generate({
        author: 'not an array',
        issued: 'not an object'
      });

      // Should not throw, should return something
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
