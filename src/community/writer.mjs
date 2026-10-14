// One in-memory operation survives transport failures and rate-limited retries.
// No draft or credential is persisted in browser storage.
export async function sendCommunityMutation(body, {fetcher=globalThis.fetch, timeoutMs=20000, now=Date.now}={}) {
  const controller=new AbortController();
  let timer;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>{
    controller.abort();resolve({status:'uncertain',error:'REQUEST_TIMEOUT'});
  },timeoutMs);});
  const request=(async()=>{
    try {
      const response=await fetcher('/api/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:controller.signal});
      const payload=await response.json();
      if(response.ok&&payload?.ok===true)return {status:'confirmed',payload};
      if(response.ok||response.status>=500||response.status===408)return {status:'uncertain',error:'CONFIRMATION_UNAVAILABLE'};
      if(response.status===429) {
        const value=response.headers.get('Retry-After');
        const seconds=value?.trim()?Number(value):NaN;
        const retryAt=Number.isFinite(seconds)&&seconds>=0?now()+seconds*1000:Date.parse(value);
        return {status:'retry',error:'RATE_LIMITED',retryAt:Number.isFinite(retryAt)?Math.max(now(),retryAt):now()+60000};
      }
      return {status:'rejected',error:typeof payload?.error==='string'?payload.error:'REQUEST_REJECTED'};
    } catch {return {status:'uncertain',error:'CONFIRMATION_UNAVAILABLE'};}
  })();
  try {return await Promise.race([timeout,request]);} finally {clearTimeout(timer);}
}

export function createCommunityWriter({onChange=()=>{},onConfirmed=()=>{},makeId=()=>crypto.randomUUID(),now=Date.now,...transport}={}) {
  let pending=null;
  let state={busy:false,uncertain:false,error:'',retryAt:0};
  const update=next=>{state={...state,...next};onChange({...state});};
  async function attempt(task) {
    const alreadyUncertain=state.uncertain;
    update({busy:true,error:''});
    const outcome=await sendCommunityMutation(task.body,{...transport,now});
    if(outcome.status==='confirmed') {
      pending=null;
      update({busy:false,uncertain:false,error:'',retryAt:0});
      // Rendering callbacks cannot turn a confirmed write back into a transport failure.
      onConfirmed(outcome.payload,task.body);
      task.onSuccess?.(outcome.payload);
    } else {
      // A later rejection cannot prove that an earlier unanswered attempt failed.
      const uncertain=alreadyUncertain||outcome.status!=='rejected';
      pending=uncertain?task:null;
      update({busy:false,uncertain,error:outcome.error,retryAt:outcome.retryAt||0});
    }
    return outcome;
  }
  return {
    write(body,onSuccess) {
      if(state.busy||pending)return Promise.resolve({status:'ignored'});
      pending={body:{...body,operationId:makeId()},onSuccess};
      return attempt(pending);
    },
    retry() {
      if(state.busy||!pending||now()<state.retryAt)return Promise.resolve({status:'ignored'});
      return attempt(pending);
    },
    snapshot:()=>({...state}),
  };
}
