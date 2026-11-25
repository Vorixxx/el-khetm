// ========================
// EL-KHETM — Simplified Rules Modal (Zero Points, 15-Second Guide)
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
                <h3 className="font-cairo font-black text-lg text-ink">شرح لعبة «الختم» ببساطة</h3>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg active:bg-ink/10">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-sm font-cairo text-ink">
              <Section title="🏆 الهدف الأساسي (بدون أي نقط!)">
                كل لاعب قدامه <strong>4 خانات مقلوبة</strong>. أول واحد يجمّع في ملفه{' '}
                <strong>الـ 4 مستندات الرسمية كاملة</strong> بأي ترتيب:
                <br />• <strong>صورة البطاقة + الدمغة + إمضاء المدير + ختم النسر</strong>
                <br />= <strong>يكسب الجيم فوراً!</strong>
                <br />ولو الوقت خلص عند الساعة 2:00 م، اللي جمّع أكبر عدد من الـ 4 مستندات يكسب!
              </Section>

              <Section title="👁️ 1. بداية الجيم (نظرة البداية — 16 ثانية)">
                كل لاعب بيبدأ بـ 4 ورقات مقلوبة في ملفه و3 كروت في إيده. في أول 16 ثانية بتفتح{' '}
                <strong>خانتين</strong> من ملفك تشوفهم مع بعض وتحفظ أماكنهم قبل ما يبدأ اللعب.
              </Section>

              <Section title="🎴 2. في دورك (اسحب + حركتين)">
                • اضغط على <strong>الكومة الكبيرة</strong> في النص واسحب كارت لإيدك.
                <br />• معاك لحد <strong>حركتين</strong>: نزّل مستند أخضر سراً في أي خانة من ملفك (والورقة القديمة بتترمي في الأرشيف)، أو العب كارت مقلب/تبديل/تجسس!
              </Section>

              <Section title="🛡️ 3. الصد والحماية من المقالب">
                • لو حد ضربك بمقلب أو سرقة، معاك <strong>7 ثواني</strong> تصدّ بكارت <strong>«بريك الفطار» ☕</strong>.
                <br />• لو اتضربت من خصم، بتاخد <strong>حصانة 🛡️</strong> محدش يقدر يستهدفك تاني لحد ما ييجي دورك.
              </Section>

              <div className="space-y-1.5">
                <h4 className="font-bold text-defense-blue">🔵 كروت الذكاء والتبديل</h4>
                <ul className="space-y-1 text-xs">
                  <li>🔍 <strong>نظرة في الدرج:</strong> اكشف أي خانة مقلوبة (عندك أو عند خصمك) سراً.</li>
                  <li>👀 <strong>وريني كده اللي معاك:</strong> اكشف خانة من كل لاعب على الترابيزة مع بعض!</li>
                  <li>🔁 <strong>تبديل مكاتب:</strong> بدّل خانة مقلوبة من ملفك مع خانة عند خصم سراً.</li>
                  <li>🤝 <strong>الواسطة:</strong> اسرق خانة من ملف خصم وحطها في ملفك!</li>
                  <li>☕ <strong>بريك الفطار:</strong> صد وألغِ أي مقلب أو سرقة عليك!</li>
                  <li>👴 <strong>عم جمال:</strong> خد أي كارت من الأرشيف لإيدك · 📨 <strong>توصية من فوق:</strong> اسحب 3 كروت.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-prank-red">🔴 كروت المقالب والتعطيل</h4>
                <ul className="space-y-1 text-xs">
                  <li>🖥️ <strong>السيستم واقع:</strong> يجمّد اللاعب اللي بعدك ويفوّت دوره.</li>
                  <li>📄 <strong>ورقك ناقص:</strong> يجبر اللاعب اللي بعدك يرمي كارتين من إيده.</li>
                  <li>🪟 <strong>شباك 4:</strong> يبدّل كل ورق إيدك مع اللاعب اللي قبلك.</li>
                  <li>📆 <strong>فوت علينا بكرة:</strong> ارمي خانة مقلوبة من ملف خصم للأرشيف.</li>
                  <li>📁 <strong>الملف ضاع:</strong> رجّع ورق ملف خصم لإيده من تاني!</li>
                  <li>🏖️ <strong>مدحت في إجازة:</strong> يمنع تنزيل «إمضاء المدير» لفة كاملة.</li>
                </ul>
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
