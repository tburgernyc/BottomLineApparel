/**
 * Lead capture and newsletter subscription API bridge.
 */
export async function submitSubscribe(data: {
    email: string;
    name?: string;
    size?: string;
    product_id?: string;
    product_name?: string;
    source: string;
}) {
    const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server error');
    }

    return await res.json();
}
