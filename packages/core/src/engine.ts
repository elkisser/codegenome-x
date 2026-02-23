import { resolve } from 'path';
import { Graph } from './graph.js';
import { Analyzer } from './types.js';
import { TypeScriptAnalyzer } from './analyzers/typescript-analyzer.js';
import { ReactAnalyzer } from './analyzers/react-analyzer.js';
import { SymfonyAnalyzer } from './analyzers/symfony-analyzer.js';
import { EndpointAnalyzer } from './analyzers/endpoint-analyzer.js';
import { IgnoreEngine } from './ignore/ignore-engine.js';
import { FileWalker } from './fs/file-walker.js';
import { CacheEngine } from './cache/cache-engine.js';
import { UnusedDetector } from './analysis/unused-detector.js';
import { TypeScriptEdgeDetector } from './edges/typescript-edge-detector.js';
import { SymfonyEdgeDetector } from './edges/symfony-edge-detector.js';

export interface AnalysisOptions {
  projectPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxWorkers?: number;
  enableCache?: boolean;
  cacheDir?: string;
  debug?: boolean;
  ignoreFile?: string;
}

export interface AnalysisResult {
  graph: Graph;
  stats: {
    filesAnalyzed: number;
    filesIgnored: number;
    filesSkipped: number;
    nodesCreated: number;
    edgesCreated: number;
    processingTime: number;
    cacheHits: number;
    cacheMisses: number;
    deadCodeEstimate: number;
    unusedNodesCount: number;
    edgesByType: Record<string, number>;
  };
  unusedAnalysis?: any;
}

export class AnalysisEngine {
  private analyzers: Analyzer[] = [];
  private graph: Graph = new Graph();
  private ignoreEngine: IgnoreEngine | null = null;
  private cacheEngine: CacheEngine | null = null;
  private projectRoot: string = '';
  private debug: boolean = false;
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    filesAnalyzed: 0,
    filesIgnored: 0,
    filesSkipped: 0,
  };

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
    this.debug = options.debug || false;
    this.projectRoot = resolve(options.projectPath);

    // Initialize ignore engine
    this.ignoreEngine = new IgnoreEngine(
      {
        projectRoot: this.projectRoot,
        customIgnoreFile: options.ignoreFile,
        debug: this.debug,
      }
    );

    // Initialize cache if enabled
    if (options.enableCache !== false) {
      this.cacheEngine = new CacheEngine(this.projectRoot, this.debug);
    }

    // Create file walker
    const walker = new FileWalker({
      projectRoot: this.projectRoot,
      ignoreEngine: this.ignoreEngine,
      debug: this.debug,
    });

    // Get all files
    const files = await walker.walk();
    const walkerStats = walker.getStats();

    if (this.debug) {
      console.log(`[Engine] Found ${files.length} files to analyze`);
    }

    // Create file content map for cache
    const fileMap = new Map(files.map((f) => [f.relativePath, f.content]));

    // Get changed files
    let filesToAnalyze = files;
    if (this.cacheEngine) {
      const changed = this.cacheEngine.getChangedFiles(fileMap);
      filesToAnalyze = files.filter((f) => changed.includes(f.relativePath));

      this.stats.cacheHits = files.length - filesToAnalyze.length;
      this.stats.cacheMisses = filesToAnalyze.length;

      if (this.debug) {
        console.log(`[Engine] Cache: ${this.stats.cacheHits} hits, ${this.stats.cacheMisses} misses`);
      }
    }

    // Analyze files
    for (const file of filesToAnalyze) {
      await this.analyzeFile(file.relativePath, file.content, file.extension);
    }

    // Run unused detection
    const unusedDetector = new UnusedDetector(this.graph, this.debug);
    const unusedAnalysis = unusedDetector.analyze();
    unusedDetector.markUnusedMetadata();

    // Calculate dead code estimate
    const deadCodeEstimate = Math.round(
      (unusedAnalysis.unusedNodes.length / this.graph.getAllNodes().length) * 100
    ) || 0;

    // Count edges by type
    const edgesByType: Record<string, number> = {};
    for (const edge of this.graph.getAllEdges()) {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    }

    // Save cache
    if (this.cacheEngine) {
      for (const file of filesToAnalyze) {
        const relPath = file.relativePath || '';
        const nodes = this.graph.getAllNodes()
          .filter((n: any) => (n.metadata?.file === relPath))
          .map((n: any) => n.id);
        const edges = this.graph.getAllEdges()
          .filter((e: any) => (e.metadata?.file === relPath))
          .map((e: any) => `${e.from}-${e.to}`);

        this.cacheEngine.setCacheEntry(relPath, file.content, nodes, edges);
      }
      this.cacheEngine.save();
    }

    const processingTime = Date.now() - startTime;

    return {
      graph: this.graph,
      stats: {
        filesAnalyzed: walkerStats.filesProcessed,
        filesIgnored: walkerStats.filesIgnored,
        filesSkipped: walkerStats.filesSkipped,
        nodesCreated: this.graph.getAllNodes().length,
        edgesCreated: this.graph.getAllEdges().length,
        processingTime,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        deadCodeEstimate,
        unusedNodesCount: unusedAnalysis.unusedNodes.length,
        edgesByType,
      },
      unusedAnalysis,
    };
  }

  private async analyzeFile(filePath: string, content: string, extension: string): Promise<void> {
    // Try all compatible analyzers
    for (const analyzer of this.analyzers) {
      if (!analyzer.supportedExtensions.includes(extension)) {
        continue;
      }

      try {
        // Create analysis context
        const context = {
          projectPath: this.projectRoot || '',
          filePath,
          content,
          graph: this.graph,
        };

        await analyzer.analyze(context);

        // Detect edges based on language
        if (extension === '.ts' || extension === '.tsx' || extension === '.js' || extension === '.jsx') {
          const tsDetector = new TypeScriptEdgeDetector(this.projectRoot || '', this.debug);
          const tsEdges = tsDetector.detect(filePath, content);

          for (const edge of tsEdges) {
            this.graph.addEdge(
              edge.source,
              edge.target,
              edge.type,
              edge.metadata
            );
          }
        }

        if (extension === '.php') {
          const symDetector = new SymfonyEdgeDetector(this.projectRoot || '', this.debug);
          const symEdges = symDetector.detect(filePath, content);

          for (const edge of symEdges) {
            this.graph.addEdge(
              edge.source,
              edge.target,
              edge.type,
              edge.metadata
            );
          }
        }

        if (this.debug) {
          console.log(
            `[Engine] Analyzed ${analyzer.name} for ${filePath}`
          );
        }

        // Removed break to allow multiple analyzers (e.g., TS + Endpoint)
      } catch (error) {
        if (this.debug) {
          console.warn(`[Engine] Analyzer ${analyzer.name} failed for ${filePath}:`, error);
        }
      }
    }
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