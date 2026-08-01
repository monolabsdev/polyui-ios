import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [network, setNetwork] = useState('Checking connection');

  useEffect(() => {
    void Network.getNetworkStateAsync().then((state) => {
      setNetwork(state.isConnected ? `${state.type ?? 'Network'} connected` : 'Offline');
    });
  }, []);

  return network;
}
