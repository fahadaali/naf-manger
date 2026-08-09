import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/registry/naf/ui/button';

/* ═══ حاجزُ الأخطاء ═══
 *
 * كان في `App.tsx` `try/catch` حول `renderCurrentView()`، وهو لا يمسك
 * شيئاً: الدالة تبني عنصراً ولا تصيّره، والتصيير يقع بعدها في React —
 * خارج الكتلة. فأيُّ خطأٍ في شاشة كان يهدم الشجرة كلَّها إلى صفحة بيضاء،
 * ويقرأ صاحبُها من البياض أن الصفحة «لا تُفتح».
 *
 * وهذا هو الموضع الذي يمسك فيه React الخطأ فعلاً. والحاجز يعزل الشاشة
 * وحدها: الشريطُ والترويسة يبقيان، فيُنتقل إلى شاشةٍ أخرى بلا إعادة تحميل.
 *
 * و`resetKey` يُعيده إلى السويّ عند تغيّر الشاشة، وإلّا بقيت رسالةُ
 * الخطأ معروضةً بعد الانتقال إلى شاشةٍ سليمة.
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** يتغيّر فيُنسى الخطأ السابق — الشاشة الحالية مثلاً. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('تعذّر عرض الشاشة:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-md">
          <div className="text-destructive mb-4">
            <TriangleAlert className="w-16 h-16 mx-auto" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">تعذّر عرض هذه الشاشة</h2>
          <p className="text-muted-foreground mb-2">
            بقيّة المنصة تعمل — اختر شاشةً أخرى من الشريط الجانبي.
          </p>
          <p className="text-sm text-muted-foreground mb-6">{this.state.error.message}</p>
          <Button onClick={() => this.setState({ error: null })}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }
}
