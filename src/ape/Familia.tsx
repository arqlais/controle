/* Família da casa (plataforma do apê): quem vai morar, com um símbolo para cada pessoa e cada pet. */

export type TipoMembro = 'adulto' | 'crianca' | 'bebe' | 'idoso' | 'cachorro' | 'gato' | 'passaro' | 'peixe' | 'roedor' | 'pet'
export interface Membro { id: string; nome: string; tipo: TipoMembro; papel?: string }

export const PESSOAS: [TipoMembro, string][] = [['adulto', 'adulto'], ['crianca', 'criança'], ['bebe', 'bebê'], ['idoso', 'idoso(a)']]
export const PETS: [TipoMembro, string][] = [['cachorro', 'cachorro'], ['gato', 'gato'], ['passaro', 'pássaro'], ['peixe', 'peixe'], ['roedor', 'hamster'], ['pet', 'outro pet']]
export const ehPet = (t: TipoMembro) => PETS.some(([k]) => k === t)
export const rotuloMembro = (t: TipoMembro) => [...PESSOAS, ...PETS].find(([k]) => k === t)?.[1] || ''

/* desenhos de traço (24×24), no mesmo estilo dos ícones da plataforma */
const D: Record<TipoMembro, string> = {
  adulto: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c.6-4 3.4-6.5 7-6.5s6.4 2.5 7 6.5"/>',
  crianca: '<circle cx="12" cy="9" r="3"/><path d="M7 20.5c.4-3.2 2.4-5.2 5-5.2s4.6 2 5 5.2"/><path d="M9.5 6.6c.6-1.4 1.5-2.1 2.5-2.1s1.9.7 2.5 2.1"/>',
  bebe: '<circle cx="12" cy="10" r="4.5"/><path d="M10.4 9.6h.01M13.6 9.6h.01"/><path d="M10.8 12c.7.5 1.7.5 2.4 0"/><path d="M12 5.5c0-1 .6-1.8 1.4-2"/><path d="M7.5 20.5c.8-2.4 2.4-3.6 4.5-3.6s3.7 1.2 4.5 3.6"/>',
  idoso: '<circle cx="11" cy="7.5" r="3.2"/><path d="M5 20.5c.5-3.6 2.8-6 6-6 1.4 0 2.6.4 3.6 1.2"/><path d="M17.5 13.5v7M17.5 13.5c0-1 1.6-1 1.6 0"/>',
  cachorro: '<path d="M6 8.5 4.5 4.8 8.6 6.6"/><path d="M18 8.5l1.5-3.7-4.1 1.8"/><path d="M6.4 8.2C7.6 6.8 9.6 6 12 6s4.4.8 5.6 2.2c1 1.2 1.4 2.8 1.4 4.6 0 3.9-3.1 6.7-7 6.7s-7-2.8-7-6.7c0-1.8.4-3.4 1.4-4.6Z"/><path d="M9.6 11.6h.01M14.4 11.6h.01"/><path d="M11 14.4h2l-1 1.1Z"/>',
  gato: '<path d="M5.5 10.5V4.2l4 3.2c.8-.2 1.6-.3 2.5-.3s1.7.1 2.5.3l4-3.2v6.3"/><path d="M5.5 10.5c-.4.8-.5 1.6-.5 2.5 0 3.9 3.1 6.5 7 6.5s7-2.6 7-6.5c0-.9-.1-1.7-.5-2.5"/><path d="M9.6 12.4h.01M14.4 12.4h.01"/><path d="M11.2 14.6h1.6l-.8.8Z"/><path d="M3 14.4l3.4.4M3.4 17l3.2-1M21 14.4l-3.4.4M20.6 17l-3.2-1"/>',
  passaro: '<path d="M16 7.5a3.5 3.5 0 0 0-6.6 1.6L5 13.5c2.6 1.4 5.6 1.6 8.2.4a5 5 0 0 0 2.8-4.4V7.5Z"/><path d="M16 8l3-.5-3 2"/><path d="M13.3 7.4h.01"/><path d="M10 16.5l-1 3M13 16l.5 3.5"/>',
  peixe: '<path d="M3.5 12c2.4-3.4 5.4-5 8.5-5 3.6 0 6.2 2.2 7.5 5-1.3 2.8-3.9 5-7.5 5-3.1 0-6.1-1.6-8.5-5Z"/><path d="M19.5 12 22 9v6Z"/><path d="M8.6 11.2h.01"/><path d="M12.5 9.5c.8.8.8 4.2 0 5"/>',
  roedor: '<circle cx="7.5" cy="8" r="2.2"/><circle cx="16.5" cy="8" r="2.2"/><path d="M5.5 14c0-3 2.9-5 6.5-5s6.5 2 6.5 5-2.9 5.5-6.5 5.5-6.5-2.5-6.5-5.5Z"/><path d="M10 13.4h.01M14 13.4h.01"/><path d="M11.4 15.6h1.2"/>',
  pet: '<circle cx="6.5" cy="10.5" r="1.8"/><circle cx="9.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="17.5" cy="10.5" r="1.8"/><path d="M8 17.2c0-2.6 1.8-4.7 4-4.7s4 2.1 4 4.7c0 1.4-1 2.3-2.2 2.3-.7 0-1.2-.4-1.8-.4s-1.1.4-1.8.4C9 19.5 8 18.6 8 17.2Z"/>',
}

export function MembroIcone({ tipo, size = 22 }: { tipo: TipoMembro; size?: number }) {
  return <svg className="ape-i" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: D[tipo] || D.pet }} />
}

/** A "familinha" em linha: cada um com o seu símbolo e o nome embaixo. */
export function Familinha({ membros, onEditar, compacta = false }: { membros: Membro[]; onEditar?: () => void; compacta?: boolean }) {
  if (!membros.length)
    return onEditar ? (
      <button type="button" className="ape-fam-vazia" onClick={onEditar}>
        <span className="ape-fam-av"><MembroIcone tipo="adulto" /></span>
        <span className="ape-fam-av pet"><MembroIcone tipo="cachorro" /></span>
        <span><b>monte a sua família</b><small>quem vai morar, até os pets</small></span>
      </button>
    ) : null
  return (
    <div className={`ape-fam ${compacta ? 'compacta' : ''}`}>
      {membros.map((m) => (
        <span key={m.id} className="ape-fam-m" title={`${m.nome || rotuloMembro(m.tipo)}${m.papel ? ` · ${m.papel}` : ''}`}>
          <span className={`ape-fam-av ${ehPet(m.tipo) ? 'pet' : ''}`}><MembroIcone tipo={m.tipo} /></span>
          {!compacta && <small>{m.nome || rotuloMembro(m.tipo)}</small>}
        </span>
      ))}
      {onEditar && <button type="button" className="ape-fam-mais" onClick={onEditar} aria-label="Editar a família">+</button>}
    </div>
  )
}

/** Editor da família: adicionar pessoas e pets, escolher o tipo, dar nome e o que é (papel). */
export function EditarFamilia({ membros, mudar }: { membros: Membro[]; mudar: (l: Membro[]) => void }) {
  const add = (tipo: TipoMembro) => mudar([...membros, { id: crypto.randomUUID(), nome: '', tipo }])
  const set = (id: string, campos: Partial<Membro>) => mudar(membros.map((m) => (m.id === id ? { ...m, ...campos } : m)))
  return (
    <div className="ape-fam-ed">
      {membros.map((m) => {
        const opcoes = ehPet(m.tipo) ? PETS : PESSOAS
        return (
          <div key={m.id} className="ape-fam-ed-l">
            <span className={`ape-fam-av ${ehPet(m.tipo) ? 'pet' : ''}`}><MembroIcone tipo={m.tipo} /></span>
            <div className="ape-fam-ed-c">
              <div className="ape-fam-ed-r">
                <input value={m.nome} onChange={(e) => set(m.id, { nome: e.target.value })} placeholder={ehPet(m.tipo) ? 'nome do pet' : 'nome'} aria-label="Nome" />
                <input value={m.papel || ''} onChange={(e) => set(m.id, { papel: e.target.value })} placeholder={ehPet(m.tipo) ? 'raça' : 'o que é'} aria-label="O que é" />
              </div>
              <div className="ape-fam-tipos" role="radiogroup" aria-label="Tipo">
                {opcoes.map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={m.tipo === k} title={l} aria-label={l} onClick={() => set(m.id, { tipo: k })}><MembroIcone tipo={k} size={18} /></button>
                ))}
              </div>
            </div>
            <button type="button" className="ape-icobtn" onClick={() => mudar(membros.filter((x) => x.id !== m.id))} aria-label={`Tirar ${m.nome || rotuloMembro(m.tipo)}`}>×</button>
          </div>
        )
      })}
      <div className="ape-fam-add">
        <button type="button" className="ape-btn sm" onClick={() => add('adulto')}><MembroIcone tipo="adulto" size={16} />+ pessoa</button>
        <button type="button" className="ape-btn sm" onClick={() => add('cachorro')}><MembroIcone tipo="pet" size={16} />+ pet</button>
      </div>
    </div>
  )
}
