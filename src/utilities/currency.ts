import { currenciesConfig } from '@/config/currencies'

export const getDefaultCurrencyCode = (): string => currenciesConfig.defaultCurrency.toUpperCase()

export const getPriceFieldForCurrencyCode = (currencyCode: string): string =>
  `priceIn${currencyCode.toUpperCase()}`

export const getDefaultPriceField = (): string =>
  getPriceFieldForCurrencyCode(getDefaultCurrencyCode())
