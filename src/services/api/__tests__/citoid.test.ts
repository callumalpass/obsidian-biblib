import { CitoidService } from '../citoid';
import { requestUrl } from 'obsidian';
import Cite from 'citation-js';

// Mock obsidian's requestUrl
jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
  Notice: jest.fn()
}));

// Mock citation-js
jest.mock('citation-js', () => ({
  __esModule: true,
  default: {
    async: jest.fn()
  }
}));

const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;
const mockCiteAsync = Cite.async as jest.MockedFunction<typeof Cite.async>;

// Helper to create mock responses with all required RequestUrlResponse properties
const mockResponse = (text: string, status = 200) => ({
  text,
  json: {},
  status,
  headers: {} as Record<string, string>,
  arrayBuffer: new ArrayBuffer(0)
});

describe('CitoidService', () => {
  let service: CitoidService;

  beforeEach(() => {
    service = new CitoidService();
    jest.clearAllMocks();
  });

  describe('fetchBibTeX', () => {
    const validBibTeX = `@article{smith2023,
  author = {Smith, John},
  title = {A Great Paper},
  year = {2023},
  journal = {Journal of Testing}
}`;

    it('should fetch BibTeX from Citoid API successfully', async () => {
      mockRequestUrl.mockResolvedValueOnce(mockResponse(validBibTeX));

      const result = await service.fetchBibTeX('10.1234/test.doi');

      expect(result).toBe(validBibTeX);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('10.1234%2Ftest.doi'),
        method: 'GET',
        headers: {
          'Accept': 'application/x-bibtex',
          'User-Agent': 'Obsidian-BibLib'
        }
      });
    });

    it('should trim whitespace from identifier', async () => {
      mockRequestUrl.mockResolvedValueOnce(mockResponse(validBibTeX));

      await service.fetchBibTeX('  10.1234/test.doi  ');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('10.1234%2Ftest.doi'),
        method: 'GET',
        headers: expect.any(Object)
      });
    });

    it('should try fallback endpoint when primary fails', async () => {
      // First call returns invalid response
      mockRequestUrl.mockResolvedValueOnce(mockResponse('Not valid BibTeX'));

      // Second call (fallback) returns valid BibTeX
      mockRequestUrl.mockResolvedValueOnce(mockResponse(validBibTeX));

      const result = await service.fetchBibTeX('10.1234/test.doi');

      expect(result).toBe(validBibTeX);
      expect(mockRequestUrl).toHaveBeenCalledTimes(2);
    });

    it('should fallback to citation-js when Citoid endpoints fail', async () => {
      // Both Citoid endpoints fail
      mockRequestUrl.mockResolvedValueOnce(mockResponse('Invalid'));
      mockRequestUrl.mockResolvedValueOnce(mockResponse('Also Invalid'));

      // citation-js fallback succeeds
      mockCiteAsync.mockResolvedValueOnce({
        format: jest.fn().mockReturnValue(validBibTeX)
      } as any);

      const result = await service.fetchBibTeX('10.1234/test.doi');

      expect(result).toBe(validBibTeX);
      expect(mockCiteAsync).toHaveBeenCalledWith('10.1234/test.doi');
    });

    it('should throw when all methods fail', async () => {
      // Both Citoid endpoints fail
      mockRequestUrl.mockResolvedValueOnce(mockResponse('Invalid'));
      mockRequestUrl.mockResolvedValueOnce(mockResponse('Also Invalid'));

      // citation-js also fails
      mockCiteAsync.mockResolvedValueOnce({
        format: jest.fn().mockReturnValue('Still Invalid')
      } as any);

      await expect(service.fetchBibTeX('10.1234/test.doi')).rejects.toThrow(
        'All BibTeX fetch methods failed'
      );
    });

    it('should throw when citation-js throws an error', async () => {
      // Both Citoid endpoints fail
      mockRequestUrl.mockResolvedValueOnce(mockResponse('Invalid'));
      mockRequestUrl.mockResolvedValueOnce(mockResponse('Also Invalid'));

      // citation-js throws error
      mockCiteAsync.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.fetchBibTeX('10.1234/test.doi')).rejects.toThrow(
        'All BibTeX fetch methods failed'
      );
    });

    it('should handle network errors from Citoid', async () => {
      // First Citoid endpoint throws
      mockRequestUrl.mockRejectedValueOnce(new Error('Network error'));

      // The service should still return the error since both endpoints might fail
      await expect(service.fetchBibTeX('10.1234/test.doi')).rejects.toThrow();
    });

    it('should handle URL identifiers', async () => {
      mockRequestUrl.mockResolvedValueOnce(mockResponse(validBibTeX));

      await service.fetchBibTeX('https://example.com/article');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('https%3A%2F%2Fexample.com%2Farticle'),
        method: 'GET',
        headers: expect.any(Object)
      });
    });

    it('should handle ISBN identifiers', async () => {
      mockRequestUrl.mockResolvedValueOnce(mockResponse(validBibTeX));

      await service.fetchBibTeX('978-0-13-468599-1');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('978-0-13-468599-1'),
        method: 'GET',
        headers: expect.any(Object)
      });
    });

    describe('BibTeX validation', () => {
      it('should accept BibTeX starting with @article', async () => {
        const articleBib = '@article{test, author = {Smith}}';
        mockRequestUrl.mockResolvedValueOnce(mockResponse(articleBib));

        const result = await service.fetchBibTeX('10.1234/test');
        expect(result).toBe(articleBib);
      });

      it('should accept BibTeX starting with @book', async () => {
        const bookBib = '@book{test, author = {Smith}}';
        mockRequestUrl.mockResolvedValueOnce(mockResponse(bookBib));

        const result = await service.fetchBibTeX('10.1234/test');
        expect(result).toBe(bookBib);
      });

      it('should accept BibTeX starting with @inproceedings', async () => {
        const procBib = '@inproceedings{test, author = {Smith}}';
        mockRequestUrl.mockResolvedValueOnce(mockResponse(procBib));

        const result = await service.fetchBibTeX('10.1234/test');
        expect(result).toBe(procBib);
      });

      it('should accept BibTeX with leading whitespace', async () => {
        const bibWithWhitespace = '  \n@article{test, author = {Smith}}';
        mockRequestUrl.mockResolvedValueOnce(mockResponse(bibWithWhitespace));

        // First call has whitespace before @, which fails validation
        // Should try fallback
        mockRequestUrl.mockResolvedValueOnce(mockResponse('@article{test, author = {Smith}}'));

        const result = await service.fetchBibTeX('10.1234/test');
        expect(result).toContain('@article');
      });
    });
  });
});
