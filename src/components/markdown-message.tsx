import Markdown from 'react-native-markdown-display';
import { StyleSheet } from 'react-native';

export function MarkdownMessage({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <Markdown style={isUser ? userStyles : assistantStyles}>
      {content}
    </Markdown>
  );
}

const base = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 23, margin: 0 },
  paragraph: { marginTop: 0, marginBottom: 0 },
});

const userStyles = StyleSheet.create({
  ...base,
  body: { ...base.body, color: '#ffffff', backgroundColor: '#0a84ff', padding: 10, borderRadius: 16 },
});

const assistantStyles = StyleSheet.create({
  ...base,
  body: { ...base.body, color: '#1c1c1e', backgroundColor: '#e9e9ee', padding: 10, borderRadius: 16 },
});
