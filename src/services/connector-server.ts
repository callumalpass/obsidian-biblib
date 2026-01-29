import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import { App, Notice } from 'obsidian';
import * as os from 'os';
import * as path from 'path';
import * as stream from 'stream';
import * as url from 'url';
import { promisify } from 'util';
import {
	DEFAULT_ZOTERO_PORT,
	ERROR_MESSAGES,
	LOCALHOST,
	NOTICE_DURATION_SHORT,
	SUCCESS_MESSAGES
} from '../constants';
import { BibliographyPluginSettings } from '../types/settings';

const pipeline = promisify(stream.pipeline);

// --- Constants ---
const CONNECTOR_SERVER_VERSION = '1.0.7';
const ZOTERO_APP_NAME = 'Obsidian BibLib';
const CONNECTOR_API_VERSION_SUPPORTED = 3;
const SESSION_CLEANUP_INTERVAL = 600000; // 10 minutes
const SESSION_MAX_AGE = 1800000; // 30 minutes (extended for slow attachments)

// --- Interfaces ---
interface AttachmentStatus {
    progress: number;
    error?: string;
    localPath?: string;
}
interface SessionData {
    uri: string;
    items: any[];
    startTime: number;
    attachmentStatus: { [attachmentId: string]: AttachmentStatus };
    initialRequestData?: any;
    expectedAttachmentIds: Set<string>;
    eventDispatched: boolean;
    processedSnapshots: Set<string>; // Track processed HTML snapshots
    processedAttachmentPaths: Set<string>; // Track processed attachment paths
}
interface AttachmentMetadata {
    id?: string;
    url?: string;
    contentType?: string;
    parentItemID?: string;
    title?: string;
}

/**
 * A server that intercepts Zotero Connector requests to integrate with Obsidian.
 */
export class ConnectorServer {
    private server: http.Server | null = null;
    private app: App;
    private settings: BibliographyPluginSettings;
    private tempDir: string;
    private sessions: Map<string, SessionData> = new Map();
    private processedSnapshots: Set<string> = new Set(); // Track processed HTML snapshots by session ID
    private processedAttachmentPaths: Map<string, string> = new Map(); // Track attachment paths by session+filename
    private cleanupIntervalId: NodeJS.Timeout | null = null;

    constructor(app: App, settings: BibliographyPluginSettings) {
        this.app = app;
        this.settings = settings;
        this.tempDir = settings.tempPdfPath || path.join(os.tmpdir(), 'obsidian-bibliography');

        if (!fs.existsSync(this.tempDir)) {
            try {
                fs.mkdirSync(this.tempDir, { recursive: true });
            } catch (err) {
                console.error(`Failed to create temp directory ${this.tempDir}:`, err);
                new Notice(`Error: Could not create temp directory for Zotero Connector: ${this.tempDir}`);
            }
        }
    }

    public async start(): Promise<void> {
        if (this.server) {
            return;
        }

        const port = this.settings.zoteroConnectorPort || DEFAULT_ZOTERO_PORT;

        this.server = http.createServer(this.handleRequest.bind(this));

        return new Promise((resolve, reject) => {
            this.server?.listen(port, LOCALHOST, () => {
                new Notice(`${SUCCESS_MESSAGES.ZOTERO_SERVER_STARTED} ${port}`);
                this.cleanupIntervalId = setInterval(() => this.cleanupOldSessions(), SESSION_CLEANUP_INTERVAL);
                resolve();
            });

            this.server?.on('error', (err: NodeJS.ErrnoException) => {
                console.error('Failed to start Zotero Connector server:', err);
                let message = `Failed to start Zotero Connector server: ${err.message}`;
                if (err.code === 'EADDRINUSE') {
                    message = `Failed to start Zotero Connector server: Port ${port} ${ERROR_MESSAGES.ZOTERO_PORT_IN_USE}`;
                } else if (err.code === 'EACCES') {
                     message = `Failed to start Zotero Connector server: ${ERROR_MESSAGES.ZOTERO_PORT_ACCESS_DENIED.replace('port', `port ${port}`)}`;
                }
                new Notice(message);
                this.server = null;
                reject(err);
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.cleanupIntervalId) {
                clearInterval(this.cleanupIntervalId);
                this.cleanupIntervalId = null;
            }
            if (this.server) {
                this.server.close(() => {
                    new Notice('Zotero Connector server stopped', NOTICE_DURATION_SHORT);
                    this.server = null;
                    this.sessions.clear();
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Zotero-Version, X-Zotero-Connector-API-Version, X-Metadata, Authorization');
        res.setHeader('Access-Control-Expose-Headers', 'X-Zotero-Version');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname || '';
        const method = req.method || 'GET';

        res.setHeader('X-Zotero-Version', ZOTERO_APP_NAME + ' ' + CONNECTOR_SERVER_VERSION);


        try {
            if (pathname.startsWith('/connector/')) {
                const endpoint = pathname.substring('/connector/'.length);
                await this.routeConnectorApi(endpoint, req, res);
            } else if (pathname === '/') {
                 this.sendResponse(res, 200, { message: 'Obsidian Bibliography Connector Server Running', version: CONNECTOR_SERVER_VERSION });
            }
             else {
                this.sendResponse(res, 404, { error: 'Not Found' });
            }
        } catch (error) {
            console.error(`Connector Server: Error handling ${method} ${pathname}:`, error);
            this.sendResponse(res, 500, { error: 'Internal Server Error', details: error.message });
        }
    }

    private async routeConnectorApi(endpoint: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const method = req.method || 'GET';


        switch (endpoint) {
            case 'ping':
                if (method === 'POST' || method === 'GET') await this.handlePing(req, res);
                else this.sendMethodNotAllowed(res, endpoint);
                break;
            case 'saveItems':
                if (method === 'POST') await this.handleSaveItems(req, res);
                else this.sendMethodNotAllowed(res, endpoint);
                break;
            case 'saveSnapshot':
                 if (method === 'POST') await this.handleSaveSnapshot(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
            case 'saveAttachment':
            case 'saveStandaloneAttachment':
                 if (method === 'POST') await this.handleSaveAttachment(req, res, endpoint === 'saveStandaloneAttachment');
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
            case 'saveSingleFile':
                 if (method === 'POST') await this.handleSaveSingleFile(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
            case 'getSelectedCollection':
                if (method === 'GET' || method === 'POST') this.handleGetSelectedCollection(req, res);
                else this.sendMethodNotAllowed(res, endpoint);
                break;
            case 'sessionProgress':
                 if (method === 'POST') await this.handleSessionProgress(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
             case 'hasAttachmentResolvers':
                 if (method === 'POST') this.handleHasAttachmentResolvers(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
             case 'saveAttachmentFromResolver':
                 if (method === 'POST') this.handleSaveAttachmentFromResolver(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
            // Translator Endpoint Handling
            case 'getTranslatorCode':
            case 'getTranslators':
                 this.sendResponse(res, 200, []);
                 break;
            // Other Endpoints
            case 'delaySync':
            case 'updateSession':
                 this.sendResponse(res, 200, { status: 'acknowledged' });
                 break;
            case 'installStyle':
            case 'import':
            case 'getClientHostnames':
            case 'proxies':
                this.handleNotImplemented(res, `Endpoint '${endpoint}' likely not needed for Obsidian`);
                break;
            default:
                this.sendResponse(res, 404, { error: `Connector endpoint '/connector/${endpoint}' not found` });
        }
    }

    // --- Endpoint Handlers ---

	private async handlePing(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const clientApiVersion = parseInt(req.headers['x-zotero-connector-api-version']?.toString() || '0', 10);


        let body = '';
        if (req.method === 'POST') {
             body = await this.readRequestBody(req);
             try {
                 const payload = JSON.parse(body);
				 if (payload.activeURL) { /* empty */ }
				 // eslint-disable-next-line @typescript-eslint/no-unused-vars
			 } catch (e) { /* ignore */ }
        }

        if (clientApiVersion > CONNECTOR_API_VERSION_SUPPORTED) {
             this.sendResponse(res, 412, { error: 'Connector API version mismatch' });
            return;
        }

        const prefs = {
            downloadAssociatedFiles: true,
            automaticSnapshots: true,
            reportActiveURL: false,
            googleDocsAddNoteEnabled: false,
            googleDocsCitationExplorerEnabled: false,
            supportsAttachmentUpload: true,
            translatorsHash: "obsidian-plugin-static-hash-" + CONNECTOR_SERVER_VERSION,
            sortedTranslatorHash: "obsidian-plugin-static-hash-sorted-" + CONNECTOR_SERVER_VERSION
        };

        this.sendResponse(res, 200, {
            authenticated: false,
            loggedIn: false,
            storage: [1, 0, 0],
            prefs: prefs,
            version: ZOTERO_APP_NAME + ' ' + CONNECTOR_SERVER_VERSION
        });
    }

    private async handleSaveItems(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
		let data;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
        try { data = JSON.parse(body); } catch (e) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) { this.sendResponse(res, 400, { error: 'No items provided' }); return; }

        const sessionID = data.sessionID || crypto.randomUUID();
        const uri = data.uri || 'Unknown URI';
        const primaryItem = data.items[0];

        // Calculate expected attachment IDs
        const expectedAttachmentIds = new Set<string>();
		const attachments = primaryItem.attachments || [];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		attachments.forEach((att: any) => {
			// Include all attachments that have IDs, regardless of linkMode or existing localPath
			// Zotero may send them via saveAttachment even if they already have localPath
			if (att.id) {
				expectedAttachmentIds.add(att.id);
            }
        });

        this.sessions.set(sessionID, {
            uri: uri,
            items: [primaryItem],
            startTime: Date.now(),
            attachmentStatus: {},
            initialRequestData: data,
            expectedAttachmentIds: expectedAttachmentIds,
            eventDispatched: false,
            processedSnapshots: new Set<string>(),
            processedAttachmentPaths: new Set<string>()
        });

        this.sendResponse(res, 200, { sessionID: sessionID });
        new Notice(`Receiving item from Zotero.`);

		// Check if the session is already complete (e.g., no attachments expected)
		// and dispatch the event if ready
		this.checkAndDispatchIfComplete(sessionID);

		// Also schedule a delayed check in case of attachment ID mismatches
		// This handles cases where expected attachment IDs never get processed
		setTimeout(() => {
			if (!this.sessions.get(sessionID)?.eventDispatched) {
				this.checkAndDispatchIfComplete(sessionID);
			}
		}, 5000); // Check again after 5 seconds
    }

    private async handleSaveSnapshot(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
        try { data = JSON.parse(body); } catch (e) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

        const sessionID = data.sessionID || crypto.randomUUID();
        const uri = data.url || 'Unknown URI';
        const title = data.title || 'Web Page Snapshot';
        
        // Check if this session already exists
        const existingSession = this.sessions.get(sessionID);
        if (existingSession) {
            this.sendResponse(res, 200, { sessionID: sessionID });
            return;
        }

        const item = { 
            itemType: 'webpage',
            title: title,
            url: uri,
            accessDate: new Date().toISOString(),
            attachments: [],
            tags: [],
            // Add creators array if available in the data or from URL metadata
            creators: data.creators || 
                     (data.author ? [{ creatorType: 'author', name: data.author }] : 
                     (data.byline ? [{ creatorType: 'author', name: data.byline }] : [])),
            id: data.id || `webpage-${crypto.createHash('sha1').update(uri).digest('hex').substring(0, 10)}`
        };

        // Create a temporary ID for the expected HTML snapshot
        const tempSnapshotId = `html-snapshot-${crypto.randomUUID().substring(0, 8)}`;
        const expectedAttachmentIds = new Set<string>([tempSnapshotId]);

        this.sessions.set(sessionID, {
            uri: uri,
            items: [item],
            startTime: Date.now(),
            attachmentStatus: {
                [tempSnapshotId]: { progress: 0 }
            },
            initialRequestData: data,
            expectedAttachmentIds: expectedAttachmentIds,
            eventDispatched: false,
            processedSnapshots: new Set<string>(),
            processedAttachmentPaths: new Set<string>()
        });

        this.sendResponse(res, 200, { sessionID: sessionID });
        new Notice(`Receiving snapshot for ${title}.`);
    }

    private async handleSaveAttachment(req: http.IncomingMessage, res: http.ServerResponse, isStandalone: boolean): Promise<void> {
        const parsedUrl = url.parse(req.url || '', true);
        const sessionID = parsedUrl.query.sessionID as string;

        if (!sessionID) { this.sendResponse(res, 400, { error: 'sessionID query parameter is required' }); return; }
        
        const session = this.sessions.get(sessionID);
        if (!session) { this.sendResponse(res, 404, { error: 'Session not found or expired' }); return; }

        const metadataHeader = req.headers['x-metadata'] as string;
        const contentType = req.headers['content-type'] || 'application/octet-stream';
        
        if (!metadataHeader) { this.sendResponse(res, 400, { error: 'X-Metadata header is required' }); return; }
        
        let metadata: AttachmentMetadata;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
        try { metadata = JSON.parse(metadataHeader); } catch (e) { this.sendResponse(res, 400, { error: 'Invalid X-Metadata header' }); return; }
        
        const attachmentId = metadata.id || crypto.randomUUID();
        const title = metadata.title || 'Attachment';
        const sourceUrlForFilename = metadata.url || session.uri;

        // Generate filename and path
        const filename = this.generateFilename(title, contentType, sourceUrlForFilename);
        const filePath = path.join(this.tempDir, filename);
        
        // IMPROVED: Multiple checks for duplicate attachments
        
        // 1. Check if this attachment ID has already been processed
        if (session.attachmentStatus[attachmentId]?.progress === 100 && session.attachmentStatus[attachmentId]?.localPath) {
            
            // Acknowledge with success
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'success', 
                filename: path.basename(session.attachmentStatus[attachmentId].localPath!),
                canRecognize: contentType === 'application/pdf' && isStandalone 
            }));
            return;
        }
        
        // 2. Check for duplicate by path (if processedAttachmentPaths exists)
        if (session.processedAttachmentPaths && session.processedAttachmentPaths.has(filePath)) {
            
            // Find the attachment with this path
            const existingAttachment = Object.entries(session.attachmentStatus)
                .find(([id, status]) => status.localPath === filePath);
                
            if (existingAttachment) {
                // Link the new ID to the existing status
                session.attachmentStatus[attachmentId] = session.attachmentStatus[existingAttachment[0]];
                session.expectedAttachmentIds.add(attachmentId);
                
                // Acknowledge with success
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success', 
                    filename: filename,
                    canRecognize: contentType === 'application/pdf' && isStandalone 
                }));
                return;
            }
        }
        
        // 3. Check for duplicate by content (title + URL + mime type)
        const parentItem = session.items[0];
        if (parentItem && parentItem.attachments) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingAttachment = parentItem.attachments.find((att: any) => 
                att.title === title && 
                att.url === metadata.url && 
                att.mimeType === contentType &&
                // Make sure it has a valid status entry
                att.id && 
                session.attachmentStatus[att.id]?.progress === 100 &&
                session.attachmentStatus[att.id]?.localPath);
                
            if (existingAttachment && existingAttachment.id) {
                
                // Link the new ID to the existing attachment's status
                session.attachmentStatus[attachmentId] = { ...session.attachmentStatus[existingAttachment.id] };
                session.expectedAttachmentIds.add(attachmentId);
                
                // Acknowledge with success
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success', 
                    filename: filename,
                    canRecognize: contentType === 'application/pdf' && isStandalone 
                }));
                return;
            }
        }

        
        // Add to expected attachment IDs if not already present
		// If this is a PDF and we're expecting an HTML attachment, this is likely a replacement/upgrade
        if (!session.expectedAttachmentIds.has(attachmentId)) {
            session.expectedAttachmentIds.add(attachmentId);

			// Check if this PDF might be replacing a lower-quality attachment (like HTML catalog pages)
			if (contentType === 'application/pdf' && title && title.toLowerCase().includes('pdf')) {
				// Look for HTML catalog/snapshot attachments in expected IDs that might be replaced by this PDF
				for (const expectedId of session.expectedAttachmentIds) {
					const existingStatus = session.attachmentStatus[expectedId];
					if (!existingStatus || existingStatus.progress === 0) {
						// This might be a placeholder that won't actually arrive since Zotero replaced it with this PDF
						console.log(`[BIBLIB] PDF attachment ${attachmentId} may be replacing expected attachment ${expectedId}`);
					}
				}
			}
        }
        
        // Initialize attachment status
        session.attachmentStatus[attachmentId] = { progress: 0 };

        try {
            await pipeline(req, fs.createWriteStream(filePath));
            
            // Mark this attachment path as processed
            session.processedAttachmentPaths.add(filePath);
            
            session.attachmentStatus[attachmentId].progress = 100;
            session.attachmentStatus[attachmentId].localPath = filePath;

            // Update item data
            const parentItem = session.items[0];
            if (parentItem) {
                if (!parentItem.attachments) parentItem.attachments = [];
                
                // Create attachment info
                const attachmentInfo = { 
                    id: attachmentId, 
                    title: title, 
                    url: metadata.url, 
                    localPath: filePath, 
                    mimeType: contentType, 
                    parentItem: metadata.parentItemID || parentItem.id, 
                    itemType: 'attachment', 
                    linkMode: 'imported_file' 
                };
                
                // Check for existing attachment with same ID
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existingIndex = parentItem.attachments.findIndex((att: any) => att.id === attachmentId);
                
                if (existingIndex > -1) {
                    // Update existing entry
                    parentItem.attachments[existingIndex] = { ...parentItem.attachments[existingIndex], ...attachmentInfo };
                } else {
                    // Add new entry
                    parentItem.attachments.push(attachmentInfo);
                }
            }

            this.sessions.set(sessionID, session);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'success', 
                filename: filename, 
                canRecognize: contentType === 'application/pdf' && isStandalone 
            }));

            this.checkAndDispatchIfComplete(sessionID);
        } catch (error) {
            console.error(`Error saving attachment ${filename}:`, error);
            session.attachmentStatus[attachmentId].progress = -1;
            session.attachmentStatus[attachmentId].error = error.message;
            this.sessions.set(sessionID, session);
            fs.unlink(filePath, () => {});
            this.sendResponse(res, 500, { error: 'Failed to save attachment' });
            this.checkAndDispatchIfComplete(sessionID);
        }
    }

    private async handleSaveSingleFile(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
        try { data = JSON.parse(body); } catch (e) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

        const sessionID = data.sessionID;
        if (!sessionID) { this.sendResponse(res, 400, { error: 'sessionID is required' }); return; }
        
        const session = this.sessions.get(sessionID);
        if (!session) { this.sendResponse(res, 404, { error: 'Session not found or expired' }); return; }

        const snapshotContent = data.snapshotContent;
        if (typeof snapshotContent !== 'string') { this.sendResponse(res, 400, { error: 'Invalid snapshot content' }); return; }

        const title = data.title || session.items[0]?.title || 'Snapshot';
        
        // IMPROVED: Check if we've already processed an HTML snapshot for this session
        // This is the key fix for preventing duplicate snapshots
        if (session.processedSnapshots && session.processedSnapshots.size > 0) {
            
            // Still acknowledge the request to keep Zotero happy
            res.writeHead(204);
            res.end();
            return;
        }
        
        // Extra fallback check for older sessions that might not have the processedSnapshots field
        const existingSnapshotAttachment = session.items[0]?.attachments?.find((a: any) => a.mimeType === 'text/html');
        if (existingSnapshotAttachment?.id && session.attachmentStatus[existingSnapshotAttachment.id]?.progress === 100) {
            
            // Still acknowledge the request to keep Zotero happy
            res.writeHead(204);
            res.end();
            return;
        }
        
        // Determine a stable ID for the snapshot
        const snapshotIdBase = crypto.createHash('md5').update(data.url || session.uri).digest('hex').substring(0, 10);
        const attachmentId = data.id || `html-${snapshotIdBase}`;
        
        // Generate filename and path
        const filename = this.generateFilename(title, 'text/html', data.url || session.uri);
        const filePath = path.join(this.tempDir, filename);

        
        // Find any temporary placeholder ID
        let tempSnapshotId: string | undefined;
        for (const id of session.expectedAttachmentIds) {
            if (id.startsWith('html-snapshot-')) {
                tempSnapshotId = id;
                break;
            }
        }
        
        // Replace placeholder ID with real ID
        if (tempSnapshotId && tempSnapshotId !== attachmentId) {
            session.expectedAttachmentIds.delete(tempSnapshotId);
            delete session.attachmentStatus[tempSnapshotId];
            session.expectedAttachmentIds.add(attachmentId);
        } else if (!session.expectedAttachmentIds.has(attachmentId)) {
            session.expectedAttachmentIds.add(attachmentId);
        }
        
        // Initialize attachment status
        session.attachmentStatus[attachmentId] = { progress: 0 };
        
        try {
            await fs.promises.writeFile(filePath, snapshotContent, 'utf-8');
            
            // Mark this snapshot as processed
            session.processedSnapshots.add(attachmentId);
            
            session.attachmentStatus[attachmentId].progress = 100;
            session.attachmentStatus[attachmentId].localPath = filePath;

            // Update item data
            const parentItem = session.items[0];
            if (parentItem) {
                if (!parentItem.attachments) parentItem.attachments = [];
                
                const attachmentInfo = { 
                    id: attachmentId, 
                    title: title, 
                    url: data.url || session.uri, 
                    localPath: filePath, 
                    mimeType: 'text/html', 
                    itemType: 'attachment', 
                    linkMode: 'imported_file', 
                    charset: 'utf-8' 
                };
                
                // Remove any existing HTML snapshots
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existingIndex = parentItem.attachments.findIndex((att: any) => 
                    att.mimeType === 'text/html' || att.id === attachmentId);
                    
                if (existingIndex > -1) {
                    parentItem.attachments[existingIndex] = attachmentInfo;
                } else {
                    parentItem.attachments.push(attachmentInfo);
                }
            }

            this.sessions.set(sessionID, session);

            res.writeHead(204);
            res.end();

            this.checkAndDispatchIfComplete(sessionID);
        } catch (error) {
            console.error(`Error saving snapshot ${filename}:`, error);
            session.attachmentStatus[attachmentId].progress = -1;
            session.attachmentStatus[attachmentId].error = error.message;
            this.sessions.set(sessionID, session);
            fs.unlink(filePath, () => {});
            this.sendResponse(res, 500, { error: 'Failed to save snapshot' });
            this.checkAndDispatchIfComplete(sessionID);
        }
    }

    private handleGetSelectedCollection(req: http.IncomingMessage, res: http.ServerResponse): void {
        this.sendResponse(res, 200, {
            id: "obsidian",
            name: "Obsidian Vault",
            libraryID: 1,
            libraryEditable: true,
            filesEditable: true,
            targets: [
                 { id: "obsidian", name: "Obsidian Vault", type: "library", libraryID: 1, level: 0, filesEditable: true }
            ]
        });
    }

    private async handleSessionProgress(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
        try { data = JSON.parse(body); } catch (e) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

        const sessionID = data.sessionID;
        if (!sessionID || !this.sessions.has(sessionID)) { this.sendResponse(res, 404, { error: 'Session not found' }); return; }

        const session = this.sessions.get(sessionID)!;
        
        // Wait briefly to allow any in-progress attachments to be processed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if session is complete
        const isDone = this.isSessionComplete(session);

        // Build progress items for response
        const progressItems = (session.items || []).map(item => {
			const attachmentProgressList: unknown[] = [];
            
            for (const expectedId of session.expectedAttachmentIds) {
                const status = session.attachmentStatus[expectedId];
				const initialAttachment = (item.attachments || []).find((att: any) => att.id === expectedId);
                attachmentProgressList.push({
                    id: expectedId,
                    progress: status?.progress ?? 0,
                    error: status?.error,
                    title: initialAttachment?.title
                });
            }
            
            return { 
                id: item.id || 'unknown-item', 
                progress: 100, 
                attachments: attachmentProgressList 
            };
        });

        // Send response to Zotero
        this.sendResponse(res, 200, { items: progressItems, done: isDone });

        // If session is complete and event not yet dispatched, trigger dispatch
        if (isDone && !session.eventDispatched) {
            this.checkAndDispatchIfComplete(sessionID);
        }
    }

    private handleHasAttachmentResolvers(req: http.IncomingMessage, res: http.ServerResponse): void {
        this.sendResponse(res, 200, false);
    }

    private handleSaveAttachmentFromResolver(req: http.IncomingMessage, res: http.ServerResponse): void {
        this.sendResponse(res, 501, { error: 'Attachment resolving not implemented' });
    }

    // --- Utility Methods ---

    private sendResponse(res: http.ServerResponse, statusCode: number, body: any): void {
        if (res.headersSent) {
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(statusCode);
        res.end(JSON.stringify(body));
    }

    private sendMethodNotAllowed(res: http.ServerResponse, endpoint: string): void {
        this.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }

    private handleNotImplemented(res: http.ServerResponse, reason: string = 'Not implemented'): void {
        this.sendResponse(res, 501, { error: 'Not Implemented', reason: reason });
    }

    private async readRequestBody(req: http.IncomingMessage): Promise<string> {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf-8');
    }

    private generateFilename(title: string, mimeType: string, sourceUrl?: string): string {
        const extension = mimeType.split('/')[1]?.split('+')[0] ||
                          (mimeType === 'application/pdf' ? 'pdf' :
                          (mimeType === 'text/html' ? 'html' :
                          'bin'));
        const sanitizedTitle = (title || 'Untitled')
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\.+/g, '.')
            .replace(/[ _-]+$/, '')
            .replace(/^[ _.-]+/, '')
            .substring(0, 100);

        let baseName = sanitizedTitle;
        if (!baseName || baseName === '_' || title === 'Attachment' || title === 'Snapshot' || title === 'Untitled') {
            // Create a deterministic hash from the source URL or title to help with duplicate detection
            // This ensures the same source always gets the same filename, helping deduplication
            const sourceData = sourceUrl || title || crypto.randomUUID();
            const hash = crypto.createHash('sha1').update(sourceData).digest('hex').substring(0, 10);
            baseName = `attachment_${hash}`;
        }
        return `${baseName}.${extension}`;
    }

    private checkAndDispatchIfComplete(sessionID: string): void {
        const session = this.sessions.get(sessionID);
		if (!session) return;

		if (session.eventDispatched) return;

		const isComplete = this.isSessionComplete(session);

        // Check if session is complete
		if (isComplete) {
            
            // Get successfully processed files
            const savedFiles = Object.values(session.attachmentStatus)
                .filter(status => status.progress === 100 && status.localPath)
				.map(status => status.localPath!);

            // Dispatch event
            this.dispatchZoteroItemEvent(session.items[0], savedFiles, sessionID);
            
            // Mark as dispatched but keep the session alive
            // This is a key change - we don't delete the session here
            session.eventDispatched = true;
            this.sessions.set(sessionID, session);
            
            // Set up monitoring for additional attachments
            this.monitorForAdditionalAttachments(sessionID);
        }
    }

    /**
     * Monitor for additional attachments that might arrive late
     */
    private monitorForAdditionalAttachments(sessionID: string): void {
        let checkCount = 0;
        let lastFileCount = 0;
        
        
        const monitor = setInterval(() => {
            checkCount++;
            const session = this.sessions.get(sessionID);
            
            if (!session) {
                clearInterval(monitor);
                return;
            }
            
            // Get currently completed files
            const currentFiles = Object.values(session.attachmentStatus)
                .filter(status => status.progress === 100 && status.localPath)
                .map(status => status.localPath!);
            
            // Check if we have new completed files since last check
            if (currentFiles.length > lastFileCount) {
                
                // Dispatch additional files event
                this.dispatchAdditionalAttachments(session.items[0].id, 
                    currentFiles.slice(lastFileCount), sessionID);
                
                lastFileCount = currentFiles.length;
            }
            
            // Monitor for up to 5 minutes (300 checks at 1 second each)
            if (checkCount >= 300) {
                clearInterval(monitor);
            }
        }, 1000); // Check every second
    }
    
    /**
     * Dispatch event for additional attachments
     */
    private dispatchAdditionalAttachments(itemId: string, newFiles: string[], sessionID: string): void {
        if (typeof document === 'undefined') return;
        
        
        const event = new CustomEvent('zotero-additional-attachments', {
            detail: {
                itemId: itemId,
                files: newFiles,
                sessionID: sessionID
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Dispatches the main event with item data
     */
    private dispatchZoteroItemEvent(item: any, newFiles: string[], sessionID: string): void {
		if (typeof document === 'undefined') return;

        const session = this.sessions.get(sessionID);
		if (!session) return;

		// Use the item directly since it's already from the session
		const currentItemState = item;

        const event = new CustomEvent('zotero-item-received', {
            detail: {
                item: JSON.parse(JSON.stringify(currentItemState)), // Deep copy
                files: newFiles,
                sessionID: sessionID
            }
		});
		document.dispatchEvent(event);
    }

    /**
     * Checks if all expected attachments have reported a final status
     */
    private isSessionComplete(session: SessionData): boolean {
		if (!session || !session.items || session.items.length === 0) return true;
		if (!session.expectedAttachmentIds || session.expectedAttachmentIds.size === 0) return true;

        let processedCount = 0;
		let orphanedCount = 0;
		const sessionAge = Date.now() - session.startTime;
		const ORPHAN_TIMEOUT = 4000; // 4 seconds - if an attachment hasn't started processing, consider it orphaned

        for (const expectedId of session.expectedAttachmentIds) {
            const status = session.attachmentStatus[expectedId];
            if (status && (status.progress === 100 || status.progress === -1)) {
                processedCount++;
			} else if (!status && sessionAge > ORPHAN_TIMEOUT) {
				// This attachment ID was expected but never started processing
				// This is common when Zotero replaces HTML catalog pages with actual PDF attachments
				orphanedCount++;
            }
        }

		// Calculate effective expected count (excluding orphaned attachments)
		const effectiveExpectedCount = session.expectedAttachmentIds.size - orphanedCount;

		// Simplified completion logic: 
		// If we have at least one successfully processed attachment (especially PDFs),
		// and enough time has passed, consider the session complete
		const hasProcessedAttachments = processedCount > 0;
		const allProcessedOrLongEnoughWait = processedCount >= effectiveExpectedCount ||
			(hasProcessedAttachments && sessionAge > 3000);

		const isComplete = allProcessedOrLongEnoughWait || effectiveExpectedCount === 0;



		return isComplete;
    }

    private cleanupOldSessions(): void {
        const now = Date.now();
        let deletedCount = 0;
        
        for (const [sessionId, sessionData] of this.sessions.entries()) {
            // Only clean up sessions that have been dispatched
            if (sessionData.eventDispatched && now - sessionData.startTime > SESSION_MAX_AGE) {
                this.sessions.delete(sessionId);
                deletedCount++;
            }
        }
        
		if (deletedCount > 0) { /* empty */ }
    }
} // End of ConnectorServer class
