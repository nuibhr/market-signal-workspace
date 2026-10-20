// Demo identities must never grant real membership, including on localhost.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const disabled = () => Response.json({error:'DEMO_LOGIN_DISABLED'}, {
  status:404, headers:{'Cache-Control':'private, no-store'},
});
export async function POST() { return disabled(); }
export async function DELETE() { return disabled(); }
