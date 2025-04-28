import { Citation, Contributor } from "../types/citation";

/**
 * Service responsible for building template variables for use in various templates
 */
export class TemplateVariableBuilderService {
  /**
   * Build a comprehensive set of template variables from citation data
   * @param citation Citation data
   * @param contributors List of contributors
   * @param attachmentPath Optional path to attachment
   * @param relatedNotePaths Optional list of related note paths
   * @returns Object containing all template variables
   */
  buildVariables(
    citation: Citation, 
    contributors: Contributor[], 
    attachmentPath?: string,
    relatedNotePaths?: string[]
  ): Record<string, any> {
    // Start with the basic variable set
    const variables: Record<string, any> = {
      // Current date (useful for templates)
      currentDate: new Date().toISOString().split('T')[0],
      
      // Formatted author list for display
      authors: this.formatAuthorsForTemplate(contributors),
      
      // Add all citation fields directly (for access to any field)
      ...citation,
      
      // Add contributor lists by role
      ...this.buildContributorLists(contributors),
      
      // Override with explicit versions of common fields for clarity
      // These ensure consistent access even if the citation object structure changes
      citekey: citation.id || '',
    };
    
    // Handle attachment paths without conditionals
    // We always set these, even if empty, to ensure templates work properly
    if (attachmentPath && attachmentPath.trim()) {
      variables.pdflink = attachmentPath;
      
      // Create attachment link format based on file type
      if (attachmentPath.endsWith('.pdf')) {
        variables.attachment = `[[${attachmentPath}|PDF]]`;
      } else if (attachmentPath.endsWith('.epub')) {
        variables.attachment = `[[${attachmentPath}|EPUB]]`;
      } else {
        variables.attachment = `[[${attachmentPath}|attachment]]`;
      }
      
      // Also provide just the raw path without Obsidian link formatting
      variables.raw_pdflink = attachmentPath;
      
      // For use in frontmatter arrays, prepare a properly quoted version 
      variables.quoted_attachment = `"${variables.attachment}"`;
    } else {
      // Set empty values to ensure templates can reference these keys
      variables.pdflink = '';
      variables.attachment = '';
      variables.raw_pdflink = '';
      variables.quoted_attachment = '';
    }
    
    // Process related notes if provided
    if (relatedNotePaths && relatedNotePaths.length > 0) {
      // Format as Obsidian wikilinks
      const formattedLinks = relatedNotePaths.map(path => `[[${path}]]`);

      variables.links = formattedLinks; // Array of wikilinks
      variables.linkPaths = relatedNotePaths; // Array of raw paths
      variables.links_string = formattedLinks.join(', '); // Comma-separated string of wikilinks
    } else {
      // Ensure variables exist even if empty
      variables.links = [];
      variables.linkPaths = [];
      variables.links_string = '';
    }

    return variables;
  }
  
  /**
   * Format contributors list for template usage
   * @param contributors List of contributors
   * @returns Formatted string like "A. Smith", "A. Smith and B. Jones", or "A. Smith et al."
   */
  private formatAuthorsForTemplate(contributors: Contributor[]): string {
    const authors = contributors.filter(c => c.role === 'author');
    
    if (authors.length === 0) {
      return '';
    }
    
    const formattedNames = authors.map(this.formatContributorName).filter(name => !!name);
    
    if (formattedNames.length === 0) return '';
    if (formattedNames.length === 1) return formattedNames[0];
    if (formattedNames.length === 2) return `${formattedNames[0]} and ${formattedNames[1]}`;
    return `${formattedNames[0]} et al.`;
  }
  
  /**
   * Format a single contributor's name
   * @param contributor Contributor to format
   * @returns Formatted name string like "J. Doe" or the literal name/institution
   */
  private formatContributorName(contributor: Contributor): string {
    // Trim inputs
    const family = contributor.family?.trim();
    const given = contributor.given?.trim();
    const literal = contributor.literal?.trim();
    
    // Use literal name if provided (usually for institutions)
    if (literal) {
      return literal;
    }
    
    if (family) {
      if (given) {
        // Use first initial + family name
        const initial = given.charAt(0).toUpperCase();
        return `${initial}. ${family}`;
      } else {
        // Only family name
        return family; 
      }
    } else if (given) {
      // Only given name? Unusual but handle it
      return given;
    }
    
    return ''; // No name parts found
  }
  
  /**
   * Build lists of contributors grouped by role for use in templates
   * @param contributors List of all contributors
   * @returns Object with arrays of contributors by role with various formatting
   */
  private buildContributorLists(contributors: Contributor[]): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Group contributors by role
    const byRole = contributors.reduce((groups, contributor) => {
      const role = contributor.role || 'author';
      if (!groups[role]) {
        groups[role] = [];
      }
      groups[role].push(contributor);
      return groups;
    }, {} as Record<string, Contributor[]>);
    
    // Create raw arrays by role
    Object.entries(byRole).forEach(([role, roleContributors]) => {
      // Add raw contributor objects
      result[`${role}s_raw`] = roleContributors;
      
      // Add array of formatted names
      result[`${role}s`] = roleContributors.map(c => {
        if (c.literal) {
          return c.literal;
        }
        
        const family = c.family || '';
        const given = c.given || '';
        
        // Return full name if both parts exist
        if (family && given) {
          return `${given} ${family}`;
        }
        // Return whichever part exists
        return family || given || '';
      }).filter(Boolean); // Remove empty names
      
      // Add array of family names only
      result[`${role}s_family`] = roleContributors
        .map(c => c.family || c.literal || '')
        .filter(name => name !== '');
      
      // Add array of given names only
      result[`${role}s_given`] = roleContributors
        .map(c => c.given || '')
        .filter(name => name !== '');
    });
    
    return result;
  }
}