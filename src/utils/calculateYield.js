
import { ethers, BigNumber } from "ethers";
import { MARKET_DELTA_QUERY, runGraphql } from './runGraphQL.js';
import { JsonRpcProvider } from '@ethersproject/providers';

const CHAIN_ID = 8453
const JSON_RPC_PROVIDER = import.meta.env.VITE_RPC_URL
const VAULT_ADDRESS = "0x1440D8BE4003BE42005d7E25f15B01f1635F7640";
const MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const MORPHO_ABI = [
  "function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
  "function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)"
];

// Hardcoded market ids
const MARKETS = [
  "0x1a3e69d0109bb1be42b80e11034bb6ee98fc466721f26845dc83b2aa8d979137",
  "0x1c21c59df9db44bf6f645d854ee710a8ca17b479451447e9f56758aee10a2fad",
  "0x45f3b5688e7ba25071f78d1ce51d1b893faa3c86897b12204cdff3af6b3611f8",
  "0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda",
  "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836",
  "0xb609f1d824d70a2127092333f591080be01555535c61d93252dd778e1fa88920"
]

export async function computeAPY() {
  // Dichiarazioni corrette e inizializzazione BigNumber
  let currentAllocation = {};
  let currentApy = 0;
  let totalSupply = BigNumber.from(0); 

  const provider = new JsonRpcProvider(JSON_RPC_PROVIDER);
  const morphoContract = new ethers.Contract(MORPHO_ADDRESS, MORPHO_ABI, provider);

  for (const marketId of MARKETS) {
    const positionResult = await morphoContract.position(marketId, VAULT_ADDRESS);
    const supplyShares = positionResult.supplyShares;
    currentAllocation[marketId] = supplyShares;
    totalSupply = totalSupply.add(supplyShares);
  }

  const DECIMALS = 18; 
  const powerOfTen = BigNumber.from(10).pow(DECIMALS); // 10^18

  const totalSupplyAdjusted = parseFloat(totalSupply.mul(powerOfTen).toString());

  if (totalSupplyAdjusted === 0) {
      console.warn("TotalSupply è zero, impossibile calcolare APY ponderata.");
      return 0;
  }

  for (const [marketId, allocationBigNumber] of Object.entries(currentAllocation)) {
    // Verifichiamo il tipo (Ethers v5 BigNumber)
    if (!BigNumber.isBigNumber(allocationBigNumber)) continue; 

    try {
      // Chiama GraphQL e estrai APY
      const result = await runGraphql(
        MARKET_DELTA_QUERY, 
        { "uniqueKey": marketId, "chainId": CHAIN_ID, }
      );

      const payload = result?.marketByUniqueKey;
      if (!payload) {
            throw new Error("Dati 'marketByUniqueKey' non trovati nella risposta.");
      }
      const apyNow = parseFloat(payload.state?.netSupplyApy ?? 0.0) * 100;

      const allocationAdjustedBigNumber = allocationBigNumber.mul(powerOfTen);
      const allocationAdjustedFloat = parseFloat(allocationAdjustedBigNumber.toString());
      const weight = allocationAdjustedFloat / totalSupplyAdjusted;

      currentApy += apyNow * weight;

    } catch (error) {
      console.error(`Errore su marketId ${marketId}:`, error.message);
    }
  }

  const finalApy = parseFloat(currentApy.toFixed(2));
  return finalApy;
}