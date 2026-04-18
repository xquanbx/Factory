import { Suspense, lazy, useMemo } from 'react';
import type { SimulationSnapshot } from '../simulation';
import { FactoryStage } from '../phaser/FactoryStage';
import type { StageMode } from './types';
import { buildStageViewModel } from './view-model';

const BabylonStage = lazy(async () => {
  const module = await import('../babylon/BabylonStage');
  return { default: module.BabylonStage };
});

interface FactoryViewportProps {
  snapshot: SimulationSnapshot;
  showVehicleRoutes: boolean;
  stageMode: StageMode;
}

export function FactoryViewport({
  snapshot,
  showVehicleRoutes,
  stageMode,
}: FactoryViewportProps) {
  const viewModel = useMemo(() => buildStageViewModel(snapshot), [snapshot]);

  if (stageMode === '2d') {
    return <FactoryStage viewModel={viewModel} showVehicleRoutes={showVehicleRoutes} />;
  }

  return (
    <Suspense fallback={<div className="stage-loading">加载 3D 视图中...</div>}>
      <BabylonStage viewModel={viewModel} showVehicleRoutes={showVehicleRoutes} />
    </Suspense>
  );
}
