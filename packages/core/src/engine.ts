import { Worker } from 'worker_threads';
import { join } from 'path';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { createHash } from 'crypto';
import { Graph } from './graph.js';
import { Analyzer, AnalysisContext } from './types.js';
import { TypeScriptAnalyzer } from './analyzers/typescript-analyzer.js';
import { ReactAnalyzer } from './analyzers/react-analyzer.js';
import { SymfonyAnalyzer } from './analyzers/symfony-analyzer.js';
import { EndpointAnalyzer } from './analyzers/endpoint-analyzer.js';

export interface AnalysisOptions {
  projectPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxWorkers?: number;
  enableCache?: boolean;
  cacheDir?: string;
}

export interface AnalysisResult {
  graph: Graph;
  stats: {
    filesAnalyzed: number;
    nodesCreated: number;
    edgesCreated: number;
    processingTime: number;
    cacheHits: number;
    cacheMisses: number;
  };
}

export class AnalysisEngine {
  private analyzers: Analyzer[] = [];
  private graph: Graph = new Graph();
  private cache: Map<string, string> = new Map();
  private enableCache: boolean = true;

  constructor() {
    this.registerAnalyzers();
  }

  private registerAnalyzers(): void {
    this.analyzers.push(new TypeScriptAnalyzer());
    this.analyzers.push(new ReactAnalyzer());
    this.analyzers.push(new SymfonyAnalyzer());
    this.analyzers.push(new EndpointAnalyzer());
  }

  async analyze(options: AnalysisOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    const {
      projectPath,
      includePatterns = ['**/*.{ts,tsx,js,jsx,php}'],
      excludePatterns = ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
      maxWorkers = 4,
      enableCache = true,
    } = options;

    this.enableCache = enableCache;

    // Find all files to analyze
    const files = await this.findFiles(projectPath, includePatterns, excludePatterns);
    
    // Process files in parallel using workers
    const results = await this.processFilesInParallel(files, projectPath, maxWorkers);
    
    // Merge results into main graph
    results.forEach(result => {
      result.nodes.forEach(node => this.graph.addNode(node));
      result.edges.forEach(edge => {
        this.graph.addEdge(edge.from, edge.to, edge.type, edge.metadata);
      });
    });

    const processingTime = Date.now() - startTime;
    
    return {
      graph: this.graph,
      stats: {
        filesAnalyzed: files.length,
        nodesCreated: this.graph.getAllNodes().length,
        edgesCreated: this.graph.getAllEdges().length,
        processingTime,
        cacheHits: 0, // TODO: Implement cache tracking
        cacheMisses: 0,
      },
    };
  }

  private async findFiles(
    projectPath: string,
    includePatterns: string[],
    excludePatterns: string[]
  ): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const pattern of includePatterns) {
      const files = await glob(pattern, {
        cwd: projectPath,
        ignore: excludePatterns,
        absolute: true,
      });
      allFiles.push(...files);
    }
    
    // Remove duplicates
    return [...new Set(allFiles)];
  }

  private async processFilesInParallel(
    files: string[],
    projectPath: string,
    maxWorkers: number
  ): Promise<Array<{ nodes: any[], edges: any[] }>> {
    const chunkSize = Math.ceil(files.length / maxWorkers);
    const chunks = this.chunkArray(files, chunkSize);
    
    const workers = chunks.map(chunk => this.createWorker(chunk, projectPath));
    const results = await Promise.all(workers);
    
    return results;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private createWorker(files: string[], projectPath: string): Promise<{ nodes: any[], edges: any[] }> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(join(__dirname, 'worker.js'), {
        workerData: { files, projectPath },
      });
      
      worker.on('message', (result) => {
        resolve(result);
      });
      
      worker.on('error', reject);
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  private async processFile(filePath: string, projectPath: string): Promise<{ nodes: any[], edges: any[] }> {
    try {
      // Check cache first
      if (this.enableCache) {
        const fileHash = await this.getFileHash(filePath);
        const cached = this.cache.get(fileHash);
        if (cached) {
          return JSON.parse(cached);
        }
      }
      
      const content = readFileSync(filePath, 'utf-8');
      const graph = new Graph();
      
      const context: AnalysisContext = {
        projectPath,
        filePath,
        content,
        graph,
      };
      
      // Find appropriate analyzer
      const analyzer = this.findAnalyzer(filePath);
      if (analyzer) {
        await analyzer.analyze(context);
      }
      
      const result = {
        nodes: graph.getAllNodes(),
        edges: graph.getAllEdges(),
      };
      
      // Cache result
      if (this.enableCache) {
        const fileHash = await this.getFileHash(filePath);
        this.cache.set(fileHash, JSON.stringify(result));
      }
      
      return result;
    } catch (error) {
      console.warn(`Failed to process file: ${filePath}`, error);
      return { nodes: [], edges: [] };
    }
  }

  private findAnalyzer(filePath: string): Analyzer | undefined {
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (!extension) return undefined;
    
    return this.analyzers.find(analyzer =>
      analyzer.supportedExtensions.some(ext => filePath.endsWith(ext))
    );
  }

  private async getFileHash(filePath: string): Promise<string> {
    const content = readFileSync(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  }

  getGraph(): Graph {
    return this.graph;
  }

  addAnalyzer(analyzer: Analyzer): void {
    this.analyzers.push(analyzer);
  }

  removeAnalyzer(name: string): void {
    this.analyzers = this.analyzers.filter(a => a.name !== name);
  }
}