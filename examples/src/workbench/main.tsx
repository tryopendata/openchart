import { createRoot } from 'react-dom/client';
import '@opendata-ai/openchart-core/styles.css';
import './studio.css';
import { RecoveryBoundary } from './RecoveryBoundary';
import { Workbench } from './Workbench';

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <RecoveryBoundary>
      {(restoreDraft) => <Workbench restoreDraft={restoreDraft} />}
    </RecoveryBoundary>,
  );
