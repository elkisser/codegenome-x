import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

export interface CacheEntry {
  hash: string;
  nodes: string[];
  edges: string[];
  timestamp: number;
}

export interface CacheData {
  version: string;
  timestamp: number;
  files: Record<string, CacheEntry>;
}

export class CacheEngine {
  private cacheDir: string;
  private cacheFile: string;
  private cache: CacheData;
  private debug: boolean;

  constructor(projectRoot: string, debug = false) {
    this.debug = debug;
    this.cacheDir = resolve(projectRoot, '.codegenome');
    this.cacheFile = resolve(this.cacheDir, 'cache.json');
    this.cache = this.loadCache();
  }

  private loadCache(): CacheData {
    if (existsSync(this.cacheFile)) {
      try {
        const content = readFileSync(this.cacheFile, 'utf-8');
        const data = JSON.parse(content);

        if (this.debug) {
          console.log(`[CacheEngine] Loaded cache with ${Object.keys(data.files || {}).length} files`);
        }

        return data;
      } catch (error) {
        if (this.debug) {
          console.warn(`[CacheEngine] Failed to load cache:`, error);
        }
        return this.createEmptyCache();
      }
    }

    return this.createEmptyCache();
  }

  private createEmptyCache(): CacheData {
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      files: {},
    };
  }

  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  hasChanged(filePath: string, content: string): boolean {
    const hash = this.calculateHash(content);
    const cached = this.cache.files[filePath];

    if (!cached) {
      return true; // New file
    }

    return cached.hash !== hash;
  }

  getCachedNodes(filePath: string): string[] | null {
    const cached = this.cache.files[filePath];
    return cached ? cached.nodes : null;
  }

  getCachedEdges(filePath: string): string[] | null {
    const cached = this.cache.files[filePath];
    return cached ? cached.edges : null;
  }

  setCacheEntry(filePath: string, content: string, nodes: string[], edges: string[]): void {
    const hash = this.calculateHash(content);

    this.cache.files[filePath] = {
      hash,
      nodes,
      edges,
      timestamp: Date.now(),
    };

    if (this.debug) {
      console.log(`[CacheEngine] Cached ${filePath}`);
    }
  }

  save(): void {
    try {
      // Create cache directory if it doesn't exist
      if (!existsSync(this.cacheDir)) {
        mkdirSync(this.cacheDir, { recursive: true });
      }

      this.cache.timestamp = Date.now();
      writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2), 'utf-8');

      if (this.debug) {
        console.log(`[CacheEngine] Cache saved to ${this.cacheFile}`);
      }
    } catch (error) {
      if (this.debug) {
        console.error(`[CacheEngine] Failed to save cache:`, error);
      }
    }
  }

  clear(): void {
    this.cache = this.createEmptyCache();
    
    if (existsSync(this.cacheFile)) {
      try {
        readFileSync(this.cacheFile, 'utf-8'); // Check if readable
        writeFileSync(this.cacheFile, '', 'utf-8');
        if (this.debug) {
          console.log(`[CacheEngine] Cache cleared`);
        }
      } catch (error) {
        if (this.debug) {
          console.warn(`[CacheEngine] Failed to clear cache:`, error);
        }
      }
    }
  }

  getStats() {
    const fileCount = Object.keys(this.cache.files).length;
    const totalNodes = Object.values(this.cache.files).reduce(
      (sum, entry) => sum + entry.nodes.length,
      0
    );
    const totalEdges = Object.values(this.cache.files).reduce(
      (sum, entry) => sum + entry.edges.length,
      0
    );

    return {
      fileCount,
      totalNodes,
      totalEdges,
      cacheAge: Date.now() - this.cache.timestamp,
    };
  }

  getChangedFiles(currentFiles: Map<string, string>): string[] {
    const changedFiles: string[] = [];

    // Files that changed or are new
    for (const [filePath, content] of currentFiles) {
      if (this.hasChanged(filePath, content)) {
        changedFiles.push(filePath);
      }
    }

    // Files that were deleted
    for (const cachedFile of Object.keys(this.cache.files)) {
      if (!currentFiles.has(cachedFile)) {
        changedFiles.push(cachedFile);
      }
    }

    return changedFiles;
  }

  removeEntry(filePath: string): void {
    delete this.cache.files[filePath];
    if (this.debug) {
      console.log(`[CacheEngine] Removed cache entry for ${filePath}`);
    }
  }
}
