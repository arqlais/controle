/* Checklist de vistoria de entrega de chaves (o mesmo da planê.apê, "Meu novo apê · vistoria completa"):
 * ambiente → quadro → perguntas de sim ou não. Usado para montar o checklist de vistoria dos documentos de obra. */

export type VistoriaAmbiente = { ambiente: string; quadros: { nome: string; itens: string[] }[] }

export const VISTORIA_CHECKLIST: VistoriaAmbiente[] = [
  {
    ambiente: "Cozinha",
    quadros: [
      { nome: "Bancada", itens: ["A cuba está fixada corretamente?", "A vedação está adequada sem vazar?", "A bancada está nivelada sem acumular água?", "A bancada está sem trincas / corrosão?", "O frontão / espelho está bem fixado?", "O frontão / espelho está no tamanho adequado?", "O suporte da bancada está bem fixado?", "O suporte da bancada está sem corrosão?", "A torneira está sem vazamento?", "A torneira está sem riscos / enferrujada?", "Os registros estão funcionando perfeitamente?", "Os registros estão sem riscos / enferrujados?", "O sifão está sem vazamento?"] },
      { nome: "Piso, parede e forro", itens: ["Os revestimentos estão sem áreas ocas?", "Os revestimentos estão sem arranhões / trincas?", "Os revestimentos estão sem manchas?", "Os rejuntes estão em perfeito estado?", "O rodapé está fixado corretamente?", "O rodapé está sem manchas de tinta?", "O rodapé está sem arranhões / trincas?", "O encontro com o piso e rodapé está bem vedado?", "O escoamento da água está para o lado correto?", "O ralo está sem entupimento?", "O ralo tem tampa e em perfeito estado?", "A pintura de paredes e teto está sem manchas?", "A pintura de paredes e teto está uniforme?", "As paredes e forro estão sem trincas?", "As soleiras estão bem fixadas?", "As soleiras estão sem trincas?"] },
      { nome: "Elétrica e iluminação", itens: ["O quadro de luz está com identificação de circuitos?", "A tampa do quadro de luz está funcionando corretamente?", "As tomadas estão funcionando?", "As tomadas estão na voltagem certa?", "As tomadas estão alinhadas?", "Os interruptores estão funcionando?", "A iluminação está funcionando?", "Os interruptores estão alinhados?", "As tomadas e interruptores estão sem manchas?", "As luminárias estão sem manchas?", "A campainha está funcionando?", "A campainha está sem manchas?", "O interfone está funcionando?", "O interfone está bem fixado?", "O interfone está sem manchas?"] },
      { nome: "Portas e janelas", itens: ["As portas de madeira estão funcionando bem?", "As portas de madeira estão com todas as dobradiças?", "As portas de madeira estão com maçanetas funcionando?", "As maçanetas estão sem ferrugem / oxidação?", "As fechaduras das portas de madeira estão funcionando?", "As portas de alumínio estão funcionando bem?", "As portas de alumínio estão sem manchas / arranhões?", "Os vidros das portas estão bem fixados?", "Os vidros das portas estão sem trincas ou manchas?", "As fechaduras das portas de alumínio estão funcionando?", "As janelas estão funcionando bem?", "As pingadeiras estão instaladas corretamente?", "Os vidros das janelas estão bem fixados?", "Os vidros das janelas estão sem trincas ou manchas?", "Os trilhos das janelas estão desentupidos?", "As fechaduras das janelas estão funcionando?"] },
    ],
  },
  {
    ambiente: "Lavanderia",
    quadros: [
      { nome: "Tanque", itens: ["O tanque está bem fixado?", "O tanque está sem trincas ou manchas?", "O tanque está sem vazamento?", "A torneira está funcionando bem?", "A torneira está sem riscos ou oxidação?", "Os registros estão funcionando perfeitamente?", "Os registros estão sem riscos / enferrujados?", "O sifão está sem vazamento?"] },
      { nome: "Piso, parede e forro", itens: ["Os revestimentos estão sem áreas ocas?", "Os revestimentos estão sem arranhões / trincas?", "Os revestimentos estão sem manchas?", "Os rejuntes estão em perfeito estado?", "O rodapé está fixado corretamente?", "O rodapé está sem manchas de tinta?", "O rodapé está sem arranhões / trincas?", "O encontro com o piso e rodapé está bem vedado?", "O escoamento da água está para o lado correto?", "O ralo está sem entupimento?", "O ralo tem tampa e em perfeito estado?", "A pintura de paredes e teto está sem manchas?", "As paredes e forro estão sem trincas?", "As soleiras estão bem fixadas?", "As soleiras estão sem trincas?"] },
      { nome: "Elétrica e iluminação", itens: ["As tomadas estão funcionando?", "As tomadas estão na voltagem certa?", "As tomadas estão alinhadas?", "Os interruptores estão funcionando?", "A iluminação está funcionando?", "Os interruptores estão alinhados?", "As tomadas e interruptores estão sem manchas?", "As luminárias estão sem manchas?"] },
      { nome: "Gás", itens: ["A grelha de ventilação está instalada corretamente?", "A grelha de ventilação está sem manchas?", "A tubulação de gás está bem fixada?"] },
      { nome: "Portas e janelas", itens: ["As portas de madeira estão funcionando bem?", "As portas de madeira estão com todas as dobradiças?", "As portas de madeira estão com maçanetas funcionando?", "As maçanetas estão sem ferrugem / oxidação?", "As fechaduras das portas de madeira estão funcionando?", "As portas de alumínio estão funcionando bem?", "As portas de alumínio estão sem manchas / arranhões?", "Os vidros das portas estão bem fixados?", "Os vidros das portas estão sem trincas ou manchas?", "As fechaduras das portas de alumínio estão funcionando?", "As janelas estão funcionando bem?", "As pingadeiras estão instaladas corretamente?", "Os vidros das janelas estão bem fixados?", "Os vidros das janelas estão sem trincas ou manchas?", "Os trilhos das janelas estão desentupidos?", "As fechaduras das janelas estão funcionando?"] },
    ],
  },
  {
    ambiente: "Sala",
    quadros: [
      { nome: "Piso, parede e forro", itens: ["O contrapiso está uniforme e nivelado?", "O contrapiso está sem áreas ocas?", "Os revestimentos estão sem áreas ocas?", "Os revestimentos estão sem arranhões / trincas?", "Os revestimentos estão sem manchas?", "Os rejuntes estão em perfeito estado?", "O rodapé está fixado corretamente?", "O rodapé está sem manchas de tinta?", "O rodapé está sem arranhões / trincas?", "O encontro com o piso e rodapé está bem vedado?", "A pintura de paredes e teto está sem manchas?", "As paredes e forro estão sem trincas?", "As soleiras estão bem fixadas?", "As soleiras estão sem trincas?"] },
      { nome: "Elétrica e iluminação", itens: ["As tomadas estão funcionando?", "As tomadas estão na voltagem certa?", "As tomadas estão alinhadas?", "Os interruptores estão funcionando?", "A iluminação está funcionando?", "Os interruptores estão alinhados?", "As tomadas e interruptores estão sem manchas?", "As luminárias estão sem manchas?"] },
      { nome: "Portas e janelas", itens: ["As portas de madeira estão funcionando bem?", "As portas de madeira estão com todas as dobradiças?", "As portas de madeira estão com maçanetas funcionando?", "As maçanetas estão sem ferrugem / oxidação?", "As fechaduras das portas de madeira estão funcionando?", "As portas de alumínio estão funcionando bem?", "As portas de alumínio estão sem manchas / arranhões?", "Os vidros das portas estão bem fixados?", "Os vidros das portas estão sem trincas ou manchas?", "As fechaduras das portas de alumínio estão funcionando?", "As janelas estão funcionando bem?", "As pingadeiras estão instaladas corretamente?", "Os vidros das janelas estão bem fixados?", "Os vidros das janelas estão sem trincas ou manchas?", "Os trilhos das janelas estão desentupidos?", "As fechaduras das janelas estão funcionando?"] },
    ],
  },
  {
    ambiente: "Sacada / Varanda",
    quadros: [
      { nome: "Bancada", itens: ["A cuba está fixada corretamente?", "A vedação está adequada sem vazar?", "A bancada está nivelada sem acumular água?", "A bancada está sem trincas / corrosão?", "O frontão / espelho está bem fixado?", "O frontão / espelho está no tamanho adequado?", "O suporte da bancada está bem fixado?", "O suporte da bancada está sem corrosão?", "A torneira está sem vazamento?", "A torneira está sem riscos / enferrujada?", "Os registros estão funcionando perfeitamente?", "Os registros estão sem riscos / enferrujados?", "O sifão está sem vazamento?"] },
      { nome: "Piso, parede e forro", itens: ["Os revestimentos estão sem áreas ocas?", "Os revestimentos estão sem arranhões / trincas?", "Os revestimentos estão sem manchas?", "Os rejuntes estão em perfeito estado?", "O rodapé está fixado corretamente?", "O rodapé está sem manchas de tinta?", "O rodapé está sem arranhões / trincas?", "O encontro com o piso e rodapé está bem vedado?", "O escoamento da água está para o lado correto?", "O ralo está sem entupimento?", "O ralo tem tampa e em perfeito estado?", "A pintura de paredes e teto está sem manchas?", "As paredes e forro estão sem trincas?", "As soleiras estão bem fixadas?", "As soleiras estão sem trincas?"] },
      { nome: "Elétrica e iluminação", itens: ["As tomadas estão funcionando?", "As tomadas estão na voltagem certa?", "As tomadas estão alinhadas?", "Os interruptores estão funcionando?", "A iluminação está funcionando?", "Os interruptores estão alinhados?", "As tomadas e interruptores estão sem manchas?", "As luminárias estão sem manchas?"] },
      { nome: "Churrasqueira", itens: ["A borda da churrasqueira está sem trincas?", "A churrasqueira está limpa de entulhos?", "A churrasqueira tem acabamento interno?", "A gaveta de cinzas está funcionando?", "A gaveta de cinzas está limpa e sem oxidação?"] },
      { nome: "Guarda-corpo", itens: ["O guarda-corpo está bem fixado?", "As grades ou vidros estão sem riscos ou trincas?", "O guarda-corpo está limpo e sem manchas?", "A pingadeira / soleira está sem trincas?"] },
      { nome: "Portas e janelas", itens: ["As portas de alumínio estão funcionando bem?", "As portas de alumínio estão sem manchas / arranhões?", "Os vidros das portas estão bem fixados?", "Os vidros das portas estão sem trincas ou manchas?", "As fechaduras das portas de alumínio estão funcionando?"] },
    ],
  },
  {
    ambiente: "Quarto",
    quadros: [
      { nome: "Piso, parede e forro", itens: ["O contrapiso está uniforme e nivelado?", "O contrapiso está sem áreas ocas?", "Os revestimentos estão sem áreas ocas?", "Os revestimentos estão sem arranhões / trincas?", "Os revestimentos estão sem manchas?", "Os rejuntes estão em perfeito estado?", "O rodapé está fixado corretamente?", "O rodapé está sem manchas de tinta?", "O rodapé está sem arranhões / trincas?", "O encontro com o piso e rodapé está bem vedado?", "A pintura de paredes e teto está sem manchas?", "As paredes e forro estão sem trincas?", "As soleiras estão bem fixadas?", "As soleiras estão sem trincas?"] },
      { nome: "Elétrica e iluminação", itens: ["As tomadas estão funcionando?", "As tomadas estão na voltagem certa?", "As tomadas estão alinhadas?", "Os interruptores estão funcionando?", "A iluminação está funcionando?", "Os interruptores estão alinhados?", "As tomadas e interruptores estão sem manchas?", "As luminárias estão sem manchas?"] },
      { nome: "Portas e janelas", itens: ["As portas de madeira estão funcionando bem?", "As portas de madeira estão com todas as dobradiças?", "As portas de madeira estão com maçanetas funcionando?", "As maçanetas estão sem ferrugem / oxidação?", "As fechaduras das portas de madeira estão funcionando?", "As janelas estão funcionando bem?", "As pingadeiras estão instaladas corretamente?", "Os vidros das janelas estão bem fixados?", "Os vidros das janelas estão sem trincas ou manchas?", "Os trilhos das janelas estão desentupidos?", "As fechaduras das janelas estão funcionando?"] },
    ],
  },
  {
    ambiente: "Corredor",
    quadros: [
      { nome: "Piso, parede e forro", itens: ["O contrapiso está uniforme e nivelado?", "O contrapiso está sem áreas ocas?", "Os revestimentos estão sem áreas ocas?", "Os revestimentos estão sem arranhões / trincas?", "Os revestimentos estão sem manchas?", "Os rejuntes estão em perfeito estado?", "O rodapé está fixado corretamente?", "O rodapé está sem manchas de tinta?", "O rodapé está sem arranhões / trincas?", "O encontro com o piso e rodapé está bem vedado?", "A pintura de paredes e teto está sem manchas?", "As paredes e forro estão sem trincas?", "As soleiras estão bem fixadas?", "As soleiras estão sem trincas?"] },
      { nome: "Elétrica e iluminação", itens: ["As tomadas estão funcionando?", "As tomadas estão na voltagem certa?", "As tomadas estão alinhadas?", "Os interruptores estão funcionando?", "A iluminação está funcionando?", "Os interruptores estão alinhados?", "As tomadas e interruptores estão sem manchas?", "As luminárias estão sem manchas?"] },
      { nome: "Portas e janelas", itens: ["As portas de madeira estão funcionando bem?", "As portas de madeira estão com todas as dobradiças?", "As portas de madeira estão com maçanetas funcionando?", "As maçanetas estão sem ferrugem / oxidação?", "As fechaduras das portas de madeira estão funcionando?"] },
    ],
  },
  {
    ambiente: "Banheiro",
    quadros: [
      { nome: "Bancada", itens: ["A cuba está fixada corretamente?", "A vedação está adequada sem vazar?", "A bancada está nivelada sem acumular água?", "A bancada está sem trincas / corrosão?", "O frontão / espelho está bem fixado?", "O frontão / espelho está no tamanho adequado?", "O suporte da bancada está bem fixado?", "O suporte da bancada está sem corrosão?", "A torneira está sem vazamento?", "A torneira está sem riscos / enferrujada?", "Os registros estão funcionando perfeitamente?", "Os registros estão sem riscos / enferrujados?", "O sifão está sem vazamento?"] },
      { nome: "Piso, parede e forro", itens: ["Os revestimentos estão sem áreas ocas?", "Os revestimentos estão sem arranhões / trincas?", "Os revestimentos estão sem manchas?", "Os rejuntes estão em perfeito estado?", "O rodapé está fixado corretamente?", "O rodapé está sem manchas de tinta?", "O rodapé está sem arranhões / trincas?", "O encontro com o piso e rodapé está bem vedado?", "O escoamento da água está para o lado correto?", "O ralo está sem entupimento?", "O ralo tem tampa e em perfeito estado?", "A pintura do teto está sem manchas?", "O forro está sem trincas?", "As soleiras estão bem fixadas?", "As soleiras estão sem trincas?"] },
      { nome: "Vaso sanitário", itens: ["O vaso está bem fixado?", "O vaso está sem trincas?", "A descarga está funcionando?", "O reabastecimento está funcionando?", "O vaso está sem manchas?"] },
      { nome: "Portas e janelas", itens: ["As portas de madeira estão funcionando bem?", "As portas de madeira estão com todas as dobradiças?", "As portas de madeira estão com maçanetas funcionando?", "As maçanetas estão sem ferrugem / oxidação?", "As fechaduras das portas de madeira estão funcionando?", "As janelas estão funcionando bem?", "As pingadeiras estão instaladas corretamente?", "Os vidros das janelas estão bem fixados?", "Os vidros das janelas estão sem trincas ou manchas?", "Os trilhos das janelas estão desentupidos?", "As fechaduras das janelas estão funcionando?"] },
      { nome: "Elétrica e iluminação", itens: ["As tomadas estão funcionando?", "As tomadas estão na voltagem certa?", "As tomadas estão alinhadas?", "Os interruptores estão funcionando?", "A iluminação está funcionando?", "Os interruptores estão alinhados?", "As tomadas e interruptores estão sem manchas?", "As luminárias estão sem manchas?", "O exaustor está funcionando?", "O exaustor está sem manchas?"] },
    ],
  },
  {
    ambiente: "Garagem",
    quadros: [
      { nome: "Vaga e depósito", itens: ["A vaga está no tamanho correto?", "O depósito está com pintura em boas condições?", "A porta do depósito está funcionando?", "A porta do depósito está em boas condições?", "APROVADO?"] },
    ],
  },
]

/** Ambientes de um apartamento compacto (2 quartos), que já vêm no checklist novo. */
export const AMBIENTES_PADRAO = ['Sala', 'Cozinha', 'Lavanderia', 'Quarto', 'Banheiro']

/** Itens do checklist (grupo = "ambiente · quadro") dos ambientes pedidos. */
export function checklistItens(ambientes: string[] = AMBIENTES_PADRAO): { group: string; title: string }[] {
  return ambientes.flatMap((a) => VISTORIA_CHECKLIST.find((x) => x.ambiente === a)?.quadros.flatMap((q) => q.itens.map((title) => ({ group: `${a} · ${q.nome}`, title }))) ?? [])
}
