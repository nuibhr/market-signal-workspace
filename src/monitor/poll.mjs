// Schedule only after completion, so a slow request is never cancelled by its own poll.
export function pollAfterCompletion(action,{intervalMs=60000,schedule=setTimeout,cancel=clearTimeout,visibility=globalThis.document}={}) {
 let stopped=false,timer,running=false;
 const visible=()=>!visibility||visibility.visibilityState!=='hidden';
 const run=async()=>{
  if(stopped||running||!visible())return;
  running=true;
  try{await action();}finally{running=false;if(!stopped&&visible())timer=schedule(run,intervalMs);}
 };
 const changed=()=>{cancel(timer);if(visible())run();};
 visibility?.addEventListener('visibilitychange',changed);
 run();return()=>{stopped=true;cancel(timer);visibility?.removeEventListener('visibilitychange',changed);};
}
