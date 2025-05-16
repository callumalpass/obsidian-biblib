import { TextAreaComponent, ButtonComponent, setIcon } from "obsidian";
import { TemplateEngine } from "../../utils/template-engine";

/**
 * Template mode for the playground
 */
enum TemplateMode {
    Normal = "normal",
    Citekey = "citekey", 
    Frontmatter = "frontmatter" // Renamed from Yaml to Frontmatter
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
            { value: TemplateMode.Frontmatter, label: 'Frontmatter' },
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
            
            // Frontmatter-specific examples
            { label: '-- Frontmatter & Arrays --', value: '' },
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
            
            // Create appropriate sample data based on mode
            const modeSpecificData = this.getModeSpecificSampleData(this.currentMode);
            
            switch (this.currentMode) {
                case TemplateMode.Frontmatter:
                    // In Frontmatter mode, show how templates are handled in frontmatter
                    this.renderFrontmatterPreview(template, modeSpecificData);
                    break;
                    
                case TemplateMode.Citekey:
                    // In Citekey mode, render with citekey sanitization
                    const citekeyRendered = TemplateEngine.render(template, modeSpecificData, {
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
                    const rendered = TemplateEngine.render(template, modeSpecificData);
                    
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
     * Get mode-specific sample data to better emulate how each part of the 
     * system processes templates
     */
    private getModeSpecificSampleData(mode: TemplateMode): Record<string, any> {
        // Start with the base sample data
        const baseData = this.sampleData;
        
        // Clone the data to avoid modifying the original
        // Make a deep copy for nested properties
        const data = JSON.parse(JSON.stringify(baseData));
        
        if (mode === TemplateMode.Frontmatter) {
            // In Frontmatter mode, we want full arrays for authors - don't use the formatted string
            // which helps with array template formatting
            
            // Ensure the actual raw values are used, not the formatted versions
            // This better emulates how the frontmatter builder processes arrays
            
            // 1. Fix authors variable to use full names instead of the formatted "J. Smith et al."
            data.authors = baseData.authors_family.map((family: string, i: number) => {
                const given = baseData.authors_given[i];
                if (given) return `${given} ${family}`;
                return family;
            });
            
            // 2. Ensure other special variables are properly structured for templating
            
            // The authors_raw array with role property is what's used in the loop
            if (!data.authors_raw) {
                data.authors_raw = baseData.author.map((author: any) => {
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
        
        return data;
    }
    
    
    /**
     * Renders a preview of how a template would be handled in frontmatter
     * in the context of BibLib
     */
    private renderFrontmatterPreview(template: string, data: Record<string, any>): void {
        try {
            // Check if this is potentially an array template
            const isArrayTemplate = template.trim().startsWith('[') && template.trim().endsWith(']');
            
            // Render the template with appropriate options
            const rendered = TemplateEngine.render(template, data, {
                yamlArray: isArrayTemplate
            });
            
            this.previewContent.empty();
            
            // First, add the frontmatter preview section (similar to normal/citekey modes)
            const previewEl = this.previewContent.createDiv({
                cls: 'template-playground-rendered'
            });
            
            // Add the YAML/frontmatter representation
            previewEl.createEl('pre', {
                cls: 'frontmatter-preview-code'
            }).createEl('code', {
                text: `---\nfield: ${template.trim()}\n---\n`
            });
            
            // Then, add explanation section below
            const explanationContainer = this.previewContent.createDiv({
                cls: 'yaml-preview-container'
            });
            
            // Add heading for explanation section
            explanationContainer.createEl('h4', {
                text: 'How frontmatter handles this template:',
                cls: 'yaml-preview-heading'
            });
            
            // Create sample frontmatter with rendered value
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
            
            // Update the preview with the actual rendered frontmatter
            const previewCode = previewEl.querySelector('code');
            if (previewCode) {
                previewCode.textContent = yamlRepresentation;
            }
            
            // Add explanation to the explanation container
            const explanationEl = explanationContainer.createEl('div', {
                cls: 'yaml-preview-explanation'
            });
            
            explanationEl.createEl('p', { text: yamlBehaviorExplanation });
            
            // Add a focused guide about BibLib's array handling
            const biblibNoteEl = explanationContainer.createEl('div', {
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
            
            // We removed the redundant "actual processing" section since it's
            // already shown in the YAML preview above
            
            jsonExampleContainer.createEl('p', { text: 'Renders correctly in frontmatter:' });
            jsonExampleContainer.createEl('pre', {}, pre => {
                pre.createEl('code', { 
                    text: 'author-links: ["[[Author/John Smith]]","[[Author/Maria Rodriguez]]","[[Author/Wei Zhang]]"]'
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
                    text: 'author-links: |\n  - [[Author/John Smith]]\n  - [[Author/Maria Rodriguez]]\n  - [[Author/Wei Zhang]]'
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