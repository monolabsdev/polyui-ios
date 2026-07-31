import { RNHostView, Text, VStack, Button } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { PairingCamera } from '@/components/pairing-camera';
import { pairHost } from '@/network/poly-api';
import { useQueryClient } from '@tanstack/react-query';

export default function PairingContent({ onDone }: { onDone?: () => void }) {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const scan = async (data: string) => {
    try {
      const host = await pairHost(data);
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      setMessage(`${host.name} paired.`);
      onDone?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This QR code is not a Poly host code.');
    }
  };

  return (
    <VStack spacing={16} modifiers={[padding({ all: 20 })]}>
      <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>Pair a host</Text>
      <Text modifiers={[foregroundStyle('secondary')]}>Scan the QR code shown in Poly on your Mac.</Text>
      <RNHostView>
        <PairingCamera onScanned={scan} />
      </RNHostView>
      {message ? <Text modifiers={[foregroundStyle('secondary')]}>{message}</Text> : null}
      <Button label="Done" onPress={onDone} />
    </VStack>
  );
}
