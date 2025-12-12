#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseLockfile } = require('../lib/parser');
const { analyzeSizes } = require('../lib/analyzer');
const { runAudit } = require('../lib/audit');
const { buildGraph } = require('../lib/graph');
const { generateFiles } = require('../lib/generator');

async function main() {
  console.log('🔍 Analyzing project dependencies...\n');

  const cwd = process.cwd();
  const lockfilePath = path.join(cwd, 'package-lock.json');
  const nodeModulesPath = path.join(cwd, 'node_modules');
  const outputDir = path.join(cwd, '.packlock');

  // Check if package-lock.json exists
  if (!fs.existsSync(lockfilePath)) {
    console.error('❌ Error: package-lock.json not found in current directory');
    process.exit(1);
  }

  // Check if node_modules exists
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('❌ Error: node_modules not found. Run npm install first.');
    process.exit(1);
  }

  try {
    // Step 1: Parse package-lock.json
    console.log('📄 Parsing package-lock.json...');
    const lockfileData = parseLockfile(lockfilePath);
    console.log(`   Found ${Object.keys(lockfileData.packages).length} packages\n`);

    // Step 2: Analyze sizes
    console.log('📊 Analyzing package sizes...');
    const sizes = await analyzeSizes(nodeModulesPath, lockfileData.packages);
    console.log(`   Analyzed ${Object.keys(sizes).length} packages\n`);

    // Step 3: Run npm audit
    console.log('🔒 Running security audit...');
    const auditData = await runAudit(cwd);
    const vulnCount = Object.keys(auditData.vulnerabilities || {}).length;
    console.log(`   Found ${vulnCount} packages with vulnerabilities\n`);

    // Step 4: Build graph
    console.log('🌐 Building dependency graph...');
    const graph = buildGraph(lockfileData, sizes, auditData);
    console.log(`   Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges\n`);

    // Step 5: Generate HTML/CSS/JS
    console.log('✨ Generating visualization...');
    generateFiles(outputDir, graph);
    console.log(`   ✓ Files created in ${outputDir}\n`);

    const htmlPath = path.join(outputDir, 'index.html');
    console.log('🎉 Done! Open .packlock/index.html in your browser');
    console.log(`   File: ${htmlPath}\n`);
    
    // Optionally open in browser (can be disabled with --no-open)
    if (!process.argv.includes('--no-open')) {
      const { exec } = require('child_process');
      const openCmd = process.platform === 'darwin' ? 'open' : 
                      process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCmd} "${htmlPath}"`, (err) => {
        if (err) {
          console.log('   (Could not open browser automatically)');
        }
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
