# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-12-12

### Added
- Support for pnpm-lock.yaml
- Support for yarn.lock
- Automatic lockfile detection (package-lock.json, pnpm-lock.yaml, yarn.lock)
- Unified parser that handles all three package managers

## [0.1.0] - 2024-12-12

### Added
- Initial release
- Parse package-lock.json (v1, v2, v3 support)
- Analyze node_modules sizes (own files only)
- npm audit integration
- Force-directed graph visualization on Canvas
- Interactive features:
  - Zoom with mouse wheel
  - Pan by dragging
  - Click nodes for details
  - Hover highlighting
- Filtering:
  - All packages
  - Dependencies only
  - DevDependencies only
  - Search by name
- Color-coded vulnerability severity
- Auto-pause simulation when settled (performance optimization)
- Automatic deduplication of shared dependencies
- Auto-open in browser (with --no-open flag to disable)
- Statistics panel showing:
  - Total packages
  - Total size
  - Vulnerable packages count
- Details panel showing:
  - Package name and version
  - Size (formatted)
  - Type (production/development)
  - Security status
  - List of vulnerabilities
- Legend explaining color scheme
- Programmatic API for custom analysis
- Comprehensive documentation:
  - README.md with usage guide
  - DEVELOPMENT.md for contributors
  - EXAMPLES.md with use cases
- CLI tool with user-friendly output
- Self-contained HTML output (works offline)

### Technical Features
- Pure Node.js (no external dependencies for core functionality)
- Canvas-based rendering (60 FPS)
- Physics simulation with:
  - Repulsion forces between nodes
  - Spring forces along edges
  - Velocity damping
  - Collision avoidance
- Efficient graph building with O(n) deduplication
- Support for large projects (tested with 500+ packages)
- Cross-platform (macOS, Linux, Windows)

## [Unreleased]

### Planned
- WebGL rendering for very large graphs (1000+ nodes)
- Export as PNG/SVG
- Compare two package-lock files
- Show cumulative sizes (with all dependencies)
- Historical size tracking
- CI/CD integration examples
- Minimap for navigation
- Animated transitions when filtering
- Hierarchical/radial layout options
- Cluster related packages
- Package search with autocomplete
- Keyboard shortcuts
- Dark/light theme toggle
- Configuration file support
