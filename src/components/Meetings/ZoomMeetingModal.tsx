import React, { useState } from 'react';
import { Calendar, ClipboardList, Plus, Send, Trash2, Users, Video, X } from 'lucide-react';
import { Client, Prospect } from '../../types';
import { formatDate, formatDateTime, formatTime, isolate } from '@/registry/naf/lib/format';

interface ZoomMeetingModalProps {
  client?: Client | Prospect;
  onClose: () => void;
  onMeetingCreated?: (meetingData: any) => void;
}

export default function ZoomMeetingModal({ client, onClose, onMeetingCreated }: ZoomMeetingModalProps) {
  const [meetingData, setMeetingData] = useState({
    title: client ? `اجتماع مع ${client.fullName}` : 'اجتماع جديد',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 60,
    description: '',
    agenda: '',
    password: '',
    waitingRoom: true,
    recordMeeting: false
  });

  const [invitees, setInvitees] = useState<string[]>(
    client ? [client.email] : []
  );
  const [newInviteeEmail, setNewInviteeEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!meetingData.title.trim()) {
      newErrors.title = 'عنوان الاجتماع مطلوب';
    }

    if (!meetingData.date) {
      newErrors.date = 'تاريخ الاجتماع مطلوب';
    }

    if (!meetingData.time) {
      newErrors.time = 'وقت الاجتماع مطلوب';
    }

    if (invitees.length === 0) {
      newErrors.invitees = 'يجب إضافة مدعو واحد على الأقل';
    }

    // التحقق من صحة الإيميلات
    const invalidEmails = invitees.filter(email => !/\S+@\S+\.\S+/.test(email));
    if (invalidEmails.length > 0) {
      newErrors.invitees = `إيميلات غير صحيحة: ${invalidEmails.join(', ')}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addInvitee = () => {
    if (!newInviteeEmail.trim()) return;
    
    if (!/\S+@\S+\.\S+/.test(newInviteeEmail)) {
      setErrors(prev => ({ ...prev, newEmail: 'البريد الإلكتروني غير صحيح' }));
      return;
    }

    if (invitees.includes(newInviteeEmail)) {
      setErrors(prev => ({ ...prev, newEmail: 'هذا البريد الإلكتروني مضاف بالفعل' }));
      return;
    }

    setInvitees(prev => [...prev, newInviteeEmail]);
    setNewInviteeEmail('');
    setErrors(prev => ({ ...prev, newEmail: '' }));
  };

  const removeInvitee = (email: string) => {
    setInvitees(prev => prev.filter(e => e !== email));
  };

  const generateMeetingPassword = () => {
    const password = Math.random().toString(36).substring(2, 8).toUpperCase();
    setMeetingData(prev => ({ ...prev, password }));
  };

  const createZoomMeeting = async () => {
    if (!validateForm()) return;

    setIsCreating(true);

    try {
      // تفاصيل الاجتماع
      const meetingId = '2534928083';
      const joinUrl = 'https://app.zoom.us/wc/2534928083/start?from';
      const startUrl = 'https://app.zoom.us/wc/2534928083/start?from';
      
      const meetingDetails = {
        id: meetingId,
        title: meetingData.title,
        startTime: `${meetingData.date}T${meetingData.time}:00`,
        duration: meetingData.duration,
        joinUrl,
        startUrl,
        password: meetingData.password || undefined,
        agenda: meetingData.agenda,
        invitees,
        settings: {
          waitingRoom: meetingData.waitingRoom,
          recordMeeting: meetingData.recordMeeting
        }
      };

      // إرسال الإيميلات الفعلية
      await sendMeetingInvitations(meetingDetails);

      // حفظ معلومات الاجتماع محلياً
      saveMeetingToStorage(meetingDetails);

      onMeetingCreated?.(meetingDetails);
      
      alert(
        `تم إنشاء الاجتماع\n` +
          `رقم الاجتماع: ${isolate(meetingId)}\n` +
          `تم إرسال الدعوات إلى ${isolate(invitees.length)} مدعو`
      );
      onClose();

    } catch (error) {
      console.error('Error creating Zoom meeting:', error);
      alert('حدث خطأ أثناء إنشاء الاجتماع. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsCreating(false);
    }
  };

  const sendMeetingInvitations = async (meetingDetails: any) => {
    const emailContent = generateEmailContent(meetingDetails);
    
    try {
      // التحقق من توفر الخادم أولاً
      /* إرسال الدعوة بالبريد معطَّل: خادم Express سقط، وWorkers لا تتكلّم
         SMTP. والرابط يبقى قابلاً للنسخ واليدِ تُرسله. */
      throw new Error('غير مربوط');
    } catch (error) {
      console.error('تعذّر إرسال الدعوات:', error);
      throw error;
    }
    
    // تأخير قصير للمعالجة
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const generateEmailContent = (meetingDetails: any) => {
    const meetingDate = new Date(meetingDetails.startTime);
    const formattedDate = formatDate(meetingDate);
    const formattedTime = formatTime(meetingDate);

    return `
موضوع: دعوة اجتماع - ${meetingDetails.title}

عزيزي/عزيزتي،

أنت مدعو للانضمام إلى اجتماع Zoom:

📅 التاريخ: ${formattedDate}
🕐 الوقت: ${formattedTime}
⏱️ المدة: ${isolate(meetingDetails.duration)} دقيقة

🔗 رابط الانضمام:
${meetingDetails.joinUrl}

${meetingDetails.password ? `🔐 كلمة المرور: ${meetingDetails.password}` : ''}

${meetingDetails.agenda ? `📋 جدول الأعمال:\n${meetingDetails.agenda}` : ''}

نتطلع لرؤيتك في الاجتماع.

مع تحيات فريق NAF Law
    `;
  };

  const saveMeetingToStorage = (meetingDetails: any) => {
    const meetings = JSON.parse(localStorage.getItem('naflaw_meetings') || '[]');
    meetings.push({
      ...meetingDetails,
      createdAt: new Date().toISOString(),
      clientId: client?.id
    });
    localStorage.setItem('naflaw_meetings', JSON.stringify(meetings));
  };

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-soft rounded-lg">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">إنشاء اجتماع Zoom</h2>
              {client && (
                <p className="text-sm text-muted-foreground">مع العميل: {client.fullName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* معلومات الاجتماع الأساسية */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              معلومات الاجتماع
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                عنوان الاجتماع *
              </label>
              <input
                type="text"
                value={meetingData.title}
                onChange={(e) => setMeetingData(prev => ({ ...prev, title: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.title ? 'border-destructive/30' : 'border-border'
                }`}
                placeholder="مثال: مناقشة القضية التجارية"
              />
              {errors.title && (
                <p className="text-destructive text-sm mt-1">{errors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  التاريخ *
                </label>
                <input
                  type="date"
                  value={meetingData.date}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, date: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                    errors.date ? 'border-destructive/30' : 'border-border'
                  }`}
                />
                {errors.date && (
                  <p className="text-destructive text-sm mt-1">{errors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  الوقت *
                </label>
                <input
                  type="time"
                  value={meetingData.time}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, time: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                    errors.time ? 'border-destructive/30' : 'border-border'
                  }`}
                />
                {errors.time && (
                  <p className="text-destructive text-sm mt-1">{errors.time}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  المدة (دقيقة)
                </label>
                <select
                  value={meetingData.duration}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={30}>30 دقيقة</option>
                  <option value={60}>60 دقيقة</option>
                  <option value={90}>90 دقيقة</option>
                  <option value={120}>120 دقيقة</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                جدول الأعمال
              </label>
              <textarea
                value={meetingData.agenda}
                onChange={(e) => setMeetingData(prev => ({ ...prev, agenda: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="اكتب جدول أعمال الاجتماع..."
              />
            </div>
          </div>

          {/* المدعوين */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5" />
              المدعوين
            </h3>

            <div className="flex gap-2">
              <input
                type="email"
                value={newInviteeEmail}
                onChange={(e) => setNewInviteeEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addInvitee()}
                className={`flex-1 px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.newEmail ? 'border-destructive/30' : 'border-border'
                }`}
                placeholder="أدخل البريد الإلكتروني"
              />
              <button
                onClick={addInvitee}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                إضافة
              </button>
            </div>
            {errors.newEmail && (
              <p className="text-destructive text-sm">{errors.newEmail}</p>
            )}

            <div className="space-y-2">
              {invitees.map((email, index) => (
                <div key={index} className="flex items-center justify-between bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary-soft rounded-full flex items-center justify-center">
                      <span className="text-primary text-sm font-medium">
                        {email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-foreground">{email}</span>
                    {client && email === client.email && (
                      <span className="bg-success-soft text-success-strong px-2 py-1 rounded-full text-xs">
                        العميل
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeInvitee(email)}
                    className="text-destructive hover:text-destructive-strong p-1"
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {errors.invitees && (
              <p className="text-destructive text-sm">{errors.invitees}</p>
            )}
          </div>

          {/* إعدادات الأمان */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">إعدادات الأمان</h3>
            
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={meetingData.password}
                onChange={(e) => setMeetingData(prev => ({ ...prev, password: e.target.value }))}
                className="flex-1 px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="كلمة مرور الاجتماع (اختيارية)"
              />
              <button
                onClick={generateMeetingPassword}
                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg text-sm"
              >
                توليد تلقائي
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={meetingData.waitingRoom}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, waitingRoom: e.target.checked }))}
                  className="rounded border-border text-primary focus-visible:ring-ring"
                />
                <span className="text-sm text-foreground">تفعيل غرفة الانتظار</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={meetingData.recordMeeting}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, recordMeeting: e.target.checked }))}
                  className="rounded border-border text-primary focus-visible:ring-ring"
                />
                <span className="text-sm text-foreground">تسجيل الاجتماع تلقائياً</span>
              </label>
            </div>
          </div>

          {/* معاينة الاجتماع */}
          <div className="bg-primary-soft rounded-lg p-4">
            <h4 className="font-medium text-primary-strong mb-3">معاينة الاجتماع</h4>
            <div className="space-y-2 text-sm text-primary-strong">
              <p><strong>العنوان:</strong> {meetingData.title}</p>
              <p><strong>التاريخ والوقت:</strong> {meetingData.date} في {meetingData.time}</p>
              <p><strong>المدة:</strong> {meetingData.duration} دقيقة</p>
              <p><strong>عدد المدعوين:</strong> {invitees.length}</p>
              {meetingData.password && (
                <p><strong>محمي بكلمة مرور:</strong> نعم</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground"
              disabled={isCreating}
            >
              إلغاء
            </button>
            <button
              onClick={createZoomMeeting}
              disabled={isCreating}
              className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-6 py-2 rounded-lg flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-card"></div>
                  جارٍ الإنشاء...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  إنشاء الاجتماع وإرسال الدعوات
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}