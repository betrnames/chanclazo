export default function LorePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#110d07',
      color: '#fff',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #C2410C, #F97316, #C2410C)' }} />

      {/* Nav */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
          chanclazo.com
        </span>
        <a href="/" style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#F97316',
          textDecoration: 'none',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}>
          Play the Game
        </a>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: '560px', margin: '0 auto', padding: '48px 24px 64px', width: '100%' }}>

        {/* Label */}
        <p style={{
          fontSize: '10px', color: '#F97316', textTransform: 'uppercase',
          letterSpacing: '0.25em', fontWeight: 700, marginBottom: '16px',
        }}>
          Latino Culture · Field Guide
        </p>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(48px, 10vw, 72px)',
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: '#fff',
          marginBottom: '12px',
        }}>
          chanclazo
        </h1>

        {/* Phonetics row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <span style={{ color: 'rgba(249,115,22,0.75)', fontStyle: 'italic', fontSize: '14px' }}>/chan·claw·so/</span>
          <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>noun</span>
          <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ color: 'rgba(249,115,22,0.6)', fontStyle: 'italic', fontSize: '13px' }}>chancla strike</span>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '32px' }} />

        {/* Definition */}
        <p style={{ fontSize: '18px', lineHeight: '1.7', color: 'rgba(255,255,255,0.82)', marginBottom: '32px' }}>
          A Latina mother's{' '}
          <span style={{ color: '#fdba74', fontWeight: 600 }}>secret weapon</span>
          {' '}— the swift, precision-guided deployment of a flip flop or sandal.
          An ancient technique involving supernatural accuracy and zero warning.
        </p>

        {/* Characteristics */}
        <p style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
          letterSpacing: '0.2em', marginBottom: '20px', fontWeight: 700,
        }}>
          Characteristics
        </p>
        <div style={{ marginBottom: '36px' }}>
          {[
            'A sudden, precision-guided sandal strike',
            'Delivered by a mom, abuela, or tía',
            'With supernatural accuracy and zero warning',
            'Used to correct behavior instantly',
          ].map((line) => (
            <div key={line} style={{ display: 'flex', gap: '16px', marginBottom: '14px', alignItems: 'flex-start' }}>
              <span style={{ color: '#F97316', fontWeight: 700, fontSize: '14px', flexShrink: 0, marginTop: '2px' }}>—</span>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>{line}</p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '32px' }} />

        {/* Cultural note */}
        <p style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
          letterSpacing: '0.2em', marginBottom: '16px', fontWeight: 700,
        }}>
          Cultural Significance
        </p>
        <p style={{ fontSize: '15px', lineHeight: '1.7', color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
          Think of it as the OG heat-seeking missile. Iconic, funny, and universally
          understood across Latino culture. It is delivered by a mom, abuela, or tía
          and is known for its precision targeting and zero latency response time.
        </p>

        {/* Pull quote */}
        <div style={{ borderLeft: '2px solid #F97316', paddingLeft: '20px', marginBottom: '48px' }}>
          <p style={{ fontSize: '20px', fontWeight: 600, fontStyle: 'italic', color: '#fed7aa', lineHeight: '1.45', margin: 0 }}>
            "When words fail, the chanclazo speaks."
          </p>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '10px', margin: '10px 0 0' }}>
            Chanclazo 3D Survival · v0.2.0
          </p>
        </div>

        {/* CTA */}
        <a href="/" style={{
          display: 'inline-block',
          padding: '14px 32px',
          background: '#F97316',
          color: '#fff',
          fontWeight: 900,
          fontSize: '14px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          textDecoration: 'none',
        }}>
          Play Chanclazo
        </a>

      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          2026 Chanclazo
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          @ChanclaStrike
        </span>
      </div>
    </div>
  );
}
