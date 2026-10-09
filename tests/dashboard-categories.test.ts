import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardCategories, dashboardCategoryHref, isDashboardCategory } from '../lib/dashboard/categories.ts';

test('all nine dashboard cards link to distinct matching site categories', () => {
  const links = Object.entries(dashboardCategories).map(([key, category]) => {
    assert.equal(dashboardCategoryHref(category.label), `/dashboard/sites?category=${key}`);
    assert.equal(isDashboardCategory(key), true);
    return dashboardCategoryHref(category.label);
  });
  assert.equal(new Set(links).size, 9);
  for (const value of ['__proto__', 'constructor', 'unknown', '']) assert.equal(isDashboardCategory(value), false);
});
