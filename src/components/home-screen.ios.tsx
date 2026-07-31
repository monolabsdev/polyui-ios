import { Host } from '@expo/ui';
import {
  Button,
  HStack,
  Label,
  List,
  Section,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  listStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';

export default function HomeScreen() {
  return (
    <Host>
      <VStack>
        <VStack modifiers={[padding({ top: 56, bottom: 32 }), frame({ maxWidth: 640 })]}>
          <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' })]}>PolyUI</Text>
          <Text
            modifiers={[font({ textStyle: 'callout' }), foregroundStyle('secondary')]}>
            A native SwiftUI home screen
          </Text>
          <HStack spacing={12}>
            <Button
              label="New Project"
              systemImage="plus"
              modifiers={[buttonStyle('borderedProminent'), controlSize('large')]}
            />
            <Button
              label="Open"
              systemImage="folder"
              modifiers={[buttonStyle('bordered'), controlSize('large')]}
            />
          </HStack>
        </VStack>

        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Get Started">
            <Label title="File-based routing" systemImage="square.stack" />
            <Label title="Native SwiftUI" systemImage="swift" />
            <Label title="Expo dev client" systemImage="hammer" />
          </Section>

          <Section title="About">
            <Label title="PolyUI iOS" systemImage="iphone" />
          </Section>
        </List>
      </VStack>
    </Host>
  );
}
