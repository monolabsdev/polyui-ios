import { Host } from '@expo/ui';
import {
  Button,
  Form,
  HStack,
  Image,
  Label,
  LabeledContent,
  ProgressView,
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
  disabled,
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
import { useOnDeviceModels } from '@/hooks/use-on-device-models';
import { forgetPairedHost } from '@/network/poly-api';
import { authenticateDevice, getOrCreateDeviceIdentity, rotateDeviceIdentity } from '@/security/device-identity';
import { ON_DEVICE_AGENT_ID } from '@/services/on-device-ai';
import { useAppStore } from '@/state/app-store';
import { hapticPress } from '@/utils/haptics';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const network = useNetworkStatus();
  const { enabled: notifications, enable: enableNotifications } = useNotificationsPreference();
  const onDevice = useOnDeviceModels();

  const unlock = async () => {
    if (await authenticateDevice()) await getOrCreateDeviceIdentity();
  };

  const forgetHost = async () => {
    const agentId = useAppStore.getState().activeAgentId;
    await forgetPairedHost();
    if (agentId && agentId !== ON_DEVICE_AGENT_ID) await clearCachedMessages(agentId);
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
          <Section title="On-device AI">
            {onDevice.loading ? <ProgressView /> : null}
            {onDevice.models.map((model) => {
              const downloading = onDevice.downloadingId === model.id;
              if (downloading) {
                return (
                  <Button
                    key={model.id}
                    onPress={() => hapticPress(() => void onDevice.cancelDownload())}
                    modifiers={[accessibilityLabel(`Cancel downloading ${model.label}`)]}
                  >
                    <HStack spacing={8}>
                      <ProgressView value={onDevice.downloadProgress} />
                      <Text>{model.label} · {Math.round(onDevice.downloadProgress * 100)}%</Text>
                    </HStack>
                  </Button>
                );
              }
              if (model.downloadable && model.status === 'not-downloaded') {
                return (
                  <Button
                    key={model.id}
                    label={model.meetsRequirements ? `Download ${model.label} · ${model.detail}` : `${model.label} · Not enough memory`}
                    systemImage="arrow.down.circle"
                    onPress={() => hapticPress(() => void onDevice.downloadModel(model))}
                    modifiers={[disabled(!model.meetsRequirements)]}
                  />
                );
              }
              return (
                <VStack key={model.id} spacing={0}>
                  <Button
                    label={`${model.label} · ${model.detail}`}
                    systemImage={onDevice.selectedModel?.id === model.id ? 'checkmark' : 'cpu'}
                    onPress={() => hapticPress(() => void onDevice.selectModel(model).catch(() => undefined))}
                    modifiers={[disabled(!model.available || onDevice.generationActive)]}
                  />
                  {model.downloadable ? (
                    <Button
                      label={`Remove ${model.label}`}
                      systemImage="trash"
                      role="destructive"
                      onPress={() => hapticPress(() => void onDevice.deleteModel(model))}
                      modifiers={[disabled(onDevice.generationActive)]}
                    />
                  ) : null}
                </VStack>
              );
            })}
            {onDevice.error ? <Text modifiers={[foregroundStyle('secondary')]}>{onDevice.error}</Text> : null}
            {!onDevice.loading && !onDevice.models.length ? (
              <Text modifiers={[foregroundStyle('secondary')]}>On-device AI is unavailable in this build or on this device.</Text>
            ) : null}
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
