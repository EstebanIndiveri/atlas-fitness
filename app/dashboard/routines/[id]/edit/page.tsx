'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RoutineEditorForm } from '@/components/routines/RoutineEditorForm';
import { PageContainer } from '@/components/shell/PageContainer';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { useRoutineEditor } from '@/hooks/useRoutineEditor';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';

export default function EditRoutinePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rawId = typeof params.id === 'string' ? Number.parseInt(params.id, 10) : Number.NaN;
  const routineId = Number.isNaN(rawId) ? undefined : rawId;
  const editor = useRoutineEditor('edit', routineId);

  if (editor.loading) {
    return <LoadingState />;
  }

  if (editor.notFound || routineId === undefined) {
    return (
      <PageContainer>
        <div data-testid={ROUTINE_TEST_IDS.notFound}>
          <EmptyState
            title={ROUTINE_COPY.notFound}
            description={ROUTINE_COPY.notFoundBody}
            action={
              <Link href="/dashboard/routines" className="text-sm font-medium text-brand hover:underline">
                {ROUTINE_COPY.backToList}
              </Link>
            }
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link href="/dashboard/routines" className="text-sm font-medium text-brand hover:underline">
        {ROUTINE_COPY.backToList}
      </Link>
      <div className="mt-4">
        <RoutineEditorForm
          mode="edit"
          draft={editor.draft}
          catalog={editor.catalog}
          selectedExerciseId={editor.selectedExerciseId}
          validation={editor.validation}
          error={editor.error}
          duplicateMessage={editor.duplicateMessage}
          readOnly={editor.readOnly}
          busy={editor.busy}
          onMetaChange={editor.onMetaChange}
          onSelectExercise={editor.setSelectedExerciseId}
          onAddExercise={editor.onAddExercise}
          onUpdateExercise={editor.onUpdateExercise}
          onMoveExercise={editor.onMoveExercise}
          onRemoveExercise={editor.onRemoveExercise}
          onSubmit={() => {
            void editor.save().then((saved) => {
              if (saved) router.push('/dashboard/routines');
            });
          }}
        />
      </div>
    </PageContainer>
  );
}
