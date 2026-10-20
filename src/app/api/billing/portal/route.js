import {billingAction} from '../../../../billing/handlers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request){return billingAction(request,'portal');}
