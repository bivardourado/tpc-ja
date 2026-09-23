const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname);

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
          if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.css')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk(directoryPath, function(err, results) {
  if (err) throw err;
  results.forEach(file => {
    // Don't modify the replace script itself or package-lock.json (let npm handle lockfile)
    if (file.endsWith('replace.js') || file.endsWith('package-lock.json')) return;

    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replacements
    content = content.replace(/TPE\s*PETROLINA/gi, 'TPUBLI');
    content = content.replace(/tpe-petrolina/gi, 'tpubli');
    content = content.replace(/TPE/g, 'TPUBLI');
    content = content.replace(/\btpe\b/g, 'tpubli');
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated:', file);
    }
  });
});
