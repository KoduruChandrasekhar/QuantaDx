/** Regression results: predicted vs actual scatter and residual plot (Parkinson's Telemonitoring, UPDRS). */
import { useState } from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { ExperimentResults } from '@/types/api';
import { ChartCard, AXIS, tooltipStyle } from '@/components/charts/ChartCard';
import { Select } from '@/components/common/ui';
import type { Styles } from '@/components/charts/charts';

export function RegressionView({ r, styles }: { r: ExperimentResults; styles: Styles }) {
  const [id, setId] = useState(r.models[0].modelId);
  const m = r.models.find((x) => x.modelId === id)!;
  const pts = m.predictions!.map((p) => ({ ...p, resid: p.predicted - p.actual }));
  const picker = <div className="mr-2 w-48"><Select value={id} onChange={setId} options={r.models.map((x) => ({ value: x.modelId, label: x.label }))} /></div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Predicted vs actual UPDRS" info="Points on the diagonal are perfect predictions." actions={picker}>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ left: -10, right: 10, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="actual" domain={[5, 57]} {...AXIS} name="Actual" />
            <YAxis type="number" dataKey="predicted" domain={[5, 57]} {...AXIS} name="Predicted" />
            <ZAxis range={[18, 18]} />
            <ReferenceLine segment={[{ x: 5, y: 5 }, { x: 57, y: 57 }]} stroke="var(--muted)" strokeDasharray="4 4" />
            <Tooltip {...tooltipStyle()} />
            <Scatter data={pts} fill={styles[id]?.color} fillOpacity={0.55} animationDuration={600} />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="mt-1 text-xs text-muted">RMSE {m.regression!.rmse.mean.toFixed(2)} · MAE {m.regression!.mae.mean.toFixed(2)} · R² {m.regression!.r2.mean.toFixed(3)} (computed from these residuals)</div>
      </ChartCard>
      <ChartCard title="Residuals" info="Residual = predicted − actual. A funnel shape would indicate heteroscedastic errors.">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ left: -10, right: 10, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="actual" domain={[5, 57]} {...AXIS} name="Actual" />
            <YAxis type="number" dataKey="resid" {...AXIS} name="Residual" />
            <ZAxis range={[18, 18]} />
            <ReferenceLine y={0} stroke="var(--saffron)" strokeWidth={2} />
            <Tooltip {...tooltipStyle()} />
            <Scatter data={pts} fill={styles[id]?.color} fillOpacity={0.55} animationDuration={600} />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
