# OCR API Guide - Date & Amount Handling

## Perubahan Utama

### 1. Date Handling
- **Sebelum**: Date selalu otomatis menggunakan tanggal hari ini jika parsing gagal
- **Sekarang**: Date akan `null` jika tidak berhasil di-extract dari receipt, tidak otomatis pakai tanggal hari ini

### 2. Response Format
OCR endpoint sekarang mengembalikan data yang lebih mudah untuk frontend:

```json
{
  "success": true,
  "data": {
    "receiptId": "receipt_id",
    "receipt": {
      "id": "receipt_id",
      "storeName": "ALFAMART",
      "date": "2025-01-08", // Format YYYY-MM-DD atau null
      "time": "15:45:22",
      "amount": 144855,
      "subtotal": 130500,
      "tax": 14355,
      "currency": "IDR",
      "items": [...],
      "confidence": "high",
      "status": "verified"
    },
    "editEndpoints": {
      "quickEdit": "/ocr/receipts/{id}/quick-edit",
      "fullEdit": "/ocr/receipts/{id}",
      "view": "/ocr/receipts/{id}"
    }
  }
}
```

## API Endpoints untuk Edit

### 1. Quick Edit (Untuk Amount & Date)
```http
PATCH /ocr/receipts/{id}/quick-edit
Content-Type: application/json

{
  "amount": 150000,
  "date": "2025-01-08",  // YYYY-MM-DD format atau "" untuk null
  "storeName": "Updated Store Name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Receipt updated successfully",
  "data": {
    "id": "receipt_id",
    "storeName": "Updated Store Name",
    "date": "2025-01-08",
    "amount": 150000,
    "currency": "IDR"
  }
}
```

### 2. Get Receipt for Editing
```http
GET /ocr/receipts/{id}/edit
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "receipt_id",
    "storeName": "ALFAMART",
    "date": "2025-01-08", // YYYY-MM-DD atau ""
    "time": "15:45:22",
    "amount": 144855,
    "subtotal": 130500,
    "tax": 14355,
    "currency": "IDR",
    "items": [...],
    "status": "verified",
    "confidence": "high"
  }
}
```

### 3. Full Update
```http
PUT /ocr/receipts/{id}
Content-Type: application/json

{
  "storeName": "New Store Name",
  "receiptDate": "2025-01-08", // ISO date atau null
  "receiptTime": "16:30:00",
  "total": 200000,
  "subtotal": 180000,
  "tax": 20000,
  "currency": "IDR"
}
```

## Frontend Implementation Tips

### 1. Handle Null Dates
```javascript
// Saat menampilkan date
const displayDate = receipt.date || 'Tanggal tidak terdeteksi';

// Saat edit date
const dateInput = receipt.date || ''; // Empty string untuk input kosong
```

### 2. Easy Amount Editing
```javascript
// Format amount untuk display
const formatAmount = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(amount);
};

// Parse amount dari input
const parseAmount = (input) => {
  return parseFloat(input.replace(/[^\d.-]/g, '')) || 0;
};
```

### 3. Quick Edit Function
```javascript
const quickEditReceipt = async (receiptId, updates) => {
  try {
    const response = await fetch(`/ocr/receipts/${receiptId}/quick-edit`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('Receipt updated:', result.data);
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Update failed:', error);
    throw error;
  }
};

// Usage
await quickEditReceipt('receipt_id', {
  amount: 150000,
  date: '2025-01-08',
  storeName: 'Updated Store'
});
```

### 4. Date Input Component
```javascript
// React component example
const DateInput = ({ value, onChange }) => {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder="Pilih tanggal receipt"
    />
  );
};
```

## Error Handling

### Common Errors:
- `400`: Invalid amount (negative or not a number)
- `400`: Invalid date format
- `404`: Receipt not found
- `500`: Server error

### Example Error Response:
```json
{
  "success": false,
  "message": "Amount must be a valid positive number"
}
```

## Validation Rules

### Amount:
- Must be positive number
- Can be 0
- No negative values

### Date:
- Format: YYYY-MM-DD
- Can be null/empty
- Must be reasonable (not too far in future/past)

### Currency:
- Supported: IDR, USD, EUR, JPY, SGD, MYR, KRW
- Default: IDR