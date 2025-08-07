import axios from 'axios';

class EliceFinancialService {
  constructor() {
    this.apiKey = process.env.ELICE_API_KEY;
    this.baseUrl = 'https://api-cloud-function.elice.io/a81b3c65-b99b-4f02-b9c9-9b27f0ada590/generate';
    this.financialAdvice = {
      budget: [
        "The 50/30/20 rule is a great starting point: 50% needs, 30% wants, 20% savings.",
        "Track your expenses for a month to understand your spending patterns.",
        "Start with small, achievable savings goals to build momentum."
      ],
      spending: [
        "Review your subscriptions monthly - cancel unused services.",
        "Use the 24-hour rule for non-essential purchases over $50.",
        "Consider generic brands to save 20-30% on groceries."
      ],
      savings: [
        "Automate your savings - pay yourself first.",
        "Build an emergency fund of 3-6 months expenses.",
        "Use high-yield savings accounts for better returns."
      ],
      debt: [
        "Pay minimum on all debts, then focus extra on highest interest rate.",
        "Consider debt consolidation if it lowers your overall interest rate.",
        "Avoid taking on new debt while paying off existing debt."
      ]
    };
  }

  // Try Elice API first, fallback to local advice
  async getFinancialAdvice(userMessage, userContext = '') {
    if (this.apiKey) {
      try {
        const response = await axios.post(this.baseUrl, {
          messages: [
            {
              role: 'system',
              content: `You are PennyPal's financial advisor. Help with budgeting, expense tracking, and financial planning. Context: ${userContext}`
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
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        
        if (response.status === 200 && response.data) {
          return response.data;
        }
      } catch (error) {
        console.warn('Elice API failed, using local advice:', error.message);
      }
    }
    
    // Fallback to local advice
    return this.getLocalAdvice(userMessage);
  }
  
  getLocalAdvice(userMessage) {
    const message = userMessage.toLowerCase();
    let advice = "I'd be happy to help with your financial questions!";
    
    if (message.includes('budget') || message.includes('budgeting')) {
      advice = this.getRandomAdvice('budget');
    } else if (message.includes('save') || message.includes('saving')) {
      advice = this.getRandomAdvice('savings');
    } else if (message.includes('spend') || message.includes('expense')) {
      advice = this.getRandomAdvice('spending');
    } else if (message.includes('debt') || message.includes('loan')) {
      advice = this.getRandomAdvice('debt');
    } else if (message.includes('grocery') || message.includes('food')) {
      advice = "For groceries, try meal planning, buying in bulk, and using store brands to save 20-30%.";
    } else if (message.includes('emergency')) {
      advice = "Build an emergency fund with 3-6 months of expenses in a high-yield savings account.";
    }
    
    return {
      choices: [{ message: { content: advice } }],
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 }
    };
  }
  
  getRandomAdvice(category) {
    const adviceList = this.financialAdvice[category] || this.financialAdvice.budget;
    return adviceList[Math.floor(Math.random() * adviceList.length)];
  }

  // Try Elice API for categorization, fallback to local
  async categorizeExpense(description) {
    if (this.apiKey) {
      try {
        const response = await axios.post(this.baseUrl, {
          messages: [
            {
              role: 'system',
              content: 'Categorize expenses into: Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Other. Respond with only the category name.'
            },
            {
              role: 'user',
              content: `Categorize: ${description}`
            }
          ],
          max_tokens: 10,
          temperature: 0.1
        }, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
          const category = this.extractCategory(response.data.choices[0].message.content);
          if (category) return category;
        }
      } catch (error) {
        console.warn('Elice categorization failed, using local:', error.message);
      }
    }
    
    return this.smartCategorize(description);
  }
  
  extractCategory(text) {
    const categories = ['Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Education', 'Travel'];
    for (const category of categories) {
      if (text.includes(category)) return category;
    }
    return null;
  }

  // Smart categorization using comprehensive keywords
  smartCategorize(description) {
    const text = description.toLowerCase();
    
    // Food & Dining
    if (text.match(/restaurant|food|cafe|starbucks|mcdonald|kfc|pizza|burger|dining|eat|meal|lunch|dinner|breakfast|grocery|supermarket|market/)) {
      return 'Food & Dining';
    }
    
    // Transportation
    if (text.match(/gas|fuel|uber|taxi|transport|bus|train|parking|toll|car|vehicle|maintenance|repair|oil change/)) {
      return 'Transportation';
    }
    
    // Shopping
    if (text.match(/store|shop|mall|amazon|ebay|clothing|clothes|shoes|electronics|gadget|purchase|buy/)) {
      return 'Shopping';
    }
    
    // Entertainment
    if (text.match(/movie|cinema|game|entertainment|netflix|spotify|music|concert|theater|fun|hobby/)) {
      return 'Entertainment';
    }
    
    // Bills & Utilities
    if (text.match(/electric|electricity|water|internet|phone|mobile|cable|insurance|rent|mortgage|utility|bill/)) {
      return 'Bills & Utilities';
    }
    
    // Healthcare
    if (text.match(/doctor|hospital|pharmacy|medicine|health|medical|dental|clinic|prescription/)) {
      return 'Healthcare';
    }
    
    // Education
    if (text.match(/school|education|tuition|book|course|training|learning|university|college/)) {
      return 'Education';
    }
    
    // Travel
    if (text.match(/hotel|flight|travel|vacation|trip|airline|booking|airbnb/)) {
      return 'Travel';
    }
    
    return 'Other';
  }

  // Smart spending analysis
  async analyzeSpending(expenses) {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const categories = {};
    
    expenses.forEach(exp => {
      const category = this.smartCategorize(exp.description);
      categories[category] = (categories[category] || 0) + exp.amount;
    });
    
    const topCategory = Object.keys(categories).reduce((a, b) => 
      categories[a] > categories[b] ? a : b
    );
    
    const insights = [
      `Total spending: $${total.toFixed(2)}`,
      `Top category: ${topCategory} ($${categories[topCategory].toFixed(2)})`,
      `Average per transaction: $${(total / expenses.length).toFixed(2)}`
    ];
    
    return {
      summary: insights.join('. '),
      keywords: Object.keys(categories),
      sentiment: total > 500 ? 'concerned' : 'neutral',
      categories
    };
  }
}

export default new EliceFinancialService();