const { execSync } = require('child_process');

/**
 * Run npm audit and parse results
 * Returns vulnerability data mapped by package name
 */
async function runAudit(cwd) {
  try {
    // Run npm audit with JSON output
    const output = execSync('npm audit --json', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    const auditData = JSON.parse(output);
    
    // Process vulnerabilities into a more usable format
    const vulnerabilities = {};

    if (auditData.vulnerabilities) {
      // npm v7+ format
      for (const [pkgName, vulnData] of Object.entries(auditData.vulnerabilities)) {
        vulnerabilities[pkgName] = {
          name: pkgName,
          severity: vulnData.severity || 'unknown',
          via: vulnData.via || [],
          effects: vulnData.effects || [],
          range: vulnData.range || '*',
          nodes: vulnData.nodes || [],
          fixAvailable: vulnData.fixAvailable || false
        };
      }
    } else if (auditData.advisories) {
      // npm v6 format
      for (const [id, advisory] of Object.entries(auditData.advisories)) {
        const pkgName = advisory.module_name;
        
        if (!vulnerabilities[pkgName]) {
          vulnerabilities[pkgName] = {
            name: pkgName,
            severity: advisory.severity,
            via: [advisory.title],
            effects: [],
            range: advisory.vulnerable_versions,
            nodes: [],
            fixAvailable: false
          };
        } else {
          // Multiple vulnerabilities for same package - use highest severity
          const severities = ['critical', 'high', 'moderate', 'low', 'info'];
          const currentIdx = severities.indexOf(vulnerabilities[pkgName].severity);
          const newIdx = severities.indexOf(advisory.severity);
          
          if (newIdx < currentIdx) {
            vulnerabilities[pkgName].severity = advisory.severity;
          }
          
          vulnerabilities[pkgName].via.push(advisory.title);
        }
      }
    }

    return {
      vulnerabilities,
      metadata: {
        total: Object.keys(vulnerabilities).length,
        critical: countBySeverity(vulnerabilities, 'critical'),
        high: countBySeverity(vulnerabilities, 'high'),
        moderate: countBySeverity(vulnerabilities, 'moderate'),
        low: countBySeverity(vulnerabilities, 'low')
      }
    };
  } catch (error) {
    // npm audit returns non-zero exit code when vulnerabilities found
    // Try to parse the output anyway
    if (error.stdout) {
      try {
        const auditData = JSON.parse(error.stdout);
        
        // Same processing as above
        const vulnerabilities = {};
        
        if (auditData.vulnerabilities) {
          for (const [pkgName, vulnData] of Object.entries(auditData.vulnerabilities)) {
            vulnerabilities[pkgName] = {
              name: pkgName,
              severity: vulnData.severity || 'unknown',
              via: vulnData.via || [],
              effects: vulnData.effects || [],
              range: vulnData.range || '*',
              nodes: vulnData.nodes || [],
              fixAvailable: vulnData.fixAvailable || false
            };
          }
        }

        return {
          vulnerabilities,
          metadata: {
            total: Object.keys(vulnerabilities).length,
            critical: countBySeverity(vulnerabilities, 'critical'),
            high: countBySeverity(vulnerabilities, 'high'),
            moderate: countBySeverity(vulnerabilities, 'moderate'),
            low: countBySeverity(vulnerabilities, 'low')
          }
        };
      } catch (parseError) {
        console.warn('⚠️  Could not parse npm audit output, continuing without vulnerability data');
      }
    }

    // If audit fails completely, return empty results
    return {
      vulnerabilities: {},
      metadata: {
        total: 0,
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0
      }
    };
  }
}

function countBySeverity(vulnerabilities, severity) {
  return Object.values(vulnerabilities).filter(v => v.severity === severity).length;
}

module.exports = {
  runAudit
};
