import { useEffect } from 'react';

export default function LorePage() {
  useEffect(() => {
    document.title = 'What is a Chanclazo? — Definition, Meaning & Latino Culture';

    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.content = content;
    };

    setMeta('description', 'Chanclazo: the swift, precision-guided flip flop strike delivered by a Latina mom, abuela, or tía. Learn the meaning, origin, and cultural significance of the legendary chanclazo.');
    setMeta('og:title', 'What is a Chanclazo? — Definition & Latino Culture', true);
    setMeta('og:description', 'The chanclazo is a Latina mother\'s secret weapon — a precision-guided sandal strike with supernatural accuracy. Learn its meaning and play the game.', true);
    setMeta('og:url', 'https://chanclazo.com/lore', true);
    setMeta('og:type', 'article', true);
    setMeta('twitter:title', 'What is a Chanclazo? — Definition & Latino Culture');
    setMeta('twitter:description', 'The chanclazo: a precision-guided flip flop strike delivered by moms, abuelas & tías across Latino culture.');

    const existing = document.getElementById('lore-jsonld');
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.id = 'lore-jsonld';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: 'Chanclazo',
      description: 'A sudden, precision-guided sandal or flip flop strike delivered by a Latina mother, abuela, or tía, known for supernatural accuracy and zero warning. Iconic across Latino culture.',
      inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'Latino Culture Field Guide', url: 'https://chanclazo.com/lore' },
      url: 'https://chanclazo.com/lore',
    });
    document.head.appendChild(script);

    return () => {
      document.title = 'Chanclazo';
      document.getElementById('lore-jsonld')?.remove();
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#110d07', color: '#fff', fontFamily: 'inherit', display: 'flex', flexDirection: 'column' }}>

      {/* Static Chancla Strike night-cemetery background (non-scrolling layer; no parallax, no background-attachment) */}
      <style>{`.lore-bg{position:fixed;inset:0;z-index:0;pointer-events:none;background:url(/lore/cemetery_landscape.webp) center/cover no-repeat}
@media (max-aspect-ratio:1/1){.lore-bg{background-image:url(/lore/cemetery_portrait.webp)}}
.lore-dim{position:fixed;inset:0;z-index:1;pointer-events:none;background:rgba(0,0,0,.55)}
.lore-fade{position:fixed;left:0;right:0;bottom:0;height:32vh;z-index:1;pointer-events:none;background:linear-gradient(to bottom,rgba(12,4,24,0),rgba(12,4,24,.85))}`}</style>
      <div className="lore-bg" aria-hidden="true" />
      {/* Neutral dim for text readability + bottom night fade (both sit under the content, z-index 1) */}
      <div className="lore-dim" aria-hidden="true" />
      <div className="lore-fade" aria-hidden="true" />

      {/* Top accent bar */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #C2410C, #F97316, #C2410C)', position: 'relative', zIndex: 2 }} />

      {/* Nav — aligned to match body max-width */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
          <a href="/" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.2em', textDecoration: 'none' }}>
            chanclazo.com
          </a>
          <a href="/" aria-label="Play Chanclazo games" style={{ fontSize: '11px', fontWeight: 700, color: '#F97316', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Play the games
          </a>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, maxWidth: '560px', margin: '0 auto', padding: '48px 24px 64px', width: '100%', boxSizing: 'border-box', position: 'relative', zIndex: 2 }}>

        <p style={{ fontSize: '10px', color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.25em', fontWeight: 700, marginBottom: '16px' }}>
          Latino Culture · Field Guide
        </p>

        <h1 style={{ fontSize: 'clamp(48px, 10vw, 72px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', color: '#fff', marginBottom: '12px' }}>
          chanclazo
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <span style={{ color: 'rgba(249,115,22,0.75)', fontStyle: 'italic', fontSize: '14px' }}>/chan·claw·so/</span>
          <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.15)' }} aria-hidden="true" />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>noun</span>
          <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.15)' }} aria-hidden="true" />
          <span style={{ color: 'rgba(249,115,22,0.6)', fontStyle: 'italic', fontSize: '13px' }}>chancla strike</span>
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '32px' }} />

        <p style={{ fontSize: '18px', lineHeight: '1.7', color: 'rgba(255,255,255,0.82)', marginBottom: '32px' }}>
          A Latina mother's{' '}
          <strong style={{ color: '#fdba74', fontWeight: 600 }}>secret weapon</strong>
          {' '}— the swift, precision-guided deployment of a flip flop or sandal.
          An ancient technique involving supernatural accuracy and zero warning.
        </p>

        <h2 style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '20px', fontWeight: 700 }}>
          Characteristics
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 36px 0' }}>
          {[
            'A sudden, precision-guided sandal strike',
            'Delivered by a mom, abuela, or tía',
            'With supernatural accuracy and zero warning',
            'Used to correct behavior instantly',
          ].map((line) => (
            <li key={line} style={{ display: 'flex', gap: '16px', marginBottom: '14px', alignItems: 'flex-start' }}>
              <span style={{ color: '#F97316', fontWeight: 700, fontSize: '14px', flexShrink: 0, marginTop: '2px' }} aria-hidden="true">—</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: '1.6' }}>{line}</span>
            </li>
          ))}
        </ul>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '32px' }} />

        <h2 style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '16px', fontWeight: 700 }}>
          Cultural Significance
        </h2>
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
          Think of it as the OG heat-seeking missile. Iconic, funny, and universally
          understood across Latino culture. It is delivered by a mom, abuela, or tía
          and is known for its precision targeting and zero latency response time.
        </p>

        <blockquote style={{ borderLeft: '2px solid #F97316', paddingLeft: '20px', margin: '0 0 48px 0' }}>
          <p style={{ fontSize: '20px', fontWeight: 600, fontStyle: 'italic', color: '#fed7aa', lineHeight: '1.45', margin: '0 0 10px 0' }}>
            "When words fail, the chanclazo speaks."
          </p>
          <cite style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontStyle: 'normal' }}>
            Chanclazo · chanclazo.com
          </cite>
        </blockquote>

        {/* CTA — Go Back */}
        <a href="/" aria-label="Back to Chanclazo games" style={{ display: 'inline-block', fontSize: '12px', fontWeight: 900, color: '#c2410c', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8, cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
        >
          ← Go Back
        </a>

      </main>

      {/* Footer — centered */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', width: '100%', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>© 2023 Chanclazo™</span>
          <a href="https://x.com/ChanclaStrike" target="_blank" rel="noopener noreferrer" aria-label="Chanclazo on X (@ChanclaStrike)"
            style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', letterSpacing: '0.15em', textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" style={{ verticalAlign: '-1px', fill: 'currentColor', marginRight: '5px' }}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>@ChanclaStrike
          </a>
        </div>
      </footer>
    </div>
  );
}
