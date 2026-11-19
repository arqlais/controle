import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Field, Modal } from '../components/ui'
import { toast } from '../components/dialog'
import { GRAVIDADE, TESTES, checklistHtml, laudoHtml, openRdlDoc, type Gravidade, type LaudoFoto, type Teste } from '../rdlDocs'
import { AMBIENTES_APE, AMBIENTES_EXTRA, chaveCheck, checklistDe, enviarFoto, laudoDe, linkLaudo, problemaDe, quadrosDe, rascunhoVazio, type LaudoItemRascunho, type LaudoRascunho } from '../rdlLaudo'
import { useStore } from '../store'
import { dataCurta } from '../rdlReserva'
import { unidade, type Reserva, type ReservaConfig, type ReservaStatus } from '../rdlReserva'
import { uid } from '../utils'

/* Montar o laudo da vistoria no sistema da RDL, pelo celular, durante a vistoria:
   ambientes, itens para reparo (com fotos na horizontal ou na vertical), testes, não verificados e observações.
   Salva sozinho na reserva; "publicar" coloca o laudo no painel do morador e manda o e-mail. */

type Aba = 'checklist' | 'itens' | 'fotos' | 'testes' | 'final'

export function LaudoEditor({ r, cfg, onClose, onStatus, onPublicar }: { r: Reserva; cfg: ReservaConfig; onClose: () => void; onStatus: (r: Reserva, p: Partial<ReservaStatus>, aviso?: string) => Promise<Reserva>; onPublicar: (link: string) => void }) {
  const { data } = useStore()
  // já puxa o número da ART da vistoria (controle de ARTs) e o horário marcado
  const artDoControle = (data.arts ?? []).find((a) => a.id === `art-${r.id}-vistoria`)?.number || ''
  const [l, setL] = useState<LaudoRascunho>(() => {
    const base = { ...rascunhoVazio(), ...(r.status.laudoDados ?? {}) }
    return { ...base, artNum: base.artNum || artDoControle, inicio: base.inicio || r.status.hora || '' }
  })
  const [aba, setAba] = useState<Aba>('checklist')
  const [amb, setAmb] = useState(() => l.ambientes[0] ?? 'Sala')
  const [salvo, setSalvo] = useState<'ok' | 'salvando' | 'erro'>('ok')
  const [enviando, setEnviando] = useState('')
  const sujo = useRef(false)
  const atual = useRef(r)
  atual.current = r

  // salva sozinho 1,5 s depois da última mudança
  useEffect(() => {
    if (!sujo.current) return
    setSalvo('salvando')
    const t = setTimeout(() => {
      onStatus(atual.current, { laudoDados: { ...l, atualizado: new Date().toISOString() } })
        .then(() => setSalvo('ok'))
        .catch(() => setSalvo('erro'))
    }, 1500)
    return () => clearTimeout(t)
  }, [l]) // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = (p: Partial<LaudoRascunho>) => {
    sujo.current = true
    setL((x) => ({ ...x, ...p }))
  }
  const mudarItem = (id: string, p: Partial<LaudoItemRascunho>) => mudar({ itens: l.itens.map((it) => (it.id === id ? { ...it, ...p } : it)) })
  const novoItem = () => {
    const amb = l.itens[l.itens.length - 1]?.ambiente ?? l.ambientes[0] ?? 'Sala'
    mudar({ itens: [...l.itens, { id: uid(), ambiente: amb, item: '', encontrado: '', gravidade: 'media', fotos: [] }] })
  }
  // checklist digital: "falha" vira item para reparo sozinho (e some se voltar para ok)
  const marcar = (a: string, quadro: string, i: number, pergunta: string, v: Teste) => {
    const k = chaveCheck(a, quadro, i)
    const id = `ck-${k}`
    sujo.current = true
    setL((x) => {
      const check = { ...(x.check ?? {}), [k]: v }
      let itens = x.itens
      if (v === 'falha' && !itens.some((it) => it.id === id)) itens = [...itens, { id, ambiente: a, item: quadro, encontrado: problemaDe(pergunta), gravidade: 'media', fotos: [] }]
      if (v !== 'falha') itens = itens.filter((it) => it.id !== id)
      return { ...x, check, itens }
    })
  }
  const quadroOk = (a: string, quadro: string, n: number) => {
    sujo.current = true
    setL((x) => {
      const check = { ...(x.check ?? {}) }
      for (let i = 0; i < n; i++) if (!check[chaveCheck(a, quadro, i)]) check[chaveCheck(a, quadro, i)] = 'ok'
      return { ...x, check }
    })
  }
  const progresso = (a: string) => {
    const total = checklistDe(a).reduce((n, q) => n + q.itens.length, 0)
    const feitos = Object.keys(l.check ?? {}).filter((k) => k.startsWith(`${a}|`)).length
    const falhas = l.itens.filter((it) => it.ambiente === a).length
    return { total, feitos, falhas }
  }
  // cada foto entra assim que sobe (uma que falhar não derruba as outras); sempre sobre o estado mais novo
  const fotos = async (files: File[], alvo: string) => {
    if (!files.length) return
    setEnviando(alvo)
    let falhas = 0
    for (const f of files) {
      try {
        const nova = await enviarFoto(f, r.id)
        sujo.current = true
        setL((x) =>
          alvo === 'gerais'
            ? { ...x, gerais: [...x.gerais, { ...nova, ambiente: x.ambientes[0] }] }
            : { ...x, itens: x.itens.map((it) => (it.id === alvo ? { ...it, fotos: [...it.fotos, nova] } : it)) },
        )
      } catch (e) {
        console.error(e)
        falhas++
      }
    }
    setEnviando('')
    if (falhas) toast(falhas === files.length ? 'A foto não foi. Confira a internet e tente de novo.' : `${falhas} ${falhas === 1 ? 'foto não foi' : 'fotos não foram'}. Tente de novo só ${falhas === 1 ? 'ela' : 'elas'}.`)
  }
  const dados = () => laudoDe({ ...r, status: { ...r.status, laudoDados: l } }, cfg)
  const grav = { leve: 0, media: 0, grave: 0 }
  l.itens.filter((it) => !it.aceito).forEach((it) => grav[it.gravidade]++)
  const nFotos = l.itens.reduce((n, it) => n + it.fotos.length, 0) + l.gerais.length

  // função comum, não componente: se fosse componente, o input de foto era recriado a cada salvamento
  // automático e a foto escolhida no celular se perdia
  const Fotos = ({ list, onChange, alvo }: { list: LaudoFoto[]; onChange: (f: LaudoFoto[]) => void; alvo: string }) => (
    <div className="ld-fotos">
      {list.map((f, i) => (
        <figure key={f.url} className={`ld-foto ${f.w && f.h && f.h > f.w ? 'is-v' : 'is-h'}`}>
          <img src={f.url} alt="" />
          <button type="button" className="ld-foto-x" aria-label="Tirar a foto" onClick={() => onChange(list.filter((_, j) => j !== i))}>
            <Icon name="x" size={12} />
          </button>
        </figure>
      ))}
      <label className={`ld-add ${enviando === alvo ? 'is-busy' : ''}`}>
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={!!enviando}
          onChange={(e) => {
            const lista = Array.from(e.target.files ?? [])
            e.target.value = ''
            void fotos(lista, alvo)
          }}
        />
        <Icon name="camera" size={18} />
        <span>{enviando === alvo ? 'enviando…' : 'foto'}</span>
      </label>
    </div>
  )

  return (
    <Modal
      wide
      title={`laudo · ${unidade(r.dados)}`}
      onClose={onClose}
      footer={
        <div className="ld-foot">
          <span className={`ld-salvo is-${salvo}`}>{salvo === 'ok' ? 'salvo' : salvo === 'salvando' ? 'salvando…' : 'não salvou: confira a internet'}</span>
          <button className="btn ghost" onClick={() => openRdlDoc(laudoHtml(dados()))}>
            <Icon name="eye" size={15} /> ver o laudo
          </button>
          <button
            className="btn"
            onClick={async () => {
              await onStatus(r, { laudoDados: { ...l, atualizado: new Date().toISOString() } })
              onPublicar(linkLaudo(r))
            }}
          >
            <Icon name="check" size={15} /> {r.status.laudo ? 'atualizar no painel' : 'publicar no painel'}
          </button>
        </div>
      }
    >
      <div className="ld">
        <div className="ld-cliente">
          <span>
            <Icon name="user" size={13} /> {r.dados.nome}
          </span>
          <span>
            <Icon name="home" size={13} /> {unidade(r.dados)}
          </span>
          {r.dados.planta && <span>{r.dados.planta.replace(/\s*\(.*\)/, '')}</span>}
          {r.status.data && (
            <span>
              <Icon name="calendar" size={13} /> {dataCurta(r.status.data)}
              {r.status.hora ? ` · ${r.status.hora}` : ''}
            </span>
          )}
          {l.artNum && <span>ART {l.artNum}</span>}
        </div>
        <div className="ld-resumo">
          <span>
            <b>{l.itens.length}</b> itens
          </span>
          <span>
            <b>{grav.grave}</b> graves
          </span>
          <span>
            <b>{nFotos}</b> fotos
          </span>
          <span>
            <b>{Object.keys(l.testes).length}</b>/{TESTES.length} testes
          </span>
        </div>

        <div className="ld-abas" role="tablist">
          {(
            [
              ['checklist', 'check', 'checklist'],
              ['itens', 'list', 'itens'],
              ['fotos', 'camera', 'fotos e pasta'],
              ['testes', 'check', 'testes'],
              ['final', 'edit', 'dados e final'],
            ] as [Aba, string, string][]
          ).map(([k, ic, t]) => (
            <button key={k} role="tab" aria-selected={aba === k} className={aba === k ? 'is-on' : ''} onClick={() => setAba(k)}>
              <Icon name={ic as 'list'} size={14} /> {t}
            </button>
          ))}
        </div>

        {aba === 'checklist' && (
          <>
            <p className="muted small">Vá ambiente por ambiente. Marcou falha, o item entra sozinho no laudo: é só tirar a foto e ajustar o texto.</p>
            <div className="ld-ambs">
              {l.ambientes.map((a) => {
                const p = progresso(a)
                return (
                  <button key={a} type="button" className={`${amb === a ? 'is-on' : ''} ${p.total && p.feitos >= p.total ? 'is-ok' : ''}`} onClick={() => setAmb(a)}>
                    <b>{a}</b>
                    <small>
                      {p.feitos}/{p.total}
                      {p.falhas ? ` · ${p.falhas} falha(s)` : ''}
                    </small>
                    <i style={{ width: `${p.total ? (p.feitos / p.total) * 100 : 0}%` }} />
                  </button>
                )
              })}
            </div>
            {checklistDe(amb).map((q) => (
              <section key={q.nome} className="card ld-quadro">
                <header>
                  <b>{q.nome}</b>
                  <button type="button" className="btn small ghost" onClick={() => quadroOk(amb, q.nome, q.itens.length)}>
                    <Icon name="check" size={13} /> resto ok
                  </button>
                </header>
                {q.itens.map((pergunta, i) => {
                  const v = l.check?.[chaveCheck(amb, q.nome, i)]
                  const it = l.itens.find((x) => x.id === `ck-${chaveCheck(amb, q.nome, i)}`)
                  return (
                    <div key={i} className={`ld-perg ${v ? `is-${v}` : ''}`}>
                      <div className="ld-perg-l">
                        <span>{pergunta}</span>
                        <div className="ld-tri">
                          {(
                            [
                              ['ok', 'ok'],
                              ['falha', 'falha'],
                              ['na', 'n/a'],
                            ] as [Teste, string][]
                          ).map(([k, lb]) => (
                            <button key={k} type="button" className={`is-${k} ${v === k ? 'is-on' : ''}`} onClick={() => marcar(amb, q.nome, i, pergunta, k)}>
                              {lb}
                            </button>
                          ))}
                        </div>
                      </div>
                      {it && (
                        <div className="ld-falha">
                          <textarea rows={2} value={it.encontrado} onChange={(e) => mudarItem(it.id, { encontrado: e.target.value })} aria-label="O que foi encontrado" />
                          <div className="ld-grav" role="radiogroup" aria-label="Gravidade">
                            {(Object.keys(GRAVIDADE) as Gravidade[]).map((g) => (
                              <button key={g} type="button" role="radio" aria-checked={it.gravidade === g} className={`ld-g is-${g} ${it.gravidade === g ? 'is-on' : ''}`} onClick={() => mudarItem(it.id, { gravidade: g })} title={GRAVIDADE[g].text}>
                                {GRAVIDADE[g].label}
                              </button>
                            ))}
                          </div>
                          <label className="ld-aceito">
                            <input type="checkbox" checked={!!it.aceito} onChange={(e) => mudarItem(it.id, { aceito: e.target.checked })} /> o morador aceita como está (não pede reparo)
                          </label>
                          {Fotos({ list: it.fotos, alvo: it.id, onChange: (f) => mudarItem(it.id, { fotos: f }) })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}
            {l.ambientes.indexOf(amb) < l.ambientes.length - 1 && (
              <button className="btn ld-novo" onClick={() => setAmb(l.ambientes[l.ambientes.indexOf(amb) + 1])}>
                próximo: {l.ambientes[l.ambientes.indexOf(amb) + 1]} <Icon name="chevronR" size={15} />
              </button>
            )}
          </>
        )}

        {aba === 'itens' && (
          <>
            <p className="muted small">Os itens marcados como falha no checklist já estão aqui. Inclua outros que encontrar, com foto (horizontal ou vertical: entram inteiras).</p>
            {l.itens.map((it, i) => (
              <section key={it.id} className="card ld-item">
                <header>
                  <b>item {i + 1}</b>
                  <button className="icon-btn" aria-label="Apagar o item" onClick={() => mudar({ itens: l.itens.filter((x) => x.id !== it.id) })}>
                    <Icon name="trash" size={14} />
                  </button>
                </header>
                <div className="ld-row">
                  <Field label="ambiente">
                    <select value={it.ambiente} onChange={(e) => mudarItem(it.id, { ambiente: e.target.value })}>
                      {[...new Set([...l.ambientes, it.ambiente])].map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="item verificado">
                    <input list={`q-${it.id}`} value={it.item} onChange={(e) => mudarItem(it.id, { item: e.target.value })} placeholder="ex.: porta, tomada, piso" />
                    <datalist id={`q-${it.id}`}>
                      {quadrosDe(it.ambiente).map((q) => (
                        <option key={q} value={q} />
                      ))}
                    </datalist>
                  </Field>
                </div>
                <Field label="o que foi encontrado">
                  <textarea rows={2} value={it.encontrado} onChange={(e) => mudarItem(it.id, { encontrado: e.target.value })} placeholder="ex.: azulejo trincado atrás da pia" />
                </Field>
                <div className="ld-grav" role="radiogroup" aria-label="Gravidade">
                  {(Object.keys(GRAVIDADE) as Gravidade[]).map((g) => (
                    <button key={g} type="button" role="radio" aria-checked={it.gravidade === g} className={`ld-g is-${g} ${it.gravidade === g ? 'is-on' : ''}`} onClick={() => mudarItem(it.id, { gravidade: g })} title={GRAVIDADE[g].text}>
                      {GRAVIDADE[g].label}
                    </button>
                  ))}
                </div>
                <label className="ld-aceito">
                  <input type="checkbox" checked={!!it.aceito} onChange={(e) => mudarItem(it.id, { aceito: e.target.checked })} /> o morador aceita como está (não pede reparo), por exemplo porque vai trocar o piso
                </label>
                {Fotos({ list: it.fotos, alvo: it.id, onChange: (f) => mudarItem(it.id, { fotos: f }) })}
              </section>
            ))}
            <button className="btn ld-novo" onClick={novoItem}>
              <Icon name="plus" size={15} /> item para reparo
            </button>
            {!l.itens.length && <p className="muted small ld-center">Nenhum problema encontrado? Então o laudo sai como “aprovada”.</p>}
          </>
        )}

        {aba === 'fotos' && (
          <>
            <div className="ld-drive">
              <Icon name="link" size={16} />
              <div>
                <b>Pasta com todas as fotos do dia</b>
                <small>Cole o link do Google Drive (ou iCloud, OneDrive). Ele aparece no laudo para o morador baixar as fotos em tamanho original.</small>
                <input value={l.fotosLink ?? ''} onChange={(e) => mudar({ fotosLink: e.target.value.trim() })} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" />
                {l.fotosLink && (
                  <a className="link small" href={l.fotosLink} target="_blank" rel="noreferrer">
                    abrir a pasta
                  </a>
                )}
              </div>
            </div>
            <p className="muted small">Fotos gerais de cada ambiente (como o apê estava no dia). Opcional.</p>
            {Fotos({ list: l.gerais, alvo: 'gerais', onChange: (g) => mudar({ gerais: g }) })}
            {l.gerais.length > 0 && (
              <div className="ld-gerais">
                {l.gerais.map((g, i) => (
                  <div key={g.url} className="ld-geral">
                    <img src={g.url} alt="" />
                    <select value={g.ambiente ?? ''} onChange={(e) => mudar({ gerais: l.gerais.map((x, j) => (j === i ? { ...x, ambiente: e.target.value } : x)) })} aria-label="Ambiente da foto">
                      {l.ambientes.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                    <input value={g.legenda ?? ''} onChange={(e) => mudar({ gerais: l.gerais.map((x, j) => (j === i ? { ...x, legenda: e.target.value } : x)) })} placeholder="legenda (opcional)" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {aba === 'testes' && (
          <div className="ld-testes">
            <button type="button" className="btn small ghost ld-todos" onClick={() => mudar({ testes: Object.fromEntries(TESTES.map((t) => [t, l.testes[t] ?? 'ok'])) })}>
              <Icon name="check" size={13} /> marcar o resto como ok
            </button>
            {TESTES.map((t) => (
              <div key={t} className="ld-teste">
                <span>{t}</span>
                <div className="ld-tri">
                  {(
                    [
                      ['ok', 'ok'],
                      ['falha', 'falha'],
                      ['na', 'n/a'],
                    ] as [Teste, string][]
                  ).map(([v, lb]) => (
                    <button key={v} type="button" className={`is-${v} ${l.testes[t] === v ? 'is-on' : ''}`} onClick={() => mudar({ testes: { ...l.testes, [t]: v } })}>
                      {lb}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {aba === 'final' && (
          <>
            <div className="ld-row">
              <Field label="início">
                <input type="time" value={l.inicio ?? r.status.hora ?? ''} onChange={(e) => mudar({ inicio: e.target.value })} />
              </Field>
              <Field label="fim">
                <input type="time" value={l.fim ?? ''} onChange={(e) => mudar({ fim: e.target.value })} />
              </Field>
            </div>
            <div className="ld-row">
              <Field label="quem acompanhou pela construtora">
                <input value={l.acompanhante ?? ''} onChange={(e) => mudar({ acompanhante: e.target.value })} placeholder="nome" />
              </Field>
              <Field label="número da ART">
                <input value={l.artNum ?? ''} onChange={(e) => mudar({ artNum: e.target.value })} inputMode="numeric" />
              </Field>
            </div>
            <Field label="ambientes do apê" group>
              <div className="ld-chips">
                {[...AMBIENTES_APE, ...AMBIENTES_EXTRA].map((a) => {
                  const on = l.ambientes.includes(a)
                  return (
                    <button key={a} type="button" className={on ? 'is-on' : ''} onClick={() => mudar({ ambientes: on ? l.ambientes.filter((x) => x !== a) : [...l.ambientes, a] })}>
                      {on && <Icon name="check" size={12} />} {a}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="itens não verificados" hint="um por linha, com o motivo">
              <textarea rows={3} value={l.naoVerificados} onChange={(e) => mudar({ naoVerificados: e.target.value })} placeholder="ex.: ponto de gás (gás ainda não ligado)" />
            </Field>
            <Field label="observações do engenheiro">
              <textarea rows={4} value={l.obs} onChange={(e) => mudar({ obs: e.target.value })} />
            </Field>
            <button className="btn ghost small" onClick={() => openRdlDoc(checklistHtml({ owner: r.dados.nome, unit: unidade(r.dados), date: r.status.data, plan: r.dados.planta, rooms: l.ambientes }))}>
              <Icon name="printer" size={14} /> checklist deste apê para imprimir
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
