import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../lib/supabase';

// مفتاح API من متغيرات البيئة
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      if (!API_KEY || API_KEY === 'demo-key') {
        console.warn('Gemini API key not found or using demo key');
        this.isInitialized = false;
        return;
      }

      this.genAI = new GoogleGenerativeAI(API_KEY);
      this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });
      this.isInitialized = true;
      console.log('Gemini AI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini AI:', error);
      this.isInitialized = false;
    }
  }

  // إنشاء السياق للمساعد الذكي من قاعدة بيانات Supabase
  private async createContext(): Promise<string> {
    try {
      // جلب البيانات من Supabase
      const [
        { data: clients, error: clientsError },
        { data: prospects, error: prospectsError },
        { data: cases, error: casesError },
        { data: marketers, error: marketersError },
        { data: activities, error: activitiesError },
        { data: commissionPayments, error: commissionsError }
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('cases').select('*'),
        supabase.from('marketers').select('*'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('commission_payments').select('*')
      ]);

      // التحقق من الأخطاء
      if (clientsError) console.error('Error fetching clients:', clientsError);
      if (prospectsError) console.error('Error fetching prospects:', prospectsError);
      if (casesError) console.error('Error fetching cases:', casesError);
      if (marketersError) console.error('Error fetching marketers:', marketersError);
      if (activitiesError) console.error('Error fetching activities:', activitiesError);
      if (commissionsError) console.error('Error fetching commissions:', commissionsError);

      // استخدام البيانات المتاحة أو قيم افتراضية
      const clientsData = clients || [];
      const prospectsData = prospects || [];
      const casesData = cases || [];
      const marketersData = marketers || [];
      const activitiesData = activities || [];
      const commissionsData = commissionPayments || [];

      // حساب الإحصائيات
      const totalClients = clientsData.length;
      const totalProspects = prospectsData.length;
      const totalCases = casesData.length;
      const totalMarketers = marketersData.length;

      // إحصائيات القضايا
      const pendingCases = casesData.filter(c => c.status === 'pending').length;
      const inProgressCases = casesData.filter(c => c.status === 'in-progress').length;
      const completedCases = casesData.filter(c => c.status === 'completed').length;
      const postponedCases = casesData.filter(c => c.status === 'postponed').length;

      // حساب معدل النجاح
      const wonCases = casesData.filter(c => c.outcome === 'won').length;
      const winRate = completedCases > 0 ? Math.round((wonCases / completedCases) * 100) : 0;

      // حساب معدل التحويل
      const conversionRate = (totalClients + totalProspects) > 0 ? 
        Math.round((totalClients / (totalClients + totalProspects)) * 100) : 0;

      // توزيع العملاء حسب النوع
      const individualClients = clientsData.filter(c => c.client_type === 'individual').length;
      const companyClients = clientsData.filter(c => c.client_type === 'company').length;
      const associationClients = clientsData.filter(c => c.client_type === 'association').length;
      const governmentClients = clientsData.filter(c => c.client_type === 'government').length;

      // توزيع العملاء المحتملين حسب الحالة
      const interestedProspects = prospectsData.filter(p => p.prospect_status === 'مهتم').length;
      const contactedProspects = prospectsData.filter(p => p.prospect_status === 'تم التواصل').length;
      const waitingProspects = prospectsData.filter(p => p.prospect_status === 'بانتظار توقيع').length;
      const rejectedProspects = prospectsData.filter(p => p.prospect_status === 'غير مناسب' || p.prospect_status === 'تم الرفض').length;

      // إحصائيات المسوّقين
      const activeMarketers = marketersData.filter(m => m.status === 'active').length;
      const totalCommissions = commissionsData.reduce((sum, c) => sum + (c.amount || 0), 0);

      // إحصائيات مالية
      const totalRevenue = casesData.reduce((sum, c) => {
        const paymentStatus = c.payment_status;
        return sum + (paymentStatus?.collectedAmount || 0);
      }, 0);

      const expectedRevenue = prospectsData.reduce((sum, p) => sum + (p.expected_value || 0), 0);

      // أحدث الأنشطة
      const recentActivities = activitiesData.slice(0, 10).map(a => 
        `- ${a.description} (${a.user_name} - ${new Date(a.created_at).toLocaleDateString('ar-SA')})`
      ).join('\n');

      // أحدث القضايا
      const recentCases = casesData.slice(0, 5).map(c => 
        `- ${c.case_number}: ${c.case_type} - ${c.status} (${c.client_name})`
      ).join('\n');

      // أحدث العملاء
      const recentClients = clientsData.slice(0, 5).map(c => 
        `- ${c.full_name} (${c.client_type === 'individual' ? 'فرد' : c.client_type === 'company' ? 'شركة' : c.client_type})`
      ).join('\n');

      return `
أنت مساعد ذكي قانوني متخصص لنظام إدارة المكتب القانوني NAF Law. 

📊 إحصائيات النظام الحالية (من قاعدة بيانات Supabase):
- إجمالي العملاء: ${totalClients}
- العملاء المحتملين: ${totalProspects}
- إجمالي القضايا: ${totalCases}
- القضايا المنظورة: ${pendingCases}
- القضايا قيد المعالجة: ${inProgressCases}
- القضايا المكتملة: ${completedCases}
- القضايا المؤجلة: ${postponedCases}
- معدل الربح: ${winRate}%
- معدل التحويل: ${conversionRate}%
- إجمالي المسوّقين: ${totalMarketers}
- المسوّقين النشطين: ${activeMarketers}

💰 الإحصائيات المالية:
- إجمالي الإيرادات المحصلة: ${totalRevenue.toLocaleString()} ريال
- الإيرادات المتوقعة من العملاء المحتملين: ${expectedRevenue.toLocaleString()} ريال
- إجمالي العمولات المدفوعة: ${totalCommissions.toLocaleString()} ريال

👥 توزيع العملاء حسب النوع:
- الأفراد: ${individualClients}
- الشركات: ${companyClients}
- الجمعيات: ${associationClients}
- الجهات الحكومية: ${governmentClients}

🎯 حالة العملاء المحتملين:
- مهتمين: ${interestedProspects}
- تم التواصل معهم: ${contactedProspects}
- بانتظار التوقيع: ${waitingProspects}
- مرفوضين/غير مناسبين: ${rejectedProspects}

⚖️ حالة القضايا:
- منظورة: ${pendingCases}
- قيد المعالجة: ${inProgressCases}
- مكتملة: ${completedCases}
- مؤجلة: ${postponedCases}

📈 أحدث القضايا:
${recentCases || 'لا توجد قضايا حديثة'}

👥 أحدث العملاء:
${recentClients || 'لا توجد عملاء جدد'}

🔄 أحدث الأنشطة:
${recentActivities || 'لا توجد أنشطة حديثة'}

مهامك كمساعد ذكي:
1. الإجابة على الاستفسارات حول العملاء والقضايا والإحصائيات من قاعدة البيانات الحقيقية
2. تقديم تحليلات وتوصيات لتحسين الأداء بناءً على البيانات الفعلية
3. البحث في البيانات وتقديم معلومات مفيدة ودقيقة
4. تقديم نصائح قانونية عامة (غير ملزمة قانونياً)
5. مساعدة في إدارة المكتب وتنظيم العمل
6. اقتراح استراتيجيات لزيادة العملاء وتحسين النتائج
7. تحليل البيانات المفلترة وتقديم رؤى متخصصة
8. مقارنة الأداء بالمعايير المثلى واقتراح التحسينات
9. تحليل الأداء المالي والعمولات
10. تقديم توصيات لتحسين معدلات التحويل والربح

قواعد مهمة:
- أجب دائماً باللغة العربية
- كن مهذباً ومهنياً
- قدم إجابات مفصلة ومفيدة بناءً على البيانات الحقيقية من Supabase
- استخدم البيانات المتاحة لتقديم إجابات دقيقة ومحدثة
- في حالة عدم توفر معلومات كافية، اطلب توضيحاً
- لا تقدم استشارات قانونية ملزمة، بل نصائح عامة فقط
- عند تحليل البيانات، قدم رؤى عملية وقابلة للتطبيق
- استخدم الأرقام والنسب الحقيقية لدعم تحليلاتك
- اقترح خطوات محددة للتحسين بناءً على البيانات الفعلية
- قارن الأداء الحالي مع الفترات السابقة عند الإمكان
`;
    } catch (error) {
      console.error('Error creating context from Supabase:', error);
      return 'أنت مساعد ذكي قانوني لنظام إدارة المكتب القانوني NAF Law. أجب باللغة العربية وكن مفيداً ومهنياً. حدث خطأ في جلب البيانات من قاعدة البيانات، لكن يمكنني مساعدتك بالمعلومات العامة.';
    }
  }

  // إرسال رسالة إلى Gemini مع بيانات Supabase
  async sendMessage(message: string): Promise<string> {
    // التحقق من التهيئة
    if (!this.isInitialized || !this.model) {
      console.log('Gemini not initialized, using fallback response with Supabase data');
      return this.getFallbackResponseWithSupabase(message);
    }

    try {
      const context = await this.createContext();
      const prompt = `${context}\n\nسؤال المستخدم: ${message}\n\nالإجابة:`;

      console.log('Sending message to Gemini with Supabase context...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Received response from Gemini');
      return text || 'عذراً، لم أتمكن من الحصول على إجابة مناسبة. يرجى إعادة صياغة السؤال.';
      
    } catch (error) {
      console.error('خطأ في Gemini API:', error);
      
      // تحليل نوع الخطأ
      if (error instanceof Error) {
        if (error.message.includes('API_KEY')) {
          console.error('API Key error detected');
        } else if (error.message.includes('quota')) {
          console.error('Quota exceeded error detected');
        } else if (error.message.includes('network')) {
          console.error('Network error detected');
        }
      }
      
      // العودة إلى الإجابات المحلية مع بيانات Supabase
      return await this.getFallbackResponseWithSupabase(message);
    }
  }

  // إجابات احتياطية محسنة مع بيانات Supabase
  private async getFallbackResponseWithSupabase(input: string): Promise<string> {
    const lowerInput = input.toLowerCase();
    
    try {
      // الحصول على البيانات الحقيقية من Supabase
      const [
        { data: clients },
        { data: prospects },
        { data: cases },
        { data: marketers },
        { data: activities },
        { data: commissionPayments }
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('cases').select('*'),
        supabase.from('marketers').select('*'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('commission_payments').select('*')
      ]);

      const clientsData = clients || [];
      const prospectsData = prospects || [];
      const casesData = cases || [];
      const marketersData = marketers || [];
      const activitiesData = activities || [];
      const commissionsData = commissionPayments || [];

      // البحث عن العملاء
      if (lowerInput.includes('عميل') && (lowerInput.includes('بحث') || lowerInput.includes('ابحث'))) {
        const searchTerm = input.replace(/.*بحث.*عن|.*ابحث.*عن/i, '').trim();
        if (searchTerm) {
          const foundClients = clientsData.filter(c => 
            c.full_name.includes(searchTerm) || 
            c.email.includes(searchTerm) || 
            c.phone.includes(searchTerm)
          );
          
          if (foundClients.length > 0) {
            return `وجدت ${foundClients.length} عميل مطابق:\n${foundClients.map(c => 
              `• ${c.full_name} - ${c.client_type === 'individual' ? 'فرد' : c.client_type === 'company' ? 'شركة' : c.client_type} - ${c.phone}`
            ).join('\n')}`;
          } else {
            return `لم أجد أي عميل يطابق "${searchTerm}". يمكنك البحث باستخدام الاسم أو البريد الإلكتروني أو رقم الجوال.`;
          }
        }
      }
      
      // إحصائيات العملاء
      if (lowerInput.includes('عدد العملاء') || lowerInput.includes('كم عميل')) {
        const currentClients = clientsData.filter(c => c.status === 'current').length;
        const formerClients = clientsData.filter(c => c.status === 'former').length;
        const individuals = clientsData.filter(c => c.client_type === 'individual').length;
        const companies = clientsData.filter(c => c.client_type === 'company').length;
        const associations = clientsData.filter(c => c.client_type === 'association').length;
        const government = clientsData.filter(c => c.client_type === 'government').length;
        
        return `📊 إحصائيات العملاء (من قاعدة البيانات المركزية):\n• إجمالي العملاء: ${clientsData.length}\n• العملاء الحاليين: ${currentClients}\n• العملاء السابقين: ${formerClients}\n• الأفراد: ${individuals}\n• الشركات: ${companies}\n• الجمعيات: ${associations}\n• الجهات الحكومية: ${government}`;
      }
      
      // إحصائيات القضايا
      if (lowerInput.includes('القضايا') || lowerInput.includes('قضية')) {
        const inProgress = casesData.filter(c => c.status === 'in-progress').length;
        const completed = casesData.filter(c => c.status === 'completed').length;
        const pending = casesData.filter(c => c.status === 'pending').length;
        const postponed = casesData.filter(c => c.status === 'postponed').length;
        const wonCases = casesData.filter(c => c.outcome === 'won').length;
        const winRate = completed > 0 ? Math.round((wonCases / completed) * 100) : 0;
        
        return `⚖️ إحصائيات القضايا (من قاعدة البيانات المركزية):\n• إجمالي القضايا: ${casesData.length}\n• قيد المعالجة: ${inProgress}\n• مكتملة: ${completed}\n• منظورة: ${pending}\n• مؤجلة: ${postponed}\n• معدل الربح: ${winRate}%`;
      }
      
      // العملاء المحتملين
      if (lowerInput.includes('محتمل') || lowerInput.includes('prospects')) {
        const interestedProspects = prospectsData.filter(p => p.prospect_status === 'مهتم').length;
        const contactedProspects = prospectsData.filter(p => p.prospect_status === 'تم التواصل').length;
        const waitingProspects = prospectsData.filter(p => p.prospect_status === 'بانتظار توقيع').length;
        const conversionRate = (clientsData.length + prospectsData.length) > 0 ? 
          Math.round((clientsData.length / (clientsData.length + prospectsData.length)) * 100) : 0;
        
        return `🎯 إحصائيات العملاء المحتملين (من قاعدة البيانات المركزية):\n• إجمالي العملاء المحتملين: ${prospectsData.length}\n• مهتمين: ${interestedProspects}\n• تم التواصل معهم: ${contactedProspects}\n• بانتظار التوقيع: ${waitingProspects}\n• معدل التحويل: ${conversionRate}%`;
      }

      // إحصائيات المسوّقين
      if (lowerInput.includes('مسوق') || lowerInput.includes('عمولة')) {
        const activeMarketers = marketersData.filter(m => m.status === 'active').length;
        const totalCommissions = commissionsData.reduce((sum, c) => sum + (c.amount || 0), 0);
        const employeeMarketers = marketersData.filter(m => m.relationship_type === 'employee').length;
        const freelancerMarketers = marketersData.filter(m => m.relationship_type === 'freelancer').length;
        
        return `💼 إحصائيات المسوّقين (من قاعدة البيانات المركزية):\n• إجمالي المسوّقين: ${marketersData.length}\n• النشطين: ${activeMarketers}\n• الموظفين: ${employeeMarketers}\n• المستقلين: ${freelancerMarketers}\n• إجمالي العمولات المدفوعة: ${totalCommissions.toLocaleString()} ريال`;
      }
      
      // تقرير شامل
      if (lowerInput.includes('إحصائيات') || lowerInput.includes('تقرير') || lowerInput.includes('شامل')) {
        const totalRevenue = casesData.reduce((sum, c) => {
          const paymentStatus = c.payment_status;
          return sum + (paymentStatus?.collectedAmount || 0);
        }, 0);
        
        const expectedRevenue = prospectsData.reduce((sum, p) => sum + (p.expected_value || 0), 0);
        const conversionRate = (clientsData.length + prospectsData.length) > 0 ? 
          Math.round((clientsData.length / (clientsData.length + prospectsData.length)) * 100) : 0;
        
        return `📈 التقرير الشامل لمكتب NAF Law (من قاعدة البيانات المركزية):\n\n👥 العملاء:\n• إجمالي العملاء: ${clientsData.length}\n• العملاء المحتملين: ${prospectsData.length}\n• معدل التحويل: ${conversionRate}%\n\n⚖️ القضايا:\n• إجمالي القضايا: ${casesData.length}\n• القضايا النشطة: ${pendingCases + inProgressCases}\n• القضايا المكتملة: ${completedCases}\n• معدل الربح: ${winRate}%\n\n💰 الأداء المالي:\n• الإيرادات المحصلة: ${totalRevenue.toLocaleString()} ريال\n• الإيرادات المتوقعة: ${expectedRevenue.toLocaleString()} ريال\n• العمولات المدفوعة: ${commissionsData.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()} ريال\n\n📊 الأداء العام: ${winRate > 80 ? 'ممتاز' : winRate > 60 ? 'جيد' : 'يحتاج تحسين'}`;
      }
      
      // نصائح لتحسين الأداء
      if (lowerInput.includes('نصائح') || lowerInput.includes('تحسين') || lowerInput.includes('اقتراح')) {
        const suggestions = [];
        
        const conversionRate = (clientsData.length + prospectsData.length) > 0 ? 
          Math.round((clientsData.length / (clientsData.length + prospectsData.length)) * 100) : 0;
        
        if (conversionRate < 50) {
          suggestions.push('• ركز على تحسين عملية متابعة العملاء المحتملين - معدل التحويل الحالي ' + conversionRate + '%');
          suggestions.push('• طور نظام CRM أفضل لإدارة العلاقات');
        }
        if (winRate < 80) {
          suggestions.push('• راجع استراتيجيات إدارة القضايا لتحسين معدل الربح - المعدل الحالي ' + winRate + '%');
          suggestions.push('• حلل القضايا الخاسرة لتجنب الأخطاء المتكررة');
        }
        if (prospectsData.length < clientsData.length) {
          suggestions.push('• زد من جهود التسويق لجذب المزيد من العملاء المحتملين');
          suggestions.push('• استخدم التسويق الرقمي ووسائل التواصل الاجتماعي');
        }
        
        suggestions.push('• استخدم تحليلات البيانات لفهم أنماط العملاء بشكل أفضل');
        suggestions.push('• طور نظام متابعة دوري للعملاء الحاليين');
        suggestions.push('• استثمر في التدريب المستمر للفريق القانوني');
        suggestions.push('• أنشئ قاعدة معرفة للقضايا المشابهة');
        
        return `💡 نصائح لتحسين أداء المكتب (بناءً على البيانات الحقيقية):\n${suggestions.join('\n')}\n\n🎯 التركيز على هذه النقاط سيساعد في تحسين النتائج بشكل ملحوظ.`;
      }
      
      // تحليل الأداء المتقدم
      if (lowerInput.includes('حلل') || lowerInput.includes('تحليل') || lowerInput.includes('أداء')) {
        const analysis = [];
        
        // تحليل معدل النجاح
        if (winRate >= 80) {
          analysis.push(`✅ معدل النجاح ممتاز (${winRate}%) - يفوق المعايير المثلى`);
        } else if (winRate >= 60) {
          analysis.push(`⚠️ معدل النجاح جيد (${winRate}%) لكن يمكن تحسينه`);
        } else {
          analysis.push(`🔴 معدل النجاح منخفض (${winRate}%) - يحتاج تدخل فوري`);
        }
        
        // تحليل معدل التحويل
        const conversionRate = (clientsData.length + prospectsData.length) > 0 ? 
          Math.round((clientsData.length / (clientsData.length + prospectsData.length)) * 100) : 0;
        
        if (conversionRate >= 60) {
          analysis.push(`✅ معدل التحويل ممتاز (${conversionRate}%)`);
        } else if (conversionRate >= 40) {
          analysis.push(`⚠️ معدل التحويل متوسط (${conversionRate}%) - يمكن تحسينه`);
        } else {
          analysis.push(`🔴 معدل التحويل ضعيف (${conversionRate}%) - يحتاج استراتيجية جديدة`);
        }
        
        // تحليل توزيع العملاء
        const totalClients = clientsData.length;
        const companyPercentage = totalClients > 0 ? Math.round((clientsData.filter(c => c.client_type === 'company').length / totalClients) * 100) : 0;
        analysis.push(`📊 توزيع العملاء: ${companyPercentage}% شركات، ${100 - companyPercentage}% أفراد`);
        
        // تحليل حجم العمل
        const activeCases = casesData.filter(c => c.status === 'pending' || c.status === 'in-progress').length;
        analysis.push(`⚖️ العبء الحالي: ${activeCases} قضية نشطة من أصل ${casesData.length}`);
        
        // تحليل الأداء المالي
        const totalRevenue = casesData.reduce((sum, c) => {
          const paymentStatus = c.payment_status;
          return sum + (paymentStatus?.collectedAmount || 0);
        }, 0);
        
        const totalCommissions = commissionsData.reduce((sum, c) => sum + (c.amount || 0), 0);
        analysis.push(`💰 الأداء المالي: ${totalRevenue.toLocaleString()} ريال إيرادات، ${totalCommissions.toLocaleString()} ريال عمولات`);
        
        return `📈 تحليل شامل لأداء مكتب NAF Law (من قاعدة البيانات المركزية):\n\n${analysis.join('\n\n')}\n\n💡 التوصية: ${
          winRate < 70 ? 'ركز على تحسين جودة الخدمات القانونية' :
          conversionRate < 50 ? 'طور استراتيجية أفضل لتحويل العملاء المحتملين' :
          'حافظ على الأداء الحالي وركز على النمو'
        }`;
      }
      
      // مساعدة عامة
      if (lowerInput.includes('مساعدة') || lowerInput.includes('help') || lowerInput.includes('ماذا يمكنك')) {
        return `🤖 يمكنني مساعدتك في (مع بيانات حقيقية من Supabase):\n\n📊 التحليلات والإحصائيات:\n• إحصائيات العملاء والقضايا المحدثة\n• تقارير الأداء الفعلية\n• معدلات التحويل والربح الحقيقية\n\n🔍 البحث والاستعلام:\n• البحث عن عملاء محددين في قاعدة البيانات\n• معلومات القضايا المحدثة\n• حالة العملاء المحتملين الفعلية\n\n💡 النصائح والتوصيات:\n• اقتراحات لتحسين الأداء بناءً على البيانات الحقيقية\n• استراتيجيات التسويق المخصصة\n• إدارة العلاقات مع العملاء\n\n⚖️ المعلومات القانونية:\n• نصائح قانونية عامة\n• معلومات عن أنواع القضايا\n• إرشادات إدارية\n\nما الذي تود معرفته أو الحصول على مساعدة فيه؟`;
      }
      
      // رد افتراضي مع إحصائيات سريعة
      const quickStats = `📊 إحصائيات سريعة:\n• العملاء: ${clientsData.length}\n• العملاء المحتملين: ${prospectsData.length}\n• القضايا: ${casesData.length}\n• المسوّقين: ${marketersData.length}`;
      
      return `أعمل الآن مع قاعدة البيانات المركزية Supabase! يمكنني مساعدتك في:\n• الاستعلام عن إحصائيات العملاء والقضايا الحقيقية\n• البحث في البيانات المحدثة\n• تقديم تقارير الأداء الفعلية\n• اقتراح نصائح لتحسين العمل\n\n${quickStats}\n\nيرجى طرح سؤال محدد حول العملاء أو القضايا أو الإحصائيات.`;
      
    } catch (error) {
      console.error('Error in fallback response with Supabase:', error);
      return 'عذراً، حدث خطأ أثناء الوصول إلى قاعدة البيانات. يرجى المحاولة مرة أخرى أو التحقق من اتصال Supabase.';
    }
  }

  // فحص حالة الاتصال المحسن
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized || !this.model) {
      console.log('Gemini not initialized for connection test');
      return false;
    }

    try {
      console.log('Testing Gemini connection...');
      const result = await this.model.generateContent('اختبار الاتصال');
      const response = await result.response;
      const text = response.text();
      
      console.log('Gemini connection test successful');
      return !!text;
    } catch (error) {
      console.error('Gemini connection test failed:', error);
      return false;
    }
  }

  // الحصول على حالة التهيئة
  isReady(): boolean {
    return this.isInitialized && !!this.model;
  }

  // إعادة التهيئة
  reinitialize(): void {
    this.initialize();
  }
}

export const geminiService = new GeminiService();