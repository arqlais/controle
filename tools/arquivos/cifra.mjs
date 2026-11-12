import fs from 'fs'
const [zipPath, outPath] = process.argv.slice(2)
const jwk = {"e":"AQAB","n":"1h10z9qRWJwmvU_FEPSM__d87d0huAG0BLl6cvwHwACMIaULtm7cvkq8RV2GRwhI_dZ5HeJ99VqqGZ390qDh5ttHuL2x98J2L2vraap02uoAVYvP2UAGlm996zbiFtQrfyLwuOF7hC61U26vQQYgG9FNaDtW5V5MzY-xnpwFIHeQvjBurG7neF9N7pBiEmuUDIYVqsuTE0eTL6bsKaLMYtJsI-o2MxlCDABHdc8e9ErMC0_Xvpt74REvGXnPi1lONKgul3aOZV94Ud8tW4vh0X3zLbhFfZw8ZgIjrRVyWljl0sAtXJludJFk_-k0udRPqi3Yg1WYlIODNY5Dta0SqZ0eq-IeBFdi6UM-stRPVdDZdy7AIK6SRvWYNareSAm0GJAbMPVW878M6lDmay_1hkpF8UI5BrxeQ1TIdPAXRXdoi5TptRvT9LRVgUm8EdKvh4pYVB8EwxSZ195u_VCoT71bZh9DdFtnHwz8fD-k2epbYtDi1OPYOPKKzrm0MVOH","alg":"RSA-OAEP-256","ext":true,"kty":"RSA","key_ops":["encrypt"]}
const { subtle } = globalThis.crypto
const pub = await subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
const aes = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
const raw = new Uint8Array(await subtle.exportKey('raw', aes))
const enc = new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw))
const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aes, fs.readFileSync(zipPath)))
const out = new Uint8Array(2 + enc.length + 12 + ct.length)
out[0] = enc.length >> 8; out[1] = enc.length & 255
out.set(enc, 2); out.set(iv, 2 + enc.length); out.set(ct, 14 + enc.length)
fs.writeFileSync(outPath, out)
console.log('ok', out.length, 'bytes; chave cifrada', enc.length)
