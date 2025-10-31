import React from "react";
import "./Sidebar.css";

const Sidebar = ({ activePage, setActivePage }) => {
  return (
    <div className="sidebar-box">
      <div className="buttons">
        <button
          className={`sidebar-button ${activePage === "deposit" ? "active" : ""}`}
          onClick={() => setActivePage("deposit")}
        >
          <h1 className="sidebar-text">Deposit</h1>
        </button>

        <button
          className={`sidebar-button ${activePage === "withdraw" ? "active" : ""}`}
          onClick={() => setActivePage("withdraw")}
        >
          <h1 className="sidebar-text">Withdraw</h1>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

