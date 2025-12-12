const fs = require('fs');
const path = require('path');

/**
 * Parse package-lock.json and extract dependencies structure
 * Supports lockfileVersion 1, 2, and 3
 */
function parseLockfile(lockfilePath) {
  const content = fs.readFileSync(lockfilePath, 'utf8');
  const lockfile = JSON.parse(content);

  const version = lockfile.lockfileVersion || 1;
  
  let packages = {};
  let dependencies = {};

  if (version === 1) {
    // v1 format: flat "dependencies" object
    dependencies = lockfile.dependencies || {};
    packages = flattenV1Dependencies(dependencies);
  } else if (version === 2 || version === 3) {
    // v2/v3 format: "packages" object with node_modules paths
    const rawPackages = lockfile.packages || {};
    
    // Extract dependencies from each package
    for (const [pkgPath, pkgData] of Object.entries(rawPackages)) {
      if (pkgPath === '') {
        // Root package
        packages['__root__'] = {
          name: lockfile.name || 'root',
          version: lockfile.version || '0.0.0',
          dependencies: pkgData.dependencies || {},
          devDependencies: pkgData.devDependencies || {},
          isDev: false,
          isRoot: true
        };
      } else {
        // Remove "node_modules/" prefix
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
