import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

class DemoScene extends Phaser.Scene {
  constructor() {
    super('demo-scene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#111827');

    const title = this.add.text(24, 24, 'Phaser Demo', {
      color: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
    });

    const tip = this.add.text(24, 64, '最简单的演示内容', {
      color: '#94a3b8',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
    });

    const box = this.add.rectangle(180, 190, 120, 120, 0x38bdf8);

    this.tweens.add({
      targets: box,
      x: 520,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.tweens.add({
      targets: [title, tip],
      alpha: { from: 0.6, to: 1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.inOut',
    });
  }
}

function PhaserDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: 720,
      height: 420,
      backgroundColor: '#111827',
      scene: DemoScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-canvas" />;
}

function App() {
  return (
    <main className="app-shell">
      <section className="panel stage-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Left Panel</p>
            <h1>PhaserJS 演示区</h1>
          </div>
          <span className="badge">Demo</span>
        </div>
        <div className="stage-frame">
          <PhaserDemo />
        </div>
      </section>

      <section className="panel split-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Right Panel</p>
            <h2>分割区</h2>
          </div>
          <span className="badge muted">Scaffold</span>
        </div>

        <div className="split-stack">
          <article className="split-card">
            <p className="card-title">上半区</p>
            <p className="card-copy">这里先放占位内容，后续可以替换成控制面板、属性区或日志区。</p>
          </article>

          <article className="split-card accent">
            <p className="card-title">下半区</p>
            <p className="card-copy">这里也先保留最简单的说明文字，用来确认双区域布局已经搭好。</p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default App;
