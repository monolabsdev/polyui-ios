import { RNHostView, Text, VStack, Button } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';

import { PairingCamera } from '@/components/pairing-camera';
import { usePairing } from '@/hooks/use-pairing';
import { hapticPress } from '@/utils/haptics';

export default function PairingContent({ onDone }: { onDone?: () => void }) {
  const { message, scan } = usePairing(onDone);

  return (
    <VStack spacing={16} modifiers={[padding({ all: 20 })]}>
      <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>Pair a host</Text>
      <Text modifiers={[foregroundStyle('secondary')]}>Scan the QR code shown in Poly on your Mac.</Text>
      <RNHostView>
        <PairingCamera onScanned={scan} />
      </RNHostView>
      {message ? <Text modifiers={[foregroundStyle('secondary')]}>{message}</Text> : null}
      <Button label="Done" onPress={() => hapticPress(() => onDone?.())} />
    </VStack>
  );
}
