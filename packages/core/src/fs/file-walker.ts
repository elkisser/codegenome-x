import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { resolve, extname, relative } from 'path';
import { IgnoreEngine } from '../ignore/ignore-engine.js';

export interface FileWalkerOptions {
  projectRoot: string;
  ignoreEngine: IgnoreEngine;
  maxFileSize?: number; // in bytes, default 1MB
  supportedExtensions?: string[];
  debug?: boolean;
  parallelism?: number;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  content: string;
  size: number;
  extension: string;
}

const DEFAULT_SUPPORTED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.php',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.rb',
  '.swift',
  '.kt',
];

export class FileWalker {
  private projectRoot: string;
  private ignoreEngine: IgnoreEngine;
  private maxFileSize: number;
  private supportedExtensions: Set<string>;
  private debug: boolean;
  private stats = {
    filesProcessed: 0,
    filesSkipped: 0,
    filesIgnored: 0,
    errorCount: 0,
  };

  constructor(options: FileWalkerOptions) {
    this.projectRoot = options.projectRoot;
    this.ignoreEngine = options.ignoreEngine;
    this.maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB default
    this.supportedExtensions = new Set(options.supportedExtensions || DEFAULT_SUPPORTED_EXTENSIONS);
    this.debug = options.debug || false;
  }

  async walk(): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      this.walkSync(this.projectRoot, files);
    } catch (error) {
      if (this.debug) {
        console.error(`[FileWalker] Error during walk:`, error);
      }
    }

    if (this.debug) {
      console.log(`[FileWalker] Stats:`, this.stats);
    }

    return files;
  }

  private walkSync(dirPath: string, files: FileInfo[]): void {
    if (this.ignoreEngine.shouldIgnore(dirPath)) {
      this.stats.filesIgnored++;
      return;
    }

    // Validate directory exists and is a directory
    if (!existsSync(dirPath)) {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] Path does not exist: ${dirPath}`);
      return;
    }

    let stat;
    try {
      stat = statSync(dirPath);
    } catch (error) {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] Cannot stat: ${dirPath}`, error);
      return;
    }

    if (!stat.isDirectory()) {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] Not a directory: ${dirPath}`);
      return;
    }

    let entries;
    try {
      entries = readdirSync(dirPath, { withFileTypes: true });
    } catch (error) {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] Cannot read directory: ${dirPath}`, error);
      return;
    }

    for (const entry of entries) {
      const fullPath = resolve(dirPath, entry.name);

      if (this.ignoreEngine.shouldIgnore(fullPath)) {
        this.stats.filesIgnored++;
        continue;
      }

      try {
        if (entry.isDirectory()) {
          this.walkSync(fullPath, files);
        } else if (entry.isFile()) {
          this.processFile(fullPath, files);
        }
      } catch (error) {
        this.stats.errorCount++;
        if (this.debug) console.warn(`[FileWalker] Error processing ${fullPath}:`, error);
      }
    }
  }

  private processFile(filePath: string, files: FileInfo[]): void {
    const ext = extname(filePath).toLowerCase();

    // Check if extension is supported
    if (!this.supportedExtensions.has(ext)) {
      this.stats.filesSkipped++;
      return;
    }

    // Validate file exists and is a file
    if (!existsSync(filePath)) {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] File does not exist: ${filePath}`);
      return;
    }

    let stat;
    try {
      stat = statSync(filePath);
    } catch (error) {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] Cannot stat file: ${filePath}`, error);
      return;
    }

    if (!stat.isFile()) {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] Not a file: ${filePath}`);
      return;
    }

    // Check file size
    if (stat.size > this.maxFileSize) {
      this.stats.filesSkipped++;
      if (this.debug) console.warn(`[FileWalker] File too large (${stat.size} bytes): ${filePath}`);
      return;
    }

    // Read file content
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (error) {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] Cannot read file: ${filePath}`, error);
      return;
    }

    // Validate content is valid UTF-8
    if (!content || typeof content !== 'string') {
      this.stats.errorCount++;
      if (this.debug) console.warn(`[FileWalker] Invalid content: ${filePath}`);
      return;
    }

    const relativePath = relative(this.projectRoot, filePath).replace(/\\/g, '/');

    files.push({
      path: filePath,
      relativePath,
      content,
      size: stat.size,
      extension: ext,
    });

    this.stats.filesProcessed++;
  }

  getStats() {
    return { ...this.stats };
  }
}
