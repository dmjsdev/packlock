const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Analyze sizes of packages in node_modules
 * Returns map of package name -> size in bytes (own files only)
 */
async function analyzeSizes(nodeModulesPath, packages) {
  const sizes = {};

  // Get all package names from lockfile
  const packageNames = Object.keys(packages).filter(name => name !== '__root__');

  // Check if this is a pnpm project
  const isPnpm = fsSync.existsSync(path.join(nodeModulesPath, '.pnpm'));

  // Analyze each package
  for (const pkgName of packageNames) {
    let pkgPath = path.join(nodeModulesPath, pkgName);
    
    try {
      // Handle symlinks (pnpm uses them)
      let stats = await fs.lstat(pkgPath);
      if (stats.isSymbolicLink()) {
        const realPath = await fs.readlink(pkgPath);
        pkgPath = path.isAbsolute(realPath) ? realPath : path.join(nodeModulesPath, realPath);
        stats = await fs.stat(pkgPath);
      }

      if (!stats.isDirectory()) {
        sizes[pkgName] = 0;
        continue;
      }

      // Calculate size (own files only, excluding nested node_modules)
      const size = await calculateDirectorySize(pkgPath, true);
      sizes[pkgName] = size;
    } catch (error) {
      // Package might not be installed or in different location
      sizes[pkgName] = 0;
    }
  }

  return sizes;
}

/**
 * Calculate total size of directory
 * @param {string} dirPath - Path to directory
 * @param {boolean} excludeNodeModules - Whether to exclude nested node_modules
 */
async function calculateDirectorySize(dirPath, excludeNodeModules = false) {
  let totalSize = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip nested node_modules if requested
      if (excludeNodeModules && entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively calculate subdirectory size
        totalSize += await calculateDirectorySize(fullPath, excludeNodeModules);
      } else if (entry.isFile()) {
        // Add file size
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Handle permission errors or missing directories
    return 0;
  }

  return totalSize;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  analyzeSizes,
  formatBytes
};
