import { FrontmatterBuilderService, FrontmatterInput } from './frontmatter-builder-service';
import { TemplateEngine } from '../utils/template-engine';
import { TemplateVariableBuilderService } from './template-variable-builder-service';

/**
 * Input for building a complete note's content
 */
export interface NoteContentInput extends FrontmatterInput {
  annotationContent?: string; // Content extracted from 'annote' fields
  relatedNotePaths?: string[]; // Paths to related notes
}

/**
 * Service responsible for building complete note content including frontmatter and body
 */
export class NoteContentBuilderService {
  private frontmatterBuilder: FrontmatterBuilderService;
  private templateVariableBuilder: TemplateVariableBuilderService;
  
  constructor(
    frontmatterBuilder: FrontmatterBuilderService,
    templateVariableBuilder: TemplateVariableBuilderService
  ) {
    this.frontmatterBuilder = frontmatterBuilder;
    this.templateVariableBuilder = templateVariableBuilder;
  }
  
  /**
   * Build a complete note's content including frontmatter and body
   * @param data The input data for note content generation
   * @returns The complete note content as string
   */
  async buildNoteContent(data: NoteContentInput): Promise<string> {
    try {
      const { 
        citation, 
        contributors, 
        additionalFields, 
        attachmentPaths,
        pluginSettings, 
        annotationContent,
        relatedNotePaths
      } = data;
      
      // Generate frontmatter
      const frontmatter = await this.frontmatterBuilder.buildYamlFrontmatter({
        citation,
        contributors,
        additionalFields,
        attachmentPaths,
        pluginSettings,
        relatedNotePaths
      });
      
      // Build template variables for header template
      const templateVariables = this.templateVariableBuilder.buildVariables(
        citation, 
        contributors, 
        attachmentPaths,
        relatedNotePaths
      );
      
      // Add annotation content to template variables if available
      if (annotationContent) {
        templateVariables.annote_content = annotationContent;
      }
      
      // Determine correct header template based on citation type
      let headerTemplate = pluginSettings.headerTemplate;
      
      // Use chapter template for book chapters and similar types
      if (citation.type === 'chapter' && citation['container-title'] && pluginSettings.chapterHeaderTemplate) {
        headerTemplate = pluginSettings.chapterHeaderTemplate;
      }
      
      // Render the header content
      const headerContent = TemplateEngine.render(headerTemplate, templateVariables);
      
      // Start building the complete note content
      let noteContent = `---\n${frontmatter}---\n\n${headerContent}\n\n`;
      
      // Add annotation content to the body if it's not already included in the header
      if (annotationContent && !headerTemplate.includes('{{annote_content}}')) {
        // Check if annotation content is already included in the header to avoid duplication
        const addToBody = !annotationContent.split('\n\n---\n\n')
          .some(chunk => chunk.length > 20 && headerContent.includes(chunk.substring(0, 20)));
        
        if (addToBody) {
          noteContent += `## Notes\n\n${annotationContent}\n\n`;
        }
      }
      
      return noteContent;
    } catch (error) {
      console.error('Error building note content:', error);
      throw error;
    }
  }
}