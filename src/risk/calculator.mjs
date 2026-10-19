/**
 * Multi-Market Risk & Position Calculator Engine
 * Supports Thai Stocks, TFEX S50, US Stocks, and Forex/Gold (XAU/USD).
 */

export function calculatePositionSize({
  market = 'thai', // 'thai' | 'tfex' | 'us' | 'forex' | 'gold'
  capital = 100000, // Account balance
  riskPercent = 1.0, // Risk per trade %
  side = 'long', // 'long' | 'short'
  entryPrice = 100,
  stopLossPrice = 95,
  targetMultiple = 2.0, // 2R default
}) {
  const cap = Number(capital) || 0;
  const riskPct = Number(riskPercent) || 1;
  const entry = Number(entryPrice) || 0;
  const sl = Number(stopLossPrice) || 0;
  const mult = Number(targetMultiple) || 2;

  if (cap <= 0 || entry <= 0 || sl <= 0) {
    return {
      isValid: false,
      error: 'ทุน ราคาเข้า และ Stop Loss ต้องมากกว่า 0',
      riskAmount: 0,
      positionSize: 0,
    };
  }

  // Validate side vs stop loss direction
  if (side === 'long' && sl >= entry) {
    return {
      isValid: false,
      error: 'ฝั่ง Long: Stop Loss ต้องต่ำกว่าราคาเข้า',
      riskAmount: 0,
      positionSize: 0,
    };
  }
  if (side === 'short' && sl <= entry) {
    return {
      isValid: false,
      error: 'ฝั่ง Short: Stop Loss ต้องสูงกว่าราคาเข้า',
      riskAmount: 0,
      positionSize: 0,
    };
  }

  const stopDistance = Math.abs(entry - sl);
  const stopPercent = (stopDistance / entry) * 100;
  const riskAmount = cap * (riskPct / 100);

  let targetPrice = side === 'long' ? entry + stopDistance * mult : entry - stopDistance * mult;
  if (targetPrice < 0) targetPrice = 0;

  let units = 0;
  let unitLabel = 'หุ้น';
  let positionValue = 0;
  let marginRequired = 0;
  let expectedLoss = 0;
  let expectedGain = 0;

  switch (market) {
    case 'thai': {
      // Thai stocks: 100 shares board lot
      unitLabel = 'หุ้น';
      const rawShares = riskAmount / stopDistance;
      const boardLots = Math.floor(rawShares / 100);
      units = Math.max(0, boardLots * 100);
      positionValue = units * entry;
      // Est fees ~ 0.157% each side
      const feeEst = positionValue * 0.00157 * 2;
      expectedLoss = units * stopDistance + feeEst;
      expectedGain = units * (stopDistance * mult) - feeEst;
      marginRequired = positionValue; // Cash/Cash Balance
      break;
    }

    case 'tfex': {
      // TFEX SET50 Index Futures: 1 contract = 200 THB / index point
      unitLabel = 'สัญญา';
      const pointValue = 200;
      const lossPerContract = stopDistance * pointValue;
      units = lossPerContract > 0 ? Math.floor(riskAmount / lossPerContract) : 0;
      const initialMarginPerContract = 15500; // Standard IM estimate for S50
      marginRequired = units * initialMarginPerContract;
      positionValue = units * entry * pointValue;
      expectedLoss = units * lossPerContract;
      expectedGain = units * (stopDistance * mult * pointValue);
      break;
    }

    case 'us': {
      // US Stocks & ETFs: USD denominated
      unitLabel = 'หุ้น';
      const rawShares = riskAmount / stopDistance;
      units = Math.floor(rawShares * 100) / 100; // Support fractional up to 2 decimal places
      positionValue = units * entry;
      expectedLoss = units * stopDistance;
      expectedGain = units * (stopDistance * mult);
      marginRequired = positionValue;
      break;
    }

    case 'gold': {
      // Gold (XAU/USD): 1 Standard Lot = 100 oz. $1 move = $100 per lot.
      unitLabel = 'Lots';
      const pointValue = 100; // $1 price move per 1.0 standard lot
      const lossPerLot = stopDistance * pointValue;
      const rawLots = lossPerLot > 0 ? riskAmount / lossPerLot : 0;
      // Step 0.01 lot
      units = Math.floor(rawLots * 100) / 100;
      expectedLoss = units * lossPerLot;
      expectedGain = units * (stopDistance * mult * pointValue);
      // Est 1:100 leverage margin: (Entry * 100) / 100 = Entry USD per lot
      marginRequired = units * entry;
      positionValue = units * entry * 100;
      break;
    }

    case 'forex': {
      // Forex Standard Lot (100,000 units): 1 pip (0.0001) = $10 per lot
      unitLabel = 'Lots';
      const pips = stopDistance / 0.0001;
      const lossPerLot = pips * 10;
      const rawLots = lossPerLot > 0 ? riskAmount / lossPerLot : 0;
      units = Math.floor(rawLots * 100) / 100;
      expectedLoss = units * lossPerLot;
      expectedGain = units * (lossPerLot * mult);
      // Est 1:100 leverage: 1,000 USD margin per 1.0 lot
      marginRequired = units * 1000;
      positionValue = units * 100000;
      break;
    }

    default:
      units = Math.floor(riskAmount / stopDistance);
      positionValue = units * entry;
      expectedLoss = units * stopDistance;
      expectedGain = units * stopDistance * mult;
      marginRequired = positionValue;
  }

  const riskRewardRatio = stopDistance > 0 ? (Math.abs(targetPrice - entry) / stopDistance).toFixed(2) : '0';

  return {
    isValid: true,
    market,
    side,
    capital: cap,
    riskPercent: riskPct,
    riskAmount: Math.round(riskAmount * 100) / 100,
    entryPrice: entry,
    stopLossPrice: sl,
    stopDistance: Math.round(stopDistance * 1000) / 1000,
    stopPercent: Math.round(stopPercent * 100) / 100,
    targetPrice: Math.round(targetPrice * 1000) / 1000,
    targetMultiple: mult,
    riskRewardRatio: `1:${riskRewardRatio}`,
    units,
    unitLabel,
    positionValue: Math.round(positionValue * 100) / 100,
    marginRequired: Math.round(marginRequired * 100) / 100,
    expectedLoss: Math.round(expectedLoss * 100) / 100,
    expectedGain: Math.round(expectedGain * 100) / 100,
  };
}
