import React, { useState, useEffect } from 'react';
import { getReferralCode, getReferralStats, linkReferralCode } from '../api/referrals';
import './ReferralRewards.css';
import { FiCopy, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const ReferralRewards = ({ walletAddress, onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [stats, setStats] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    console.log('🔍 ReferralRewards useEffect triggered:', { walletAddress, hasWallet: !!walletAddress });
    if (walletAddress) {
      console.log('✅ Wallet address exists, calling fetchData()');
      fetchData();
      
      // Check for pending referral code from URL
      const pendingCode = localStorage.getItem('pendingReferralCode');
      if (pendingCode && !stats?.hasReferral) {
        setInputCode(pendingCode);
        // Clear from localStorage after reading
        localStorage.removeItem('pendingReferralCode');
      }
    } else {
      console.log('❌ No wallet address, skipping fetchData()');
    }
  }, [walletAddress]);

  const fetchData = async () => {
    console.log('🚀 fetchData() called with walletAddress:', walletAddress);
    setLoading(true);
    try {
      console.log('📡 About to call getReferralCode and getReferralStats');
      const [codeData, statsData] = await Promise.all([
        getReferralCode(walletAddress),
        getReferralStats(walletAddress)
      ]);

      console.log('📥 Received data:', { codeData, statsData });
      if (codeData) {
        console.log('✅ Setting referral code:', codeData.referralCode, 'from codeData:', codeData);
        setReferralCode(codeData.referralCode);
      } else {
        console.log('⚠️ No codeData received');
      }
      if (statsData) {
        console.log('✅ Setting stats:', statsData);
        console.log('🔍 Stats breakdown:', {
          hasStats: !!statsData,
          activeBoosts: statsData.activeBoosts,
          activeBoostsLength: statsData.activeBoosts?.length,
          activeBoostsType: typeof statsData.activeBoosts,
          isArray: Array.isArray(statsData.activeBoosts),
          hasReferral: statsData.hasReferral,
          invited: statsData.invited,
          qualified: statsData.qualified,
          referrerBoosts: statsData.referrerBoosts,
          fullStats: statsData
        });
        
        // Combine boosts from both sources:
        // 1. activeBoosts - boosts from people you invited (you're the referrer)
        // 2. referrerBoosts / refereeBoosts - boost from the person who invited you (you're the referee)
        const boostsFromReferrals = Array.isArray(statsData.activeBoosts) 
          ? statsData.activeBoosts.map(boost => ({ ...boost, source: 'referral', fromReferrer: false }))
          : [];
        const boostsFromReferrer = Array.isArray(statsData.referrerBoosts) 
          ? statsData.referrerBoosts.map(boost => ({ ...boost, source: 'referrer', fromReferrer: true }))
          : Array.isArray(statsData.refereeBoosts) 
          ? statsData.refereeBoosts.map(boost => ({ ...boost, source: 'referrer', fromReferrer: true }))
          : [];
        const allBoosts = [...boostsFromReferrals, ...boostsFromReferrer];
        
        console.log('🔗 Combined boosts:', {
          fromReferrals: boostsFromReferrals.length,
          fromReferrer: boostsFromReferrer.length,
          total: allBoosts.length,
          allBoosts,
          rawActiveBoosts: statsData.activeBoosts,
          rawReferrerBoosts: statsData.referrerBoosts,
          rawRefereeBoosts: statsData.refereeBoosts
        });
        
        // Set stats with combined boosts
        setStats({
          ...statsData,
          activeBoosts: allBoosts
        });
      } else {
        console.log('⚠️ No statsData received');
      }
    } catch (error) {
      console.error('❌ Failed to fetch referral data:', error);
    } finally {
      console.log('🏁 fetchData() completed, setting loading to false');
      setLoading(false);
    }
  };

  const generateInviteLink = () => {
    if (!referralCode) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}?ref=${referralCode}`;
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast?.('success', 'Referral code copied to clipboard!');
  };

  const handleCopyLink = () => {
    const link = generateInviteLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    onShowToast?.('success', 'Invite link copied to clipboard!');
  };

  const handleSubmitCode = async () => {
    if (!inputCode.trim()) return;
    
    setSubmitting(true);
    try {
      await linkReferralCode(walletAddress, inputCode);
      onShowToast?.('success', 'Referral code linked successfully! You are now qualified for boosts.');
      setInputCode('');
      // Refresh stats to show new status
      fetchData();
    } catch (error) {
      onShowToast?.('error', error.message || 'Failed to link referral code');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (!walletAddress) {
    console.log('❌ ReferralRewards: No walletAddress, returning null');
    return null;
  }
  
  console.log('🎨 ReferralRewards rendering with:', { walletAddress, loading, referralCode, stats });

  return (
    <div className={`referral-rewards-container ${isExpanded ? 'expanded' : ''}`}>
      <div className="referral-header-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="rewards-title">Reward Hub</h3>
        <button 
          className="toggle-button" 
          aria-label={isExpanded ? 'Hide' : 'Show'}
          type="button"
        >
          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
        </button>
      </div>

      {isExpanded && (
        <>
          {loading ? (
            <div className="loading-spinner-small"></div>
          ) : (
            <>
              {/* Section 1: Your Referral Code */}
              <div className="rewards-card">
                <div className="section-label">Your Referral Code</div>
                <div className="code-display">
                  <span className="code-text">{referralCode || 'Generating...'}</span>
                  <button className="copy-btn" onClick={handleCopyCode} disabled={!referralCode}>
                    {copied ? <FiCheck /> : <FiCopy />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                
                {/* Invite Link Section */}
                <div className="section-label" style={{ marginTop: '16px', marginBottom: '16px' }}>
                  Your Invite Link
                </div>
                <div className="code-display">
                  <span className="code-text">{generateInviteLink() || 'Generating...'}</span>
                  <button className="copy-btn" onClick={handleCopyLink} disabled={!referralCode}>
                    {linkCopied ? <FiCheck /> : <FiCopy />} {linkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                
                <p className="description-text">
                  Share this code or link to earn +0.5% APY boost for 30 days when friends deposit $100+.
                </p>
              </div>

              {/* Section 2: Active Boosts */}
              <div className="rewards-card">
                <div className="section-label" style={{ marginBottom: '12px' }}>Your Boosts</div>
                
                {(() => {
                  console.log('🎯 Boosts render check:', {
                    hasStats: !!stats,
                    hasActiveBoosts: !!stats?.activeBoosts,
                    activeBoostsValue: stats?.activeBoosts,
                    activeBoostsLength: stats?.activeBoosts?.length,
                    isArray: Array.isArray(stats?.activeBoosts),
                    conditionResult: !!(stats?.activeBoosts && stats.activeBoosts.length > 0),
                    fullStats: stats
                  });
                  
                  if (stats?.activeBoosts && stats.activeBoosts.length > 0) {
                    console.log('✅ Rendering boosts grid with', stats.activeBoosts.length, 'boosts');
                    return (
                      <div className="boosts-grid">
                        {stats.activeBoosts.map((boost, index) => {
                          // Determine if boost is active based on endsAt date (API doesn't return status field)
                          const isActive = boost.endsAt ? new Date(boost.endsAt) > new Date() : true;
                          const status = isActive ? 'ACTIVE' : 'EXPIRED';
                          const statusLower = status.toLowerCase();
                          
                          console.log(`🎁 Rendering boost ${index}:`, {
                            boost,
                            id: boost.id,
                            type: boost.type,
                            status: boost.status,
                            apyBoost: boost.apyBoost,
                            endsAt: boost.endsAt,
                            isActive,
                            calculatedStatus: status,
                            className: `boost-item ${isActive ? 'active' : ''}`
                          });
                          // Determine boost label - check if this is from referrer (someone invited you) or from your referrals (you invited someone)
                          // If boost has a source field or we can detect it from other fields
                          const isFromReferrer = boost.source === 'referrer' || boost.role === 'referee' || boost.fromReferrer === true;
                          const boostLabel = boost.type === 'REFERRAL' 
                            ? (isFromReferrer ? 'Invited By Friend' : 'Friend Referral')
                            : boost.type === 'DEPOSIT' 
                            ? 'Deposit Boost' 
                            : 'Welcome Boost';
                          
                          return (
                            <div key={boost.id || index} className={`boost-item ${isActive ? 'active' : ''}`}>
                              <div className="boost-header">
                                <span className="boost-type">
                                  {boostLabel}
                                </span>
                                <span className="boost-apy">+{(boost.apyBoost * 100).toFixed(1)}% APY</span>
                              </div>
                              
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else {
                    console.log('⚠️ Rendering empty state - no boosts to display. Reason:', {
                      noStats: !stats,
                      noActiveBoosts: !stats?.activeBoosts,
                      emptyArray: stats?.activeBoosts?.length === 0,
                      notArray: !Array.isArray(stats?.activeBoosts)
                    });
                    return (
                      <div className="empty-state">
                        No active boosts properly qualified yet. Deposit $100+ to activate pending boosts.
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Section 3: Enter Code (if not linked) or Rewards (if linked) */}
              <div className="rewards-card">
                {!stats?.hasReferral ? (
                  <>
                    <div className="section-label">Have a referral code?</div>
                    <div className="referral-input-group">
                      <input
                        type="text"
                        className="referral-input"
                        placeholder="Enter code"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                      />
                      <button 
                        className="submit-btn"
                        onClick={handleSubmitCode}
                        disabled={submitting || !inputCode.trim()}
                      >
                        {submitting ? '...' : 'Apply'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="section-label">Total Rewards</div>
                    <div className="rewards-summary">
                      <span className="rewards-label">Accrued Earnings</span>
                      <span className="rewards-value">
                        ${stats?.rewards?.totalAccrued ? parseFloat(stats.rewards.totalAccrued).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ReferralRewards;

