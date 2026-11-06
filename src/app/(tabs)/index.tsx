import { EditorScreen } from '../../components/EditorScreen';
import { SOLO_PRESETS } from '../../data/presets';
import { useSettings } from '../../lib/settings';

/** One instrument on one staff. */
export default function SoloScreen() {
  const { t } = useSettings();
  return <EditorScreen storageKey="ritmika.solo.v1" title={t.appName} subtitle={t.soloSubtitle} presets={SOLO_PRESETS} ensemble={false} />;
}
