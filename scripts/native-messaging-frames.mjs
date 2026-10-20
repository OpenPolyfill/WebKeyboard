import os from 'node:os';

const MAX_NATIVE_MESSAGE_SIZE = 1024 * 1024;

export function parseNativeMessageFrames(bytes) {
  const messages = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (bytes.length - offset < 4) {
      throw new Error('Incomplete native message header');
    }
    const size = os.endianness() === 'LE'
      ? bytes.readUInt32LE(offset)
      : bytes.readUInt32BE(offset);
    if (size > MAX_NATIVE_MESSAGE_SIZE) {
      throw new Error('Oversized native message');
    }
    const frameEnd = offset + 4 + size;
    if (frameEnd > bytes.length) {
      throw new Error('Incomplete native message frame');
    }
    messages.push(JSON.parse(bytes.subarray(offset + 4, frameEnd).toString('utf8')));
    offset = frameEnd;
  }
  return messages;
}
