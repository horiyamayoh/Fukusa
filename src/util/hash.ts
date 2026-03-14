import { createHash } from 'crypto';

export function stableHash(value: string, length = 12): string {
  return createHash('sha1').update(value).digest('hex').slice(0, length);
}
