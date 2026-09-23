# Importação Rápida de Participantes

## 📋 Importação Simplificada

Este script importa apenas os dados básicos. Você pode atualizar os outros campos depois pelo painel administrativo.

### Campos importados:
- ✅ **NOME** (obrigatório)
- ✅ **TELEFONE** (obrigatório)
- ✅ **CONGREGAÇÃO**

### Campos com valores padrão (atualizar depois):
- Gênero: vazio
- Email: vazio
- Cônjuge: vazio
- Frequência Máxima: 1
- Disponibilidade: vazia
- Termo Aceito: true (automático)

## 🚀 Como usar:

### 1. Preparar Excel

Salve sua planilha como `participantes.xls` ou `participantes.xlsx` na pasta `scripts/`

**Colunas necessárias:**
- NOME
- TELEFONE
- CONGREGAÇÃO

**Exemplo:**

| NOME | TELEFONE | CONGREGAÇÃO |
|------|----------|-------------|
| João Silva | 87999999999 | Petrolina Centro |
| Maria Santos | 87988888888 | Petrolina Sul |

### 2. Instalar dependência

```bash
npm install xlsx
```

### 3. Executar

```bash
node scripts/importar-participantes.js
```

## 💡 Notas:

- Aceita arquivos `.xls` (Excel antigo) ou `.xlsx` (Excel moderno)
- O telefone pode ter espaços/traços (serão removidos)
- Nomes de colunas aceitam maiúsculas/minúsculas e com/sem acento
- Linhas sem Nome ou Telefone são ignoradas
- Todos os participantes terão `termoAceito: true`
- Gênero, email, cônjuge, frequência e disponibilidade você atualiza depois pelo painel

## ✏️ Atualizar dados depois:

1. Acesse `/participantes` no sistema
2. Clique em "Editar" no participante
3. Preencha os campos faltantes
4. Salve
