import React, { createContext, useContext, useState, useEffect } from 'react';

export type CurrencyCode = 'LKR' | 'USD' | 'EUR' | 'GBP' | 'INR';

export interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  symbol: string;
  position: 'prefix' | 'suffix';
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  LKR: {
    code: 'LKR',
    name: 'Sri Lankan Rupee (LKR)',
    symbol: 'Rs.',
    position: 'prefix'
  },
  USD: {
    code: 'USD',
    name: 'US Dollar (USD)',
    symbol: '$',
    position: 'prefix'
  },
  INR: {
    code: 'INR',
    name: 'Indian Rupee (INR)',
    symbol: '₹',
    position: 'prefix'
  },
  EUR: {
    code: 'EUR',
    name: 'Euro (EUR)',
    symbol: '€',
    position: 'prefix'
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound (GBP)',
    symbol: '£',
    position: 'prefix'
  }
};

interface CurrencyContextType {
  currency: CurrencyCode;
  currencyConfig: CurrencyConfig;
  setCurrency: (currency: CurrencyCode) => void;
  formatCurrency: (amount: number | undefined | null) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('distributor_currency');
    return (saved && (saved in CURRENCIES)) ? (saved as CurrencyCode) : 'LKR';
  });

  const currencyConfig = CURRENCIES[currency] || CURRENCIES.LKR;

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem('distributor_currency', code);
  };

  const formatCurrency = (amount: number | undefined | null): string => {
    const num = Number(amount || 0);
    const formattedNum = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    if (currencyConfig.position === 'prefix') {
      // e.g., "Rs. 1,500.00" or "$1,500.00"
      return currencyConfig.symbol === '$'
        ? `$${formattedNum}`
        : `${currencyConfig.symbol} ${formattedNum}`;
    }
    return `${formattedNum} ${currencyConfig.symbol}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, currencyConfig, setCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
