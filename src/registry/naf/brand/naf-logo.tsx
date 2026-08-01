import * as React from "react"

import { cn } from "@/registry/naf/lib/utils"

/**
 * شعار ناف.
 *
 * اختيار النسخة يتبع الوضع تلقائياً: النسخة الملوّنة في الوضع الفاتح،
 * والنسخة البيضاء في الوضع الداكن. التبديل بـ CSS لا بجافاسكربت،
 * فلا يظهر الشعار الخطأ في أول إطار.
 *
 * الشعار لا يُقلب في RTL أبداً.
 *
 * **والوضع ليس هو السطح.** النسخة الفاتحة ترسم حرف العلامة بالكحلي
 * `--mark-navy`، فإن جلست على `--surface-deep` — وهو كحليٌّ داكن في
 * الوضعين معاً لا في الداكن وحده — اختفت العلامة في الوضع الفاتح.
 * وهذا وقع فعلاً في شاشة دخول `naf-manger`: ترويسة `bg-surface-deep`
 * والشعار فيها بالنسخة الفاتحة، فلا يُرى نصفَ الوقت.
 *
 * لذلك `onSurface="deep"`: تُثبّت النسخة البيضاء مهما كان الوضع. تُستعمل
 * على `--surface-deep` و`--sidebar` الداكن وأغلفة الشرائح — كل سطحٍ لا
 * يتبع لونُه مظهرَ القارئ. ولا تُستعمل على `--card` ولا `--background`:
 * هناك السطح يتبع الوضع، والتبديل التلقائي هو الصواب.
 */

const SOURCES = {
  full: { light: "/brand/naf-logo.svg", dark: "/brand/naf-logo-dark.svg" },
  mark: { light: "/brand/naf-mark.svg", dark: "/brand/naf-mark-dark.svg" },
} as const

const MONO_SOURCE = "/brand/naf-logo-mono.svg"

export interface NafLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** full = الشعار كاملاً، mark = الرمز وحده، mono = نسخة بلون واحد */
  variant?: "full" | "mark" | "mono"
  /**
   * السطح الذي يجلس عليه الشعار.
   *
   * `auto` — الافتراضي: النسخة تتبع مظهر القارئ.
   * `deep` — سطحٌ داكن في الوضعين: النسخة البيضاء دائماً.
   */
  onSurface?: "auto" | "deep"
  /** أصناف تُمرَّر لعنصر الصورة نفسه لضبط المقاس */
  imageClassName?: string
  alt?: string
}

const NafLogo = React.forwardRef<HTMLSpanElement, NafLogoProps>(
  (
    {
      variant = "full",
      onSurface = "auto",
      className,
      imageClassName,
      alt = "شعار ناف",
      ...props
    },
    ref
  ) => {
    const image = cn("block h-full w-auto select-none", imageClassName)

    if (variant === "mono") {
      return (
        <span ref={ref} className={cn("inline-flex h-12", className)} {...props}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MONO_SOURCE} alt={alt} className={image} />
        </span>
      )
    }

    const source = SOURCES[variant]

    /* صورة واحدة لا صورتان: السطح الداكن لا يبدّل، فلا معنى لتحميل
       النسخة الفاتحة وإخفائها. */
    if (onSurface === "deep") {
      return (
        <span ref={ref} className={cn("inline-flex h-12", className)} {...props}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={source.dark} alt={alt} className={image} />
        </span>
      )
    }

    return (
      <span ref={ref} className={cn("inline-flex h-12", className)} {...props}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source.light} alt={alt} className={cn(image, "dark:hidden")} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source.dark} alt={alt} className={cn(image, "hidden dark:block")} />
      </span>
    )
  }
)
NafLogo.displayName = "NafLogo"

export { NafLogo }
