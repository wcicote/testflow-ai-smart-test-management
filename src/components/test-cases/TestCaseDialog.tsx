import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestCase, TestSuite } from '@/types';

interface TestCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  testCase: TestCase | null;
  initialSuiteId?: string | null;
  onSuccess: () => void;
}


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
  const [steps, setSteps] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [testType, setTestType] = useState<'manual' | 'automated'>('manual');
  const [status, setStatus] = useState<'draft' | 'ready' | 'running' | 'passed' | 'failed'>('draft');
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

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
      setSteps(testCase.steps || '');
      setExpectedResult(testCase.expected_result || '');
      setPriority(testCase.priority);
      setTestType(testCase.test_type);
      setStatus(testCase.status);
      setSuiteId(testCase.suite_id || null);
    } else {
      setTitle('');
      setSystemRequirement('');
      setSteps('');
      setExpectedResult('');
      setPriority('medium');
      setTestType('manual');
      setStatus('draft');
      setSuiteId(initialSuiteId || null);
    }
  }, [testCase, open, initialSuiteId]);


  const handleGenerateWithAI = async () => {
    if (!systemRequirement.trim()) {
      toast({
        title: 'Requisito necessário',
        description: 'Informe o requisito do sistema para gerar o caso de teste',
        variant: 'destructive',
      });
      return;
    }

    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) {
      toast({
        title: 'Chave não encontrada',
        description: 'A variável VITE_GEMINI_API_KEY não foi detectada. Certifique-se de ter reiniciado o terminal após editar o arquivo .env',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);

    try {
      const systemPrompt = `Você é um especialista em testes de software. Sua tarefa é gerar um caso de teste completo baseado em um requisito do sistema.
Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "title": "Título claro e descritivo do caso de teste",
  "steps": "1. Passo um\\n2. Passo dois\\n3. Passo três...",
  "expectedResult": "Descrição do resultado esperado"
}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt + "\n\nRequisito: " + systemRequirement }]
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro na API do Gemini');
      }

      const result = await response.json();
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) throw new Error('A IA não retornou conteúdo.');

      // Clear any potential markdown code blocks and parse JSON
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const data = JSON.parse(cleanContent);

      if (data.title && !title.trim()) {
        setTitle(data.title);
      }
      if (data.steps) {
        setSteps(data.steps);
      }
      if (data.expectedResult) {
        setExpectedResult(data.expectedResult);
      }

      toast({
        title: 'Caso de teste gerado!',
        description: 'Título, passos e resultado esperado preenchidos automaticamente',
      });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({
        title: 'Erro ao gerar',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe um título para o caso de teste',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const payload = {
      title,
      system_requirement: systemRequirement || null,
      steps: steps || null,
      expected_result: expectedResult || null,
      priority,
      test_type: testType,
      status,
      project_id: projectId,
      suite_id: suiteId,
    };

    if (testCase) {
      const { error } = await supabase
        .from('test_cases')
        .update(payload)
        .eq('id', testCase.id);

      if (error) {
        toast({
          title: 'Erro ao atualizar',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Caso de teste atualizado!' });
        onSuccess();
        onOpenChange(false);
      }
    } else {
      const { error } = await supabase.from('test_cases').insert(payload);

      if (error) {
        toast({
          title: 'Erro ao criar',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Caso de teste criado!' });
        onSuccess();
        onOpenChange(false);
      }
    }

    setLoading(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {testCase ? `Editar Caso de Teste (TC-${testCase.case_number})` : 'Novo Caso de Teste'}
            </DialogTitle>

            <DialogDescription>
              {testCase
                ? 'Atualize as informações do caso de teste'
                : 'Descreva o requisito e deixe a IA gerar o caso de teste completo'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="requirement">Requisito do Sistema</Label>
              <Textarea
                id="requirement"
                placeholder="Descreva o requisito do sistema que será testado. Ex: O sistema deve permitir que o usuário faça login usando e-mail e senha válidos..."
                value={systemRequirement}
                onChange={(e) => setSystemRequirement(e.target.value)}
                rows={3}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleGenerateWithAI}
                disabled={generating}
                className="w-full gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar Caso de Teste com IA
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título do Teste</Label>
              <Input
                id="title"
                placeholder="Ex: Validar login com credenciais válidas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Suíte de Testes</Label>
                <Select value={suiteId || 'none'} onValueChange={(v) => setSuiteId(v === 'none' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem suíte (Raiz)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem suíte (Raiz)</SelectItem>
                    {suites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={testType} onValueChange={(v: any) => setTestType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="automated">Automatizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="ready">Pronto</SelectItem>
                    <SelectItem value="running">Em Execução</SelectItem>
                    <SelectItem value="passed">Passou</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


            <div className="space-y-2">
              <Label htmlFor="steps">Passos do Teste</Label>
              <Textarea
                id="steps"
                placeholder="1. Acessar a página de login&#10;2. Preencher o campo de e-mail&#10;3. ..."
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected">Resultado Esperado</Label>
              <Textarea
                id="expected"
                placeholder="O usuário deve ser redirecionado para o dashboard..."
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {testCase ? 'Salvar' : 'Criar Teste'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
