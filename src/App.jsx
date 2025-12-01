import React, { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

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
  const { isConnected, connectWallet } = useWallet();

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

  if (!isConnected) {
    return (
      <div className="landing-layout">
        <GalaxyLanding onConnect={handleConnect} />
        <SocialLinks variant="landing" />
      </div>
    );
  }

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

          <div
            className="center-content"
            style={{ animation: "fadeInScale 0.3s ease-out" }}
          >
            <VaultApp onShowToast={showToast} mode={activePage} />
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
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const inside = await sdk.isInMiniApp();
        if (cancelled || !inside) return;

        // 🔵 Nascondi lo splash
        await sdk.actions.ready();

        // 🔵 Ottieni contesto
        const ctx = await sdk.context.get();
        console.log("MiniApp context:", ctx);

        // Se la mini-app NON è aggiunta → mostra il popup automaticamente
        if (!ctx.miniapp?.is_added) {
          console.log("Opening Add Frame popup automatically...");
          await sdk.actions.addFrame();
        }

      } catch (error) {
        console.error("Mini App init failed:", error);
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