import { TextAreaComponent, ButtonComponent, setIcon } from "obsidian";
import { TemplateEngine } from "../../utils/template-engine";

/**
 * Template mode for the playground
 */
enum TemplateMode {
    Normal = "normal",
    Citekey = "citekey", 
    Yaml = "yaml"
}

/**
 * Creates a template playground where users can experiment with template syntax
 * and see the rendered output in real-time
 */
export class TemplatePlaygroundComponent {
    private container: HTMLElement;
    private templateField: TextAreaComponent;
    private previewContent: HTMLElement;
    private sampleData: Record<string, any>;
    private currentMode: TemplateMode = TemplateMode.Normal;

    /**
     * Creates a new template playground component
     * 
     * @param containerEl - Parent element to attach playground to
     */
    constructor(containerEl: HTMLElement) {
        this.sampleData = this.getSampleData();
        this.initialize(containerEl);
    }

    /**
     * Initialize the playground component
     */
    private initialize(containerEl: HTMLElement): void {
        // Create main container
        this.container = containerEl.createDiv({
            cls: 'template-playground-container'
        });
        
        // Create description
        const descriptionEl = this.container.createEl('p', {
            text: 'Use this playground to experiment with template syntax and see the results in real-time.',
            cls: 'template-playground-description'
        });
        
        // Create template input container
        const inputContainer = this.container.createDiv({
            cls: 'template-playground-input-container'
        });
        
        // Create template input label
        inputContainer.createEl('label', {
            text: 'Template:',
            cls: 'template-playground-label'
        });
        
        // Create template input
        this.templateField = new TextAreaComponent(inputContainer);
        this.templateField
            .setPlaceholder('Enter a template to preview (e.g., {{title}} by {{authors}})')
            .setValue('# {{title}}\n\nBy: {{authors}}\n\nPublished in: {{container-title}} ({{year}})\n\n{{#abstract}}**Abstract**: {{abstract}}{{/abstract}}')
            .onChange(this.updatePreview.bind(this));
        
        this.templateField.inputEl.addClass('template-playground-textarea');
        
        // Create toolbar with examples and options
        const toolbarEl = this.container.createDiv({
            cls: 'template-playground-toolbar'
        });
        
        // Create mode selection dropdown container
        const modesContainer = toolbarEl.createDiv({
            cls: 'template-playground-modes'
        });
        
        modesContainer.createEl('span', {
            text: 'Template Mode:',
            cls: 'template-playground-toggle-label'
        });
        
        // Create select element for mode selection
        const modeSelect = modesContainer.createEl('select', {
            cls: 'template-playground-mode-select'
        });
        
        // Add mode options
        const modeOptions = [
            { value: TemplateMode.Normal, label: 'Normal' },
            { value: TemplateMode.Yaml, label: 'YAML' },
            { value: TemplateMode.Citekey, label: 'Citekey' }
        ];
        
        modeOptions.forEach(option => {
            const optionEl = modeSelect.createEl('option', {
                value: option.value,
                text: option.label
            });
            
            if (option.value === this.currentMode) {
                optionEl.selected = true;
            }
        });
        
        // Add change event listener
        modeSelect.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.currentMode = target.value as TemplateMode;
            this.updatePreview();
        });
        
        // Create examples dropdown
        const examplesContainer = toolbarEl.createDiv({
            cls: 'template-playground-examples'
        });
        
        examplesContainer.createEl('span', {
            text: 'Examples:',
            cls: 'template-playground-examples-label'
        });
        
        const examplesDropdown = examplesContainer.createEl('select', {
            cls: 'template-playground-examples-dropdown'
        });
        
        const examples = [
            { label: 'Select an example...', value: '' },
            
            // Headers
            { label: '-- Headers --', value: '' },
            { label: 'Basic header', value: '# {{title}}' },
            { label: 'Header with year', value: '# {{title}} ({{year}})' },
            { label: 'Header with linked PDF', value: '# {{#pdflink}}[[{{pdflink}}|{{title}}]]{{/pdflink}}{{^pdflink}}{{title}}{{/pdflink}}' },
            
            // Citations
            { label: '-- Citations --', value: '' },
            { label: 'APA-style citation', value: '{{authors}} ({{year}}). {{title}}. {{#container-title}}{{container-title}}, {{/container-title}}{{#volume}}{{volume}}{{#number}}({{number}}){{/number}}{{/volume}}{{#page}}, {{page}}{{/page}}.' },
            { label: 'MLA-style citation', value: '{{authors_family.0}}, {{authors_given.0}}. "{{title}}." {{container-title}}, vol. {{volume}}, no. {{issue}}, {{year}}, pp. {{page}}.' },
            { label: 'Chicago-style citation', value: '{{authors_family.0}}, {{authors_given.0}}. "{{title}}." {{container-title}} {{volume}}, no. {{issue}} ({{year}}): {{page}}. {{#DOI}}https://doi.org/{{DOI}}{{/DOI}}' },
            
            // Links and References
            { label: '-- Links and References --', value: '' },
            { label: 'PDF Link', value: '[[{{pdflink}}|{{title}} (PDF)]]' },
            { label: 'HTML Link', value: '[[{{htmllink}}|{{title}} (HTML)]]' },
            { label: 'All Attachments', value: '{{#attachments}}- {{.}}\n{{/attachments}}' },
            { label: 'Author List as Wiki Links', value: '{{#authors_family}}[[Author/{{.}}]]{{^@last}}, {{/@last}}{{/authors_family}}' },
            
            // Conditionals
            { label: '-- Conditionals --', value: '' },
            { label: 'Conditional Abstract', value: '{{#abstract}}**Abstract**: {{abstract}}{{/abstract}}{{^abstract}}No abstract available{{/abstract}}' },
            { label: 'Conditional Volume/Issue', value: '{{#volume}}Volume {{volume}}{{#issue}}, Issue {{issue}}{{/issue}}{{/volume}}{{^volume}}No volume information{{/volume}}' },
            { label: 'Smart Attachment Link', value: '{{#pdflink}}📄 [[{{pdflink}}|PDF]]{{/pdflink}} {{#htmllink}}🌐 [[{{htmllink}}|HTML]]{{/htmllink}}{{^pdflink}}{{^htmllink}}No attachments available{{/htmllink}}{{/pdflink}}' },
            
            // Citekeys
            { label: '-- Citekey Formats --', value: '' },
            { label: 'Author + Year', value: '{{authors_family.0|lowercase}}{{year}}' },
            { label: 'Author + Coauthor Initial + Year', value: '{{authors_family.0|lowercase}}{{#authors_family.1}}{{authors_family.1|abbr1}}{{/authors_family.1}}{{year}}' },
            { label: 'Author + Year + Title Word', value: '{{authors_family.0|lowercase}}{{year}}{{title|titleword}}' },
            
            // YAML-specific examples
            { label: '-- YAML & Arrays --', value: '' },
            { label: 'Array with trailing commas', value: '[{{#authors}}"[[Author/{{.}}]]",{{/authors}}]' },
            { label: 'Array with conditional commas', value: '[{{#authors_family}}{{^@first}},{{/@first}}"{{.}}"{{/authors_family}}]' },
            { label: 'Fixed values array', value: '["{{title}}", "{{authors}} ({{year}})", "{{citekey}}"]' },
            { label: 'Common mistake: No commas', value: '[{{#authors_family}}"{{.}}"{{/authors_family}}]' },
            { label: 'Not an array: Dashed list', value: '{{#authors}}- [[Author/{{.}}]]\n{{/authors}}' },
            
            // Complete Templates
            { label: '-- Complete Templates --', value: '' },
            { label: 'Academic Note', value: '# {{title}}\n\n**Authors**: {{authors}}\n**Year**: {{year}}\n**Journal**: {{container-title}}\n**DOI**: {{#DOI}}{{DOI}}{{/DOI}}{{^DOI}}N/A{{/DOI}}\n\n{{#abstract}}## Abstract\n\n{{abstract}}{{/abstract}}\n\n## Attachments\n{{#attachments}}- {{.}}\n{{/attachments}}{{^attachments}}- No attachments available{{/attachments}}\n\n## Key Points\n\n- \n\n## Notes\n\n' },
            { label: 'Book Note', value: '# {{title}}\n\n**Author**: {{authors}}\n**Year**: {{year}}\n**Publisher**: {{publisher}}{{#publisher-place}}, {{publisher-place}}{{/publisher-place}}\n**ISBN**: {{ISBN}}\n\n{{#abstract}}## Summary\n\n{{abstract}}{{/abstract}}\n\n## Key Ideas\n\n- \n\n## Quotes\n\n> \n\n## Personal Reflections\n\n' },
            { label: 'Compact Reference', value: '---\nauthors: {{authors}}\nyear: {{year}}\ntitle: {{title}}\nsource: {{container-title}}\ndoi: {{DOI}}\ntags: [literature, {{type}}]\n---\n\n# {{title}}\n\n*{{authors}} ({{year}})*\n\n{{#abstract}}{{abstract}}{{/abstract}}\n\n## Highlights\n\n- ' }
        ];
        
        examples.forEach(example => {
            const option = examplesDropdown.createEl('option', {
                value: example.value,
                text: example.label
            });
            
            // Disable section headers and first placeholder
            if (example.value === '') {
                option.disabled = true;
                
                // Apply CSS classes instead of inline styles
                if (example.label.startsWith('--')) {
                    option.addClass('dropdown-section-header');
                } else {
                    // This is the initial placeholder
                    option.selected = true;
                }
            }
        });
        
        examplesDropdown.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            if (target.value) {
                this.templateField.setValue(target.value);
                this.updatePreview();
                // Reset dropdown to placeholder
                target.selectedIndex = 0;
            }
        });
        
        // Create preview container
        const previewContainerEl = this.container.createDiv({
            cls: 'template-playground-preview-container'
        });
        
        // Preview header
        const previewHeaderEl = previewContainerEl.createDiv({
            cls: 'template-playground-preview-header'
        });
        
        previewHeaderEl.createEl('span', {
            text: 'Preview:',
            cls: 'template-playground-preview-label'
        });
        
        // Data summary (collapsible)
        const dataSummaryEl = previewHeaderEl.createDiv({
            cls: 'template-playground-sample-data'
        });
        
        dataSummaryEl.createEl('details', {}, details => {
            details.createEl('summary', { text: 'Sample data (click to expand)' });
            const dataContainer = details.createEl('div', { cls: 'template-playground-data-container' });
            
            // Create tabbed interface for different data categories
            const tabContainer = dataContainer.createEl('div', { cls: 'template-playground-tabs' });
            const tabContent = dataContainer.createEl('div', { cls: 'template-playground-tab-content' });
            
            // Define tabs
            const tabs = [
                { id: 'basic', label: 'Basic', active: true },
                { id: 'authors', label: 'Authors' },
                { id: 'publishing', label: 'Publishing' },
                { id: 'attachments', label: 'Attachments' },
                { id: 'misc', label: 'Other' }
            ];
            
            // Create tab buttons
            tabs.forEach(tab => {
                const tabButton = tabContainer.createEl('button', {
                    text: tab.label,
                    cls: tab.active ? 'tab-button active' : 'tab-button',
                    attr: { 'data-tab': tab.id }
                });
                
                tabButton.addEventListener('click', () => {
                    // Use dataset to find the tab content
                    const tabId = tabButton.dataset.tab;
                    
                    // Remove active class from all tabs
                    tabContainer.querySelectorAll('.tab-button').forEach(btn => {
                        btn.removeClass('active');
                    });
                    
                    // Remove active class from all content panes
                    tabContent.querySelectorAll('.tab-pane').forEach(pane => {
                        pane.removeClass('active');
                    });
                    
                    // Activate current tab
                    tabButton.addClass('active');
                    tabContent.querySelector(`#${tabId}-tab`)?.addClass('active');
                });
            });
            
            // Create content for each tab
            const basicTab = tabContent.createEl('div', {
                cls: 'tab-pane active',
                attr: { id: 'basic-tab' }
            });
            
            basicTab.createEl('code', {
                text: `id: "${this.sampleData.id}"\n` +
                      `citekey: "${this.sampleData.citekey}"\n` +
                      `title: "${this.sampleData.title}"\n` +
                      `type: "${this.sampleData.type}"\n` + 
                      `year: ${this.sampleData.year}\n` +
                      `month: ${this.sampleData.month}\n` +
                      `day: ${this.sampleData.day}\n` +
                      `currentDate: "${this.sampleData.currentDate}"\n` +
                      `abstract: "${this.sampleData.abstract?.substring(0, 50)}..."`
            });
            
            const authorsTab = tabContent.createEl('div', {
                cls: 'tab-pane',
                attr: { id: 'authors-tab' }
            });
            
            authorsTab.createEl('code', {
                text: `authors: "${this.sampleData.authors}"\n` +
                      `authors_family: ${JSON.stringify(this.sampleData.authors_family)}\n` +
                      `authors_given: ${JSON.stringify(this.sampleData.authors_given)}\n` +
                      `editors: ${JSON.stringify(this.sampleData.editors)}\n` +
                      `editors_family: ${JSON.stringify(this.sampleData.editors_family)}\n` +
                      `editors_given: ${JSON.stringify(this.sampleData.editors_given)}`
            });
            
            const publishingTab = tabContent.createEl('div', {
                cls: 'tab-pane',
                attr: { id: 'publishing-tab' }
            });
            
            publishingTab.createEl('code', {
                text: `container-title: "${this.sampleData["container-title"]}"\n` +
                      `volume: ${this.sampleData.volume}\n` +
                      `issue: ${this.sampleData.issue}\n` +
                      `page: "${this.sampleData.page}"\n` +
                      `publisher: "${this.sampleData.publisher}"\n` +
                      `publisher-place: "${this.sampleData["publisher-place"]}"\n` +
                      `DOI: "${this.sampleData.DOI}"\n` +
                      `URL: "${this.sampleData.URL}"`
            });
            
            const attachmentsTab = tabContent.createEl('div', {
                cls: 'tab-pane',
                attr: { id: 'attachments-tab' }
            });
            
            attachmentsTab.createEl('code', {
                text: `pdflink: "${this.sampleData.raw_pdflink}"\n` +
                      `htmllink: "${this.sampleData.htmllink}"\n` +
                      `attachments: ${JSON.stringify(this.sampleData.attachments, null, 2)}\n` +
                      `quoted_attachments: ${JSON.stringify(this.sampleData.quoted_attachments, null, 2)}`
            });
            
            const miscTab = tabContent.createEl('div', {
                cls: 'tab-pane',
                attr: { id: 'misc-tab' }
            });
            
            miscTab.createEl('code', {
                text: `language: "${this.sampleData.language}"\n` +
                      `links: ${JSON.stringify(this.sampleData.links, null, 2)}\n` +
                      `linkPaths: ${JSON.stringify(this.sampleData.linkPaths, null, 2)}\n` +
                      `links_string: "${this.sampleData.links_string}"`
            });
        });
        
        // Preview content
        this.previewContent = previewContainerEl.createEl('div', {
            cls: 'template-playground-preview-content'
        });
        
        // Initial render
        setTimeout(this.updatePreview.bind(this), 50);
    }
    
    /**
     * Update preview content with rendered template
     */
    private updatePreview(): void {
        try {
            const template = this.templateField.getValue();
            
            switch (this.currentMode) {
                case TemplateMode.Yaml:
                    // In YAML mode, show how arrays are handled in frontmatter
                    this.renderYamlPreview(template);
                    break;
                    
                case TemplateMode.Citekey:
                    // In Citekey mode, render with citekey sanitization
                    const citekeyRendered = TemplateEngine.render(template, this.sampleData, {
                        sanitizeForCitekey: true
                    });
                    
                    this.previewContent.empty();
                    this.previewContent.createEl('div', { 
                        cls: 'template-playground-rendered citekey-rendering',
                        text: citekeyRendered 
                    });
                    break;
                    
                case TemplateMode.Normal:
                default:
                    // Standard rendering with no special options
                    const rendered = TemplateEngine.render(template, this.sampleData);
                    
                    this.previewContent.empty();
                    this.previewContent.createEl('div', { 
                        cls: 'template-playground-rendered',
                        text: rendered 
                    });
                    break;
            }
        } catch (error) {
            this.previewContent.empty();
            this.previewContent.createEl('div', { 
                text: `Error: ${error.message}`,
                cls: 'template-playground-error'
            });
        }
    }
    
    
    /**
     * Renders a preview of how a template would be handled in YAML frontmatter
     * in the context of BibLib
     */
    private renderYamlPreview(template: string): void {
        try {
            // First render the template normally
            const rendered = TemplateEngine.render(template, this.sampleData);
            
            this.previewContent.empty();
            
            // Create a container for showing both standard and YAML representations
            const previewContainer = this.previewContent.createDiv({
                cls: 'yaml-preview-container'
            });
            
            // Standard rendering
            const standardSection = previewContainer.createDiv({
                cls: 'yaml-preview-section'
            });
            
            standardSection.createEl('h4', {
                text: 'Template renders as:',
                cls: 'yaml-preview-heading'
            });
            
            standardSection.createEl('div', { 
                cls: 'template-playground-rendered standard-rendering',
                text: rendered 
            });
            
            // YAML representation
            const yamlSection = previewContainer.createDiv({
                cls: 'yaml-preview-section'
            });
            
            yamlSection.createEl('h4', {
                text: 'In YAML frontmatter:',
                cls: 'yaml-preview-heading'
            });
            
            // Create sample frontmatter with rendered value
            let yamlRepresentation: string;
            let yamlBehaviorExplanation: string;
            
            // Check for patterns that would be interpreted differently in YAML
            
            // Case 1: JSON Array format with square brackets
            if (rendered.trim().startsWith('[') && rendered.trim().endsWith(']')) {
                try {
                    // Attempt to parse as JSON to see if it's valid
                    JSON.parse(rendered.trim());
                    
                    // It's a valid JSON array, which Obsidian will interpret as an array in YAML
                    yamlRepresentation = `---\nfield: ${rendered.trim()}\n---`;
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
            
            // Create yaml preview
            const yamlPreviewEl = yamlSection.createEl('pre', {
                cls: 'yaml-preview-code'
            });
            
            yamlPreviewEl.createEl('code', {
                text: yamlRepresentation
            });
            
            // Add explanation of how Obsidian's YAML treats the value
            const explanationEl = previewContainer.createDiv({
                cls: 'yaml-preview-explanation'
            });
            
            explanationEl.createEl('p', { text: yamlBehaviorExplanation });
            
            // Add a focused guide about BibLib's array handling
            const biblibNoteEl = previewContainer.createDiv({
                cls: 'yaml-preview-biblib-note'
            });
            
            biblibNoteEl.createEl('h4', {
                text: 'Creating Arrays in BibLib:'
            });

            // Create the explanation
            const guideContainer = biblibNoteEl.createEl('div', { cls: 'yaml-guide-container' });
            
            guideContainer.createEl('p', { 
                text: 'To create arrays in BibLib templates, use the JSON array format with square brackets, commas, and quotes:',
                cls: 'biblib-array-explanation'
            });
            
            // JSON Array Example
            const jsonExampleContainer = guideContainer.createEl('div', { cls: 'yaml-example-container' });
            
            jsonExampleContainer.createEl('p', { text: 'Working array template:' });
            jsonExampleContainer.createEl('pre', {}, pre => {
                pre.createEl('code', { 
                    text: '[{{#authors}}"[[Author/{{.}}]]",{{/authors}}]'
                });
            });
            
            jsonExampleContainer.createEl('p', { text: 'Renders correctly in frontmatter:' });
            jsonExampleContainer.createEl('pre', {}, pre => {
                pre.createEl('code', { 
                    text: 'author-links: ["[[Author/Smith]]","[[Author/Rodriguez]]","[[Author/Zhang]]"]'
                });
            });
            
            // Common mistake
            guideContainer.createEl('h5', { text: 'Common Mistake:', cls: 'yaml-method-heading' });
            
            const mistakeContainer = guideContainer.createEl('div', { cls: 'yaml-example-container' });
            
            mistakeContainer.createEl('p', { text: 'Using dash prefixes will NOT automatically create arrays:' });
            mistakeContainer.createEl('pre', {}, pre => {
                pre.createEl('code', { 
                    text: '{{#authors}}- [[Author/{{.}}]]\n{{/authors}}'
                });
            });
            
            mistakeContainer.createEl('p', { text: 'This renders as multi-line text, not an array:' });
            mistakeContainer.createEl('pre', {}, pre => {
                pre.createEl('code', { 
                    text: 'author-links: |\n  - [[Author/Smith]]\n  - [[Author/Rodriguez]]\n  - [[Author/Zhang]]'
                });
            });
        } catch (error) {
            this.previewContent.empty();
            this.previewContent.createEl('div', { 
                text: `Error: ${error.message}`,
                cls: 'template-playground-error'
            });
        }
    }
    
    /**
     * Returns sample data for template preview
     */
    private getSampleData(): Record<string, any> {
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
}