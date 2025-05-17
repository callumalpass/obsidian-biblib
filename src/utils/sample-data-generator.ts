import { Citation, Contributor } from "../types/citation";

/**
 * Generates sample citation data for use in template examples and testing
 * 
 * This provides a consistent data structure that matches what would be
 * produced by the TemplateVariableBuilderService in a real citation
 */
export class SampleDataGenerator {
    /**
     * Get a complete set of sample data for template rendering
     * 
     * @returns A record containing all sample template variables
     */
    static getSampleData(): Record<string, any> {
        // Based on TemplateVariableBuilderService.buildVariables()
        return {
            // Basic citation metadata
            id: "smith_neural2024",
            citekey: "smith_neural2024",
            type: "article-journal",
            title: "Neural Networks for Climate Prediction",
            issued: {
                "date-parts": [[2024, 3, 15]]
            },
            year: 2024,
            month: 3,
            day: 15,
            URL: "https://example.org/10.1234/climate.2024.001",
            DOI: "10.1234/climate.2024.001",
            publisher: "Journal of Climate Science",
            "container-title": "Journal of Climate Science",
            abstract: "This study presents a novel neural network framework for improving climate model accuracy and computational efficiency.",
            volume: 15,
            issue: 2,
            page: "123-145",
            "collection-title": "",
            "publisher-place": "Cambridge",
            language: "en",
            
            // Author metadata
            author: [
                { family: "Smith", given: "John" },
                { family: "Rodriguez", given: "Maria" },
                { family: "Zhang", given: "Wei" }
            ],

            // Computed fields that match TemplateVariableBuilderService output
            // Current date/time
            currentDate: new Date().toISOString().split('T')[0],
            currentTime: new Date().toISOString().split('T')[1].split('.')[0],
            
            // Formatted author lists
            authors: "J. Smith et al.",
            authors_raw: [
                { family: "Smith", given: "John", role: "author" },
                { family: "Rodriguez", given: "Maria", role: "author" },
                { family: "Zhang", given: "Wei", role: "author" }
            ],
            authors_family: ["Smith", "Rodriguez", "Zhang"],
            authors_given: ["John", "Maria", "Wei"],
            
            // Editor metadata
            editors: ["Jones"],
            editors_family: ["Jones"],
            editors_given: ["Emily"],
            
            // Attachment data
            pdflink: ["biblib/smith_neural2024/paper.pdf"],
            raw_pdflink: "biblib/smith_neural2024/paper.pdf",
            htmllink: "biblib/smith_neural2024/supplementary.html",
            attachments: [
                "[[biblib/smith_neural2024/paper.pdf|PDF]]",
                "[[biblib/smith_neural2024/supplementary.html|HTML]]"
            ],
            attachment: "[[biblib/smith_neural2024/paper.pdf|PDF]]",
            quoted_attachments: [
                "\"[[biblib/smith_neural2024/paper.pdf|PDF]]\"",
                "\"[[biblib/smith_neural2024/supplementary.html|HTML]]\""
            ],
            quoted_attachment: "\"[[biblib/smith_neural2024/paper.pdf|PDF]]\"",
            
            // Related notes
            links: ["[[Research/Climate Science/Overview]]", "[[Projects/ML Applications]]"],
            linkPaths: ["Research/Climate Science/Overview.md", "Projects/ML Applications.md"],
            links_string: "[[Research/Climate Science/Overview]], [[Projects/ML Applications]]"
        };
    }

    /**
     * Get mode-specific sample data to better emulate how each part of 
     * the system processes templates (frontmatter, citekey, etc.)
     * 
     * @param mode The template mode to generate data for
     * @param baseData Optional base data to modify (defaults to getSampleData())
     * @returns Mode-specific sample data
     */
    static getModeSpecificSampleData(
        mode: 'normal' | 'citekey' | 'frontmatter', 
        baseData?: Record<string, any>
    ): Record<string, any> {
        // Start with the base sample data if not provided
        const data = baseData ? 
            JSON.parse(JSON.stringify(baseData)) : // Deep copy of provided data
            JSON.parse(JSON.stringify(this.getSampleData())); // Deep copy of default data
        
        if (mode === 'frontmatter') {
            // In Frontmatter mode, we want full arrays for authors - don't use the formatted string
            // which helps with array template formatting
            
            // Ensure the actual raw values are used, not the formatted versions
            // This better emulates how the frontmatter builder processes arrays
            
            // 1. Fix authors variable to use full names instead of the formatted "J. Smith et al."
            data.authors = data.authors_family.map((family: string, i: number) => {
                const given = data.authors_given[i];
                if (given) return `${given} ${family}`;
                return family;
            });
            
            // 2. Ensure other special variables are properly structured for templating
            
            // The authors_raw array with role property is what's used in the loop
            if (!data.authors_raw) {
                data.authors_raw = data.author.map((author: any) => {
                    return {
                        ...author,
                        role: 'author'
                    };
                });
            }
            
            // 3. Ensure editor, translator, and other contributor roles have both
            // the singular formatted string and the arrays of component parts
            const roles = ['editor', 'translator', 'contributor'];
            roles.forEach(role => {
                const roleKey = `${role}s`;
                if (data[roleKey] && typeof data[roleKey] === 'string') {
                    // If it's a formatted string like "E. Jones", convert to array of full names
                    // for proper array iteration in templates
                    const familyKey = `${role}s_family`;
                    const givenKey = `${role}s_given`;
                    
                    if (data[familyKey] && Array.isArray(data[familyKey])) {
                        data[roleKey] = data[familyKey].map((family: string, i: number) => {
                            const given = data[givenKey]?.[i] || '';
                            if (given) return `${given} ${family}`;
                            return family;
                        });
                    }
                }
            });
            
            // 4. Ensure attachment variables are properly structured
            // attachments should be an array of formatted links, while pdflink should be an array of paths
            if (data.attachment && typeof data.attachment === 'string' && !Array.isArray(data.attachments)) {
                data.attachments = [data.attachment];
            }
            
            if (data.raw_pdflink && typeof data.raw_pdflink === 'string' && !Array.isArray(data.pdflink)) {
                data.pdflink = [data.raw_pdflink];
                data.raw_pdflinks = [data.raw_pdflink];
            }
            
            // 5. Ensure links are properly formatted
            if (data.linkPaths && Array.isArray(data.linkPaths) && !Array.isArray(data.links)) {
                data.links = data.linkPaths.map((path: string) => `[[${path}]]`);
                data.links_string = data.links.join(', ');
            }
        }
        else if (mode === 'citekey') {
            // For citekey mode, we don't need to change anything from the base data
            // as citekey templates usually use only simple variables
        }
        
        return data;
    }
}