// ========================
// EL-KHETM — Rules Modal
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
        className="absolute inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeModal}
      >
        <motion.div
          className="w-full max-w-md bg-manila rounded-xl border-2 border-ink shadow-retro-lg max-h-[85vh] flex flex-col overflow-hidden"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-ink/20">
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-ink" />
              <h3 className="font-cairo font-black text-xl text-ink">طريقة اللعب</h3>
            </div>
            <button onClick={closeModal} className="p-1 rounded-lg active:bg-ink/10">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm font-cairo text-ink">
            <Section title="🎯 الهدف">
              اجمع 4 ورقات في ملفك: صورة البطاقة + الدمغة + إمضاء المدير + ختم النسر.
              أول واحد ينزّل «ختم النسر» يكسب فوراً!
            </Section>

            <Section title="⏰ الوقت">
              اللعبة 20 لفة (من الساعة 10 ص للساعة 2 م).
              لو محدش كسب، الفائز = أكتر واحد عنده ورق في الملف.
            </Section>

            <Section title="🎴 الدور">
              كل دور بتسحب كارت + عندك حركتين. ممكن تلعب كارت أو تنهي الدور بدري.
              الحد الأقصى 7 كروت في إيدك.
            </Section>

            <div className="space-y-2">
              <h4 className="font-bold text-doc-green">📗 المستندات (أخضر)</h4>
              <p>صورة البطاقة (×8) · الدمغة (×8) · إمضاء المدير (×6) · ختم النسر (×4)</p>
              <p className="text-xs text-ink/60">ختم النسر يتلعب بس لما يكون عندك الـ 3 ورقات التانية.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-prank-red">📕 المقالب (أحمر)</h4>
              <ul className="space-y-1 text-xs">
                <li>🖥️ <strong>السيستم واقع</strong> — جمّد خصم ويفوّت دوره</li>
                <li>📆 <strong>فوت علينا بكرة</strong> — شيل ورقة من ملف خصم</li>
                <li>📄 <strong>ورقك ناقص</strong> — خصم يرمي كارتين عشوائي</li>
                <li>🪟 <strong>شباك 4</strong> — بدّل كروتك مع كروت خصم</li>
                <li>🏖️ <strong>مدحت في إجازة</strong> — محدش ينزّل إمضاء المدير لفة كاملة</li>
                <li>📁 <strong>الملف ضاع</strong> — كل ملف خصم يرجع لإيده</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-defense-blue">📘 الدفاع والمساعدة (أزرق/ذهبي)</h4>
              <ul className="space-y-1 text-xs">
                <li>☕ <strong>بريك الفطار</strong> — صد أي مقلب (5 ثواني للرد!)</li>
                <li>🤝 <strong>الواسطة</strong> — اسرق ورقة من ملف خصم لملفك</li>
                <li>📨 <strong>توصية من فوق</strong> — اسحب 3 كروت</li>
                <li>👴 <strong>عم جمال</strong> — اختار كارت من الأرشيف</li>
              </ul>
            </div>

            <Section title="🛡️ الرد الفعل (5 ثواني)">
              لما حد يلعب مقلب عليك، عندك 5 ثواني تصد بـ «بريك الفطار».
              لو مش معاك — استنى الوقت يخلص أو اضغط «عدّيها».
            </Section>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="font-bold text-ink mb-1">{title}</h4>
    <p className="text-xs text-ink/70 leading-relaxed">{children}</p>
  </div>
);
