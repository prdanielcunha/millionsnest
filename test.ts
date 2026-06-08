import http from 'http';

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users/EPymQj34Tof3smPuNd3Z8yM4Cw13/create-organization',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test' // Will fail on auth, but let's change server to mock auth temporarily or I can just see the logic.
    }
});
