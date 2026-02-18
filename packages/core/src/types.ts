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

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  metadata: Record<string, unknown>;
}

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
  graph: Graph;
}

export interface Analyzer {
  name: string;
  supportedExtensions: string[];
  analyze(context: AnalysisContext): Promise<void>;
}