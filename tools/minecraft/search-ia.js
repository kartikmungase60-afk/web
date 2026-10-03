const fs = require('fs');

function searchDir(dir) {
  let matches = [];
  if (!fs.existsSync(dir)) return matches;
  for (const item of fs.readdirSync(dir)) {
    const p = dir + '/' + item;
    if (fs.statSync(p).isDirectory()) {
      matches = matches.concat(searchDir(p));
    } else if (p.endsWith('.json')) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes('"ia:')) {
        matches.push(p);
      }
    }
  }
  return matches;
}

const res = searchDir('scratch_pack');
console.log('Total files containing "ia: -> ' + res.length);
res.forEach(f => console.log('  ' + f));
