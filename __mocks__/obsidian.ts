// Mock Obsidian API for testing
export class Notice {
  constructor(public message: string) {}
}

// Mock requestUrl for API calls
export async function requestUrl(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ text: string; json: any; status: number }> {
  // This will be overridden in tests using jest.mock
  throw new Error('requestUrl not mocked');
}

export class TFile {
  path: string;
  basename: string;
  extension: string;

  constructor(path: string) {
    this.path = path;
    this.basename = path.split('/').pop()?.split('.')[0] || '';
    this.extension = path.split('.').pop() || '';
  }
}

export class TAbstractFile {
  path: string;

  constructor(path: string) {
    this.path = path;
  }
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export class App {
  vault: Vault;
  metadataCache: MetadataCache;
  workspace: any;

  constructor() {
    this.vault = new Vault();
    this.metadataCache = new MetadataCache();
    this.workspace = {};
  }
}

export class Vault {
  files: Map<string, TFile> = new Map();

  getMarkdownFiles(): TFile[] {
    return Array.from(this.files.values()).filter(f => f.extension === 'md');
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.files.get(path) || null;
  }

  async create(path: string, content: string): Promise<TFile> {
    const file = new TFile(path);
    this.files.set(path, file);
    return file;
  }

  async modify(file: TFile, content: string): Promise<void> {
    // Mock implementation
  }

  async createFolder(path: string): Promise<void> {
    // Mock implementation
  }

  adapter: any = {
    read: async (path: string) => '',
    write: async (path: string, content: string) => {}
  };
}

export class MetadataCache {
  cache: Map<string, any> = new Map();

  getFileCache(file: TFile): any {
    return this.cache.get(file.path);
  }

  getCachedFiles(): string[] {
    return Array.from(this.cache.keys());
  }
}

export class Modal {
  constructor(public app: App) {}

  open(): void {}
  close(): void {}
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}

  setName(name: string): this {
    return this;
  }

  setDesc(desc: string): this {
    return this;
  }

  addText(cb: (text: any) => void): this {
    cb({ setValue: () => {}, getValue: () => '' });
    return this;
  }

  addToggle(cb: (toggle: any) => void): this {
    cb({ setValue: () => {}, getValue: () => false });
    return this;
  }
}

export class Plugin {
  app: App;
  manifest: any;

  constructor() {
    this.app = new App();
    this.manifest = {};
  }

  async loadData(): Promise<any> {
    return {};
  }

  async saveData(data: any): Promise<void> {}

  addCommand(command: any): void {}
  addSettingTab(tab: any): void {}
}
