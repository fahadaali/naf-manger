import React, { useState, useRef } from 'react';
import { Image, User } from 'lucide-react';

interface ProfilePictureUploadProps {
  currentPicture?: string;
  onPictureChange: (picture: string | undefined) => void;
  size?: 'sm' | 'md' | 'lg';
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
    lg: 'w-32 h-32'
  };

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setIsUploading(true);

    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صحيح');
      setIsUploading(false);
      return;
    }

    // التحقق من حجم الملف (أقل من 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('حجم الصورة يجب أن يكون أقل من 2 ميجابايت');
      setIsUploading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onPictureChange(result);
      setIsUploading(false);
    };
    reader.onerror = () => {
      setError('حدث خطأ أثناء قراءة الملف');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePicture = () => {
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
              src={currentPicture}
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
          <div className="absolute inset-0 bg-card bg-opacity-75 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleClick}
          disabled={isUploading}
          className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:bg-muted transition-colors"
        >
          {currentPicture ? 'تغيير الصورة' : 'إضافة صورة'}
        </button>
        
        {currentPicture && (
          <button
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
        PNG, JPG أو GIF (أقل من 2MB)
      </p>
    </div>
  );
}