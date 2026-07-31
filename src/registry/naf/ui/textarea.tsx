import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/registry/naf/lib/utils"

// نفس رموز الحقل وحلقته وحدوده. الارتفاع هنا حدٌّ أدنى لا ثابت،
// لأن النص متعدّد الأسطر يكبر بمحتواه — والمقاسات الثلاثة تحكم النص لا الارتفاع.
const textareaVariants = cva(
  cn(
    "flex w-full rounded-md border border-border bg-card text-foreground",
    "text-start shadow-xs transition-colors",
    "placeholder:text-muted-foreground",
    "hover:border-ring",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive"
  ),
  {
    variants: {
      size: {
        sm: "min-h-16 px-3 py-2 text-sm",
        md: "min-h-24 px-4 py-2 text-base",
        lg: "min-h-32 px-4 py-3 text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(textareaVariants({ size }), className)}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea, textareaVariants }
