module.exports = {
  parseLockfile: require('./lib/parser').parseLockfile,
  analyzeSizes: require('./lib/analyzer').analyzeSizes,
  runAudit: require('./lib/audit').runAudit,
  buildGraph: require('./lib/graph').buildGraph,
  generateFiles: require('./lib/generator').generateFiles
};
