export { Graph } from './graph.js';
export { AnalysisEngine, type AnalysisOptions, type AnalysisResult } from './engine.js';
export { TypeScriptAnalyzer } from './analyzers/typescript-analyzer.js';
export { ReactAnalyzer } from './analyzers/react-analyzer.js';
export { SymfonyAnalyzer } from './analyzers/symfony-analyzer.js';
export { EndpointAnalyzer } from './analyzers/endpoint-analyzer.js';
export type {
  GraphNode,
  GraphEdge,
  ImpactScore,
  RemovalSimulation,
  AnalysisContext,
  Analyzer,
} from './types.js';