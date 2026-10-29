import test from "node:test";
import assert from "node:assert/strict";
import { calculateStudioPlan, planPriceLines } from "./studio-plan.mjs";

const buy = { side:"buy", entry:"2651", stop:"2646", target:"2661", balance:"1000", riskPercent:"1", unitsPerLot:"100" };
test("buy and sell plans compute risk and reward using supplied contract size", () => {
  assert.deepEqual(calculateStudioPlan(buy), {riskAmount:10,theoreticalLots:.02,rewardRatio:2,stopDistance:5});
  assert.deepEqual(calculateStudioPlan({...buy,side:"sell",stop:"2656",target:"2641"}), {riskAmount:10,theoreticalLots:.02,rewardRatio:2,stopDistance:5});
  assert.equal(calculateStudioPlan({...buy,unitsPerLot:"1"}).theoreticalLots,2);
});
test("invalid and reversed plans never produce calculated results", () => {
  for (const change of [{entry:""}, {stop:"2651"}, {stop:"2652"}, {target:"2650"}, {side:"sell"}, {side:"bad"}, {unitsPerLot:"0"}, {riskPercent:"101"}, {balance:"Infinity"}]) {
    const result=calculateStudioPlan({...buy,...change});
    assert.ok(result.error, JSON.stringify(change));
    assert.equal(result.theoreticalLots,undefined);
  }
});
test("chart lines use the specified values and omit invalid or blank values", () => {
  assert.deepEqual(planPriceLines({...buy,stop:"",target:"0"}).map(({title,price})=>({title,price})),[{title:"Entry",price:2651}]);
  assert.deepEqual(planPriceLines(buy).map(({title,price})=>({title,price})),[{title:"Entry",price:2651},{title:"SL",price:2646},{title:"TP",price:2661}]);
});
