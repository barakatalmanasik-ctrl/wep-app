import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { SettingsProvider } from "./context/SettingsContext";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              direction: "rtl",
              fontFamily: "Segoe UI, Cairo, sans-serif",
              borderRadius: "12px",
              padding: "12px 20px",
            },
          }}
        />
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
