export const runtime = 'edge';

export default async function handler(req) {
  return new Response(JSON.stringify({ pong: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
