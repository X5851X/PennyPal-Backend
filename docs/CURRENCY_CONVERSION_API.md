# Currency Conversion API Documentation

## Overview
This API provides comprehensive currency conversion functionality for PennyPal transactions using Open Exchange Rates API.

## Features
- Real-time currency conversion using Open Exchange Rates
- Bulk transaction conversion
- Support for 18+ major currencies
- Cached exchange rates with automatic refresh
- User-specific conversion history

## Supported Currencies
- IDR (Indonesian Rupiah)
- USD (US Dollar) 
- EUR (Euro)
- JPY (Japanese Yen)
- SGD (Singapore Dollar)
- MYR (Malaysian Ringgit)
- KRW (South Korean Won)
- AUD (Australian Dollar)
- GBP (British Pound)
- CHF (Swiss Franc)
- CAD (Canadian Dollar)
- CNY (Chinese Yuan)
- HKD (Hong Kong Dollar)
- THB (Thai Baht)
- PHP (Philippine Peso)
- VND (Vietnamese Dong)
- INR (Indian Rupee)
- BRL (Brazilian Real)

## API Endpoints

### 1. Get Currency Rates
```
GET /api/currency/rates?baseCurrency=USD
```
Returns formatted currency rates with symbols and names.

### 2. Refresh Exchange Rates
```
POST /api/currency/refresh
Content-Type: application/json

{
  "base": "USD"
}
```
Fetches latest rates from Open Exchange Rates API.

### 3. Convert Single Amount
```
POST /api/currency/convert
Content-Type: application/json

{
  "amount": 100000,
  "fromCurrency": "IDR",
  "toCurrency": "USD"
}
```

### 4. Get User Transactions (Converted)
```
GET /api/currency/transactions-converted?targetCurrency=USD&page=1&limit=50
Authorization: Bearer <token>
```
Returns user's transactions converted to target currency with pagination.

### 5. Convert Transaction Batch
```
POST /api/currency/convert-batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionIds": ["64a1b2c3d4e5f6789012345", "64a1b2c3d4e5f6789012346"],
  "targetCurrency": "USD"
}
```

### 6. Convert Multiple Transactions (Array)
```
POST /api/currency/convert-transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactions": [
    {
      "id": "64a1b2c3d4e5f6789012345",
      "amount": 50000,
      "currency": "IDR",
      "title": "Lunch"
    },
    {
      "id": "64a1b2c3d4e5f6789012346", 
      "amount": 25,
      "currency": "USD",
      "title": "Coffee"
    }
  ],
  "targetCurrency": "SGD"
}
```

## Frontend Integration Example

### Currency Converter Component Flow

```javascript
// 1. Get available currencies
const getCurrencies = async () => {
  const response = await fetch('/api/currency/supported');
  const data = await response.json();
  return data.data.currencies;
};

// 2. Show currency selection modal
const showCurrencyConverter = () => {
  // Display modal with currency options
  // User selects target currency (e.g., USD, SGD, EUR)
};

// 3. Get conversion preview
const getConversionPreview = async (targetCurrency) => {
  const transactionIds = getCurrentPageTransactionIds();
  
  const response = await fetch('/api/currency/convert-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      transactionIds,
      targetCurrency
    })
  });
  
  const data = await response.json();
  return data.data.convertedTransactions;
};

// 4. Apply conversion to page
const applyConversion = async (targetCurrency) => {
  try {
    // Show loading state
    setLoading(true);
    
    // Get converted transactions
    const convertedData = await getConversionPreview(targetCurrency);
    
    // Update UI with converted amounts
    updateTransactionDisplay(convertedData);
    
    // Update page currency indicator
    setPageCurrency(targetCurrency);
    
    // Show success message
    showNotification(`All transactions converted to ${targetCurrency}`);
    
  } catch (error) {
    showError('Conversion failed: ' + error.message);
  } finally {
    setLoading(false);
  }
};

// 5. Update transaction display
const updateTransactionDisplay = (convertedTransactions) => {
  convertedTransactions.forEach(transaction => {
    const element = document.getElementById(`transaction-${transaction.id}`);
    if (element) {
      // Update amount display
      element.querySelector('.amount').textContent = transaction.formattedConverted;
      
      // Show original amount as tooltip or small text
      element.querySelector('.original-amount').textContent = 
        `(${transaction.formattedOriginal})`;
      
      // Update currency symbol
      element.querySelector('.currency').textContent = transaction.convertedCurrency;
    }
  });
};
```

### Complete Frontend Flow

```javascript
class CurrencyConverter {
  constructor() {
    this.currentCurrency = 'IDR'; // default
    this.originalTransactions = []; // store original data
  }

  // Initialize converter button
  init() {
    const converterBtn = document.getElementById('currency-converter-btn');
    converterBtn.addEventListener('click', () => this.showConverter());
  }

  // Show currency selection modal
  async showConverter() {
    const currencies = await this.getSupportedCurrencies();
    
    // Create modal with currency options
    const modal = this.createCurrencyModal(currencies);
    document.body.appendChild(modal);
  }

  // Create currency selection modal
  createCurrencyModal(currencies) {
    const modal = document.createElement('div');
    modal.className = 'currency-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Convert Page Currency</h3>
        <p>Select target currency for all transactions on this page:</p>
        <div class="currency-grid">
          ${currencies.map(curr => `
            <button class="currency-option" data-currency="${curr}">
              ${this.getCurrencySymbol(curr)} ${curr}
            </button>
          `).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn-cancel">Cancel</button>
        </div>
      </div>
    `;

    // Add event listeners
    modal.querySelectorAll('.currency-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetCurrency = e.target.dataset.currency;
        this.convertPage(targetCurrency);
        modal.remove();
      });
    });

    modal.querySelector('.btn-cancel').addEventListener('click', () => {
      modal.remove();
    });

    return modal;
  }

  // Convert entire page to target currency
  async convertPage(targetCurrency) {
    try {
      // Show loading
      this.showLoading(true);

      // Get current page transactions
      const transactionIds = this.getCurrentPageTransactionIds();
      
      // Convert transactions
      const response = await fetch('/api/currency/convert-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          transactionIds,
          targetCurrency
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Update page display
        this.updatePageDisplay(result.data.convertedTransactions, targetCurrency);
        
        // Show success message
        this.showNotification(`Page converted to ${targetCurrency}`, 'success');
      } else {
        throw new Error(result.message);
      }

    } catch (error) {
      this.showNotification(`Conversion failed: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  // Update page display with converted amounts
  updatePageDisplay(convertedTransactions, targetCurrency) {
    this.currentCurrency = targetCurrency;
    
    convertedTransactions.forEach(transaction => {
      if (!transaction.error) {
        const element = document.querySelector(`[data-transaction-id="${transaction.id}"]`);
        if (element) {
          // Update main amount
          const amountEl = element.querySelector('.transaction-amount');
          amountEl.textContent = transaction.formattedConverted;
          
          // Show original amount
          const originalEl = element.querySelector('.original-amount') || 
                           this.createOriginalAmountElement();
          originalEl.textContent = `(Originally ${transaction.formattedOriginal})`;
          
          // Update currency indicator
          element.querySelector('.currency-code').textContent = targetCurrency;
        }
      }
    });

    // Update page currency indicator
    this.updatePageCurrencyIndicator(targetCurrency);
  }

  // Helper methods
  getCurrentPageTransactionIds() {
    return Array.from(document.querySelectorAll('[data-transaction-id]'))
                .map(el => el.dataset.transactionId);
  }

  async getSupportedCurrencies() {
    const response = await fetch('/api/currency/supported');
    const data = await response.json();
    return data.data.currencies;
  }

  getCurrencySymbol(currency) {
    const symbols = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
      'SGD': 'S$', 'IDR': 'Rp', 'MYR': 'RM', 'KRW': '₩'
    };
    return symbols[currency] || currency;
  }

  getToken() {
    return localStorage.getItem('authToken');
  }

  showLoading(show) {
    const loader = document.getElementById('currency-loader');
    loader.style.display = show ? 'block' : 'none';
  }

  showNotification(message, type = 'info') {
    // Implement your notification system
    console.log(`${type.toUpperCase()}: ${message}`);
  }

  updatePageCurrencyIndicator(currency) {
    const indicator = document.getElementById('page-currency-indicator');
    if (indicator) {
      indicator.textContent = `Showing amounts in ${currency}`;
    }
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  const converter = new CurrencyConverter();
  converter.init();
});
```

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "needsRefresh": true  // When rates need to be refreshed
}
```

## Rate Limiting & Caching

- Exchange rates are cached for 1 hour by default
- Automatic fallback to cached rates if API fails
- Cleanup of expired rates runs automatically

## Security

- All conversion endpoints require authentication
- User can only convert their own transactions
- Rate limiting applied to prevent abuse