# Project Summary

## packlock - npm dependency graph visualizer

A command-line tool that generates interactive visualizations of npm dependency graphs with package sizes and security vulnerabilities.

### Stats
- **Lines of Code**: ~1000 lines
- **Files**: 17 files
- **Dependencies**: 0 (pure Node.js)
- **Supported Node**: >=14.0.0

### Architecture

```
CLI Tool (bin/packlock.js)
    ↓
Parser (lib/parser.js) → package-lock.json (v1,v2,v3)
    ↓
Analyzer (lib/analyzer.js) → node_modules sizes
    ↓
Auditor (lib/audit.js) → npm audit --json
    ↓
Graph Builder (lib/graph.js) → nodes + edges
    ↓
Generator (lib/generator.js) → .packlock/
    ↓
Templates (templates/*.html,css,js) → Interactive Canvas
```

### Key Features

1. **Parser** (`lib/parser.js`, 85 lines)
   - Supports lockfileVersion 1, 2, and 3
   - Extracts dependencies structure
   - Handles nested and hoisted packages

2. **Analyzer** (`lib/analyzer.js`, 74 lines)
   - Recursively scans node_modules
   - Calculates own size (excludes nested node_modules)
   - Async file operations for performance

3. **Auditor** (`lib/audit.js`, 121 lines)
   - Runs npm audit via child_process
   - Parses both v6 and v7+ formats
   - Handles errors gracefully (no audit data = continues)

4. **Graph Builder** (`lib/graph.js`, 72 lines)
   - Builds DAG with deduplication
   - Tracks nodes with Map for O(1) lookups
   - Creates edges for all dependency relationships

5. **Generator** (`lib/generator.js`, 26 lines)
   - Injects graph data into templates
   - Creates .packlock/ directory
   - Writes HTML/CSS/JS files

6. **Canvas Renderer** (`templates/index.js`, 462 lines)
   - Force-directed layout algorithm
   - Real-time physics simulation
   - Interactive controls (zoom, pan, click)
   - Auto-pause when settled
   - Filtering and search

7. **HTML Template** (`templates/index.html`, 60 lines)
   - Clean semantic structure
   - Controls for filtering
   - Details panel (slides in on click)
   - Legend for colors

8. **CSS Styles** (`templates/index.css`, 179 lines)
   - Dark theme
   - Responsive layout
   - Smooth transitions
   - Modern design system

### Algorithms

**Force-Directed Layout:**
```
For each frame:
  1. Calculate repulsion between all nodes: F = k/d²
  2. Calculate spring force along edges: F = k*(d-L)
  3. Update velocities with damping: v = (v + F) * damping
  4. Clamp velocities to max
  5. Update positions: pos += velocity
  6. Render nodes and edges
```

**Graph Building:**
```
1. Create root node
2. For each dependency:
   a. Check if node exists (Map lookup)
   b. If not, create node and recurse into its dependencies
   c. Add edge from parent to child
3. Result: DAG with shared nodes having multiple parents
```

**Size Calculation:**
```
function size(dir):
  total = 0
  for each entry in dir:
    if entry is file:
      total += filesize
    if entry is dir and name != "node_modules":
      total += size(entry)
  return total
```

### Performance

- **Parse lockfile**: < 100ms (JSON.parse)
- **Analyze sizes**: 1-5s (depends on node_modules size)
- **Run audit**: 1-3s (depends on network)
- **Build graph**: < 100ms (linear time)
- **Generate files**: < 50ms (file writes)
- **Render**: 60 FPS (Canvas 2D)

**Tested with:**
- Small projects: 10-50 packages (instant)
- Medium projects: 100-200 packages (2-3s)
- Large projects: 500+ packages (5-8s)

### File Sizes

```
index.html:    2.3 KB
index.css:     3.7 KB
index.js:      ~60 KB (includes graph data)
```

Total per project: ~70 KB

### Use Cases

1. **Bundle size optimization** - Find large dependencies
2. **Security audits** - Visualize vulnerable packages
3. **Dependency analysis** - Understand project structure
4. **Onboarding** - Help new developers explore codebase
5. **Documentation** - Share with team (HTML is portable)

### Future Enhancements

**High Priority:**
- [ ] WebGL for 1000+ packages
- [ ] Export as PNG/SVG
- [ ] Tooltip on hover
- [ ] Animated filtering transitions

**Medium Priority:**
- [ ] Compare lockfiles
- [ ] Show cumulative sizes
- [ ] Minimap navigation
- [ ] Keyboard shortcuts

**Low Priority:**
- [ ] Historical tracking
- [ ] CI/CD integration
- [ ] Configuration file
- [ ] Multiple layout algorithms

### Publishing

To publish to npm:
```bash
npm version patch  # or minor, major
npm publish
```

Package name: `packlock`
Registry: npmjs.com

### License

MIT - Free for any use

### Credits

Built with:
- Node.js (runtime)
- Canvas API (rendering)
- Force-directed graph algorithm (physics)
- npm audit (security data)

No external dependencies! 🎉
