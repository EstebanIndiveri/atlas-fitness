'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RoutineEditorForm } from '@/components/routines/RoutineEditorForm';
import { PageContainer } from '@/components/shell/PageContainer';
import { LoadingState } from '@/components/ui/states';
import { useRoutineEditor } from '@/hooks/useRoutineEditor';
import { ROUTINE_COPY } from '@/lib/copy/routines';

export default function NewRoutinePage() {
  const router = useRouter();
  const editor = useRoutineEditor('create');

  if (editor.loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <Link href="/dashboard/routines" className="text-sm font-medium text-brand hover:underline">
        {ROUTINE_COPY.backToList}
      </Link>
      <div className="mt-4">
        <RoutineEditorForm
          mode="create"
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
