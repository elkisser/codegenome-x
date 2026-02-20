import { GraphNode, GraphEdge, ImpactScore, RemovalSimulation } from './types.js';

export class Graph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();
  private nodeTypes: Map<string, Set<string>> = new Map();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    
    if (!this.nodeTypes.has(node.type)) {
      this.nodeTypes.set(node.type, new Set());
    }
    this.nodeTypes.get(node.type)!.add(node.id);
    
    if (!this.edges.has(node.id)) {
      this.edges.set(node.id, []);
    }
  }

  addEdge(from: string, to: string, type: string, metadata: Record<string, unknown> = {}): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Node not found: ${!this.nodes.has(from) ? from : to}`);
    }

    const edge: GraphEdge = { from, to, type, metadata };
    
    const fromEdges = this.edges.get(from) || [];
    fromEdges.push(edge);
    this.edges.set(from, fromEdges);

    this.nodes.get(from)!.dependencies.add(to);
    this.nodes.get(to)!.dependents.add(from);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getNodesByType(type: string): GraphNode[] {
    const nodeIds = this.nodeTypes.get(type);
    if (!nodeIds) return [];
    
    return Array.from(nodeIds).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  getDependencies(nodeId: string): Set<string> {
    const node = this.nodes.get(nodeId);
    if (!node) return new Set();
    
    return node.dependencies;
  }

  getDependents(nodeId: string): Set<string> {
    const node = this.nodes.get(nodeId);
    if (!node) return new Set();
    
    return node.dependents;
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): GraphEdge[] {
    const allEdges: GraphEdge[] = [];
    for (const edges of this.edges.values()) {
      allEdges.push(...edges);
    }
    return allEdges;
  }

  removeNodeSimulation(nodeId: string): RemovalSimulation {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const affectedNodes = new Set<string>();
    const orphanedNodes = new Set<string>();
    const brokenEndpoints = new Set<string>();
    const servicesWithoutProvider = new Set<string>();

    // Find directly affected nodes
    const dependents = this.getDependents(nodeId);
    const dependencies = this.getDependencies(nodeId);

    dependents.forEach(depId => affectedNodes.add(depId));

    // Find orphaned nodes (nodes that would have no dependencies)
    dependencies.forEach(depId => {
      const depNode = this.nodes.get(depId);
      if (depNode && depNode.dependents.size === 1 && depNode.dependents.has(nodeId)) {
        orphanedNodes.add(depId);
      }
    });

    // Find broken endpoints
    if (node.type === 'endpoint') {
      brokenEndpoints.add(nodeId);
    }
    
    dependents.forEach(depId => {
      const depNode = this.nodes.get(depId);
      if (depNode && depNode.type === 'endpoint') {
        brokenEndpoints.add(depId);
      }
    });

    // Find services without providers
    if (node.type === 'provider') {
      dependents.forEach(depId => {
        const depNode = this.nodes.get(depId);
        if (depNode && depNode.type === 'service') {
          servicesWithoutProvider.add(depId);
        }
      });
    }

    const impactScore = this.calculateImpactScore(node);

    return {
      nodeId,
      affectedNodes: Array.from(affectedNodes),
      orphanedNodes: Array.from(orphanedNodes),
      brokenEndpoints: Array.from(brokenEndpoints),
      servicesWithoutProvider: Array.from(servicesWithoutProvider),
      impactScore
    };
  }

  private calculateImpactScore(node: GraphNode): ImpactScore {
    const fanOut = node.dependencies.size;
    const fanIn = node.dependents.size;
    const dependencyDepth = this.calculateDependencyDepth(node.id);

    const score = (node.loc * 0.4) + (fanOut * 3) + (fanIn * 2) + (dependencyDepth * 2);

    let level: 'Low' | 'Medium' | 'High' | 'Critical';
    if (score < 10) level = 'Low';
    else if (score < 50) level = 'Medium';
    else if (score < 100) level = 'High';
    else level = 'Critical';

    return {
      score,
      level,
      factors: {
        loc: node.loc,
        fanOut,
        fanIn,
        dependencyDepth
      }
    };
  }

  private calculateDependencyDepth(nodeId: string): number {
    const visited = new Set<string>();
    let maxDepth = 0;

    const dfs = (currentId: string, depth: number): void => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      maxDepth = Math.max(maxDepth, depth);
      
      const dependencies = this.getDependencies(currentId);
      dependencies.forEach(depId => {
        dfs(depId, depth + 1);
      });
    };

    dfs(nodeId, 0);
    return maxDepth;
  }

  getStats(): {
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<string, number>;
    averageImpactScore: number;
  } {
    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();
    
    const nodeTypes: Record<string, number> = {};
    for (const [type, nodeIds] of this.nodeTypes) {
      nodeTypes[type] = nodeIds.size;
    }

    const averageImpactScore = nodes.length > 0
      ? nodes.reduce((sum, node) => {
          const score = this.calculateImpactScore(node);
          return sum + score.score;
        }, 0) / nodes.length
      : 0;

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeTypes,
      averageImpactScore
    };
  }
}