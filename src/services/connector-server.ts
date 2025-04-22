import { TAbstractFile, TFile, Notice, request, requestUrl } from 'obsidian';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import * as url from 'url';
import * as crypto from 'crypto';
import * as os from 'os';
import { promisify } from 'util';
import { BibliographyPluginSettings } from '../types/settings';

const pipeline = promisify(stream.pipeline);

/**
 * A server that intercepts Zotero Connector requests
 */
export class ConnectorServer {
    private server: http.Server | null = null;
    private settings: BibliographyPluginSettings;
    private tempDir: string;
    
    constructor(settings: BibliographyPluginSettings) {
        this.settings = settings;
        this.tempDir = settings.tempPdfPath || path.join(os.tmpdir(), 'obsidian-bibliography');
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    /**
     * Start the server on the configured port
     */
    public async start(): Promise<void> {
        if (this.server) {
            return;
        }
        
        const port = this.settings.zoteroConnectorPort || 23119;
        
        this.server = http.createServer(async (req, res) => {
            try {
                await this.handleRequest(req, res);
            } catch (error) {
                console.error('Error handling request:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        
        return new Promise((resolve, reject) => {
            this.server?.listen(port, () => {
                new Notice(`Zotero Connector server started on port ${port}`);
                resolve();
            });
            
            this.server?.on('error', (err) => {
                console.error('Failed to start Zotero Connector server:', err);
                new Notice(`Failed to start Zotero Connector server: ${err.message}`);
                reject(err);
            });
        });
    }
    
    /**
     * Stop the server
     */
    public stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            new Notice('Zotero Connector server stopped');
        }
    }
    
    /**
     * Handle incoming HTTP requests
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname || '';
        
        // Allow CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Zotero-Version, X-Zotero-Connector-API-Version');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }
        
        // Handle connector API requests
        if (pathname === '/connector/saveItems') {
            await this.handleSaveItems(req, res);
        } else if (pathname === '/connector/ping') {
            this.handlePing(req, res);
        } else if (pathname === '/connector/getTranslatorMetadata') {
            this.handleGetTranslatorMetadata(req, res);
        } else if (pathname === '/connector/detect') {
            this.handleDetect(req, res);
        } else {
            // For all other requests, return 404
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    }
    
    /**
     * Handle ping requests from the connector
     */
    private handlePing(req: http.IncomingMessage, res: http.ServerResponse): void {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
            status: 'success',
            version: {
                app: 'Obsidian Bibliography Plugin',
                connector: '1.0.0'
            }
        }));
    }
    
    /**
     * Handle translator metadata requests
     */
    private handleGetTranslatorMetadata(req: http.IncomingMessage, res: http.ServerResponse): void {
        // Simulate Zotero response for translator metadata
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
            name: 'Obsidian Bibliography Plugin',
            label: 'Save to Obsidian Bibliography Plugin',
            translatorID: 'obsidian-bibliography-plugin',
            translatorType: 4,
            browserSupport: 'gcsibv',
            lastUpdated: '2023-01-01'
        }));
    }
    
    /**
     * Handle detection requests from the connector
     */
    private handleDetect(req: http.IncomingMessage, res: http.ServerResponse): void {
        // Always indicate we can handle the request
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
            name: 'Obsidian Bibliography Plugin',
            status: 'success'
        }));
    }
    
    /**
     * Handle save items requests from the connector
     */
    private async handleSaveItems(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }
        
        // Read request body
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks).toString('utf-8');
        let data;
        
        try {
            data = JSON.parse(body);
            
            // Process received data from Zotero Connector
            
        } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON data' }));
            return;
        }
        
        // Check if we have items to process
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'No items provided' }));
            return;
        }
        
        try {
            // Process each item - using only the first one for now
            const item = data.items[0];
            
            // Download attachments if present
            let downloadedFiles: string[] = [];
            if (item.attachments && Array.isArray(item.attachments)) {
                downloadedFiles = await this.downloadAttachments(item.attachments);
            }
            
            // Respond with success
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
                status: 'success',
                downloadedFiles: downloadedFiles,
                itemData: item
            }));
            
            // Show notice to user
            new Notice(`Received ${data.items.length} item(s) from Zotero Connector`);
            
            // Process the item data (create note, etc.)
            await this.processZoteroItem(item, downloadedFiles);
        } catch (error) {
            console.error('Error processing Zotero item:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process item' }));
        }
    }
    
    /**
     * Download attachments from a Zotero item
     */
    private async downloadAttachments(attachments: any[]): Promise<string[]> {
        const downloadedFiles: string[] = [];
        
        for (const attachment of attachments) {
            if (attachment.url && attachment.mimeType && attachment.mimeType.startsWith('application/pdf')) {
                try {
                    // Create a unique filename
                    const fileHash = crypto.createHash('md5').update(attachment.url).digest('hex');
                    const filename = `${fileHash}.pdf`;
                    const filePath = path.join(this.tempDir, filename);
                    
                    // Download the file
                    await this.downloadFile(attachment.url, filePath);
                    downloadedFiles.push(filePath);
                    
                    // Attachment downloaded successfully
                } catch (error) {
                    console.error(`Failed to download attachment: ${error}`);
                }
            }
        }
        
        return downloadedFiles;
    }
    
    /**
     * Download a file from a URL to a specified path
     */
    private async downloadFile(url: string, filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filePath);
            const protocol = url.startsWith('https') ? https : http;
            
            const request = protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
                    return;
                }
                
                pipeline(response, file)
                    .then(() => resolve())
                    .catch(reject);
            });
            
            request.on('error', (err) => {
                fs.unlink(filePath, () => {}); // Clean up the file
                reject(err);
            });
            
            file.on('error', (err) => {
                fs.unlink(filePath, () => {}); // Clean up the file
                reject(err);
            });
        });
    }
    
    // Track items that have been processed to avoid duplicates
    private processedItems: Set<string> = new Set();

    /**
     * Process a Zotero item and create a bibliography entry
     */
    private async processZoteroItem(item: any, files: string[]): Promise<void> {
        // Check if we've already processed this item to avoid duplicates
        const itemKey = item.id || item.key || JSON.stringify(item);
        
        if (this.processedItems.has(itemKey)) {
            return;
        }
        
        // Add to processed items set
        this.processedItems.add(itemKey);
        
        // This will trigger the bibliography modal with the processed data
        const event = new CustomEvent('zotero-item-received', {
            detail: {
                item: item,
                files: files
            }
        });
        
        // Dispatch the event so it can be caught by the main plugin
        document.dispatchEvent(event);
        
        // Clear the processed items after a delay (in case the user wants to process the same item again later)
        setTimeout(() => {
            this.processedItems.delete(itemKey);
        }, 60000); // Clear after 1 minute
    }
}