import fetch from 'node-fetch';

async function verify() {
  const res = await fetch('http://localhost:3000/api/v1/billing/products?t=123');
  const text = await res.text();
  console.log(res.status, res.headers.raw());
  console.log(text);
}

verify();
