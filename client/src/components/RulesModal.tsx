// ========================
// EL-KHETM — Rules Modal (Gameplay Guide)
// ========================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export const RulesModal: React.FC = () => {
  const { activeModal, closeModal } = useGameStore();
  const isOpen = activeModal === 'rules';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="rules-modal"
          className="absolute inset-0 z-50 flex items-center justify-center bg-ink/55 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeModal}
        >
          <motion.div
            className="w-full max-w-md bg-manila rounded-2xl border-2 border-ink shadow-retro-lg max-h-[86vh] flex flex-col overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-ink/20 bg-white/60">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-ink" />
                <h3 className="font-cairo font-black text-lg text-ink">طريقة لعب «الختم»</h3>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg active:bg-ink/10">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-sm font-cairo text-ink">
              <Section title="🧠 فكرة اللعبة">
                كل لاعب بيبدأ بـ <strong>4 ورقات مقلوبة</strong> قدامه على الترابيزة (خانة ١، ٢، ٣، ٤) + 3 كروت في إيده.
                الهدف تجمع أكبر سكور في ملفك المقفول من الـ 4 مستندات بالترتيب الصح وتتخلص من «الورق المضروب»!
              </Section>

              <Section title="👁️ 1. نظرة البداية (أول 11 ثانية)">
                أول ما الجيم يبدأ، بتضغط على <strong>خانتين</strong> من ملفك المقفول عشان تشوفهم وتحفظ أماكنهم قبل ما يتقفلوا تاني!
              </Section>

              <Section title="🪟 2. السحب في دورك (شباك الطلبات أو الكومة)">
                في بداية دورك، عندك اختيارين بدل الحظ الأعمى:
                تسحب كارت من <strong>الكومة المقلوبة</strong>، أو تختار واحد من الـ <strong>3 كروت المكشوفة في شباك الطلبات</strong>!
                (بس خد بالك: خصومك شايفين إنت سحبت إيه من الشباك!).
              </Section>

              <Section title="🗂️ 3. ترتيب الملف المقفول والفخاخ">
                لما تيجي تنزل ورقة من إيدك في خانة من ملفك (١–٤)، بتتحط <strong>مقلوبة سراً</strong> والورقة القديمة اللي في الخانة بتروح الأرشيف.
                <br />• المستندات النادرة: البطاقة (×5، +4ن)، الدمغة (×5، +5ن)، إمضاء المدير (×4، +6ن)، <strong>ختم النسر (×2 بس! +10ن)</strong>.
                <br />• <strong>بونص الترتيب:</strong> لو حطيت كل ورقة في خانتها الصح (١ البطاقة، ٢ الدمغة، ٣ الإمضاء، ٤ الختم) تاخد <strong>+2 لكل ورقة</strong>! ولو كملت الـ 4 بالترتيب تاخد <strong>+25 اكتمال +10 ختم مثالي!</strong>
                <br />• <strong>⚠️ ورق مضروب (×4):</strong> فخ بيخصم <strong>-5 نقط</strong> لو فضل في ملفك! تخلص منه بالتبديل أو الجرد أو ازرعه عند خصم بـ «تبديل مكاتب».
                <br />• <strong>🚨 محضر مخالفة (×2):</strong> فخ تقيل بيخصم <strong>-10 نقط</strong> لو فضل في ملفك وقت الكشف!
              </Section>

              <Section title="🛡️ 4. نظام الاستهداف العادل ومنع السبام + علامات الذاكرة">
                عشان محدش يتظلم من السبام، اللعب فيه 3 قواعد حماية وذكاء:
                <br />• <strong>أدوار محددة بالاتجاه:</strong> «السيستم واقع» و«ورقك ناقص» بيضربوا <strong>اللاعب اللي بعدك تلقائياً</strong>، و«شباك 4» بيبدّل إيدك مع <strong>اللاعب اللي قبلك تلقائياً</strong>!
                <br />• <strong>🛡️ حصانة اللفة:</strong> لما حد يضربك بـ «فوت علينا بكرة» أو «الواسطة» أو «تبديل مكاتب» أو «الملف ضاع» ومصدتش، بتاخد <strong>🛡️ محصّن</strong> وماحدش يقدر يستهدفك تاني لحد ما ييجي دورك!
                <br />• <strong>🔁 تنبيه الخانات و⚠️ تغيّر الذاكرة:</strong> أي خانة تتبدّل أو تتلمس على الترابيزة بتنور بوضوح قدام الكل، ولو ورقة إنت حافظها اتبدلت من وراك بتظهرلك عليها علامة <strong>⚠️</strong> عشان متفتكرهاش لسه في مكانها!
              </Section>

              <Section title="🎯 5. الجرد / التطابق (البصرة — مجاناً!)">
                لو فاكر إن في واحدة من خاناتك الـ 4 ورقة <strong>نفس نوع آخر كارت فوق الأرشيف</strong>، اضغط زرار <strong>«جرد»</strong> واضغط على الخانة!
                <br />• لو صح: الكارت يترمي في الأرشيف وتفضى الخانة (أو تتخلص من الفخاخ زي الورق المضروب ومحضر المخالفة) <strong>من غير ما تضيع حركة</strong> وتكسب <strong>+2 نقط!</strong>
                <br />• لو غلط: بتاخد <strong>كارت عقوبة</strong> زيادة و<strong>-2 نقط</strong>!
              </Section>

              <Section title="🚨 6. زرار «قفل الشباك!» (المخاطرة الكبرى)">
                من الجولة التانية، لما تحس إن ملفك المقفول بقى أحسن من الكل، اضغط <strong>«قفل الشباك!»</strong>.
                <br />باقي اللاعبين ياخدوا <strong>دور واحد أخير بس</strong>، وبعدها الملفات تتكشف كلها!
                <br />• لو فعلاً طلعت أعلى سكور: تكسب <strong>+10 بونص «سبق الشباك»</strong>!
                <br />• لو حد طلع قدّك أو أعلى منك: تاخد عقوبة <strong>-15 نقطة «قفل على فاضي»!</strong>
              </Section>

              <div className="space-y-1.5">
                <h4 className="font-bold text-defense-blue">🔵 كروت الذكاء والتجسس (64 ورقة موزونة)</h4>
                <ul className="space-y-1 text-xs">
                  <li>👁️ <strong>وريني كده اللي معاك (×2):</strong> اكشف خانة من كل لاعب على الترابيزة (بما فيهم خانة من ملفك) سراً 5.5 ثواني!</li>
                  <li>🔍 <strong>نظرة في الدرج (×4):</strong> اكشف أي خانة مقلوبة (عندك أو عند خصمك) سراً!</li>
                  <li>🔁 <strong>تبديل مكاتب (×4):</strong> بدّل خانة من ملفك مع خانة عند خصم غير محصّن سراً (ولو معاك فخ ازرعهوله!).</li>
                  <li>📑 <strong>ترتيب الدوسيه (×3):</strong> شوف أول 3 كروت في كومة السحب ورتبهم من فوق بمزاجك!</li>
                  <li>🤝 <strong>الواسطة (×3 — 🔥 حرق كارت):</strong> احرق كارت من إيدك واسرق خانة خصم غير محصّن لملفك.</li>
                  <li>☕ <strong>بريك الفطار (×5):</strong> صد أي مقلب أو واسطة أو تبديل مكاتب في 5 ثواني!</li>
                  <li>👴 <strong>عم جمال (×2)</strong> للأرشيف · 📨 <strong>توصية من فوق (×2)</strong> اسحب 3 كروت.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-prank-red">🔴 المقالب والاستهداف العادل</h4>
                <ul className="space-y-1 text-xs">
                  <li>🖥️ <strong>السيستم واقع (×4):</strong> يجمّد <strong>اللاعب اللي بعدك</strong> دور كامل (لو مش محمي).</li>
                  <li>📄 <strong>ورقك ناقص (×3):</strong> يجبر <strong>اللاعب اللي بعدك</strong> يختار ويرمي كارتين من إيده.</li>
                  <li>🪟 <strong>شباك 4 (×2):</strong> يبدّل إيدك مع إيد <strong>اللاعب اللي قبلك</strong> تلقائياً!</li>
                  <li>📆 <strong>فوت علينا بكرة (×4):</strong> ارمي خانة مقلوبة من ملف خصم غير محصّن للأرشيف.</li>
                  <li>📁 <strong>الملف ضاع (×2 — 🔥 حرق كارت):</strong> احرق كارت عشان ترجّع خانات ملف خصم غير محصّن لإيده!</li>
                  <li>🏖️ <strong>مدحت في إجازة (×2):</strong> يحميك من أي مقلب جاي.</li>
                </ul>
                <p className="text-[11px] text-ink/70 pt-1">
                  📊 <strong>نصيحة محترفين:</strong> افتح زرار <strong>«العدّاد»</strong> فوق عشان تتابع كام ختم نسر وكام بريك فطار اترموا في الأرشيف!
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="font-black text-ink text-xs mb-1">{title}</h4>
    <p className="text-xs text-ink/75 leading-relaxed">{children}</p>
  </div>
);
