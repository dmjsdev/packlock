const fs = require('fs');
const path = require('path');

/**
 * Generate HTML, CSS, and JS files in .packlock directory
 */
function generateFiles(outputDir, graph) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read template files
  const templatesDir = path.join(__dirname, '..', 'templates');
  
  const htmlTemplate = fs.readFileSync(path.join(templatesDir, 'index.html'), 'utf8');
  const cssTemplate = fs.readFileSync(path.join(templatesDir, 'index.css'), 'utf8');
  const jsTemplate = fs.readFileSync(path.join(templatesDir, 'index.js'), 'utf8');

  // Inject graph data into JS
  const jsContent = jsTemplate.replace(
    '/* GRAPH_DATA_PLACEHOLDER */',
    `const GRAPH_DATA = ${JSON.stringify(graph, null, 2)};`
  );

  // Write files
  fs.writeFileSync(path.join(outputDir, 'index.html'), htmlTemplate);
  fs.writeFileSync(path.join(outputDir, 'index.css'), cssTemplate);
  fs.writeFileSync(path.join(outputDir, 'index.js'), jsContent);
}

module.exports = {
  generateFiles
};
