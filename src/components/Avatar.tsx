import type { Settings } from '../types'
import { Icon } from './Icon'

/** Símbolos para quem não tem foto ou logo. */
export const AVATAR_ICONS: [string, string][] = [
  ['user', 'pessoa'],
  ['heart', 'coração'],
  ['home', 'casa'],
  ['building', 'escritório'],
  ['briefcase', 'empresa'],
  ['ruler', 'arquitetura'],
  ['hardhat', 'engenharia'],
  ['box', '3d'],
  ['edit', 'desenho'],
  ['camera', 'imagem'],
  ['sparkle', 'brilho'],
  ['leaf', 'natureza'],
]

/** Foto/logo do estúdio, ou o símbolo escolhido. */
export function AvatarGlyph({ s, size }: { s: Settings; size: number }) {
  return s.logo ? <img src={s.logo} alt="" /> : <Icon name={s.avatarIcon || 'user'} size={size} />
}
