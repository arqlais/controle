import { useEffect, useState, type FormEvent } from 'react'
import { href } from '../router'
import { lerArquivo, meuOrcamento, publicar, subirArquivos, apeCloud } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import { faltando, lerTexto, nichoDoTexto } from './comparar'
import { APE, NICHOS, blankOrcamento, brl, cleanOrcamento, ehSanLevi, msgAnexo, nicho, num, wa, type Arquivo, type Morador, type Orcamento, type TipoEnvio } from './model'

/* Enviar orçamento: anexa um ou mais arquivos, cada arquivo vira um orçamento lido sozinho (IA no servidor;
   sem IA, regras simples sobre o texto do PDF). A pessoa só completa o que faltou e publica direto na comparação. */

interface Lido { key: string; arquivos: Arquivo[]; files: File[]; o: Orcamento; status: 'lendo' | 'pronto' | 'erro'; msg?: string; aberto?: boolean }

async function textoDoPdf(f: File): Promise<string> {
  if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return ''
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise
    const out: string[] = []
    for (let n = 1; n <= Math.min(pdf.numPages, 8); n++) {
      const c = await (await pdf.getPage(n)).getTextContent()
      const rows = new Map<number, { x: number; s: string }[]>()
      for (const it of c.items as { str: string; transform: number[] }[]) {
        if (!('str' in it) || !it.str.trim()) continue
        const y = Math.round(it.transform[5] / 3) * 3
        rows.set(y, [...(rows.get(y) || []), { x: it.transform[4], s: it.str }])
      }
      ;[...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => out.push(r.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s{2,}/g, ' ')))
    }
    return out.join('\n')
  } catch {
    return ''
  }
}

const mesmoFornecedor = (a: Orcamento, b: Orcamento) => {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return (!!a.cnpj && a.cnpj === b.cnpj) || (!!a.fornecedor && n(a.fornecedor) === n(b.fornecedor))
}

export function Enviar({ me, whats, orcamentos, meusIds, onPublicado, onCadastro }: { me: Morador | null; whats: string; orcamentos: Orcamento[]; meusIds: string[]; onPublicado: () => void; onCadastro: () => void }) {
  const [lidos, setLidos] = useState<Lido[]>([])
  const [texto, setTexto] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [feitos, setFeitos] = useState<Orcamento[]>([])
  const [tipo, setTipo] = useState<TipoEnvio>('orcamento')
  const meus = orcamentos.filter((o) => meusIds.includes(o.id))
  useEffect(() => setErr(''), [lidos.length])

  const atualizar = (key: string, fn: (l: Lido) => Lido) => setLidos((ls) => ls.map((l) => (l.key === key ? fn(l) : l)))

  /** Lê um arquivo (ou o texto colado) e devolve o orçamento já no formato da comparação. */
  const ler = async (key: string, file: File | null, txt: string, t: TipoEnvio = tipo) => {
    try {
      let arquivos: Arquivo[] = []
      if (file) arquivos = await subirArquivos([file])
      atualizar(key, (l) => ({ ...l, arquivos }))
      const textoLocal = file ? await textoDoPdf(file) : txt
      const lido = me ? await lerArquivo(me.id, arquivos[0] || null, file ? '' : txt) : { o: null }
      const ia = lido.o
      const regra = textoLocal ? lerTexto(textoLocal) : {}
      const base = cleanOrcamento({ ...regra, ...(ia || {}) } as Record<string, unknown>, { nicho: 'outros' })
      // o que a IA não trouxe, as regras completam
      for (const [k, v] of Object.entries(regra)) {
        const atual = (base as unknown as Record<string, unknown>)[k]
        if ((atual == null || atual === '' || (Array.isArray(atual) && !atual.length)) && v != null) (base as unknown as Record<string, unknown>)[k] = v
      }
      if (base.nicho === 'outros') base.nicho = (nichoDoTexto(textoLocal + ' ' + base.servico) || 'outros') as Orcamento['nicho']
      if (!base.servico) base.servico = base.nicho !== 'outros' ? nicho(base.nicho).l : ''
      if (t !== 'orcamento') base.tipo = t
      // orçamento com opções de material (ex.: quartzo ou granito): cada opção vira um orçamento, para comparar igual com igual
      const fonteOp = ((ia as Record<string, unknown> | null)?.opcoes ?? (regra as Record<string, unknown>).opcoes) as Record<string, unknown>[] | undefined
      const opcoes = (Array.isArray(fonteOp) ? fonteOp : []).filter((x) => x && num(x.valor_total) != null)
      if (opcoes.length > 1 && t === 'orcamento') {
        const variante = (x: Record<string, unknown>): Orcamento => ({ ...base, id: blankOrcamento().id, servico: `${base.servico || nicho(base.nicho).l} · ${String(x.nome || 'opção')}`, valor_total: num(x.valor_total), valor_avista: num(x.valor_avista), desconto_avista_pct: null, materiais: [String(x.nome || ''), ...(base.materiais || [])].filter(Boolean) })
        setLidos((ls) => {
          const i = ls.findIndex((l) => l.key === key)
          if (i < 0) return ls
          const atual = ls[i]
          const extras = opcoes.slice(1).map((x) => ({ ...atual, key: crypto.randomUUID(), o: variante(x), status: 'pronto' as const, msg: 'opção separada do mesmo arquivo' }))
          return [...ls.slice(0, i), { ...atual, o: variante(opcoes[0]), status: 'pronto', msg: `lido automaticamente · ${opcoes.length} opções separadas` }, ...extras, ...ls.slice(i + 1)]
        })
        return
      }
      atualizar(key, (l) => ({ ...l, o: { ...base, id: l.o.id }, status: 'pronto', msg: ia ? 'lido automaticamente' : `${lido.erro ? `leitura automática indisponível (${lido.erro}) · ` : ''}${textoLocal ? 'lido pelo texto do arquivo' : 'complete os dados'}` }))
    } catch (x) {
      atualizar(key, (l) => ({ ...l, status: 'erro', msg: String((x as Error).message) }))
    }
  }

  const anexar = (list: File[]) => {
    if (!list.length) return
    if (list.length + lidos.length > 10) return setErr('Mande até 10 arquivos por vez.')
    const big = list.find((f) => f.size > 15 * 1024 * 1024 && !/^image\//i.test(f.type))
    if (big) return setErr(`O arquivo ${big.name} passa de 15 MB.`)
    const novos: Lido[] = list.map((f) => ({ key: crypto.randomUUID(), arquivos: [], files: [f], o: blankOrcamento(tipo === 'orcamento' ? {} : { tipo }), status: 'lendo' }))
    setLidos((ls) => [...ls, ...novos])
    novos.forEach((n) => void ler(n.key, n.files[0], '', tipo))
  }
  const lerColado = () => {
    if (!texto.trim()) return
    const n: Lido = { key: crypto.randomUUID(), arquivos: [], files: [], o: blankOrcamento(tipo === 'orcamento' ? {} : { tipo }), status: 'lendo' }
    setLidos((ls) => [...ls, n])
    void ler(n.key, null, texto, tipo)
    setTexto('')
  }
  /** Só o contato do fornecedor: um cartão para preencher na hora. */
  const novoContato = () => setLidos((ls) => [...ls, { key: crypto.randomUUID(), arquivos: [], files: [], o: blankOrcamento({ tipo: 'contato' }), status: 'pronto', aberto: false, msg: 'preencha o contato' }])
  /** Duas fotos do mesmo orçamento: junta no de cima (soma os itens, mantém os dados que já tinha). */
  const juntar = (i: number) =>
    setLidos((ls) => {
      const a = ls[i - 1]
      const b = ls[i]
      const o: Orcamento = { ...b.o, ...Object.fromEntries(Object.entries(a.o).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))), itens: [...(a.o.itens || []), ...(b.o.itens || [])], inclui: [...new Set([...a.o.inclui, ...b.o.inclui])], nao_inclui: [...new Set([...a.o.nao_inclui, ...b.o.nao_inclui])], alertas: [...new Set([...a.o.alertas, ...b.o.alertas])] } as Orcamento
      return [...ls.slice(0, i - 1), { ...a, o, arquivos: [...a.arquivos, ...b.arquivos], files: [...a.files, ...b.files] }, ...ls.slice(i + 1)]
    })

  const publicarTodos = async (e: FormEvent) => {
    e.preventDefault()
    if (!me) return onCadastro()
    const prontos = lidos.filter((l) => l.status === 'pronto')
    if (!prontos.length) return setErr(lidos.some((l) => l.status === 'lendo') ? 'Espere terminar de ler.' : 'Anexe um orçamento.')
    const incompleto = prontos.find((l) => faltando(l.o).length)
    if (incompleto) return setErr(`Complete ${faltando(incompleto.o).map((f) => (f === 'nicho' ? 'o serviço' : f === 'valor' ? 'o valor' : f === 'contato' ? 'o WhatsApp, telefone ou Instagram' : 'o fornecedor')).join(', ')} do item ${prontos.indexOf(incompleto) + 1}.`)
    // orçamento repetido: pergunta antes (mesmo serviço, mesmo fornecedor e o mesmo valor)
    const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const valor = (o: Orcamento) => num(o.valor_avista) ?? num(o.valor_total)
    for (const l of prontos) {
      const igual = orcamentos.find((x) => x.nicho === l.o.nicho && norm(x.fornecedor) === norm(l.o.fornecedor) && (valor(x) == null || valor(l.o) == null || Math.abs((valor(x) || 0) - (valor(l.o) || 0)) <= Math.max(1, (valor(l.o) || 0) * 0.01)))
      if (igual && !confirm(`Já existe um orçamento de ${igual.fornecedor} em ${nicho(igual.nicho).l.toLowerCase()}${valor(igual) != null ? ` com ${brl(valor(igual))}` : ''}${igual.criado ? `, mandado em ${new Date(igual.criado).toLocaleDateString('pt-BR')}` : ''}. É outro orçamento mesmo? Toque em OK para mandar assim mesmo, ou em Cancelar para revisar.`)) return
    }
    setBusy('publicando…')
    const ok: Orcamento[] = []
    for (const l of prontos) {
      try {
        const id = await publicar(me.id, { ...l.o, enviado: true }, l.arquivos)
        ok.push({ ...l.o, id })
      } catch (x) {
        setErr(`Não deu para publicar ${l.o.fornecedor || 'um orçamento'} (${(x as Error).message}).`)
      }
    }
    setBusy('')
    if (ok.length) {
      setFeitos(ok)
      setLidos((ls) => ls.filter((l) => !ok.some((o) => o.id && l.o.fornecedor === o.fornecedor && l.status === 'pronto')))
      onPublicado()
    }
  }

  if (me && !ehSanLevi(me))
    return (
      <section className="ape-panel ape-empty">
        <ApeIcon name="shield" size={26} />
        <b>o envio é para os moradores do {APE.condominio}</b>
        <span>Os orçamentos ficam entre os vizinhos do {APE.condominio}. Se você é de lá, atualize o seu cadastro.</span>
        <div className="ape-acts" style={{ justifyContent: 'center' }}>
          <button className="ape-btn" onClick={onCadastro}>atualizar cadastro</button>
          <a className="ape-btn primary" href={href('ape', 'loja')}><ApeIcon name="bag" />ver a loja</a>
        </div>
      </section>
    )

  if (!me)
    return (
      <section className="ape-panel ape-empty">
        <ApeArt name="anexo" size={56} />
        <b>faça o seu cadastro para enviar</b>
        <span>Leva meio minuto: nome, torre, apê e celular. Na página, o orçamento aparece sem os seus dados.</span>
        <button className="ape-btn primary" onClick={onCadastro}><ApeIcon name="edit" />fazer cadastro</button>
      </section>
    )

  if (feitos.length && !lidos.length)
    return (
      <section className="ape-panel ape-done">
        <ApeIcon name="check" />
        <h2 className="ape-h2">{feitos.length > 1 ? `${feitos.length} itens` : feitos[0]?.tipo === 'contato' ? 'contato' : feitos[0]?.tipo === 'tabela' ? 'tabela' : 'orçamento'} <em>publicado{feitos.length > 1 ? 's' : feitos[0]?.tipo === 'tabela' ? 'a' : ''}</em></h2>
        <p className="ape-note" style={{ maxWidth: '46ch', margin: 0 }}>Já está lado a lado com os outros, sem os seus dados. Se algo saiu errado, você corrige em "seus orçamentos".</p>
        <div className="ape-acts" style={{ justifyContent: 'center' }}>
          <a className="ape-btn primary" href={href('ape')} onClick={() => { try { localStorage.setItem('ape-ui', JSON.stringify({ nicho: feitos[0].nicho })) } catch { /* ok */ } }}><ApeIcon name="list" />ver a comparação</a>
          <button className="ape-btn" onClick={() => setFeitos([])}><ApeIcon name="plus" />mandar outro</button>
        </div>
      </section>
    )

  return (
    <>
      <form className="ape-panel ape-form" onSubmit={publicarTodos} noValidate>
        <div>
          <p className="ape-eyebrow"><ApeIcon name="send" />enviar</p>
          <h2 className="ape-h2">compartilhe com os <em>vizinhos</em></h2>
        </div>
        <div className="ape-f">
          <label>O que você tem?</label>
          <div className="ape-tipos-envio" role="radiogroup" aria-label="O que você tem">
            {([
              ['orcamento', 'orçamento', 'proposta com valores para o seu apê'],
              ['tabela', 'tabela de preços', 'lista de valores, catálogo ou print'],
              ['contato', 'só o contato', 'indicação de fornecedor, sem preço'],
            ] as const).map(([id, l, d]) => (
              <button key={id} type="button" role="radio" aria-checked={tipo === id} onClick={() => setTipo(id)}>
                <b>{l}</b>
                <span>{d}</span>
              </button>
            ))}
          </div>
        </div>
        <ol className="ape-steps ape-steps-num">
          <li><b>1</b><span>{tipo === 'contato' ? 'Preencha o contato ou anexe o print do cartão / da conversa' : tipo === 'tabela' ? 'Anexe o print ou o PDF da tabela de preços' : 'Anexe o PDF ou os prints (pode mandar vários de uma vez)'}</span></li>
          <li><b>2</b><span>Confira o que foi lido e complete só o que faltar</span></li>
          <li><b>3</b><span>{tipo === 'orcamento' ? 'Publique: entra direto na comparação, sem os seus dados' : 'Publique: aparece em "contatos e tabelas" do serviço, sem os seus dados'}</span></li>
        </ol>
        {tipo === 'contato' && (
          <button type="button" className="ape-btn primary" onClick={novoContato}><ApeIcon name="plus" />preencher o contato</button>
        )}
        <label className="ape-drop" htmlFor="e-files">
          <ApeIcon name="clip" />
          <b>{tipo === 'contato' ? 'ou anexar print do contato' : tipo === 'tabela' ? (lidos.length ? 'anexar mais' : 'anexar a tabela de preços') : lidos.length ? 'anexar mais' : 'anexar PDF ou prints'}</b>
          <input id="e-files" type="file" multiple accept="application/pdf,image/*" onChange={(e) => { anexar([...(e.target.files || [])]); e.target.value = '' }} />
          <span className="ape-note">{tipo === 'orcamento' ? 'Cada arquivo vira um orçamento.' : 'Cada arquivo vira um item.'} Até 10 por vez, de até 15 MB.</span>
        </label>
        <details className="ape-more">
          <summary><ApeIcon name="chev" />veio por mensagem? cole o texto</summary>
          <div className="ape-f" style={{ marginTop: 8 }}>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui o que o fornecedor mandou: valores, parcelas, o que inclui, validade…" aria-label="Texto do orçamento" />
            <button type="button" className="ape-btn sm" onClick={lerColado} disabled={!texto.trim()}>ler o texto</button>
          </div>
        </details>

        {lidos.map((l, i) => (
          <LidoCard key={l.key} n={i + 1} l={l} podeJuntar={i > 0 && lidos[i - 1].status === 'pronto' && l.status === 'pronto' && (mesmoFornecedor(lidos[i - 1].o, l.o) || !l.o.fornecedor)} onJuntar={() => juntar(i)}
            onChange={(o) => atualizar(l.key, (x) => ({ ...x, o }))} onToggle={() => atualizar(l.key, (x) => ({ ...x, aberto: !x.aberto }))} onRemove={() => setLidos((ls) => ls.filter((x) => x.key !== l.key))} />
        ))}

        {err && <p className="ape-err" role="alert">{err}</p>}
        {lidos.length > 0 && (
          <div className="ape-acts">
            <button className="ape-btn primary" type="submit" disabled={!!busy || lidos.some((l) => l.status === 'lendo')}>
              <ApeIcon name="send" />
              {busy || (lidos.some((l) => l.status === 'lendo') ? 'lendo…' : `publicar ${lidos.filter((l) => l.status === 'pronto').length > 1 ? `os ${lidos.filter((l) => l.status === 'pronto').length}` : ''}`)}
            </button>
            {err && (
              <a className="ape-btn" href={wa(whats, msgAnexo(me, lidos[0]?.o.fornecedor || ''))} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />mandar pelo WhatsApp</a>
            )}
          </div>
        )}
        {!apeCloud && <p className="ape-note" style={{ margin: 0 }}>Prévia: a leitura usa só o texto do PDF (sem IA).</p>}
        <p className="ape-note" style={{ margin: 0 }}>Seu nome e telefone ficam guardados só para identificar quem mandou. Na página, o orçamento aparece sem os seus dados.</p>
      </form>
      {meus.length > 0 && <SeusOrcamentos me={me} lista={meus} onMudou={onPublicado} />}
    </>
  )
}

function LidoCard({ n, l, podeJuntar, onJuntar, onChange, onToggle, onRemove }: { n: number; l: Lido; podeJuntar: boolean; onJuntar: () => void; onChange: (o: Orcamento) => void; onToggle: () => void; onRemove: () => void }) {
  const o = l.o
  const falta = l.status === 'pronto' ? faltando(o) : []
  const set = (k: keyof Orcamento, v: unknown) => onChange({ ...o, [k]: v } as Orcamento)
  return (
    <section className={`ape-lido ${falta.length ? 'falta' : ''}`} aria-label={`Orçamento ${n}`}>
      <header>
        <span className="ape-lido-n">{n}</span>
        <div className="t">
          <b>{l.status === 'lendo' ? 'lendo…' : o.fornecedor || 'fornecedor?'}</b>
          <span>{l.files.map((f) => f.name).join(', ') || 'texto colado'}{l.msg ? ` · ${l.msg}` : ''}</span>
        </div>
        <button type="button" className="ape-btn ghost sm" onClick={onRemove} aria-label="Tirar"><ApeIcon name="trash" /></button>
      </header>
      {l.status === 'lendo' && <span className="ape-thinking"><span className="ape-dots"><i /><i /><i /></span>lendo o arquivo…</span>}
      {l.status === 'erro' && <p className="ape-err">{l.msg}</p>}
      {l.status === 'pronto' && (
        <>
          {o.tipo === 'contato' ? (
            <div className="ape-lido-edit">
              <div className="ape-frow">
                <div className="ape-f"><label>Fornecedor</label><input value={o.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} placeholder="Nome da loja ou profissional" /></div>
                <div className="ape-f"><label>Serviço</label>
                  <select value={o.nicho === 'outros' ? '' : o.nicho} onChange={(e) => set('nicho', e.target.value || 'outros')}>
                    <option value="">Escolha…</option>
                    {NICHOS.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
                  </select>
                </div>
              </div>
              <div className="ape-frow">
                <div className="ape-f"><label><span className="ape-keep">WhatsApp</span> ou telefone</label><input inputMode="tel" value={o.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(11) 90000-0000" /></div>
                <div className="ape-f"><label>Instagram ou site</label><input value={o.instagram || ''} onChange={(e) => set('instagram', e.target.value)} placeholder="@loja" /></div>
              </div>
              <div className="ape-f"><label>Comentário (opcional)</label><input value={o.resumo} onChange={(e) => set('resumo', e.target.value)} placeholder="Ex.: atendeu rápido, faz desconto para o condomínio" /></div>
            </div>
          ) : (
          <dl className="ape-lido-res">
            {o.tipo === 'tabela' && (<><dt>tipo</dt><dd>tabela de preços</dd></>)}
            <dt>serviço</dt><dd>{o.nicho !== 'outros' ? nicho(o.nicho).l : '—'}{o.servico && o.servico !== nicho(o.nicho).l ? ` · ${o.servico}` : ''}</dd>
            {o.tipo !== 'tabela' && <dt>valor</dt>}{o.tipo !== 'tabela' && <dd className="ape-keep">{num(o.valor_avista) != null ? `${brl(num(o.valor_avista))} à vista` : num(o.valor_total) != null ? brl(num(o.valor_total)) : '—'}{o.parcelas_max ? ` · ${o.parcelas_max}x` : ''}</dd>}
            {(o.itens || []).length > 0 && (<><dt>itens</dt><dd>{o.tipo === 'tabela' ? o.itens!.slice(0, 4).map((i) => `${i.descricao}${i.valor != null ? ` ${brl(i.valor)}` : ''}`).join(' · ') + (o.itens!.length > 4 ? ` +${o.itens!.length - 4}` : '') : `${o.itens!.length} itens lidos`}</dd></>)}
            {(o.whatsapp || o.telefone || o.email) && (<><dt>contato</dt><dd>{[o.whatsapp || o.telefone, o.email].filter(Boolean).join(' · ')}</dd></>)}
            {o.prazo && (<><dt>prazo</dt><dd>{o.prazo}</dd></>)}
            {o.garantia && (<><dt>garantia</dt><dd>{o.garantia}</dd></>)}
          </dl>
          )}
          {falta.length > 0 && o.tipo !== 'contato' && (
            <div className="ape-lido-falta">
              <span className="ape-note"><ApeIcon name="alert" /> Não deu para ler {falta.length > 1 ? 'estes dados' : 'este dado'}. Complete:</span>
              <div className="ape-frow">
                {falta.includes('fornecedor') && <div className="ape-f"><label>Fornecedor</label><input value={o.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} placeholder="Nome da loja ou profissional" /></div>}
                {falta.includes('nicho') && (
                  <div className="ape-f"><label>Serviço</label>
                    <select value={o.nicho === 'outros' ? '' : o.nicho} onChange={(e) => set('nicho', e.target.value || 'outros')}>
                      <option value="">Escolha…</option>
                      {NICHOS.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
                    </select>
                  </div>
                )}
                {falta.includes('valor') && <div className="ape-f"><label>Valor total (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={o.valor_total ?? ''} onChange={(e) => set('valor_total', num(e.target.value))} placeholder="0,00" /></div>}
              </div>
            </div>
          )}
          <div className="ape-acts">
            <button type="button" className="ape-btn ghost sm" onClick={onToggle}><ApeIcon name="edit" />{l.aberto ? 'fechar' : 'corrigir os dados'}</button>
            {podeJuntar && <button type="button" className="ape-btn ghost sm" onClick={onJuntar}><ApeIcon name="copy" />é do mesmo orçamento que o {n - 1}</button>}
          </div>
          {l.aberto && <EditarOrc o={o} onChange={onChange} />}
        </>
      )}
    </section>
  )
}

/** Campos do orçamento para corrigir (o essencial; itens e listas um por linha). */
export function EditarOrc({ o, onChange }: { o: Orcamento; onChange: (o: Orcamento) => void }) {
  const set = (k: keyof Orcamento, v: unknown) => onChange({ ...o, [k]: v } as Orcamento)
  const linhas = (k: 'inclui' | 'nao_inclui' | 'materiais') => (
    <div className="ape-f"><label>{k === 'inclui' ? 'Inclui' : k === 'nao_inclui' ? 'Não inclui' : 'Materiais e especificações'} (um por linha)</label>
      <textarea value={(o[k] || []).join('\n')} onChange={(e) => set(k, e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />
    </div>
  )
  return (
    <div className="ape-lido-edit">
      <div className="ape-frow">
        <div className="ape-f"><label>Fornecedor</label><input value={o.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} /></div>
        <div className="ape-f"><label>Serviço</label>
          <select value={o.nicho} onChange={(e) => set('nicho', e.target.value)}>
            {NICHOS.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
          </select>
        </div>
      </div>
      <div className="ape-f"><label>O que é</label><input value={o.servico} onChange={(e) => set('servico', e.target.value)} /></div>
      <div className="ape-frow">
        <div className="ape-f"><label>Valor total (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={o.valor_total ?? ''} onChange={(e) => set('valor_total', num(e.target.value))} /></div>
        <div className="ape-f"><label>À vista (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={o.valor_avista ?? ''} onChange={(e) => set('valor_avista', num(e.target.value))} /></div>
      </div>
      <div className="ape-frow">
        <div className="ape-f"><label>Parcelas</label><input inputMode="numeric" value={o.parcelas_max ?? ''} onChange={(e) => set('parcelas_max', num(e.target.value))} /></div>
        <div className="ape-f"><label>Área orçada (m²)</label><input inputMode="decimal" value={o.area_m2 ?? ''} onChange={(e) => set('area_m2', num(e.target.value))} /></div>
      </div>
      <div className="ape-frow">
        <div className="ape-f"><label>Prazo</label><input value={o.prazo} onChange={(e) => set('prazo', e.target.value)} /></div>
        <div className="ape-f"><label>Garantia</label><input value={o.garantia} onChange={(e) => set('garantia', e.target.value)} /></div>
      </div>
      <div className="ape-frow">
        <div className="ape-f"><label>Válido até</label><input type="date" value={o.validade} onChange={(e) => set('validade', e.target.value)} /></div>
        <div className="ape-f"><label><span className="ape-keep">WhatsApp</span> do fornecedor</label><input inputMode="tel" value={o.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></div>
      </div>
      <div className="ape-f"><label>Pagamento</label><input value={o.pagamento} onChange={(e) => set('pagamento', e.target.value)} /></div>
      {linhas('inclui')}
      {linhas('nao_inclui')}
      {linhas('materiais')}
    </div>
  )
}

function SeusOrcamentos({ me, lista, onMudou }: { me: Morador; lista: Orcamento[]; onMudou: () => void }) {
  const [edit, setEdit] = useState<Orcamento | null>(null)
  const [msg, setMsg] = useState('')
  const salvar = async () => {
    if (!edit) return
    try {
      await meuOrcamento(me.id, edit.id, edit)
      setEdit(null)
      onMudou()
      setMsg('Corrigido.')
    } catch (x) {
      setMsg(String((x as Error).message))
    }
  }
  const apagar = async (o: Orcamento) => {
    if (!confirm(`Apagar o orçamento de ${o.fornecedor}?`)) return
    await meuOrcamento(me.id, o.id, null).catch(() => null)
    onMudou()
  }
  return (
    <section className="ape-panel">
      <p className="ape-eyebrow">seus orçamentos</p>
      <div className="ape-rows">
        {lista.map((o) => (
          <div key={o.id} className="ape-row">
            <div className="t"><b>{o.fornecedor}</b><span>{nicho(o.nicho).l}</span></div>
            <div className="r">
              <button className="ape-btn ghost sm" onClick={() => setEdit(o)}><ApeIcon name="edit" />corrigir</button>
              <button className="ape-btn ghost sm" onClick={() => void apagar(o)} aria-label={`Apagar ${o.fornecedor}`}><ApeIcon name="trash" /></button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <>
          <EditarOrc o={edit} onChange={setEdit} />
          <div className="ape-acts">
            <button className="ape-btn primary" onClick={() => void salvar()}>salvar</button>
            <button className="ape-btn ghost" onClick={() => setEdit(null)}>cancelar</button>
          </div>
        </>
      )}
      {msg && <span className="ape-note">{msg}</span>}
    </section>
  )
}
