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
    return parseYarnLockfile(content);
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

  let inImporters = false;
  let inPackages = false;
  let currentPackage = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1].length;

    if (trimmed === 'importers:') {
      inImporters = true;
      inPackages = false;
      continue;
    }

    if (trimmed === 'packages:') {
      inImporters = false;
      inPackages = true;
      continue;
    }

    // Parse importers (root dependencies)
    if (inImporters && trimmed === '.:') {
      for (let j = i + 1; j < lines.length; j++) {
        const depLine = lines[j];
        const depIndent = depLine.match(/^(\s*)/)[1].length;

        if (depIndent === 0 && depLine.trim()) break;

        const depTrimmed = depLine.trim();

        if (depTrimmed === 'dependencies:') {
          for (let k = j + 1; k < lines.length; k++) {
            const itemLine = lines[k];
            const itemIndent = itemLine.match(/^(\s*)/)[1].length;

            if (itemIndent < 6) break;

            const itemMatch = itemLine.match(/^\s+(\w+[^:]*[^\s]):\s*$/);
            if (itemMatch) {
              const pkg = itemMatch[1].trim();
              for (let m = k + 1; m < lines.length; m++) {
                const versionLine = lines[m];
                const versionMatch = versionLine.match(/version:\s*(\S+)/);
                if (versionMatch) {
                  rootDependencies[pkg] = versionMatch[1];
                  break;
                }
                if (!versionLine.startsWith('        ')) break;
              }
            }
          }
        }

        if (depTrimmed === 'devDependencies:') {
          for (let k = j + 1; k < lines.length; k++) {
            const itemLine = lines[k];
            const itemIndent = itemLine.match(/^(\s*)/)[1].length;

            if (itemIndent < 6) break;

            const itemMatch = itemLine.match(/^\s+(\w+[^:]*[^\s]):\s*$/);
            if (itemMatch) {
              const pkg = itemMatch[1].trim();
              for (let m = k + 1; m < lines.length; m++) {
                const versionLine = lines[m];
                const versionMatch = versionLine.match(/version:\s*(\S+)/);
                if (versionMatch) {
                  rootDevDependencies[pkg] = versionMatch[1];
                  break;
                }
                if (!versionLine.startsWith('        ')) break;
              }
            }
          }
        }
      }
    }

    // Parse packages section
    if (inPackages) {
      // Check if this is a package header (2 spaces, ends with :)
      if (indent === 2 && trimmed.endsWith(':') && !trimmed.startsWith('dependencies:')) {
        const pkgMatch = trimmed.match(/^'?([^'@]+(?:@[^']+)?)'?:\s*$/);
        if (pkgMatch) {
          currentPackage = pkgMatch[1];
          const lastAt = currentPackage.lastIndexOf('@');
          const version = lastAt > 0 ? currentPackage.substring(lastAt + 1) : '0.0.0';
          const name = currentPackage.split('/').pop();

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

      // Parse dependencies of current package
      if (currentPackage && trimmed === 'dependencies:' && indent === 4) {
        const name = currentPackage.split('/').pop();
        if (packages[name]) {
          for (let j = i + 1; j < lines.length; j++) {
            const depLine = lines[j];
            const depIndent = depLine.match(/^(\s*)/)[1].length;

            if (depIndent <= 4) break; // End of dependencies

            const depMatch = depLine.match(/^\s+(\w+[^:]*[^\s]):\s*(\d+[\w.]*)?/);
            if (depMatch) {
              packages[name].dependencies[depMatch[1]] = depMatch[2] || '';
            }
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
 * Extract version from pnpm package key (e.g. "express@4.18.0" or "@babel/core@7.0.0")
 */
function extractVersionFromKey(key) {
  const lastAt = key.lastIndexOf('@');
  if (lastAt > 0) {
    return key.substring(lastAt + 1);
  }
  return '0.0.0';
}

/**
 * Parse yarn.lock (v1 text format)
 */
function parseYarnLockfile(content) {
  const lines = content.split('\n');
  const packages = {};
  let rootDependencies = {};
  let rootDevDependencies = {};

  // Read package.json to determine which packages are direct deps
  try {
    const pkgPath = require.main.filename.includes('packlock.js') 
      ? process.cwd() + '/package.json'
      : './package.json';
    if (require('fs').existsSync(pkgPath)) {
      const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf8'));
      rootDependencies = { ...pkg.dependencies || {} };
      rootDevDependencies = { ...pkg.devDependencies || {} };
    }
  } catch (e) {
    // Fallback: parse from yarn.lock format "package@specifier:" lines
  }

  // If we couldn't get from package.json, try to extract from yarn.lock
  if (Object.keys(rootDependencies).length === 0 && Object.keys(rootDevDependencies).length === 0) {
    // In yarn.lock, top-level entries like "express@^4.18.0:" represent direct dependencies
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Top-level package entries (not indented, end with :)
      if (line[0] !== ' ' && trimmed.endsWith(':') && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^"?([^@\s"]+)@([^":]+)"?:\s*$/);
        if (match) {
          const name = match[1];
          const version = match[2];
          
          // This is a direct dependency (likely)
          if (!name.startsWith('@')) {
            rootDependencies[name] = version;
          }
        }
      }
    }
  }

  // Parse all packages from yarn.lock
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Package entry: not indented and ends with :
    if (line[0] !== ' ' && trimmed.endsWith(':')) {
      const pkgMatch = trimmed.match(/^"?([^@\s"]+)@([^":]+)"?:\s*$/);
      if (pkgMatch) {
        const name = pkgMatch[1];
        const version = pkgMatch[2].split(',')[0].replace(/^[\^~=<>]+/, '').trim();

        packages[name] = {
          name: name,
          version: version || pkgMatch[2],
          dependencies: {},
          devDependencies: {},
          isDev: false,
          isRoot: false
        };
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
