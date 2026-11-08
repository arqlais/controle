/* Plataforma do apê: "compra e financiamento" para quem acabou de comprar (na planta ou pronto).
   Entrada e sinal, saldo da entrada parcelado, juros de obra, financiamento (SAC ou Price), ITBI e cartório
   e a linha do tempo da compra. Tudo calculado na hora, com os números da própria pessoa. */
import { useState } from 'react'
import type { PlatCompraImovel, PlatParcela } from './api'
import { ApeIcon } from './ApeIcon'
import { brl, num } from './model'

const uid = () => Math.random().toString(36).slice(2, 10)
const hoje = () => new Date().toISOString().slice(0, 10)

export const PASSOS_COMPRA: string[] = [
  'assinar o contrato de compra e venda',
  'pagar o sinal',
  'enviar os documentos e aprovar o crédito no banco',
  'assinar o contrato do financiamento',
  'pagar o ITBI',
  'registrar o contrato no cartório de imóveis',
  'acompanhar as parcelas da entrada (com correção)',
  'acompanhar os juros de obra até as chaves',
  'vistoria e entrega das chaves',
  'começa a parcela do financiamento',
]

export const compraVazia = (): PlatCompraImovel => ({ valor: null, entrada: null, sinal: null, entradaVezes: 36, financiado: null, banco: '', taxaAno: 10.5, prazo: 420, sistema: 'SAC', inicio: '', obraPct: 30, itbiPct: 3, cartorio: null, passos: PASSOS_COMPRA.map((item) => ({ id: uid(), item, feito: false })) })

/** Contas do financiamento: juro mensal equivalente, 1ª e última parcela e o total pago. */
export function contasCompra(c: PlatCompraImovel) {
  const valor = c.valor || 0
  const entrada = c.entrada || 0
  const fin = c.financiado ?? Math.max(0, valor - entrada)
  const i = c.taxaAno ? Math.pow(1 + c.taxaAno / 100, 1 / 12) - 1 : 0
  const n = Math.max(1, c.prazo || 1)
  let primeira = 0, ultima = 0, total = 0
  if (fin > 0) {
    if (c.sistema === 'Price') {
      primeira = ultima = i ? (fin * i) / (1 - Math.pow(1 + i, -n)) : fin / n
      total = primeira * n
    } else {
      const amort = fin / n
      primeira = amort + fin * i
      ultima = amort + amort * i
      total = fin + (fin * i * (n + 1)) / 2
    }
  }
  const saldoEntrada = Math.max(0, entrada - (c.sinal || 0))
  const parcelaEntrada = c.entradaVezes ? saldoEntrada / c.entradaVezes : 0
  // juros de obra: juros (e taxas) sobre a parte do financiamento já liberada para a construtora
  const jurosObraHoje = fin * ((c.obraPct || 0) / 100) * i
  const jurosObraFim = fin * i
  const itbi = valor * ((c.itbiPct || 0) / 100)
  const cartorio = c.cartorio ?? valor * 0.01
  return { fin, i, n, primeira, ultima, total, juros: Math.max(0, total - fin), saldoEntrada, parcelaEntrada, jurosObraHoje, jurosObraFim, itbi, cartorio, escritura: itbi + cartorio }
}

/** Campo de número que aceita vírgula (salva ao sair do campo). */
function Num({ label, v, onV, sufixo, dica }: { label: string; v: number | null | undefined; onV: (n: number | null) => void; sufixo?: string; dica?: string }) {
  return (
    <div className="ape-f">
      <label>{label}{sufixo ? <span className="ape-keep"> ({sufixo})</span> : null}</label>
      <input inputMode="decimal" key={String(v ?? '')} defaultValue={v != null ? String(v).replace('.', ',') : ''} onBlur={(e) => onV(num(e.target.value))} />
      {dica && <span className="ape-hint">{dica}</span>}
    </div>
  )
}

export function CompraFin({ c, mudar, levarParcelas }: { c: PlatCompraImovel; mudar: (fn: (c: PlatCompraImovel) => PlatCompraImovel) => void; levarParcelas: (p: PlatParcela[]) => void }) {
  const set = <K extends keyof PlatCompraImovel>(k: K, v: PlatCompraImovel[K]) => mudar((x) => ({ ...x, [k]: v }))
  const r = contasCompra(c)
  const [parte, setParte] = useState<'entrada' | 'financiamento' | 'obra' | 'escritura' | 'passos'>('entrada')
  const feitos = c.passos.filter((p) => p.feito).length
  const PARTES: [typeof parte, string, string][] = [['entrada', 'entrada', 'tag'], ['financiamento', 'financiamento', 'home'], ['obra', 'juros de obra', 'clock'], ['escritura', 'ITBI e cartório', 'file'], ['passos', 'passo a passo', 'check']]
  return (
    <section className="ape-panel ape-plat-sec ape-cf">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">compra e financiamento</p><span className="ape-note">Coloque os números do seu contrato: as contas saem na hora.</span></div>
      </div>
      <div className="ape-cf-res">
        <div><small>entrada</small><b className="ape-keep">{brl(c.entrada || 0)}</b><span className="ape-keep">{r.parcelaEntrada ? `${c.entradaVezes}x de ${brl(r.parcelaEntrada)}` : 'sem parcelas'}</span></div>
        <div><small>juros de obra hoje</small><b className="ape-keep">{brl(r.jurosObraHoje)}</b><span>por mês, aprox.</span></div>
        <div><small>financiamento</small><b className="ape-keep">{brl(r.primeira)}</b><span>{c.sistema === 'SAC' ? `1ª parcela, cai até ${brl(r.ultima)}` : 'parcela fixa (Price)'}</span></div>
        <div><small>ITBI e cartório</small><b className="ape-keep">{brl(r.escritura)}</b><span>à vista, aprox.</span></div>
      </div>
      <div className="ape-seg ape-cf-tabs" role="radiogroup" aria-label="Parte da compra">
        {PARTES.map(([k, l, i]) => <button key={k} role="radio" aria-checked={parte === k} onClick={() => setParte(k)}><ApeIcon name={i} /><span>{l}</span></button>)}
      </div>

      {parte === 'entrada' && (
        <div className="ape-cf-b">
          <div className="ape-frow"><Num label="Valor do imóvel" sufixo="R$" v={c.valor} onV={(n) => set('valor', n)} /><Num label="Entrada total" sufixo="R$" v={c.entrada} onV={(n) => set('entrada', n)} dica="Tudo o que você paga antes do banco: sinal + parcelas + balões." /></div>
          <div className="ape-frow"><Num label="Sinal (na assinatura)" sufixo="R$" v={c.sinal} onV={(n) => set('sinal', n)} /><Num label="Resto da entrada em quantas vezes" v={c.entradaVezes} onV={(n) => set('entradaVezes', n)} /></div>
          <p className="ape-cf-nota"><ApeIcon name="alert" />Na planta, as parcelas da entrada costumam ser corrigidas pelo INCC todo mês: a parcela sobe um pouco ao longo da obra. Confira o índice no contrato.</p>
        </div>
      )}
      {parte === 'financiamento' && (
        <div className="ape-cf-b">
          <div className="ape-frow"><Num label="Valor financiado" sufixo="R$" v={c.financiado ?? (r.fin || null)} onV={(n) => set('financiado', n)} dica="Se deixar em branco: imóvel menos entrada." /><div className="ape-f"><label>Banco</label><input value={c.banco} onChange={(e) => set('banco', e.target.value)} placeholder="ex.: Caixa" /></div></div>
          <div className="ape-frow"><Num label="Juros ao ano" sufixo="%" v={c.taxaAno} onV={(n) => set('taxaAno', n)} /><Num label="Prazo" sufixo="meses" v={c.prazo} onV={(n) => set('prazo', n)} dica={c.prazo ? `${Math.round((c.prazo / 12) * 10) / 10} anos` : ''} /></div>
          <div className="ape-frow">
            <div className="ape-f"><label>Sistema</label><div className="ape-seg">{(['SAC', 'Price'] as const).map((s) => <button key={s} role="radio" aria-checked={c.sistema === s} onClick={() => set('sistema', s)}>{s === 'SAC' ? 'SAC (cai)' : 'Price (fixa)'}</button>)}</div></div>
            <div className="ape-f"><label>Começa a pagar em</label><input type="date" value={c.inicio} onChange={(e) => set('inicio', e.target.value)} /><span className="ape-hint">Na planta, normalmente no mês seguinte às chaves.</span></div>
          </div>
          <div className="ape-cf-calc">
            <span>1ª parcela <b className="ape-keep">{brl(r.primeira)}</b></span>
            <span>última <b className="ape-keep">{brl(r.ultima)}</b></span>
            <span>total pago <b className="ape-keep">{brl(r.total)}</b></span>
            <span>só de juros <b className="ape-keep">{brl(r.juros)}</b></span>
          </div>
          <p className="ape-cf-nota"><ApeIcon name="sparkle" />Sem contar seguros e taxa de administração do banco, que somam um pouco por mês. Amortizar (pagar a mais) no começo do SAC derruba bastante os juros.</p>
        </div>
      )}
      {parte === 'obra' && (
        <div className="ape-cf-b">
          <div className="ape-f">
            <label>Quanto da obra está pronto: <b>{c.obraPct || 0}%</b></label>
            <input type="range" min={0} max={100} step={5} value={c.obraPct || 0} onChange={(e) => set('obraPct', Number(e.target.value))} />
          </div>
          <div className="ape-cf-calc">
            <span>hoje <b className="ape-keep">{brl(r.jurosObraHoje)}</b> por mês</span>
            <span>perto das chaves <b className="ape-keep">{brl(r.jurosObraFim)}</b> por mês</span>
          </div>
          <p className="ape-cf-nota"><ApeIcon name="alert" />Juros de obra (ou "evolução de obra") são cobrados pelo banco enquanto o prédio é construído, sobre a parte do dinheiro já repassada à construtora. Não abatem a dívida: por isso vale cobrar a construtora pelo prazo. A conta aqui é uma estimativa; o valor certo vem no boleto do banco.</p>
        </div>
      )}
      {parte === 'escritura' && (
        <div className="ape-cf-b">
          <div className="ape-frow"><Num label="ITBI da sua cidade" sufixo="%" v={c.itbiPct} onV={(n) => set('itbiPct', n)} dica="Em muitas cidades é 2% ou 3%. Algumas dão desconto na parte financiada." /><Num label="Registro e cartório" sufixo="R$" v={c.cartorio} onV={(n) => set('cartorio', n)} dica="Se deixar em branco, conta 1% do imóvel." /></div>
          <div className="ape-cf-calc">
            <span>ITBI <b className="ape-keep">{brl(r.itbi)}</b></span>
            <span>cartório <b className="ape-keep">{brl(r.cartorio)}</b></span>
            <span>total <b className="ape-keep">{brl(r.escritura)}</b></span>
          </div>
          <p className="ape-cf-nota"><ApeIcon name="sparkle" />Separe esse dinheiro: ITBI e registro são pagos à vista e o banco não libera o financiamento sem o contrato registrado.</p>
        </div>
      )}
      {parte === 'passos' && (
        <div className="ape-cf-b">
          <div className="ape-pp-res"><b>{feitos} de {c.passos.length}</b><span>passos da compra feitos</span></div>
          <div className="ape-cf-passos">
            {c.passos.map((p) => (
              <label key={p.id} className={p.feito ? 'on' : ''}>
                <input type="checkbox" checked={p.feito} onChange={() => mudar((x) => ({ ...x, passos: x.passos.map((y) => (y.id === p.id ? { ...y, feito: !y.feito } : y)) }))} />
                <span>{p.item}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="ape-btn sm ape-cf-levar" onClick={() => {
        const l: PlatParcela[] = []
        if (r.parcelaEntrada && c.entradaVezes) l.push({ id: uid(), descricao: 'entrada (construtora)', valor: Math.round(r.parcelaEntrada * 100) / 100, vezes: c.entradaVezes, inicio: hoje(), dia: null })
        if (r.primeira) l.push({ id: uid(), descricao: `financiamento${c.banco ? ` (${c.banco})` : ''}`, valor: Math.round(r.primeira * 100) / 100, vezes: c.prazo || 1, inicio: c.inicio || hoje(), dia: null })
        levarParcelas(l)
      }}><ApeIcon name="clock" />levar entrada e financiamento para "parcelas"</button>
    </section>
  )
}
