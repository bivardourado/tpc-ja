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
          if (file.endsWith('.js') || file.endsWith('.html')) {
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
    if (file.endsWith('replace.cjs') || file.endsWith('replace_time.cjs') || file.endsWith('replace_pwd.cjs')) return;

    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace the specific passwords
    content = content.replace(/'TPUBLI2025'/g, "'tpubli2026'");
    content = content.replace(/'EDIT2025'/g, "'tpubli2026'");
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated:', file);
    }
  });
});
