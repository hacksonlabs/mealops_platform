import React from "react";
import { AuthProvider } from './contexts/AuthContext';
import { ProviderProvider } from './contexts/ProviderContext'; 
import Routes from "./Routes";

function App() {
  return (
    <AuthProvider>
      <ProviderProvider defaultProvider="grubhub">
        <Routes />
      </ProviderProvider>
    </AuthProvider>
  );
}

export default App;