import {generateStrategyFeed} from '../../../../dr/strategy-feed.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
let cached,pending,expires=0;
async function respond(refresh=false) {
  try {
    if(!pending&&(refresh||!cached||Date.now()>=expires)) {
      pending=generateStrategyFeed().then(data=>{cached=data;expires=Date.now()+60000;return data;}).finally(()=>{pending=null;});
    }
    const data=pending?await pending:cached;
    return Response.json(data,{status:data.status==='unavailable'?503:200,headers});
  } catch {return Response.json({status:'unavailable',code:'SCAN_UNAVAILABLE'},{status:503,headers});}
}
export async function GET(){return respond();}
export async function POST(){return respond(true);}
