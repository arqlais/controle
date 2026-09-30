/* Paleta do traço: azul (grafite) e rosa, com os tons de cada um. Toda cor da interface sai daqui
   (status, etiquetas, gráficos). As cores dos documentos de cada profissional ficam nas configurações dela. */
export const PAL = {
  // azuis
  navy: '#2f3a45',
  slate: '#3e4b57', // principal
  blue: '#566779',
  steel: '#7d8c99',
  mist: '#9aa3ab',
  // rosas
  roseDeep: '#8f6d64',
  roseDark: '#a07a70',
  rose: '#a88a80', // principal
  roseMid: '#c29b92',
  roseSoft: '#d6b3ab',
  // apoio
  sand: '#b8aca6',
  // sentidos (dentro da paleta)
  good: '#4f6475', // feito, pago, aprovado
  warn: '#b08a7e', // aguardando, enviado
  bad: '#9a5b53', // urgente, cancelado, atrasado
} as const
