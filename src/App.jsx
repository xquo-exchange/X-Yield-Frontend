import React, { useState } from "react";
import { WalletProvider } from "./contexts/WalletContext";
import { useWallet } from "./hooks/useWallet";
import Orb from "./components/Orb";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import VaultApp from "./components/MorphoApp";
import Toast from "./components/Toast";
import GalaxyLanding from "./components/GalaxyLanding";
import "./App.css";

function AppContent() {
  const [activePage, setActivePage] = useState("deposit");
  const [toast, setToast] = useState(null);
  const { isConnected, connectWallet } = useWallet();

  const showToast = (type, message, txHash = null) => {
    setToast({ type, message, txHash });
  };

  const closeToast = () => setToast(null);

  const handleConnect = async () => {
    const result = await connectWallet();
    if (!result.success) {
      showToast('error', result.message);
    }
  };

  if (!isConnected) {
    return <GalaxyLanding onConnect={handleConnect} />;
  }

  return (

    <>
      <Orb hue={0} hoverIntensity={0.2} rotateOnHover={true} />
      <Navbar onShowToast={showToast} />
      
      <div className="content-wrapper">
        
        <div className="main-container">
          <Sidebar activePage={activePage} setActivePage={setActivePage} />
          
          <div className="center-content" style={{animation: 'fadeInScale 0.3s ease-out'}}>
            <VaultApp 
              onShowToast={showToast}
              mode={activePage}
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
    </>
  );
}

function App() {
  return (
    <WalletProvider>
      <div className="app">
        <AppContent />
      </div>
    </WalletProvider>
  );
}

export default App;
