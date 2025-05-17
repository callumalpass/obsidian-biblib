import { TextAreaComponent, ButtonComponent, setIcon } from "obsidian";
import { TemplateEngine } from "../../utils/template-engine";
import { analyzeYamlTemplateOutput } from "../../utils/yaml-utils";
import { SampleDataGenerator } from "../../utils/sample-data-generator";

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
        this.sampleData = SampleDataGenerator.getSampleData();
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
            text: 'Template mode:',
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
            { label: 'Header with emoji prefix', value: '# 📝 {{title}} ({{year}})' },
            { label: 'Header with type icon', value: '# {{#type}}{{#==="article-journal"}}📰{{/==="article-journal"}}{{#==="book"}}📚{{/==="book"}}{{#==="chapter"}}📑{{/==="chapter"}}{{#==="webpage"}}🌐{{/==="webpage"}}{{/type}} {{title}}' },
            
            // Citations
            { label: '-- Citations --', value: '' },
            { label: 'APA-style citation', value: '{{authors}} ({{year}}). {{title}}. {{#container-title}}{{container-title}}, {{/container-title}}{{#volume}}{{volume}}{{#number}}({{number}}){{/number}}{{/volume}}{{#page}}, {{page}}{{/page}}.' },
            { label: 'MLA-style citation', value: '{{authors_family.0}}, {{authors_given.0}}. "{{title}}." {{container-title}}, vol. {{volume}}, no. {{issue}}, {{year}}, pp. {{page}}.' },
            { label: 'Chicago-style citation', value: '{{authors_family.0}}, {{authors_given.0}}. "{{title}}." {{container-title}} {{volume}}, no. {{issue}} ({{year}}): {{page}}. {{#DOI}}https://doi.org/{{DOI}}{{/DOI}}' },
            { label: 'Harvard-style citation', value: '{{authors_family.0}}, {{authors_given.0|abbr1}}. {{#authors_family.1}}and {{authors_family.1}}, {{authors_given.1|abbr1}}. {{/authors_family.1}}({{year}}) "{{title}}", {{container-title}}, {{volume}}({{issue}}), pp. {{page}}.' },
            { label: 'Vancouver-style citation', value: '{{authors_family.0}} {{authors_given.0|abbr1}}{{#authors_family.1}}, {{authors_family.1}} {{authors_given.1|abbr1}}{{/authors_family.1}}{{#authors_family.2}}, et al.{{/authors_family.2}} {{title}}. {{container-title}}. {{year}};{{volume}}({{issue}}):{{page}}.' },
            
            // Links and References
            { label: '-- Links and References --', value: '' },
            { label: 'PDF Link', value: '[[{{pdflink}}|{{title}} (PDF)]]' },
            { label: 'HTML Link', value: '[[{{htmllink}}|{{title}} (HTML)]]' },
            { label: 'All Attachments', value: '{{#attachments}}- {{.}}\n{{/attachments}}' },
            { label: 'Author List as Wiki Links', value: '{{#authors_family}}[[Author/{{.}}]]{{^@last}}, {{/@last}}{{/authors_family}}' },
            { label: 'Numbered References List', value: '{{#attachments}}{{@number}}. {{.}}\n{{/attachments}}' },
            { label: 'DOI with Hover Link', value: '[{{DOI}}](https://doi.org/{{DOI}} "Click to open DOI")' },
            { label: 'Publisher Info Link', value: '{{#publisher}}🏢 [{{publisher}}](https://www.google.com/search?q={{publisher|lowercase}}){{/publisher}}' },
            
            // Conditionals
            { label: '-- Conditionals --', value: '' },
            { label: 'Conditional Abstract', value: '{{#abstract}}**Abstract**: {{abstract}}{{/abstract}}{{^abstract}}No abstract available{{/abstract}}' },
            { label: 'Conditional Volume/Issue', value: '{{#volume}}Volume {{volume}}{{#issue}}, Issue {{issue}}{{/issue}}{{/volume}}{{^volume}}No volume information{{/volume}}' },
            { label: 'Smart Attachment Link', value: '{{#pdflink}}📄 [[{{pdflink}}|PDF]]{{/pdflink}} {{#htmllink}}🌐 [[{{htmllink}}|HTML]]{{/htmllink}}{{^pdflink}}{{^htmllink}}No attachments available{{/htmllink}}{{/pdflink}}' },
            { label: 'Publication Type Badge', value: '{{#type}}{{#==="article-journal"}}*Article*{{/==="article-journal"}}{{#==="book"}}*Book*{{/==="book"}}{{#==="chapter"}}*Book Chapter*{{/==="chapter"}}{{#==="webpage"}}*Web Page*{{/==="webpage"}}{{/type}}' },
            { label: 'Different by Author Count', value: '{{#authors_family.2}}Multiple authors ({{authors}}){{/authors_family.2}}{{^authors_family.2}}{{#authors_family.1}}Two authors ({{authors}}){{/authors_family.1}}{{^authors_family.1}}Single author ({{authors}}){{/authors_family.1}}{{/authors_family.2}}' },
            
            // Text Formatting
            { label: '-- Text Formatting --', value: '' },
            { label: 'Title with capitalization', value: '{{title|capitalize}}' },
            { label: 'Text in all uppercase', value: '{{title|uppercase}}' },
            { label: 'Text in all lowercase', value: '{{title|lowercase}}' },
            { label: 'Title case styling', value: '{{title|title}}' },
            { label: 'Sentence case', value: '{{title|sentence}}' },
            { label: 'Abstract truncated', value: '{{abstract|truncate:150}}' },
            { label: 'Abstract with ellipsis', value: '{{abstract|ellipsis:150}}' },
            { label: 'Trim whitespace', value: '{{title|trim}}' },
            { label: 'Add prefix', value: '{{title|prefix:PAPER: }}' },
            { label: 'Add suffix', value: '{{title|suffix: [READ THIS]}}' },
            { label: 'Replace text', value: '{{abstract|replace:neural:AI}}' },
            { label: 'Slice string', value: '{{title|slice:0:10}}...' },
            { label: 'Pad with zeros', value: '{{month|pad:2:0}}/{{day|pad:2:0}}/{{year}}' },
            { label: 'First letter only', value: '{{authors_given.0|abbr1}}. {{authors_family.0}}' },
            { label: 'Multiple formats combined', value: '{{title|uppercase|truncate:20}}' },
            { label: 'Name initials', value: '{{#authors_given}}{{.|abbr1}}.{{/authors_given}}' },
            
            // Date Formatting
            { label: '-- Date Formatting --', value: '' },
            { label: 'ISO date format', value: '{{issued|date:iso}}' },
            { label: 'Short date format', value: '{{issued|date:short}}' },
            { label: 'Long date format', value: '{{issued|date:long}}' },
            { label: 'Year only', value: '{{issued|date:year}}' },
            { label: 'Month/day/year', value: '{{month|number|pad:2:0}}/{{day|number|pad:2:0}}/{{year}}' },
            { label: 'Current date', value: '{{currentDate}}' },
            
            // Number Formatting
            { label: '-- Number Formatting --', value: '' },
            { label: 'Format as number', value: '{{volume|number}}' },
            { label: 'Number with decimals', value: '{{volume|number:2}}' },
            { label: 'Count items in array', value: 'Author count: {{authors_family|count}}' },
            
            // URL and Collection Handling
            { label: '-- URL and Collections --', value: '' },
            { label: 'URL encode', value: '{{title|urlencode}}' },
            { label: 'Join array with delimiter', value: '{{authors_family|join: and }}' },
            { label: 'Split string', value: '{{page|split:-}}' },
            { label: 'Convert to JSON', value: '{{authors_raw|json}}' },
            
            // Citekeys
            { label: '-- Citekey Formats --', value: '' },
            { label: 'Author + year', value: '{{authors_family.0|lowercase}}{{year}}' },
            { label: 'Author + coauthor initial + year', value: '{{authors_family.0|lowercase}}{{#authors_family.1}}{{authors_family.1|abbr1}}{{/authors_family.1}}{{year}}' },
            { label: 'Author + year + title word', value: '{{authors_family.0|lowercase}}{{year}}{{title|titleword}}' },
            { label: 'First 3 letters + year', value: '{{authors_family.0|abbr3}}{{year}}' },
            { label: 'All initials + year', value: '{{#authors_family}}{{.|abbr1}}{{/authors_family}}{{year}}' },
            { label: 'Author underscore year', value: '{{authors_family.0|lowercase}}_{{year}}' },
            { label: 'Random string + year', value: '{{year}}_{{rand|5}}' },
            
            // Frontmatter-specific examples
            { label: '-- Frontmatter & Arrays --', value: '' },
            { label: 'Array with trailing commas', value: '[{{#authors}}"[[Author/{{.}}]]",{{/authors}}]' },
            { label: 'Array with conditional commas', value: '[{{#authors_family}}{{^@first}},{{/@first}}"{{.}}"{{/authors_family}}]' },
            { label: 'Fixed values array', value: '["{{title}}", "{{authors}} ({{year}})", "{{citekey}}"]' },
            { label: 'Common mistake: No commas', value: '[{{#authors_family}}"{{.}}"{{/authors_family}}]' },
            { label: 'Not an array: Dashed list', value: '{{#authors}}- [[Author/{{.}}]]\n{{/authors}}' },
            { label: 'Keywords as tags', value: '[{{#keywords}}{{^@first}},{{/@first}}"#{{.|lowercase}}"{{/keywords}}]' },
            { label: 'Related concepts', value: '[{{#title|titleword}}"[[Concept/{{.|capitalize}}]]",{{/title|titleword}}{{#keywords}}{{^@first}},{{/@first}}"[[Concept/{{.|capitalize}}]]"{{/keywords}}]' },
            
            // Callouts and Admonitions
            { label: '-- Callouts and Admonitions --', value: '' },
            { label: 'Abstract Callout', value: '> [!abstract] Abstract\n> {{abstract}}' },
            { label: 'Quote Callout', value: '> [!quote] Quote\n> {{title}} ({{authors}}, {{year}})' },
            { label: 'Info Callout', value: '> [!info] Metadata\n> **Authors**: {{authors}}\n> **Year**: {{year}}\n> **Source**: {{container-title}}' },
            { label: 'Warning Callout', value: '> [!warning] Important\n> This citation has {{#DOI}}a DOI but {{/DOI}}{{^DOI}}no DOI, {{/DOI}}verify details before use.' },
            { label: 'Multi-section Callouts', value: '> [!note] Publication\n> {{container-title}} ({{year}})\n\n> [!example] Citation\n> {{authors_family.0}} et al. ({{year}}). {{title}}.\n\n> [!tip] Related Topics\n> - Topic 1\n> - Topic 2' },
            
            // Advanced Formatter Usage
            { label: '-- Advanced Formatter Examples --', value: '' },
            { label: 'Citation with URL link', value: '{{authors}} ({{year}}). [{{title|sentence}}]({{#DOI}}https://doi.org/{{DOI}}{{/DOI}}{{^DOI}}{{URL}}{{/DOI}}) *{{container-title|sentence}}*, {{volume}}({{issue}}), {{page}}.' },
            { label: 'Formatted date string', value: 'Published on {{day|pad:2:0}}/{{month|pad:2:0}}/{{year}} ({{issued|date:long}})' },
            { label: 'Smart DOI link', value: '{{#DOI}}[Direct Link]({{DOI|prefix:https://doi.org/}} "Click to view publication"){{/DOI}}{{^DOI}}No DOI available{{/DOI}}' },
            { label: 'Generate unique identifier', value: '{{citekey}}-{{rand|8}}' },
            { label: 'Search-friendly tags', value: '#paper #{{year}} {{#keywords}}#{{.|lowercase|replace: :_}}{{/keywords}}' },
            { label: 'Combined text operations', value: '{{abstract|truncate:100|replace:neural:AI|suffix:... [read more]}}' },
            
            // Complete Templates
            { label: '-- Complete Templates --', value: '' },
            { label: 'Academic note', value: '# {{title}}\n\n**Authors**: {{authors}}\n**Year**: {{year}}\n**Journal**: {{container-title}}\n**DOI**: {{#DOI}}{{DOI}}{{/DOI}}{{^DOI}}N/A{{/DOI}}\n\n{{#abstract}}## Abstract\n\n{{abstract}}{{/abstract}}\n\n## Attachments\n{{#attachments}}- {{.}}\n{{/attachments}}{{^attachments}}- No attachments available{{/attachments}}\n\n## Key Points\n\n- \n\n## Notes\n\n' },
            { label: 'Book note', value: '# {{title}}\n\n**Author**: {{authors}}\n**Year**: {{year}}\n**Publisher**: {{publisher}}{{#publisher-place}}, {{publisher-place}}{{/publisher-place}}\n**ISBN**: {{ISBN}}\n\n{{#abstract}}## Summary\n\n{{abstract}}{{/abstract}}\n\n## Key Ideas\n\n- \n\n## Quotes\n\n> \n\n## Personal Reflections\n\n' },
            { label: 'Compact reference', value: '---\nauthors: {{authors}}\nyear: {{year}}\ntitle: {{title}}\nsource: {{container-title}}\ndoi: {{DOI}}\ntags: [literature, {{type}}]\n---\n\n# {{title}}\n\n*{{authors}} ({{year}})*\n\n{{#abstract}}{{abstract|ellipsis:300}}{{/abstract}}\n\n## Highlights\n\n- ' },
            { label: 'Zettelkasten note', value: '# {{citekey}}: {{title|capitalize}}\n\n## Summary\n\n{{#abstract}}{{abstract}}{{/abstract}}{{^abstract}}*No abstract available*{{/abstract}}\n\n## Concepts\n\n## Notes\n\n- \n\n## Connections and Links\n{{#DOI}}- DOI: [{{DOI}}](https://doi.org/{{DOI}})\n{{/DOI}}{{#URL}}- URL: [Link]({{URL}})\n{{/URL}}{{#attachments}}- {{.}}\n{{/attachments}}\n\n**Citation**: {{authors}} ({{year}}). {{title}}. {{container-title}}.' },
            { label: 'Literature review entry', value: '# {{title}}\n\n> [!info] Metadata\n> - **Authors**: {{authors}}\n> - **Year**: {{year}}\n> - **Journal**: {{container-title}}\n> - **DOI**: {{#DOI}}[{{DOI}}](https://doi.org/{{DOI}}){{/DOI}}{{^DOI}}N/A{{/DOI}}\n\n> [!abstract] Abstract\n> {{abstract}}\n\n## Research Question\n\n## Methodology\n\n## Key Findings\n\n## Limitations\n\n## Application to My Research\n\n## References\n{{#attachments}}- {{.}}\n{{/attachments}}' },
            { label: 'Cornell notes style', value: '# {{title}} ({{year}})\n\n> [!info] Metadata\n> **Authors**: {{authors}}\n> **Publication**: {{container-title}}\n\n## Cues/Questions\n- \n- \n- \n\n## Notes\n\n\n\n## Summary\n\n' },
            { label: 'Scientific paper analysis', value: '# {{title}}\n\n**Citation**: {{authors}} ({{year}}). {{title}}. *{{container-title}}*. {{#DOI}}https://doi.org/{{DOI}}{{/DOI}}\n\n## IMRAD Structure\n\n### Introduction\n*What problem is being addressed?*\n\n\n### Methods\n*How did they study the problem?*\n\n\n### Results\n*What did they find?*\n\n\n### Discussion\n*What do the results mean?*\n\n\n## Evaluation\n\n### Strengths\n- \n\n### Limitations\n- \n\n### Future Research\n- \n\n## Personal Notes\n\n'}
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
        // Map the internal enum to the format expected by the sample data generator
        let dataMode: 'normal' | 'citekey' | 'frontmatter' = 'normal';
        
        switch (mode) {
            case TemplateMode.Frontmatter:
                dataMode = 'frontmatter';
                break;
            case TemplateMode.Citekey:
                dataMode = 'citekey';
                break;
            case TemplateMode.Normal:
            default:
                dataMode = 'normal';
                break;
        }
        
        // Use the shared utility to get mode-specific sample data
        return SampleDataGenerator.getModeSpecificSampleData(dataMode, this.sampleData);
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
            
            // Use our shared utility to analyze the YAML output
            const analysis = analyzeYamlTemplateOutput(template, rendered);
            const { yamlRepresentation, yamlBehaviorExplanation } = analysis;
            
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
    
}
