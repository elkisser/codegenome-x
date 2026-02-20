import { AnalysisEngine } from '../src/engine';
import { AnalysisOptions } from '../src/types';

// Mock fs and path modules
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    stat: jest.fn(),
  },
  readFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((path) => path),
    extname: jest.fn((filePath) => '.ts'),
  glob: jest.fn(() => Promise.resolve(['/test/file1.ts', '/test/file2.ts'])),
}));

describe('AnalysisEngine', () => {
  let engine: AnalysisEngine;
  let mockFs: any;
  let mockGlob: any;

  beforeEach(() => {
    engine = new AnalysisEngine();
    mockFs = require('fs');
    mockGlob = require('glob');
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock file content
    mockFs.promises.readFile.mockResolvedValue('export function test() {}');
    mockFs.promises.stat.mockResolvedValue({ isFile: () => true });
  });

  describe('analyze', () => {
    it('should analyze a project successfully', async () => {
      const options: AnalysisOptions = {
        projectPath: '/test/project',
        includePatterns: ['**/*.ts'],
        excludePatterns: ['node_modules/**'],
        maxWorkers: 2,
        enableCache: false,
      };

      const result = await engine.analyze(options);

      expect(result).toBeDefined();
      expect(result.graph).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.filesAnalyzed).toBeGreaterThan(0);
      expect(result.stats.nodesCreated).toBeGreaterThan(0);
      expect(result.stats.processingTime).toBeGreaterThan(0);
    });

    it('should handle empty project', async () => {
      mockGlob.glob.mockResolvedValueOnce([]);

      const options: AnalysisOptions = {
        projectPath: '/empty/project',
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxWorkers: 1,
        enableCache: false,
      };

      const result = await engine.analyze(options);

      expect(result.stats.filesAnalyzed).toBe(0);
      expect(result.stats.nodesCreated).toBe(0);
      expect(result.graph.getAllNodes().length).toBe(0);
    });

    it('should respect exclude patterns', async () => {
      mockGlob.glob.mockResolvedValueOnce(['/test/file1.ts', '/test/node_modules/file2.ts']);

      const options: AnalysisOptions = {
        projectPath: '/test/project',
        includePatterns: ['**/*.ts'],
        excludePatterns: ['node_modules/**'],
        maxWorkers: 1,
        enableCache: false,
      };

      const result = await engine.analyze(options);

      expect(result.stats.filesAnalyzed).toBe(1); // Only file1.ts should be processed
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.promises.readFile.mockRejectedValueOnce(new Error('File not found'));

      const options: AnalysisOptions = {
        projectPath: '/test/project',
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxWorkers: 1,
        enableCache: false,
      };

      await expect(engine.analyze(options)).resolves.toBeDefined();
    });

    it('should use cache when enabled', async () => {
      const options: AnalysisOptions = {
        projectPath: '/test/project',
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxWorkers: 1,
        enableCache: true,
      };

      // First analysis
      const result1 = await engine.analyze(options);
      
      // Second analysis should use cache
      const result2 = await engine.analyze(options);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // Both should have same results
      expect(result2.stats.nodesCreated).toBe(result1.stats.nodesCreated);
    });
  });

  describe('addAnalyzer', () => {
    it('should add a custom analyzer', () => {
      const customAnalyzer = {
        name: 'CustomAnalyzer',
        supportedExtensions: ['.custom'],
        analyze: jest.fn(),
      };

      engine.addAnalyzer(customAnalyzer);

      expect(engine['analyzers'].length).toBeGreaterThan(4); // Built-in analyzers + custom
    });
  });

  describe('performance', () => {
    it('should handle multiple workers efficiently', async () => {
      const options: AnalysisOptions = {
        projectPath: '/test/project',
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxWorkers: 4,
        enableCache: false,
      };

      const startTime = Date.now();
      const result = await engine.analyze(options);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in reasonable time
    });

    it('should process large number of files', async () => {
      const fileCount = 100;
      const filePaths = Array.from({ length: fileCount }, (_, i) => `/test/file${i}.ts`);
      mockGlob.glob.mockResolvedValueOnce(filePaths);

      const options: AnalysisOptions = {
        projectPath: '/test/project',
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxWorkers: 4,
        enableCache: false,
      };

      const result = await engine.analyze(options);

      expect(result.stats.filesAnalyzed).toBe(fileCount);
      expect(result.stats.processingTime).toBeLessThan(10000); // Should handle 100 files in reasonable time
    });
  });

  describe('error handling', () => {
    it('should handle analyzer errors gracefully', async () => {
      // Mock an analyzer that throws an error
      const errorAnalyzer = {
        name: 'ErrorAnalyzer',
        supportedExtensions: ['.ts'],
        analyze: jest.fn().mockRejectedValue(new Error('Analyzer error')),
      };

      engine.addAnalyzer(errorAnalyzer);

      const options: AnalysisOptions = {
        projectPath: '/test/project',
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxWorkers: 1,
        enableCache: false,
      };

      // Should not throw, but should complete with partial results
      await expect(engine.analyze(options)).resolves.toBeDefined();
    });

    it('should handle invalid project paths', async () => {
      const options: AnalysisOptions = {
        projectPath: '/nonexistent/path',
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxWorkers: 1,
        enableCache: false,
      };

      // Should handle gracefully
      await expect(engine.analyze(options)).resolves.toBeDefined();
    });
  });
});