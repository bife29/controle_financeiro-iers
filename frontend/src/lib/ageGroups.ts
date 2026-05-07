/** Catálogo de faixas etárias compartilhado entre páginas. */
export const AGE_GROUPS = [
  { key: 'criancas', label: 'Crianças', range: '1-10 anos', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { key: 'pre_adolescentes', label: 'Pré-adolescentes', range: '11-13 anos', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'adolescentes', label: 'Adolescentes', range: '14-16 anos', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { key: 'jovens', label: 'Jovens', range: '17-24 (solteiros)', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'adultos', label: 'Adultos', range: '25+ ou casados', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'indefinido', label: 'Indefinido', range: 'sem data de nasc.', color: 'bg-gray-100 text-gray-600 border-gray-200' },
] as const

export type AgeGroupKey = (typeof AGE_GROUPS)[number]['key']

export const AGE_GROUP_BY_KEY: Record<string, (typeof AGE_GROUPS)[number]> =
  Object.fromEntries(AGE_GROUPS.map((g) => [g.key, g]))

export function ageGroupLabel(key?: string | null): string {
  if (!key) return '—'
  return AGE_GROUP_BY_KEY[key]?.label ?? key
}

export function ageGroupColor(key?: string | null): string {
  if (!key) return AGE_GROUP_BY_KEY['indefinido'].color
  return AGE_GROUP_BY_KEY[key]?.color ?? AGE_GROUP_BY_KEY['indefinido'].color
}
