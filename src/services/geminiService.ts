/* ═══ المساعد الذكي معطَّل ═══
 *
 * كان يُنادى Gemini من **المتصفّح**، ومفتاحُه `VITE_GEMINI_API_KEY` — أي
 * أنه يُشحن في الحزمة ويقرؤه كل زائر. وهذا وحده يوجب نقلَ النداء إلى
 * الخادم أياً كان المزوّد.
 *
 * والقرار المعتمد: يُعطَّل الآن، ويُهيَّأ للربط بـ Claude API لاحقاً.
 *
 * ═══ ما يلزم حين يُوصل ═══
 *
 * ١) مسارٌ في الـWorker — `‎/api/assistant` — محروسٌ بالوسيط كغيره.
 * ٢) المفتاح `wrangler secret put ANTHROPIC_API_KEY`، ولا يُذكر في
 *    `wrangler.toml` ولا يبدأ بـ`VITE_` أبداً: ما بدأ بها يُحقن في حزمة
 *    المتصفّح وقتَ البناء، فيصير سرُّه علانية.
 * ٣) السياق يُقرأ من D1 في الخادم لا يُجمع في المتصفّح ويُرسل — القضايا
 *    والعملاء لا تغادر إلى مزوّدٍ إلا بما يُقصد إرسالُه.
 * ٤) هذا الملفّ يبقى واجهةً: `sendMessage` تنادي المسار، والشاشة لا تتغيّر.
 *
 * والسطح محفوظٌ كما كان — `sendMessage` و`testConnection` و`isReady` و
 * `reinitialize` — فشاشتا المساعد والمحامي الذكي تُصرّفان الحالة بأنفسهما
 * ولا يُمسّ فيهما شيء.
 */

/** رمزٌ لا جملة: النصّ المعروض يأتي من `naf-terms.md`، وترجمتُه عمل الشاشة. */
export const ASSISTANT_DISABLED = 'assistant_not_connected';

class AssistantService {
  /** غير مربوط — والشاشات تسأل هذا قبل أن تنادي. */
  isReady(): boolean {
    return false;
  }

  async testConnection(): Promise<boolean> {
    return false;
  }

  async sendMessage(_message: string): Promise<string> {
    throw new Error(ASSISTANT_DISABLED);
  }

  reinitialize(): void {}
}

export const geminiService = new AssistantService();
