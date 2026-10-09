import { notFound } from 'next/navigation';
import { portfolioDetail } from '../../../coaches/store.mjs';
import { CoachPortfolio } from '../../../components/coach-dashboard.jsx';
import CoachPageShell from '../../../components/coach-page-shell.jsx';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'ผลงานพอร์ตจำลองของโค้ช | Nugaom AI Pick'};
export default async function Page({params}){
  const {id}=await params;
  try{await portfolioDetail(null,id);}catch(error){if(error.status===404)notFound();throw error;}
  return <CoachPageShell><CoachPortfolio id={id}/></CoachPageShell>;
}
