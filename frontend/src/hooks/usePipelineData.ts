import { useMemo } from 'react';
import { usePreprocessPreview } from '@/api/hooks';
import { quantumReadyPreset } from '@/content/preprocess';
import { usePipeline } from '@/store';
import type { PreprocessPreview } from '@/types/api';

/** Encoded patients (angles in [0, π]) + feature→qubit labels from the current pre-processing config. */
export function useEncodedSample(forceQuantumReady = false) {
  const datasetId = usePipeline((s) => s.activeDatasetId);
  const cfg = usePipeline((s) => s.preprocessConfig);
  const config = useMemo(() => (forceQuantumReady ? quantumReadyPreset() : cfg), [forceQuantumReady, cfg]);
  const q = usePreprocessPreview(datasetId, config);
  const labels = useMemo(() => (q.data ? featureLabels(q.data) : []), [q.data]);
  return { ...q, sample: q.data?.encodedSample, featureLabels: labels, datasetId };
}

/** "PC1 (radius_worst…)" style labels using the top loading of each component. */
export function featureLabels(p: PreprocessPreview): string[] {
  return p.finalFeatures.map((f) => {
    const l = p.loadings.find((x) => x.component === f);
    return l ? `${f} · ${l.weights[0]?.feature ?? ''}` : f;
  });
}
