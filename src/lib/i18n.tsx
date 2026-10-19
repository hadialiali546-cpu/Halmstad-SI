// Minimal localisation layer. English is the primary demo language; Swedish covers
// navigation and core actions. Unknown keys fall back to English, so new strings can be
// added incrementally (or replaced with i18next later).
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'sv';

const sv: Record<string, string> = {
  Overview: 'Översikt', 'My Courses': 'Mina kurser', 'SI Sessions': 'SI-pass', 'Request Topics': 'Önska ämnen', 'Preferred Times': 'Önskade tider',
  Notifications: 'Notiser', 'My Sessions': 'Mina pass', Attendance: 'Närvaro', 'Student Requests': 'Studentönskemål', 'Monthly Reports': 'Månadsrapporter',
  'My SI Leaders': 'Mina SI-ledare', Observations: 'Observationer', 'EDU1 & EDU2': 'EDU1 & EDU2', Surveys: 'Enkäter', Courses: 'Kurser',
  Analytics: 'Analys', 'Team Management': 'Teamhantering', 'Reports & Approvals': 'Rapporter & attest', 'Import & Export': 'Import & export',
  'Payroll & Primula Export': 'Lön & Primula-export', 'Demo Guide': 'Demoguide', 'Reset Demo Data': 'Återställ demodata', 'Concept Demo': 'Konceptdemo',
  Student: 'Student', 'SI Leader': 'SI-ledare', 'SI Coach': 'SI-coach', 'SI Supervisor': 'SI-samordnare', 'Switch role': 'Byt roll',
  'Mark all as read': 'Markera alla som lästa', 'View all': 'Visa alla', 'Generate Monthly Report': 'Skapa månadsrapport', 'Save Draft': 'Spara utkast',
  'Submit to Supervisor': 'Skicka till samordnare', 'Export PDF': 'Exportera PDF', 'Export Excel': 'Exportera Excel', Approve: 'Godkänn',
  'Request Correction': 'Begär rättelse', 'Add to Calendar': 'Lägg till i kalender', Submit: 'Skicka', Save: 'Spara', Cancel: 'Avbryt',
  'Save attendance': 'Spara närvaro', 'One Platform. Less Administration. More Learning.': 'En plattform. Mindre administration. Mer lärande.',
  'SI & Results': 'SI & resultat', 'Choose a role to explore the demo': 'Välj en roll för att utforska demon', 'Upcoming sessions': 'Kommande pass',
};

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string }>({ lang: 'en', setLang: () => {}, t: (s) => s });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('halmstad-si-lang') as Lang) || 'en'; } catch { return 'en'; }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('halmstad-si-lang', l); } catch { /* ignore */ }
  };
  const t = (s: string) => (lang === 'sv' ? sv[s] ?? s : s);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
