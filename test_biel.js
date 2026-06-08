import http from 'http';

setTimeout(() => {
    http.get('http://localhost:3000/api/admin/debug-final-check?email=bielherique2003@gmail.com', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => console.log(JSON.stringify(JSON.parse(data), null, 2)));
    }).on('error', (err) => console.log('Error: ', err.message));
}, 2000);
