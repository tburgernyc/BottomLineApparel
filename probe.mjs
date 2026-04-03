// Probe the live Vercel API and print the full response
const url = 'https://bottom-line-apparel.vercel.app/api/products';
console.log('Fetching:', url);
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  console.log('HTTP Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Response body:', text.slice(0, 2000));
} catch (err) {
  if (err.name === 'AbortError') {
    console.error('TIMEOUT: No response within 20 seconds. The serverless function is hanging.');
  } else {
    console.error('FETCH ERROR:', err.message);
  }
}
