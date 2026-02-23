const esbuild = require("esbuild");
const path = require("path");

async function main() {
  await esbuild.build({
    entryPoints: ['test-analysis.ts'],
    bundle: true,
    platform: 'node',
    target: 'node16',
    outfile: 'dist/test-analysis.js',
    external: ['vscode'],
    logLevel: 'info',
    alias: {
      'typescript': path.resolve(__dirname, 'node_modules/typescript'),
      'minimatch': path.resolve(__dirname, 'node_modules/minimatch'),
      'hash-wasm': path.resolve(__dirname, 'node_modules/hash-wasm')
    }
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
