import Markdown from 'react-native-markdown-display';
import {
  PlatformColor,
  StyleSheet,
  View,
} from 'react-native';

export function MarkdownMessage({
  content,
  contentWidth,
  isUser,
}: {
  content: string;
  contentWidth?: number;
  isUser: boolean;
}) {
  const markdown = (
    <Markdown
      mergeStyle={false}
      style={isUser ? userStyles : assistantStyles}
    >
      {content}
    </Markdown>
  );

  if (contentWidth == null) {
    return markdown;
  }

  return (
    <View style={{ width: contentWidth }}>
      {markdown}
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  body: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 23,
    margin: 0,
    padding: 0,
  },

  paragraph: {
    flexShrink: 1,
    marginTop: 0,
    marginBottom: 0,
  },

  text: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 23,
  },

  strong: {
    fontWeight: '600',
  },

  em: {
    fontStyle: 'italic',
  },

  bullet_list: {
    flexShrink: 1,
    marginTop: 6,
    marginBottom: 6,
  },

  ordered_list: {
    flexShrink: 1,
    marginTop: 6,
    marginBottom: 6,
  },

  list_item: {
    flexShrink: 1,
    marginTop: 2,
    marginBottom: 2,
  },

  blockquote: {
    flexShrink: 1,
    borderLeftWidth: 3,
    borderLeftColor: PlatformColor('separator'),
    paddingLeft: 10,
    marginLeft: 0,
    marginVertical: 6,
    backgroundColor: 'transparent',
  },

  code_inline: {
    fontFamily: 'Menlo',
    fontSize: 15,
    backgroundColor: PlatformColor('secondarySystemBackground'),
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 5,
  },

  fence: {
    flexShrink: 1,
    fontFamily: 'Menlo',
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: PlatformColor('secondarySystemBackground'),
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
  },

  code_block: {
    flexShrink: 1,
    fontFamily: 'Menlo',
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: PlatformColor('secondarySystemBackground'),
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
  },

  link: {
    flexShrink: 1,
    color: PlatformColor('label'),
    textDecorationLine: 'underline',
  },
});

const userStyles = StyleSheet.create({
  ...sharedStyles,

  body: {
    ...sharedStyles.body,
    color: PlatformColor('label'),
  },

  text: {
    ...sharedStyles.text,
    color: PlatformColor('label'),
  },

  code_inline: {
    ...sharedStyles.code_inline,
    backgroundColor: PlatformColor('tertiarySystemFill'),
  },
});

const assistantStyles = StyleSheet.create({
  ...sharedStyles,

  body: {
    ...sharedStyles.body,
    color: PlatformColor('label'),
  },

  text: {
    ...sharedStyles.text,
    color: PlatformColor('label'),
  },
});
