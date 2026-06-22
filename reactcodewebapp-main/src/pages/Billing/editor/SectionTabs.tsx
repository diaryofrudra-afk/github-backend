import { useEffect, useState } from 'react';

const SECTION_IDS = [
  'header',
  'parties',
  'shipping',
  'items',
  'totals',
  'notes',
  'terms',
  'advanced',
] as const;

type SectionId = (typeof SECTION_IDS)[number];

const LABELS: Record<SectionId, string> = {
  header: 'HEADER',
  parties: 'PARTIES',
  shipping: 'SHIPPING',
  items: 'ITEMS',
  totals: 'TOTALS',
  notes: 'NOTES',
  terms: 'TERMS',
  advanced: 'ADVANCED',
};

export function SectionTabs() {
  const [active, setActive] = useState<SectionId>('header');

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY + 130;
      let current: SectionId = 'header';
      for (const id of SECTION_IDS) {
        const el = document.getElementById(`de-section-${id}`);
        if (el && el.offsetTop <= scrollY) current = id;
      }
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const click = (id: SectionId) => {
    setActive(id);
    const el = document.getElementById(`de-section-${id}`);
    if (el) {
      // 120px accounts for the sticky tab bar height + breathing room
      const top = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="de-tabs" role="tablist">
      {SECTION_IDS.map(id => (
        <button
          key={id}
          type="button"
          className={`de-tab${active === id ? ' active' : ''}`}
          onClick={() => click(id)}
        >
          {LABELS[id]}
        </button>
      ))}
    </div>
  );
}
