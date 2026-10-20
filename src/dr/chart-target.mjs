import {ALL_ASSETS} from '../markets/catalog.mjs';
export function radarChartAsset(item) {
  const market=['SET','thai'].includes(item?.market)?'thai':['DR80','DR','dr'].includes(item?.market)?'dr':null;
  return ALL_ASSETS.find(asset=>asset.symbol===item?.symbol&&(!market||asset.id===market))??null;
}
