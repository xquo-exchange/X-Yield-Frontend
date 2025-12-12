import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchApyHistory as fetchBackendApyHistory } from '../../api/apyService';
import { getApyHistory as getLocalApyHistory } from '../../utils/apyHistory';
import { getReferralStats } from '../../api/referrals';
import './InfoModal.css';

const INFO_CONTENT = {
  apy: {
    title: 'What is APY?',
    content: [
      'APY (Annual Percentage Yield) is your annualized return rate.',
      '• Calculated in real-time from Morpho Protocol markets',
      '• Your actual returns may vary with market conditions',
      '• The vault automatically optimizes across multiple markets'
    ]
  },
  xpls: {
    title: 'What is xPLS?',
    content: [
      'xPLS is your vault receipt token.',
      '• You receive xPLS when you deposit USDC',
      '• Your xPLS balance grows as the vault earns yield',
      '• Convert xPLS back to USDC when you withdraw'
    ]
  },
  earnings: {
    title: 'Projected Earnings',
    content: [
      'Estimates based on current APY.',
      '• These are projections only',
      '• Actual returns depend on market conditions',
      '• APY can change over time'
    ]
  },
  withdrawal: {
    title: 'Withdrawal Details',
    content: [
      '• Vault Tokens: Amount of xPLS you\'re withdrawing',
      '• USDC (est.): Estimated USDC you\'ll receive',
      '• Net Amount: Final amount after fees (if applicable)',
      '',
      'Note: Actual USDC may vary slightly due to exchange rates.'
    ]
  },
  vault: {
    title: 'How It Works',
    content: [
      '1. Deposit USDC → Get xPLS tokens',
      '2. Vault optimizes across Morpho markets',
      '3. Earn yield automatically',
      '4. Withdraw anytime',
      '',
      'Powered by Morpho Protocol on Base.'
    ]
  }
};

export const InfoButton = ({ type, className = '', onClick }) => {
  return (
    <button
      className={`info-button ${className}`}
      onClick={onClick}
      aria-label="More information"
      type="button"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M8 6V8M8 10H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  );
};

const InfoModal = ({ type, isOpen, onClose, walletAddress, currentApy }) => {
  const [apyHistory, setApyHistory] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [boosts, setBoosts] = useState([]);
  const [isLoadingBoosts, setIsLoadingBoosts] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouchY, setLastTouchY] = useState(null);
  const [touchStartTime, setTouchStartTime] = useState(null);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const modalContentRef = useRef(null);

  // Check if mobile (responsive)
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll when modal is open and reset modal transform
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      
      // Reset modal transform when opening
      if (modalContentRef.current) {
        modalContentRef.current.style.transform = '';
        modalContentRef.current.style.opacity = '';
        modalContentRef.current.style.transition = '';
        modalContentRef.current.style.scale = '';
        setLastScrollTop(0);
      }
      
      // Reset overlay opacity
      const overlay = document.querySelector('.info-modal-overlay');
      if (overlay) {
        overlay.style.opacity = '';
        overlay.style.transition = '';
      }
      
      return () => {
        // Restore body scroll when modal closes
        document.body.style.overflow = originalStyle;
        document.body.style.position = '';
        document.body.style.width = '';
      };
    }
  }, [isOpen]);

  // Track scroll position for scroll-to-close detection
  useEffect(() => {
    if (!isOpen || !isMobile || !modalContentRef.current) return;

    const handleScroll = () => {
      if (modalContentRef.current) {
        setLastScrollTop(modalContentRef.current.scrollTop);
      }
    };

    const modalElement = modalContentRef.current;
    modalElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      modalElement.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, isMobile]);

  // Handle swipe down to close on mobile - improved for seamless experience
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    setTouchStart(touch.clientY);
    setLastTouchY(touch.clientY);
    setTouchStartTime(Date.now());
    setIsDragging(false);
  };

  const handleTouchMove = (e) => {
    if (!isMobile || touchStart === null) return;
    
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const diff = currentY - touchStart;
    const velocity = lastTouchY !== null ? currentY - lastTouchY : 0;
    setLastTouchY(currentY);
    
    if (modalContentRef.current) {
      const isAtTop = modalContentRef.current.scrollTop === 0;
      
      // Only allow dragging down if we're at the top of the scroll
      if (isAtTop && diff > 0) {
        // Prevent default only when dragging down from top
        e.preventDefault();
        setIsDragging(true);
        
        // Use a more natural easing curve for the drag
        const dragAmount = Math.min(diff * 1.1, window.innerHeight * 0.8);
        
        // Smooth opacity fade based on drag distance
        const maxDrag = window.innerHeight * 0.3;
        const opacity = Math.max(0.3, 1 - (dragAmount / maxDrag));
        modalContentRef.current.style.opacity = opacity;
        
        // Add slight scale effect for depth
        const scale = Math.max(0.95, 1 - (dragAmount / (window.innerHeight * 2)));
        
        // Apply visual feedback by translating the modal
        modalContentRef.current.style.transform = `translateY(${dragAmount}px) scale(${scale})`;
        modalContentRef.current.style.transition = 'none';
      } else if (isAtTop && diff < -15) {
        // When at top and scrolling up (negative diff), close modal
        e.preventDefault();
        setIsDragging(true);
        
        // Apply visual feedback for upward scroll
        const dragAmount = Math.abs(diff);
        const opacity = Math.max(0.5, 1 - (dragAmount / 200));
        const scale = Math.max(0.97, 1 - (dragAmount / 1000));
        
        modalContentRef.current.style.transform = `translateY(${Math.max(diff, -50)}px) scale(${scale})`;
        modalContentRef.current.style.transition = 'none';
        modalContentRef.current.style.opacity = opacity;
      } else if (!isAtTop) {
        // If scrolling down in content, allow normal scroll but reset drag state
        if (isDragging) {
          setIsDragging(false);
          if (modalContentRef.current) {
            modalContentRef.current.style.transform = '';
            modalContentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
            modalContentRef.current.style.opacity = '';
          }
        }
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!isMobile || touchStart === null) return;
    
    const touch = e.changedTouches[0];
    const touchEndY = touch.clientY;
    const diff = touchEndY - touchStart;
    const timeDiff = Date.now() - touchStartTime;
    const velocity = timeDiff > 0 ? diff / timeDiff : 0;
    
    // Check if we're at top for upward scroll detection
    const isAtTop = modalContentRef.current?.scrollTop === 0;
    
    // Dynamic threshold based on velocity (faster swipe = lower threshold)
    const baseThreshold = 100;
    const velocityThreshold = Math.abs(velocity) > 0.5 ? 50 : baseThreshold;
    
    // Close conditions:
    // 1. Dragging down and meets threshold
    // 2. At top and scrolling up (negative diff) with sufficient distance
    const shouldCloseDown = diff > velocityThreshold || (diff > 50 && velocity > 0.3);
    const shouldCloseUp = isAtTop && diff < -30; // Upward scroll at top
    
    if (isDragging && (shouldCloseDown || shouldCloseUp)) {
      // Close modal with smooth animation
      if (modalContentRef.current) {
        const finalTransform = `translateY(${window.innerHeight}px) scale(0.9)`;
        modalContentRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        modalContentRef.current.style.transform = finalTransform;
        modalContentRef.current.style.opacity = '0';
        
        // Also fade overlay
        const overlay = modalContentRef.current.closest('.info-modal-overlay');
        if (overlay) {
          overlay.style.transition = 'opacity 0.25s ease-out';
          overlay.style.opacity = '0';
        }
        
        setTimeout(() => {
          onClose();
        }, 250);
      } else {
        onClose();
      }
    } else if (isDragging) {
      // Snap back smoothly if not enough distance
      if (modalContentRef.current) {
        modalContentRef.current.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out';
        modalContentRef.current.style.transform = '';
        modalContentRef.current.style.opacity = '';
      }
    }
    
    // Reset all touch state
    setTouchStart(null);
    setLastTouchY(null);
    setTouchStartTime(null);
    setIsDragging(false);
  };

  const normalizeBackendHistory = (history) => {
    if (!Array.isArray(history)) {
      console.warn('⚠️ normalizeBackendHistory: history is not an array', typeof history, history);
      return [];
    }
    
    if (history.length === 0) {
      console.warn('⚠️ normalizeBackendHistory: history array is empty');
      return [];
    }
    
    console.log('📊 Normalizing history:', {
      length: history.length,
      firstItem: history[0],
      sampleKeys: Object.keys(history[0] || {})
    });
    
    const normalized = history
      .map((point, index) => {
        // Try different possible field names
        const apyValue = Number(point?.apy ?? point?.apyValue ?? point?.value ?? point?.y ?? 0);
        const tsValue = Number(point?.timestamp ?? point?.ts ?? point?.time ?? point?.x ?? 0);
        
        if (!Number.isFinite(apyValue) || !Number.isFinite(tsValue)) {
          console.warn(`⚠️ Invalid data point at index ${index}:`, point);
          return null;
        }
        
        // Handle timestamp - if it's already in milliseconds (> 1e12), use as-is, otherwise convert from seconds
        const timestampMs = tsValue > 1e12 ? tsValue : tsValue * 1000;
        
        return {
          timestamp: timestampMs,
          apy: parseFloat(apyValue.toFixed(2)),
          date: new Date(timestampMs)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    console.log('✅ Normalized result:', {
      originalLength: history.length,
      normalizedLength: normalized.length,
      firstNormalized: normalized[0],
      lastNormalized: normalized[normalized.length - 1]
    });
    
    return normalized;
  };

  const filterHistoryByRange = (data, selectedRange) => {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('⚠️ filterHistoryByRange: No data to filter');
      return [];
    }
    
    const now = Date.now();
    const RANGE_MS = {
      '24h': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1m': 30 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000
    };
    const cutoff = now - (RANGE_MS[selectedRange] || RANGE_MS['24h']);
    
    console.log('📅 Filtering by range:', {
      selectedRange,
      cutoff: new Date(cutoff).toISOString(),
      now: new Date(now).toISOString(),
      dataLength: data.length,
      firstTimestamp: data[0]?.timestamp ? new Date(data[0].timestamp).toISOString() : 'N/A',
      lastTimestamp: data[data.length - 1]?.timestamp ? new Date(data[data.length - 1].timestamp).toISOString() : 'N/A'
    });
    
    const filtered = data.filter(point => {
      if (!point || typeof point.timestamp !== 'number') {
        console.warn('⚠️ Invalid point in filter:', point);
        return false;
      }
      return point.timestamp >= cutoff;
    });
    
    console.log('✅ Filter result:', {
      originalLength: data.length,
      filteredLength: filtered.length,
      cutoffMs: cutoff,
      oldestPoint: filtered[0]?.timestamp ? new Date(filtered[0].timestamp).toISOString() : 'N/A'
    });
    
    // If filtering removed all data, return original data (better than empty)
    return filtered.length > 0 ? filtered : data;
  };

  useEffect(() => {
    if (isOpen && type === 'apy') {
      // Fetch both in parallel for faster loading
      Promise.all([
        loadApyHistory(),
        walletAddress ? fetchBoosts() : Promise.resolve()
      ]).catch(err => {
        console.error('Error loading APY modal data:', err);
      });
    } else if (!isOpen) {
      // Clear data when modal closes to free memory
      setApyHistory([]);
      setBoosts([]);
    }
  }, [isOpen, type, timeRange, walletAddress]);

  async function loadApyHistory() {
    setIsLoadingHistory(true);
    try {
      console.log('📊 Loading APY history for timeRange:', timeRange);
      
      // For longer time ranges (1w, 1m, 1y), use local computation since backend only has 24h
      const shouldUseLocal = timeRange === '1w' || timeRange === '1m' || timeRange === '1y';
      
      if (shouldUseLocal) {
        console.log('📊 Using local computation for timeRange:', timeRange);
        const localHistory = await getLocalApyHistory(timeRange);
        console.log('✅ Local computation result:', {
          length: localHistory.length,
          sample: localHistory[0],
          lastSample: localHistory[localHistory.length - 1]
        });
        setApyHistory(localHistory);
        return;
      }
      
      // For 24h, try backend first
      const backendHistory = await fetchBackendApyHistory();
      console.log('📥 Received backend history:', {
        length: Array.isArray(backendHistory) ? backendHistory.length : 'not an array',
        type: typeof backendHistory,
        sample: Array.isArray(backendHistory) && backendHistory.length > 0 ? backendHistory[0] : null
      });
      
      const normalizedHistory = filterHistoryByRange(normalizeBackendHistory(backendHistory), timeRange);
      console.log('✅ Normalized history:', {
        originalLength: Array.isArray(backendHistory) ? backendHistory.length : 0,
        normalizedLength: normalizedHistory.length,
        filteredLength: normalizedHistory.length
      });
      
      // Check if backend data actually covers the requested range
      if (normalizedHistory.length > 0) {
        const now = Date.now();
        const RANGE_MS = {
          '24h': 24 * 60 * 60 * 1000,
        };
        const cutoff = now - (RANGE_MS[timeRange] || RANGE_MS['24h']);
        const oldestPoint = normalizedHistory[0]?.timestamp;
        const dataCoversRange = oldestPoint && oldestPoint <= cutoff;
        
        if (dataCoversRange) {
          console.log('✅ Using backend APY history (covers requested range)');
          setApyHistory(normalizedHistory);
          return;
        } else {
          console.warn('⚠️ Backend data does not cover requested range, using local computation');
        }
      }

      console.warn('⚠️ Backend APY history was empty or invalid, falling back to local computation');
      const fallbackHistory = await getLocalApyHistory(timeRange);
      console.log('📊 Local fallback history:', {
        length: fallbackHistory.length,
        sample: fallbackHistory[0]
      });
      setApyHistory(fallbackHistory);
    } catch (error) {
      console.error('❌ Error fetching APY history from backend:', error);
      try {
        console.log('🔄 Attempting local fallback computation...');
        const fallbackHistory = await getLocalApyHistory(timeRange);
        console.log('✅ Local fallback succeeded:', { length: fallbackHistory.length });
        setApyHistory(fallbackHistory);
      } catch (fallbackError) {
        console.error('❌ APY history fallback computation failed:', fallbackError);
        setApyHistory([]);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }

  const fetchBoosts = async () => {
    setIsLoadingBoosts(true);
    try {
      const statsData = await getReferralStats(walletAddress);
      if (statsData) {
        const boostsFromReferrals = Array.isArray(statsData.activeBoosts) 
          ? statsData.activeBoosts.map(boost => ({ ...boost, source: 'referral', fromReferrer: false }))
          : [];
        const boostsFromReferrer = Array.isArray(statsData.referrerBoosts) 
          ? statsData.referrerBoosts.map(boost => ({ ...boost, source: 'referrer', fromReferrer: true }))
          : Array.isArray(statsData.refereeBoosts) 
          ? statsData.refereeBoosts.map(boost => ({ ...boost, source: 'referrer', fromReferrer: true }))
          : [];
        const allBoosts = [...boostsFromReferrals, ...boostsFromReferrer];
        setBoosts(allBoosts);
      } else {
        setBoosts([]);
      }
    } catch (error) {
      console.error('Error fetching boosts:', error);
      setBoosts([]);
    } finally {
      setIsLoadingBoosts(false);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    if (timeRange === '24h') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
    } else if (timeRange === '1w') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (timeRange === '1m') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  if (!isOpen || !type) return null;

  const info = INFO_CONTENT[type];
  if (!info) return null;

  const isApyModal = type === 'apy';

  return ReactDOM.createPortal(
    <div className="info-modal-overlay" onClick={onClose}>
      <div 
        ref={modalContentRef}
        className={`info-modal-content ${isApyModal ? 'apy-modal' : ''} ${isMobile ? 'mobile-modal' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <div className="info-modal-header">
          <h3 className="info-modal-title">{info.title}</h3>
          {!isMobile && (
          <button className="info-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          )}
        </div>
        <div className="info-modal-body">
          {info.content.map((line, index) => (
            <p key={index} className="info-modal-text">
              {line}
            </p>
          ))}
          
          {isApyModal && (
            <>
              {/* APY History Graph */}
              <div className="apy-graph-section">
                <div className="apy-graph-header">
                  <div className="apy-current-display">
                    <span className="apy-current-value">{currentApy?.toFixed(2) || '0.00'}% APY</span>
                  </div>
                </div>
                
                <div className="apy-chart-container">
                  {isLoadingHistory ? (
                    <div className="apy-chart-loading">Loading chart...</div>
                  ) : apyHistory.length > 0 ? (
                    (() => {
                      console.log('📊 Rendering chart with data:', {
                        length: apyHistory.length,
                        firstPoint: apyHistory[0],
                        lastPoint: apyHistory[apyHistory.length - 1],
                        allTimestamps: apyHistory.map(p => p.timestamp),
                        allApyValues: apyHistory.map(p => p.apy)
                      });
                      return (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart 
                        data={apyHistory}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="apyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3}/>
                            <stop offset="100%" stopColor="#4ade80" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="timestamp" 
                          type="number"
                          scale="time"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={formatDate}
                          stroke="rgba(255,255,255,0.5)"
                          style={{ fontSize: '11px' }}
                        />
                        <YAxis 
                          stroke="rgba(255,255,255,0.5)"
                          style={{ fontSize: '11px' }}
                          domain={[(dataMin) => Math.max(0, dataMin - 0.5), (dataMax) => dataMax + 0.5]}
                          allowDecimals={true}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0,0,0,0.8)', 
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                          labelFormatter={(value) => formatDate(value)}
                          formatter={(value) => [`${Number(value).toFixed(2)}%`, 'APY']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="apy" 
                          stroke="#4ade80" 
                          strokeWidth={2}
                          fill="url(#apyGradient)"
                          isAnimationActive={true}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                      );
                    })()
                  ) : (
                    <div className="apy-chart-error">No data available</div>
                  )}
                </div>

                {/* Time Range Selector */}
                <div className="apy-time-selector">
                  <button 
                    className={`time-range-btn ${timeRange === '24h' ? 'active' : ''}`}
                    onClick={() => setTimeRange('24h')}
                  >
                    24H
                  </button>
                  <button 
                    className={`time-range-btn ${timeRange === '1w' ? 'active' : ''}`}
                    onClick={() => setTimeRange('1w')}
                  >
                    1W
                  </button>
                  <button 
                    className={`time-range-btn ${timeRange === '1m' ? 'active' : ''}`}
                    onClick={() => setTimeRange('1m')}
                  >
                    1M
                  </button>
                  <button 
                    className={`time-range-btn ${timeRange === '1y' ? 'active' : ''}`}
                    onClick={() => setTimeRange('1y')}
                  >
                    1Y
                  </button>
                </div>
              </div>

              {/* Your Boosts Section */}
              {walletAddress && (
                <div className="apy-boosts-section">
                  <div className="apy-boosts-header">
                    <h4 className="apy-boosts-title">Your Boosts</h4>
                  </div>
                  {isLoadingBoosts ? (
                    <div className="apy-boosts-loading">Loading boosts...</div>
                  ) : boosts.length > 0 ? (
                    <div className="apy-boosts-list">
                      {boosts.map((boost, index) => {
                        const isActive = boost.endsAt ? new Date(boost.endsAt) > new Date() : true;
                        const isFromReferrer = boost.source === 'referrer' || boost.fromReferrer === true;
                        const boostLabel = boost.type === 'REFERRAL' 
                          ? (isFromReferrer ? 'Invited By Friend' : 'Friend Referral')
                          : boost.type === 'DEPOSIT' 
                          ? 'Deposit Boost' 
                          : 'Welcome Boost';
                        
                        return (
                          <div key={boost.id || index} className={`apy-boost-item ${isActive ? 'active' : ''}`}>
                            <div className="apy-boost-info">
                              <div className="apy-boost-name">{boostLabel}</div>
                              {isActive && <div className="apy-boost-status">Active</div>}
                            </div>
                            <div className="apy-boost-badge">
                              +{(boost.apyBoost * 100).toFixed(1)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="apy-boosts-empty">No active boosts</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InfoModal;
