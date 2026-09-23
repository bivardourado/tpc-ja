const fs = require('fs');
const path = require('path');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#357ABD" />
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="46" letter-spacing="-1">TPUBLI</text>
</svg>`;

fs.writeFileSync(path.join(__dirname, 'public', 'favicon.svg'), svgContent, 'utf8');
console.log('Created favicon.svg');

// Now replace references in all HTML files
function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          if (file.includes('node_modules') || file.includes('.git') || file.includes('dist')) {
            if (!--pending) done(null, results);
            return;
          }
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.html')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk(__dirname, function(err, results) {
  if (err) throw err;
  results.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace favicon.png with favicon.svg
    content = content.replace(/favicon\.png/g, 'favicon.svg');
    // Ensure the type is correct
    content = content.replace(/type="image\/png"/g, 'type="image/svg+xml"');
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated favicon in:', file);
    }
  });
});
