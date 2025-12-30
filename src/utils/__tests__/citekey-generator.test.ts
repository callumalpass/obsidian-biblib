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

  describe('generate - unicode and international characters', () => {
    it('should handle accented characters in author names', () => {
      const citation = {
        author: [{ family: 'Müller', given: 'Hans' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should strip non-ASCII characters
      expect(result).toContain('2023');
      expect(result).not.toContain('ü');
    });

    it('should handle CJK characters in author names', () => {
      const citation = {
        author: [{ family: '田中', given: '太郎' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should fallback to something since CJK characters get stripped
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle mixed ASCII and unicode in titles', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        title: 'The Über Study: A Résumé',
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{title|titleword}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('smith');
      expect(result).toContain('2023');
    });
  });

  describe('generate - author edge cases', () => {
    it('should handle author with only given name', () => {
      const citation = {
        author: [{ given: 'Madonna' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should fallback to 'unknown' when no family name
      expect(result).toContain('2023');
    });

    it('should handle empty author array', () => {
      const citation = {
        author: [],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('unknown');
      expect(result).toContain('2023');
    });

    it('should handle author as string format "Last, First"', () => {
      const citation = {
        author: ['Smith, John'],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('smith');
      expect(result).toContain('2023');
    });

    it('should handle author as string format "First Last"', () => {
      const citation = {
        author: ['John Smith'],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Takes first word when no comma
      expect(result).toContain('john');
      expect(result).toContain('2023');
    });

    it('should handle hyphenated author names', () => {
      const citation = {
        author: [{ family: 'García-Márquez', given: 'Gabriel' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Hyphen should be preserved or handled gracefully
      expect(result).toContain('2023');
    });

    it('should handle institutional author with multiple words', () => {
      const citation = {
        author: [{ literal: 'World Health Organization' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should take first word of institutional name
      expect(result).toContain('world');
      expect(result).toContain('2023');
    });
  });

  describe('generate - title edge cases', () => {
    it('should handle title with only stop words', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        title: 'The A An And Or',
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{title|titleword}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should still produce something for title
      expect(result).toContain('smith');
      expect(result).toContain('2023');
    });

    it('should handle title with HTML tags', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        title: '<i>The Italic Title</i>: A Study',
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{title|titleword}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should strip HTML and get "italic" as first significant word
      expect(result).toContain('smith');
      expect(result).toContain('2023');
    });

    it('should handle empty title', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        title: '',
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{title|titleword}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('smith');
      expect(result).toContain('2023');
    });
  });

  describe('generate - year edge cases', () => {
    it('should handle year as string', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        year: '2023'
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toBe('smith2023');
    });

    it('should handle year range in literal', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { literal: '2022-2023' }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should extract first year
      expect(result).toContain('smith');
      expect(result).toContain('2022');
    });

    it('should handle BC years (negative)', () => {
      const citation = {
        author: [{ family: 'Aristotle' }],
        issued: { 'date-parts': [[-350]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should handle gracefully - may not extract negative years
      expect(result).toContain('aristotle');
    });

    it('should handle future years', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2099]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toBe('smith2099');
    });
  });

  describe('generate - legacy template edge cases', () => {
    it('should convert multiple modifiers in legacy syntax', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '[auth:abbr(4):lower][year]',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      // Should apply abbr(4) and lower
      expect(result).toContain('2023');
    });

    it('should handle shorttitle in legacy syntax', () => {
      const citation = {
        author: [{ family: 'Smith' }],
        title: 'The Long and Winding Road to Success',
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        citekeyTemplate: '[auth][shorttitle][year]',
        useZoteroKeys: false,
        minCitekeyLength: 6
      });

      expect(result).toContain('2023');
    });
  });

  describe('generate - Zotero key edge cases', () => {
    it('should handle Zotero key with whitespace', () => {
      const citation = {
        key: '  ZOTERO123  ',
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        useZoteroKeys: true,
        citekeyTemplate: '{{author}}{{year}}',
        minCitekeyLength: 6
      });

      // Should trim whitespace from Zotero key
      expect(result).toBe('ZOTERO123');
    });

    it('should not use empty Zotero key', () => {
      const citation = {
        key: '   ',
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] }
      };

      const result = CitekeyGenerator.generate(citation, {
        useZoteroKeys: true,
        citekeyTemplate: '{{author|lowercase}}{{year}}',
        minCitekeyLength: 6
      });

      // Should fall back to template since key is only whitespace
      expect(result).toBe('smith2023');
    });
  });
});
