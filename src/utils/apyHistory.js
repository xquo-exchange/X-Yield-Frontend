import { ethers, BigNumber } from "ethers";
import { MARKET_DELTA_QUERY, runGraphql } from './runGraphQL.js';
import { JsonRpcProvider } from '@ethersproject/providers';

const CHAIN_ID = 8453;
const JSON_RPC_PROVIDER = import.meta.env.VITE_RPC_URL;
const VAULT_ADDRESS = "0x1440D8BE4003BE42005d7E25f15B01f1635F7640";
const MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const MORPHO_ABI = [
  "function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
  "function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)"
];

const MARKETS = [
  "0x1a3e69d0109bb1be42b80e11034bb6ee98fc466721f26845dc83b2aa8d979137",
  "0x1c21c59df9db44bf6f645d854ee710a8ca17b479451447e9f56758aee10a2fad",
  "0x45f3b5688e7ba25071f78d1ce51d1b893faa3c86897b12204cdff3af6b3611f8",
  "0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda",
  "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836",
  "0xb609f1d824d70a2127092333f591080be01555535c61d93252dd778e1fa88920"
];

// Historical APY query - fetches historical data points using TimeseriesOptions
const HISTORICAL_APY_QUERY = `
  query MarketHistory($uniqueKey: String!, $chainId: Int, $options: TimeseriesOptions) {
    marketByUniqueKey(uniqueKey: $uniqueKey, chainId: $chainId) {
      historicalState {
        netSupplyApy(options: $options) {
          x
          y
        }
      }
    }
  }
`;

// Cache for market weights (valid for 5 minutes)
let marketWeightsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Calculate current APY (same as computeAPY but returns detailed data)
 * Optimized with parallel fetching and caching
 */
async function getCurrentApyDetailed(useCache = true) {
  // Return cached data if still valid
  if (useCache && marketWeightsCache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return marketWeightsCache;
  }

  let currentAllocation = {};
  let totalSupply = BigNumber.from(0);

  const provider = new JsonRpcProvider(JSON_RPC_PROVIDER);
  const morphoContract = new ethers.Contract(MORPHO_ADDRESS, MORPHO_ABI, provider);

  // Fetch all market positions in parallel
  const positionPromises = MARKETS.map(marketId => 
    morphoContract.position(marketId, VAULT_ADDRESS).catch(error => {
      console.error(`Error fetching position for market ${marketId}:`, error);
      return null;
    })
  );

  const positionResults = await Promise.all(positionPromises);

  // Process positions
  positionResults.forEach((positionResult, index) => {
    if (!positionResult) return;
    const marketId = MARKETS[index];
    const supplyShares = positionResult.supplyShares;
    currentAllocation[marketId] = supplyShares;
    totalSupply = totalSupply.add(supplyShares);
  });

  const DECIMALS = 18;
  const powerOfTen = BigNumber.from(10).pow(DECIMALS);
  const totalSupplyAdjusted = parseFloat(totalSupply.mul(powerOfTen).toString());

  if (totalSupplyAdjusted === 0) {
    const result = { apy: 0, dataPoints: [] };
    if (useCache) {
      marketWeightsCache = result;
      cacheTimestamp = Date.now();
    }
    return result;
  }

  const now = Math.floor(Date.now() / 1000);

  // Fetch all market APY data in parallel
  const marketDataPromises = Object.entries(currentAllocation).map(async ([marketId, allocationBigNumber]) => {
    if (!BigNumber.isBigNumber(allocationBigNumber)) return null;

    try {
      const result = await runGraphql(
        MARKET_DELTA_QUERY,
        { "uniqueKey": marketId, "chainId": CHAIN_ID }
      );

      const payload = result?.marketByUniqueKey;
      if (!payload) return null;

      const apyNow = parseFloat(payload.state?.netSupplyApy ?? 0.0) * 100;
      const allocationAdjustedBigNumber = allocationBigNumber.mul(powerOfTen);
      const allocationAdjustedFloat = parseFloat(allocationAdjustedBigNumber.toString());
      const weight = allocationAdjustedFloat / totalSupplyAdjusted;

      return { marketId, apy: apyNow, weight, timestamp: now };
    } catch (error) {
      console.error(`Error fetching market ${marketId}:`, error.message);
      return null;
    }
  });

  const marketDataResults = await Promise.all(marketDataPromises);
  
  let currentApy = 0;
  const dataPoints = [];

  marketDataResults.forEach(data => {
    if (!data) return;
    currentApy += data.apy * data.weight;
    dataPoints.push(data);
  });

  const result = { apy: parseFloat(currentApy.toFixed(2)), dataPoints };
  
  // Cache the result
  if (useCache) {
    marketWeightsCache = result;
    cacheTimestamp = Date.now();
  }

  return result;
}

/**
 * Generate APY history data points for a given time range using real Morpho Protocol historical data
 * 
 * This function fetches real historical APY data from Morpho Protocol's GraphQL API
 * and aggregates it across all markets using the same weighting logic as the current APY calculation.
 */
export async function getApyHistory(timeRange = '24h') {
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  let startTimestamp, interval;

  // Determine time range parameters
  switch (timeRange) {
    case '24h':
      startTimestamp = now - (24 * 60 * 60); // 24 hours ago
      interval = 'HOUR';
      break;
    case '1w':
      startTimestamp = now - (7 * 24 * 60 * 60); // 7 days ago
      interval = 'DAY';
      break;
    case '1m':
      startTimestamp = now - (30 * 24 * 60 * 60); // 30 days ago
      interval = 'DAY';
      break;
    case '1y':
      startTimestamp = now - (365 * 24 * 60 * 60); // 365 days ago
      interval = 'MONTH';
      break;
    default:
      startTimestamp = now - (24 * 60 * 60);
      interval = 'HOUR';
  }

  // Get current market allocations (weights) for aggregation (use cache)
  // NOTE: We use CURRENT market weights to aggregate historical APY data.
  // This is an approximation - ideally we would use historical weights per timestamp,
  // but that would require fetching historical allocation data which is more complex.
  // This approach is reasonable if market allocations remain relatively stable over time.
  const { dataPoints: marketWeights } = await getCurrentApyDetailed(true);

  if (marketWeights.length === 0) {
    console.warn('No market allocations found, returning empty history');
    return [];
  }

  // TimeseriesOptions for GraphQL query
  const options = {
    startTimestamp,
    endTimestamp: now,
    interval
  };

  // Aggregate historical data points by timestamp
  // Key: timestamp (seconds), Value: weighted APY sum
  const aggregatedPoints = {};

  // Fetch historical data for ALL markets in parallel (major speedup!)
  const historicalDataPromises = marketWeights.map(async ({ marketId, weight }) => {
    try {
      const result = await runGraphql(
        HISTORICAL_APY_QUERY,
        {
          uniqueKey: marketId,
          chainId: CHAIN_ID,
          options
        }
      );

      const historicalData = result?.marketByUniqueKey?.historicalState?.netSupplyApy || [];

      if (historicalData.length === 0) {
        console.warn(`No historical data returned for market ${marketId}`);
        return null;
      }

      return { historicalData, weight };
    } catch (error) {
      console.error(`Error fetching historical data for market ${marketId}:`, error);
      return null;
    }
  });

  // Wait for all historical data requests in parallel
  const historicalResults = await Promise.all(historicalDataPromises);

  // Aggregate weighted APY values by timestamp
  historicalResults.forEach(result => {
    if (!result) return;
    
    const { historicalData, weight } = result;
    
    historicalData.forEach(({ x, y }) => {
      // x is timestamp in seconds, y is APY in decimal (0.05 = 5%)
      const timestamp = x;
      const apyPercentage = y * 100; // Convert to percentage
      const weightedApy = apyPercentage * weight;

      if (!aggregatedPoints[timestamp]) {
        aggregatedPoints[timestamp] = 0;
      }
      aggregatedPoints[timestamp] += weightedApy;
    });
  });

  // Convert aggregated points to array format
  const points = Object.entries(aggregatedPoints)
    .map(([timestamp, apy]) => {
      const timestampMs = parseInt(timestamp) * 1000; // Convert to milliseconds
      return {
        timestamp: timestampMs,
        apy: parseFloat(apy.toFixed(2)),
        date: new Date(timestampMs)
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  // If no historical data was found, return current APY as a single point
  if (points.length === 0) {
    const { apy: currentApy } = await getCurrentApyDetailed();
    return [{
      timestamp: Date.now(),
      apy: currentApy,
      date: new Date()
    }];
  }

  return points;
}

