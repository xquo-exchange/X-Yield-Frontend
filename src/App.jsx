import React, { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { WalletProvider } from "./contexts/WalletContext";
import { useWallet } from "./hooks/useWallet";
import Navbar from "./components/Navbar";
import VaultApp from "./components/MorphoApp";
import Toast from "./components/Toast";
import GalaxyLanding from "./components/GalaxyLanding";
import SocialLinks from "./components/SocialLinks";
import "./App.css";

function AppContent() {
  const [activePage, setActivePage] = useState("deposit");
  const [toast, setToast] = useState(null);
  const { isConnected, connectWallet } = useWallet();
  const [showAddButton, setShowAddButton] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const isMiniApp = await sdk.isInMiniApp();
        if (!isMiniApp) return;

        await sdk.actions.ready();

        const ctx = await sdk.context.get();
        const alreadyAdded =
          ctx?.miniapp?.is_added === true ||
          ctx?.frame?.is_added === true ||
          false;
        setShowAddButton(!alreadyAdded);
      } catch (e) {
        console.error("MiniApp check failed:", e);
      }
    })();
  }, []);

  const handleAddToFarcaster = async () => {
    try {
      if (typeof sdk.actions.addMiniApp === "function") {
        await sdk.actions.addMiniApp();
      } else if (typeof sdk.actions.addFrame === "function") {
        await sdk.actions.addFrame();
      }
      setShowAddButton(false);
      showToast("success", "Added to Farcaster!");
    } catch (e) {
      console.error("Add to Farcaster failed:", e);
      showToast("error", "Failed to add to Farcaster");
    }
  };

  const showToast = (type, message, txHash = null) => {
    setToast({ type, message, txHash });
  };

  const closeToast = () => setToast(null);

  const handleConnect = async () => {
    const result = await connectWallet();
    if (!result.success && result?.error !== "NO_ACCOUNT") {
      showToast("error", result.message);
    }
  };

  if (!isConnected) {
    return (
      <div className="landing-layout">
        <GalaxyLanding onConnect={handleConnect} />
        {showAddButton && (
          <button
            onClick={handleAddToFarcaster}
            className="add-to-farcaster-btn"
          >
            Add to Farcaster
          </button>
        )}
        <SocialLinks variant="landing" />
      </div>
    );
  }

  return (
    <>
      <Navbar onShowToast={showToast} />

      <div className="content-wrapper">
        <div className="main-container">
          <div
            className="center-content"
            style={{ animation: "fadeInScale 0.3s ease-out" }}
          >
            <VaultApp
              onShowToast={showToast}
              mode={activePage}
              setMode={setActivePage}
            />
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          txHash={toast.txHash}
          onClose={closeToast}
          duration={5000}
        />
      )}

      <SocialLinks />
    </>
  );
}

function App() {
  return (
    <WalletProvider>
      <div className="app">
        <div className="app-body">
          <AppContent />
        </div>
      </div>
    </WalletProvider>
  );
}

export default App;