/* Desenhos do planê.apê: traço fino + um preenchimento suave, nas cores do apê (variáveis --a-*).
   Um por produto/assunto, para a pessoa entender de relance. Conteúdo fixo, sem nada vindo de fora. */

const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'
const A = (d: string) => `<path d="${d}" fill="var(--art-a)" stroke="none"/>` // mancha de cor (fundo)
const B = (d: string) => `<path d="${d}" fill="var(--art-b)" stroke="none"/>` // detalhe de destaque

const ARTS: Record<string, string> = {
  vistoria: `${A('M10 14h30v42H10z')}<g ${S}><rect x="10" y="12" width="30" height="44" rx="4"/><path d="M19 8h12v8H19z"/><path d="M16 26l3 3 6-6M16 38l3 3 6-6M29 27h6M29 39h6"/></g>${B('M44 40a9 9 0 1 1 0.01 0z')}<g ${S}><circle cx="44" cy="44" r="9"/><path d="M50.5 50.5L57 57"/></g>`,
  planilha: `${A('M8 12h48v40H8z')}<g ${S}><rect x="8" y="12" width="48" height="40" rx="4"/><path d="M8 22h48M22 12v40M8 32h48M8 42h48"/></g>${B('M30 46h5v-8h-5zM38 46h5v-14h-5zM46 46h5v-20h-5z')}`,
  orcamento: `${A('M6 16h22v34H6z')}${A('M36 16h22v34H36z')}<g ${S}><rect x="6" y="14" width="22" height="36" rx="3"/><rect x="36" y="14" width="22" height="36" rx="3"/><path d="M11 22h12M11 28h8M41 22h12M41 28h8"/><path d="M28 32h8M33 29l3 3-3 3"/></g>${B('M42 38h10v6H42z')}<g ${S}><path d="M12 40h10"/></g>`,
  medidas: `${A('M6 34l28-28 24 24-28 28z')}<g ${S}><path d="M6 34L34 6l24 24-28 28z"/><path d="M16 24l4 4M22 18l5 5M28 12l4 4M34 30l-4-4M40 24l-5-5"/></g>${B('M44 46a6 6 0 1 1 0.01 0z')}`,
  enxoval: `${A('M8 30h30v20H8z')}<g ${S}><path d="M6 30h34M10 30v16a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V30M40 34h8"/><path d="M16 22c0-4 3-4 3-8M24 22c0-4 3-4 3-8"/></g>${B('M44 12h14v26H44z')}<g ${S}><rect x="44" y="12" width="14" height="26" rx="2"/><path d="M44 20h14"/></g>`,
  entregas: `${A('M10 26l20-10 20 10v22L30 58 10 48z')}<g ${S}><path d="M10 26l20-10 20 10v22L30 58 10 48z"/><path d="M10 26l20 10 20-10M30 36v22"/></g>${B('M44 8a8 8 0 1 1 0.01 0z')}<g ${S}><circle cx="48" cy="14" r="8"/><path d="M44.5 14l2.5 2.5 4.5-5"/></g>`,
  mudanca: `${A('M8 30h22v22H8z')}${A('M30 36h22v16H30z')}<g ${S}><rect x="8" y="30" width="22" height="22" rx="2"/><rect x="30" y="36" width="22" height="16" rx="2"/><rect x="16" y="12" width="20" height="18" rx="2"/><path d="M8 38h22M30 42h22M26 12v6"/></g>${B('M54 22l4 4-4 4z')}`,
  decoracao: `${A('M14 52h36v4H14z')}<g ${S}><path d="M20 10h16l6 14H14z"/><path d="M28 24v24M20 52h16"/></g>${B('M44 36c0-6 6-10 10-10 0 6-4 10-10 10z')}<g ${S}><path d="M46 52V36c0-6 6-10 10-10 0 6-4 10-10 10M42 52h10"/></g>`,
  contrato: `${A('M6 30L28 12l22 18v24H6z')}<g ${S}><path d="M6 30L28 12l22 18"/><path d="M10 27v27h36V27"/><path d="M22 54V40h12v14"/></g>${B('M40 34h18v24H40z')}<g ${S}><rect x="40" y="32" width="18" height="26" rx="2"/><path d="M44 40h10M44 46h10M44 52h6"/></g>`,
  calculo: `${A('M10 8h28v48H10z')}<g ${S}><rect x="10" y="8" width="28" height="48" rx="4"/><rect x="15" y="13" width="18" height="10" rx="2"/><path d="M17 31h2M24 31h2M31 31h2M17 39h2M24 39h2M31 39h2M17 47h2M24 47h9"/></g>${B('M42 30l9-8 9 8v12H42z')}<g ${S}><path d="M42 30l9-8 9 8M44 28v14h14V28"/></g>`,
  decorado: `${A('M8 32h38v14H8z')}<g ${S}><path d="M10 32v-6a4 4 0 0 1 4-4h26a4 4 0 0 1 4 4v6"/><path d="M6 34a4 4 0 0 1 8 0v8h26v-8a4 4 0 0 1 8 0v14H6z"/><path d="M10 48v4M44 48v4"/></g>${B('M48 10a8 8 0 1 1 0.01 0z')}<g ${S}><circle cx="50" cy="16" r="7"/><path d="M55 21l5 5"/></g>`,
  casa: `${A('M8 30L32 10l24 20v26H8z')}<g ${S}><path d="M6 32L32 10l26 22"/><path d="M12 28v28h40V28"/><path d="M26 56V42h12v14"/></g>${B('M28 22a5 5 0 0 1 4 2 5 5 0 0 1 4-2c3 0 5 2 5 5 0 5-9 10-9 10s-9-5-9-10c0-3 2-5 5-5z')}`,
  celular: `${A('M18 6h28v52H18z')}<g ${S}><rect x="18" y="6" width="28" height="52" rx="5"/><path d="M28 52h8"/><path d="M24 18h16M24 26h10"/></g>${B('M24 32h16v12H24z')}`,
  planta: `${A('M8 8h48v48H8z')}<g ${S}><rect x="8" y="8" width="48" height="48" rx="2"/><path d="M8 30h22M30 8v18M30 34v22M38 30h18"/></g>${B('M14 14h12v8H14zM36 40h14v10H36z')}`,
  projeto3d: `${A('M32 8l22 12v24L32 56 10 44V20z')}<g ${S}><path d="M32 8l22 12v24L32 56 10 44V20z"/><path d="M10 20l22 12 22-12M32 32v24"/></g>${B('M18 38l8 4v8l-8-4z')}`,
  anexo: `${A('M14 8h26l10 10v38H14z')}<g ${S}><path d="M14 8h26l10 10v38H14z"/><path d="M40 8v10h10"/></g>${B('M22 32h20v4H22zM22 40h14v4H22z')}<g ${S}><path d="M44 46l6 6 8-12"/></g>`,
  ia: `${A('M10 14h44v32H10z')}<g ${S}><rect x="10" y="14" width="44" height="32" rx="4"/><path d="M18 24h14M18 31h22M18 38h10"/></g>${B('M46 40l3 6 6 3-6 3-3 6-3-6-6-3 6-3z')}`,
  comparar: `${A('M6 20h20v32H6z')}${A('M38 12h20v40H38z')}<g ${S}><rect x="6" y="20" width="20" height="32" rx="3"/><rect x="38" y="12" width="20" height="40" rx="3"/><path d="M26 34h12"/></g>${B('M43 4l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z')}`,
  grupo: `${A('M6 40c2-8 8-12 14-12s12 4 14 12z')}<g ${S}><circle cx="20" cy="20" r="7"/><path d="M6 44c2-9 8-13 14-13s12 4 14 13"/><circle cx="42" cy="22" r="6"/><path d="M36 33c2-1 4-2 6-2 6 0 10 4 12 11"/></g>${B('M44 46h14v10H44z')}<g ${S}><path d="M48 51h6"/></g>`,
  carrinho: `${A('M14 18h40l-5 22H19z')}<g ${S}><path d="M6 10h6l7 32h30l5-22H14"/><circle cx="22" cy="50" r="3.5"/><circle cx="44" cy="50" r="3.5"/></g>${B('M28 22h8v12h-8z')}`,
  download: `${A('M8 40h48v14H8z')}<g ${S}><path d="M32 10v28M22 28l10 10 10-10"/><path d="M8 40v10a4 4 0 0 0 4 4h40a4 4 0 0 0 4-4V40"/></g>${B('M40 46h8v4h-8z')}`,
}

export function ApeArt({ name, size = 56, tone = 'pri' }: { name: string; size?: number; tone?: 'pri' | 'sec' | 'ter' }) {
  return (
    <svg
      className={`ape-art ape-art-${tone}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ARTS[name] || ARTS.casa }}
    />
  )
}
