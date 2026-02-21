import { getDefaultPriceField } from '@/utilities/currency'

export type SortFilterItem = {
  reverse: boolean
  slug: null | string
  title: string
}

export const defaultSort: SortFilterItem = {
  slug: null,
  reverse: false,
  title: 'Alphabetic A-Z',
}

const defaultPriceSortField = getDefaultPriceField()

export const sorting: SortFilterItem[] = [
  defaultSort,
  { slug: '-createdAt', reverse: true, title: 'Latest arrivals' },
  { slug: defaultPriceSortField, reverse: false, title: 'Price: Low to high' }, // asc
  { slug: `-${defaultPriceSortField}`, reverse: true, title: 'Price: High to low' },
]
