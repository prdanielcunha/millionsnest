const fs = require('fs');
const content = fs.readFileSync('dist/assets/Dashboard-e4fPTjSZ.js', 'utf8');
const idx = content.indexOf('dashboard.musicscale.center.getting_started.title');
if (idx !== -1) {
    console.log(content.substring(idx - 200, idx + 1000));
} else {
    console.log('Not found');
}
