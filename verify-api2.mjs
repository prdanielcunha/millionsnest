import fetch from 'node-fetch';

async function verify() {
  const res = await fetch('http://localhost:3000/api/v1/billing/products');
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

verify();
