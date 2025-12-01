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

// -----------------------------------------
// AUTO-ADD LOGIC (WITHOUT NEYNAR REACT SDK)
// -----------------------------------------
async function autoAddMiniApp() {
  try {
    const inside = await sdk.isInMiniApp();
    if (!inside) return;

    const added = await sdk.miniapp.isAdded(); 
    // se l'utente ha già aggiunto la Mini App → non fare nulla
    if (added) {
      console.log("Mini App already added.");
      return;
    }

    // altrimenti apri AUTOMATICAMENTE il popup
    console.log("Opening Add Mini App popup automatically...");
    await sdk.actions.addMiniApp();

  } catch (err) {
    console.error("Auto Add Mini App failed:", err);
  }
}

// -----------------------------------------

function AppContent() {
  const [activePage, setActivePage] = useState("deposit");
  const [toast, setToast] = useState(null);
  const { isConnected, connectWallet } = useWallet();

  // Scroll lock UX logic
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

  // LANDING PAGE
  if (!isConnected) {
    return (
      <div className="landing-layout">
        <GalaxyLanding onConnect={handleConnect} />
        <SocialLinks variant="landing" />
      </div>
    );
  }

  // MAIN APP UI
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

  // HIDE SPLASH + AUTO-ADD POPUP
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const inside = await sdk.isInMiniApp();
        if (cancelled) return;

        if (inside) {
          await sdk.actions.ready();
          console.log("Mini App ready()");

          // APRI AUTOMATICAMENTE IL POPUP DI ADD
          autoAddMiniApp();
        } else {
          console.warn("Not running inside Mini App host.");
        }
      } catch (error) {
        console.error("Mini App initialization failed:", error);
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