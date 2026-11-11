// planê.apê: lembrete de que os dados são lidos automaticamente e podem ter erro (sempre conferir no original).
import { ApeIcon } from './ApeIcon'

export function AvisoLeitura({ curto }: { curto?: boolean }) {
  return (
    <p className="ape-aviso-leitura" role="note">
      <ApeIcon name="alert" />
      <span>{curto
        ? <>Os dados são lidos <b>automaticamente</b> e podem ter erro. Confira sempre no arquivo original.</>
        : <><b>Confira antes de fechar:</b> valores, prazos e nomes são lidos automaticamente do que os vizinhos mandaram e podem ter erro. Sempre veja o orçamento original e confirme direto com o fornecedor.</>}</span>
    </p>
  )
}
