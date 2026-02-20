import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import { resolve, relative, isAbsolute } from 'path';
import { minimatch } from 'minimatch';

export interface IgnoreOptions {
  projectRoot: string;
  customIgnoreFile?: string;
  debug?: boolean;
}

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  'vendor',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.next',
  '.nuxt',
  'out',
  'public/build',
  '*.min.js',
  '*.min.css',
  '.git',
  '.vscode',
  '.idea',
  'env',
  'bin',
  'obj',
];

export class IgnoreEngine {
  private patterns: string[] = [];
  private projectRoot: string;
  private debug: boolean;

  constructor(options: IgnoreOptions) {
    this.projectRoot = options.projectRoot;
    this.debug = options.debug || false;
    this.loadPatterns(options.customIgnoreFile);
  }

  private loadPatterns(customIgnoreFile?: string): void {
    this.patterns = [...DEFAULT_IGNORE_PATTERNS];

    const ignoreFile = customIgnoreFile || resolve(this.projectRoot, '.codegenomeignore');

    if (existsSync(ignoreFile)) {
      try {
        const content = readFileSync(ignoreFile, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip empty lines and comments
          if (trimmed && !trimmed.startsWith('#')) {
            this.patterns.push(trimmed);
          }
        }

        if (this.debug) {
          console.log(`[IgnoreEngine] Loaded ${this.patterns.length} patterns from ${ignoreFile}`);
        }
      } catch (error) {
        if (this.debug) {
          console.warn(`[IgnoreEngine] Failed to read ${ignoreFile}:`, error);
        }
      }
    } else if (this.debug) {
      console.log(`[IgnoreEngine] No .codegenomeignore found, using defaults`);
    }
  }

  shouldIgnore(filePath: string): boolean {
    const relativePath = this.normalize(filePath);

    for (const pattern of this.patterns) {
      // Exact match
      if (relativePath === pattern) {
        if (this.debug) console.log(`[IgnoreEngine] Ignoring (exact): ${filePath}`);
        return true;
      }

      // Directory match (e.g., "node_modules" ignores "node_modules/..." too)
      if (relativePath.startsWith(pattern + '/')) {
        if (this.debug) console.log(`[IgnoreEngine] Ignoring (dir): ${filePath}`);
        return true;
      }

      // Glob pattern match
      if (minimatch(relativePath, pattern, { dot: true })) {
        if (this.debug) console.log(`[IgnoreEngine] Ignoring (glob): ${filePath}`);
        return true;
      }

      // Basename pattern match
      const basename = relativePath.split('/').pop() || '';
      if (minimatch(basename, pattern, { dot: true })) {
        if (this.debug) console.log(`[IgnoreEngine] Ignoring (basename): ${filePath}`);
        return true;
      }
    }

    return false;
  }

  private normalize(filePath: string): string {
    const absolutePath = isAbsolute(filePath) ? filePath : resolve(this.projectRoot, filePath);
    return relative(this.projectRoot, absolutePath).replace(/\\/g, '/');
  }

  getPatterns(): string[] {
    return [...this.patterns];
  }
}
