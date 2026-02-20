import { Graph, Node } from '../types.js';

export interface UnusedAnalysisResult {
  unusedNodes: Node[];
  deadServices: string[];
  deadEndpoints: string[];
  unreferencedExports: string[];
  nodesByType: Record<string, number>;
}

export class UnusedDetector {
  private graph: Graph;
  private debug: boolean;

  constructor(graph: Graph, debug = false) {
    this.graph = graph;
    this.debug = debug;
  }

  analyze(): UnusedAnalysisResult {
    const result: UnusedAnalysisResult = {
      unusedNodes: [],
      deadServices: [],
      deadEndpoints: [],
      unreferencedExports: [],
      nodesByType: {},
    };

    const allNodes = this.graph.getAllNodes();
    const allEdges = this.graph.getAllEdges();

    // Count nodes by type
    for (const node of allNodes) {
      if (!result.nodesByType[node.type]) {
        result.nodesByType[node.type] = 0;
      }
      result.nodesByType[node.type]++;
    }

    // Find unused nodes
    result.unusedNodes = this.findUnusedNodes(allNodes, allEdges);

    // Find dead services (services with no dependents)
    result.deadServices = this.findDeadServices(allNodes, allEdges);

    // Find dead endpoints (routes with no references)
    result.deadEndpoints = this.findDeadEndpoints(allNodes, allEdges);

    // Find unreferenced exports
    result.unreferencedExports = this.findUnreferencedExports(allNodes, allEdges);

    return result;
  }

  private findUnusedNodes(nodes: Node[], edges: any[]): Node[] {
    const unused: Node[] = [];
    const incomingEdges = new Map<string, number>();

    // Initialize all nodes with 0 incoming edges
    for (const node of nodes) {
      incomingEdges.set(node.id, 0);
    }

    // Count incoming edges
    for (const edge of edges) {
      const current = incomingEdges.get(edge.to) || 0;
      incomingEdges.set(edge.to, current + 1);
    }

    // Find nodes with no incoming edges (entry points are OK)
    const entryPointTypes = ['symfony_route', 'client_call', 'api_endpoint'];

    for (const node of nodes) {
      const incoming = incomingEdges.get(node.id) || 0;

      if (incoming === 0 && !entryPointTypes.includes(node.type)) {
        unused.push(node);
      }
    }

    if (this.debug) {
      console.log(`[UnusedDetector] Found ${unused.length} unused nodes`);
    }

    return unused;
  }

  private findDeadServices(nodes: Node[], edges: any[]): string[] {
    const services: string[] = [];
    const incomingEdges = new Map<string, number>();

    // Count incoming "injects" edges
    for (const edge of edges) {
      if (edge.type === 'injects' || edge.type === 'depends_on') {
        const current = incomingEdges.get(edge.to) || 0;
        incomingEdges.set(edge.to, current + 1);
      }
    }

    // Find services with no dependents
    for (const node of nodes) {
      if (node.type === 'symfony_service') {
        const incoming = incomingEdges.get(node.id) || 0;
        if (incoming === 0) {
          services.push(node.id);
        }
      }
    }

    if (this.debug) {
      console.log(`[UnusedDetector] Found ${services.length} dead services`);
    }

    return services;
  }

  private findDeadEndpoints(nodes: Node[], edges: any[]): string[] {
    const endpoints: string[] = [];
    const referencedControllers = new Set<string>();

    // Find all referenced controllers
    for (const edge of edges) {
      if (edge.type === 'route_to_controller' || edge.type === 'exposes') {
        referencedControllers.add(edge.to);
      }
    }

    // Find endpoints with no controller references
    for (const node of nodes) {
      if (node.type === 'symfony_route') {
        if (!referencedControllers.has(node.id)) {
          endpoints.push(node.id);
        }
      }
    }

    if (this.debug) {
      console.log(`[UnusedDetector] Found ${endpoints.length} dead endpoints`);
    }

    return endpoints;
  }

  private findUnreferencedExports(nodes: Node[], edges: any[]): string[] {
    const exports: string[] = [];
    const usedExports = new Set<string>();

    // Find all used exports (via imports)
    for (const edge of edges) {
      if (edge.type === 'imports') {
        const metadata = edge.metadata as any;
        if (metadata?.imports) {
          for (const imp of metadata.imports) {
            usedExports.add(imp);
          }
        }
      }
    }

    // Find exports not used anywhere
    for (const node of nodes) {
      if (node.type === 'export' || node.type === 'function') {
        if (!usedExports.has(node.id)) {
          exports.push(node.id);
        }
      }
    }

    if (this.debug) {
      console.log(`[UnusedDetector] Found ${exports.length} unreferenced exports`);
    }

    return exports;
  }

  markUnusedMetadata(): void {
    const unused = this.findUnusedNodes(this.graph.getAllNodes(), this.graph.getAllEdges());
    const unusedIds = new Set(unused.map((n) => n.id));

    for (const node of this.graph.getAllNodes()) {
      if (unusedIds.has(node.id)) {
        node.metadata = node.metadata || {};
        (node.metadata as any).unused = true;
      }
    }

    if (this.debug) {
      console.log(`[UnusedDetector] Marked ${unused.length} nodes as unused`);
    }
  }
}
