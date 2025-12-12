const { formatBytes } = require('./analyzer');

/**
 * Build graph structure from lockfile data, sizes, and vulnerabilities
 */
function buildGraph(lockfileData, sizes, auditData) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map(); // Track which packages we've already added
  const processedDeps = new Set(); // Track which packages' dependencies we've already processed
  let nodeId = 0;

  const { packages } = lockfileData;
  const vulnerabilities = auditData.vulnerabilities || {};

  // Add root node
  const rootPkg = packages['__root__'];
  if (rootPkg) {
    const rootNode = {
      id: nodeId++,
      name: rootPkg.name,
      version: rootPkg.version,
      size: 0, // Root has no size
      sizeFormatted: '0 B',
      isDev: false,
      isRoot: true,
      severity: 'none',
      vulnerabilities: []
    };
    nodes.push(rootNode);
    nodeMap.set('__root__', rootNode.id);

    // Add edges from root to direct dependencies
    addDependencyEdges(rootPkg, rootNode.id, packages, sizes, vulnerabilities, nodes, edges, nodeMap, processedDeps, false);
    
    // Add edges from root to dev dependencies
    if (rootPkg.devDependencies) {
      addDependencyEdges({ dependencies: rootPkg.devDependencies }, rootNode.id, packages, sizes, vulnerabilities, nodes, edges, nodeMap, processedDeps, true);
    }
  }

  return {
    nodes,
    edges,
    metadata: {
      totalPackages: nodes.length - 1, // Exclude root
      totalSize: nodes.reduce((sum, n) => sum + n.size, 0),
      vulnerablePackages: nodes.filter(n => n.severity !== 'none').length,
      devPackages: nodes.filter(n => n.isDev).length
    }
  };

  function addDependencyEdges(pkg, sourceId, packages, sizes, vulnerabilities, nodes, edges, nodeMap, processedDeps, isDev) {
    const deps = pkg.dependencies || {};

    for (const [depName, depVersion] of Object.entries(deps)) {
      // Check if we already have this package in the graph
      let targetId = nodeMap.get(depName);

      if (targetId === undefined) {
        // Create new node
        const depPkg = packages[depName];
        const size = sizes[depName] || 0;
        const vuln = vulnerabilities[depName];

        const node = {
          id: nodeId++,
          name: depName,
          version: depPkg?.version || depVersion,
          size,
          sizeFormatted: formatBytes(size),
          isDev: isDev || depPkg?.isDev || false,
          isRoot: false,
          severity: vuln?.severity || 'none',
          vulnerabilities: vuln ? vuln.via : []
        };

        nodes.push(node);
        nodeMap.set(depName, node.id);
        targetId = node.id;

        // Recursively add dependencies of this package (only if not already processed)
        if (depPkg && depPkg.dependencies && !processedDeps.has(depName)) {
          processedDeps.add(depName);
          addDependencyEdges(depPkg, targetId, packages, sizes, vulnerabilities, nodes, edges, nodeMap, processedDeps, isDev);
        }
      }

      // Add edge from source to target (even if target already exists)
      edges.push({
        source: sourceId,
        target: targetId
      });
    }
  }
}

module.exports = {
  buildGraph
};

