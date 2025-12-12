#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projects = [
  { name: 'npm', dir: 'test-projects/npm-project' },
  { name: 'pnpm', dir: 'test-projects/pnpm-project' },
  { name: 'yarn', dir: 'test-projects/yarn-project' }
];

console.log('\n🧪 Running packlock tests...\n');
console.log('=' .repeat(70) + '\n');

projects.forEach(project => {
  const projectPath = path.join(__dirname, project.dir);
  
  console.log(`📦 Testing ${project.name.toUpperCase()} project`);
  console.log('-' .repeat(70));
  
  try {
    // Run packlock
    execSync(`node "${path.join(__dirname, 'bin/packlock.js')}" --no-open`, {
      cwd: projectPath,
      stdio: 'inherit'
    });
    
    // Read the generated index.html to extract GRAPH_DATA
    const htmlPath = path.join(projectPath, '.packlock/index.html');
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf8');
      
      // Extract GRAPH_DATA from html
      const graphMatch = html.match(/const GRAPH_DATA = ({[\s\S]*?});/);
      if (graphMatch) {
        const graphData = JSON.parse(graphMatch[1]);
        const nodeCount = graphData.nodes ? graphData.nodes.length : 0;
        const edgeCount = graphData.edges ? graphData.edges.length : 0;
        
        console.log(`\n✅ Results:`);
        console.log(`   📊 Graph nodes: ${nodeCount}`);
        console.log(`   🔗 Graph edges: ${edgeCount}`);
        console.log(`   📂 HTML: file://${htmlPath}`);
      }
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
  
  console.log('\n');
});

console.log('=' .repeat(70));
console.log('✨ Tests completed!\n');
