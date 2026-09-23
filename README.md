# 🚀 TPUBLI - Sistema de Gestão de Escalas

Sistema avançado para gestão do Transporte Público Escolar (TPUBLI) e escalas de pregação em Petrolina, PE. Desenvolvido com uma arquitetura moderna, o objetivo é automatizar o rodízio de voluntários, garantir a justiça na distribuição de vagas e fornecer análises profundas sobre a participação.

---

## 🛠️ Principais Módulos

### 1. **Gestão de Escalas (`/admin`)**
- Geração automática de escalas mensais.
- Algoritmo inteligente que considera disponibilidade, frequência máxima e paridade de gênero.
- Visualização e edição manual de designações.

### 2. **Hub de Análises (`/analise`)**
Uma central de BI (Business Intelligence) para entender a saúde do sistema:
- **🔍 Diagnóstico Geral**: Explica detalhadamente por que certos voluntários não foram designados em um mês específico.
- **🚨 Vagas Críticas**: Identifica horários e locais com déficit crônico de voluntários.
- **📊 Comparativo por Local**: Métricas de preenchimento (Eficiência) por ponto de pregação.
- **📅 Visão e Turnos**: Consultas rápidas de disponibilidade por dia/horário.

### 3. **Monitoramento e Auditoria**
- **✅ Status de Participantes**: Acompanhamento em tempo real de quem está com cadastro atualizado ou pendente.
- **🛡️ Auditoria**: Rastreabilidade de mudanças no sistema para garantir integridade.
- **🏆 Ranking**: Histórico consolidado de participações mensais de cada voluntário.

---

## 💻 Tecnologias Utilizadas

- **Frontend**: Vite + Vanilla JS (Moderno e Rápido)
- **Backend/Database**: Firebase (Firestore, Auth)
- **Styling**: CSS Custom Properties com Design System focado em Dark Mode Moderno (Glassmorphism & High-Contrast).
- **Integração**: WhatsApp Web API (Simples link redirect) para comunicação rápida.

---

## 🚀 Como Iniciar o Projeto

### Pré-requisitos
- Node.js instalado
- Conta no Firebase configurada

### Instalação
1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie um arquivo `.env` com suas credenciais do Firebase (baseado no `src/services/firebase.js`).

### Desenvolvimento
```bash
npm run dev
```

### Build para Produção
```bash
npm run build
```

---

## 🤖 Automações

- **Limpeza Automática**: O sistema limpa automaticamente o histórico de escalas com mais de 18 meses para manter o banco de dados otimizado. (Veja [LIMPEZA_AUTOMATICA.md](LIMPEZA_AUTOMATICA.md))
- **Importação XLSX**: Script rápido para migração de dados de planilhas Excel. (Veja [scripts/README.md](scripts/README.md))

---

## 👥 Contribuição

Este projeto é de uso restrito para a gestão do TPUBLI em Petrolina. 

**Última atualização:** Abril de 2026.
