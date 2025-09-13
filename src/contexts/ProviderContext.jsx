import React, { createContext, useContext, useState, useMemo } from 'react';

const ProviderContext = createContext(null);
export const useProvider = () => useContext(ProviderContext);

/** defaultProvider could be 'grubhub' per our strategy */
export const ProviderProvider = ({ defaultProvider = 'grubhub', children }) => {
  const [provider, setProvider] = useState(defaultProvider);
  const value = useMemo(() => ({ provider, setProvider }), [provider]);
  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
};
