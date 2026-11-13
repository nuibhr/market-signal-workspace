export const dynamic='force-dynamic';
export function GET(){return Response.json({
 mode:'canonical-read-only',dailyHourBangkok:null,
 sharedMarkets:['thai','dr','us','forex','tfex'],
 availability:'per-record-rights-freshness-and-quality-gates',
 customerAccess:'read-only',realtimeVerified:false,
 personalBroker:{adapters:[],customerConnectionEnabled:false,credentialInputEnabled:false,csvUploadEnabled:false,isolatedPerMember:false,allBrokersSupported:false,personalRealtimeAcrossAllMarkets:false},
 ai:{provider:'project',quota:'membership-plan',unlimited:false}
},{headers:{'Cache-Control':'private, no-store'}});}
