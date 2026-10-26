// Valve's game definitions use nested KeyValues with quoted strings and comments.
export function parseKeyValues(text) {
  const tokens = [...text.matchAll(/\/\/[^\n]*|"(?:\\.|[^"\\])*"|[{}]/g)]
    .map(match => match[0]).filter(token => !token.startsWith('//'));
  let cursor = 0;
  const decode = token => token.slice(1, -1).replace(/\\(["\\])/g, '$1');
  function object(nested = false) {
    const result = {};
    while (cursor < tokens.length) {
      const key = tokens[cursor++];
      if (key === '}') {
        if (!nested) throw new Error('Unexpected closing brace in Valve data');
        return result;
      }
      if (!key?.startsWith('"')) throw new Error('Invalid KeyValues key');
      const value = tokens[cursor++];
      if (!value) throw new Error('Missing KeyValues value');
      result[decode(key)] = value === '{' ? object(true) : decode(value);
    }
    if (nested) throw new Error('Unclosed KeyValues object');
    return result;
  }
  return object();
}

// These are obtained or combined in regular matches rather than bought in a shop.
const worldItems = new Set(['item_aegis', 'item_cheese', 'item_refresher_shard',
  'item_roshans_banner', 'item_tango_single', 'item_ward_dispenser',
  'item_famango', 'item_great_famango', 'item_greater_famango',
  'item_royale_with_cheese', 'item_ultimate_scepter_roshan', 'item_aghanims_shard_roshan',
  'item_eldwurms_edda', 'item_black_grimoire', 'item_grisgris', 'item_furion_gold_bag',
  'item_foragers_health', 'item_foragers_stats', 'item_foragers_mana',
  'item_tidehunter_fish', 'item_madstone_bundle', 'item_divine_regalia_broken']);

export function itemCategory(entry) {
  if (!entry.name_loc || entry.name.startsWith('item_recipe_') || entry.obsolete || entry.recipe) return null;
  if (entry.neutral_item_tier >= 0) return 'neutral';
  if (worldItems.has(entry.name)) return 'drop';
  if (entry.purchasable) return 'shop';
  return null;
}
