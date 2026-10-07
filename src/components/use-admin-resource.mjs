'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
export function useAdminResource(url,enabled=true){
  const [state,setState]=useState({data:null,loading:true,error:''});
  const [revision,setRevision]=useState(0),previous=useRef(null);
  const reload=useCallback(()=>setRevision(value=>value+1),[]);
  useEffect(()=>{
    if(!enabled)return;
    const controller=new AbortController(),changed=previous.current!==url;previous.current=url;
    setState(current=>({...current,data:changed?null:current.data,loading:true,error:''}));
    (async()=>{try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});const data=await response.json();
      if(!response.ok)throw new Error(data.error||'LOAD_FAILED');
      if(!controller.signal.aborted)setState({data,loading:false,error:''});
    }catch(error){if(!controller.signal.aborted)setState({data:null,loading:false,error:error.message||'LOAD_FAILED'});}})();
    return ()=>controller.abort();
  },[url,enabled,revision]);
  return {...state,reload};
}
