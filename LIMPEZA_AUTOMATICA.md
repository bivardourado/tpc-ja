# 🤖 Limpeza Automática de Escalas

## ✅ Implementado!

O sistema agora limpa automaticamente escalas antigas quando você gera uma nova escala.

### 📋 Como Funciona

1. **Quando**: Toda vez que você gera uma nova escala
2. **O que faz**: Exclui escalas com mais de **18 meses**
3. **O que mantém**: Últimos **18 meses** de histórico
4. **Por quê**: Garante rodízio justo sem acumular dados desnecessários

### 🔧 Código Adicionado

A função `limparEscalasAntigas()` foi adicionada ao `ScaleService.js` e é chamada automaticamente após salvar cada escala.

### 📊 Exemplo

**Hoje: Abril/2026**
- ✅ Mantém: Novembro/2024 até Abril/2026 (18 meses)
- ❌ Exclui: Outubro/2024 e anteriores

### 🎯 Benefícios

- ✅ Sem intervenção manual necessária
- ✅ Histórico sempre atualizado
- ✅ Rodízio justo mantido
- ✅ Banco de dados organizado

### ⚙️ Configuração

Atualmente configurado para **18 meses**. Se quiser mudar:
1. Abra `ScaleService.js`
2. Procure por `hoje.getMonth() - 18`
3. Altere o número (ex: 12 para 1 ano, 24 para 2 anos)

---

**Nota**: A limpeza é silenciosa - você verá mensagens no console quando escalas forem excluídas.
