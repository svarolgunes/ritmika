import { EditorScreen } from '../../components/EditorScreen';
import { ENSEMBLE_PRESETS } from '../../data/presets';
import { useSettings } from '../../lib/settings';

/** Several instruments, each on its own staff, played together. */
export default function EnsembleScreen() {
  const { t } = useSettings();
  return (
    <EditorScreen
      storageKey="ritmika.ensemble.v1"
      title={t.tabEnsemble}
      subtitle={t.ensembleSubtitle}
      presets={ENSEMBLE_PRESETS}
      ensemble
    />
  );
}
