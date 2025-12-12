/* GRAPH_DATA_PLACEHOLDER */

// Configuration
const CONFIG = {
  NODE_RADIUS_MIN: 8,
  NODE_RADIUS_MAX: 60,
  REPULSION_STRENGTH: 5000,
  SPRING_STRENGTH: 0.01,
  SPRING_LENGTH: 100,
  DAMPING: 0.9,
  MAX_VELOCITY: 10,
  ZOOM_SPEED: 0.1,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
  SETTLE_THRESHOLD: 0.01 // Stop simulation when average velocity is below this
};

// State
let canvas, ctx;
let nodes = [];
let edges = [];
let transform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let selectedNode = null;
let hoveredNode = null;
let currentFilter = 'all'; // 'all', 'deps', 'dev'
let searchQuery = '';
let isSimulationRunning = true;

// Initialize
function init() {
  canvas = document.getElementById('graph-canvas');
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Setup event listeners
  setupEventListeners();
  
  // Process graph data
  processGraphData();
  
  // Start animation loop
  animate();
}

function resizeCanvas() {
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  // Center transform on first load
  if (transform.x === 0 && transform.y === 0) {
    transform.x = canvas.width / 2;
    transform.y = canvas.height / 2;
  }
}

function processGraphData() {
  // Convert graph data to internal format with physics properties
  
  // Find min/max sizes for scaling (excluding root with size 0)
  const sizes = GRAPH_DATA.nodes.filter(n => n.size > 0).map(n => n.size);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  
  nodes = GRAPH_DATA.nodes.map((node, i) => {
    // Calculate radius based on size using cubic root (as if 3D sphere volume)
    // If size is 1000x larger, radius is 10x larger (cube root of 1000 = 10)
    let radius;
    if (node.isRoot || node.size === 0) {
      radius = 15; // Fixed size for root and zero-size packages
    } else {
      // Cubic root scale: radius ∝ ∛(size)
      // Normalize to [0, 1] range using cubic roots
      const normalized = (Math.cbrt(node.size) - Math.cbrt(minSize)) / 
                        (Math.cbrt(maxSize) - Math.cbrt(minSize));
      radius = CONFIG.NODE_RADIUS_MIN + normalized * (CONFIG.NODE_RADIUS_MAX - CONFIG.NODE_RADIUS_MIN);
    }
    
    // Initialize position based on depth in tree
    let x, y;
    if (node.isRoot) {
      x = 0;
      y = 0;
    } else {
      // Spread nodes in a circle, with some randomness
      const angle = (i / GRAPH_DATA.nodes.length) * Math.PI * 2;
      const distance = 200 + Math.random() * 200;
      x = Math.cos(angle) * distance + (Math.random() - 0.5) * 100;
      y = Math.sin(angle) * distance + (Math.random() - 0.5) * 100;
    }
    
    return {
      ...node,
      x,
      y,
      vx: 0,
      vy: 0,
      radius,
      color: getNodeColor(node)
    };
  });
  
  edges = GRAPH_DATA.edges.map(edge => ({
    source: nodes[edge.source],
    target: nodes[edge.target]
  }));
  
  updateStats();
}

function getNodeColor(node) {
  if (node.isRoot) return '#8b5cf6'; // Purple for root
  
  switch (node.severity) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'moderate': return '#f97316';
    case 'low': return '#eab308';
    default: return '#22c55e';
  }
}

// Physics simulation
function applyForces() {
  const visibleNodes = getVisibleNodes();
  
  // Reset forces
  visibleNodes.forEach(node => {
    node.fx = 0;
    node.fy = 0;
  });
  
  // Repulsion between all nodes
  for (let i = 0; i < visibleNodes.length; i++) {
    for (let j = i + 1; j < visibleNodes.length; j++) {
      const nodeA = visibleNodes[i];
      const nodeB = visibleNodes[j];
      
      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      
      if (dist < 0.1) continue;
      
      const force = CONFIG.REPULSION_STRENGTH / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      
      nodeA.fx -= fx;
      nodeA.fy -= fy;
      nodeB.fx += fx;
      nodeB.fy += fy;
    }
  }
  
  // Spring forces along edges
  edges.forEach(edge => {
    if (!isNodeVisible(edge.source) || !isNodeVisible(edge.target)) return;
    
    const dx = edge.target.x - edge.source.x;
    const dy = edge.target.y - edge.source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.1) return;
    
    const force = (dist - CONFIG.SPRING_LENGTH) * CONFIG.SPRING_STRENGTH;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    
    edge.source.fx += fx;
    edge.source.fy += fy;
    edge.target.fx -= fx;
    edge.target.fy -= fy;
  });
  
  // Update velocities and positions
  visibleNodes.forEach(node => {
    if (node.isRoot) return; // Root stays in center
    
    node.vx = (node.vx + node.fx) * CONFIG.DAMPING;
    node.vy = (node.vy + node.fy) * CONFIG.DAMPING;
    
    // Limit velocity
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > CONFIG.MAX_VELOCITY) {
      node.vx = (node.vx / speed) * CONFIG.MAX_VELOCITY;
      node.vy = (node.vy / speed) * CONFIG.MAX_VELOCITY;
    }
    
    node.x += node.vx;
    node.y += node.vy;
  });
}

// Rendering
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);
  
  // Get highlighted nodes (selected + its dependencies)
  const highlightedNodes = selectedNode ? new Set(getDependencyTree(selectedNode).map(n => n.id)) : null;
  
  // Draw edges with arrows
  edges.forEach(edge => {
    if (!isNodeVisible(edge.source) || !isNodeVisible(edge.target)) return;
    
    const isHighlighted = highlightedNodes && 
      highlightedNodes.has(edge.source.id) && 
      highlightedNodes.has(edge.target.id);
    
    // Calculate arrow position (from source to target)
    const dx = edge.target.x - edge.source.x;
    const dy = edge.target.y - edge.source.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 0.1) return;
    
    // Normalize direction
    const dirX = dx / length;
    const dirY = dy / length;
    
    // Arrow ends at target node's edge
    const endX = edge.target.x - dirX * edge.target.radius;
    const endY = edge.target.y - dirY * edge.target.radius;
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(edge.source.x, edge.source.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = isHighlighted ? '#3b82f6' : '#334155';
    ctx.lineWidth = isHighlighted ? 2 : 1;
    ctx.globalAlpha = isHighlighted || !highlightedNodes ? 1 : 0.15;
    ctx.stroke();
    
    // Draw arrowhead
    const arrowSize = 8 / transform.scale;
    const angle = Math.atan2(dy, dx);
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle - Math.PI / 6),
      endY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle + Math.PI / 6),
      endY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = isHighlighted ? '#3b82f6' : '#334155';
    ctx.fill();
    
    ctx.globalAlpha = 1;
  });
  
  // Draw nodes
  getVisibleNodes().forEach(node => {
    const isHighlighted = highlightedNodes ? highlightedNodes.has(node.id) : true;
    const opacity = isHighlighted ? 1 : 0.15;
    
    // Shadow for depth
    ctx.shadowColor = `rgba(0, 0, 0, ${0.3 * opacity})`;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Border
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Highlight if selected or hovered
    if (node === selectedNode) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (node === hoveredNode) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    ctx.globalAlpha = opacity;
    
    // Draw label for all nodes
    // Font size is constant in screen space (inversely proportional to zoom)
    const screenFontSize = 12 / transform.scale;
    ctx.font = `bold ${screenFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Full name, no ellipsis
    const name = node.name;
    
    // Draw text with black outline (stroke) and white fill
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3 / transform.scale;
    ctx.strokeText(name, node.x, node.y);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, node.x, node.y);
    
    ctx.globalAlpha = 1;
  });
  
  ctx.restore();
}

function animate() {
  if (isSimulationRunning) {
    applyForces();
    
    // Check if simulation has settled
    const avgVelocity = calculateAverageVelocity();
    if (avgVelocity < CONFIG.SETTLE_THRESHOLD) {
      isSimulationRunning = false;
      console.log('Simulation settled');
    }
  }
  
  render();
  requestAnimationFrame(animate);
}

function calculateAverageVelocity() {
  const visibleNodes = getVisibleNodes();
  if (visibleNodes.length === 0) return 0;
  
  const totalVelocity = visibleNodes.reduce((sum, node) => {
    return sum + Math.sqrt(node.vx * node.vx + node.vy * node.vy);
  }, 0);
  
  return totalVelocity / visibleNodes.length;
}

// Filtering
function getVisibleNodes() {
  return nodes.filter(isNodeVisible);
}

function isNodeVisible(node) {
  // Always show root node to keep graph connected
  if (node.isRoot) return true;
  
  // Filter by type
  if (currentFilter === 'deps' && node.isDev) return false;
  if (currentFilter === 'dev' && !node.isDev) return false;
  
  // Filter by search - show node if it matches OR if it's in path to matching node
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    
    // Direct match
    if (node.name.toLowerCase().includes(query)) {
      return true;
    }
    
    // Check if this node is an ancestor of any matching node
    if (isAncestorOfMatch(node, query)) {
      return true;
    }
    
    return false;
  }
  
  return true;
}

// Check if node is an ancestor (parent/grandparent/etc) of any matching node
function isAncestorOfMatch(node, query) {
  const visited = new Set();
  
  function hasMatchingDescendant(currentNode) {
    if (visited.has(currentNode.id)) return false;
    visited.add(currentNode.id);
    
    // Find all children of current node
    const children = edges
      .filter(edge => edge.source === currentNode)
      .map(edge => edge.target);
    
    for (const child of children) {
      // If child matches search, current node should be visible
      if (child.name.toLowerCase().includes(query)) {
        return true;
      }
      
      // Recursively check child's descendants
      if (hasMatchingDescendant(child)) {
        return true;
      }
    }
    
    return false;
  }
  
  return hasMatchingDescendant(node);
}

// Event handlers
function setupEventListeners() {
  // Filter buttons
  document.getElementById('filter-all').addEventListener('click', () => setFilter('all'));
  document.getElementById('filter-deps').addEventListener('click', () => setFilter('deps'));
  document.getElementById('filter-dev').addEventListener('click', () => setFilter('dev'));
  
  // Search
  document.getElementById('search').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    updateStats();
  });
  
  // Canvas interactions
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('wheel', onWheel);
  canvas.addEventListener('click', onClick);
  
  // Details panel
  document.getElementById('close-details').addEventListener('click', closeDetails);
}

function setFilter(filter) {
  currentFilter = filter;
  
  // Update button states
  document.querySelectorAll('.filter-group .btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`filter-${filter}`).classList.add('active');
  
  // Restart simulation when filter changes
  isSimulationRunning = true;
  
  updateStats();
}

function onMouseDown(e) {
  isDragging = true;
  dragStart = {
    x: e.clientX - transform.x,
    y: e.clientY - transform.y
  };
}

function onMouseMove(e) {
  if (isDragging) {
    transform.x = e.clientX - dragStart.x;
    transform.y = e.clientY - dragStart.y;
    return;
  }
  
  // Check for hover
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
  const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;
  
  const hovered = getVisibleNodes().find(node => {
    const dx = node.x - mouseX;
    const dy = node.y - mouseY;
    return Math.sqrt(dx * dx + dy * dy) <= node.radius;
  });
  
  if (hovered !== hoveredNode) {
    hoveredNode = hovered;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  }
}

function onMouseLeave() {
  hoveredNode = null;
  canvas.style.cursor = 'grab';
}

function onMouseUp() {
  isDragging = false;
}

function onWheel(e) {
  e.preventDefault();
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Zoom towards mouse position
  const zoom = e.deltaY > 0 ? (1 - CONFIG.ZOOM_SPEED) : (1 + CONFIG.ZOOM_SPEED);
  const newScale = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, transform.scale * zoom));
  
  const factor = newScale / transform.scale;
  transform.x = mouseX - (mouseX - transform.x) * factor;
  transform.y = mouseY - (mouseY - transform.y) * factor;
  transform.scale = newScale;
}

function onClick(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
  const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;
  
  // Find clicked node
  const clicked = getVisibleNodes().find(node => {
    const dx = node.x - mouseX;
    const dy = node.y - mouseY;
    return Math.sqrt(dx * dx + dy * dy) <= node.radius;
  });
  
  if (clicked) {
    showDetails(clicked);
  } else {
    closeDetails();
  }
}

// Details panel
function showDetails(node) {
  selectedNode = node;
  
  document.getElementById('detail-name').textContent = node.name;
  document.getElementById('detail-version').textContent = node.version;
  document.getElementById('detail-size').textContent = node.sizeFormatted;
  document.getElementById('detail-type').textContent = node.isDev ? 'Development' : 'Production';
  
  // Security badge with color circle
  const securityEl = document.getElementById('detail-security');
  securityEl.className = 'security-badge ' + (node.severity === 'none' ? 'none' : node.severity);
  securityEl.textContent = node.severity === 'none' ? 'No vulnerabilities' : 
    node.severity.charAt(0).toUpperCase() + node.severity.slice(1);
  
  const vulnDiv = document.getElementById('detail-vulnerabilities');
  if (node.vulnerabilities && node.vulnerabilities.length > 0) {
    const vulnItems = node.vulnerabilities.map((v, index) => {
      let searchQuery, title, severityClass;
      
      if (typeof v === 'string') {
        searchQuery = `${node.name} ${node.version} ${v}`;
        title = v;
        severityClass = '';
      } else if (v.title) {
        const severity = v.severity || 'moderate';
        severityClass = severity.toLowerCase();
        searchQuery = `${node.name} ${node.version} ${v.title}`;
        title = v.title;
      } else {
        searchQuery = `${node.name} ${node.version} vulnerability`;
        title = 'Dependency with vulnerabilities';
        severityClass = '';
      }
      
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      const badgeClass = severityClass ? `vuln-badge vuln-badge-${severityClass}` : 'vuln-badge';
      const itemClass = severityClass ? `vuln-item vuln-${severityClass}` : 'vuln-item';
      
      return `<li class="${itemClass}" data-url="${googleUrl}" style="cursor: pointer;"><span class="${badgeClass}"></span><strong>${title}</strong></li>`;
    }).join('');
    
    vulnDiv.innerHTML = '<h4>Vulnerabilities:</h4><ul class="vuln-list">' + vulnItems + '</ul>';
    
    // Add click handlers to open Google search
    vulnDiv.querySelectorAll('.vuln-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        if (url) {
          window.open(url, '_blank');
        }
      });
    });
  } else {
    vulnDiv.innerHTML = '';
  }
  
  // Calculate dependency tree size
  const dependencyTree = getDependencyTree(node);
  const treeSize = dependencyTree.reduce((sum, n) => sum + n.size, 0);
  document.getElementById('detail-tree-size').textContent = formatBytes(treeSize) + 
    ` (${dependencyTree.length} package${dependencyTree.length !== 1 ? 's' : ''})`;
  
  document.getElementById('details-panel').classList.remove('hidden');
}

// Get all dependencies recursively (with deduplication)
function getDependencyTree(node) {
  const visited = new Set();
  const result = [];
  
  function traverse(currentNode) {
    if (visited.has(currentNode.id)) return;
    visited.add(currentNode.id);
    result.push(currentNode);
    
    // Find all edges where current node is source
    edges.forEach(edge => {
      if (edge.source === currentNode && isNodeVisible(edge.target)) {
        traverse(edge.target);
      }
    });
  }
  
  traverse(node);
  return result;
}

function closeDetails() {
  selectedNode = null;
  document.getElementById('details-panel').classList.add('hidden');
}

// Stats
function updateStats() {
  const visible = getVisibleNodes();
  const totalSize = visible.reduce((sum, node) => sum + node.size, 0);
  const vulnerable = visible.filter(node => node.severity !== 'none').length;
  
  document.getElementById('stats-packages').textContent = `Packages: ${visible.length}`;
  document.getElementById('stats-size').textContent = `Total Size: ${formatBytes(totalSize)}`;
  document.getElementById('stats-vulnerable').textContent = `Vulnerable: ${vulnerable}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
