import fetch from 'node-fetch';

async function verify() {
  const res = await fetch('http://localhost:3000/api/internal/sync-stripe-products', { method: 'POST' });
  const text = await res.text();
  console.log(res.status, res.headers.raw());
  console.log(text.substring(0, 500));
}

verify();
