import { useState } from 'react';
import { Sparkles, Loader2, BookOpen, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { callGeminiWithCache } from '@/lib/aiCache';
import { cn } from '@/lib/utils';

interface AISuiteGeneratorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    onSuccess: () => void;
}

type InputMode = 'feature' | 'user-story';

interface GeneratedTestCase {
    titulo: string;
    pre_condicoes: string;
    massa_dados: string;
    passos: string[];
    resultado_esperado: string;
    prioridade: 'Alta' | 'Média' | 'Baixa';
    test_type: 'functional' | 'security' | 'performance' | 'usability';
    tags: string[];
    automation_script?: string;
}

interface AIResponse {
    suite_name: string;
    suite_description: string;
    test_cases: GeneratedTestCase[];
}

export function AISuiteGeneratorDialog({
    open,
    onOpenChange,
    projectId,
    onSuccess,
}: AISuiteGeneratorDialogProps) {
    const [mode, setMode] = useState<InputMode>('feature');
    const [input, setInput] = useState('');
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<AIResponse | null>(null);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [automationFramework, setAutomationFramework] = useState<'cypress' | 'playwright'>('cypress');
    const [scriptProgress, setScriptProgress] = useState<{ current: number; total: number } | null>(null);
    const { toast } = useToast();

    const handleGenerate = async () => {
        if (!input.trim()) {
            toast({ title: 'Entrada obrigatória', description: 'Descreva a funcionalidade ou user story.', variant: 'destructive' });
            return;
        }

        setGenerating(true);
        setResult(null);

        try {
            const isUserStory = mode === 'user-story';
            const prompt = `Atue como um AI QA Architect sênior e experiente. Sua tarefa é gerar uma suíte de testes COMPLETA a partir da entrada do usuário.

${isUserStory ? `MODO: USER STORY
A entrada é uma User Story no formato "Como [persona] quero [ação] para [objetivo]".
Interprete a user story e gere entre 6 e 12 casos de teste cobrindo cenários positivos e negativos.` : `MODO: FUNCIONALIDADE
A entrada é uma descrição de funcionalidade do sistema.
Gere entre 6 e 12 casos de teste incluindo:
- Caminhos felizes (happy paths)
- Cenários de borda (edge cases)
- Cenários negativos (validações, erros)
- Cenários de segurança (se aplicável)`}

ENTRADA DO USUÁRIO: "${input}"

Retorne APENAS em JSON válido (sem markdown, sem explicações) seguindo este esquema:
{
  "suite_name": "Nome descritivo da suíte de testes",
  "suite_description": "Breve descrição da cobertura da suíte",
  "test_cases": [
    {
      "titulo": "Título claro e técnico do caso de teste",
      "pre_condicoes": "Pré-condições necessárias",
      "massa_dados": "Dados específicos de entrada para esse teste",
      "passos": ["Passo 1", "Passo 2", "Passo 3"],
      "resultado_esperado": "O que deve acontecer ao final",
      "prioridade": "Alta | Média | Baixa",
      "test_type": "functional | security | performance | usability",
      "tags": ["Tags relevantes sem #"]
    }
  ]
}

REGRAS:
1. Gere NO MÍNIMO 6 e NO MÁXIMO 12 casos de teste.
2. Cubra: login válido, credenciais inválidas, campos vazios, limites de caracteres, SQL injection, brute force (se aplicável).
3. Cada caso deve ser auto-suficiente e completo com todos os campos preenchidos.
4. O campo "passos" deve ser um array de strings numeradas.
5. Varie as prioridades realisticamente (nem tudo é Alta).
6. As tags devem refletir a natureza do teste (ex: Segurança, UX, Performance, Regressão, Smoke).
7. NUNCA inclua o script de automação nesta resposta. Ele será solicitado separadamente para cada caso.`;

            const data = await callGeminiWithCache<AIResponse>(
                'suite_generation',
                `${mode}:${input}`,
                prompt,
                { jsonMode: true }
            );

            setResult(data);
            // Select all by default
            const allIndices = new Set<number>();
            data.test_cases.forEach((_, i) => allIndices.add(i));
            setSelectedIndices(allIndices);

            toast({ title: `${data.test_cases.length} casos gerados!`, description: `Suíte: ${data.suite_name}` });
        } catch (error: any) {
            console.error('AI Suite Generation error:', error);
            toast({ title: 'Erro ao gerar suíte', description: error.message, variant: 'destructive' });
        } finally {
            setGenerating(false);
        }
    };

    const toggleCase = (index: number) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const toggleAll = () => {
        if (!result) return;
        if (selectedIndices.size === result.test_cases.length) {
            setSelectedIndices(new Set());
        } else {
            const all = new Set<number>();
            result.test_cases.forEach((_, i) => all.add(i));
            setSelectedIndices(all);
        }
    };

    const priorityMap: Record<string, 'low' | 'medium' | 'high'> = {
        'Alta': 'high',
        'Média': 'medium',
        'Baixa': 'low',
    };

    const handleSave = async () => {
        if (!result || selectedIndices.size === 0) return;

        setSaving(true);

        try {
            // 1. Create the suite
            const { data: suiteData, error: suiteError } = await supabase
                .from('test_suites')
                .insert({
                    project_id: projectId,
                    name: result.suite_name,
                    description: result.suite_description,
                })
                .select()
                .single();

            if (suiteError) throw suiteError;

            // 2. Generate scripts individually for each selected case
            const selectedCases = result.test_cases.filter((_, i) => selectedIndices.has(i));
            setScriptProgress({ current: 0, total: selectedCases.length });

            const casesToInsert = [];
            
            for (let i = 0; i < selectedCases.length; i++) {
                const tc = selectedCases[i];
                setScriptProgress({ current: i + 1, total: selectedCases.length });
                
                let script = null;
                try {
                    const prompt = `Atue como um Principal QA Automation Engineer. Gere um script de automação para este caso de teste:
                    
                    Título: ${tc.titulo}
                    Passos: ${Array.isArray(tc.passos) ? tc.passos.join('\n') : tc.passos}
                    Massa: ${tc.massa_dados}
                    Expectativa: ${tc.resultado_esperado}
                    Framework: ${automationFramework}

                    REGRAS:
                    1. Retorne APENAS o código puro. Sem markdown, sem explicações.
                    2. Use seletores data-testid quando possível.
                    3. Se Cypress: use it(). Se Playwright: use test().`;

                    const scriptResponse = await callGeminiWithCache<string>(
                        'automation_script',
                        `${automationFramework}:${tc.titulo}:${tc.passos}`,
                        prompt,
                        { jsonMode: false }
                    );
                    script = scriptResponse;
                } catch (err) {
                    console.error(`Error generating script for ${tc.titulo}:`, err);
                }

                casesToInsert.push({
                    project_id: projectId,
                    suite_id: suiteData.id,
                    title: tc.titulo,
                    pre_conditions: typeof tc.pre_condicoes === 'object' ? JSON.stringify(tc.pre_condicoes, null, 2) : tc.pre_condicoes || null,
                    data_setup: typeof tc.massa_dados === 'object' ? JSON.stringify(tc.massa_dados, null, 2) : tc.massa_dados || null,
                    steps: Array.isArray(tc.passos) ? tc.passos.join('\n') : tc.passos || null,
                    expected_result: tc.resultado_esperado || null,
                    priority: priorityMap[tc.prioridade] || 'medium',
                    test_type: tc.test_type || 'functional',
                    automation_status: script && script.trim() !== '' ? 'automated' as const : 'manual' as const,
                    status: 'ready' as const,
                    tags: tc.tags || [],
                    system_requirement: input,
                    origin: 'ai' as const,
                    automation_script: script || null,
                    automation_framework: automationFramework,
                });
            }

            const { error: casesError } = await supabase
                .from('test_cases')
                .insert(casesToInsert);

            if (casesError) throw casesError;

            toast({
                title: 'Suíte salva com sucesso!',
                description: `${casesToInsert.length} casos de teste foram criados na suíte "${result.suite_name}".`,
            });

            // Reset and close
            setResult(null);
            setInput('');
            setSelectedIndices(new Set());
            setScriptProgress(null);
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
            setScriptProgress(null);
        }
    };

    const getTestTypeBadge = (tipo: string) => {
        switch (tipo) {
            case 'functional': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Funcionamento</Badge>;
            case 'security': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Segurança</Badge>;
            case 'performance': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Performance</Badge>;
            case 'usability': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Usabilidade</Badge>;
            default: return <Badge variant="outline" className="text-[10px]">{tipo}</Badge>;
        }
    };

    const getPrioridadeBadge = (prioridade: string) => {
        switch (prioridade) {
            case 'Alta': return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Alta</Badge>;
            case 'Média': return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">Média</Badge>;
            case 'Baixa': return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">Baixa</Badge>;
            default: return <Badge variant="outline" className="text-[10px]">{prioridade}</Badge>;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onPointerDownOutside={(e) => e.preventDefault()}
                className="max-w-5xl max-h-[95vh] flex flex-col p-0 border-slate-800 bg-slate-950"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2 text-white">
                            <Sparkles className="w-5 h-5 text-primary" />
                            Gerador de Suíte com IA
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Descreva uma funcionalidade ou user story e a IA gerará uma suíte completa de testes automaticamente.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {!result ? (
                        /* Input Phase */
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Mode Selector */}
                            <div className="space-y-3">
                                <Label className="text-slate-300 font-semibold">Framework de Automação</Label>
                                <div className="flex items-center gap-4 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-sm transition-colors", automationFramework === 'cypress' ? "text-primary font-bold" : "text-slate-400")}>Cypress</span>
                                        <Switch
                                            checked={automationFramework === 'playwright'}
                                            onCheckedChange={(checked: boolean) => setAutomationFramework(checked ? 'playwright' : 'cypress')}
                                        />
                                        <span className={cn("text-sm transition-colors", automationFramework === 'playwright' ? "text-primary font-bold" : "text-slate-400")}>Playwright</span>
                                    </div>
                                    <span className="text-xs text-slate-500 italic">Os scripts serão gerados neste framework</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-slate-300 font-semibold">Modo de Entrada</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setMode('feature')}
                                        className={cn(
                                            "p-4 rounded-xl border-2 text-left transition-all",
                                            mode === 'feature'
                                                ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                                                : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                                        )}
                                    >
                                        <Zap className={cn("w-5 h-5 mb-2", mode === 'feature' ? "text-primary" : "text-slate-500")} />
                                        <h4 className="font-semibold text-sm text-slate-200">Funcionalidade</h4>
                                        <p className="text-xs text-slate-500 mt-1">Ex: "Sistema de login de usuários"</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode('user-story')}
                                        className={cn(
                                            "p-4 rounded-xl border-2 text-left transition-all",
                                            mode === 'user-story'
                                                ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10"
                                                : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                                        )}
                                    >
                                        <BookOpen className={cn("w-5 h-5 mb-2", mode === 'user-story' ? "text-purple-400" : "text-slate-500")} />
                                        <h4 className="font-semibold text-sm text-slate-200">User Story</h4>
                                        <p className="text-xs text-slate-500 mt-1">Ex: "Como usuário quero fazer login..."</p>
                                    </button>
                                </div>
                            </div>

                            {/* Input Field */}
                            <div className="space-y-2">
                                <Label className="text-slate-300 font-semibold">
                                    {mode === 'feature' ? 'Descrição da Funcionalidade' : 'User Story'}
                                </Label>
                                <Textarea
                                    placeholder={
                                        mode === 'feature'
                                            ? 'Ex: Sistema de autenticação com login, registro e recuperação de senha...'
                                            : 'Ex: Como usuário quero fazer login com email e senha para acessar minha conta...'
                                    }
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    rows={5}
                                    className="bg-slate-950 border-slate-700 focus:border-primary/50 text-base"
                                />
                            </div>

                            {/* Examples */}
                            <div className="space-y-2">
                                <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Exemplos rápidos</span>
                                <div className="flex flex-wrap gap-2">
                                    {(mode === 'feature' ? [
                                        'Sistema de login de usuários',
                                        'Carrinho de compras e-commerce',
                                        'Upload de arquivos com validação',
                                        'Sistema de notificações push',
                                    ] : [
                                        'Como usuário quero fazer login para acessar minha conta',
                                        'Como admin quero gerenciar usuários para manter o controle de acesso',
                                        'Como cliente quero buscar produtos para encontrar o que preciso',
                                    ]).map(example => (
                                        <button
                                            key={example}
                                            type="button"
                                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 bg-slate-900/40 transition-all"
                                            onClick={() => setInput(example)}
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Results Phase */
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="px-6 pt-4 pb-3 border-b border-slate-800 bg-slate-900/30">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{result.suite_name}</h3>
                                        <p className="text-sm text-slate-400">{result.suite_description}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="text-primary border-primary/30">
                                            {result.test_cases.length} casos
                                        </Badge>
                                        <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs text-slate-400">
                                            {selectedIndices.size === result.test_cases.length ? 'Desselecionar tudo' : 'Selecionar tudo'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 px-6 py-4">
                                <div className="space-y-3">
                                    {result.test_cases.map((tc, i) => (
                                        <div
                                            key={i}
                                            onClick={() => toggleCase(i)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 cursor-pointer transition-all",
                                                selectedIndices.has(i)
                                                    ? "border-primary/50 bg-primary/5"
                                                    : "border-slate-800 bg-slate-900/30 opacity-60 hover:opacity-80"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-all",
                                                    selectedIndices.has(i) ? "border-primary bg-primary" : "border-slate-700"
                                                )}>
                                                    {selectedIndices.has(i) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                        <span className="text-sm font-semibold text-slate-200">{tc.titulo}</span>
                                                        {getTestTypeBadge(tc.test_type)}
                                                        {getPrioridadeBadge(tc.prioridade)}
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                        {tc.pre_condicoes && (
                                                            <div>
                                                                <span className="text-slate-500 font-semibold">Pré-condições:</span>
                                                                <p className="text-slate-400 mt-0.5">{tc.pre_condicoes}</p>
                                                            </div>
                                                        )}
                                                        {tc.resultado_esperado && (
                                                            <div>
                                                                <span className="text-slate-500 font-semibold">Resultado Esperado:</span>
                                                                <p className="text-emerald-400/80 mt-0.5">{tc.resultado_esperado}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {tc.passos && (
                                                        <div className="mt-2 text-xs text-slate-500">
                                                            <span className="font-semibold">Passos: </span>
                                                            {Array.isArray(tc.passos) ? tc.passos.length : 0} passos definidos
                                                        </div>
                                                    )}

                                                    {tc.tags && tc.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {tc.tags.map((tag, ti) => (
                                                                <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{tag}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/50">
                    <DialogFooter className="flex-row justify-between sm:justify-between">
                        {result ? (
                            <>
                                <Button variant="ghost" onClick={() => { setResult(null); }} className="text-slate-400">
                                    ← Voltar
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving || selectedIndices.size === 0}
                                        className="px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                {scriptProgress 
                                                    ? `Gerando Scripts (${scriptProgress.current}/${scriptProgress.total})...`
                                                    : 'Salvando...'
                                                }
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Salvar {selectedIndices.size} caso{selectedIndices.size !== 1 ? 's' : ''} no projeto
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={generating || !input.trim()}
                                    className="px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Gerando suíte...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Gerar Suíte com IA
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
