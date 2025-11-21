import React, { useState, useEffect, useRef } from 'react';
import { 
  PaperAirplaneIcon, 
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { db } from '../../data/database';
import { geminiService } from '../../services/geminiService';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'مرحباً! أنا المساعد الذكي القانوني المدعوم بتقنية Gemini AI من Google. يمكنني مساعدتك في:\n\n📊 تحليل البيانات والإحصائيات\n🔍 البحث في العملاء والقضايا\n💡 تقديم نصائح لتحسين الأداء\n⚖️ الإجابة على الاستفسارات القانونية العامة\n📈 إعداد التقارير والتحليلات\n\nكيف يمكنني مساعدتك اليوم؟',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // فحص الاتصال مع Gemini API
    const checkInitialConnection = async () => {
      setConnectionStatus('checking');
      
      // التحقق من وجود مفتاح API
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'demo-key') {
        console.warn('Gemini API key not configured');
        setConnectionStatus('disconnected');
        return;
      }
      
      // فحص الاتصال الفعلي
      const isConnected = await geminiService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      
      if (isConnected) {
        console.log('✅ Gemini AI connected successfully');
      } else {
        console.log('❌ Gemini AI connection failed, using local mode');
      }
    };
    
    checkInitialConnection();
  }, []);

  useEffect(() => {
    // التمرير إلى آخر رسالة
    scrollToBottom();
  }, [messages]);

  const checkConnection = async () => {
    setConnectionStatus('checking');
    
    try {
      const isConnected = await geminiService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      
      if (isConnected) {
        // إضافة رسالة تأكيد الاتصال
        const confirmationMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: '✅ تم الاتصال بـ Gemini AI بنجاح! يمكنني الآن تقديم إجابات أكثر ذكاءً وتفصيلاً.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, confirmationMessage]);
      } else {
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: '⚠️ لا يمكن الاتصال بـ Gemini AI حالياً. سأعمل في الوضع المحلي وأقدم إجابات بناءً على بيانات النظام.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Connection check error:', error);
      setConnectionStatus('disconnected');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // إرسال الرسالة إلى Gemini
      console.log('Sending message to Gemini AI...');
      const aiResponse = await geminiService.sendMessage(inputMessage);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      console.log('Response received from AI');
    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.',
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        type: 'assistant',
        content: 'تم مسح المحادثة. كيف يمكنني مساعدتك؟',
        timestamp: new Date()
      }
    ]);
  };

  const quickQuestions = [
    'أعطني تقرير شامل عن أداء المكتب',
    'كم عدد العملاء والقضايا الحالية؟',
    'ما هو معدل نجاح القضايا؟',
    'اقترح طرق لزيادة العملاء المحتملين',
    'كيف يمكن تحسين معدل التحويل؟',
    'ما هي أفضل استراتيجيات إدارة القضايا؟'
  ];

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'checking':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />;
      case 'connected':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'disconnected':
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'checking':
        return 'فحص الاتصال...';
      case 'connected':
        return 'متصل - Gemini AI';
      case 'disconnected':
        return 'وضع محلي';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">المساعد الذكي القانوني</h1>
              <p className="text-blue-100">مدعوم بتقنية Gemini AI من Google</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white bg-opacity-20 rounded-lg px-3 py-2">
            {getConnectionStatusIcon()}
            <span className="text-sm">{getConnectionStatusText()}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => setInputMessage(question)}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 text-right transition-all text-sm"
              disabled={isTyping}
            >
              <p>{question}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">المحادثة</h3>
          <button
            onClick={clearChat}
            className="text-slate-500 hover:text-slate-700 text-sm"
            disabled={isTyping}
          >
            مسح المحادثة
          </button>
        </div>
        
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 ${
                  message.type === 'user' ? 'bg-blue-500' : 
                  message.isError ? 'bg-red-500' : 'bg-purple-500'
                } rounded-full p-2`}>
                  {message.type === 'user' ? (
                    <UserIcon className="h-5 w-5 text-white" />
                  ) : message.isError ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-white" />
                  ) : (
                    <SparklesIcon className="h-5 w-5 text-white" />
                  )}
                </div>
                <div className={`rounded-lg p-3 ${
                  message.type === 'user' 
                    ? 'bg-blue-50 text-blue-900' 
                    : message.isError
                    ? 'bg-red-50 text-red-900'
                    : 'bg-slate-50 text-slate-900'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {message.timestamp.toLocaleTimeString('ar-SA')}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="flex gap-3 max-w-3xl">
                <div className="flex-shrink-0 bg-purple-500 rounded-full p-2">
                  <SparklesIcon className="h-5 w-5 text-white" />
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                    <span className="text-sm text-slate-500">Gemini يفكر...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="border-t border-slate-200 p-4">
          <div className="flex gap-2">
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-2 rounded-lg transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="اكتب سؤالك هنا... (اضغط Enter للإرسال)"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              disabled={isTyping}
              rows={2}
            />
            <button
              onClick={checkConnection}
              disabled={isTyping}
              className="flex-shrink-0 text-slate-500 hover:text-slate-700 p-2"
              title="فحص الاتصال"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">ميزات المساعد الذكي:</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <ul className="space-y-1">
            <li>• إجابات ذكية مدعومة بـ Gemini AI</li>
            <li>• تحليل البيانات والإحصائيات</li>
            <li>• البحث المتقدم في العملاء والقضايا</li>
            <li>• نصائح قانونية عامة</li>
          </ul>
          <ul className="space-y-1">
            <li>• تقارير مخصصة وتحليلات</li>
            <li>• مساعدة في إدارة المكتب</li>
            <li>• إجابات سياقية ومفصلة</li>
            <li>• دعم اللغة العربية الكامل</li>
          </ul>
        </div>
        
        {connectionStatus === 'disconnected' && (
          <div className="mt-3 p-3 bg-yellow-100 rounded-lg">
            <p className="text-yellow-800 text-sm">
              <strong>ملاحظة:</strong> المساعد يعمل حالياً في الوضع المحلي. للحصول على إجابات أكثر ذكاءً من Gemini AI، تأكد من:
              <br />• صحة مفتاح API في ملف .env
              <br />• الاتصال بالإنترنت
              <br />• عدم تجاوز حدود الاستخدام
            </p>
          </div>
        )}
        
        {connectionStatus === 'connected' && (
          <div className="mt-3 p-3 bg-green-100 rounded-lg">
            <p className="text-green-800 text-sm">
              <strong>✅ متصل بـ Gemini AI:</strong> المساعد جاهز لتقديم إجابات ذكية ومتقدمة بناءً على بيانات مكتبك وخبرة الذكاء الاصطناعي.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}