import { HAS_CLOUD } from './supaConfig'

/* Duas portas de entrada:
   - páginas públicas da planê (principal e vitrines): entrada leve, sem o sistema (abre bem mais rápido);
   - todo o resto (login, sistema, links de proposta, planê.apê): o sistema completo. */
const pagina = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
const logada = () => {
  try {
    return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k))
  } catch {
    return false
  }
}
const publica = HAS_CLOUD && (pagina === 'plane' || pagina === 'arquivos' || pagina === 'arq' || ((pagina === '' || pagina === 'inicio') && !logada()))

if (publica) {
  void import('./frentes/entry').then((m) => m.render())
} else {
  // o sistema começa a baixar já (em paralelo) enquanto os planos editados no painel chegam
  void import('./planConfig').then(({ loadPlanConfig }) => {
    const boot = import('./boot')
    void loadPlanConfig().finally(async () => (await boot).renderApp())
  })
}
