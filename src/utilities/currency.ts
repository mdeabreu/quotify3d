import { currenciesConfig } from '@/config/currencies'

export const getDefaultCurrencyCode = (): string => currenciesConfig.defaultCurrency.toUpperCase()

export const getPriceFieldForCurrencyCode = (currencyCode: string): string =>
  `priceIn${currencyCode.toUpperCase()}`

export const getDefaultPriceField = (): string =>
  getPriceFieldForCurrencyCode(getDefaultCurrencyCode())

export const toMinorUnitAmount = (amount: unknown): number | undefined => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return undefined
  }

  return Math.round(amount)
}
