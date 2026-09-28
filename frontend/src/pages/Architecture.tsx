import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, SectionTitle } from '@/components/common/ui';
import { ErrorState, Skeleton } from '@/components/common/misc';
import { Defer, Reveal } from '@/components/fx/Effects';
import { EncodingVisualizer } from '@/components/quantum/EncodingVisualizer';
import { KernelPanel } from '@/components/quantum/Kernel';
import { QubitConstellation } from '@/components/quantum/Lazy3D';
import { SystemDiagram } from '@/features/architecture/SystemDiagram';
import { FollowPatient } from '@/features/architecture/FollowPatient';
import { ExecutionTargets, Scalability } from '@/features/architecture/Targets';
import { useEncodedSample } from '@/hooks/usePipelineData';
import { buildCircuit } from '@/lib/quantum/circuits';
import { usePipeline } from '@/store';

export default function Architecture() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = usePipeline((s) => s.quantumConfig);
  const complete = usePipeline((s) => s.complete);
  const { sample, featureLabels, isError, error, refetch } = useEncodedSample(true);
  const [bw, setBw] = useState(params.get('bw') === 'sweep' ? 1 : 0.2);
  const [patient, setPatient] = useState(0);

  useEffect(() => {
    if (params.get('bw') !== 'sweep') return;
    setBw(1);
    let v = 1;
    const id = setInterval(() => {
      v = Math.max(0.2, v - 0.04);
      setBw(Number(v.toFixed(2)));
      if (v <= 0.2) clearInterval(id);
    }, 260);
    return () => clearInterval(id);
  }, [params]);

  const spec = useMemo(() => buildCircuit({ nQubits: sample?.x[0]?.length ?? 6, encoding: q.encoding, encodingReps: q.encodingReps, entanglement: q.entanglement, ansatz: q.ansatz, layers: q.layers }), [q, sample]);
  const xs = useMemo(() => sample?.x.slice(0, 32) ?? [], [sample]);
  const ys = useMemo(() => sample?.y.slice(0, 32) ?? [], [sample]);

  return (
    <div>
      <PageHeader title="Hybrid architecture explorer" trace="architecture" description="The overall system design (D2): classical front-end, QPU / simulator ↔ classical optimizer loop, data encoding and execution targets. Click any block." actions={
        <Button onClick={() => { complete('architecture'); navigate('/models'); }} icon={<ArrowRight size={15} />}>Continue to Model Studio</Button>
      } />
      <div className="grid gap-5 2xl:grid-cols-[1fr_300px]">
        <Card className="p-4"><SystemDiagram /></Card>
        <Card className="hidden overflow-hidden 2xl:block">
          <CardHeader title="Entangled register" subtitle={`${sample?.x[0]?.length ?? 6} qubits · drag to orbit`} />
          <QubitConstellation n={sample?.x[0]?.length ?? 6} height={380} />
        </Card>
      </div>

      <SectionTitle sub="One real record from the test split, traced hop by hop with the values at each stage.">Follow one patient</SectionTitle>
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {sample ? <FollowPatient sample={sample} featureLabels={featureLabels} autoPlay={params.get('follow') === '1'} /> : !isError && <Skeleton className="h-80" />}

      <SectionTitle sub="How patient data becomes a quantum state — and why the kernel bandwidth matters.">Data encoding</SectionTitle>
      <Reveal>
        <Defer delay={500} minHeight={600}><div className="grid gap-5 xl:grid-cols-2" data-tour="arch-encoding">
          <Card className="p-4">{sample ? <EncodingVisualizer sample={sample} featureLabels={featureLabels} bandwidth={bw} onBandwidth={setBw} patient={patient} onPatient={setPatient} /> : <Skeleton className="h-96" />}</Card>
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-fg">Linked kernel preview · {xs.length} patients, computed in your browser</h3>
            {xs.length ? <KernelPanel xs={xs} labels={ys} bandwidth={bw} size={230} /> : <Skeleton className="h-96" />}
          </Card>
        </div></Defer>
      </Reveal>

      <SectionTitle sub="Simulators and IBM Quantum hardware, checked against the current circuit (O4).">Execution targets</SectionTitle>
      <Defer delay={900} minHeight={220}><ExecutionTargets spec={spec} /></Defer>

      <SectionTitle sub="Built to scale out: more workers, batched circuits, cached kernels.">Scalability</SectionTitle>
      <Defer delay={1200} minHeight={240}><Scalability /></Defer>
    </div>
  );
}
