/* Pix "copia e cola" (BR Code do Banco Central) com valor: gerado aqui, sem banco intermediário e sem custo.
   Qualquer app de banco lê o QR Code ou o código copiado e já preenche chave, nome e valor. */
const f = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v
const plain = (t: string, max: number) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .-]/g, '')
    .trim()
    .slice(0, max)
    .toUpperCase()

function crc16(s: string) {
  let crc = 0xffff
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Chave como o Banco Central espera: celular com +55, CPF/CNPJ só números, e-mail e aleatória como estão. */
export function normalizePixKey(key: string) {
  const k = key.trim()
  if (/@/.test(k) || /^[0-9a-f-]{32,36}$/i.test(k)) return k
  const d = k.replace(/\D/g, '')
  if (/^\+/.test(k)) return '+' + d
  if (d.length === 11 && /^\(?\d{2}\)?\s?9/.test(k) && !/[.-]\d{2}$/.test(k)) return '+55' + d // celular com DDD
  if (d.length === 13 && d.startsWith('55')) return '+' + d
  return d || k
}

export function pixPayload(o: { key: string; name: string; city: string; amount?: number; txid?: string; message?: string }) {
  const gui = f('00', 'br.gov.bcb.pix') + f('01', normalizePixKey(o.key)) + (o.message ? f('02', o.message.slice(0, 40)) : '')
  const body =
    f('00', '01') +
    f('26', gui) +
    f('52', '0000') +
    f('53', '986') +
    (o.amount && o.amount > 0 ? f('54', o.amount.toFixed(2)) : '') +
    f('58', 'BR') +
    f('59', plain(o.name, 25) || 'RECEBEDOR') +
    f('60', plain(o.city, 15) || 'BRASIL') +
    f('62', f('05', (o.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'))
  const withCrc = body + '6304'
  return withCrc + crc16(withCrc)
}
