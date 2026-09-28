import { loadPlanConfig } from './planConfig'

// planos e dias de teste editados no painel da dona entram antes de abrir o site
void loadPlanConfig().finally(async () => (await import('./boot')).renderApp())
