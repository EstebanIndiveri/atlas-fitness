import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, TextArea } from '@/components/ui/Input';
import type { GuidedPlanField, GuidedPlanFormState } from './useGuidedPlan';

interface GuidedPlanBriefStepProps {
  form: GuidedPlanFormState;
  busy: boolean;
  canGenerate: boolean;
  onFieldChange: <K extends GuidedPlanField>(field: K, value: GuidedPlanFormState[K]) => void;
  onSubmit: () => Promise<void>;
}

export function GuidedPlanBriefStep({
  form,
  busy,
  canGenerate,
  onFieldChange,
  onSubmit,
}: GuidedPlanBriefStepProps) {
  return (
    <Card className="space-y-4 rounded-2xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Coach Atlas</p>
        <h1 className="mt-1 text-title font-bold text-ink">Crear plan con Coach Atlas</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Contale a Atlas tu contexto real. Te propone una semana completa para revisar antes de guardar.
        </p>
      </div>

      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
        <TextArea
          id="guided-goal"
          label="Objetivo"
          rows={3}
          minLength={2}
          maxLength={60}
          value={form.goal}
          placeholder="Ej: ganar fuerza sin dejar de moverme bien"
          onChange={(event) => onFieldChange('goal', event.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="guided-days"
            label="Días por semana"
            type="number"
            min={1}
            max={6}
            value={form.daysPerWeek}
            onChange={(event) => onFieldChange('daysPerWeek', event.target.value)}
          />
          <Input
            id="guided-length"
            label="Minutos por sesión"
            type="number"
            min={20}
            max={120}
            value={form.sessionLengthMinutes}
            onChange={(event) => onFieldChange('sessionLengthMinutes', event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-ink">
            Experiencia
            <select
              className="mt-1 w-full rounded-md border border-line bg-surface px-4 py-2"
              value={form.experience}
              onChange={(event) => {
                onFieldChange('experience', event.target.value as GuidedPlanFormState['experience']);
              }}
            >
              <option value="beginner">Inicial</option>
              <option value="intermediate">Intermedia</option>
              <option value="advanced">Avanzada</option>
            </select>
          </label>
          <Input
            id="guided-equipment"
            label="Equipo disponible"
            hint="Separá por comas. Hasta 8 elementos de 40 caracteres."
            maxLength={327}
            value={form.availableEquipment}
            onChange={(event) => onFieldChange('availableEquipment', event.target.value)}
          />
        </div>
        <Input
          id="guided-focus"
          label="Focos preferidos"
          hint="Separá por comas. Hasta 6 focos de 40 caracteres; vacío usa un split equilibrado."
          maxLength={245}
          value={form.focusAreas}
          onChange={(event) => onFieldChange('focusAreas', event.target.value)}
        />
        <Button type="submit" size="lg" disabled={!canGenerate}>
          {busy ? 'Generando…' : 'Generar plan semanal'}
        </Button>
      </form>
    </Card>
  );
}
