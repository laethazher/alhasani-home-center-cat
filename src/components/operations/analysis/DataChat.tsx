import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  X,
  Loader2,
  Bot,
  User,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { AnalysisReport, ChatSession, ChatMessage, ChatContext } from '../../../lib/dataAnalysis/types';
import {
  sendChatMessage,
  createChatSession,
  createChatContext,
  addMessageToSession,
  SUGGESTED_QUESTIONS,
} from '../../../lib/dataAnalysis/dataChat';

interface DataChatProps {
  report: AnalysisReport;
  isOpen: boolean;
  onClose: () => void;
}

export default function DataChat({ report, isOpen, onClose }: DataChatProps) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [context, setContext] = useState<ChatContext | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && !session) {
      setSession(createChatSession(report));
      setContext(createChatContext(report));
    }
  }, [isOpen, report, session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !session || !context || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setShowSuggestions(false);
    setIsLoading(true);

    const updatedSession = addMessageToSession(session, 'user', userMessage);
    setSession(updatedSession);

    try {
      const response = await sendChatMessage(userMessage, context, updatedSession.messages);
      setSession((prev) => (prev ? addMessageToSession(prev, 'assistant', response) : prev));
    } catch (error) {
      console.error('Chat error:', error);
      setSession((prev) =>
        prev
          ? addMessageToSession(prev, 'assistant', 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.')
          : prev
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, session, context, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute left-0 top-0 bottom-0 w-full max-w-lg bg-white dark:bg-slate-800 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">محادثة البيانات</h3>
                <p className="text-xs text-slate-500">{report.summary.fileName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {session?.messages
              .filter((m) => m.role !== 'system')
              .map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

            {/* Welcome message if no user messages yet */}
            {session?.messages.filter((m) => m.role === 'user').length === 0 && (
              <div className="text-center py-8">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 mb-4">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
                  مرحباً بك في محادثة البيانات
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  اسألني أي سؤال عن ملف "{report.summary.fileName}" وسأساعدك في تحليله
                </p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">جاري الكتابة...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && (
            <div className="px-4 pb-2">
              <button
                onClick={() => setShowSuggestions(false)}
                className="flex items-center gap-1 text-xs text-slate-500 mb-2"
              >
                <ChevronDown className="h-3 w-3" />
                اقتراحات
              </button>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.slice(0, 4).map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(question)}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب سؤالك هنا..."
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
              اضغط Enter للإرسال • Shift+Enter لسطر جديد
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-cyan-100 dark:bg-cyan-900/30'
            : 'bg-purple-100 dark:bg-purple-900/30'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-cyan-600" />
        ) : (
          <Bot className="h-4 w-4 text-purple-600" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-cyan-600 text-white rounded-br-none'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-none'
        )}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-cyan-200' : 'text-slate-400'
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

interface FloatingChatButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export function FloatingChatButton({ onClick, hasUnread }: FloatingChatButtonProps) {
  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-700 transition-colors"
    >
      <MessageSquare className="h-6 w-6" />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
          !
        </span>
      )}
    </motion.button>
  );
}
