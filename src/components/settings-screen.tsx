import { Host } from '@expo/ui';
import {
  Button,
  Form,
  HStack,
  Image,
  Label,
  LabeledContent,
  Section,
  Spacer,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Alert, PlatformColor } from 'react-native';

import { clearCachedMessages } from '@/data/conversation-cache';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useNotificationsPreference } from '@/hooks/use-notifications-preference';
import { forgetPairedHost } from '@/network/poly-api';
import { authenticateDevice, getOrCreateDeviceIdentity, rotateDeviceIdentity } from '@/security/device-identity';
import { useAppStore } from '@/state/app-store';
import { hapticPress } from '@/utils/haptics';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const network = useNetworkStatus();
  const { enabled: notifications, enable: enableNotifications } = useNotificationsPreference();

  const unlock = async () => {
    if (await authenticateDevice()) await getOrCreateDeviceIdentity();
  };

  const forgetHost = async () => {
    const agentId = useAppStore.getState().activeAgentId;
    await forgetPairedHost();
    if (agentId) await clearCachedMessages(agentId);
    useAppStore.setState({
      messages: [],
      activeAgentId: null,
      draft: '',
      temporary: false,
      hostRevealed: false,
    });
    await queryClient.invalidateQueries({ queryKey: ['agents'] });
    router.back();
  };

  const confirmForgetHost = () => {
    Alert.alert('Forget paired host?', 'You will need to scan a new QR code to reconnect.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget', style: 'destructive', onPress: () => void forgetHost() },
    ]);
  };

  return (
    <Host style={{ flex: 1 }} seedColor={PlatformColor('label')}>
      <VStack spacing={0}>
        <HStack
          alignment="center"
          spacing={12}
          modifiers={[padding({ top: 12, horizontal: 20, bottom: 4 })]}
        >
          <Button
            onPress={() => hapticPress(() => router.back())}
            modifiers={[
              buttonStyle('glass'),
              buttonBorderShape('circle'),
              accessibilityLabel('Go back'),
            ]}
          >
            <Image
              systemName="chevron.left"
              size={16}
              modifiers={[
                frame({ width: 36, height: 36, alignment: 'center' }),
              ]}
            />
          </Button>
          <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' })]}>Settings</Text>
          <Spacer />
        </HStack>
        <Form>
          <Section title="Notifications">
            <Toggle
              label="Agent updates"
              systemImage="bell"
              isOn={notifications}
              onIsOnChange={(value) => hapticPress(() => enableNotifications(value))}
              modifiers={[tint(PlatformColor('systemGray'))]}
            />
          </Section>
          <Section title="Security">
            <Button
              label="Unlock device identity"
              systemImage="faceid"
              onPress={() => hapticPress(() => void unlock())}
            />
            <Button
              label="Rotate device identity"
              systemImage="arrow.triangle.2.circlepath"
              onPress={() => hapticPress(() => void rotateDeviceIdentity())}
            />
            <Label title="Private keys stay in Secure Store" systemImage="lock.shield" />
          </Section>
          <Section title="Connection">
            <LabeledContent label="Network">
              <Text modifiers={[foregroundStyle('secondary')]}>{network}</Text>
            </LabeledContent>
          </Section>
          <Section title="Host">
            <Button
              label="Forget paired host"
              systemImage="trash"
              role="destructive"
              onPress={() => hapticPress(confirmForgetHost)}
            />
          </Section>
          <Section title="About">
            <Button
              label="Poly documentation"
              systemImage="book"
              onPress={() => hapticPress(() => void Linking.openURL('https://docs.expo.dev/versions/v57.0.0/'))}
            />
            <Label title="Native SwiftUI client" systemImage="iphone" />
          </Section>
        </Form>
      </VStack>
    </Host>
  );
}
