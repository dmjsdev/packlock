const fs = require('fs');
const path = require('path');

/**
 * Parse lockfile (package-lock.json, pnpm-lock.yaml, or yarn.lock)
 * Supports: npm v1/v2/v3, pnpm, yarn
 */
function parseLockfile(lockfilePath) {
  const content = fs.readFileSync(lockfilePath, 'utf8');
  const filename = path.basename(lockfilePath);

  if (filename === 'package-lock.json') {
    return parseNpmLockfile(content);
  } else if (filename === 'pnpm-lock.yaml') {
    return parsePnpmLockfile(content);
  } else if (filename === 'yarn.lock') {
    return parseYarnLockfile(content, lockfilePath);
  } else {
    throw new Error(`Unknown lockfile format: ${filename}`);
  }
}

/**
 * Parse npm package-lock.json (v1, v2, v3)
 */
function parseNpmLockfile(content) {
  const lockfile = JSON.parse(content);

  const version = lockfile.lockfileVersion || 1;
  
  let packages = {};

  if (version === 1) {
    packages = flattenV1Dependencies(lockfile.dependencies || {});
  } else if (version === 2 || version === 3) {
    const rawPackages = lockfile.packages || {};
    
    for (const [pkgPath, pkgData] of Object.entries(rawPackages)) {
      if (pkgPath === '') {
        packages['__root__'] = {
          name: lockfile.name || 'root',
          version: lockfile.version || '0.0.0',
          dependencies: pkgData.dependencies || {},
          devDependencies: pkgData.devDependencies || {},
          isDev: false,
          isRoot: true
        };
      } else {
        const name = pkgPath.replace(/^node_modules\//, '');
        packages[name] = {
          name: name,
          version: pkgData.version || '0.0.0',
          dependencies: pkgData.dependencies || {},
          devDependencies: pkgData.devDependencies || {},
          isDev: pkgData.dev || false,
          isRoot: false
        };
      }
    }
  }

  return {
    version,
    packages,
    rootDependencies: lockfile.dependencies || {},
    rootDevDependencies: lockfile.devDependencies || {}
  };
}

/**
 * Parse pnpm-lock.yaml
 */
function parsePnpmLockfile(content) {
  const lines = content.split('\n');
  const packages = {};
  let rootDependencies = {};
  let rootDevDependencies = {};

  // First pass: find all sections
  let inImporters = false;
  let inPackages = false;
  let inSnapshots = false;
  let currentPackage = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1].length;

    // Track sections
    if (trimmed === 'importers:') {
      inImporters = true;
      inPackages = false;
      inSnapshots = false;
      continue;
    }
    if (trimmed === 'packages:') {
      inImporters = false;
      inPackages = true;
      inSnapshots = false;
      continue;
    }
    if (trimmed === 'snapshots:') {
      inImporters = false;
      inPackages = false;
      inSnapshots = true;
      continue;
    }

    // Parse root dependencies from importers
    if (inImporters && trimmed === '.:') {
      for (let j = i + 1; j < lines.length; j++) {
        const depLine = lines[j];
        const depTrimmed = depLine.trim();
        const depIndent = depLine.match(/^(\s*)/)[1].length;

        if (depIndent === 0) break;

        if (depTrimmed === 'dependencies:') {
          for (let k = j + 1; k < lines.length; k++) {
            const itemLine = lines[k];
            const itemIndent = itemLine.match(/^(\s*)/)[1].length;
            if (itemIndent < 6) break;

            const match = itemLine.match(/^\s+([^:]+?):\s*$/);
            if (match) {
              const pkg = match[1].trim();
              // Get version from next line
              for (let m = k + 1; m < lines.length; m++) {
                const versionLine = lines[m];
                const versionIndent = versionLine.match(/^(\s*)/)[1].length;
                if (versionIndent < 8) break;

                const versionMatch = versionLine.match(/version:\s*(\S+)/);
                if (versionMatch) {
                  rootDependencies[pkg] = versionMatch[1];
                  break;
                }
              }
            }
          }
        }

        if (depTrimmed === 'devDependencies:') {
          for (let k = j + 1; k < lines.length; k++) {
            const itemLine = lines[k];
            const itemIndent = itemLine.match(/^(\s*)/)[1].length;
            if (itemIndent < 6) break;

            const match = itemLine.match(/^\s+([^:]+?):\s*$/);
            if (match) {
              const pkg = match[1].trim();
              for (let m = k + 1; m < lines.length; m++) {
                const versionLine = lines[m];
                const versionIndent = versionLine.match(/^(\s*)/)[1].length;
                if (versionIndent < 8) break;

                const versionMatch = versionLine.match(/version:\s*(\S+)/);
                if (versionMatch) {
                  rootDevDependencies[pkg] = versionMatch[1];
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Parse packages section - just create package entries with versions
    if (inPackages) {
      if (indent === 2 && trimmed.endsWith(':')) {
        // This is a package entry
        let pkgKey = trimmed.slice(0, -1);
        if (pkgKey.startsWith("'") && pkgKey.endsWith("'")) {
          pkgKey = pkgKey.slice(1, -1);
        }

        if (pkgKey.includes('@')) {
          const lastAt = pkgKey.lastIndexOf('@');
          const version = lastAt > 0 ? pkgKey.substring(lastAt + 1) : '0.0.0';
          // Keep full name including scope (e.g., @eslint/js)
          const name = pkgKey.substring(0, lastAt);

          if (!packages[name]) {
            packages[name] = {
              name: name,
              version: version,
              dependencies: {},
              devDependencies: {},
              isDev: false,
              isRoot: false
            };
          }
        }
      }
    }

    // Parse snapshots section - this is where actual dependencies are listed (pnpm v9+)
    if (inSnapshots) {
      if (indent === 2 && trimmed.endsWith(':')) {
        // This is a snapshot entry
        let snapshotKey = trimmed.slice(0, -1);
        if (snapshotKey.startsWith("'") && snapshotKey.endsWith("'")) {
          snapshotKey = snapshotKey.slice(1, -1);
        }

        // Extract package name and version
        // Format: @scope/package@version or @scope/package@version(peer@version)
        if (snapshotKey.includes('@')) {
          let pkgKey = snapshotKey;
          
          // Remove peer dependency info in parentheses
          if (pkgKey.includes('(')) {
            pkgKey = pkgKey.substring(0, pkgKey.indexOf('('));
          }

          const lastAt = pkgKey.lastIndexOf('@');
          const version = lastAt > 0 ? pkgKey.substring(lastAt + 1) : '0.0.0';
          const name = pkgKey.substring(0, lastAt);

          currentPackage = name;

          // Create package if it doesn't exist
          if (!packages[name]) {
            packages[name] = {
              name: name,
              version: version,
              dependencies: {},
              devDependencies: {},
              isDev: false,
              isRoot: false
            };
          }
        }
      } else if (currentPackage && indent === 4 && trimmed === 'dependencies:') {
        // Parse dependencies for current package in snapshots
        for (let k = i + 1; k < lines.length; k++) {
          const depLine = lines[k];
          const depIndent = depLine.match(/^(\s*)/)[1].length;

          if (depIndent <= 4) break;

          const depMatch = depLine.match(/^\s+([^:]+?):\s*(\S*)/);
          if (depMatch) {
            let depName = depMatch[1].trim();
            let depVer = depMatch[2].trim() || '0.0.0';
            
            // Remove quotes from dependency name if present
            if ((depName.startsWith("'") && depName.endsWith("'")) || 
                (depName.startsWith('"') && depName.endsWith('"'))) {
              depName = depName.slice(1, -1);
            }
            
            // Remove peer dependency info in parentheses from version
            if (depVer.includes('(')) {
              depVer = depVer.substring(0, depVer.indexOf('('));
            }
            
            packages[currentPackage].dependencies[depName] = depVer;
          }
        }
      }
    }
  }

  packages['__root__'] = {
    name: 'root',
    version: '0.0.0',
    dependencies: rootDependencies,
    devDependencies: rootDevDependencies,
    isDev: false,
    isRoot: true
  };

  return {
    version: 'pnpm',
    packages,
    rootDependencies,
    rootDevDependencies
  };
}

/**
 * Parse yarn.lock (v1 text format)
 */
function parseYarnLockfile(content, lockfilePath) {
  const lines = content.split('\n');
  const packages = {};
  const rootDependencies = {};
  const rootDevDependencies = {};
  let currentPackage = null;

  // Read package.json to get root dependencies
  const fs = require('fs');
  const path = require('path');
  try {
    // Get directory of yarn.lock file
    const lockDir = lockfilePath ? path.dirname(lockfilePath) : process.cwd();
    const pkgPath = path.join(lockDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      Object.assign(rootDependencies, pkg.dependencies || {});
      Object.assign(rootDevDependencies, pkg.devDependencies || {});
    }
  } catch (e) {
    // Ignore
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Package entry: "package@version:" or "@scope/package@version:" (not indented, ends with :)
    if (line[0] !== ' ' && trimmed.endsWith(':') && trimmed.includes('@')) {
      // Remove quotes and trailing colon
      let pkgKey = trimmed.slice(0, -1);
      if (pkgKey.startsWith('"') && pkgKey.endsWith('"')) {
        pkgKey = pkgKey.slice(1, -1);
      }
      
      // Split by comma if there are multiple aliases (e.g., "mime-types@^2.1.12, mime-types@~2.1.24, mime-types")
      const aliases = pkgKey.split(',').map(s => s.trim());
      
      // Take the first alias to extract version and name
      const firstAlias = aliases[0];
      
      // Find the last @ which separates name from version
      const lastAt = firstAlias.lastIndexOf('@');
      if (lastAt > 0) {
        const pkgName = firstAlias.substring(0, lastAt);
        const versionSpec = firstAlias.substring(lastAt + 1);
        
        currentPackage = pkgName;

        // Extract just the version (first one if multiple)
        const version = versionSpec.split(',')[0].replace(/^[\^~=<>]+/, '').trim();

        packages[currentPackage] = {
          name: currentPackage,
          version: version || versionSpec,
          dependencies: {},
          devDependencies: {},
          isDev: false,
          isRoot: false
        };

        // Parse dependencies for this package
        for (let j = i + 1; j < lines.length; j++) {
          const depLine = lines[j];
          const depTrimmed = depLine.trim();

          // Stop at next package (line not indented and ends with :)
          if (depLine[0] !== ' ' && depLine.length > 0) break;

          if (depTrimmed === 'dependencies:') {
            // Parse dependencies that follow (indented at 4 spaces)
            for (let k = j + 1; k < lines.length; k++) {
              const itemLine = lines[k];
              
              // Stop if we hit a line that's not indented or is empty
              if (itemLine.length === 0) break;
              if (itemLine[0] !== ' ') break;

              const itemTrimmed = itemLine.trim();
              if (!itemTrimmed) continue;

              // Parse dependency: "@scope/package" "version" or "package" "version"
              // The package name may include @ for scoped packages
              const depMatch = itemTrimmed.match(/^"?([^"\s]+)"?\s+"?([^"]+)"?$/);
              if (depMatch) {
                const depName = depMatch[1];
                const depVersion = depMatch[2];
                packages[currentPackage].dependencies[depName] = depVersion;
              } else {
                // If it doesn't match dep format, we've left the dependencies section
                break;
              }
            }
            break;
          }
        }
      }
    }
  }

  packages['__root__'] = {
    name: 'root',
    version: '0.0.0',
    dependencies: rootDependencies,
    devDependencies: rootDevDependencies,
    isDev: false,
    isRoot: true
  };

  return {
    version: 'yarn',
    packages,
    rootDependencies,
    rootDevDependencies
  };
}

/**
 * Convert v1 nested dependencies to flat structure
 */
function flattenV1Dependencies(deps, result = {}, prefix = '') {
  for (const [name, data] of Object.entries(deps)) {
    const fullName = prefix ? `${prefix}/node_modules/${name}` : name;
    
    result[fullName] = {
      name: fullName,
      version: data.version || '0.0.0',
      dependencies: data.requires || {},
      devDependencies: {},
      isDev: data.dev || false,
      isRoot: !prefix
    };

    // Recursively process nested dependencies
    if (data.dependencies) {
      flattenV1Dependencies(data.dependencies, result, fullName);
    }
  }

  return result;
}

module.exports = {
  parseLockfile
};
