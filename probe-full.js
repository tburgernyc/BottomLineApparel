// Wait for the full response from Vercel to see the 504 or whatever it returns.
const url = 'https://bottom-line-apparel.vercel.app/api/products';
console.log('Fetching:', url);
async function run() {
  const start = Date.now();
  try {
    const res = await fetch(url); // Infinite timeout
    const end = Date.now();
    console.log(`HTTP Status:`, res.status, res.statusText, `(${end - start}ms)`);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('FETCH ERROR:', err.message);
  }
}
run();
