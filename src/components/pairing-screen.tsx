import { Host } from '@expo/ui';
import { Button, VStack } from '@expo/ui/swift-ui';
import { padding } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { PlatformColor } from 'react-native';

import { hapticPress } from '@/utils/haptics';

import PairingContent from './pairing-content';

export default function PairingScreen() {
  const router = useRouter();
  return (
    <Host style={{ flex: 1 }} seedColor={PlatformColor('label')}>
      <VStack modifiers={[padding({ top: 12 })]}>
        <Button
          label="Back"
          systemImage="chevron.left"
          onPress={() => hapticPress(() => router.back())}
        />
        <PairingContent onDone={() => router.back()} />
      </VStack>
    </Host>
  );
}
