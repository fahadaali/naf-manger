import React, { useState, useRef } from 'react';
import { Image, User } from 'lucide-react';
import { Input } from '@/registry/naf/ui/input';
import { pictureUrl, uploadFile } from '../../data/api';

/* الحدّان مرآةُ `AVATAR` في `worker/lib/files.js` — والخادم هو الحاكم.
   وSVG مستثنًى هناك قصداً: يحمل نصّاً يُنفَّذ حين يُفتح على أصلنا. */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 2 * 1024 * 1024;

interface ProfilePictureUploadProps {
  /* مفتاحُ الصورة في الحاوية للجديد، وقد يكون `data:` لصفٍّ قديم لم
     تُستبدل صورتُه بعد. و`pictureUrl` تقرأ الصيغتين. */
  currentPicture?: string;
  onPictureChange: (pictureKey: string | undefined) => void;
  /* ‎xl‎ مقاسٌ مطلوب: شاشة الملفّ الشخصي تمرّره، وكان خارج الخريطة فيسقط
     صنفُ المقاس كلُّه ويظهر الإطار بلا حجم. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function ProfilePictureUpload({ 
  currentPicture, 
  onPictureChange, 
  size = 'md',
  className = '' 
}: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
    xl: 'w-40 h-40'
  };

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  /* ═══ الصورة تُرفع إلى الحاوية، ولا تُقرأ نصّاً ═══
   *
   * كان هنا `readAsDataURL`: يقرأ الملفّ سلسلةَ base64 ويسلّمها للشاشة،
   * فتُحشر في عمودٍ في القاعدة — حتى ٢٫٧ ميغابايت نصّاً للصورة الواحدة،
   * تُنقل مع كل قراءةِ صفّ ومع كل قائمة.
   *
   * والحاوية R2 كانت مربوطةً في `wrangler.toml` ومسارُها `‎/api/files‎`
   * مبنيّاً في الـWorker وصفرُ نداءات إليه. فالآن يُرفع الملفّ إليها
   * ويعود مفتاحُه، والمفتاحُ وحده هو ما يُحفظ.
   *
   * والحدّان — النوع والحجم — يفحصهما الخادم كذلك في `files.js`، وهذا
   * الفحص هنا ليقول للرافع قبل أن ينتظر الرفع. لا ليقوم مقامه. */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');

    if (!ACCEPTED.includes(file.type)) {
      setError('الصيغ المقبولة: PNG أو JPEG أو WebP أو GIF');
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('حجم الصورة يجب أن يكون أقل من 2 ميجابايت');
      return;
    }

    setIsUploading(true);
    try {
      const { key } = await uploadFile(file, 'avatar');
      onPictureChange(key);
    } catch (uploadError) {
      console.error('تعذّر رفع الصورة:', uploadError);
      setError('تعذّر رفع الصورة. أعد المحاولة');
    } finally {
      setIsUploading(false);
      // يُفرَّغ الحقل ليقبل الملفّ نفسه ثانيةً لو أُعيدت المحاولة.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePicture = () => {
    setError('');
    onPictureChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative group">
        <div 
          className={`${sizeClasses[size]} rounded-full border-2 border-border overflow-hidden bg-muted cursor-pointer hover:border-ring transition-colors`}
          onClick={handleClick}
        >
          {currentPicture ? (
            <img
              src={pictureUrl(currentPicture)}
              alt="الصورة الشخصية"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className={`${iconSizes[size]} text-muted-foreground`} />
            </div>
          )}
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-overlay opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Image className="h-6 w-6 text-surface-deep-foreground" />
          </div>
        </div>

        {/* Loading indicator */}
        {isUploading && (
          <div className="absolute inset-0 bg-card/75 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {/* File input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        onChange={handleFileSelect} className="hidden"
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* `type="button"` لازم: هذا المكوّن يُركَّب داخل `<form>` في نوافذ
            العميل والمحتمل والمسوّق، والزرُّ بلا نوعٍ `submit` بحكم الافتراض —
            فكان الضغط على «إضافة صورة» يفتح منتقيَ الملفّات ويحفظ النموذج
            ويُغلق النافذة في اللحظة نفسها، فيُسجَّل صفٌّ ناقصٌ قبل اختيار الملفّ. */}
        <button
          type="button"
          onClick={handleClick}
          disabled={isUploading}
          className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:bg-muted transition-colors"
        >
          {currentPicture ? 'تغيير الصورة' : 'إضافة صورة'}
        </button>
        
        {currentPicture && (
          <button
            type="button"
            onClick={handleRemovePicture}
            disabled={isUploading}
            className="text-xs px-3 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:bg-muted transition-colors"
          >
            حذف الصورة
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-destructive text-xs text-center">{error}</p>
      )}

      {/* Help text */}
      <p className="text-xs text-muted-foreground text-center">
        PNG أو JPEG أو WebP أو GIF (أقل من 2 ميجابايت)
      </p>
    </div>
  );
}