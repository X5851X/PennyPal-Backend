# PennyPal Smart Financial Assistant API

> **Powered by**: Local AI-like smart categorization and financial advice

## 🎯 Features

- **Financial Chat**: Get personalized budgeting advice
- **Smart Categorization**: Auto-categorize expenses using AI
- **Spending Analysis**: Analyze patterns and get insights

## 📋 Endpoints

### 1. Get Service Info
```
GET /ai/
```

### 2. Financial Chat Assistant
```
POST /ai/chat
```

**Request:**
```json
{
  "message": "I spent $500 on groceries this month, is that too much?",
  "context": "Monthly income: $3000, Family of 4"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "For a family of 4 with $3000 monthly income, $500 on groceries (16.7%) is reasonable. The USDA suggests 10-15% for moderate plans, so you're slightly above but not excessive. Consider meal planning and bulk buying to optimize.",
    "usage": {
      "prompt_tokens": 45,
      "completion_tokens": 52,
      "total_tokens": 97
    }
  }
}
```

### 3. Auto-Categorize Expense
```
POST /ai/categorize
```

**Request:**
```json
{
  "description": "Starbucks Coffee Downtown"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "description": "Starbucks Coffee Downtown",
    "category": "Food & Dining",
    "confidence": "high"
  }
}
```

### 4. Analyze Spending Patterns
```
POST /ai/analyze
```

**Request:**
```json
{
  "expenses": [
    {"description": "Grocery Store", "amount": 120},
    {"description": "Gas Station", "amount": 45},
    {"description": "Restaurant", "amount": 80}
  ]
}
```

## 🔧 Usage Examples

### Frontend Integration
```javascript
// Chat with AI assistant
const getFinancialAdvice = async (message, userContext) => {
  const response = await fetch('/ai/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, context: userContext })
  });
  
  const data = await response.json();
  return data.data.message;
};

// Auto-categorize expense
const categorizeExpense = async (description) => {
  const response = await fetch('/ai/categorize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ description })
  });
  
  const data = await response.json();
  return data.data.category;
};
```

### Backend Integration
```javascript
import smartFinancialService from '../services/elice.js';

// In transaction controller
const addTransaction = async (req, res) => {
  const { description, amount } = req.body;
  
  // Auto-categorize using smart matching
  const category = await smartFinancialService.categorizeExpense(description);
  
  const transaction = {
    description,
    amount,
    category,
    userId: req.user.id,
    date: new Date()
  };
  
  // Save to database...
};
```

## 🎯 Use Cases for PennyPal

### 1. Smart Expense Entry
```javascript
// When user adds expense, auto-suggest category
const handleExpenseEntry = async (description) => {
  const suggestedCategory = await categorizeExpense(description);
  
  // Show suggestion to user
  showCategorySuggestion(suggestedCategory);
};
```

### 2. Budget Consultation
```javascript
// Monthly budget review
const getBudgetAdvice = async (userId) => {
  const userExpenses = await getUserExpenses(userId);
  const userIncome = await getUserIncome(userId);
  
  const context = `Monthly income: $${userIncome}, Recent expenses: ${JSON.stringify(userExpenses)}`;
  
  const advice = await getFinancialAdvice(
    'Review my spending and suggest budget improvements',
    context
  );
  
  return advice;
};
```

### 3. Spending Insights
```javascript
// Weekly spending analysis
const getWeeklyInsights = async (expenses) => {
  const insights = await analyzeSpending(expenses);
  
  return {
    summary: insights.summary,
    recommendations: insights.keywords,
    sentiment: insights.sentiment
  };
};
```

## 🔑 Configuration

No API key required - uses local smart matching algorithms.

## 📊 Available Categories

- Food & Dining
- Transportation  
- Shopping
- Entertainment
- Bills & Utilities
- Healthcare
- Education
- Travel
- Other

## 🚨 Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## 💡 Tips

1. **Context Matters**: Provide user context for better financial advice
2. **Smart Matching**: Uses comprehensive keyword matching for categorization
3. **No Rate Limits**: Local processing means no API limits
4. **Fast Response**: Instant categorization and advice