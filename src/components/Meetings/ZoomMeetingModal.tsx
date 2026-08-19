import { useEffect, useState } from 'react';
import { Calendar, Copy, ExternalLink, Plus, Trash2, TriangleAlert, User, Users, Video } from 'lucide-react';
import { Client, Meeting, Prospect } from '../../types';
import { ApiError, api } from '../../data/api';
import { db } from '../../data/database';
import { formatDateTime, formatNumber, isolate } from '@/registry/naf/lib/format';
import { Alert } from '@/registry/naf/ui/alert';

/* المحتمل وحده يحمل `prospectStatus` — وهو ما يفرّقه عن العميل في النوع. */
const subjectTypeOf = (subject: Client | Prospect): 'client' | 'prospect' =>
  'prospectStatus' in subject ? 'prospect' : 'client';
import { Dialog, DialogContent, DialogTitle } from '@/registry/naf/ui/dialog';
import { Textarea } from '@/registry/naf/ui/textarea';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';

interface ZoomMeetingModalProps {
  client?: Client | Prospect;
  onClose: () => void;
}

export default function ZoomMeetingModal({ client, onClose }: ZoomMeetingModalProps) {
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
  /* الاجتماع بعد إنشائه: النافذة تعرض رابطَه ورقمَه بدل أن تُغلق على
     `alert` — والرابط هو الفائدة كلُّها، فإغلاقُه بعد لمحةٍ يُضيعه. */
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [copied, setCopied] = useState(false);

  /** اجتماعاتُ هذا الصفّ التي سبقت — تُقرأ عند الفتح وتُحدَّث بعد الإنشاء. */
  const [past, setPast] = useState<Meeting[]>([]);

  const subject = client ? { type: subjectTypeOf(client), id: client.id } : undefined;
  const subjectKey = subject ? `${subject.type}:${subject.id}` : '';

  useEffect(() => {
    if (!subject) return;
    let alive = true;
    db.getMeetings(subject)
      .then((rows) => { if (alive) setPast(rows); })
      .catch((error) => console.error('تعذّر جلب الاجتماعات:', error));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectKey]);

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

  /* ═══ الاجتماع يُنشأ عند Zoom ═══
   *
   * كان هنا `const meetingId = '2534928083'` ورابطٌ ثابت — لكل اجتماع
   * ولكل عميل — ولا نداءَ لـZoom. ثم `sendMeetingInvitations` ترمي «غير
   * مربوط» قبل أن يُحفظ شيء، فينتهي كلُّ إنشاءٍ عند «حدث خطأ».
   *
   * والآن `POST /api/meetings`: الـWorker ينادي Zoom بسرٍّ عنده — لا في
   * حزمة المتصفّح — ويحفظ ردَّه في D1. والمعرّفُ والرابط من Zoom نفسه.
   */
  const createMeeting = async () => {
    if (!validateForm()) return;

    setIsCreating(true);
    setErrors({});

    try {
      /* الوقت لحظةٌ بالثواني لا نصّ: `datetime-local` بلا منطقةٍ زمنية،
         و`new Date('...')` يقرؤه بمنطقة الجهاز — وهي منطقة من يُنشئ. */
      const startAt = Math.floor(new Date(`${meetingData.date}T${meetingData.time}:00`).getTime() / 1000);

      const created = await api.post<Meeting>('/meetings', {
        topic: meetingData.title,
        agenda: meetingData.agenda,
        startAt,
        duration: Number(meetingData.duration),
        passcode: meetingData.password || undefined,
        invitees,
        waitingRoom: meetingData.waitingRoom,
        recordMeeting: meetingData.recordMeeting,
        subjectType: client ? subjectTypeOf(client) : undefined,
        subjectId: client?.id,
      });

      setMeeting(created);
      setPast((rows) => [created, ...rows]);
    } catch (error) {
      const code = (error as ApiError)?.code;
      setErrors({
        form:
          code === 'not_connected'
            ? 'غير مربوط — يلزم ربط حساب Zoom في إعدادات المنصة'
            : code === 'provider_auth_failed'
              ? 'تعذّر الاتصال بـZoom — تحقّق من بيانات الربط'
              : 'تعذّر إنشاء الاجتماع. أعد المحاولة',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyInvitation = async () => {
    if (!meeting) return;
    const text = generateEmailContent(meeting);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('تعذّر النسخ:', error);
    }
  };

  /* ═══ نصّ الدعوة — مرآةُ القالب المُرسَل ═══
   *
   * إرسالُ البريد غير مربوط بعد، فهذا النصُّ يُنسخ ويُرسَل باليد. وكان
   * يُبنى في متغيّرٍ لا يقرؤه أحد ثم يُرمى مع استثناءٍ حتميّ — والآن
   * وراءه زرُّ نسخ.
   *
   * وحقولُه من ردّ Zoom: الرقمُ والرابط وكلمةُ المرور كما قبلها المزوّد،
   * لا كما بُنيت هنا. */
  const generateEmailContent = (details: Meeting) =>
    [
      `موضوع: دعوة اجتماع - ${details.topic}`,
      '',
      'تفاصيل الاجتماع',
      `التاريخ والوقت: ${isolate(formatDateTime(new Date(details.startAt * 1000)))}`,
      `المدة: ${isolate(details.duration)} دقيقة`,
      `رقم الاجتماع: ${isolate(details.providerId)}`,
      details.passcode ? `كلمة المرور: ${isolate(details.passcode)}` : '',
      '',
      'رابط الدخول:',
      details.joinUrl,
      details.agenda ? `\nجدول الأعمال:\n${details.agenda}` : '',
      '',
      'مع تحيات فريق ناف'
    ]
      .filter(Boolean)
      .join('\n');

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-full overflow-y-auto p-0">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-soft rounded-lg">
              <Video className="h-6 w-6 text-primary-strong" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">إنشاء اجتماع Zoom</DialogTitle>
              {client && (
                <p className="text-sm text-muted-foreground">مع العميل: {client.fullName}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ═══ ما سبق من اجتماعاتٍ لهذا الصفّ ═══
              كانت تُنشأ وتُحفظ في `meetings` ولا تُعرض بعدها أبداً: المسارُ
              مبنيٌّ (`GET /api/meetings`) و`db.getMeetings` مكتوبة، وصفرُ
              نداءات إليهما. فالرابطُ يُرى مرّةً في هذه النافذة ثم يُفقد. */}
          {past.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                اجتماعات سابقة
              </h3>
              <div className="rounded-lg border border-border divide-y divide-border">
                {past.map((entry) => (
                  <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{entry.topic}</p>
                      <p className="text-xs text-muted-foreground">
                        <bdi>{formatDateTime(new Date(entry.startAt * 1000))}</bdi>
                        {' · '}
                        <bdi>{formatNumber(entry.duration)}</bdi> دقيقة
                      </p>
                    </div>
                    <a
                      href={entry.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-strong"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      رابط الدخول
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <Input
                type="text"
                value={meetingData.title}
                onChange={(e) => setMeetingData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="مثال: مناقشة القضية التجارية"
               aria-invalid={!!errors.title} />
              {errors.title && (
                <p className="text-destructive text-sm mt-1">{errors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  التاريخ *
                </label>
                <Input
                  type="date"
                  value={meetingData.date}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, date: e.target.value }))}
                 aria-invalid={!!errors.date} />
                {errors.date && (
                  <p className="text-destructive text-sm mt-1">{errors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  الوقت *
                </label>
                <Input
                  type="time"
                  value={meetingData.time}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, time: e.target.value }))}
                 aria-invalid={!!errors.time} />
                {errors.time && (
                  <p className="text-destructive text-sm mt-1">{errors.time}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  المدة (دقيقة)
                </label>
                <Select
                  value={meetingData.duration}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                >
                  <option value={30}>30 دقيقة</option>
                  <option value={60}>60 دقيقة</option>
                  <option value={90}>90 دقيقة</option>
                  <option value={120}>120 دقيقة</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                جدول الأعمال
              </label>
              <Textarea
                value={meetingData.agenda}
                onChange={(e) => setMeetingData(prev => ({ ...prev, agenda: e.target.value }))}
                rows={3}
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
              <Input
                type="email"
                value={newInviteeEmail}
                onChange={(e) => setNewInviteeEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addInvitee()} className="flex-1"
                placeholder="أدخل البريد الإلكتروني"
               aria-invalid={!!errors.newEmail} />
              <Button onClick={addInvitee}>
                <Plus className="h-4 w-4" />
                إضافة
              </Button>
            </div>
            {errors.newEmail && (
              <p className="text-destructive text-sm">{errors.newEmail}</p>
            )}

            <div className="space-y-2">
              {invitees.map((email, index) => (
                <div key={index} className="flex items-center justify-between bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary-soft rounded-full flex items-center justify-center">
                      <span className="text-primary-strong text-sm font-medium">
                        {email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-foreground">{email}</span>
                    {client && email === client.email && (
                      <Badge variant="success">
                        <User aria-hidden="true" />
                        العميل
                      </Badge>
                    )}
                  </div>
                  <Button onClick={() => removeInvitee(email)} className="text-destructive hover:text-destructive-strong" title="حذف" variant="ghost" size="icon-sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
              <Input
                type="text"
                value={meetingData.password}
                onChange={(e) => setMeetingData(prev => ({ ...prev, password: e.target.value }))} className="flex-1"
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
              <p><strong>عدد المدعوين:</strong> <bdi>{formatNumber(invitees.length)}</bdi></p>
              {meetingData.password && (
                <p><strong>محمي بكلمة مرور:</strong> نعم</p>
              )}
            </div>
          </div>
        </div>

        {errors.form && (
          <div className="px-6">
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <span>{errors.form}</span>
            </Alert>
          </div>
        )}

        {/* بعد الإنشاء: الرابط والرقم — وهما الفائدة كلُّها. وكانت النافذة
            تُغلق على `alert` فيضيع الرابط قبل أن يُنسخ. */}
        {meeting && (
          <div className="mx-6 mb-2 bg-success-soft border border-success/30 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-success-strong">أُنشئ الاجتماع</p>
            <div className="text-sm space-y-1">
              <p>رقم الاجتماع: <bdi>{meeting.providerId}</bdi></p>
              {meeting.passcode && <p>كلمة المرور: <bdi>{meeting.passcode}</bdi></p>}
            </div>
            <code className="block truncate text-xs bg-card rounded px-3 py-2" dir="ltr">
              {meeting.joinUrl}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyInvitation} variant={copied ? 'success' : 'outline'} size="sm">
                <Copy className="h-4 w-4" />
                {copied ? 'نُسخ نصّ الدعوة' : 'نسخ نصّ الدعوة'}
              </Button>
              <a
                href={meeting.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4 hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
              >
                فتح الاجتماع
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            {/* الدعوة لا تُرسَل: لا مُرسِل بريد في المنصة بعد. */}
            <p className="text-xs text-muted-foreground">
              الدعوة لا تُرسَل تلقائياً — انسخ النصّ وأرسله. (إرسال البريد غير مربوط.)
            </p>
          </div>
        )}

        <div className="border-t border-border px-6 py-4">
          <div className="flex justify-end gap-3">
            <Button onClick={onClose} disabled={isCreating} variant="ghost">
              {meeting ? 'إغلاق' : 'إلغاء'}
            </Button>
            {!meeting && (
              <Button onClick={createMeeting} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-card"></div>
                    جارٍ الإنشاء
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    إنشاء الاجتماع
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      </Dialog>
  );
}