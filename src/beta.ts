import { ARTIFACT } from './env'

/* Novidades em teste: aparecem só para a dona (no aparelho dela, inclusive em "ver como cliente")
   e na prévia. Quem está testando o sistema continua vendo a versão de antes até ela liberar. */

const KEY = 'traco-beta'

export function isBeta() {
  if (ARTIFACT) return true
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** A dona entrou: marca este aparelho para ver as novidades em teste. */
export function markBetaDevice() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ok */
  }
}
