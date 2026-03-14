import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestCase, TestRun } from '@/types';
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
import { CheckCircle2, XCircle, Slash, MinusCircle, ChevronLeft, ChevronRight, Upload, X, ImageIcon, VideoIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AIBugReport } from '@/components/ai/AIBugReport';

interface TestRunDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    suiteId: string;
    suiteName: string;
    testRunId?: string; // Add optional testRunId for resume
    onSuccess: () => void;
}

interface RunState {
    id?: string;
    test_case_id: string;
    status: 'passed' | 'failed' | 'blocked' | 'not_executed';
    notes: string;
    bug_description: string;
    files: { file: File; preview: string; type: 'image' | 'video' }[];
}

export function TestRunDialog({
    open,
    onOpenChange,
    projectId,
    suiteId,
    suiteName,
    testRunId, // Added here
    onSuccess,
}: TestRunDialogProps) {
    const [step, setStep] = useState<'setup' | 'executing'>('setup');
    const [runName, setRunName] = useState(`Execução - ${suiteName}`);
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
    const [executions, setExecutions] = useState<Record<string, RunState>>({});
    const [testRun, setTestRun] = useState<TestRun | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Use refs to handle cleanup logic with latest state
    const stateRef = useRef({ testRun, currentCaseIndex, step, executions, testCases });
    useEffect(() => {
        stateRef.current = { testRun, currentCaseIndex, step, executions, testCases };
    }, [testRun, currentCaseIndex, step, executions, testCases]);

    // Auto-pause when closing dialog or leaving page
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (stateRef.current.step === 'executing' && stateRef.current.testRun) {
                handlePauseRun(true);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Auto-pause on component unmount (if still executing)
            if (stateRef.current.step === 'executing' && stateRef.current.testRun) {
                handlePauseRun(true);
            }
        };
    }, []);
    const saveExecutions = async () => {
        const { testRun: targetRun, testCases: targetCases, executions: targetExecs } = stateRef.current;
        if (!targetRun) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        for (const tc of targetCases) {
            const exec = targetExecs[tc.id];
            if (!exec) continue;
            
            if (exec.id) {
                 await supabase.from('test_executions').update({
                    status: exec.status,
                    notes: exec.notes || null,
                    bug_description: exec.status === 'failed' ? exec.bug_description : null,
                    executed_by: user.id,
                }).eq('id', exec.id);
                
                if (exec.files.length > 0) {
                    await uploadEvidences(exec.id, exec.files);
                }
            } else {
                 const { data: inserted, error } = await supabase.from('test_executions').insert({
                    test_case_id: tc.id,
                    test_run_id: targetRun.id,
                    status: exec.status,
                    notes: exec.notes || null,
                    bug_description: exec.status === 'failed' ? exec.bug_description : null,
                    executed_by: user.id,
                }).select().single();

                if (!error && inserted && exec.files.length > 0) {
                    await uploadEvidences(inserted.id, exec.files);
                }
            }

            // Sync test case status
            if (exec.status === 'failed' || exec.status === 'passed') {
                await supabase.from('test_cases').update({ status: exec.status }).eq('id', tc.id);
            }
        }
    };

    const handlePauseRun = async (silent = false) => {
        const { testRun: targetRun, currentCaseIndex: targetIndex } = stateRef.current;
        
        if (!targetRun || targetRun.status === 'paused' || targetRun.status === 'passed' || targetRun.status === 'failed') return;
        
        if (!silent) setLoading(true);
        
        await supabase.from('test_runs').update({
            status: 'paused',
            current_step_index: targetIndex,
            updated_at: new Date().toISOString()
        }).eq('id', targetRun.id);

        await saveExecutions();

        if (!silent) {
            toast({ title: 'Execução Pausada', description: `Sua progressão foi salva. Você pode continuar depois.` });
            setLoading(false);
            onSuccess();
            onOpenChange(false);
        }
    };

    useEffect(() => {
        // Auto-pause when 'open' becomes false
        if (!open && stateRef.current.step === 'executing' && stateRef.current.testRun) {
            handlePauseRun(true);
        }
    }, [open]);

    useEffect(() => {
        if (open && (suiteId || testRunId)) {
            if (testRunId) {
                setStep('executing');
            } else {
                setStep('setup');
                setRunName(`Execução - ${suiteName}`);
            }
            setCurrentCaseIndex(0);
            setExecutions({});
            setTestRun(null);
            fetchTestCases();
        }
    }, [open, suiteId, suiteName, testRunId]);

    const fetchTestCases = async () => {
        if (testRunId) {
            // Context of Resuming
            const { data: runInfo } = await supabase.from('test_runs').select('*').eq('id', testRunId).single();
            if (runInfo) {
                setTestRun(runInfo as TestRun);
                setRunName(runInfo.name);
            }

            const { data: allExecs } = await supabase.from('test_executions')
                .select('*')
                .eq('test_run_id', testRunId);
            
            if (allExecs && allExecs.length > 0) {
                const caseIds = allExecs.map(e => e.test_case_id);
                const { data: casesData } = await supabase.from('test_cases')
                    .select('*')
                    .in('id', caseIds)
                    .order('case_number', { ascending: true });
                
                if (casesData) {
                    setTestCases(casesData as unknown as TestCase[]);
                    const initExecs: Record<string, RunState> = {};
                    casesData.forEach(tc => {
                        const exec = allExecs.find(e => e.test_case_id === tc.id);
                        initExecs[tc.id] = {
                            id: exec?.id,
                            test_case_id: tc.id,
                            status: (exec?.status as RunState['status']) || 'not_executed',
                            notes: exec?.notes || '',
                            bug_description: exec?.bug_description || '',
                            files: []
                        };
                    });
                    setExecutions(initExecs);
                    // Resume from the last saved index
                    setCurrentCaseIndex((runInfo as any).current_step_index || 0);
                }
            } else {
                 setTestCases([]);
            }
        } else {
            // New Test Run
            const { data } = await supabase
                .from('test_cases')
                .select('*')
                .eq('suite_id', suiteId)
                .order('case_number', { ascending: true });

            if (data) {
                setTestCases(data as unknown as TestCase[]);
                const initExecs: Record<string, RunState> = {};
                data.forEach(tc => {
                    initExecs[tc.id] = {
                        test_case_id: tc.id,
                        status: 'not_executed',
                        notes: '',
                        bug_description: '',
                        files: []
                    };
                });
                setExecutions(initExecs);
            }
        }
    };

    const handleStartRun = async () => {
        if (testCases.length === 0) {
            toast({ title: 'Suíte vazia', description: 'Adicione casos de teste à suíte antes de executar.', variant: 'destructive' });
            return;
        }
        if (!runName.trim()) {
            toast({ title: 'Nome obrigatório', variant: 'destructive' });
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }

        const { data: runData, error: runError } = await supabase
            .from('test_runs')
            .insert({
                project_id: projectId,
                suite_id: suiteId,
                name: runName,
                status: 'running',
                executed_by: user.id,
                started_at: new Date().toISOString()
            })
            .select().single();

        if (runError) {
            toast({ title: 'Erro ao criar execução', description: runError.message, variant: 'destructive' });
            setLoading(false);
            return;
        }

        const runRecord = runData as TestRun;
        
        // Pre-create missing executions as not_executed
        const execsToInsert = testCases.map(tc => ({
            test_case_id: tc.id,
            test_run_id: runRecord.id,
            status: 'not_executed',
            executed_by: user.id
        }));
        
        const { data: insertedExecs } = await supabase.from('test_executions').insert(execsToInsert).select();
        
        // Update local map with generated IDs
        if (insertedExecs) {
            const updatedExecs = { ...executions };
            insertedExecs.forEach(ine => {
                if (updatedExecs[ine.test_case_id]) {
                    updatedExecs[ine.test_case_id].id = ine.id;
                }
            });
            setExecutions(updatedExecs);
        }

        setTestRun(runRecord);
        setStep('executing');
        setLoading(false);
    };

    const saveCurrentProgress = async (index: number) => {
        if (!testRun) return;
        await supabase.from('test_runs').update({
            current_step_index: index,
            updated_at: new Date().toISOString()
        }).eq('id', testRun.id);
    };

    const currentCase = testCases[currentCaseIndex];
    const currentState = currentCase ? executions[currentCase.id] : null;

    const updateCurrentState = (updates: Partial<RunState>) => {
        if (!currentCase) return;
        setExecutions(prev => ({
            ...prev,
            [currentCase.id]: { ...prev[currentCase.id], ...updates }
        }));
    };

    const nextCase = async () => {
        if (currentCaseIndex < testCases.length - 1) {
            const nextIdx = currentCaseIndex + 1;
            setCurrentCaseIndex(nextIdx);
            await saveCurrentProgress(nextIdx);
            await saveExecutions();
        }
    };

    const prevCase = async () => {
        if (currentCaseIndex > 0) {
            const prevIdx = currentCaseIndex - 1;
            setCurrentCaseIndex(prevIdx);
            await saveCurrentProgress(prevIdx);
            await saveExecutions();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!currentState) return;
        const files = e.target.files;
        if (!files) return;

        const newFiles: RunState['files'] = [];
        for (const file of Array.from(files)) {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            if (!isImage && !isVideo) continue;
            newFiles.push({
                file,
                preview: URL.createObjectURL(file),
                type: isImage ? 'image' : 'video',
            });
        }
        updateCurrentState({ files: [...currentState.files, ...newFiles] });
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        if (!currentState) return;
        const updated = [...currentState.files];
        URL.revokeObjectURL(updated[index].preview);
        updated.splice(index, 1);
        updateCurrentState({ files: updated });
    };

    const uploadEvidences = async (executionId: string, files: RunState['files']) => {
        for (const sf of files) {
            const filePath = `${executionId}/${Date.now()}_${sf.file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('test-evidences')
                .upload(filePath, sf.file);

            if (uploadError) continue;

            const { data: urlData } = supabase.storage.from('test-evidences').getPublicUrl(filePath);

            await supabase.from('bug_evidences').insert({
                test_execution_id: executionId,
                file_url: urlData.publicUrl,
                file_type: sf.type,
                file_name: sf.file.name,
            });
        }
    };

    const handleFinishRun = async () => {
        if (!testRun) return;

        // Check if any mandatory fields are missing
        for (const tc of testCases) {
            const exec = executions[tc.id];
            if (exec.status === 'failed' && !exec.bug_description.trim()) {
                toast({ title: 'Atenção!', description: `A descrição do bug é obrigatória para testes que falharam (TC-${tc.case_number}).`, variant: 'destructive' });
                // Auto navigate to the failing case to show error
                setCurrentCaseIndex(testCases.findIndex(c => c.id === tc.id));
                return;
            }
        }

        setLoading(true);

        const allExecs = Object.values(executions);
        const hasFailed = allExecs.some(e => e.status === 'failed');
        let overallStatus = 'passed';
        if (hasFailed) overallStatus = 'failed';

        await supabase.from('test_runs').update({
            status: overallStatus,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).eq('id', testRun.id);

        await saveExecutions();

        toast({ title: 'Execução Finalizada!', description: `Status Geral: ${overallStatus === 'passed' ? 'Aprovado' : 'Reprovado'}` });
        setLoading(false);
        onSuccess();
        onOpenChange(false);
    };

    const getStatusBadge = (status: RunState['status']) => {
        switch (status) {
            case 'passed': return <Badge className="bg-success text-success-foreground">Passou</Badge>;
            case 'failed': return <Badge className="bg-destructive text-destructive-foreground">Falhou</Badge>;
            case 'blocked': return <Badge className="bg-amber-500 text-white">Bloqueado</Badge>;
            case 'not_executed': return <Badge variant="outline" className="text-muted-foreground">Não executado</Badge>;
        }
    }

    // Render Setup Dialog
    if (step === 'setup') {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Iniciar Execução de Suíte</DialogTitle>
                        <DialogDescription>
                            A suíte "{suiteName}" contém {testCases.length} casos de teste.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome da Execução</Label>
                            <Input
                                value={runName}
                                onChange={(e) => setRunName(e.target.value)}
                                placeholder="Ex: Regression V2.1"
                            />
                        </div>
                        {testCases.length === 0 && (
                            <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded">
                                Você não pode executar uma suíte vazia. Adicione casos de teste primeiro.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button onClick={handleStartRun} disabled={loading || testCases.length === 0}>
                            {loading ? 'Iniciando...' : 'Iniciar Execução'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Render Execution Workspace Dialog
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onPointerDownOutside={(e) => e.preventDefault()} className="max-w-5xl max-h-[95vh] h-[95vh] flex flex-col p-0 border-slate-800 bg-slate-950">

                <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">{runName}</h2>
                        <div className="text-sm text-slate-400 mt-1 flex gap-2 items-center">
                            <span>{currentCaseIndex + 1} de {testCases.length} Casos de Teste pendentes</span>
                            <span className="text-slate-600">•</span>
                            {getStatusBadge(currentState?.status || 'not_executed')}
                        </div>
                    </div>
                     <div className="flex gap-2">
                          <Button variant="outline" onClick={() => handlePauseRun()} disabled={loading} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700">
                              {loading ? 'Pausando...' : 'Pausar'}
                          </Button>
                         <Button variant="outline" onClick={handleFinishRun} disabled={loading} className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/50">
                             {loading ? 'Finalizando...' : 'Finalizar Execução'}
                         </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {currentCase ? (
                            <>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-semibold text-slate-100"><span className="text-slate-500 mr-2 text-xl font-mono">TC-{currentCase.case_number}</span>{currentCase.title}</h3>
                                     <div className="flex gap-2 text-sm text-slate-400">
                                        {currentCase.priority === 'high' && <Badge variant="outline" className="border-red-500/30 text-red-400">Alta Prioridade</Badge>}
                                        {currentCase.automation_status === 'automated' && <Badge variant="outline" className="border-blue-500/30 text-blue-400">Automatizado</Badge>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {currentCase.pre_conditions && (
                                        <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                                            <h4 className="text-sm font-semibold text-slate-300 mb-2">Pré-condições</h4>
                                            <p className="text-sm text-slate-400 whitespace-pre-wrap">{currentCase.pre_conditions}</p>
                                        </div>
                                    )}
                                    {currentCase.data_setup && (
                                        <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                                            <h4 className="text-sm font-semibold text-slate-300 mb-2">Massa de Dados</h4>
                                            <p className="text-sm text-slate-400 whitespace-pre-wrap font-mono">{currentCase.data_setup}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    {currentCase.steps && (
                                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                                            <h4 className="text-base font-semibold text-slate-200 mb-3">Passos</h4>
                                            <div className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
                                                {currentCase.steps}
                                            </div>
                                        </div>
                                    )}
                                    {currentCase.expected_result && (
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
                                            <h4 className="text-base font-semibold text-slate-200 mb-2">Resultado Esperado</h4>
                                            <p className="text-sm text-emerald-400/90 whitespace-pre-wrap">{currentCase.expected_result}</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div>Nenhum caso de teste encontrado.</div>
                        )}
                    </div>

                    {/* Sidebar / Executor Area */}
                    <div className="w-full lg:w-[400px] border-l border-slate-800 bg-slate-900/30 flex flex-col">
                        <ScrollArea className="flex-1 p-5">
                            {currentState && (
                                <div className="space-y-6">

                                    <div className="space-y-3">
                                        <Label className="text-slate-300 font-semibold">Resultado</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                type="button"
                                                variant={currentState.status === 'passed' ? 'default' : 'outline'}
                                                className={currentState.status === 'passed' ? 'bg-success hover:bg-success/90 text-success-foreground' : 'border-slate-700 bg-slate-900 text-slate-300'}
                                                onClick={() => updateCurrentState({ status: 'passed' })}
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> Passou
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={currentState.status === 'failed' ? 'default' : 'outline'}
                                                className={currentState.status === 'failed' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'border-slate-700 bg-slate-900 text-slate-300'}
                                                onClick={() => updateCurrentState({ status: 'failed' })}
                                            >
                                                <XCircle className="w-4 h-4 mr-2" /> Falhou
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={currentState.status === 'blocked' ? 'default' : 'outline'}
                                                className={currentState.status === 'blocked' ? 'bg-amber-600 hover:bg-amber-600/90 text-white' : 'border-slate-700 bg-slate-900 text-slate-300'}
                                                onClick={() => updateCurrentState({ status: 'blocked' })}
                                            >
                                                <Slash className="w-4 h-4 mr-2" /> Bloqueado
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={currentState.status === 'not_executed' ? 'secondary' : 'outline'}
                                                className={currentState.status === 'not_executed' ? 'bg-slate-800 text-slate-300' : 'border-slate-700 bg-slate-900 text-slate-300'}
                                                onClick={() => updateCurrentState({ status: 'not_executed' })}
                                            >
                                                <MinusCircle className="w-4 h-4 mr-2" /> Pular
                                            </Button>
                                        </div>
                                    </div>

                                    {currentState.status === 'failed' && (
                                        <div className="space-y-2 animate-fade-in">
                                            <Label htmlFor="bug_desc" className="text-red-400 font-semibold">Descrição do Bug *</Label>
                                            <Textarea
                                                id="bug_desc"
                                                rows={4}
                                                className="bg-slate-950 border-red-500/30 focus:border-red-500/70 focus:ring-red-500/20"
                                                placeholder="Descreva o que ocorreu..."
                                                value={currentState.bug_description}
                                                onChange={(e) => updateCurrentState({ bug_description: e.target.value })}
                                            />

                                            {/* AI Bug Report */}
                                            {currentCase && (
                                                <AIBugReport
                                                    testCase={currentCase}
                                                    bugDescription={currentState.bug_description}
                                                    notes={currentState.notes}
                                                    onApplyReport={(report) => {
                                                        // Enrich the bug description with the AI report
                                                        const enriched = `${currentState.bug_description}\n\n--- Bug Report (IA) ---\nTítulo: ${report.titulo_bug}\nSeveridade: ${report.severidade}\nResultado Obtido: ${report.resultado_obtido}\nImpacto: ${report.impacto}`;
                                                        updateCurrentState({ bug_description: enriched });
                                                    }}
                                                />
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="notes" className="text-slate-400">Observações (opcional)</Label>
                                        <Textarea
                                            id="notes"
                                            rows={2}
                                            className="bg-slate-950 border-slate-800 focus:border-slate-600"
                                            placeholder="Alguma nota de execução..."
                                            value={currentState.notes}
                                            onChange={(e) => updateCurrentState({ notes: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-slate-400">Evidências (Opcional)</Label>
                                        <label className="cursor-pointer block">
                                            <Input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
                                            <div className="flex items-center justify-center w-full p-3 border border-dashed border-slate-700 rounded-lg hover:border-slate-500 bg-slate-900/50 hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-300 text-sm">
                                                <Upload className="w-4 h-4 mr-2" /> Anexar arquivos
                                            </div>
                                        </label>
                                        {currentState.files.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-3">
                                                {currentState.files.map((sf, i) => (
                                                    <div key={i} className="relative group border border-slate-700 rounded-lg overflow-hidden bg-slate-900">
                                                        {sf.type === 'image' ? (
                                                            <img src={sf.preview} alt={sf.file.name} className="w-full h-16 object-cover" />
                                                        ) : (
                                                            <div className="w-full h-16 flex items-center justify-center"><VideoIcon className="w-6 h-6 text-slate-500" /></div>
                                                        )}
                                                        <button type="button" className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeFile(i)}>
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                        <div className="text-[10px] px-1.5 py-1 truncate text-slate-400 bg-slate-900/90">{sf.file.name}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}
                        </ScrollArea>

                        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
                            <Button variant="ghost" disabled={currentCaseIndex === 0} onClick={prevCase} className="text-slate-300">
                                <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
                            </Button>
                            <Button variant="ghost" disabled={currentCaseIndex === testCases.length - 1} onClick={nextCase} className="text-slate-300">
                                Próximo <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}
