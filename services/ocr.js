// Enhanced OCR Service with Google Cloud Vision Fallback - services/ocr.js
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.initPromise = null;
    
    // Google Cloud Vision configuration
    this.googleVisionConfig = {
      apiKey: process.env.GOOGLE_CLOUD_API_KEY, // Set your API key in environment
      endpoint: 'https://vision.googleapis.com/v1/images:annotate'
    };
    
    // Category detection patterns
    this.categoryPatterns = {
      food: {
        keywords: ['restaurant', 'cafe', 'warung', 'resto', 'food', 'makanan', 'minuman', 'drink', 'pizza', 'burger', 'nasi', 'ayam', 'sate', 'bakso', 'mie', 'coffee', 'kopi', 'tea', 'teh'],
        patterns: [/menu/i, /table.*\d+/i, /waiter/i, /pelayan/i]
      },
      shopping: {
        keywords: ['supermarket', 'mall', 'store', 'shop', 'toko', 'minimarket', 'indomaret', 'alfamart', 'hypermart', 'carrefour', 'giant', 'lottemart'],
        patterns: [/barcode/i, /sku/i, /qty.*\d+/i]
      },
      grocery: {
        keywords: ['grocery', 'fresh', 'vegetables', 'fruit', 'meat', 'sayur', 'buah', 'daging', 'ikan', 'telur', 'susu', 'roti', 'beras'],
        patterns: [/kg/i, /gram/i, /liter/i, /pcs/i]
      },
      pharmacy: {
        keywords: ['pharmacy', 'apotek', 'kimia farma', 'guardian', 'watson', 'medicine', 'obat', 'vitamin'],
        patterns: [/tablet/i, /capsule/i, /sirup/i, /mg/i]
      },
      fuel: {
        keywords: ['pertamina', 'shell', 'total', 'fuel', 'bensin', 'solar', 'premium', 'pertalite'],
        patterns: [/liter/i, /spbu/i, /fuel.*station/i]
      },
      transport: {
        keywords: ['taxi', 'grab', 'gojek', 'uber', 'ojek', 'bus', 'kereta', 'toll', 'parking', 'parkir'],
        patterns: [/km/i, /distance/i, /jarak/i]
      }
    };
  }

  async initialize() {
    // Prevent multiple initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized) {
      return Promise.resolve();
    }
    
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('🔄 Initializing OCR worker...');
      
      // Create worker with proper configuration and timeout
      const workerPromise = Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        errorHandler: (err) => {
          console.error('Tesseract error:', err);
        }
      });

      // Add timeout for worker creation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OCR worker initialization timeout after 30 seconds')), 30000);
      });

      this.worker = await Promise.race([workerPromise, timeoutPromise]);
      
      console.log('📚 Loading language model...');
      await this.worker.loadLanguage('eng');
      
      console.log('🚀 Initializing worker...');
      await this.worker.initialize('eng');
      
      console.log('⚙️ Setting parameters...');
      // Optimized parameters for receipt recognition
      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:-$€£¥₹ ()/\\n',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      });
      
      this.isInitialized = true;
      console.log('✅ OCR Worker initialized successfully');
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Failed to initialize OCR worker:', error);
      this.isInitialized = false;
      this.initPromise = null;
      
      // Clean up any partial worker
      if (this.worker) {
        try {
          await this.worker.terminate();
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup partial worker:', cleanupError);
        }
        this.worker = null;
      }
      
      throw new Error(`OCR initialization failed: ${error.message}`);
    }
  }

  async preprocessImage(imageBuffer) {
    try {
      // Process image in memory without saving to disk
      const processedBuffer = await sharp(imageBuffer)
        .resize(null, 2000, { 
          withoutEnlargement: true, 
          kernel: sharp.kernel.lanczos3 
        })
        .grayscale()
        .normalize()
        .linear(1.2, -(128 * 1.2) + 128)
        .sharpen({ sigma: 1, flat: 1, jagged: 2 })
        .threshold(128)
        .jpeg({ quality: 100, progressive: false, mozjpeg: true })
        .toBuffer();
      
      return processedBuffer;
    } catch (error) {
      console.error('⚠️ Image preprocessing failed:', error.message);
      return imageBuffer;
    }
  }

  // Google Cloud Vision OCR
  async extractTextWithGoogleVision(imageBuffer) {
    try {
      if (!this.googleVisionConfig.apiKey) {
        throw new Error('Google Cloud API key not configured');
      }

      console.log('☁️ Using Google Cloud Vision API...');

      // Use buffer directly
      const base64Image = imageBuffer.toString('base64');

      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1
              },
              {
                type: 'DOCUMENT_TEXT_DETECTION',
                maxResults: 1
              }
            ],
            imageContext: {
              languageHints: ['en', 'id'] // English and Indonesian
            }
          }
        ]
      };

      const response = await fetch(
        `${this.googleVisionConfig.endpoint}?key=${this.googleVisionConfig.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google Vision API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      
      if (data.responses && data.responses[0]) {
        const result = data.responses[0];
        
        // Use DOCUMENT_TEXT_DETECTION if available, otherwise TEXT_DETECTION
        let extractedText = '';
        let confidence = 0;

        if (result.fullTextAnnotation) {
          extractedText = result.fullTextAnnotation.text || '';
          // Calculate average confidence from all words
          const pages = result.fullTextAnnotation.pages || [];
          let totalConfidence = 0;
          let wordCount = 0;
          
          pages.forEach(page => {
            page.blocks?.forEach(block => {
              block.paragraphs?.forEach(paragraph => {
                paragraph.words?.forEach(word => {
                  if (word.confidence !== undefined) {
                    totalConfidence += word.confidence;
                    wordCount++;
                  }
                });
              });
            });
          });
          
          confidence = wordCount > 0 ? (totalConfidence / wordCount) * 100 : 95;
        } else if (result.textAnnotations && result.textAnnotations[0]) {
          extractedText = result.textAnnotations[0].description || '';
          confidence = 90; // Default high confidence for Google Vision
        }

        console.log(`✅ Google Vision extracted text with ${Math.round(confidence)}% confidence`);
        
        return {
          text: extractedText.trim(),
          confidence: Math.round(confidence * 100) / 100,
          success: true,
          source: 'google_vision'
        };
      }

      throw new Error('No text detected by Google Vision API');

    } catch (error) {
      console.error('❌ Google Vision OCR failed:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error.message,
        source: 'google_vision'
      };
    }
  }

  // Tesseract OCR (existing method)
  async extractTextWithTesseract(imageBuffer) {
    try {
      if (!this.isInitialized) {
        console.log('🔄 OCR not initialized, initializing now...');
        await this.initialize();
      }

      if (!this.worker) {
        throw new Error('OCR worker is not available after initialization');
      }

      console.log('🔍 Starting Tesseract text extraction...');
      
      const processedBuffer = await this.preprocessImage(imageBuffer);

      const recognitionPromise = this.worker.recognize(processedBuffer);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OCR timeout after 60 seconds')), 60000);
      });

      const result = await Promise.race([
        recognitionPromise,
        timeoutPromise
      ]);

      if (!result || !result.data) {
        throw new Error('Invalid OCR result received');
      }

      const { text, confidence } = result.data;
      const finalConfidence = Math.round(confidence * 100) / 100;
      
      console.log(`✅ Tesseract extracted text with ${finalConfidence}% confidence`);
      
      return {
        text: (text || '').trim(),
        confidence: finalConfidence,
        success: true,
        source: 'tesseract'
      };
    } catch (error) {
      console.error('❌ Tesseract OCR failed:', error);
      
      // If worker failed, try to reinitialize for next request
      if (error.message.includes('worker') || error.message.includes('terminated')) {
        console.log('🔄 Worker seems corrupted, marking for reinitialization...');
        this.isInitialized = false;
        this.initPromise = null;
        this.worker = null;
      }
      
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error.message,
        source: 'tesseract'
      };
    }
  }

  // Category detection method
  detectCategory(text) {
    const lowerText = text.toLowerCase();
    const scores = {};
    
    // Initialize scores
    Object.keys(this.categoryPatterns).forEach(category => {
      scores[category] = 0;
    });
    
    // Check keywords and patterns for each category
    Object.entries(this.categoryPatterns).forEach(([category, config]) => {
      // Check keywords
      config.keywords.forEach(keyword => {
        if (lowerText.includes(keyword)) {
          scores[category] += 2;
        }
      });
      
      // Check patterns
      config.patterns.forEach(pattern => {
        if (pattern.test(text)) {
          scores[category] += 3;
        }
      });
    });
    
    // Find category with highest score
    const maxScore = Math.max(...Object.values(scores));
    const detectedCategory = Object.keys(scores).find(key => scores[key] === maxScore);
    
    // Return result with confidence
    const confidence = maxScore > 0 ? Math.min((maxScore / 10) * 100, 95) : 0;
    
    return {
      category: maxScore > 0 ? detectedCategory : 'general',
      confidence: Math.round(confidence),
      scores,
      detected: maxScore > 0
    };
  }

  // Main extraction method with fallback and category detection
  async extractText(imageBuffer, useGoogleVision = false) {
    try {
      let primaryResult, fallbackResult;

      if (useGoogleVision) {
        primaryResult = await this.extractTextWithGoogleVision(imageBuffer);
        
        if (!primaryResult.success || primaryResult.confidence < 70) {
          fallbackResult = await this.extractTextWithTesseract(imageBuffer);
        }
      } else {
        primaryResult = await this.extractTextWithTesseract(imageBuffer);
        
        if (!primaryResult.success || primaryResult.confidence < 60) {
          fallbackResult = await this.extractTextWithGoogleVision(imageBuffer);
        }
      }

      let bestResult = primaryResult;
      if (fallbackResult?.success && (!primaryResult.success || fallbackResult.confidence > primaryResult.confidence)) {
        bestResult = fallbackResult;
      }

      if (!bestResult.success) {
        throw new Error('Both OCR methods failed');
      }

      const categoryResult = this.detectCategory(bestResult.text);
      console.log(`🏷️ Detected category: ${categoryResult.category} (${categoryResult.confidence}% confidence)`);

      return {
        ...bestResult,
        category: categoryResult
      };

    } catch (error) {
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error.message,
        source: 'none',
        category: {
          category: 'unknown',
          confidence: 0,
          scores: {},
          detected: false
        }
      };
    }
  }

  async cleanup() {
    try {
      if (this.worker) {
        console.log('🧹 Cleaning up OCR worker...');
        await this.worker.terminate();
        this.worker = null;
        this.isInitialized = false;
        this.initPromise = null;
        console.log('✅ OCR worker cleaned up successfully');
      }
    } catch (error) {
      console.error('⚠️ Error during OCR cleanup:', error);
    }
  }

  // Additional methods for route compatibility
  async extractReceiptData(imageBuffer, useGoogleVision = false) {
    const result = await this.extractText(imageBuffer, useGoogleVision);
    
    if (!result.success) {
      return result;
    }

    console.log('🧾 Parsing receipt data...');
    const receiptData = this.parseReceiptText(result.text);
    
    return {
      ...result,
      receiptData
    };
  }

  parseReceiptText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const patterns = {
      total: /(?:total|sum|amount|grand\s*total|ttl|tot|jumlah)[:\s]*[$€£¥₹Rp]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+[.,]\d{2}|\d+)/i,
      subtotal: /(?:subtotal|sub\s*total|sub)[:\s]*[$€£¥₹Rp]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+[.,]\d{2}|\d+)/i,
      tax: /(?:tax|ppn|vat|pajak)[:\s]*[$€£¥₹Rp]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+[.,]\d{2}|\d+)/i,
      date: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})|(?:tanggal|date|tgl)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      time: /(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)|(?:waktu|time|jam)[:\s]*(\d{1,2}:\d{2}(?::\d{2})?)/i,
      itemPrice: /^(.+?)\s+[$€£¥₹Rp]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+[.,]\d{2}|\d+)$/
    };

    const receiptData = {
      storeName: '',
      date: null,
      time: '',
      total: 0,
      subtotal: 0,
      tax: 0,
      items: [],
      rawText: text,
      confidence: 'low',
      currency: 'IDR'
    };

    // Extract store name from first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length >= 3 && line.length <= 50 && 
          !patterns.date.test(line) && 
          !patterns.time.test(line) &&
          !/^\d+$/.test(line)) {
        if (/[A-Z]/.test(line)) {
          receiptData.storeName = line;
          break;
        } else if (!receiptData.storeName) {
          receiptData.storeName = line;
        }
      }
    }

    // Extract date and time with better parsing
    const dateMatch = text.match(patterns.date);
    if (dateMatch) {
      // Get the first non-empty match group
      receiptData.date = dateMatch[1] || dateMatch[2] || dateMatch[3] || dateMatch[0];
    }
    
    const timeMatch = text.match(patterns.time);
    if (timeMatch) {
      receiptData.time = timeMatch[1] || timeMatch[2] || timeMatch[0];
    }

    // Parse amounts
    const parseAmount = (amountStr) => {
      if (!amountStr) return 0;
      let cleaned = amountStr.replace(/[$€£¥₹Rp\s]/g, '');
      if (cleaned.includes('.') && cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      }
      return parseFloat(cleaned) || 0;
    };

    const totalMatch = text.toLowerCase().match(patterns.total);
    if (totalMatch) receiptData.total = parseAmount(totalMatch[1]);

    const subtotalMatch = text.toLowerCase().match(patterns.subtotal);
    if (subtotalMatch) receiptData.subtotal = parseAmount(subtotalMatch[1]);

    const taxMatch = text.toLowerCase().match(patterns.tax);
    if (taxMatch) receiptData.tax = parseAmount(taxMatch[1]);

    // Extract items
    lines.forEach((line, index) => {
      if (patterns.total.test(line.toLowerCase()) || 
          patterns.subtotal.test(line.toLowerCase()) ||
          patterns.tax.test(line.toLowerCase()) ||
          patterns.date.test(line) ||
          patterns.time.test(line)) {
        return;
      }

      const itemMatch = line.match(patterns.itemPrice);
      if (itemMatch) {
        const itemName = itemMatch[1].trim();
        const price = parseAmount(itemMatch[2]);
        
        if (itemName.length > 1 && price > 0 &&
            !itemName.toLowerCase().includes('total') &&
            !/^[\d\s\-.:]+$/.test(itemName)) {
          receiptData.items.push({
            name: itemName,
            price: price,
            quantity: 1,
            lineNumber: index + 1
          });
        }
      }
    });

    // Calculate confidence
    let confidenceScore = 0;
    if (receiptData.storeName) confidenceScore += 25;
    if (receiptData.date) confidenceScore += 20;
    if (receiptData.total > 0) confidenceScore += 30;
    if (receiptData.items.length > 0) confidenceScore += 15;
    
    receiptData.confidence = confidenceScore >= 80 ? 'high' : 
                           confidenceScore >= 60 ? 'medium' : 
                           confidenceScore >= 40 ? 'low' : 'very_low';

    return receiptData;
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      workerExists: !!this.worker,
      ready: this.isInitialized && !!this.worker,
      googleVisionConfigured: !!this.googleVisionConfig.apiKey,
      initPromise: !!this.initPromise,
      timestamp: new Date().toISOString()
    };
  }

  async terminate() {
    return this.cleanup();
  }
}

// Create and export a singleton instance
const ocrService = new OCRService();

// Auto-initialize on import (non-blocking)
ocrService.initialize().catch(error => {
  console.warn('⚠️ OCR auto-initialization failed:', error.message);
});

export default ocrService;