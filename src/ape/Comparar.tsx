import { useState } from 'react'
import { ApeIcon } from './ApeIcon'
import { comparar } from './comparar'
import { brl, dmy, nicho, waNum, wa, type Morador, type Orcamento } from './model'

/* Comparação lado a lado de um serviço: não só o preço — escopo, materiais, prazos, pagamento, garantia,
   o que falta em cada um, divergências e custos que podem aparecer depois. */
export function Comparar({ orcs, me }: { orcs: Orcamento[]; me: Morador | null }) {
  const [aberto, setAberto] = useState(false)
  if (orcs.length < 2) return null
  if (!aberto)
    return (
      <button className="ape-btn ape-comparar-btn" onClick={() => setAberto(true)}>
        <ApeIcon name="list" />
        comparar os {orcs.length} lado a lado: escopo, prazos, garantia e o que falta
      </button>
    )
  const c = comparar(orcs)
  const col = (i: number) => orcs[i].fornecedor || `orçamento ${i + 1}`
  const linha = (l: string, vals: (string | null | undefined)[], cls = '') => (
    <tr className={cls}>
      <th scope="row">{l}</th>
      {vals.map((v, i) => <td key={i}>{v || <span className="ape-cmp-vazio">não informa</span>}</td>)}
    </tr>
  )
  const pedir = (i: number) => {
    const o = orcs[i]
    const n = waNum(o.whatsapp || o.telefone)
    if (!n || !c.pendentes[i].length) return null
    const txt = `Oi! ${me ? `Sou ${me.nome}. ` : ''}Recebi o orçamento de ${o.servico || nicho(o.nicho).l.toLowerCase()} e, para comparar, preciso saber: ${c.pendentes[i].join(', ')}${c.faltas[i].length ? `. Também queria confirmar se inclui: ${c.faltas[i].slice(0, 4).join(', ')}` : ''}. Obrigado(a)!`
    return <a className="ape-btn ghost sm" href={wa(n, txt)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />perguntar o que falta</a>
  }
  return (
    <section className="ape-cmp" aria-label="Comparação lado a lado">
      <header className="ape-cmp-h">
        <b>comparação lado a lado</b>
        <button className="ape-btn ghost sm" onClick={() => setAberto(false)}>fechar</button>
      </header>
      {c.destaques.length > 0 && (
        <div className="ape-cmp-dest">
          {c.destaques.map((d) => (
            <span key={d.l} className="ape-pill azul"><ApeIcon name="star" />{d.l}: <b>{col(d.i)}</b>{d.porque ? ` (${d.porque})` : ''}</span>
          ))}
        </div>
      )}
      <div className="ape-cmp-scroll">
        <table className="ape-cmp-t">
          <thead>
            <tr>
              <th />
              {orcs.map((_, i) => <th key={i} scope="col">{col(i)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="sec"><th colSpan={orcs.length + 1}>preço e pagamento</th></tr>
            {linha('à vista', c.precos.map((p) => (p.avista != null ? brl(p.avista) : null)), 'num')}
            {linha('parcelado', c.precos.map((p) => p.parcelado))}
            {c.precos.some((p) => p.m2) && linha('por m²', c.precos.map((p) => (p.m2 ? `${brl(p.m2)} (${String(p.area).replace('.', ',')} m²)` : null)), 'num')}
            {linha('pagamento', orcs.map((o) => o.pagamento))}
            <tr className="sec"><th colSpan={orcs.length + 1}>prazos e garantia</th></tr>
            {linha('prazo', orcs.map((o) => o.prazo))}
            {linha('garantia', orcs.map((o) => o.garantia))}
            {linha('validade', orcs.map((o) => (o.validade ? dmy(o.validade) : '')))}
            {orcs.some((o) => (o.materiais || []).length) && (
              <>
                <tr className="sec"><th colSpan={orcs.length + 1}>materiais e especificações</th></tr>
                {linha('materiais', orcs.map((o) => (o.materiais || []).join(' · ')))}
              </>
            )}
            {c.escopo.length > 0 && (
              <>
                <tr className="sec"><th colSpan={orcs.length + 1}>o que está incluso</th></tr>
                {c.escopo.map((l) => (
                  <tr key={l.id}>
                    <th scope="row">{l.l}</th>
                    {l.marcas.map((m, i) => (
                      <td key={i} className={`ape-cmp-m ${m}`}>
                        <ApeIcon name={m === 'sim' ? 'check' : m === 'fora' ? 'x' : 'alert'} />
                        {m === 'sim' ? 'inclui' : m === 'fora' ? 'não inclui' : 'não fala'}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
            {orcs.some((o) => (o.itens || []).length) && (
              <>
                <tr className="sec"><th colSpan={orcs.length + 1}>itens e quantidades</th></tr>
                <tr>
                  <th scope="row">itens</th>
                  {orcs.map((o, i) => (
                    <td key={i}>
                      {(o.itens || []).length ? (
                        <ul className="ape-cmp-itens">
                          {o.itens!.slice(0, 12).map((it, k) => <li key={k}>{it.descricao}{it.qtd != null ? ` · ${String(it.qtd).replace('.', ',')}${it.unidade ? ` ${it.unidade}` : ''}` : ''}{it.valor != null ? ` · ${brl(it.valor)}` : ''}</li>)}
                        </ul>
                      ) : <span className="ape-cmp-vazio">sem itens detalhados</span>}
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      {c.divergencias.length > 0 && (
        <div className="ape-cmp-box">
          <b><ApeIcon name="alert" />diferenças entre os orçamentos</b>
          <ul>{c.divergencias.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}
      <div className="ape-cmp-cols">
        {orcs.map((o, i) => (
          <div key={o.id} className="ape-cmp-col">
            <b>{col(i)}</b>
            {c.faltas[i].length > 0 && <p><span>os outros incluem e este não fala:</span> {c.faltas[i].join(', ')}</p>}
            {c.extras[i].length > 0 && <p><span>pode custar a mais:</span> {c.extras[i].join(' · ')}</p>}
            {c.pendentes[i].length > 0 && <p><span>falta informar:</span> {c.pendentes[i].join(', ')}</p>}
            {!c.faltas[i].length && !c.extras[i].length && !c.pendentes[i].length && <p>Nada de importante faltando.</p>}
            {pedir(i)}
          </div>
        ))}
      </div>
      <p className="ape-note" style={{ margin: 0 }}>Comparação automática a partir do que está escrito em cada orçamento. Confirme tudo com o fornecedor antes de fechar.</p>
    </section>
  )
}
