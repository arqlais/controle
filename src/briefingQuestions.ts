import type { BriefingQuestion } from './types'

/* Perguntas prontas do briefing para cliente final. O arquiteto escolhe os blocos
   que quer mandar e pode acrescentar perguntas próprias. As que têm "field" também
   preenchem a ficha do cliente quando ele responde. */

const q = (section: string, id: string, label: string, kind: BriefingQuestion['kind'] = 'text', extra: Partial<BriefingQuestion> = {}): BriefingQuestion => ({ id, section, label, kind, ...extra })

export const BRIEFING_SECTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'voces', label: 'sobre vocês', hint: 'quem mora, profissões, filhos e pets' },
  { id: 'rotina', label: 'rotina e hábitos', hint: 'como usam a casa no dia a dia' },
  { id: 'imovel', label: 'o imóvel', hint: 'tipo, metragem, endereço e situação' },
  { id: 'ambientes', label: 'ambientes', hint: 'o que entra no projeto e o que precisa' },
  { id: 'estilo', label: 'estilo e referências', hint: 'cores, materiais, o que ama e o que não quer' },
  { id: 'prazo', label: 'prazo e investimento', hint: 'quando e quanto pretendem investir' },
]

export const DEFAULT_BRIEFING: BriefingQuestion[] = [
  q('voces', 'nome', 'Seu nome completo'),
  q('voces', 'profissao', 'Sua profissão', 'text', { field: 'profession' }),
  q('voces', 'estado-civil', 'Estado civil', 'choice', { options: ['solteira(o)', 'casada(o)', 'união estável', 'divorciada(o)', 'viúva(o)'], field: 'marital' }),
  q('voces', 'moradores', 'Quem vai morar ou usar o espaço? (idades e profissões)', 'long', { field: 'household' }),
  q('voces', 'filhos', 'Filhos? Quantos e quais idades?', 'text', { field: 'kids' }),
  q('voces', 'pets', 'Tem pets? Quais?', 'text', { field: 'pets' }),
  q('rotina', 'trabalho-casa', 'Alguém trabalha em casa?', 'choice', { options: ['sim, todo dia', 'às vezes', 'não'] }),
  q('rotina', 'visitas', 'Costumam receber visitas?', 'choice', { options: ['muito', 'às vezes', 'pouco'] }),
  q('rotina', 'cozinha', 'Como usam a cozinha?', 'choice', { options: ['cozinham todo dia', 'só o básico', 'quase não usam'] }),
  q('rotina', 'rotina', 'Conte um pouco da rotina de vocês em casa', 'long', { field: 'routine' }),
  q('imovel', 'tipo-imovel', 'Tipo de imóvel', 'choice', { options: ['apartamento', 'casa', 'casa em condomínio', 'sala / loja comercial', 'escritório', 'terreno', 'outro'], field: 'propertyType' }),
  q('imovel', 'posse', 'O imóvel é', 'choice', { options: ['próprio', 'alugado', 'na planta', 'de família'], field: 'propertyOwnership' }),
  q('imovel', 'metragem', 'Metragem aproximada (m²)', 'text', { field: 'propertyArea' }),
  q('imovel', 'endereco-obra', 'Endereço do imóvel', 'text', { field: 'propertyAddress' }),
  q('imovel', 'situacao', 'Situação atual', 'choice', { options: ['novo, nunca reformado', 'precisa de reforma', 'em obra', 'só mudar a decoração'] }),
  q('ambientes', 'ambientes', 'Quais ambientes entram no projeto?', 'multi', { options: ['sala de estar', 'sala de jantar', 'cozinha', 'lavanderia', 'suíte', 'quartos', 'quarto de criança', 'banheiros', 'home office', 'varanda / área gourmet', 'área externa', 'fachada'] }),
  q('ambientes', 'manter', 'Tem móveis ou objetos que querem manter?', 'long'),
  q('ambientes', 'precisa', 'O que não pode faltar? (ex.: muito armário, bancada grande, espaço para a bicicleta)', 'long'),
  q('ambientes', 'incomoda', 'O que mais incomoda hoje no espaço?', 'long'),
  q('estilo', 'estilo', 'Com qual estilo vocês se identificam?', 'multi', { options: ['aconchegante', 'moderno', 'minimalista', 'clássico', 'industrial', 'rústico', 'boho', 'contemporâneo', 'ainda não sei'], field: 'style' }),
  q('estilo', 'cores', 'Cores e materiais que amam', 'long'),
  q('estilo', 'nao-quer', 'O que vocês NÃO querem de jeito nenhum?', 'long'),
  q('estilo', 'referencias', 'Links de referências (Pinterest, Instagram…)', 'long'),
  q('prazo', 'prazo', 'Para quando precisam do projeto / da obra pronta?', 'text', { field: 'deadline' }),
  q('prazo', 'investimento', 'Quanto pretendem investir na obra (sem o projeto)?', 'choice', { options: ['até R$ 30 mil', 'R$ 30 a 80 mil', 'R$ 80 a 150 mil', 'R$ 150 a 300 mil', 'acima de R$ 300 mil', 'prefiro conversar'], field: 'investment' }),
  q('prazo', 'obs', 'Mais alguma coisa que eu deveria saber?', 'long'),
]
