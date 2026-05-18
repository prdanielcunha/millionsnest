import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
files.push('server.ts');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  content = content.replace(/(from\s+['"]\.\/|from\s+['"]\.\.\/)(.*?)(['"])/g, (match, p1, p2, p3) => {
    if (!p2.endsWith('.css') && !p2.endsWith('.js') && !p2.endsWith('.svg') && !p2.endsWith('.json')) {
      changed = true;
      return `${p1}${p2}.js${p3}`;
    }
    return match;
  });

  content = content.replace(/(import\(['"]\.\/|import\(['"]\.\.\/)(.*?)(['"]\))/g, (match, p1, p2, p3) => {
    if (!p2.endsWith('.css') && !p2.endsWith('.js') && !p2.endsWith('.svg') && !p2.endsWith('.json')) {
      changed = true;
      return `${p1}${p2}.js${p3}`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
