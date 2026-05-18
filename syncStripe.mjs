import fetch from 'node-fetch';

async function sync() {
  const res = await fetch('http://localhost:3000/api/internal/sync-stripe-products', { method: 'POST' });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

sync();
