# Elice AI Services for PennyPal

> **Dokumentasi**: https://elice-ai.readme.io/reference/helpy-hub

## 🎯 API yang Berguna untuk PennyPal

### 1. 💬 Chat Assistant (Helpy Hub)
```
POST https://api.elice.ai/v1/chat/completions
```

**Use Case**: Financial advice, expense categorization, budgeting tips

**Request:**
```json
{
  "model": "helpy-hub",
  "messages": [
    {
      "role": "system",
      "content": "You are a financial advisor helping users manage their expenses."
    },
    {
      "role": "user",
      "content": "I spent $500 on groceries this month, is that too much?"
    }
  ],
  "max_tokens": 150
}
```

### 2. 📊 Text Classification
```
POST https://api.elice.ai/v1/classify
```

**Use Case**: Auto-categorize expenses from transaction descriptions

**Request:**
```json
{
  "text": "Starbucks Coffee Downtown",
  "categories": ["Food & Dining", "Transportation", "Shopping", "Entertainment", "Bills"]
}
```

### 3. 🔍 Text Analysis
```
POST https://api.elice.ai/v1/analyze
```

**Use Case**: Extract spending patterns, sentiment analysis on financial notes

**Request:**
```json
{
  "text": "I'm worried about my spending habits this month",
  "tasks": ["sentiment", "keywords", "summary"]
}
```

## 🛠️ Implementation Examples

### Financial Chat Assistant
```javascript
import axios from 'axios';

const getFinancialAdvice = async (userMessage, context = '') => {
  try {
    const response = await axios.post('https://api.elice.ai/v1/chat/completions', {
      model: 'helpy-hub',
      messages: [
        {
          role: 'system',
          content: `You are PennyPal's financial advisor. Help users with budgeting, expense tracking, and financial planning. Context: ${context}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ELICE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Financial advice failed:', error);
    throw error;
  }
};
```

### Auto-Categorize Expenses
```javascript
const categorizeExpense = async (description) => {
  try {
    const response = await axios.post('https://api.elice.ai/v1/classify', {
      text: description,
      categories: [
        'Food & Dining',
        'Transportation', 
        'Shopping',
        'Entertainment',
        'Bills & Utilities',
        'Healthcare',
        'Education',
        'Travel'
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ELICE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.category;
  } catch (error) {
    console.error('Expense categorization failed:', error);
    return 'Other';
  }
};
```

## 🔧 Environment Configuration

Update your `.env` file:
```env
# Elice AI API Configuration
ELICE_API_KEY=your_elice_api_key_here
ELICE_API_BASE_URL=https://api.elice.ai/v1
```

## 🎯 PennyPal Use Cases

### 1. Smart Expense Categorization
```javascript
// Auto-categorize when user adds expense
const addExpense = async (description, amount) => {
  const category = await categorizeExpense(description);
  
  return {
    description,
    amount,
    category,
    date: new Date()
  };
};
```

### 2. Financial Insights Chat
```javascript
// Provide personalized financial advice
const getSpendingInsights = async (userId) => {
  const userExpenses = await getUserExpenses(userId);
  const context = `User's monthly expenses: ${JSON.stringify(userExpenses)}`;
  
  const advice = await getFinancialAdvice(
    'Analyze my spending patterns and give me budgeting advice',
    context
  );
  
  return advice;
};
```

### 3. Receipt Analysis
```javascript
// Analyze OCR text from receipts
const analyzeReceipt = async (ocrText) => {
  const analysis = await axios.post('https://api.elice.ai/v1/analyze', {
    text: ocrText,
    tasks: ['extract_amounts', 'extract_items', 'categorize']
  });
  
  return {
    items: analysis.data.items,
    total: analysis.data.total,
    category: analysis.data.category
  };
};
```

## 🚀 Implementation Priority

### Phase 1: Essential Features
1. **Financial Chat Assistant** - Help users with budgeting questions
2. **Expense Categorization** - Auto-categorize transactions

### Phase 2: Advanced Features
3. **Receipt Analysis** - Extract data from OCR text
4. **Spending Pattern Analysis** - Identify trends and insights
5. **Budget Recommendations** - AI-powered financial advice

## 📁 Suggested File Structure
```
services/
├── elice/
│   ├── chat.js          # Financial chat assistant
│   ├── classify.js      # Expense categorization
│   ├── analyze.js       # Text analysis
│   └── index.js         # Main Elice service
routes/
├── ai-assistant.js      # Chat endpoints
└── smart-categorize.js  # Auto-categorization
```

## 📞 Support

- **Elice AI Docs**: https://elice-ai.readme.io/reference/helpy-hub
- **API Key**: Configure in `.env` as `ELICE_API_KEY`
- **Rate Limits**: Check documentation for usage limits