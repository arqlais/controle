import type { Settings } from '../../types'
import type { GuideStep, MeasureGuideData } from '../../docTypes'
import { useDocLook } from '../DocKit'
import { DocPage } from './DocPage'

/* Guia de medição (A4, 2 folhas): o cliente mede o espaço sozinho e manda para o projeto a distância. */

export const GUIDE_DEFAULTS: Required<Omit<MeasureGuideData, 'photos'>> = {
  title: 'como medir o seu espaço',
  intro: 'Com estas medidas eu consigo desenhar o seu projeto sem precisar ir até aí. Leva uns 20 minutos e não precisa ficar perfeito: o importante é anotar tudo o que encontrar.',
  steps: [
    { title: 'separe o material', text: 'Uma trena (a de 5 m é a melhor), papel, lápis e o celular carregado para as fotos.' },
    { title: 'desenhe o ambiente visto de cima', text: 'Sem régua mesmo: faça o formato das paredes à mão, como se olhasse o cômodo pelo teto (veja a planta abaixo).' },
    { title: 'marque portas e janelas', text: 'Indique no desenho onde fica cada uma e para que lado a porta abre.' },
    { title: 'meça paredes, portas e janelas', text: 'A largura de cada parede, porta e janela, a distância delas até o canto mais próximo e a altura do peitoril (do chão até onde a janela começa).' },
    { title: 'anote o que vai ficar', text: 'Armários, bancadas e móveis que continuam: largura, altura e profundidade de cada um.' },
    { title: 'encontre os pontos', text: 'Tomadas, interruptores, ar-condicionado, água e gás: a altura do chão e a distância até a parede ao lado.' },
    { title: 'meça o pé-direito', text: 'A altura do chão até o teto. Se tiver rebaixo de gesso, meça as duas alturas.' },
    { title: 'fotografe tudo', text: 'Cada parede de frente, os cantos, o teto e o piso. Vídeo andando pelo espaço ajuda muito!' },
  ],
  closing: 'Mandou as medidas e as fotos? Agora é comigo. Qualquer dúvida no caminho, me chama.',
  example: true,
}

export const guideData = (d?: MeasureGuideData) => ({ ...GUIDE_DEFAULTS, ...d, steps: d?.steps?.length ? d.steps : GUIDE_DEFAULTS.steps })

/* ---------- desenhos (SVG, nítidos em qualquer tamanho) ---------- */

const Dim = ({ x1, y1, x2, y2, label, off = 0 }: { x1: number; y1: number; x2: number; y2: number; label: string; off?: number }) => {
  const h = y1 === y2
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g className="g-dim">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1 - (h ? 0 : 4)} y1={y1 - (h ? 4 : 0)} x2={x1 + (h ? 0 : 4)} y2={y1 + (h ? 4 : 0)} />
      <line x1={x2 - (h ? 0 : 4)} y1={y2 - (h ? 4 : 0)} x2={x2 + (h ? 0 : 4)} y2={y2 + (h ? 4 : 0)} />
      <text x={h ? mx : mx - 6 - off} y={h ? my - 5 - off : my} transform={h ? undefined : `rotate(-90 ${mx - 6 - off} ${my})`} textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

/** Planta baixa: paredes, janela, porta com o arco de abertura e as cotas. */
export function PlanDrawing() {
  return (
    <svg viewBox="0 0 300 250" className="g-draw">
      <rect x="40" y="40" width="220" height="170" className="g-wall" />
      <rect x="52" y="52" width="196" height="146" className="g-room" />
      <rect x="34" y="84" width="24" height="70" className="g-window" />
      <text x="46" y="119" className="g-tag" transform="rotate(-90 46 119)" textAnchor="middle">janela</text>
      <rect x="248" y="150" width="12" height="48" className="g-door-gap" />
      <path d="M248 150 A 46 46 0 0 0 202 196" className="g-swing" />
      <line x1="248" y1="150" x2="202" y2="150" className="g-leaf" />
      <text x="224" y="140" className="g-tag" textAnchor="middle">porta</text>
      <circle cx="150" cy="60" r="4" className="g-point" />
      <text x="150" y="76" className="g-tag" textAnchor="middle">tomada</text>
      <Dim x1={52} y1={24} x2={248} y2={24} label="largura" />
      <Dim x1={20} y1={52} x2={20} y2={198} label="comprimento" />
      <Dim x1={52} y1={226} x2={202} y2={226} label="até a porta" />
      <Dim x1={280} y1={150} x2={280} y2={198} label="porta" />
    </svg>
  )
}

/** Vista de uma parede: porta, interruptor, janela, pé-direito e alturas. */
export function WallDrawing() {
  return (
    <svg viewBox="0 0 300 250" className="g-draw">
      <rect x="40" y="30" width="200" height="190" className="g-room" />
      <line x1="30" y1="220" x2="250" y2="220" className="g-floor" />
      <rect x="150" y="96" width="56" height="124" className="g-door" />
      <rect x="62" y="80" width="62" height="54" className="g-window" />
      <rect x="126" y="150" width="9" height="14" className="g-point-r" />
      <text x="96" y="110" className="g-tag" textAnchor="middle">janela</text>
      <text x="178" y="212" className="g-tag" textAnchor="middle">porta</text>
      <Dim x1={264} y1={30} x2={264} y2={220} label="pé-direito" />
      <Dim x1={150} y1={84} x2={206} y2={84} label="largura" />
      <Dim x1={52} y1={134} x2={52} y2={220} label="peitoril" />
      <Dim x1={140} y1={164} x2={140} y2={220} label="h" off={-2} />
      <text x="131" y="146" className="g-tag" textAnchor="middle">interruptor</text>
    </svg>
  )
}

/** Exemplo preenchido: croqui à mão com as medidas em centímetros. */
export function ExampleDrawing() {
  return (
    <svg viewBox="0 0 300 260" className="g-draw g-hand">
      <path d="M40 40 L262 42 L260 178 L182 180 L180 222 L42 220 Z" className="g-sketch" />
      <path d="M92 38 L200 40" className="g-sketch-win" />
      <path d="M180 222 A 40 40 0 0 1 140 184" className="g-swing" />
      <text x="150" y="30" textAnchor="middle">290</text>
      <text x="64" y="30" textAnchor="middle">60</text>
      <text x="232" y="30" textAnchor="middle">60</text>
      <text x="146" y="54" textAnchor="middle">janela 170</text>
      <text x="28" y="132" textAnchor="middle" transform="rotate(-90 28 132)">350</text>
      <text x="274" y="112" textAnchor="middle" transform="rotate(-90 274 112)">260</text>
      <text x="222" y="196" textAnchor="middle">130</text>
      <text x="110" y="240" textAnchor="middle">160</text>
      <text x="206" y="210" textAnchor="middle">porta 80</text>
      <text x="64" y="150">pé-direito: 265</text>
    </svg>
  )
}

function Step({ n, step }: { n: number; step: GuideStep }) {
  return (
    <li className="g-step">
      <span className="g-num">{String(n).padStart(2, '0')}</span>
      <div>
        <b>{step.title}</b>
        <p>{step.text}</p>
      </div>
    </li>
  )
}

export function MeasureGuideDoc({ s, data }: { s: Settings; data?: MeasureGuideData }) {
  const look = useDocLook(s)
  const d = guideData(data)
  const first = d.steps.slice(0, 5)
  const rest = d.steps.slice(5)
  const photos = (data?.photos ?? []).filter(Boolean)
  const pages = d.example || rest.length ? 2 : 1
  const [head, ...tail] = d.title.split(' ')
  return (
    <div className="doc-pages" data-look={look.look} style={look.style}>
      <DocPage s={s} n={1} total={pages} look={look.look} kind="a4">
        <header className="g-head">
          <p className="d-eyebrow">guia de medição</p>
          <h1 className="d-title">
            {head} <em>{tail.join(' ')}</em>
          </h1>
        </header>
        <p className="g-intro">{d.intro}</p>
        <ol className="g-steps">
          {first.map((x, i) => (
            <Step key={i} n={i + 1} step={x} />
          ))}
        </ol>
        <div className="g-figs">
          <figure>
            <PlanDrawing />
            <figcaption>
              planta baixa <span>vista de cima</span>
            </figcaption>
          </figure>
          <figure>
            <WallDrawing />
            <figcaption>
              vista da parede <span>de frente</span>
            </figcaption>
          </figure>
        </div>
      </DocPage>
      {pages > 1 && (
        <DocPage s={s} n={2} total={pages} look={look.look} kind="a4">
          {rest.length > 0 && (
            <ol className="g-steps" start={6}>
              {rest.map((x, i) => (
                <Step key={i} n={i + 6} step={x} />
              ))}
            </ol>
          )}
          {d.example && (
            <div className="g-example">
              <figure>
                <p className="d-label">exemplo de medição</p>
                <ExampleDrawing />
              </figure>
              <div className="g-photos">
                <p className="d-label">fotos que ajudam</p>
                {photos.length ? (
                  photos.slice(0, 3).map((src, i) => <img key={i} src={src} alt="" />)
                ) : (
                  <ul className="g-shots">
                    <li>cada parede, de frente</li>
                    <li>os quatro cantos</li>
                    <li>teto e piso</li>
                    <li>tomadas, janelas e portas de perto</li>
                    <li>um vídeo andando pelo espaço</li>
                  </ul>
                )}
              </div>
            </div>
          )}
          <div className="g-check">
            <p className="d-label">antes de enviar, confira</p>
            <ul>
              <li>o desenho com todas as paredes medidas</li>
              <li>portas e janelas com largura, altura e peitoril</li>
              <li>tomadas, interruptores e pontos de água</li>
              <li>o pé-direito (e o rebaixo, se tiver)</li>
              <li>as fotos e o vídeo do espaço</li>
            </ul>
          </div>
          <p className="g-closing">{d.closing}</p>
        </DocPage>
      )}
    </div>
  )
}
