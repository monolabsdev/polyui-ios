import { Directory, File, Paths } from 'expo-file-system';

const attachments = new Directory(Paths.document, 'attachments');

export function saveAttachment(name: string, data: Uint8Array, mimeType = 'application/octet-stream') {
  if (!attachments.exists) attachments.create({ idempotent: true });
  const file = new File(attachments, name);
  if (!file.exists) file.create({ overwrite: true, intermediates: true });
  file.write(data);
  return { uri: file.uri, mimeType };
}
