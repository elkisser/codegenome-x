#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { AnalysisEngine } from '@codegenome-x/core';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  .option('--debug', 'Enable debug output')
  .option('--json', 'Output as JSON')
  .option('--ignore-file <path>', 'Path to .codegenomeignore file')
  .action(async (path, options) => {
    const spinner = ora('🔍 Analyzing project structure...').start();

    try {
      const projectPath = resolve(path);
      const engine = new AnalysisEngine();

      const analysisOptions = {
        projectPath,
        enableCache: true,
        debug: options.debug || false,
        ignoreFile: options.ignoreFile,
      };

      const result = await engine.analyze(analysisOptions);
      const graph = result.graph;
      const stats = result.stats;
      const unused = result.unusedAnalysis;

      spinner.succeed('✅ Analysis completed');

      // JSON output
      if (options.json) {
        const outputData = {
          timestamp: new Date().toISOString(),
          projectPath,
          stats,
          graph: {
            nodes: graph.getAllNodes().length,
            edges: graph.getAllEdges().length,
          },
          unused,
        };
        console.log(JSON.stringify(outputData, null, 2));
        return;
      }

      // Beautiful table output
      console.log(chalk.bold.cyan('\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'));
      console.log(chalk.bold.cyan('┃') + chalk.bold.white(' 📊 CodeGenome X Analysis Results') + chalk.bold.cyan('        ┃'));
      console.log(chalk.bold.cyan('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'));

      // Statistics
      console.log(chalk.bold.cyan('\n📈 Statistics:'));
      console.log(chalk.gray('  ├─ Files analyzed:     ') + chalk.bold.yellow(stats.filesAnalyzed));
      console.log(chalk.gray('  ├─ Files ignored:      ') + chalk.bold.yellow(stats.filesIgnored));
      console.log(chalk.gray('  ├─ Files skipped:      ') + chalk.bold.yellow(stats.filesSkipped));
      console.log(chalk.gray('  ├─ Nodes created:      ') + chalk.bold.yellow(stats.nodesCreated));
      console.log(chalk.gray('  ├─ Edges created:      ') + chalk.bold.yellow(stats.edgesCreated));
      console.log(chalk.gray('  ├─ Processing time:    ') + chalk.bold.yellow(stats.processingTime + 'ms'));
      console.log(chalk.gray('  └─ Dead code:          ') + chalk.bold.red(stats.deadCodeEstimate + '%'));

      // Cache info
      if (stats.cacheHits > 0 || stats.cacheMisses > 0) {
        console.log(chalk.bold.cyan('\n⚡ Cache Performance:'));
        console.log(chalk.gray('  ├─ Cache hits:        ') + chalk.bold.green(stats.cacheHits));
        console.log(chalk.gray('  └─ Cache misses:      ') + chalk.bold.yellow(stats.cacheMisses));
      }

      // Edges by type
      if (Object.keys(stats.edgesByType).length > 0) {
        console.log(chalk.bold.cyan('\n🔗 Relationship Types:'));
        Object.entries(stats.edgesByType)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .forEach(([type, count], idx, arr) => {
            const isLast = idx === arr.length - 1;
            const prefix = isLast ? '└─' : '├─';
            console.log(chalk.gray(`  ${prefix} ${type}:`).padEnd(30) + chalk.bold.cyan(count));
          });
      }

      // Unused analysis
      if (unused && unused.unusedNodes.length > 0) {
        console.log(chalk.bold.cyan('\n🗑️  Unused Components:'));
        console.log(chalk.gray('  ├─ Unused nodes:      ') + chalk.bold.red(unused.unusedNodes.length));

        if (unused.deadServices.length > 0) {
          console.log(chalk.gray('  ├─ Dead services:     ') + chalk.bold.red(unused.deadServices.length));
        }

        if (unused.deadEndpoints.length > 0) {
          console.log(chalk.gray('  ├─ Dead endpoints:    ') + chalk.bold.red(unused.deadEndpoints.length));
        }

        if (unused.unreferencedExports.length > 0) {
          console.log(chalk.gray('  └─ Unreferenced:      ') + chalk.bold.red(unused.unreferencedExports.length));
        }
      }

      // Export results
      if (options.output) {
        const outputData = {
          timestamp: new Date().toISOString(),
          projectPath,
          stats,
          graph: {
            nodes: graph.getAllNodes().length,
            edges: graph.getAllEdges().length,
          },
          unused,
        };

        writeFileSync(options.output, JSON.stringify(outputData, null, 2));
        console.log(chalk.green('\n✅ Results exported to: ' + options.output));
      }

      console.log('\n');
    } catch (error) {
      spinner.fail('❌ Analysis failed');
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('Error: ') + errorMessage);
      
      if (options.debug) {
        console.error(chalk.red('Stack trace:'));
        console.error(error instanceof Error ? error.stack : 'No stack trace available');
      }
      
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate detailed analysis report')
  .argument('[path]', 'Project path to analyze', '.')
  .option('-o, --output <path>', 'Output file for report')
  .action(async (path, options) => {
    const spinner = ora('📝 Generating report...').start();

    try {
      const projectPath = resolve(path);
      const engine = new AnalysisEngine();

      const result = await engine.analyze({
        projectPath,
        enableCache: true,
        debug: false,
      });

      spinner.succeed('✅ Report generated');

      const outputFile = options.output || `codegenome-report-${Date.now()}.html`;
      const html = generateHTMLReport(result);

      writeFileSync(outputFile, html);
      console.log(chalk.green(`\n📄 Report saved to: ${outputFile}\n`));
    } catch (error) {
      spinner.fail('Report generation failed');
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('Error: ') + errorMessage);
      
      if (options.debug) {
        console.error(chalk.red('Stack trace:'));
        console.error(error instanceof Error ? error.stack : 'No stack trace available');
      }
      
      process.exit(1);
    }
  });

program.parse();

function generateHTMLReport(result: any): string {
  const stats = result.stats;
  const unused = result.unusedAnalysis || {};

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeGenome X - Analysis Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .content {
      padding: 40px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-card h3 {
      color: #667eea;
      margin-bottom: 10px;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .metric-card .value {
      font-size: 2.5em;
      font-weight: bold;
      color: #333;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #667eea;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .list-item {
      background: #f9f9f9;
      padding: 12px 16px;
      margin-bottom: 10px;
      border-left: 4px solid #667eea;
      border-radius: 4px;
    }
    .footer {
      background: #f5f5f5;
      padding: 20px 40px;
      text-align: center;
      color: #999;
      font-size: 0.9em;
    }
    .warning { color: #ff6b6b; }
    .success { color: #51cf66; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 CodeGenome X Analysis Report</h1>
      <p>Structural Analysis & Code Quality Metrics</p>
      <p style="margin-top: 10px; opacity: 0.9;">Generated on ${new Date().toLocaleString()}</p>
    </div>

    <div class="content">
      <div class="metric-grid">
        <div class="metric-card">
          <h3>Files Analyzed</h3>
          <div class="value success">${stats.filesAnalyzed}</div>
        </div>
        <div class="metric-card">
          <h3>Nodes Created</h3>
          <div class="value">${stats.nodesCreated}</div>
        </div>
        <div class="metric-card">
          <h3>Edges Created</h3>
          <div class="value">${stats.edgesCreated}</div>
        </div>
        <div class="metric-card">
          <h3>Dead Code %</h3>
          <div class="value warning">${stats.deadCodeEstimate}%</div>
        </div>
      </div>

      <div class="section">
        <h2>📊 Analysis Summary</h2>
        <div class="list-item">Files ignored: <strong>${stats.filesIgnored}</strong></div>
        <div class="list-item">Files skipped: <strong>${stats.filesSkipped}</strong></div>
        <div class="list-item">Processing time: <strong>${stats.processingTime}ms</strong></div>
        <div class="list-item">Unused components: <strong class="warning">${unused.unusedNodes?.length || 0}</strong></div>
      </div>

      <div class="section">
        <h2>🔗 Relationship Types</h2>
        ${
          Object.entries(stats.edgesByType || {})
            .map(([type, count]) => `<div class="list-item">${type}: <strong>${count}</strong></div>`)
            .join('')
        }
      </div>
    </div>

    <div class="footer">
      <p>CodeGenome X v1.0.0 • Professional Structural Analysis Engine</p>
    </div>
  </div>
</body>
</html>
  `;
}