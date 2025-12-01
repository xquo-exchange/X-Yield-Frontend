import React, { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useMiniApp } from "@neynar/react";

import { WalletProvider } from "./contexts/WalletContext";
import { useWallet } from "./hooks/useWallet";

import Orb from "./components/Orb";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import VaultApp from "./components/MorphoApp";
import Toast from "./components/Toast";
import GalaxyLanding from "./components/GalaxyLanding";
import EmailBanner from "./components/EmailBanner";
import SocialLinks from "./components/SocialLinks";

import "./App.css";

function AppContent() {
  const [activePage, setActivePage] = useState("deposit");
  const [toast, setToast] = useState(null);
  const [isMiniApp, setIsMiniApp] = useState(false);

  const { isConnected, connectWallet } = useWallet();
  const { isSDKLoaded, addMiniApp } = useMiniApp(); // Neynar SDK

  // Detect Mini App environment
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const inside = await sdk.isInMiniApp();
        if (!cancelled) setIsMiniApp(inside);
      } catch (err) {
        console.error("MiniApp detection failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Neynar-driven Add Mini App handler
  const handleAddMiniApp = async () => {
    try {
      await addMiniApp();
      setToast({
        type: "success",
        message: "Mini App added — notifications enabled!",
      });
    } catch (e) {
      console.error("Error adding mini app:", e);
      setToast({
        type: "error",
        message: "Could not add Mini App.",
      });
    }
  };

  // Wallet UX scroll locking
  useEffect(() => {
    if (!isConnected) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.documentElement.style.height = "100vh";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.height = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.height = "";
    };
  }, [isConnected]);

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

  // LANDING PAGE (not connected)
  if (!isConnected) {
    return (
      <div className="landing-layout">
        <GalaxyLanding onConnect={handleConnect} />

        {isMiniApp && isSDKLoaded && (
          <button
            onClick={handleAddMiniApp}
            style={{
              marginTop: "20px",
              padding: "12px 20px",
              background: "#8247e5",
              color: "white",
              borderRadius: "8px",
              border: "none",
            }}
          >
            Add Mini App / Enable Notifications
          </button>
        )}

        <SocialLinks variant="landing" />
      </div>
    );
  }

  // MAIN APP CONTENT
  return (
    <>
      <Orb hue={0} hoverIntensity={0.2} rotateOnHover={true} />
      <Navbar onShowToast={showToast} />

      <div className="content-wrapper">
        <div className="email-banner-wrapper">
          <EmailBanner />
        </div>

        <div className="main-container">
          <Sidebar activePage={activePage} setActivePage={setActivePage} />

          <div className="center-content" style={{ animation: "fadeInScale 0.3s ease-out" }}>
            <VaultApp onShowToast={showToast} mode={activePage} />
          </div>
        </div>
      </div>

      {isMiniApp && isSDKLoaded && (
        <div style={{ padding: "16px", textAlign: "center" }}>
          <button
            onClick={handleAddMiniApp}
            style={{
              padding: "12px 20px",
              background: "#8247e5",
              color: "white",
              borderRadius: "8px",
              border: "none",
              marginTop: "10px",
            }}
          >
            Add Mini App / Enable Notifications
          </button>
        </div>
      )}

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
  // MiniApp ready()
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const inside = await sdk.isInMiniApp();
        if (cancelled || !inside) return;
        await sdk.actions.ready();
      } catch (error) {
        console.error("Mini App ready() failed:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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