/**
 * 既定の Character_Store シングルトン
 *
 * アプリ実行時に共有する {@link IndexedDbCharacterStore} のインスタンスを 1 つだけ
 * 生成して提供する。hooks（例: {@link ../hooks/useCollection.useCollection}）は
 * 依存性注入（DI）で任意の {@link CharacterStore} を受け取れるが、引数を省略した
 * 場合の既定値としてこのシングルトンを用いる。これにより本番コードでは単一の
 * IndexedDB 接続を使い回し、テストでは {@link ../persistence/InMemoryCharacterStore}
 * などへ差し替えられる（design.md「Persistence インターフェース」）。
 *
 * 参照: design.md「Components and Interfaces / Persistence インターフェース」、要件3.1, 3.6
 */
import type { CharacterStore } from './CharacterStore';
import { IndexedDbCharacterStore } from './IndexedDbCharacterStore';

/**
 * アプリ全体で共有する既定の Character_Store。
 *
 * 単一の IndexedDB 接続を使い回すため、モジュール読み込み時に一度だけ生成する。
 * テスト時は各 hook に別のストアを引数で注入して差し替える。
 */
export const defaultCharacterStore: CharacterStore = new IndexedDbCharacterStore();
