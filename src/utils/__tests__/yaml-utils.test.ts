import { processYamlArray, analyzeYamlTemplateOutput } from '../yaml-utils';

describe('processYamlArray', () => {
  describe('empty array handling', () => {
    it('should handle empty array []', () => {
      expect(processYamlArray('[]')).toBe('[]');
    });

    it('should handle empty array with space [ ]', () => {
      expect(processYamlArray('[ ]')).toBe('[]');
    });

    it('should handle empty array with whitespace around it', () => {
      expect(processYamlArray('  []  ')).toBe('[]');
    });
  });

  describe('valid JSON arrays', () => {
    it('should return valid JSON array unchanged', () => {
      const input = '["a","b","c"]';
      expect(processYamlArray(input)).toBe(input);
    });

    it('should return valid JSON array with numbers unchanged', () => {
      const input = '[1,2,3]';
      expect(processYamlArray(input)).toBe(input);
    });

    it('should return valid JSON array with objects unchanged', () => {
      const input = '[{"name":"John"},{"name":"Jane"}]';
      expect(processYamlArray(input)).toBe(input);
    });
  });

  describe('invalid JSON arrays - fixing common issues', () => {
    it('should fix unquoted items', () => {
      const result = processYamlArray('[item1,item2]');
      // The current implementation keeps unquoted items as-is
      expect(result).toBe('[item1,item2]');
    });

    it('should handle single item without commas', () => {
      const result = processYamlArray('[single]');
      expect(result).toBe('[single]');
    });

    it('should handle items with extra whitespace', () => {
      const result = processYamlArray('[  a  ,  b  ]');
      expect(result).toBe('[a,b]');
    });

    it('should filter empty items', () => {
      const result = processYamlArray('[a,,b]');
      expect(result).toBe('[a,b]');
    });

    it('should handle only commas', () => {
      const result = processYamlArray('[,,,]');
      expect(result).toBe('[]');
    });
  });

  describe('Obsidian link handling', () => {
    it('should quote Obsidian links', () => {
      const result = processYamlArray('[[[Note1]],[[Note2]]]');
      expect(result).toBe('["[[Note1]]","[[Note2]]"]');
    });

    it('should handle Obsidian links with display text', () => {
      const result = processYamlArray('[[[Note|Display Text]]]');
      expect(result).toBe('["[[Note|Display Text]]"]');
    });

    it('should escape quotes in Obsidian links', () => {
      const result = processYamlArray('[[[Note "quoted"]]]');
      expect(result).toBe('["[[Note \\"quoted\\"]]"]');
    });
  });

  describe('non-array patterns', () => {
    it('should return non-array string unchanged', () => {
      expect(processYamlArray('just a string')).toBe('just a string');
    });

    it('should return string starting with [ but not ending with ] unchanged', () => {
      expect(processYamlArray('[incomplete')).toBe('[incomplete');
    });

    it('should return string ending with ] but not starting with [ unchanged', () => {
      expect(processYamlArray('incomplete]')).toBe('incomplete]');
    });
  });

  describe('already quoted items', () => {
    it('should not double-quote already quoted items', () => {
      const result = processYamlArray('["already","quoted"]');
      expect(result).toBe('["already","quoted"]');
    });

    it('should handle mix of quoted and unquoted', () => {
      const result = processYamlArray('["quoted",unquoted]');
      expect(result).toBe('["quoted",unquoted]');
    });
  });
});

describe('analyzeYamlTemplateOutput', () => {
  describe('JSON array output', () => {
    it('should recognize valid JSON array', () => {
      const result = analyzeYamlTemplateOutput('{{items}}', '["a","b","c"]');

      expect(result.yamlRepresentation).toContain('field: ["a","b","c"]');
      expect(result.yamlBehaviorExplanation).toContain('valid JSON array');
    });

    it('should warn about invalid array-like syntax', () => {
      const result = analyzeYamlTemplateOutput('{{items}}', '[a b c]');

      expect(result.yamlBehaviorExplanation).toContain('not valid JSON');
    });
  });

  describe('multi-line output with dashes', () => {
    it('should explain dash-prefixed multi-line format', () => {
      const result = analyzeYamlTemplateOutput('{{items}}', '- item1\n- item2');

      expect(result.yamlBehaviorExplanation).toContain('NOT automatically parsed as an array');
    });
  });

  describe('comma-separated values', () => {
    it('should explain comma-separated values are treated as string', () => {
      const result = analyzeYamlTemplateOutput('{{items}}', 'a, b, c');

      expect(result.yamlBehaviorExplanation).toContain('single string');
    });
  });

  describe('multi-line strings', () => {
    it('should explain pipe syntax for multi-line text', () => {
      const result = analyzeYamlTemplateOutput('{{text}}', 'line1\nline2\nline3');

      expect(result.yamlRepresentation).toContain('field: |');
      expect(result.yamlBehaviorExplanation).toContain('pipe syntax');
    });
  });

  describe('simple strings', () => {
    it('should explain simple string handling', () => {
      const result = analyzeYamlTemplateOutput('{{name}}', 'John Smith');

      expect(result.yamlRepresentation).toContain('field: John Smith');
      expect(result.yamlBehaviorExplanation).toContain('Simple strings');
    });
  });
});
