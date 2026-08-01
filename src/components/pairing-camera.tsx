import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { hapticPress } from '@/utils/haptics';

export function PairingCamera({ onScanned }: { onScanned: (data: string) => void }) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    return (
      <View style={styles.permission}>
        <Text style={[styles.permissionText, { color: theme.textSecondary }]}>Camera access is needed to scan a host QR code.</Text>
        <Text
          onPress={() => hapticPress(() => void requestPermission())}
          style={[styles.permissionAction, { color: theme.text }]}
        >
          Allow Camera
        </Text>
      </View>
    );
  }

  const handleScan = ({ data }: BarcodeScanningResult) => onScanned(data);
  return (
    <CameraView
      style={styles.camera}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={handleScan}
    />
  );
}

const styles = StyleSheet.create({
  camera: { width: '100%', height: 260, borderRadius: 20, overflow: 'hidden' },
  permission: { alignItems: 'center', justifyContent: 'center', minHeight: 180, padding: 24, gap: 12 },
  permissionText: { fontSize: 16, textAlign: 'center' },
  permissionAction: { fontSize: 16, fontWeight: '600' },
});
