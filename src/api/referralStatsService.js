import { getReferralStats } from './referrals';

function combineReferralBoosts(stats = {}) {
  const boostsFromReferrals = Array.isArray(stats.activeBoosts)
    ? stats.activeBoosts.map(boost => ({ ...boost, source: 'referral', fromReferrer: false }))
    : [];

  const boostsFromReferrer = Array.isArray(stats.referrerBoosts)
    ? stats.referrerBoosts.map(boost => ({ ...boost, source: 'referrer', fromReferrer: true }))
    : Array.isArray(stats.refereeBoosts)
    ? stats.refereeBoosts.map(boost => ({ ...boost, source: 'referrer', fromReferrer: true }))
    : [];

  return [...boostsFromReferrals, ...boostsFromReferrer];
}

function calculateReferralBonusDecimal(boosts = []) {
  const now = new Date();
  const activeBoosts = boosts.filter(boost => (boost?.endsAt ? new Date(boost.endsAt) > now : true));
  return activeBoosts.reduce((sum, boost) => sum + (Number(boost?.apyBoost) || 0), 0);
}

export async function fetchReferralStatsNormalized(walletAddress) {
  if (!walletAddress) return null;

  const normalizedAddress = walletAddress.toLowerCase();

  try {
    const stats = await getReferralStats(normalizedAddress);
    if (!stats) return null;

    const combinedBoosts = combineReferralBoosts(stats);
    const referralBonusDecimal = calculateReferralBonusDecimal(combinedBoosts);
    const earlyBonusDecimal = Number(stats?.earlyBonusApy) || 0;
    const totalBonusPercent = (referralBonusDecimal + earlyBonusDecimal) * 100;

    return {
      ...stats,
      normalizedAddress,
      normalizedBoosts: combinedBoosts,
      referralBonusDecimal,
      referralBonusPercent: referralBonusDecimal * 100,
      earlyBonusDecimal,
      earlyBonusPercent: earlyBonusDecimal * 100,
      bonusPercent: totalBonusPercent, // legacy field for existing consumers
      totalBonusPercent
    };
  } catch (error) {
    console.error('❌ fetchReferralStatsNormalized: failed to fetch stats', error);
    return null;
  }
}
