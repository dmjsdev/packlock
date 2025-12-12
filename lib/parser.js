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
  // Simple YAML parser for pnpm-lock (no external dependencies)
  const lines = content.split('\n');
  const packages = {};
  let current = null;
  let currentDeps = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // packages section
    if (trimmed.startsWith('packages:')) {
      for (let j = i + 1; j < lines.length; j++) {
        const pkgLine = lines[j];
        if (!pkgLine.startsWith('  ')) break;

        const match = pkgLine.match(/^\s+'([^']+)':/);
        if (match) {
          current = match[1];
          packages[current] = {
            name: current.split('/').pop(),
            version: '0.0.0',
            dependencies: {},
            devDependencies: {},
            isDev: false,
            isRoot: false
          };

          // Extract version if next line is version
          const nextLine = lines[j + 1];
          const versionMatch = nextLine.match(/version:\s*([^\s]+)/);
          if (versionMatch) {
            packages[current].version = versionMatch[1];
          }
        }
      }
      break;
    }
  }

  // Set root
  packages['__root__'] = {
    name: 'root',
    version: '0.0.0',
    dependencies: {},
    devDependencies: {},
    isDev: false,
    isRoot: true
  };

  return {
    version: 'pnpm',
    packages,
    rootDependencies: {},
    rootDevDependencies: {}
  };
}

/**
 * Parse yarn.lock (v1 text format)
 */
function parseYarnLockfile(content) {
  const lines = content.split('\n');
  const packages = {};
  let current = null;
  let isDev = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Package entry: "package@version:" or "package@^version:"
    if (trimmed && !trimmed.startsWith('#') && trimmed.endsWith(':') && !trimmed.startsWith('  ')) {
      const pkgMatch = trimmed.match(/^([^@]+)@(.+):$/);
      if (pkgMatch) {
        const name = pkgMatch[1];
        const version = pkgMatch[2].split(',')[0]; // First version if multiple

        current = name;
        packages[name] = {
          name: name,
          version: version,
          dependencies: {},
          devDependencies: {},
          isDev: isDev,
          isRoot: false
        };
      }
    }
  }

  // Set root
  packages['__root__'] = {
    name: 'root',
    version: '0.0.0',
    dependencies: {},
    devDependencies: {},
    isDev: false,
    isRoot: true
  };

  return {
    version: 'yarn',
    packages,
    rootDependencies: {},
    rootDevDependencies: {}
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
