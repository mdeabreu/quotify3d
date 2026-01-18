import type { CurrenciesConfig } from '@payloadcms/plugin-ecommerce/types'

import { USD } from '@payloadcms/plugin-ecommerce'
import type { Currency } from '@payloadcms/plugin-ecommerce/types'

const CAD: Currency = {
  code: 'CAD',
  decimals: 2,
  label: 'Canadian Dollars',
  symbol: '$',
}

export const ecommerceCurrenciesConfig: CurrenciesConfig = {
  defaultCurrency: 'CAD',
  supportedCurrencies: [USD, CAD],
}
