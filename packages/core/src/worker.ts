import { parentPort, workerData } from 'worker_threads';
import { readFileSync } from 'fs';
import { Graph } from './graph.js';
import { TypeScriptAnalyzer } from './analyzers/typescript-analyzer.js';
import { ReactAnalyzer } from './analyzers/react-analyzer.js';
import { SymfonyAnalyzer } from './analyzers/symfony-analyzer.js';
import { EndpointAnalyzer } from './analyzers/endpoint-analyzer.js';

const analyzers = [
  new TypeScriptAnalyzer(),
  new ReactAnalyzer(),
  new SymfonyAnalyzer(),
  new EndpointAnalyzer(),
];

async function processFiles(files: string[], projectPath: string): Promise<{ nodes: any[], edges: any[] }> {
  const graph = new Graph();
  
  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Find appropriate analyzer
      const analyzer = analyzers.find(a =>
        a.supportedExtensions.some(ext => filePath.endsWith(ext))
      );
      
      if (analyzer) {
        const context = {
          projectPath,
          filePath,
          content,
          graph,
        };
        
        await analyzer.analyze(context);
      }
    } catch (error) {
      console.warn(`Failed to process file: ${filePath}`, error);
    }
  }
  
  return {
    nodes: graph.getAllNodes(),
    edges: graph.getAllEdges(),
  };
}

if (parentPort && workerData) {
  const { files, projectPath } = workerData;
  
  processFiles(files, projectPath)
    .then(result => {
      parentPort?.postMessage(result);
    })
    .catch(error => {
      parentPort?.postMessage({ error: error.message });
    });
}