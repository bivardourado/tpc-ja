import { defineConfig } from 'vite';

export default defineConfig({
  // Define a pasta raiz do projeto
  root: '.',

  // Define a pasta para arquivos estáticos (como imagens, se tivesse)
  publicDir: 'public',

  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        form: './form.html',
        admin: './admin.html',
        participantes: './participantes.html',
        locais: './locais.html',
        consulta: './consulta.html',
        acesso: './acesso.html',
        monitoramento: './monitoramento.html',
        analise: './analise.html',
        turnos: './turnos.html',
        visao: './visao.html',
        atualizar: './atualizar.html',
        importar: './importar.html',
        auditoria: './auditoria.html',
        comparativo: './comparativo.html',
        ranking: './ranking.html',
        diagnostico: './diagnostico.html',
        analiseGeral: './analise-geral.html',
        vagasCriticas: './vagas-criticas.html',
        comparativoDetalhado: './comparativo-detalhado.html'
      },
    },
  },
  server: {
    port: 5173,
    open: true, // Abre o navegador automaticamente
    fs: {
      strict: false
    }
  },
  appType: 'mpa' // Multi-page application
});