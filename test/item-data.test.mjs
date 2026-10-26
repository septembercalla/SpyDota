import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKeyValues, itemCategory } from '../scripts/item-data.mjs';

test('Valve KeyValues parser handles nested properties, comments and quoted punctuation', () => {
  const data = parseKeyValues(`"DOTAAbilities" {
    // "item_fake" { "ItemPurchasable" "1" }
    "item_real" { "ItemCost" "0" // a free shop item
      "AbilityValues" { "description" "text with { braces }" }
      // "ItemPurchasable" "0"
      "ItemPurchasable" "1"
    }
  }`);
  assert.deepEqual(data, { DOTAAbilities: { item_real: {
    ItemCost: '0', AbilityValues: { description: 'text with { braces }' }, ItemPurchasable: '1'
  } } });
  assert.throws(() => parseKeyValues('"DOTAAbilities" { "item_real" { "ItemCost" "5" }'));
});

test('active neutrals and zero-cost world items remain eligible while recipes and obsolete entries do not', () => {
  const entry = { name: 'item_ward_observer', name_loc: 'Observer Ward', purchasable: true,
    neutral_item_tier: -1, obsolete: false, recipe: false };
  assert.equal(itemCategory(entry), 'shop');
  assert.equal(itemCategory({ ...entry, name: 'item_chipped_vest', purchasable: false, neutral_item_tier: 0 }), 'neutral');
  assert.equal(itemCategory({ ...entry, name: 'item_aegis', purchasable: false }), 'drop');
  assert.equal(itemCategory({ ...entry, name: 'item_recipe_test' }), null);
  assert.equal(itemCategory({ ...entry, obsolete: true }), null);
  assert.equal(itemCategory({ ...entry, recipe: true }), null);
  assert.equal(itemCategory({ ...entry, name: 'item_enhancement_alert', purchasable: false }), null);
});
