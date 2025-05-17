/**
 * Utility functions for YAML processing in templates
 */

/**
 * Process templates for YAML arrays, ensuring they can be properly parsed as JSON
 * Handles a special case where we want to create an array in YAML frontmatter
 * 
 * @param result The raw string that may contain a YAML array
 * @returns Properly formatted YAML array string or original string if not an array
 */
export function processYamlArray(result: string): string {
    // Handle empty arrays specially
    if (result.trim() === '[]' || result.trim() === '[ ]') {
        return '[]'; // Return a valid empty array
    }
    
    // If it's a simple array pattern like [{{...}}{{...}}], ensure it becomes valid JSON
    // Step 1: Check if it's a potential array pattern
    if (result.startsWith('[') && result.endsWith(']')) {
        try {
            // Try to parse as JSON - if it works, great
            JSON.parse(result);
            return result; // Already valid JSON, return as is
        } catch (e) {
            // Failed to parse as JSON, try to fix
            
            // Special case for empty arrays after template substitution
            if (result.replace(/\s/g, '') === '[]') {
                return '[]';
            }
            
            // Not valid JSON - attempt to fix common issues
            // We'll extract the actual content from between the brackets
            const content = result.substring(1, result.length - 1).trim();
            
            // If content is empty after trimming, return empty array
            if (!content) {
                return '[]';
            }
            
            // Split by commas, but not commas within double quotes
            const splitPattern = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
            let items = content.split(splitPattern).map(item => item.trim());
            
            // Remove empty items
            items = items.filter(item => item !== '');
            
            // If no items after filtering, return empty array
            if (items.length === 0) {
                return '[]';
            }
            
            // Make sure each item is properly quoted if it's not already
            items = items.map(item => {
                if (item.startsWith('"') && item.endsWith('"')) {
                    return item; // Already quoted
                }
                // For items that look like Obsidian links, quote them
                if (item.includes('[[') && item.includes(']]')) {
                    return `"${item.replace(/"/g, '\\"')}"`;
                }
                return item; // Keep as is for now
            });
            
            // Reconstruct as valid JSON array
            return '[' + items.join(',') + ']';
        }
    }
    return result; // Not an array pattern
}

/**
 * Analyzes a rendered template value to determine how it would be handled in YAML frontmatter.
 * Used to explain template behavior to users.
 * 
 * @param template Original template string
 * @param rendered Rendered output from the template engine
 * @returns Object containing YAML representation and explanation
 */
export function analyzeYamlTemplateOutput(template: string, rendered: string): {
    yamlRepresentation: string;
    yamlBehaviorExplanation: string;
} {
    let yamlRepresentation: string;
    let yamlBehaviorExplanation: string;
    
    // Check for patterns that would be interpreted differently in YAML
    // Apply same logic as frontmatter-builder-service.ts
    
    // Case 1: JSON Array format with square brackets that may have been processed by yamlArray option
    if (rendered.trim().startsWith('[') && rendered.trim().endsWith(']')) {
        try {
            // Attempt to parse as JSON to see if it's valid
            const parsedArray = JSON.parse(rendered.trim());
            
            // It's a valid JSON array, which would be proper in frontmatter
            yamlRepresentation = `---\nfield: ${JSON.stringify(parsedArray)}\n---`;
            yamlBehaviorExplanation = 'This template produces a valid JSON array that will be properly parsed as an array in frontmatter.';
        } catch (e) {
            // It's not valid JSON, warn the user
            yamlRepresentation = `---\nfield: "${rendered.trim()}"\n---`;
            yamlBehaviorExplanation = 'This looks like an array but is not valid JSON. The template needs to include commas between items. It will be treated as a regular string.';
        }
    }
    // Case 2: Multi-line strings with dashes
    else if (rendered.trim().startsWith('-') && rendered.includes('\n')) {
        const cleanedRendered = rendered.trim();
        yamlRepresentation = '---\nfield:\n' + cleanedRendered.split('\n').map(line => `  ${line}`).join('\n') + '\n---';
        yamlBehaviorExplanation = 'In BibLib, this format with dashes is NOT automatically parsed as an array. To create arrays, use the JSON syntax with square brackets.';
    }
    // Case 3: Comma-separated list
    else if (rendered.includes(',') && 
        !rendered.includes('\n') && 
        !rendered.includes('{') && 
        !rendered.includes('}')) {
        
        yamlRepresentation = `---\nfield: ${rendered}\n---`;
        yamlBehaviorExplanation = 'Comma-separated values are treated as a single string in frontmatter, not as an array.';
    }
    // Case 4: Multi-line strings
    else if (rendered.includes('\n')) {
        yamlRepresentation = '---\nfield: |\n' + 
            rendered.split('\n').map(line => `  ${line}`).join('\n') +
            '\n---';
        yamlBehaviorExplanation = 'Multi-line text is stored using the pipe syntax (|) in YAML, which preserves line breaks.';
    }
    // Case 5: Simple string
    else {
        yamlRepresentation = `---\nfield: ${rendered}\n---`;
        yamlBehaviorExplanation = 'Simple strings are stored as-is in YAML frontmatter.';
    }
    
    return {
        yamlRepresentation,
        yamlBehaviorExplanation
    };
}