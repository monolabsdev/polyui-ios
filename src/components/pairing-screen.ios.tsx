import { Host } from '@expo/ui';
import { Button, VStack } from '@expo/ui/swift-ui';
import { padding } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';

import PairingContent from './pairing-content.ios';

export default function PairingScreen() {
  const router = useRouter();
  return (
    <Host style={{ flex: 1 }} seedColor="#0A84FF">
      <VStack modifiers={[padding({ top: 12 })]}>
        <Button label="Back" systemImage="chevron.left" onPress={() => router.back()} />
        <PairingContent onDone={() => router.back()} />
      </VStack>
    </Host>
  );
}
