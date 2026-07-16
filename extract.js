const fs = require('fs');
const content = fs.readFileSync('dist/assets/Dashboard-e4fPTjSZ.js', 'utf8');
const idx = content.indexOf('const renderGettingStarted');
if (idx !== -1) {
    console.log(content.substring(idx - 100, idx + 1000));
} else {
    console.log('Not found');
}
