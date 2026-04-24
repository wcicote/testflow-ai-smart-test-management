# TestFlow AI — Plataforma SaaS de Gestão e Geração de Testes com IA
 
> Plataforma desenvolvida com mentalidade de QA para automatizar o ciclo completo de testes de software, integrando Inteligência Artificial à rotina do testador.
 
---
 
## 📋 Sobre o Projeto
 
O **TestFlow AI** nasceu de um problema real: criar e gerenciar casos de teste manualmente é lento, repetitivo e sujeito a inconsistências. Esta plataforma resolve isso integrando IA generativa ao fluxo completo de QA — da criação dos casos de teste até o gerenciamento de bugs — em uma interface moderna e intuitiva.
 
---
 
## ✅ Funcionalidades
 
### Gestão de Projetos e Casos de Teste
- Criar e organizar projetos de software com múltiplas Suítes de Teste
- CRUD completo de Casos de Teste com ID único (TC-X), prioridade, tipo, status e tags
- Repositório centralizado com filtros por Tags, Tipo, Status e busca por ID
- Histórico completo de execuções por projeto
### Geração Inteligente com IA (Google Gemini)
- Gerar Casos de Teste automaticamente a partir da descrição do requisito ou história do usuário
- Diferenciação automática entre **Cenário Positivo** e **Cenário Negativo**
- Gerar Suítes de Teste completas com um clique via botão "Gerar com IA"
- Sugestão automática de severidade de bugs com base na descrição do erro
- Análise de Causa Raiz: sugestões técnicas automáticas sobre onde o erro pode estar no código
### Scripts de Automação
- Geração de scripts prontos para execução com seleção de framework via toggle: **Cypress** ou **Playwright**
- Opção de refatorar o script gerado via IA diretamente na plataforma
- Botão de cópia para uso imediato no projeto de automação
### Test Runner Próprio
- Execução guiada caso a caso com: Pré-condições, Massa de Dados e Passos detalhados
- Registro de resultado por caso: Passou / Falhou / Bloqueado / Pulou
- Anexo de evidências (screenshots) diretamente na execução
- Campo de observações por execução
- Navegação entre casos com controle de progresso
### Gestão de Bugs
- Bug Reports com severidade (Alta, Média, Baixa), status e rastreabilidade direta ao Caso de Teste
- Upload de evidências visuais (screenshots) via Supabase Storage
- Controle de recorrência por bug
- **Lógica de integridade:** o Caso de Teste só retorna ao status "Pronto" após a resolução de **todos** os bugs vinculados a ele — impedindo reteste prematuro
### Dashboard e Métricas
- Visão geral em tempo real: total de testes, testes gerados por IA, execuções de suítes e taxa de sucesso
- Gráfico de Resultado das Execuções (Passou / Falhou)
- Feed de últimos bugs, casos executados e casos criados
---
 
## 🧠 Diferenciais de QA
 
Este projeto foi construído com mentalidade de Analista de QA, focando em resolver problemas reais do dia a dia:
 
- **Integridade de dados:** trava lógica impede reteste prematuro quando há múltiplos bugs abertos no mesmo caso de teste
- **Rastreabilidade completa:** cada bug é vinculado ao seu caso de teste com evidência visual
- **Padronização por IA:** uso do Gemini para sugerir severidade e causa raiz, reduzindo subjetividade entre times
- **Cobertura real:** separação entre Cenário Positivo e Cenário Negativo garante testes mais completos
---
 
## 🛠️ Tech Stack
 
| Camada | Tecnologia |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS, Shadcn/UI |
| Backend & Database | Supabase (PostgreSQL) |
| Storage | Supabase Buckets |
| Inteligência Artificial | Google Gemini API |
| Versionamento | GitHub |
 
---
 
## ⚙️ Como rodar localmente
 
### Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Chave de API do [Google Gemini](https://aistudio.google.com)
### Passo a passo
 
**1. Clone o repositório**
```bash
git clone https://github.com/wcicote/testflow-ai-smart-test-management.git
cd testflow-ai-smart-test-management
```
 
**2. Instale as dependências**
```bash
npm install
```
 
**3. Configure as variáveis de ambiente**
 
Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
VITE_GEMINI_API_KEY=sua_chave_da_api_gemini
```
 
**4. Configure o banco de dados**
 
Execute as migrations do Supabase:
```bash
npx supabase db push
```
 
Ou acesse o painel do Supabase e execute os scripts da pasta `/supabase`.
 
**5. Inicie o projeto**
```bash
npm run dev
```
 
Acesse: `http://localhost:8080`
 
---
 
## 🗺️ Roadmap
 
- [ ] Análise de Requisitos (Shift-Left): módulo de IA para encontrar falhas em requisitos antes do desenvolvimento
- [ ] Exportação de relatórios em PDF com resumo das execuções
- [ ] Integração com Jira para sincronização de bugs
- [ ] Deploy em produção com acesso público
---
 
## 👤 Autor
 
**Wesley Cicote**
Analista de QA | Testes Manuais · API Testing · Cypress · Playwright
 
[![LinkedIn](https://img.shields.io/badge/LinkedIn-wesleycicote--qa-blue?style=flat&logo=linkedin)](https://linkedin.com/in/wesleycicote-qa)
[![GitHub](https://img.shields.io/badge/GitHub-wcicote-black?style=flat&logo=github)](https://github.com/wcicote)
 