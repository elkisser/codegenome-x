#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { AnalysisEngine } from '@codegenome-x/core';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

program
  .name('codegenome')
  .description('CodeGenome X - Professional structural analysis engine')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze project structure')
  .argument('[path]', 'Project path to analyze', '.')
  .option('-o, --output <path>', 'Output file for JSON results')
  .option('-f, --format <format>', 'Output format (json|table)', 'table')
  .option('--include <patterns...>', 'File patterns to include')
  .option('--exclude <patterns...>', 'File patterns to exclude')
  .option('--workers <number>', 'Number of worker threads', '4')
  .option('--no-cache', 'Disable caching')
  .action(async (path, options) => {
    const spinner = ora('Analyzing project structure...').start();
    
    try {
      const projectPath = resolve(path);
      const engine = new AnalysisEngine();
      
      const analysisOptions = {
        projectPath,
        includePatterns: options.include,
        excludePatterns: options.exclude,
        maxWorkers: parseInt(options.workers, 10),
        enableCache: options.cache,
      };
      
      const result = await engine.analyze(analysisOptions);
      const graph = result.graph;
      const stats = graph.getStats();
      
      spinner.succeed('Analysis completed');
      
      // Display results
      console.log(chalk.bold.blue('\n📊 CodeGenome X Analysis Results'));
      console.log(chalk.gray('═'.repeat(50)));
      
      console.log(chalk.cyan('📈 Statistics:'));
      console.log(`  Files analyzed: ${chalk.bold(result.stats.filesAnalyzed)}`);
      console.log(`  Nodes created: ${chalk.bold(result.stats.nodesCreated)}`);
      console.log(`  Edges created: ${chalk.bold(result.stats.edgesCreated)}`);
      console.log(`  Processing time: ${chalk.bold(result.stats.processingTime)}ms`);
      
      console.log(chalk.cyan('\n🎯 Node Types:'));
      Object.entries(stats.nodeTypes).forEach(([type, count]) => {
        console.log(`  ${chalk.yellow(type)}: ${chalk.bold(count)}`);
      });
      
      console.log(chalk.cyan('\n⚡ Impact Analysis:'));
      console.log(`  Average impact score: ${chalk.bold(stats.averageImpactScore.toFixed(2))}`);
      
      // Find high-impact nodes
      const highImpactNodes = graph.getAllNodes()
        .map(node => ({
          node,
          impact: graph.removeNodeSimulation(node.id).impactScore,
        }))
        .filter(({ impact }) => impact.level === 'High' || impact.level === 'Critical')
        .sort((a, b) => b.impact.score - a.impact.score)
        .slice(0, 5);
      
      if (highImpactNodes.length > 0) {
        console.log(chalk.yellow('\n⚠️  High Impact Nodes:'));
        highImpactNodes.forEach(({ node, impact }) => {
          const color = impact.level === 'Critical' ? chalk.red : chalk.yellow;
          console.log(`  ${color(node.name)} (${impact.level}) - Score: ${impact.score.toFixed(2)}`);
        });
      }
      
      // Export results if requested
      if (options.output) {
        const outputData = {
          timestamp: new Date().toISOString(),
          projectPath,
          stats: result.stats,
          graph: {
            nodes: graph.getAllNodes(),
            edges: graph.getAllEdges(),
            stats,
          },
          highImpactNodes: highImpactNodes.map(({ node, impact }) => ({
            node: {
              id: node.id,
              name: node.name,
              type: node.type,
              filePath: node.filePath,
            },
            impact,
          })),
        };
        
        writeFileSync(options.output, JSON.stringify(outputData, null, 2));
        console.log(chalk.green(`\n✅ Results exported to: ${options.output}`));
      }
      
      // Exit with error code if high risk detected
      const hasCriticalImpact = highImpactNodes.some(({ impact }) => impact.level === 'Critical');
      if (hasCriticalImpact) {
        console.log(chalk.red('\n🚨 Critical impact detected! Consider refactoring high-impact nodes.'));
        process.exit(1);
      }
      
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('simulate')
  .description('Simulate removal of a specific node')
  .argument('<node-id>', 'Node ID to simulate removal')
  .argument('[path]', 'Project path', '.')
  .action(async (nodeId, path) => {
    const spinner = ora('Simulating node removal...').start();
    
    try {
      const projectPath = resolve(path);
      const engine = new AnalysisEngine();
      
      const result = await engine.analyze({ projectPath });
      const graph = result.graph;
      
      const simulation = graph.removeNodeSimulation(nodeId);
      
      spinner.succeed('Simulation completed');
      
      console.log(chalk.bold.blue('\n🔮 Removal Simulation Results'));
      console.log(chalk.gray('═'.repeat(50)));
      
      console.log(chalk.cyan('Target Node:'), simulation.nodeId);
      console.log(chalk.cyan('Impact Score:'), chalk.bold(simulation.impactScore.score.toFixed(2)));
      console.log(chalk.cyan('Impact Level:'), chalk.bold(simulation.impactScore.level));
      
      if (simulation.affectedNodes.length > 0) {
        console.log(chalk.yellow(`\n📊 Affected Nodes (${simulation.affectedNodes.length}):`));
        simulation.affectedNodes.slice(0, 10).forEach(nodeId => {
          console.log(`  - ${nodeId}`);
        });
        if (simulation.affectedNodes.length > 10) {
          console.log(`  ... and ${simulation.affectedNodes.length - 10} more`);
        }
      }
      
      if (simulation.orphanedNodes.length > 0) {
        console.log(chalk.red(`\n🗑️  Orphaned Nodes (${simulation.orphanedNodes.length}):`));
        simulation.orphanedNodes.forEach(nodeId => {
          console.log(`  - ${nodeId}`);
        });
      }
      
      if (simulation.brokenEndpoints.length > 0) {
        console.log(chalk.red(`\n🔗 Broken Endpoints (${simulation.brokenEndpoints.length}):`));
        simulation.brokenEndpoints.forEach(nodeId => {
          console.log(`  - ${nodeId}`);
        });
      }
      
      if (simulation.servicesWithoutProvider.length > 0) {
        console.log(chalk.red(`\n⚙️  Services Without Provider (${simulation.servicesWithoutProvider.length}):`));
        simulation.servicesWithoutProvider.forEach(nodeId => {
          console.log(`  - ${nodeId}`);
        });
      }
      
      // Determine if removal is safe
      const isSafe = simulation.impactScore.level === 'Low' &&
                    simulation.orphanedNodes.length === 0 &&
                    simulation.brokenEndpoints.length === 0 &&
                    simulation.servicesWithoutProvider.length === 0;
      
      if (isSafe) {
        console.log(chalk.green('\n✅ Safe to remove - no significant dependencies detected'));
      } else {
        console.log(chalk.red('\n⚠️  Removal not recommended - significant dependencies detected'));
      }
      
    } catch (error) {
      spinner.fail('Simulation failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();