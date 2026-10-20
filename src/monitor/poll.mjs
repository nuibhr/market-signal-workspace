// Schedule only after completion, so a slow request is never cancelled by its own poll.
export function pollAfterCompletion(action,{intervalMs=15000,schedule=setTimeout,cancel=clearTimeout}={}) {
 let stopped=false,timer;
 const run=async()=>{try{await action();}finally{if(!stopped)timer=schedule(run,intervalMs);}};
 run();return()=>{stopped=true;cancel(timer);};
}
