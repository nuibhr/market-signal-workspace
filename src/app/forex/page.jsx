import ForexWorkspace from "../../components/forex/forex-workspace.jsx";
export const metadata = {
  title: "Forex / CFD Command Center | Nugaom AI Pick",
};
export default async function MarketPage({ searchParams }) {
  const params = await searchParams;
  return (
    <ForexWorkspace
      initialSymbol={typeof params.symbol === "string" ? params.symbol : null}
    />
  );
}
