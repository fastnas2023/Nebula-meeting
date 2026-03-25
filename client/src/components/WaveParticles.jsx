import { useMemo } from 'react';

const PARTICLE_COUNT = 18;

function createParticle(index) {
  const horizontal = ((index * 37) % 88) + 6;
  const vertical = ((index * 23) % 76) + 8;
  const size = 6 + (index % 4) * 4;
  const delay = `${(index % 7) * 0.6}s`;
  const duration = `${10 + (index % 5) * 2}s`;
  const opacity = 0.18 + (index % 5) * 0.08;

  return {
    id: `particle-${index}`,
    left: `${horizontal}%`,
    top: `${vertical}%`,
    width: `${size}px`,
    height: `${size}px`,
    delay,
    duration,
    opacity,
  };
}

export default function WaveParticles() {
  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, index) => createParticle(index)),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(99,102,241,0.18),transparent_30%),radial-gradient(circle_at_50%_72%,rgba(34,197,94,0.12),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.45),rgba(2,6,23,0.85))]" />

      <div className="absolute inset-x-[-10%] top-[14%] h-[28%] rounded-full bg-cyan-400/8 blur-3xl animate-[nebulaDrift_18s_ease-in-out_infinite]" />
      <div className="absolute inset-x-[18%] top-[45%] h-[22%] rounded-full bg-blue-500/8 blur-3xl animate-[nebulaDrift_24s_ease-in-out_infinite_reverse]" />
      <div className="absolute left-[8%] right-[8%] bottom-[12%] h-[26%] rounded-full bg-emerald-400/8 blur-3xl animate-[nebulaPulse_16s_ease-in-out_infinite]" />

      <div className="absolute inset-x-0 top-[30%] h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent animate-[nebulaSweep_12s_linear_infinite]" />
      <div className="absolute inset-x-0 top-[58%] h-px bg-gradient-to-r from-transparent via-blue-300/20 to-transparent animate-[nebulaSweep_15s_linear_infinite_reverse]" />

      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute rounded-full bg-white/80 shadow-[0_0_20px_rgba(125,211,252,0.35)] animate-[nebulaFloat_var(--duration)_ease-in-out_infinite]"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.width,
            height: particle.height,
            opacity: particle.opacity,
            '--duration': particle.duration,
            animationDelay: particle.delay,
          }}
        />
      ))}

      <style>{`
        @keyframes nebulaFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -18px, 0) scale(1.18); }
        }

        @keyframes nebulaDrift {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(24px, -18px, 0); }
        }

        @keyframes nebulaPulse {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50% { opacity: 0.34; transform: scale(1.06); }
        }

        @keyframes nebulaSweep {
          0% { transform: translateX(-8%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(8%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
