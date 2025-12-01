import { Market, AccrualPosition } from "@morpho-org/blue-sdk";
import "@morpho-org/blue-sdk-viem/lib/augment/Market";
import "@morpho-org/blue-sdk-viem/lib/augment/Position";
import { createClient, http } from "viem";
import { base } from "viem/chains";

const JSON_RPC_PROVIDER = import.meta.env.VITE_RPC_URL;
const VAULT_ADDRESS = "0x1440D8BE4003BE42005d7E25f15B01f1635F7640";

const MARKETS = [
  "0x1a3e69d0109bb1be42b80e11034bb6ee98fc466721f26845dc83b2aa8d979137",
  "0x1c21c59df9db44bf6f645d854ee710a8ca17b479451447e9f56758aee10a2fad",
  "0x45f3b5688e7ba25071f78d1ce51d1b893faa3c86897b12204cdff3af6b3611f8",
  "0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda",
  "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836",
];

export async function computeAPY() {
  const client = createClient({
    chain: base,
    transport: http(JSON_RPC_PROVIDER),
  });

  let currentAllocation = {};
  let currentApy = 0;
  let totalSupply = 0n; 

  // 1. Fetch delle posizioni e calcolo Total Supply
  for (const marketId of MARKETS) {
    const position = await AccrualPosition.fetch(VAULT_ADDRESS, marketId, client);
    const supplyAssets = position.supplyAssets;
    currentAllocation[marketId] = supplyAssets;
    totalSupply += supplyAssets;
  }

  // 2. Controllo divisione per zero
  if (totalSupply === 0n) {
      console.warn("TotalSupply è zero, impossibile calcolare APY ponderata.");
      return 0;
  }

  // 3. Convertiamo totalSupply in Number per usarlo come denominatore nei calcoli dei pesi
  // (Precisione double è sufficiente per calcolare una percentuale di peso)
  const totalSupplyFloat = Number(totalSupply);
  for (const [marketId, allocationBigNumber] of Object.entries(currentAllocation)) {
    const market = await Market.fetch(marketId, client);
    const apyNow = parseFloat(market.apyAtTarget ?? 0.0) * 100;
    const weight = Number(allocationBigNumber) / totalSupplyFloat;
    currentApy += apyNow * weight;
  }

  return parseFloat(currentApy.toFixed(2));
}