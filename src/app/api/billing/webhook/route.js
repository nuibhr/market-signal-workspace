import {webhookHandler} from '../../../../billing/webhook.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request){return webhookHandler(request);}
