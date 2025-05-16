import { TextAreaComponent } from "obsidian";
import { TemplateEngine } from "../../utils/template-engine";

/**
 * Creates a template preview component
 * Shows live preview of template rendering with sample data
 */
export class TemplatePreviewComponent {
    private container: HTMLElement;
    private previewContent: HTMLElement;
    private sampleData: Record<string, any>;

    /**
     * Creates a new template preview component
     * 
     * @param containerEl - Parent element to attach preview to
     * @param templateField - TextArea component with template content
     * @param previewLabel - Label for the preview section
     * @param options - Additional options for template rendering
     */
    constructor(
        containerEl: HTMLElement,
        private templateField: TextAreaComponent,
        private previewLabel: string = 'Preview:',
        private options: { sanitizeForCitekey?: boolean } = {}
    ) {
        this.sampleData = this.getSampleData();
        this.initialize(containerEl);
    }

    /**
     * Initialize the preview component
     */
    private initialize(containerEl: HTMLElement): void {
        // Create preview container
        this.container = containerEl.createDiv({
            cls: 'template-preview-container'
        });
        
        // Preview label
        this.container.createEl('div', {
            text: this.previewLabel,
            cls: 'template-preview-label'
        });
        
        // Data summary (collapsible)
        const dataSummary = this.container.createDiv({
            cls: 'template-preview-sample-data'
        });
        
        dataSummary.createEl('details', {}, details => {
            details.createEl('summary', { text: 'Sample data (click to expand)' });
            details.createEl('div', {}, div => {
                div.createEl('code', { 
                    text: `id: "${this.sampleData.id}"\n` +
                          `citekey: "${this.sampleData.citekey}"\n` +
                          `title: "${this.sampleData.title}"\n` +
                          `authors: "${this.sampleData.authors}"\n` +
                          `type: ${this.sampleData.type}\n` +
                          `year: ${this.sampleData.year}\n` +
                          `container-title: "${this.sampleData["container-title"]}"\n` +
                          `pdflink: "${this.sampleData.raw_pdflink}"\n` +
                          `attachments: ${JSON.stringify(this.sampleData.attachments)}\n` +
                          `authors_family: ${JSON.stringify(this.sampleData.authors_family)}`
                });
            });
        });
        
        // Preview content
        this.previewContent = this.container.createEl('div', {
            cls: 'template-preview-content'
        });
        
        // Set up event listeners
        this.templateField.inputEl.addEventListener('input', this.updatePreview.bind(this));
        this.templateField.inputEl.addEventListener('blur', this.updatePreview.bind(this));
        
        // Initial render
        setTimeout(this.updatePreview.bind(this), 50);
    }

    /**
     * Update preview content with rendered template
     */
    private updatePreview(): void {
        try {
            const template = this.templateField.getValue();
            const rendered = TemplateEngine.render(template, this.sampleData, {
                sanitizeForCitekey: this.options.sanitizeForCitekey
            });
            
            this.previewContent.empty();
            this.previewContent.createEl('code', { text: rendered });
        } catch (error) {
            this.previewContent.empty();
            this.previewContent.createEl('span', { 
                text: `Error: ${error.message}`,
                cls: 'template-preview-error'
            });
        }
    }

    /**
     * Returns sample data for template preview
     */
    private getSampleData(): Record<string, any> {
        // Based on TemplateVariableBuilderService.buildVariables()
        const data = {
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
            attachments: ["[[biblib/smith_neural2024/paper.pdf|PDF]]"],
            attachment: "[[biblib/smith_neural2024/paper.pdf|PDF]]",
            quoted_attachments: ["\"[[biblib/smith_neural2024/paper.pdf|PDF]]\""],
            quoted_attachment: "\"[[biblib/smith_neural2024/paper.pdf|PDF]]\"",
            
            // Related notes
            links: ["[[Research/Climate Science/Overview]]", "[[Projects/ML Applications]]"],
            linkPaths: ["Research/Climate Science/Overview.md", "Projects/ML Applications.md"],
            links_string: "[[Research/Climate Science/Overview]], [[Projects/ML Applications]]"
        };
        
        // Show expanded sample data in the collapsible section
        const dataSummaryLines = [
            `citekey: "${data.citekey}"`,
            `title: "${data.title}"`,
            `authors: "${data.authors}"`,
            `type: ${data.type}`,
            `year: ${data.year}`,
            `pdflink: "${data.raw_pdflink}"`,
            `container-title: "${data["container-title"]}"`,
            `attachments: ${JSON.stringify(data.attachments)}`
        ];
        
        // Create summary string (we don't need to store it in data)
        
        return data;
    }
}