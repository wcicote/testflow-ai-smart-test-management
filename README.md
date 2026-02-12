TestFlow AI - Smart Test Management 🚀
TestFlow AI é uma plataforma de gestão de testes desenvolvida para modernizar o ciclo de vida de QA. O foco do projeto é integrar Inteligência Artificial na rotina do testador, garantindo que a qualidade seja monitorada de forma automática, desde o registro do caso de teste até a resolução final do bug.

🛠️ Funcionalidades Principais
• Gestão de Casos de Teste: CRUD completo de testes com interface intuitiva e moderna.

<img width="1913" height="858" alt="Captura de tela 2026-02-11 230524" src="https://github.com/user-attachments/assets/5e58cba7-88fc-4e82-9592-8d2415746712" />

• Relatório de Bugs com Evidências: Suporte a upload de fotos e vídeos (via Supabase Storage) para documentação técnica impecável.

• Inteligência Artificial (Lovable AI/Gemini):

   • Sugestão de Severidade: A IA analisa a descrição do erro e classifica automaticamente o impacto (Crítico, Alto, Médio, Baixo).
   
<img width="510" height="764" alt="Captura de tela 2026-02-11 231324" src="https://github.com/user-attachments/assets/9f26f807-a0cf-4fb9-abe3-30c31bfac868" />

   • Análise de Causa Raiz: Sugestões técnicas automáticas para desenvolvedores sobre onde o erro pode estar no código.
   
<img width="514" height="852" alt="Captura de tela 2026-02-11 230745" src="https://github.com/user-attachments/assets/3c097039-5903-4a8a-ae47-05e8855f9ae9" />

• Automação de Fluxo (Status Sync):

  • Ao relatar um bug, o Caso de Teste muda automaticamente para "Falhou".

  • O teste só retorna ao status "Pronto" após a resolução do último bug vinculado (Lógica de dependência múltipla).

🧠 Diferenciais de QA (Onde o projeto brilha)
Este projeto foi construído com a mentalidade de um Analista de QA. Foquei em resolver problemas reais do dia a dia:

  • Integridade dos Dados: Implementei uma trava lógica que impede o reteste prematuro. Se um caso de teste possui 3 bugs abertos, resolver apenas um não libera o teste. Isso garante que o ambiente esteja realmente estável para nova validação.

  • Rastreabilidade Multimídia: Eliminação da ambiguidade através de evidências visuais integradas diretamente ao relatório de falha.

  • Redução de Subjetividade: Uso de LLMs para padronizar a severidade dos bugs, evitando conflitos de priorização entre times.

🚀 Roadmap (Próximos Passos)
Devido ao ciclo de desenvolvimento planejado, as próximas iterações incluirão:

  • [ ] Análise de Requisitos (Shift-Left): Módulo de IA para encontrar falhas em requisitos antes mesmo do início do desenvolvimento.

  • [ ] Suítes de Teste: Organização de repositórios por módulos e categorias (Fumaça, Regressão, Funcional).

  • [ ] Exportação de Relatórios: Geração de PDFs profissionais com o resumo das execuções.

💻 Tech Stack
  • Frontend: React, Tailwind CSS, Shadcn/UI.

  • Backend & Database: Supabase (PostgreSQL).

  • Storage: Supabase Buckets (Mídias).

  • Inteligência Artificial: Lovable AI (Powered by Gemini).

👤 Autor
Wesley Cicote Analista de QA em transição de carreira

www.linkedin.com/in/wesley-cicote
