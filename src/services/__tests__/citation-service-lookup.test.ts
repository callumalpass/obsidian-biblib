import { CitationService } from '../citation-service';
import { CitoidService } from '../api/citoid';

// Citoid returns BibTeX keyed with its own label, as the Zotero translation server does
const CITOID_BIBTEX = '@article{smith_deep_2020, title={Deep Things}, author={Smith, Jo}, year={2020}, journal={J}}';

describe('CitationService.fetchNormalized citekeys', () => {
    beforeEach(() => {
        jest.spyOn(CitoidService.prototype, 'fetchBibTeX').mockResolvedValue(CITOID_BIBTEX);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('applies the citekey template instead of the Citoid label', async () => {
        const service = new CitationService({
            citekeyTemplate: '{{authors_family.0|lowercase}}{{year}}',
            useZoteroKeys: false,
            minCitekeyLength: 3
        });

        const entry = await service.fetchNormalized('10.1234/example');

        expect(entry.id).toBe('smith2020');
        expect(entry).not.toHaveProperty('citation-key');
    });

    it('keeps the Citoid label when "Use Zotero keys" is on', async () => {
        const service = new CitationService({
            citekeyTemplate: '{{authors_family.0|lowercase}}{{year}}',
            useZoteroKeys: true,
            minCitekeyLength: 3
        });

        const entry = await service.fetchNormalized('10.1234/example');

        expect(entry.id).toBe('smith_deep_2020');
    });
});
