import * as Haptics from 'expo-haptics';

export function hapticPress(action: () => void) {
  void Haptics.selectionAsync();
  action();
}
