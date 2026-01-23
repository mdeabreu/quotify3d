import { USD } from '@payloadcms/plugin-ecommerce'
import type { CurrenciesConfig, Currency } from '@payloadcms/plugin-ecommerce/types'

const CAD: Currency = {
  code: 'CAD',
  decimals: 2,
  label: 'Canadian Dollars',
  symbol: '$',
}

export const currenciesConfig: CurrenciesConfig = {
  defaultCurrency: 'CAD',
  supportedCurrencies: [USD, CAD],
}
