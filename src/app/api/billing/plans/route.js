import {plansHandler} from '../../../../billing/handlers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){return plansHandler();}
