import ForexWorkspace from "../../components/forex/forex-workspace.jsx";
import {isAdmin} from "../../membership/store.mjs";
import { currentMember } from "../../membership/server.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Forex / CFD Command Center | Nugaom AI Pick",
};
export default async function MarketPage({ searchParams }) {
  const params = await searchParams;
  const member = await currentMember();
  return (
    <ForexWorkspace
      initialSymbol={typeof params.symbol === "string" ? params.symbol : null}
      viewer={member ? { displayName: member.display_name, pictureUrl: member.picture_url, dataOwner:isAdmin(member) } : null}
    />
  );
}
