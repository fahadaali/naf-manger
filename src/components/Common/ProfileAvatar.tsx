import React from 'react';

import { pictureUrl } from '../../data/api';

interface ProfileAvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showName?: boolean;
}

export default function ProfileAvatar({ 
  src, 
  name, 
  size = 'md', 
  className = '',
  showName = false 
}: ProfileAvatarProps) {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  // استخراج الأحرف الأولى من الاسم
  const getInitials = (fullName: string) => {
    const names = fullName.trim().split(' ');
    if (names.length >= 2) {
      return names[0].charAt(0) + names[1].charAt(0);
    }
    return names[0].charAt(0);
  };

  const initials = getInitials(name);

  if (showName) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0`}>
          {src ? (
            <img
              src={pictureUrl(src)}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={`${textSizes[size]} font-medium text-muted-foreground`}>
              {initials}
            </span>
          )}
        </div>
        <span className="text-foreground font-medium truncate">{name}</span>
      </div>
    );
  }

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full overflow-hidden bg-muted flex items-center justify-center ${className}`}
      title={name}
    >
      {src ? (
        <img
          src={pictureUrl(src)}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className={`${textSizes[size]} font-medium text-muted-foreground`}>
          {initials}
        </span>
      )}
    </div>
  );
}