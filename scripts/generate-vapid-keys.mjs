import { createECDH } from 'node:crypto';

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const publicKey = ecdh.getPublicKey('base64url', 'uncompressed');
const privateKey = ecdh.getPrivateKey('base64url');

console.log('Add these values to your Vercel environment variables:');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:contact.silentra@gmail.com');
console.log('');
console.log('Keep VAPID_PRIVATE_KEY secret. Generate one pair and reuse it across deployments.');
