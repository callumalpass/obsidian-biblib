import { Plugin } from 'obsidian';
import {
    BibliographyPluginSettings,
    DEFAULT_SETTINGS,
    LEGACY_RELATED_FIELD_TEMPLATE,
    RELATED_FIELD_DEFAULT_TEMPLATE
} from '../types/settings';
import { getString, isRecord } from '../utils/type-guards';

/**
 * Manages the loading, saving, and validation of plugin settings
 */
export class SettingsManager {
    private settings: BibliographyPluginSettings;

    constructor(private plugin: Plugin) {
        this.settings = { ...DEFAULT_SETTINGS };
    }

    /**
     * Load settings from Obsidian data storage
     */
    public async loadSettings(): Promise<BibliographyPluginSettings> {
        const loadedData: unknown = await this.plugin.loadData();
        this.settings = this.migrateAndValidateSettings(loadedData);
        return this.settings;
    }

    /**
     * Save settings to Obsidian data storage
     */
    public async saveSettings(): Promise<void> {
        await this.plugin.saveData(this.settings);
    }

    /**
     * Update settings with new values
     * @param newSettings The new settings to apply
     */
    public async updateSettings(newSettings: Partial<BibliographyPluginSettings>): Promise<BibliographyPluginSettings> {
        // Merge the new settings with the existing settings
        this.settings = {
            ...this.settings,
            ...newSettings
        };

        // Validate specific nested objects to ensure they have all required fields
        if (newSettings.citekeyOptions) {
            this.settings.citekeyOptions = {
                ...DEFAULT_SETTINGS.citekeyOptions,
                ...this.settings.citekeyOptions
            };
        }

        // Save the updated settings
        await this.saveSettings();
        return this.settings;
    }

    /**
     * Get the current settings
     */
    public getSettings(): BibliographyPluginSettings {
        return this.settings;
    }

    /**
     * Migrate settings from older versions and validate them
     * @param loadedData The data loaded from storage
     */
    private migrateAndValidateSettings(loadedData: unknown): BibliographyPluginSettings {
        // Start with default settings
        const settings = { ...DEFAULT_SETTINGS };

        // If no data was loaded, return defaults
        if (!isRecord(loadedData)) {
            return settings;
        }

        // Merge loaded data with defaults
        const mergedSettings = {
            ...settings,
            ...loadedData
        };

        // Ensure citekeyOptions is properly initialized with defaults
        mergedSettings.citekeyOptions = {
            ...DEFAULT_SETTINGS.citekeyOptions,
            ...(isRecord(loadedData.citekeyOptions) ? loadedData.citekeyOptions : {})
        };

        // Ensure customFrontmatterFields exists and is an array
        if (!Array.isArray(mergedSettings.customFrontmatterFields)) {
            mergedSettings.customFrontmatterFields = DEFAULT_SETTINGS.customFrontmatterFields;
        }

        // Handle legacy settings migrations
        this.migrateFromLegacySettings(mergedSettings, loadedData);
        this.migrateRelatedFieldTemplate(mergedSettings);

        return mergedSettings;
    }

    /**
     * Migrate settings from legacy versions
     * @param mergedSettings The settings being constructed
     * @param loadedData The raw loaded data
     */
    private migrateFromLegacySettings(
        mergedSettings: BibliographyPluginSettings, 
        loadedData: unknown
    ): void {
        // Handle migration from legacy citekey settings format
        // (This is just an example - implement actual migrations as needed)
        if (!isRecord(loadedData)) {
            return;
        }

        if (loadedData.legacyCitekeyOption !== undefined) {
            // Migrate legacy option to new format
            if (mergedSettings.citekeyOptions) {
                // Use an existing property like useZoteroKeys
                mergedSettings.citekeyOptions.useZoteroKeys = !!loadedData.legacyCitekeyOption;
            }
        }

        // Example of migrating from a legacy path setting
        const oldAttachmentFolder = getString(loadedData, 'oldAttachmentFolder');
        if (oldAttachmentFolder && !loadedData.attachmentFolderPath) {
            mergedSettings.attachmentFolderPath = oldAttachmentFolder;
        }
    }

    /**
     * Replace the old default `related` template (`[{{links}}]`), which wrote a nested list,
     * with the current default. Customised templates are left unchanged (#53).
     */
    private migrateRelatedFieldTemplate(settings: BibliographyPluginSettings): void {
        settings.customFrontmatterFields = settings.customFrontmatterFields.map(field =>
            field.name === 'related' && field.template === LEGACY_RELATED_FIELD_TEMPLATE
                ? { ...field, template: RELATED_FIELD_DEFAULT_TEMPLATE }
                : field
        );
    }
}
