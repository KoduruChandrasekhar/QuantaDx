/** TanStack Query hooks. Server data lives only here — never copied into Zustand. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CircuitPreviewRequest, ExperimentConfig, PredictRequest, PreprocessConfig } from '@/types/api';
import { api } from './endpoints';

export const useHealth = () => useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15000 });
export const useDatasets = () => useQuery({ queryKey: ['datasets'], queryFn: api.datasets, staleTime: 60_000 });
export const useDataset = (id?: string) => useQuery({ queryKey: ['dataset', id], queryFn: () => api.dataset(id!), enabled: !!id, staleTime: 60_000 });
export const useProfile = (id?: string) => useQuery({ queryKey: ['profile', id], queryFn: () => api.profile(id!), enabled: !!id, staleTime: Infinity, retry: false });
export const useExamples = (id?: string) => useQuery({ queryKey: ['examples', id], queryFn: () => api.examples(id!), enabled: !!id, staleTime: Infinity });
export const useBackends = () => useQuery({ queryKey: ['backends'], queryFn: api.backends, refetchInterval: 20000 });
export const useExperiments = (live = false) => useQuery({ queryKey: ['experiments'], queryFn: api.experiments, refetchInterval: live ? 2500 : false });
export const useExperiment = (id?: string, live = false) =>
  useQuery({ queryKey: ['experiment', id], queryFn: () => api.experiment(id!), enabled: !!id, refetchInterval: live ? 2000 : false });
export const useResults = (id?: string) => useQuery({ queryKey: ['results', id], queryFn: () => api.results(id!), enabled: !!id, staleTime: Infinity, retry: false });
export const useExplain = (id?: string, modelId?: string) =>
  useQuery({ queryKey: ['explain', id, modelId], queryFn: () => api.explain(id!, modelId!), enabled: !!id && !!modelId, staleTime: Infinity, placeholderData: keepPreviousData });
export const useLocalExplain = (id?: string, modelId?: string, sample?: number, threshold = 0.5) =>
  useQuery({
    queryKey: ['explain-local', id, modelId, sample, threshold],
    queryFn: () => api.explainLocal(id!, modelId!, sample!, threshold),
    enabled: !!id && !!modelId && sample !== undefined,
    placeholderData: keepPreviousData,
  });
export const useKernel = (id?: string, modelId?: string, bandwidth = 0.2) =>
  useQuery({ queryKey: ['kernel', id, modelId, bandwidth], queryFn: () => api.kernel(id!, modelId!, bandwidth), enabled: !!id && !!modelId, placeholderData: keepPreviousData, staleTime: Infinity });
export const useLandscape = (id?: string, modelId?: string) =>
  useQuery({ queryKey: ['landscape', id, modelId], queryFn: () => api.landscape(id!, modelId!), enabled: !!id && !!modelId, staleTime: Infinity });
export const useModels = () => useQuery({ queryKey: ['models'], queryFn: api.models });
export const useDeployed = (datasetId?: string) => useQuery({ queryKey: ['deployed', datasetId], queryFn: () => api.deployed(datasetId), enabled: !!datasetId });
export const useOpenApi = () => useQuery({ queryKey: ['openapi'], queryFn: api.openapi, staleTime: Infinity });
export const useHistory = (id?: string) => useQuery({ queryKey: ['history', id], queryFn: () => api.history(id!), enabled: !!id, staleTime: 0 });

export const usePreprocessPreview = (datasetId: string | undefined, config: PreprocessConfig) =>
  useQuery({
    queryKey: ['pp-preview', datasetId, JSON.stringify(config)],
    queryFn: () => api.preprocessPreview(datasetId!, config),
    enabled: !!datasetId,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  });

export const useCircuitPreview = (req: CircuitPreviewRequest, enabled = true) =>
  useQuery({ queryKey: ['circuit', JSON.stringify(req)], queryFn: () => api.circuitPreview(req), placeholderData: keepPreviousData, staleTime: Infinity, enabled });

export function useStartExperiment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (cfg: ExperimentConfig) => api.startExperiment(cfg), onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }) });
}

export function useCancelExperiment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.cancelExperiment(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }) });
}

export function useDeploy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deploy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['models'] });
      qc.invalidateQueries({ queryKey: ['deployed'] });
    },
  });
}

export const usePredict = () => useMutation({ mutationFn: (r: PredictRequest) => api.predict(r) });
