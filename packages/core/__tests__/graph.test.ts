import { Graph } from '../src/graph';
import { GraphNode } from '../src/types';

describe('Graph', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  describe('addNode', () => {
    it('should add a node successfully', () => {
      const node: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'testFunction',
        filePath: '/test/file.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node);

      const retrievedNode = graph.getNode('node1');
      expect(retrievedNode).toBeDefined();
      expect(retrievedNode?.name).toBe('testFunction');
    });

    it('should handle duplicate node IDs', () => {
      const node1: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'function1',
        filePath: '/test/file1.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node2: GraphNode = {
        id: 'node1',
        type: 'class',
        name: 'class1',
        filePath: '/test/file2.ts',
        line: 1,
        column: 0,
        loc: 20,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node1);
      graph.addNode(node2);

      const retrievedNode = graph.getNode('node1');
      expect(retrievedNode?.type).toBe('class');
      expect(retrievedNode?.name).toBe('class1');
    });
  });

  describe('addEdge', () => {
    it('should add an edge between nodes', () => {
      const node1: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'function1',
        filePath: '/test/file.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node2: GraphNode = {
        id: 'node2',
        type: 'class',
        name: 'class1',
        filePath: '/test/file.ts',
        line: 20,
        column: 0,
        loc: 30,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addEdge('node1', 'node2', 'calls');

      const dependencies = graph.getDependencies('node1');
      const dependents = graph.getDependents('node2');

      expect(dependencies.has('node2')).toBe(true);
      expect(dependents.has('node1')).toBe(true);
    });

    it('should handle non-existent nodes gracefully', () => {
      expect(() => {
        graph.addEdge('nonexistent1', 'nonexistent2', 'calls');
      }).toThrow('Node not found');
    });
  });

  describe('getDependencies', () => {
    it('should return all dependencies of a node', () => {
      const node1: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'function1',
        filePath: '/test/file.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node2: GraphNode = {
        id: 'node2',
        type: 'function',
        name: 'function2',
        filePath: '/test/file.ts',
        line: 20,
        column: 0,
        loc: 15,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node3: GraphNode = {
        id: 'node3',
        type: 'class',
        name: 'class1',
        filePath: '/test/file.ts',
        line: 40,
        column: 0,
        loc: 30,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);

      graph.addEdge('node1', 'node2', 'calls');
      graph.addEdge('node1', 'node3', 'uses');

      const dependencies = graph.getDependencies('node1');
      expect(dependencies.size).toBe(2);
      expect(dependencies.has('node2')).toBe(true);
      expect(dependencies.has('node3')).toBe(true);
    });

    it('should return empty set for node with no dependencies', () => {
      const node: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'function1',
        filePath: '/test/file.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node);
      const dependencies = graph.getDependencies('node1');
      expect(dependencies.size).toBe(0);
    });
  });

  describe('getDependents', () => {
    it('should return all dependents of a node', () => {
      const node1: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'function1',
        filePath: '/test/file.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node2: GraphNode = {
        id: 'node2',
        type: 'function',
        name: 'function2',
        filePath: '/test/file.ts',
        line: 20,
        column: 0,
        loc: 15,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node3: GraphNode = {
        id: 'node3',
        type: 'class',
        name: 'class1',
        filePath: '/test/file.ts',
        line: 40,
        column: 0,
        loc: 30,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);

      graph.addEdge('node2', 'node1', 'calls');
      graph.addEdge('node3', 'node1', 'uses');

      const dependents = graph.getDependents('node1');
      expect(dependents.size).toBe(2);
      expect(dependents.has('node2')).toBe(true);
      expect(dependents.has('node3')).toBe(true);
    });
  });

  describe('removeNodeSimulation', () => {
    it('should simulate node removal and return impact', () => {
      const node1: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'function1',
        filePath: '/test/file.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node2: GraphNode = {
        id: 'node2',
        type: 'function',
        name: 'function2',
        filePath: '/test/file.ts',
        line: 20,
        column: 0,
        loc: 15,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node3: GraphNode = {
        id: 'node3',
        type: 'endpoint',
        name: 'apiEndpoint',
        filePath: '/test/file.ts',
        line: 40,
        column: 0,
        loc: 30,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);

      graph.addEdge('node2', 'node1', 'calls');
      graph.addEdge('node3', 'node1', 'uses');

      const simulation = graph.removeNodeSimulation('node1');

      expect(simulation.affectedNodes.includes('node2')).toBe(true);
      expect(simulation.affectedNodes.includes('node3')).toBe(true);
      expect(simulation.brokenEndpoints.includes('node3')).toBe(true);
      expect(simulation.impactScore.score).toBeGreaterThan(0);
      expect(simulation.impactScore.level).toBeDefined();
    });

    it('should handle removal of node with no dependents', () => {
      const node: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'function1',
        filePath: '/test/file.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node);

      const simulation = graph.removeNodeSimulation('node1');

      expect(simulation.affectedNodes.length).toBe(0);
      expect(simulation.impactScore).toBeDefined();
      expect(simulation.impactScore.level).toBe('Low');
    });
  });

  describe('getAllNodes', () => {
    it('should return all nodes in the graph', () => {
      const node1: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'function1',
        filePath: '/test/file.ts',
        line: 1,
        column: 0,
        loc: 10,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      const node2: GraphNode = {
        id: 'node2',
        type: 'class',
        name: 'class1',
        filePath: '/test/file.ts',
        line: 20,
        column: 0,
        loc: 30,
        metadata: {},
        dependencies: new Set(),
        dependents: new Set(),
      };

      graph.addNode(node1);
      graph.addNode(node2);

      const allNodes = graph.getAllNodes();
      expect(allNodes.length).toBe(2);
      expect(allNodes.some(n => n.id === 'node1')).toBe(true);
      expect(allNodes.some(n => n.id === 'node2')).toBe(true);
    });

    it('should return empty set for empty graph', () => {
      const allNodes = graph.getAllNodes();
      expect(allNodes.length).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle large number of nodes efficiently', () => {
      const startTime = Date.now();
      const nodeCount = 1000;

      // Create nodes
      for (let i = 0; i < nodeCount; i++) {
        const node: GraphNode = {
          id: `node${i}`,
          type: 'function',
          name: `function${i}`,
          filePath: `/test/file${i}.ts`,
          line: i,
          column: 0,
          loc: 10,
          metadata: {},
          dependencies: new Set(),
          dependents: new Set(),
        };
        graph.addNode(node);
      }

      // Create edges
      for (let i = 0; i < nodeCount - 1; i++) {
        graph.addEdge(`node${i}`, `node${i + 1}`, 'calls');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(graph.getAllNodes().length).toBe(nodeCount);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});