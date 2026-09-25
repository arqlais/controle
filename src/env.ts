/** true quando o build é a versão publicada como Artifact no claude.ai
 *  (sem impressão, sem downloads e sem URL própria). */
export const ARTIFACT = import.meta.env.VITE_ARTIFACT === '1'
