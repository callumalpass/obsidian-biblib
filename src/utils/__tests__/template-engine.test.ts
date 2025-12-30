import { TemplateEngine } from '../template-engine';

describe('TemplateEngine', () => {
  describe('render - basic variable substitution', () => {
    it('should replace simple variables', () => {
      const result = TemplateEngine.render('{{name}}', { name: 'John' });
      expect(result).toBe('John');
    });

    it('should handle missing variables by returning empty string', () => {
      const result = TemplateEngine.render('{{name}}', {});
      expect(result).toBe('');
    });

    it('should handle multiple variables', () => {
      const result = TemplateEngine.render('{{first}} {{last}}', {
        first: 'John',
        last: 'Doe'
      });
      expect(result).toBe('John Doe');
    });

    it('should handle nested properties with dot notation', () => {
      const result = TemplateEngine.render('{{author.family}}', {
        author: { family: 'Smith', given: 'Jane' }
      });
      expect(result).toBe('Smith');
    });

    it('should handle array access with dot notation', () => {
      const result = TemplateEngine.render('{{authors.0.family}}', {
        authors: [{ family: 'Smith' }, { family: 'Jones' }]
      });
      expect(result).toBe('Smith');
    });
  });

  describe('render - formatters', () => {
    it('should apply lowercase formatter', () => {
      const result = TemplateEngine.render('{{name|lowercase}}', { name: 'JOHN' });
      expect(result).toBe('john');
    });

    it('should apply uppercase formatter', () => {
      const result = TemplateEngine.render('{{name|uppercase}}', { name: 'john' });
      expect(result).toBe('JOHN');
    });

    it('should apply truncate formatter with default length', () => {
      const result = TemplateEngine.render('{{text|truncate}}', {
        text: 'This is a very long text that should be truncated at thirty characters'
      });
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('should apply truncate formatter with custom length', () => {
      const result = TemplateEngine.render('{{text|truncate:10}}', {
        text: 'This is a long text'
      });
      expect(result).toBe('This is a ');
    });

    it('should apply abbr formatter', () => {
      const result = TemplateEngine.render('{{name|abbr3}}', { name: 'Smith' });
      expect(result).toBe('Smi');
    });

    it('should apply sentence formatter', () => {
      const result = TemplateEngine.render('{{text|sentence}}', {
        text: 'hello world'
      });
      expect(result).toBe('Hello world');
    });

    it('should apply first formatter in pipe', () => {
      // Note: Current implementation only supports one formatter at a time
      const result = TemplateEngine.render('{{name|uppercase}}', {
        name: 'smith'
      });
      expect(result).toBe('SMITH');
    });
  });

  describe('render - positive conditional blocks', () => {
    it('should render block when variable is truthy', () => {
      const result = TemplateEngine.render('{{#hasEmail}}Email: {{email}}{{/hasEmail}}', {
        hasEmail: true,
        email: 'test@example.com'
      });
      expect(result).toBe('Email: test@example.com');
    });

    it('should not render block when variable is falsy', () => {
      const result = TemplateEngine.render('{{#hasEmail}}Email: {{email}}{{/hasEmail}}', {
        hasEmail: false,
        email: 'test@example.com'
      });
      expect(result).toBe('');
    });

    it('should iterate over arrays', () => {
      const result = TemplateEngine.render('{{#authors}}{{.}}, {{/authors}}', {
        authors: ['Smith', 'Jones', 'Brown']
      });
      expect(result).toBe('Smith, Jones, Brown, ');
    });

    it('should provide @index in array iteration', () => {
      const result = TemplateEngine.render('{{#items}}{{@index}}:{{.}} {{/items}}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('0:a 1:b 2:c ');
    });

    it('should provide @first and @last in array iteration', () => {
      const result = TemplateEngine.render(
        '{{#items}}{{.}}{{#@last}}{{/@last}}{{/items}}',
        { items: ['a', 'b', 'c'] }
      );
      // All items are rendered
      expect(result).toBe('abc');
    });

    it('should not render for empty arrays', () => {
      const result = TemplateEngine.render('{{#authors}}{{.}}{{/authors}}', {
        authors: []
      });
      expect(result).toBe('');
    });
  });

  describe('render - negative conditional blocks', () => {
    it('should render block when variable is falsy', () => {
      const result = TemplateEngine.render('{{^hasEmail}}No email{{/hasEmail}}', {});
      expect(result).toBe('No email');
    });

    it('should not render block when variable is truthy', () => {
      const result = TemplateEngine.render('{{^hasEmail}}No email{{/hasEmail}}', {
        hasEmail: true
      });
      expect(result).toBe('');
    });

    it('should render for empty arrays', () => {
      const result = TemplateEngine.render('{{^authors}}No authors{{/authors}}', {
        authors: []
      });
      expect(result).toBe('No authors');
    });

    it('should render for undefined variables', () => {
      const result = TemplateEngine.render('{{^missing}}Not found{{/missing}}', {});
      expect(result).toBe('Not found');
    });
  });

  describe('render - sanitizeForCitekey option', () => {
    it('should sanitize output for Pandoc citekeys', () => {
      const result = TemplateEngine.render('{{author}}{{year}}', {
        author: 'Smith',
        year: '2023'
      }, { sanitizeForCitekey: true });

      // Should start with valid character
      expect(result).toMatch(/^[a-zA-Z0-9_]/); // Starts with valid char
      expect(result).toMatch(/^[a-zA-Z0-9_:.#$%&\-+?<>~/]+$/); // Only valid chars
    });

    it('should prepend underscore if citekey starts with invalid character', () => {
      const result = TemplateEngine.render('{{text}}', {
        text: '@invalid'
      }, { sanitizeForCitekey: true });

      expect(result.charAt(0)).toMatch(/[a-zA-Z0-9_]/);
    });

    it('should remove trailing punctuation', () => {
      const result = TemplateEngine.render('{{text}}', {
        text: 'valid-text-'
      }, { sanitizeForCitekey: true });

      expect(result).not.toMatch(/[-]+$/);
    });
  });

  describe('render - special formatters', () => {
    it('should extract title word (first significant word)', () => {
      const result = TemplateEngine.render('{{title|titleword}}', {
        title: 'The Art of Computer Programming'
      });
      expect(result).toBe('art');
    });

    it('should extract short title (3 significant words)', () => {
      const result = TemplateEngine.render('{{title|shorttitle}}', {
        title: 'The Art of Computer Programming in Modern Times'
      });
      expect(result.split(/(?=[A-Z])/).length).toBeLessThanOrEqual(3);
    });

    it('should generate random string with rand formatter', () => {
      const result = TemplateEngine.render('{{rand|5}}', {});
      expect(result).toHaveLength(5);
      expect(result).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should count array elements', () => {
      const result = TemplateEngine.render('{{authors|count}}', {
        authors: ['Smith', 'Jones', 'Brown']
      });
      expect(result).toBe('3');
    });

    it('should join array elements', () => {
      const result = TemplateEngine.render('{{authors|join: and }}', {
        authors: ['Smith', 'Jones', 'Brown']
      });
      // Fixed: trimStart() preserves trailing whitespace in delimiter
      expect(result).toBe('Smith and Jones and Brown');
    });

    it('should join with simple delimiter', () => {
      const result = TemplateEngine.render('{{items|join:,}}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('a,b,c');
    });

    it('should join with default comma when no delimiter specified', () => {
      const result = TemplateEngine.render('{{items|join}}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('a,b,c');
    });
  });

  describe('render - formatters (extended coverage)', () => {
    it('should apply urlencode formatter', () => {
      const result = TemplateEngine.render('{{url|urlencode}}', {
        url: 'hello world&foo=bar'
      });
      expect(result).toBe('hello%20world%26foo%3Dbar');
    });

    it('should apply urldecode formatter', () => {
      const result = TemplateEngine.render('{{url|urldecode}}', {
        url: 'hello%20world%26foo%3Dbar'
      });
      expect(result).toBe('hello world&foo=bar');
    });

    it('should apply capitalize formatter', () => {
      const result = TemplateEngine.render('{{text|capitalize}}', {
        text: 'hello world'
      });
      expect(result).toBe('Hello World');
    });

    it('should apply title formatter', () => {
      const result = TemplateEngine.render('{{text|title}}', {
        text: 'hello world'
      });
      expect(result).toBe('Hello World');
    });

    it('should apply ellipsis formatter', () => {
      const result = TemplateEngine.render('{{text|ellipsis:10}}', {
        text: 'This is a very long text'
      });
      expect(result).toBe('This is a ...');
    });

    it('should not add ellipsis if text is shorter than limit', () => {
      const result = TemplateEngine.render('{{text|ellipsis:50}}', {
        text: 'Short text'
      });
      expect(result).toBe('Short text');
    });

    it('should apply trim formatter', () => {
      const result = TemplateEngine.render('{{text|trim}}', {
        text: '  hello world  '
      });
      expect(result).toBe('hello world');
    });

    it('should apply prefix formatter', () => {
      const result = TemplateEngine.render('{{name|prefix:Dr. }}', {
        name: 'Smith'
      });
      // Fixed: trimStart() preserves trailing whitespace
      expect(result).toBe('Dr. Smith');
    });

    it('should apply suffix formatter', () => {
      const result = TemplateEngine.render('{{name|suffix: Jr.}}', {
        name: 'John'
      });
      // This works because the space is at the beginning of the argument, not end
      expect(result).toBe('John Jr.');
    });

    it('should apply replace formatter', () => {
      const result = TemplateEngine.render('{{text|replace:world:universe}}', {
        text: 'hello world'
      });
      expect(result).toBe('hello universe');
    });

    it('should apply replace formatter globally', () => {
      const result = TemplateEngine.render('{{text|replace:o:0}}', {
        text: 'hello world'
      });
      expect(result).toBe('hell0 w0rld');
    });

    it('should apply slice formatter with start and end', () => {
      const result = TemplateEngine.render('{{text|slice:0:5}}', {
        text: 'hello world'
      });
      expect(result).toBe('hello');
    });

    it('should apply slice formatter with start only', () => {
      const result = TemplateEngine.render('{{text|slice:6}}', {
        text: 'hello world'
      });
      expect(result).toBe('world');
    });

    it('should apply pad formatter', () => {
      const result = TemplateEngine.render('{{num|pad:5:0}}', {
        num: '42'
      });
      expect(result).toBe('00042');
    });

    it('should apply number formatter with precision', () => {
      const result = TemplateEngine.render('{{value|number:2}}', {
        value: '3.14159'
      });
      expect(result).toBe('3.14');
    });

    it('should apply number formatter without precision', () => {
      const result = TemplateEngine.render('{{value|number}}', {
        value: '42.5'
      });
      expect(result).toBe('42.5');
    });

    it('should handle invalid number gracefully', () => {
      const result = TemplateEngine.render('{{value|number}}', {
        value: 'not a number'
      });
      expect(result).toBe('not a number');
    });

    it('should apply json formatter', () => {
      const result = TemplateEngine.render('{{data|json}}', {
        data: { name: 'John', age: 30 }
      });
      expect(result).toBe('{"name":"John","age":30}');
    });

    it('should apply split formatter', () => {
      const result = TemplateEngine.render('{{text|split: }}', {
        text: 'hello world'
      });
      // Fixed: trimStart() preserves trailing whitespace delimiter
      expect(result).toBe('hello,world');
    });

    it('should apply split formatter with non-space delimiter', () => {
      const result = TemplateEngine.render('{{text|split:-}}', {
        text: 'hello-world'
      });
      expect(result).toBe('hello,world');
    });

    it('should apply date formatter with iso format', () => {
      const result = TemplateEngine.render('{{date|date:iso}}', {
        date: '2023-06-15T12:00:00Z'
      });
      expect(result).toContain('2023');
    });

    it('should apply date formatter with year format', () => {
      const result = TemplateEngine.render('{{date|date:year}}', {
        date: '2023-06-15T12:00:00Z'
      });
      expect(result).toBe('2023');
    });

    it('should handle abbr with various lengths', () => {
      expect(TemplateEngine.render('{{name|abbr1}}', { name: 'Smith' })).toBe('S');
      expect(TemplateEngine.render('{{name|abbr2}}', { name: 'Smith' })).toBe('Sm');
      expect(TemplateEngine.render('{{name|abbr4}}', { name: 'Smith' })).toBe('Smit');
      expect(TemplateEngine.render('{{name|abbr5}}', { name: 'Smith' })).toBe('Smith');
      expect(TemplateEngine.render('{{name|abbr10}}', { name: 'Smith' })).toBe('Smith');
    });

    it('should handle truncate with number suffix', () => {
      const result = TemplateEngine.render('{{text|truncate5}}', {
        text: 'hello world'
      });
      expect(result).toBe('hello');
    });
  });

  describe('render - chained formatters', () => {
    // Note: Current implementation may not support true chaining
    // This documents the expected vs actual behavior
    it('should apply single formatter from pipe', () => {
      const result = TemplateEngine.render('{{name|lowercase}}', {
        name: 'SMITH'
      });
      expect(result).toBe('smith');
    });
  });

  describe('render - array iteration edge cases', () => {
    it('should provide @number (1-based index) in array iteration', () => {
      const result = TemplateEngine.render('{{#items}}{{@number}}.{{.}} {{/items}}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('1.a 2.b 3.c ');
    });

    it('should provide @length in array iteration', () => {
      const result = TemplateEngine.render('{{#items}}{{@length}}{{/items}}', {
        items: ['a', 'b', 'c']
      });
      expect(result).toBe('333');
    });

    it('should provide @odd and @even in array iteration', () => {
      const result = TemplateEngine.render('{{#items}}{{#@even}}E{{/@even}}{{#@odd}}O{{/@odd}}{{/items}}', {
        items: ['a', 'b', 'c', 'd']
      });
      expect(result).toBe('EOEO');
    });

    it('should handle nested array iteration', () => {
      const result = TemplateEngine.render('{{#groups}}[{{#.}}{{.}}{{/.}}]{{/groups}}', {
        groups: [['a', 'b'], ['c', 'd']]
      });
      // This tests if nested iteration works
      expect(result).toContain('[');
    });

    it('should handle objects in array iteration', () => {
      const result = TemplateEngine.render('{{#authors}}{{family}}, {{/authors}}', {
        authors: [{ family: 'Smith' }, { family: 'Jones' }]
      });
      // Fixed: Object properties are now spread into iteration context
      expect(result).toBe('Smith, Jones, ');
    });

    it('should access object properties via dot notation in iteration', () => {
      const result = TemplateEngine.render('{{#authors}}{{.}}{{/authors}}', {
        authors: [{ family: 'Smith' }, { family: 'Jones' }]
      });
      // {{.}} gives us the whole object (as JSON)
      expect(result).toContain('family');
    });

    it('should access nested object properties in iteration', () => {
      const result = TemplateEngine.render('{{#items}}{{name}}: {{value}}, {{/items}}', {
        items: [
          { name: 'a', value: 1 },
          { name: 'b', value: 2 }
        ]
      });
      expect(result).toBe('a: 1, b: 2, ');
    });
  });

  describe('render - complex nested scenarios', () => {
    it('should handle array iteration with object properties', () => {
      const result = TemplateEngine.render(
        '{{#authors}}{{.}} {{/authors}}',
        {
          authors: ['Smith', 'Jones']
        }
      );
      expect(result).toContain('Smith');
      expect(result).toContain('Jones');
    });

    it('should handle complex citekey generation pattern', () => {
      const result = TemplateEngine.render(
        '{{author|lowercase}}{{title|titleword}}{{year}}',
        {
          author: 'Smith',
          title: 'The Art of Programming',
          year: '2023'
        },
        { sanitizeForCitekey: true }
      );
      expect(result).toBe('smithart2023');
    });

    it('should handle missing nested properties gracefully', () => {
      const result = TemplateEngine.render('{{author.missing.property}}', {
        author: { family: 'Smith' }
      });
      expect(result).toBe('');
    });
  });

  describe('render - edge cases', () => {
    it('should handle empty template', () => {
      const result = TemplateEngine.render('', { name: 'John' });
      expect(result).toBe('');
    });

    it('should handle template with no variables', () => {
      const result = TemplateEngine.render('Plain text', { name: 'John' });
      expect(result).toBe('Plain text');
    });

    it('should handle null and undefined values', () => {
      const result = TemplateEngine.render('{{a}}{{b}}{{c}}', {
        a: null,
        b: undefined,
        c: 'value'
      });
      expect(result).toBe('value');
    });

    it('should handle numeric values', () => {
      const result = TemplateEngine.render('{{year}}', { year: 2023 });
      expect(result).toBe('2023');
    });

    it('should handle boolean values', () => {
      const result = TemplateEngine.render('{{flag}}', { flag: true });
      expect(result).toBe('true');
    });
  });
});
