import { FLOW, stageIndex, type FlowStage } from '@/lib/flow';

/** The one weekly-flow stepper (Home, Editions, editor). Done steps get a check; the current step is accented. */
export function FlowStepper({ current, compact = false }: { current: FlowStage | 'done'; compact?: boolean }) {
  const at = stageIndex(current);
  return (
    <ol className={`flow-stepper${compact ? ' compact' : ''}`} aria-label="Weekly flow">
      {FLOW.map((f, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo';
        return (
          <li key={f.key} className={state} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="fs-dot" aria-hidden>{state === 'done' ? '✓' : i + 1}</span>
            <span className="fs-label">{f.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
