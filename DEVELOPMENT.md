# Development Guide

## Project Structure

```
packlock/
├── bin/
│   └── packlock.js          # CLI entry point
├── lib/
│   ├── parser.js            # Parse package-lock.json (v1, v2, v3)
│   ├── analyzer.js          # Analyze node_modules sizes
│   ├── audit.js             # Run npm audit
│   ├── graph.js             # Build graph structure
│   └── generator.js         # Generate HTML/CSS/JS files
├── templates/
│   ├── index.html           # HTML template
│   ├── index.css            # CSS template
│   └── index.js             # Canvas graph renderer
├── test-project/            # Test project with dependencies
├── index.js                 # Main module exports
├── package.json
└── README.md
```

## Testing Locally

1. Create test project:
```bash
cd test-project
npm install
```

2. Run packlock:
```bash
node ../bin/packlock.js
```

3. Open `.packlock/index.html` in browser

## Publishing to npm

1. Update version in `package.json`
2. Test locally with `npm link`
3. Publish:
```bash
npm publish
```

## Algorithm Details

### Force-Directed Layout

Uses a physics-based simulation:

1. **Repulsion Force**: All nodes push each other away
   - `F = k / d²` where k is repulsion strength, d is distance
   - Prevents node overlap

2. **Spring Force**: Edges pull connected nodes together
   - `F = k * (d - L)` where L is desired length
   - Creates stable structure

3. **Damping**: Velocity reduced each frame
   - `v = v * damping`
   - Prevents endless oscillation

4. **Update Loop**:
   - Calculate forces
   - Update velocities
   - Update positions
   - Render
   - Repeat at 60 FPS

### Graph Building

1. Parse lockfile into flat structure
2. Create root node
3. Recursively traverse dependencies
4. **Deduplication**: Track seen packages, reuse nodes
5. Create edges for all dependency relationships

Result: DAG (Directed Acyclic Graph) with possible multiple edges to shared nodes

### Size Calculation

```javascript
function calculateSize(packagePath) {
  let total = 0;
  for each file in packagePath:
    if (file is directory && name !== 'node_modules'):
      total += calculateSize(file)
    else if (file is regular file):
      total += file.size
  return total;
}
```

Excludes nested `node_modules` to show only package's own files.

## Performance Optimizations

1. **Async file operations**: Use `fs.promises` for I/O
2. **Canvas rendering**: Hardware-accelerated
3. **Visibility culling**: Only process/render visible nodes
4. **Efficient force calculation**: O(n²) for repulsion, O(e) for springs
5. **Request animation frame**: Syncs with display refresh

## Future Improvements

### Short term
- [ ] Better initial layout (hierarchical, radial)
- [ ] Animated transitions when filtering
- [ ] Tooltip on hover (instead of just cursor change)
- [ ] Mini-map for navigation

### Medium term
- [ ] WebGL for large graphs (>1000 nodes)
- [ ] Cluster similar/related packages
- [ ] Export graph as image (PNG/SVG)
- [ ] Package comparison mode

### Long term
- [ ] Time-travel: compare lockfile versions
- [ ] CI/CD integration: fail on size/security thresholds
- [ ] Historical tracking: database of package sizes over time
- [ ] Machine learning: predict breaking changes

## Contributing

1. Fork the repo
2. Create feature branch
3. Make changes
4. Test with test-project
5. Submit PR

## Code Style

- 2 spaces indentation
- Semicolons
- Single quotes for strings
- Descriptive variable names
- Comments for complex logic

## License

MIT
