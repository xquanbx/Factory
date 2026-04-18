import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { SimulationSnapshot } from '../simulation';
import { FactoryScene, getSceneSize } from './FactoryScene';

interface FactoryStageProps {
  snapshot: SimulationSnapshot;
}

export function FactoryStage({ snapshot }: FactoryStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<FactoryScene | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new FactoryScene();
    const size = getSceneSize(snapshot);
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: size.width,
      height: size.height,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: '#050b16',
      scene,
      render: {
        antialias: true,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    gameRef.current = game;

    return () => {
      sceneRef.current = null;
      gameRef.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) {
      scene.setSnapshot(snapshot);
    }
  }, [snapshot]);

  return <div ref={containerRef} className="phaser-canvas" />;
}
