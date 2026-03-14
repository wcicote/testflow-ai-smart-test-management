import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Tag, Info, Database, Plus, X, Code2, Copy, Check, Play, RefreshCw } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestCase, TestSuite } from '@/types';
import { cn } from '@/lib/utils';
import { callGeminiWithCache } from '@/lib/aiCache';

interface TestCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  testCase: TestCase | null;
  initialSuiteId?: string | null;
  onSuccess: () => void;
}

const AVAILABLE_TAGS = ['Regressão', 'Smoke', 'Sanity', 'Frontend', 'Backend', 'API', 'Mobile'];

export function TestCaseDialog({
  open,
  onOpenChange,
  projectId,
  testCase,
  initialSuiteId,
  onSuccess,
}: TestCaseDialogProps) {

  const [title, setTitle] = useState('');
  const [systemRequirement, setSystemRequirement] = useState('');
  const [preConditions, setPreConditions] = useState('');
  const [dataSetup, setDataSetup] = useState('');
  const [steps, setSteps] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [testType, setTestType] = useState<'functional' | 'security' | 'performance' | 'usability'>('functional');
  const [status, setStatus] = useState<'draft' | 'ready' | 'running' | 'passed' | 'failed'>('draft');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<'happy' | 'edge' | null>(null);
  const [automationFramework, setAutomationFramework] = useState<'cypress' | 'playwright'>('cypress');
  const [automationScript, setAutomationScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const [origin, setOrigin] = useState<'manual' | 'ai'>('manual');
  const { toast } = useToast();

  const QUICK_ACCESS_TAGS = ['Regressão', 'Smoke', 'Frontend', 'Backend'];
  const SUGGESTIONS = ['Sanity', 'API', 'Mobile', 'UI/UX', 'Performance', 'Security', 'Database'];

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  useEffect(() => {
    if (open && projectId) {
      const fetchSuites = async () => {
        const { data } = await supabase
          .from('test_suites')
          .select('*')
          .eq('project_id', projectId)
          .order('name');
        setSuites(data || []);
      };
      fetchSuites();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (testCase) {
      setTitle(testCase.title);
      setSystemRequirement(testCase.system_requirement || '');
      setPreConditions(testCase.pre_conditions || '');
      setDataSetup(testCase.data_setup || '');
      setSteps(testCase.steps || '');
      setExpectedResult(testCase.expected_result || '');
      setPriority(testCase.priority);
      setTestType(testCase.test_type);
      setStatus(testCase.status);
      setTags(testCase.tags || []);
      setSuiteId(testCase.suite_id || null);
      setAutomationScript(testCase.automation_script || '');
      setAutomationFramework(testCase.automation_framework || 'cypress');
      setOrigin(testCase.origin || 'manual');
      if (testCase.automation_script) {
        setAccordionValue("automation");
      }
    } else if (open) {
      // Recovery draft for NEW test cases
      const draft = localStorage.getItem(`testflow_draft_${projectId}`);
      if (draft) {
        try {
          const data = JSON.parse(draft);
          setTitle(data.title || '');
          setSystemRequirement(data.systemRequirement || '');
          setPreConditions(data.preConditions || '');
          setDataSetup(data.dataSetup || '');
          setSteps(data.steps || '');
          setExpectedResult(data.expectedResult || '');
          setPriority(data.priority || 'medium');
          setTestType(data.testType || 'functional');
          setTags(data.tags || []);
          setAutomationFramework(data.automationFramework || 'cypress');
          setAutomationScript(data.automationScript || '');
          if (data.automationScript) {
            setAccordionValue("automation");
          }
          setSuiteId(data.suiteId || initialSuiteId || null);
        } catch (e) {
          console.error('Error recovering draft:', e);
        }
      } else {
        // Reset to empty if no draft exists
        setTitle('');
        setSystemRequirement('');
        setPreConditions('');
        setDataSetup('');
        setSteps('');
        setExpectedResult('');
        setPriority('medium');
        setTestType('functional');
        setStatus('draft');
        setTags([]);
        setSuiteId(initialSuiteId || null);
        setAutomationScript('');
        setAutomationFramework('cypress');
        setOrigin('manual');
        setAccordionValue("");
      }
    }
  }, [testCase, open, initialSuiteId, projectId]);

  // Auto-save draft effect
  useEffect(() => {
    if (!testCase && open) {
      const draftData = {
        title,
        systemRequirement,
        preConditions,
        dataSetup,
        steps,
        expectedResult,
        priority,
        testType,
        tags,
        automationFramework,
        automationScript,
        suiteId,
      };

      const timeoutId = setTimeout(() => {
        localStorage.setItem(`testflow_draft_${projectId}`, JSON.stringify(draftData));
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [
    testCase, open, projectId, title, systemRequirement, preConditions,
    dataSetup, steps, expectedResult, priority, testType, tags,
    automationFramework, automationScript, suiteId
  ]);

  const clearDraft = () => {
    localStorage.removeItem(`testflow_draft_${projectId}`);
  };


  const handleGenerateWithAI = async (mode: 'happy' | 'edge') => {
    if (!systemRequirement.trim()) {
      toast({
        title: 'Requisito necessário',
        description: 'Informe o requisito do sistema para gerar o caso de teste',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(mode);

    try {
      const modeName = mode === 'happy' ? 'CAMINHO_FELIZ' : 'CASOS_DE_BORDA';

      const systemPrompt = `Atue como um AI QA Architect. Sua tarefa é processar um requisito de software e transformá-lo em um caso de teste técnico, estruturado e pronto para execução.

Input: [${systemRequirement}]
Modo de Geração: [${modeName}]
Framework Alvo para Automação: [${automationFramework === 'cypress' ? 'Cypress' : 'Playwright'}]

Instruções de Saída (JSON Estrito):
Você deve retornar apenas um objeto JSON seguindo este esquema, sem textos explicativos antes ou depois:

{
  "titulo": "Título técnico seguindo o padrão 'Ação + Objetivo'",
  "pre_condicoes": "O que é necessário para iniciar (ex: ambiente, permissões)",
  "massa_dados": "Exemplos específicos de inputs (nomes, números, payloads)",
  "passos": ["Passo 1...", "Passo 2...", "Passo 3..."],
  "resultado_esperado": "O estado final esperado do sistema",
  "prioridade": "Alta | Média | Baixa",
  "tags_sugeridas": ["Array de tags baseadas no contexto"]
}

Regras:
1. NUNCA inclua o script de automação nesta resposta. Ele será gerado em uma etapa posterior.
2. Identifique tecnicamente os passos e pré-condições.
3. NUNCA inclua markdown (\`\`\`) dentro do valor da string JSON.

Lógica de Auto-Tagging:
Analise o requisito e inclua automaticamente no array tags_sugeridas as categorias que se aplicam:
- Se envolver login, permissões ou tokens: #Security
- Se envolver telas, botões ou cores: #Frontend | #UI
- Se envolver APIs, Banco de Dados ou Integradores: #Backend | #API
- Se o modo for 'Caminho Feliz': #SmokeTest | #Sanity
- Se o modo for 'Casos de Borda': #NegativeTest | #Resiliência
Identifique também a funcionalidade (ex: #Checkout, #Auth, #Dashboard).`;

      const data = await callGeminiWithCache<any>(
        'test_case_generation',
        `${mode}:${automationFramework}:${systemRequirement}`,
        systemPrompt,
        { jsonMode: true }
      );

      // Mapping for Priority
      const priorityMap: Record<string, 'low' | 'medium' | 'high'> = {
        'Alta': 'high',
        'Média': 'medium',
        'Baixa': 'low'
      };

      setTitle(data.titulo || title);
      setPreConditions(typeof data.pre_condicoes === 'object' ? JSON.stringify(data.pre_condicoes, null, 2) : data.pre_condicoes || '');
      setDataSetup(typeof data.massa_dados === 'object' ? JSON.stringify(data.massa_dados, null, 2) : data.massa_dados || '');
      setSteps(Array.isArray(data.passos) ? data.passos.join('\n') : data.passos || '');
      setExpectedResult(data.resultado_esperado || '');
      setOrigin('ai');

      if (data.script_automacao) {
        setAccordionValue("automation");
      }

      if (data.prioridade && priorityMap[data.prioridade]) {
        setPriority(priorityMap[data.prioridade]);
      }
      if (Array.isArray(data.tags_sugeridas)) {
        setTags(prev => {
          const newTags = [...prev];
          data.tags_sugeridas.forEach((tag: string) => {
            const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
            if (!newTags.includes(cleanTag)) newTags.push(cleanTag);
          });
          return newTags;
        });
      }

      toast({
        title: mode === 'happy' ? 'Caminho Feliz Gerado!' : 'Casos de Borda Gerados!',
        description: 'Os campos foram preenchidos. Gerando script de automação...',
      });

      // AUTO GENERATE SCRIPT AFTER CASE IS GENERATED
      if (data.titulo && data.passos) {
          // We call it directly but we need to wait for state updates? 
          // Actually we can pass the data directly to a modified version or just rely on state.
          // Since React state updates are async, it's better to pass params to handleGenerateAutomationScript or just call it after a tiny delay
          // But a better way is to refactor handleGenerateAutomationScript to accept optional params.
          setTimeout(() => {
              handleGenerateAutomationScript();
          }, 500);
      }

    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({ title: 'Erro ao gerar', description: error.message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateAutomationScript = async () => {
    if (!steps.trim()) {
      toast({ title: 'Passos necessários', description: 'Escreva os passos manuais primeiro.', variant: 'destructive' });
      return;
    }

    setIsGeneratingScript(true);
    try {
      const prompt = `Atue como um Principal QA Automation Engineer. Sua função é traduzir um caso de teste manual em um script de automação funcional e resiliente.

Contexto de Entrada:
Título: ${title}
Passos: ${steps}
Massa de Dados: ${dataSetup}
Resultado Esperado: ${expectedResult}
Framework Alvo: ${automationFramework === 'cypress' ? 'Cypress' : 'Playwright'}

Instruções de Saída (REGRAS OBRIGATÓRIAS):
1. GERE O SCRIPT APENAS PARA O FRAMEWORK: ${automationFramework === 'cypress' ? 'Cypress' : 'Playwright'}.
2. NUNCA GERE DOIS FRAMEWORKS NO MESMO RESULTADO.
3. Se o alvo for Cypress: Use it('${title}', () => { ... }) e procure usar data-testid nos seletores.
4. Se o alvo for Playwright: Use test('${title}', async ({ page }) => { ... }) com locators modernos.
5. Integração de Dados: Insira os valores da 'Massa de Dados' diretamente nos comandos de digitação/preenchimento.
6. Validação Final: Inclua uma asserção (expect ou should) que verifique rigorosamente o 'Resultado Esperado'.
7. Retorne APENAS o código bruto, sem explicações, sem markdown (sem \`\`\`), sem blocos de texto adicionais.`;

      const content = await callGeminiWithCache<string>(
        'automation_script_single',
        `${automationFramework}:${title}:${steps}`,
        prompt,
        { jsonMode: false }
      );

      if (content) {
        setAutomationScript(content);
        setOrigin('ai');
        toast({ title: 'Script gerado!', description: `Código em ${automationFramework} criado com sucesso.` });
      }
    } catch (error: any) {
      console.error('Automation script generation error:', error);
      toast({ title: 'Erro ao gerar script', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'Copiado!', description: 'Código copiado para a área de transferência.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' });
      return;
    }

    setLoading(true);

    const payload = {
      title,
      system_requirement: systemRequirement || null,
      pre_conditions: preConditions || null,
      data_setup: dataSetup || null,
      steps: steps || null,
      expected_result: expectedResult || null,
      tags,
      priority,
      test_type: testType,
      automation_status: automationScript && automationScript.trim() !== '' ? 'automated' : 'manual',
      status,
      project_id: projectId,
      suite_id: suiteId,
      automation_script: automationScript || null,
      automation_framework: automationFramework,
      origin: origin || 'manual',
    };

    const { error } = testCase
      ? await supabase.from('test_cases').update(payload).eq('id', testCase.id)
      : await supabase.from('test_cases').insert(payload);

    if (error) {
      toast({ title: 'Erro na operação', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: testCase ? 'Teste atualizado!' : 'Teste criado!' });
      clearDraft(); // Clean draft on success
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      if (title || steps || systemRequirement) {
        if (!window.confirm('Existem dados não salvos neste formulário (porém foram salvos em rascunho localmente). Deseja realmente fechar?')) {
          return;
        }
      }
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-4xl max-h-[95vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 p-0 overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-white">
              {testCase ? `Editar Caso de Teste (TC-${testCase.case_number})` : 'Novo Caso de Teste'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Personalize os detalhes ou utilize a IA para acelerar a criação do seu plano de testes.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Requirement Section */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requirement" className="text-slate-300 font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Contexto do Requisito para IA
              </Label>
              <Textarea
                id="requirement"
                placeholder="Descreva o que o sistema deve fazer..."
                value={systemRequirement}
                onChange={(e) => setSystemRequirement(e.target.value)}
                rows={2}
                className="bg-slate-950 border-slate-700 focus:border-primary/50"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleGenerateWithAI('happy')}
                disabled={!!generating}
                className="flex-1 min-w-[140px] gap-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border-emerald-600/20"
              >
                {generating === 'happy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar Caminho Feliz
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleGenerateWithAI('edge')}
                disabled={!!generating}
                className="flex-1 min-w-[140px] gap-2 bg-amber-600/10 text-amber-400 hover:bg-amber-600/20 border-amber-600/20"
              >
                {generating === 'edge' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar Casos de Borda
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Title Section */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-slate-300 font-semibold">Título do Teste</Label>
              <Input
                id="title"
                placeholder="Ex: Validar fluxo de checkout..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-slate-950 border-slate-700 text-lg py-6 focus:ring-primary/40"
              />
            </div>

            {/* Sub-Header Fields (Pre-conditions & Data Setup) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> Pré-condições
                </Label>
                <Textarea
                  placeholder="Ex: Usuário logado, Saldo disponível..."
                  value={preConditions}
                  onChange={(e) => setPreConditions(e.target.value)}
                  rows={2}
                  className="bg-slate-950 border-slate-700 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" /> Massa de Dados
                </Label>
                <Textarea
                  placeholder="Ex: user@test.com, cartão final 4242..."
                  value={dataSetup}
                  onChange={(e) => setDataSetup(e.target.value)}
                  rows={2}
                  className="bg-slate-950 border-slate-700 text-sm"
                />
              </div>
            </div>

            {/* Metadata Grid (2 columns) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-900/40 border border-slate-800">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase font-bold">Suíte</Label>
                <Select value={suiteId || 'none'} onValueChange={(v) => setSuiteId(v === 'none' ? null : v)}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 h-9">
                    <SelectValue placeholder="Raiz" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="none">Raiz (Sem suíte)</SelectItem>
                    {suites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase font-bold">Prioridade</Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase font-bold">Tipo</Label>
                <Select value={testType} onValueChange={(v: any) => setTestType(v)}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="functional">Funcional</SelectItem>
                    <SelectItem value="security">Segurança</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="usability">Usabilidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase font-bold">Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="passed">Pass</SelectItem>
                    <SelectItem value="failed">Fail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tags Management Section */}
            <div className="space-y-3">
              <Label className="text-slate-300 font-semibold flex items-center gap-2">
                <Tag className="w-4 h-4" /> Categorias / Tags
              </Label>

              <div className="space-y-4">
                {/* Tag Input with "Autocomplete" feel */}
                <div className="relative">
                  <Input
                    placeholder="Digite uma tag e pressione Enter..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-slate-950 border-slate-700 h-10 focus:ring-primary/40"
                  />
                  {tagInput.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {SUGGESTIONS.filter(s => s.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(s)).map(suggestion => (
                        <div
                          key={suggestion}
                          className="px-4 py-2 hover:bg-slate-800 cursor-pointer text-sm"
                          onClick={() => handleAddTag(suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Display Active Tags */}
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag}
                      className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 transition-all flex items-center gap-1.5 px-3 py-1"
                    >
                      {tag}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-white"
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>

                {/* Quick Access Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Acesso Rápido</span>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ACCESS_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        disabled={tags.includes(tag)}
                        onClick={() => handleAddTag(tag)}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-md border transition-all",
                          tags.includes(tag)
                            ? "border-emerald-500/20 text-emerald-500/50 bg-emerald-500/5 cursor-not-allowed"
                            : "border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white bg-slate-900/40"
                        )}
                      >
                        <Plus className="w-2.5 h-2.5 inline mr-1" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Steps and Expected Section */}
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="steps" className="text-slate-300 font-semibold">Passos do Teste</Label>
                <Textarea
                  id="steps"
                  placeholder="1. Acessar tela...&#10;2. Preencher formulário..."
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  rows={6}
                  className="bg-slate-950 border-slate-700 focus:ring-emerald-500/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected" className="text-slate-300 font-semibold">Resultado Esperado</Label>
                <Textarea
                  id="expected"
                  placeholder="O sistema deve exibir a mensagem de sucesso e redirecionar..."
                  value={expectedResult}
                  onChange={(e) => setExpectedResult(e.target.value)}
                  rows={3}
                  className="bg-slate-950 border-slate-700 focus:ring-emerald-500/30"
                />
              </div>

              {/* Automation Section */}
              <div className="mt-4 border-t border-slate-800 pt-6">
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  value={accordionValue}
                  onValueChange={setAccordionValue}
                >
                  <AccordionItem value="automation" className="border-slate-800">
                    <AccordionTrigger className="hover:no-underline py-0">
                      <div className="flex items-center gap-2 text-slate-300 font-semibold">
                        <Code2 className="w-4 h-4 text-primary" />
                        💻 Script de Automação Sugerido
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                      <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-slate-400">Framework:</span>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs transition-colors", automationFramework === 'cypress' ? "text-primary" : "text-slate-600")}>Cypress</span>
                            <Switch
                              checked={automationFramework === 'playwright'}
                              onCheckedChange={(checked) => setAutomationFramework(checked ? 'playwright' : 'cypress')}
                            />
                            <span className={cn("text-xs transition-colors", automationFramework === 'playwright' ? "text-primary" : "text-slate-600")}>Playwright</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateAutomationScript}
                          disabled={isGeneratingScript}
                          className="h-8 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          {isGeneratingScript ? (
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-2" />
                          )}
                          Refatorar Script
                        </Button>
                      </div>

                      {isGeneratingScript ? (
                        <div className="flex flex-col items-center justify-center py-12 bg-slate-900/30 border border-slate-800 rounded-xl space-y-4 animate-pulse">
                          <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                            <Loader2 className="w-10 h-10 text-primary animate-spin relative z-10" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-slate-300">Consultando Principal QA Engineer...</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Gerando script resiliente</p>
                          </div>
                        </div>
                      ) : automationScript ? (
                        <div className="relative group overflow-hidden rounded-xl border border-slate-800 bg-[#1e1e1e] shadow-2xl">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {automationFramework}.spec.{automationFramework === 'cypress' ? 'js' : 'ts'}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-2 text-slate-400 hover:text-white"
                              onClick={() => copyToClipboard(automationScript)}
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              <span className="text-xs">{copied ? 'Copiado' : 'Copiar'}</span>
                            </Button>
                          </div>
                          <div className="p-4 text-[13px] font-mono leading-relaxed overflow-x-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-700">
                            <pre className="text-slate-300">
                              <code className="block whitespace-pre">
                                {automationScript.split('\n').map((line, i) => (
                                  <div key={i} className="flex">
                                    <span className="w-8 text-slate-600 text-right mr-4 select-none">{i + 1}</span>
                                    <span className={cn(
                                      line.trim().startsWith('//') ? "text-slate-500 italic" :
                                        line.includes('it(') || line.includes('test(') ? "text-amber-400 font-bold" :
                                          line.includes('expect(') || line.includes('.should(') ? "text-emerald-400 font-bold" :
                                            "text-slate-300"
                                    )}>
                                      {line}
                                    </span>
                                  </div>
                                ))}
                              </code>
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl">
                          <Play className="w-8 h-8 text-slate-700 mb-2" />
                          <p className="text-sm text-slate-500">Nenhum script gerado ainda.</p>
                          <Button
                            type="button"
                            variant="link"
                            className="text-primary text-xs"
                            onClick={handleGenerateAutomationScript}
                            disabled={isGeneratingScript}
                          >
                            Gerar script inicial agora
                          </Button>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <DialogFooter className="flex-row justify-end space-x-2">
            <Button type="button" variant="ghost" onClick={() => handleClose(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {testCase ? 'Salvar Edição' : 'Criar Caso de Teste'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
