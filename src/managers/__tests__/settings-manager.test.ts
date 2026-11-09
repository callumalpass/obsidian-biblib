import { Plugin } from 'obsidian';
import { SettingsManager } from '../settings-manager';
import { CustomFrontmatterField } from '../../types/settings';

async function loadWith(data: unknown) {
  const plugin = { loadData: () => Promise.resolve(data) } as unknown as Plugin;
  return new SettingsManager(plugin).loadSettings();
}

describe('SettingsManager related field migration (#53)', () => {
  it('replaces the old default related template with {{links|json}}', async () => {
    const fields: CustomFrontmatterField[] = [
      { name: 'year', template: '{{year}}', enabled: true },
      { name: 'related', template: '[{{links}}]', enabled: false },
    ];

    const settings = await loadWith({ customFrontmatterFields: fields });

    expect(settings.customFrontmatterFields).toEqual([
      { name: 'year', template: '{{year}}', enabled: true },
      { name: 'related', template: '{{links|json}}', enabled: false },
    ]);
  });

  it('leaves a customised related template unchanged', async () => {
    const fields: CustomFrontmatterField[] = [
      { name: 'related', template: '[{{#links}}"{{.}}",{{/links}}]', enabled: true },
    ];

    const settings = await loadWith({ customFrontmatterFields: fields });

    expect(settings.customFrontmatterFields).toEqual([
      { name: 'related', template: '[{{#links}}"{{.}}",{{/links}}]', enabled: true },
    ]);
  });

  it('leaves custom fields without a related field unchanged', async () => {
    const fields: CustomFrontmatterField[] = [
      { name: 'year', template: '{{year}}', enabled: true },
      { name: 'links', template: '[{{links}}]', enabled: true },
    ];

    const settings = await loadWith({ customFrontmatterFields: fields });

    expect(settings.customFrontmatterFields).toEqual([
      { name: 'year', template: '{{year}}', enabled: true },
      { name: 'links', template: '[{{links}}]', enabled: true },
    ]);
  });

  it('uses the default fields when the saved settings have no custom fields', async () => {
    const settings = await loadWith({ literatureNotePath: 'refs/' });

    const related = settings.customFrontmatterFields.find(field => field.name === 'related');
    expect(related?.template).toBe('{{links|json}}');
  });
});
