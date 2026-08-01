/// <reference path="./polyfills.d.ts" />

import structuredClone from '@ungap/structured-clone';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  const installAiSdkPolyfills = async () => {
    const { polyfillGlobal } = await import('react-native/Libraries/Utilities/PolyfillFunctions');
    const { TextDecoderStream, TextEncoderStream } = await import('@stardazed/streams-text-encoding');

    if (!('structuredClone' in globalThis)) {
      polyfillGlobal('structuredClone', () => structuredClone);
    }
    if (!('TextEncoderStream' in globalThis)) {
      polyfillGlobal('TextEncoderStream', () => TextEncoderStream);
    }
    if (!('TextDecoderStream' in globalThis)) {
      polyfillGlobal('TextDecoderStream', () => TextDecoderStream);
    }
  };

  void installAiSdkPolyfills();
}
