# Examples

## Basic Usage

### Analyze current project
```bash
cd your-project
npx packlock
```

### Don't open browser automatically
```bash
npx packlock --no-open
```

### Global installation
```bash
npm install -g packlock
cd your-project
packlock
```

## Use Cases

### 1. Find Large Dependencies
Use packlock to identify which packages are taking up the most space in your `node_modules`:
- Look for the largest bubbles in the graph
- Click on them to see exact sizes
- Consider alternatives or lazy loading

### 2. Security Audit
Visualize security vulnerabilities across your dependency tree:
- Red/Orange nodes indicate vulnerabilities
- Click to see specific CVEs
- Trace back to see which package introduced the vulnerable dependency

### 3. Dependency Analysis
Understand your project's dependency structure:
- See which packages have the most dependencies
- Identify shared dependencies (nodes with multiple incoming edges)
- Filter to see only production vs development dependencies

### 4. Bundle Size Optimization
Before deploying:
```bash
packlock
```
- Identify unexpectedly large packages
- Find duplicate dependencies
- Look for opportunities to reduce bundle size

### 5. Onboarding New Developers
Help new team members understand the project structure:
```bash
packlock
# Share the .packlock/index.html file
```
- Visual overview of all dependencies
- Interactive exploration
- No need to read package.json

## Programmatic Usage

### Basic API
```javascript
const packlock = require('packlock');

async function analyze() {
  // Parse lockfile
  const lockfileData = packlock.parseLockfile('./package-lock.json');
  console.log(`Found ${Object.keys(lockfileData.packages).length} packages`);
  
  // Analyze sizes
  const sizes = await packlock.analyzeSizes('./node_modules', lockfileData.packages);
  const totalSize = Object.values(sizes).reduce((a, b) => a + b, 0);
  console.log(`Total size: ${totalSize} bytes`);
  
  // Run audit
  const auditData = await packlock.runAudit('./');
  console.log(`Vulnerabilities: ${auditData.metadata.total}`);
  
  // Build graph
  const graph = packlock.buildGraph(lockfileData, sizes, auditData);
  console.log(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
  
  // Generate files
  packlock.generateFiles('./.packlock', graph);
  console.log('Generated visualization');
}

analyze();
```

### Custom Visualization
```javascript
const packlock = require('packlock');
const fs = require('fs');

async function customAnalysis() {
  const lockfileData = packlock.parseLockfile('./package-lock.json');
  const sizes = await packlock.analyzeSizes('./node_modules', lockfileData.packages);
  const auditData = await packlock.runAudit('./');
  const graph = packlock.buildGraph(lockfileData, sizes, auditData);
  
  // Custom analysis
  const largestPackages = graph.nodes
    .filter(n => !n.isRoot)
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
  
  console.log('Top 10 largest packages:');
  largestPackages.forEach((pkg, i) => {
    console.log(`${i + 1}. ${pkg.name}: ${pkg.sizeFormatted}`);
  });
  
  // Save as JSON
  fs.writeFileSync('./analysis.json', JSON.stringify({
    totalPackages: graph.nodes.length,
    totalSize: graph.metadata.totalSize,
    vulnerablePackages: graph.metadata.vulnerablePackages,
    largestPackages
  }, null, 2));
}

customAnalysis();
```

### CI/CD Integration
```javascript
const packlock = require('packlock');

async function checkSizeBudget() {
  const lockfileData = packlock.parseLockfile('./package-lock.json');
  const sizes = await packlock.analyzeSizes('./node_modules', lockfileData.packages);
  const graph = packlock.buildGraph(lockfileData, sizes, {});
  
  const totalSize = graph.metadata.totalSize;
  const maxSize = 50 * 1024 * 1024; // 50 MB
  
  if (totalSize > maxSize) {
    console.error(`❌ Bundle size ${totalSize} exceeds limit ${maxSize}`);
    process.exit(1);
  }
  
  console.log(`✅ Bundle size ${totalSize} is within limit`);
}

checkSizeBudget();
```

## Advanced Tips

### 1. Large Projects
For projects with 500+ packages:
- Use filters to reduce visual complexity
- Use search to find specific packages
- The simulation will auto-pause when settled (performance optimization)

### 2. Comparing Projects
```bash
cd project-a
packlock
cp .packlock/index.html ../project-a-graph.html

cd ../project-b
packlock
cp .packlock/index.html ../project-b-graph.html

# Open both in browser tabs to compare
```

### 3. Sharing Graphs
The generated HTML is self-contained:
```bash
packlock
# Share .packlock/index.html via email, Slack, etc.
# No server needed, works offline
```

### 4. Detecting Duplicate Dependencies
Look for packages that appear multiple times in the graph (different versions):
- They will show as separate nodes
- Connected to different parents
- Consider using `npm dedupe` to optimize

### 5. Development vs Production Split
```bash
# See only production dependencies
packlock
# In browser: Click "Dependencies" filter
# These are the packages that ship to users

# See only development dependencies  
# In browser: Click "DevDependencies" filter
# These are build tools, test frameworks, etc.
```

## Troubleshooting Examples

### Package not showing in graph
If a package from package-lock.json doesn't appear:
- It might not be installed in node_modules
- Run `npm install` to sync
- Check if package is hoisted to a different location

### Wrong sizes
If sizes seem incorrect:
- packlock shows own files only (excluding nested node_modules)
- Use filesystem tools to verify: `du -sh node_modules/package-name`
- Symlinks and hardlinks are counted at face value

### Slow performance
If visualization is slow:
- Large graphs (>500 nodes) may take time to settle
- Wait for simulation to auto-pause
- Use filters to reduce visible nodes
- Consider increasing CONFIG.SETTLE_THRESHOLD in index.js
