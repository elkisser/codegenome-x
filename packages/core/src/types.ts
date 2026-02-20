export interface GraphNode {
  id: string;
  type: string;
  name: string;
  filePath: string;
  line: number;
  column: number;
  metadata: Record<string, unknown>;
  loc: number;
  dependencies: Set<string>;
  dependents: Set<string>;
}

export type Node = GraphNode;

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  metadata: Record<string, unknown>;
}

export type Edge = GraphEdge;

export interface ImpactScore {
  score: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  factors: {
    loc: number;
    fanOut: number;
    fanIn: number;
    dependencyDepth: number;
  };
}

export interface Graph {
  addNode(node: GraphNode): void;
  addEdge(from: string, to: string, type: string, metadata?: Record<string, unknown>): void;
  getAllNodes(): GraphNode[];
  getAllEdges(): GraphEdge[];
  getStats(): any;
  removeNodeSimulation(nodeId: string): RemovalSimulation;
}

export interface RemovalSimulation {
  nodeId: string;
  affectedNodes: string[];
  orphanedNodes: string[];
  brokenEndpoints: string[];
  servicesWithoutProvider: string[];
  impactScore: ImpactScore;
}

export interface AnalysisContext {
  projectPath: string;
  filePath: string;
  content: string;
  ast?: unknown;
  graph: any; // Use 'any' to avoid circular dependency, will be typed properly in implementation
}

export interface AnalysisOptions {
  projectPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxWorkers?: number;
  enableCache?: boolean;
  cacheDirectory?: string;
  verbose?: boolean;
}

export interface AnalysisResult {
  graph: any; // Use 'any' to avoid circular dependency, will be typed properly in implementation
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

export interface Analyzer {
  name: string;
  supportedExtensions: string[];
  analyze(context: AnalysisContext): Promise<void>;
}