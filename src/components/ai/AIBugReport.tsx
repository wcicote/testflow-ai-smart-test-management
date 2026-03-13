import { useState } from 'react';
import { Sparkles, Loader2, Copy, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { callGeminiWithCache } from '@/lib/aiCache';
import { TestCase } from '@/types';

interface AIBugReportProps {
    testCase: TestCase;
    bugDescription: string;
    notes?: string;
    onApplyReport?: (report: BugReport) => void;
}

export interface BugReport {
    titulo_bug: string;
    descricao: string;
    passos_reproducao: string[];
    resultado_esperado: string;
    resultado_obtido: string;
    severidade: 'Crítica' | 'Alta' | 'Média' | 'Baixa';
    impacto: string;
    ambiente_sugerido: string;
    workaround?: string;
}

export function AIBugReport({ testCase, bugDescription, notes, onApplyReport }: AIBugReportProps) {
    const [report, setReport] = useState<BugReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    const generateReport = async () => {
        if (!bugDescription.trim()) {
            toast({ title: 'Descrição necessária', description: 'Descreva o bug antes de gerar o relatório.', variant: 'destructive' });
            return;
        }

        setLoading(true);

        try {
            const prompt = `Atue como um Senior QA Engineer especializado em Bug Reports profissionais. Analise o contexto abaixo e gere um Bug Report completo e estruturado.

CONTEXTO:
Caso de Teste: ${testCase.title}
Passos do Teste: ${testCase.steps || 'Não informados'}
Resultado Esperado: ${testCase.expected_result || 'Não informado'}
Pré-condições: ${testCase.pre_conditions || 'Não informadas'}
Massa de Dados: ${testCase.data_setup || 'Não informada'}
Prioridade do Caso: ${testCase.priority}

DESCRIÇÃO DO BUG PELO TESTADOR: ${bugDescription}
${notes ? `OBSERVAÇÕES ADICIONAIS: ${notes}` : ''}

Retorne APENAS JSON válido seguindo este esquema:
{
  "titulo_bug": "Título claro e objetivo do bug no formato [Módulo] - Descrição do problema",
  "descricao": "Descrição detalhada do bug em 2-3 frases, incluindo o contexto e o impacto",
  "passos_reproducao": ["Passo 1...", "Passo 2...", "Passo 3..."],
  "resultado_esperado": "O que deveria acontecer",
  "resultado_obtido": "O que realmente aconteceu (baseado na descrição do testador)",
  "severidade": "Crítica | Alta | Média | Baixa",
  "impacto": "Descrição do impacto para o usuário final e para o negócio",
  "ambiente_sugerido": "Ambiente provável onde o bug foi encontrado (ex: Staging, QA, Production)",
  "workaround": "Se possível, sugira uma forma do usuário contornar o problema até a correção"
}

REGRAS:
1. O título deve ser técnico e seguir o padrão "[Módulo] - Ação - Problema".
2. Os passos de reprodução devem ser detalhados e auto-suficientes.
3. A severidade deve ser realista baseada no impacto descrito.
4. O resultado_obtido deve ser inferido a partir da descrição do testador.
5. O workaround é opcional - só inclua se for possível inferir um.`;

            const data = await callGeminiWithCache<BugReport>(
                'bug_report',
                `${testCase.id}:${bugDescription}`,
                prompt,
                { jsonMode: true }
            );

            setReport(data);
            onApplyReport?.(data);

            toast({ title: 'Bug Report gerado!', description: 'Relatório estruturado criado pela IA.' });
        } catch (error: any) {
            console.error('Bug report generation error:', error);
            toast({ title: 'Erro ao gerar relatório', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const formatReportAsText = (): string => {
        if (!report) return '';
        return `# Bug Report

## ${report.titulo_bug}

**Severidade:** ${report.severidade}
**Ambiente:** ${report.ambiente_sugerido}

### Descrição
${report.descricao}

### Passos para Reprodução
${report.passos_reproducao.map((p, i) => `${i + 1}. ${p}`).join('\n')}

### Resultado Esperado
${report.resultado_esperado}

### Resultado Obtido
${report.resultado_obtido}

### Impacto
${report.impacto}
${report.workaround ? `\n### Workaround\n${report.workaround}` : ''}`;
    };

    const copyReport = () => {
        navigator.clipboard.writeText(formatReportAsText());
        setCopied(true);
        toast({ title: 'Copiado!', description: 'Bug report copiado para a área de transferência.' });
        setTimeout(() => setCopied(false), 2000);
    };

    const getSeverityColor = (sev: string) => {
        switch (sev) {
            case 'Crítica': return 'bg-red-600 text-white';
            case 'Alta': return 'bg-orange-500 text-white';
            case 'Média': return 'bg-amber-500 text-white';
            case 'Baixa': return 'bg-blue-500 text-white';
            default: return 'bg-slate-500 text-white';
        }
    };

    if (!report) {
        return (
            <div className="mt-3 p-3 rounded-lg border border-dashed border-purple-500/30 bg-purple-500/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-purple-300">Gerar Bug Report com IA</span>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateReport}
                        disabled={loading || !bugDescription.trim()}
                        className="h-7 gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {loading ? 'Gerando...' : 'Gerar Relatório'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-3 space-y-3 animate-fade-in">
            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-bold text-purple-300">Bug Report Gerado</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={copyReport}
                            className="h-7 gap-1.5 text-slate-400 hover:text-white"
                        >
                            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            <span className="text-xs">{copied ? 'Copiado' : 'Copiar'}</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={generateReport}
                            disabled={loading}
                            className="h-7 gap-1.5 text-slate-400 hover:text-white"
                        >
                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            <span className="text-xs">Regenerar</span>
                        </Button>
                    </div>
                </div>

                <ScrollArea className="max-h-[300px]">
                    <div className="space-y-3">
                        <div>
                            <h4 className="text-base font-bold text-slate-200">{report.titulo_bug}</h4>
                            <div className="flex gap-2 mt-1.5">
                                <Badge className={getSeverityColor(report.severidade)}>{report.severidade}</Badge>
                                <Badge variant="outline" className="text-[10px] text-slate-400">{report.ambiente_sugerido}</Badge>
                            </div>
                        </div>

                        <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Descrição</span>
                            <p className="text-sm text-slate-300 mt-1">{report.descricao}</p>
                        </div>

                        <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Passos para Reprodução</span>
                            <ol className="list-decimal list-inside text-sm text-slate-300 mt-1 space-y-0.5">
                                {report.passos_reproducao.map((p, i) => <li key={i}>{p}</li>)}
                            </ol>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Resultado Esperado</span>
                                <p className="text-sm text-emerald-400/80 mt-1">{report.resultado_esperado}</p>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Resultado Obtido</span>
                                <p className="text-sm text-red-400/80 mt-1">{report.resultado_obtido}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Impacto</span>
                            <p className="text-sm text-slate-400 mt-1">{report.impacto}</p>
                        </div>

                        {report.workaround && (
                            <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Workaround</span>
                                <p className="text-sm text-blue-400/80 mt-1">{report.workaround}</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
