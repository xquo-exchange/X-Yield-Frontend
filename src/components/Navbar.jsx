import React, { useState } from "react";
import "./Navbar.css";
import { useWallet } from "../hooks/useWallet";
import { useFarcasterProfile } from "../hooks/useFarcasterProfile";
import xquoLogo from "../assets/X-QUO white.svg";

const Navbar = ({ onShowToast }) => {
  const {
    walletAddress,
    isConnected,
    connecting,
    chainId,
    switchingNetwork,
    connectWallet,
    disconnectWallet,
    switchToBase,
  } = useWallet();

  const { profileImage, username, isInMiniApp } = useFarcasterProfile();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = async () => {
    const result = await connectWallet();
    if (result.success) {
      onShowToast("success", "Wallet connected successfully");
    } else if (result?.error !== "NO_ACCOUNT") {
      onShowToast("error", result.message);
    }
  };

  const handleDisconnect = async () => {
    const result = await disconnectWallet();
    if (result.success) {
      setShowDropdown(false);
    } else {
      onShowToast("error", result.message);
    }
  };

  const handleSwitchNetwork = async () => {
    const result = await switchToBase();
    if (result.success) {
      onShowToast("success", "Switched to Base network");
    } else {
      onShowToast("error", result.message);
    }
  };

  const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkName = (chainId) => {
    switch (chainId) {
      case 8453:
        return "Base";
      case 84531:
        return "Base Goerli";
      case 1:
        return "Ethereum";
      default:
        return `Chain ${chainId}`;
    }
  };

  const isBase = chainId === 8453;

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <img src={xquoLogo} alt="X-QUO" className="navbar-logo-image" />
      </div>
      <div className="navbar-right">
        {!isConnected ? (
          <button
            className="wallet-button connect"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <div className="wallet-connected">
            {/* Profile image / Network indicator */}
            {switchingNetwork ? (
              <div className={`network-indicator neutral`} title="Switching to Base...">
                ⏳ <span className="network-text">Switching to Base...</span>
              </div>
            ) : (
              <div
                className={`network-indicator ${isBase ? 'mainnet' : 'warning'}`}
                onClick={!isBase ? handleSwitchNetwork : undefined}
                style={{ cursor: !isBase ? 'pointer' : 'default' }}
                title={!isBase ? "Click to switch to Base" : "Connected to Base"}
              >
                {profileImage ? (
                  <img 
                    src={profileImage} 
                    alt="Profile" 
                    className="network-profile-image"
                  />
                ) : (
                  <span className="network-avatar-fallback">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="8" r="4" fill="currentColor"/>
                      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor"/>
                    </svg>
                  </span>
                )}
                <span className="network-text">{getNetworkName(chainId)}</span>
              </div>
            )}

            {/* Desktop wallet button */}
            <button
              className="wallet-button connected desktop-only"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              {profileImage ? (
                <img 
                  src={profileImage} 
                  alt="Profile" 
                  className="wallet-profile-image"
                />
              ) : (
                <span className="wallet-avatar-placeholder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="8" r="4" fill="currentColor"/>
                    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor"/>
                  </svg>
                </span>
              )}
              {username ? `@${username}` : truncateAddress(walletAddress)}
            </button>

            {/* Mobile logout button */}
            <button
              className="wallet-button connected mobile-only logout-btn"
              onClick={handleDisconnect}
              title="Disconnect wallet"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 3H5C4.44772 3 4 3.44772 4 4V16C4 16.5523 4.44772 17 5 17H10"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M11.5 10H17M17 10L14.5 7.5M17 10L14.5 12.5"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {showDropdown && (
              <div className="wallet-dropdown">
                <div className="dropdown-info">
                  <span className="dropdown-label">Network</span>
                  <span className="dropdown-value">
                    {getNetworkName(chainId)}
                  </span>
                </div>
                {!isBase && (
                  <button
                    className="dropdown-item warning"
                    onClick={handleSwitchNetwork}
                  >
                    Switch to Base
                  </button>
                )}
                <button className="dropdown-item" onClick={handleDisconnect}>
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

