import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  FileSpreadsheet,
  Table2,
  BarChart3,
  FileText,
  CheckCircle2,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { AnalysisReport, ChatMessage } from '../../../lib/dataAnalysis/types';
import { sendSmartAnalysisMessage, generateDataSummary, type SmartAnalysisState } from '../../../lib/dataAnalysis/smartAnalyzer';

interface SmartAnalysisChatProps {
  report: AnalysisReport;
  onAnalysisComplete: (customPrompt: string, analysisType: string) => void;
  onBack: () => void;
}

const ANALYSIS_SUGGESTIONS = [
  {
    id: 'full',
    icon: Sparkles,
    title: 'تحليل شامل فوري',
    description: 'ابدأ التحليل الكامل مباشرة بدون أسئلة',
    prompt: 'أريد تحليل شامل واحترافي لجميع البيانات مع ملخص تنفيذي ونسب مئوية ورسوم بيانية وتوصيات',
    instant: true,
  },
  {
    id: 'achievements',
    icon: CheckCircle2,
    title: 'تحليل الإنجازات والنجاح',
    description: 'حلل نسب النجاح والفشل وقارن بين الفئات',
    prompt: 'أريد تحليل نسب النجاح والفشل في البيانات، مع مقارنة بين الفئات المختلفة وتحديد نقاط القوة والضعف',
    instant: true,
  },
  {
    id: 'comparison',
    icon: BarChart3,
    title: 'مقارنات وتوزيعات',
    description: 'قارن بين المناطق أو الفئات المختلفة',
    prompt: 'أريد مقارنة شاملة بين الفئات والمناطق المختلفة في البيانات مع رسوم بيانية توضيحية',
    instant: true,
  },
  {
    id: 'quality',
    icon: Table2,
    title: 'جودة البيانات والمشاكل',
    description: 'اكتشف المشاكل والتعارضات في البيانات',
    prompt: 'أريد تحليل جودة البيانات واكتشاف المشاكل والتعارضات والقيم الناقصة مع توصيات للحل',
    instant: true,
  },
];

export default function SmartAnalysisChat({
  report,
  onAnalysisComplete,
  onBack,
}: SmartAnalysisChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisState, setAnalysisState] = useState<SmartAnalysisState>({
    stage: 'initial',
    clarifications: [],
    userRequirements: '',
  });
  const [isReadyToAnalyze, setIsReadyToAnalyze] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const initChat = async () => {
      setIsLoading(true);
      const summary = await generateDataSummary(report);
      
      const welcomeMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: summary,
        timestamp: new Date().toISOString(),
      };
      
      setMessages([welcomeMessage]);
      setIsLoading(false);
      inputRef.current?.focus();
    };

    initChat();
  }, [report]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    const newUserMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const { response, newState, readyToAnalyze, finalPrompt: prompt } = await sendSmartAnalysisMessage(
        userMessage,
        report,
        [...messages, newUserMessage],
        analysisState
      );

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setAnalysisState(newState);
      
      if (readyToAnalyze && prompt) {
        setIsReadyToAnalyze(true);
        setFinalPrompt(prompt);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, report, analysisState]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: typeof ANALYSIS_SUGGESTIONS[0]) => {
    if (suggestion.instant && suggestion.prompt) {
      setIsReadyToAnalyze(true);
      setFinalPrompt(suggestion.prompt);
      setAnalysisState({
        ...analysisState,
        stage: 'ready',
        userRequirements: suggestion.prompt,
        analysisType: suggestion.id,
      });
    } else if (suggestion.prompt) {
      setInput(suggestion.prompt);
      inputRef.current?.focus();
    }
  };

  const handleStartAnalysis = () => {
    onAnalysisComplete(finalPrompt, analysisState.analysisType || 'custom');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-600 to-cyan-600 p-4 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h3 className="font-bold text-lg">محادثة التحليل الذكي</h3>
            <p className="text-sm text-white/80">{report.summary.fileName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-sm">
          <FileSpreadsheet className="h-4 w-4" />
          <span>{report.summary.rowCount.toLocaleString('ar-IQ')} سجل</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">جاري التفكير...</span>
          </div>
        )}

        {/* Analysis Ready */}
        {isReadyToAnalyze && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border border-emerald-200 dark:border-emerald-800 p-6 text-center"
          >
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-3" />
            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
              جاهز لإنشاء التحليل
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              فهمت ما تريده. اضغط الزر أدناه لبدء إنشاء التقرير المخصص.
            </p>
            <button
              onClick={handleStartAnalysis}
              className="flex items-center justify-center gap-2 mx-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold hover:opacity-90 transition-opacity"
            >
              <Sparkles className="h-5 w-5" />
              إنشاء التحليل المخصص
            </button>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && !isLoading && !isReadyToAnalyze && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-4">
          <p className="text-sm text-slate-500 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            اختر نوع التحليل للبدء فوراً:
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {ANALYSIS_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-right transition-all group",
                  suggestion.id === 'full'
                    ? "border-purple-300 dark:border-purple-600 bg-gradient-to-r from-purple-50 to-cyan-50 dark:from-purple-900/20 dark:to-cyan-900/20 hover:border-purple-500"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                )}
              >
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  suggestion.id === 'full'
                    ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white"
                    : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50"
                )}>
                  <suggestion.icon className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    {suggestion.title}
                    {suggestion.id === 'full' && (
                      <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">مستحسن</span>
                    )}
                  </h5>
                  <p className="text-xs text-slate-500">{suggestion.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {!isReadyToAnalyze && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب ما تريد تحليله... مثلاً: حلل لي نسب النجاح حسب المنطقة"
                rows={1}
                className={cn(
                  'w-full resize-none rounded-xl border border-slate-200 dark:border-slate-600',
                  'bg-slate-50 dark:bg-slate-700 px-4 py-3 pr-4',
                  'text-slate-900 dark:text-white placeholder:text-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                  'max-h-32'
                )}
                style={{
                  height: 'auto',
                  minHeight: '48px',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                input.trim() && !isLoading
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-400 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            اكتب بحرية ما تريد تحليله • سأسألك أسئلة توضيحية إذا احتجت
          </p>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          isUser
            ? 'bg-purple-100 dark:bg-purple-900/30'
            : 'bg-gradient-to-br from-cyan-100 to-purple-100 dark:from-cyan-900/30 dark:to-purple-900/30'
        )}
      >
        {isUser ? (
          <User className="h-5 w-5 text-purple-600" />
        ) : (
          <Bot className="h-5 w-5 text-cyan-600" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-purple-600 text-white rounded-br-none'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-none'
        )}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p
          className={cn(
            'text-xs mt-2',
            isUser ? 'text-purple-200' : 'text-slate-400'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('ar-IQ', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  );
}
