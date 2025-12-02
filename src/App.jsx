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

      <Navbar onShowToast={showToast} />

      <div className="content-wrapper">

        <div className="main-container">


          <div className="center-content" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
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
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const isMiniApp = await sdk.isInMiniApp();
        if (cancelled || !isMiniApp) {
          return;
        }

        await sdk.actions.ready();

        // 🔵 get context
        const ctx = await sdk.context.get();
        console.log("MiniApp context:", ctx);

        // Check if the app is added to the client
        if (!ctx.client?.added) {
          console.log("Opening Add Mini App popup automatically...");
          // Prompt user to add the app (enables notifications)
          try {
            if (sdk.actions.addMiniApp) {
              await sdk.actions.addMiniApp();
            } else if (sdk.actions.addFrame) {
              await sdk.actions.addFrame();
            }
          } catch (e) {
            console.error("Failed to prompt add app:", e);
          }
        }
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
