'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import NugaomAssistant from './nugaom-assistant.jsx';
const Context=createContext(null);
export function useAssistantSymbol(symbol){const set=useContext(Context);useEffect(()=>{set?.(symbol);return()=>set?.(null);},[symbol,set]);}
export default function AssistantProvider({children}){const [symbol,setSymbol]=useState(null);return <Context.Provider value={setSymbol}>{children}<NugaomAssistant activeSymbol={symbol}/></Context.Provider>;}
