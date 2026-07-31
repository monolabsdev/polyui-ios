import { Host } from '@expo/ui';
import {
  Button,
  Form,
  Label,
  LabeledContent,
  Section,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import * as Linking from 'expo-linking';
import * as Network from 'expo-network';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { authenticateDevice, getOrCreateDeviceIdentity, rotateDeviceIdentity } from '@/security/device-identity';
import { requestNotificationPermission } from '@/services/notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(false);
  const [network, setNetwork] = useState('Checking connection');

  useEffect(() => {
    void Network.getNetworkStateAsync().then((state) => {
      setNetwork(state.isConnected ? `${state.type ?? 'Network'} connected` : 'Offline');
    });
  }, []);

  const unlock = async () => {
    if (await authenticateDevice()) await getOrCreateDeviceIdentity();
  };

  const enableNotifications = async (enabled: boolean) => {
    setNotifications(enabled);
    if (enabled) await requestNotificationPermission();
  };

  return (
    <Host style={{ flex: 1 }} seedColor="#0A84FF">
      <Form>
        <VStack alignment="leading" modifiers={[padding({ top: 12, horizontal: 16 })]}>
          <Button label="Back" systemImage="chevron.left" onPress={() => router.back()} />
          <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' })]}>Settings</Text>
        </VStack>
        <Section title="Notifications">
          <Toggle
            label="Agent updates"
            systemImage="bell"
            isOn={notifications}
            onIsOnChange={enableNotifications}
          />
        </Section>
        <Section title="Security">
          <Button label="Unlock device identity" systemImage="faceid" onPress={() => void unlock()} />
          <Button label="Rotate device identity" systemImage="arrow.triangle.2.circlepath" onPress={() => void rotateDeviceIdentity()} />
          <Label title="Private keys stay in Secure Store" systemImage="lock.shield" />
        </Section>
        <Section title="Connection">
          <LabeledContent label="Network">
            <Text modifiers={[foregroundStyle('secondary')]}>{network}</Text>
          </LabeledContent>
        </Section>
        <Section title="About">
          <Button label="Poly documentation" systemImage="book" onPress={() => void Linking.openURL('https://docs.expo.dev/versions/v57.0.0/')} />
          <Label title="Native SwiftUI client" systemImage="iphone" />
        </Section>
      </Form>
    </Host>
  );
}
