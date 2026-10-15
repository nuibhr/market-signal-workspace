// One in-flight run per market. A slow US provider never blocks the next Thai/DR wake.
export function createLocalScanScheduler({runners,onResult=()=>{},onError=()=>{}}) {
  const running=new Map();
  return {
    dispatch(enabled,now=Date.now()) {
      const started=[];
      for(const market of enabled) {
        if(running.has(market)||!runners[market])continue;
        const job=Promise.resolve().then(()=>runners[market](now)).then(result=>onResult(market,result))
          .catch(error=>onError(market,error)).finally(()=>running.delete(market));
        running.set(market,job);started.push(market);
      }
      return started;
    },
    drain:()=>Promise.allSettled([...running.values()]),
    active:()=>[...running.keys()],
  };
}
