import { stringifyYaml } from 'obsidian';
import { BibliographyPluginSettings } from '../types';
import { Citation, Contributor, AdditionalField } from '../types/citation';
import { TemplateEngine } from '../utils/template-engine';
import { TemplateVariableBuilderService } from './template-variable-builder-service';

/**
 * Input for building a YAML frontmatter
 */
export interface FrontmatterInput {
  citation: Citation; // Core CSL data
  contributors: Contributor[];
  additionalFields: AdditionalField[]; // Fields not part of core CSL structure
  attachmentPaths?: string[]; // Normalized paths in vault if attachments exist
  pluginSettings: BibliographyPluginSettings; // To access custom fields, tag etc.
  relatedNotePaths?: string[]; // Paths to related notes
}

/**
 * Service responsible for generating YAML frontmatter based on citation data and settings
 */
export class FrontmatterBuilderService {
  private templateVariableBuilder: TemplateVariableBuilderService;
  
  constructor(templateVariableBuilder: TemplateVariableBuilderService) {
    this.templateVariableBuilder = templateVariableBuilder;
  }
  
  /**
   * Build YAML frontmatter string from citation data and settings
   * @param data The input data for frontmatter generation
   * @returns Formatted YAML frontmatter string
   */
  async buildYamlFrontmatter(data: FrontmatterInput): Promise<string> {
    try {
      const { citation, contributors, additionalFields, attachmentPaths, pluginSettings, relatedNotePaths } = data;
      
      // Build base frontmatter object from essential citation fields
      const frontmatter: Record<string, any> = {
        id: citation.id,
        type: citation.type,
        title: citation.title,
        // Use CSL date format for issued date
        issued: {
          'date-parts': [[
            citation.year ? Number(citation.year) : undefined,
            citation.month ? Number(citation.month) : undefined,
            citation.day ? Number(citation.day) : undefined
          ].filter(v => v !== undefined)], // Filter out undefined parts
        },
        // Add standard CSL fields (only if they have values)
        ...(citation['title-short'] && { 'title-short': citation['title-short'] }),
        ...(citation.page && { page: citation.page }),
        ...(citation.URL && { URL: citation.URL }),
        ...(citation.DOI && { DOI: citation.DOI }),
        ...(citation['container-title'] && { 'container-title': citation['container-title'] }),
        ...(citation.publisher && { publisher: citation.publisher }),
        ...(citation['publisher-place'] && { 'publisher-place': citation['publisher-place'] }),
        ...(citation.edition && { 
          edition: isNaN(Number(citation.edition)) ? citation.edition : Number(citation.edition) 
        }),
        ...(citation.volume && { 
          volume: isNaN(Number(citation.volume)) ? citation.volume : Number(citation.volume) 
        }),
        ...(citation.number && { 
          number: isNaN(Number(citation.number)) ? citation.number : Number(citation.number) 
        }),
        ...(citation.language && { language: citation.language }),
        ...(citation.abstract && { abstract: citation.abstract }),
        
        // Ensure literature note tag is always present, while preserving any existing tags
        tags: citation.tags && Array.isArray(citation.tags)
          ? [...new Set([...citation.tags, pluginSettings.literatureNoteTag])]
          : [pluginSettings.literatureNoteTag]
      };
      
      // Add contributors to frontmatter, preserving all CSL contributor properties
      this.addContributorsToFrontmatter(frontmatter, contributors);
      
      // Add additional fields to frontmatter
      this.addAdditionalFieldsToFrontmatter(frontmatter, additionalFields);
      
      // Process custom frontmatter fields from plugin settings
      await this.processCustomFrontmatterFields(
        frontmatter, 
        citation, 
        contributors, 
        attachmentPaths, 
        pluginSettings,
        relatedNotePaths
      );
      
      // Generate formatted YAML
      return stringifyYaml(frontmatter);
    } catch (error) {
      console.error('Error creating frontmatter:', error);
      throw error;
    }
  }
  
  /**
   * Add contributors to frontmatter object
   * @param frontmatter The frontmatter object to modify
   * @param contributors Array of contributors to add
   */
  private addContributorsToFrontmatter(
    frontmatter: Record<string, any>, 
    contributors: Contributor[]
  ): void {
    contributors.forEach(contributor => {
      // Only include entries with at least one name or other identifier
      if (contributor.family || contributor.given || contributor.literal) {
        if (!frontmatter[contributor.role]) {
          frontmatter[contributor.role] = [];
        }
        // Copy all contributor properties except the role
        const { role, ...personData } = contributor;
        frontmatter[contributor.role].push(personData);
      }
    });
  }
  
  /**
   * Add additional fields to frontmatter object
   * @param frontmatter The frontmatter object to modify
   * @param additionalFields Array of additional fields to add
   */
  private addAdditionalFieldsToFrontmatter(
    frontmatter: Record<string, any>, 
    additionalFields: AdditionalField[]
  ): void {
    additionalFields.forEach((field) => {
      if (field.name && field.value != null && field.value !== '') {
        let valueToAdd = field.value;
        
        // Format value based on field type
        if (field.type === 'date') {
          // For date type fields, ensure they have the proper CSL date-parts structure
          if (typeof field.value === 'object' && field.value['date-parts']) {
            // It's already in CSL format
            valueToAdd = field.value;
          } else if (typeof field.value === 'string') {
            // Try parsing date string (YYYY-MM-DD or YYYY)
            const dateParts = field.value.split('-')
              .map(Number)
              .filter((part: number) => !isNaN(part));
            
            if (dateParts.length > 0) {
              valueToAdd = { 'date-parts': [dateParts] };
            } else {
              // If parsing fails, store as string
              valueToAdd = field.value;
            }
          }
        } else if (field.type === 'number') {
          // Ensure numbers are stored as numbers, not strings
          const numValue = parseFloat(field.value as any);
          valueToAdd = isNaN(numValue) ? field.value : numValue;
        }
        
        // Add the potentially modified value to frontmatter
        frontmatter[field.name] = valueToAdd;
      }
    });
  }
  
  /**
   * Process custom frontmatter fields from plugin settings
   * @param frontmatter The frontmatter object to modify
   * @param citation The citation data
   * @param contributors Array of contributors
   * @param attachmentPaths Optional paths to attachments
   * @param pluginSettings Plugin settings containing custom field definitions
   */
  private async processCustomFrontmatterFields(
    frontmatter: Record<string, any>,
    citation: Citation,
    contributors: Contributor[],
    attachmentPaths?: string[],
    pluginSettings?: BibliographyPluginSettings,
    relatedNotePaths?: string[]
  ): Promise<void> {
    if (!pluginSettings?.customFrontmatterFields?.length) {
      return;
    }
    
    // Build template variables
    const templateVariables = this.templateVariableBuilder.buildVariables(
      citation, 
      contributors, 
      attachmentPaths,
      relatedNotePaths
    );
    
    // Filter to enabled custom fields
    const enabledFields = pluginSettings.customFrontmatterFields.filter(field => field.enabled);
    
    // Process each enabled custom field
    for (const field of enabledFields) {
      // Special case handling for attachment fields with direct passthrough
      if (field.name === 'pdflink' && field.template === '{{pdflink}}') {
        if (templateVariables.pdflink?.length > 0) {
          frontmatter[field.name] = templateVariables.pdflink;
        }
        continue;
      }
      
      if (field.name === 'attachment' && field.template === '{{attachment}}') {
        if (templateVariables.attachments?.length > 0) {
          frontmatter[field.name] = templateVariables.attachments;
        }
        continue;
      }
      
      // Skip if field name already exists in frontmatter (don't overwrite standard fields)
      if (frontmatter.hasOwnProperty(field.name)) {
        continue;
      }
      
      // Determine if this looks like an array/object template
      const isArrayTemplate = field.template.trim().startsWith('[') && 
                             field.template.trim().endsWith(']');
      
      // Render the template with appropriate options
      const renderedValue = TemplateEngine.render(
        field.template,
        templateVariables, 
        { yamlArray: isArrayTemplate }
      );
      
      // Handle different types of rendered values
      if ((renderedValue.startsWith('[') && renderedValue.endsWith(']')) || 
          (renderedValue.startsWith('{') && renderedValue.endsWith('}'))) {
        try {
          // Parse as JSON for arrays and objects
          frontmatter[field.name] = JSON.parse(renderedValue);
        } catch (e) {
          // Special handling for array templates that should be empty arrays
          if (isArrayTemplate && (renderedValue.trim() === '[]' || renderedValue.trim() === '[ ]')) {
            frontmatter[field.name] = [];
          } else if (isArrayTemplate && 
                    (renderedValue.includes('{{pdflink}}') || renderedValue.includes('{{attachment}}')) && 
                    templateVariables.attachments?.length > 0) {
            // Handle array template containing attachments
            frontmatter[field.name] = templateVariables.attachments || [];
          } else {
            // Use as string if JSON parsing fails and no special case
            frontmatter[field.name] = renderedValue;
          }
        }
      } else if (renderedValue.trim() === '') {
        // For truly empty values in array templates, add empty array
        if (isArrayTemplate) {
          frontmatter[field.name] = [];
        }
        // Otherwise, don't add empty fields at all
      } else {
        // If the field value contains variable references that didn't render
        if (renderedValue.includes('{{pdflink}}') || renderedValue.includes('{{attachment}}')) {
          // Don't add the field if the template wasn't properly rendered
          // This indicates the attachment variable wasn't available
        } else {
          // Use as string for non-array/object values
          frontmatter[field.name] = renderedValue;
        }
      }
    }
  }
}