import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { SimulationSnapshot } from '../simulation';
import { FactoryScene, getSceneSize } from './FactoryScene';

interface FactoryStageProps {
  snapshot: SimulationSnapshot;
  showVehicleRoutes: boolean;
}

function getHighDpiResolution() {
  if (typeof window === 'undefined') {
    return 1;
  }

  return Math.min(window.devicePixelRatio || 1, 2.5);
}

export function FactoryStage({ snapshot, showVehicleRoutes }: FactoryStageProps) {
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
    const resolution = getHighDpiResolution();
    sceneRef.current = scene;

    const gameConfig: Phaser.Types.Core.GameConfig & { resolution?: number } = {
      type: Phaser.AUTO,
      parent: container,
      width: size.width,
      height: size.height,
      autoRound: false,
      backgroundColor: '#050b16',
      scene,
      render: {
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        autoRound: false,
      },
    };

    gameConfig.resolution = resolution;

    const game = new Phaser.Game(gameConfig);

    gameRef.current = game;
    const refreshScale = () => {
      game.scale.refresh();
    };

    const refreshFrame = window.requestAnimationFrame(refreshScale);
    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        refreshScale();
      });
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', refreshScale);
    }

    return () => {
      window.cancelAnimationFrame(refreshFrame);
      resizeObserver?.disconnect();
      if (!resizeObserver) {
        window.removeEventListener('resize', refreshScale);
      }
      sceneRef.current = null;
      gameRef.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const game = gameRef.current;
    if (scene) {
      scene.setSnapshot(snapshot);
      scene.setDisplayOptions({ showVehicleRoutes });
    }

    if (game) {
      const size = getSceneSize(snapshot);
      if (game.scale.width !== size.width || game.scale.height !== size.height) {
        game.scale.resize(size.width, size.height);
        game.scale.refresh();
      }
    }
  }, [snapshot, showVehicleRoutes]);

  return <div ref={containerRef} className="phaser-canvas" />;
}
