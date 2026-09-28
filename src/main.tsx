import { loadPlanConfig } from './planConfig'

// o sistema começa a baixar já (em paralelo) enquanto os planos editados no painel chegam
const boot = import('./boot')
void loadPlanConfig().finally(async () => (await boot).renderApp())
