

const graphql_url = "https://api.morpho.org/graphql";

export const MARKET_DELTA_QUERY = `

query MarketByUniqueKey($uniqueKey: String!, $chainId: Int) {
  marketByUniqueKey(uniqueKey: $uniqueKey, chainId: $chainId) {
    state {
      id
      blockNumber
      borrowAssets
      supplyAssets
      borrowAssetsUsd
      supplyAssetsUsd
      borrowShares
      supplyShares
      liquidityAssets
      liquidityAssetsUsd
      collateralAssets
      collateralAssetsUsd
      utilization
      apyAtTarget
      rateAtTarget
      supplyApy
      borrowApy
      netSupplyApy
      netBorrowApy
      fee
      price
      dailyPriceVariation
      timestamp
      size
      sizeUsd
      totalLiquidity
      totalLiquidityUsd
      avgSupplyApy
      avgNetSupplyApy
      avgBorrowApy
      avgNetBorrowApy
      dailySupplyApy
      dailyNetSupplyApy
      dailyBorrowApy
      dailyNetBorrowApy
      weeklySupplyApy
      weeklyNetSupplyApy
      weeklyBorrowApy
      weeklyNetBorrowApy
      biweeklySupplyApy
      biweeklyNetSupplyApy
      biweeklyBorrowApy
      biweeklyNetBorrowApy
      monthlySupplyApy
      monthlyNetSupplyApy
      monthlyBorrowApy
      monthlyNetBorrowApy
      quarterlySupplyApy
      quarterlyNetSupplyApy
      quarterlyBorrowApy
      quarterlyNetBorrowApy
      yearlySupplyApy
      yearlyNetSupplyApy
      yearlyBorrowApy
      yearlyNetBorrowApy
      allTimeSupplyApy
      allTimeNetSupplyApy
      allTimeBorrowApy
      allTimeNetBorrowApy
    }
  }
}
`;

// runGraphql.js o .ts
/**
 * Esegue una query GraphQL asincrona.
 * @param {string} url - L'URL dell'endpoint GraphQL.
 * @param {string} query - La stringa della query GraphQL.
 * @param {Object} variables - Un oggetto con le variabili per la query.
 * @param {number} [timeout=30000] - Timeout in millisecondi (nota: fetch non implementa un timeout diretto come requests in Python).
 * @returns {Promise<Object>} I dati restituiti dal campo 'data'.
 */
export async function runGraphql(query, variables, timeout = 30000) {
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            query: query, 
            variables: variables 
        }),
    };
    const response = await fetch(graphql_url, requestOptions);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
    }
    const payload = await response.json();
    if (payload.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
    }
    return payload.data;
}