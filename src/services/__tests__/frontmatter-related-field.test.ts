// The real stringifyYaml is part of Obsidian. JSON is valid YAML, so the mock
// serialises the frontmatter object as JSON and the tests parse it back.
jest.mock('obsidian', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../../__mocks__/obsidian'),
  stringifyYaml: (value: unknown) => JSON.stringify(value),
}));

import { FrontmatterBuilderService } from '../frontmatter-builder-service';
import { TemplateVariableBuilderService } from '../template-variable-builder-service';
import {
  DEFAULT_SETTINGS,
  LEGACY_RELATED_FIELD_TEMPLATE,
  RELATED_FIELD_DEFAULT_TEMPLATE,
} from '../../types/settings';
import { BibliographyPluginSettings } from '../../types';
import { Citation } from '../../types/citation';

const citation: Citation = {
  id: 'smith2020',
  type: 'article-journal',
  title: 'A Paper',
};

function settingsWithRelatedTemplate(template: string): BibliographyPluginSettings {
  return {
    ...DEFAULT_SETTINGS,
    customFrontmatterFields: [{ name: 'related', template, enabled: true }],
  };
}

async function buildRelated(
  relatedNotePaths: string[],
  template: string = RELATED_FIELD_DEFAULT_TEMPLATE
): Promise<unknown> {
  const builder = new FrontmatterBuilderService(new TemplateVariableBuilderService());
  const yaml = await builder.buildYamlFrontmatter({
    citation,
    contributors: [],
    additionalFields: [],
    pluginSettings: settingsWithRelatedTemplate(template),
    relatedNotePaths,
  });
  return (JSON.parse(yaml) as Record<string, unknown>).related;
}

describe('related custom frontmatter field (#53)', () => {
  it('uses {{links|json}} as the default template', () => {
    const related = DEFAULT_SETTINGS.customFrontmatterFields.find(field => field.name === 'related');
    expect(related?.template).toBe('{{links|json}}');
  });

  describe('with the default template', () => {
    it('writes an empty list when no notes are related', async () => {
      expect(await buildRelated([])).toEqual([]);
    });

    it('writes a flat list for one related note', async () => {
      expect(await buildRelated(['A.md'])).toEqual(['[[A.md]]']);
    });

    it('writes a flat list for two related notes', async () => {
      expect(await buildRelated(['A.md', 'B.md'])).toEqual(['[[A.md]]', '[[B.md]]']);
    });

    it('keeps a note name containing a comma intact', async () => {
      expect(await buildRelated(['Smith, 2020.md'])).toEqual(['[[Smith, 2020.md]]']);
    });

    it('keeps a note name containing a quote intact', async () => {
      expect(await buildRelated(['Say "hi".md'])).toEqual(['[[Say "hi".md]]']);
    });
  });

  describe('with the old default template', () => {
    it('wrote a nested list', async () => {
      expect(await buildRelated([], LEGACY_RELATED_FIELD_TEMPLATE)).toEqual([[]]);
      expect(await buildRelated(['A.md', 'B.md'], LEGACY_RELATED_FIELD_TEMPLATE)).toEqual([
        ['[[A.md]]', '[[B.md]]'],
      ]);
    });
  });
});
