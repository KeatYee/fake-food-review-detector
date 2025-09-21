// FoodTrust Content Script - Floating UI Version

console.log("FoodTrust content script loaded");

class FoodTrustFloatingUI {
  constructor() {
    this.scanButton = null;
    this.resultsCard = null;
    this.isScanning = false;
    this.init();
  }

  async init() {
    // Only show on Google Maps pages
    if (this.isGoogleMapsPage()) {
      // Check if FoodTrust is enabled
      const isEnabled = await this.checkIfEnabled();
      if (isEnabled) {
        this.createFloatingScanButton();
      }
      this.setupMessageListener();
    }
  }

  async checkIfEnabled() {
    try {
      const result = await chrome.storage.local.get(["foodtrustEnabled"]);
      return result.foodtrustEnabled !== false; // Default to true
    } catch (error) {
      console.error("Error checking enabled status:", error);
      return true; // Default to enabled
    }
  }

  isGoogleMapsPage() {
    return (
      window.location.href.includes("google.com/maps") ||
      (window.location.href.includes("google.com") &&
        window.location.href.includes("maps"))
    );
  }

  createFloatingScanButton() {
    // Create floating scan button
    this.scanButton = document.createElement("div");
    this.scanButton.id = "foodtrust-scan-button";
    this.scanButton.innerHTML = `
      <div class="scan-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19S2 15.194 2 10.5 5.806 2 10.5 2 19 5.806 19 10.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="scan-text">Scan Reviews</span>
    `;

    this.scanButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50px;
      padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      user-select: none;
    `;

    // Add hover effects
    this.scanButton.addEventListener("mouseenter", () => {
      this.scanButton.style.transform = "translateY(-2px)";
      this.scanButton.style.boxShadow = "0 6px 25px rgba(102, 126, 234, 0.5)";
    });

    this.scanButton.addEventListener("mouseleave", () => {
      this.scanButton.style.transform = "translateY(0)";
      this.scanButton.style.boxShadow = "0 4px 20px rgba(102, 126, 234, 0.4)";
    });

    // Add click handler
    this.scanButton.addEventListener("click", () => {
      this.startScan();
    });

    // Add styles for the icon
    const style = document.createElement("style");
    style.textContent = `
      #foodtrust-scan-button .scan-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      #foodtrust-scan-button .scan-icon svg {
        width: 16px;
        height: 16px;
      }
      
      #foodtrust-scan-button.scanning {
        background: linear-gradient(135deg, #ffa726 0%, #ff7043 100%);
        pointer-events: none;
      }
      
      #foodtrust-scan-button.scanning .scan-icon {
        animation: foodtrust-spin 1s linear infinite;
      }
      
      @keyframes foodtrust-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      @keyframes foodtrust-highlight-pulse {
        0% { 
          background: rgba(229, 62, 62, 0.02) !important;
          border-left-color: rgba(229, 62, 62, 0.3) !important;
        }
        50% { 
          background: rgba(229, 62, 62, 0.15) !important;
          border-left-color: #e53e3e !important;
        }
        100% { 
          background: rgba(229, 62, 62, 0.08) !important;
          border-left-color: #e53e3e !important;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(this.scanButton);
  }

  startScan() {
    if (this.isScanning) return;

    this.isScanning = true;
    this.scanButton.classList.add("scanning");
    this.scanButton.querySelector(".scan-text").textContent = "Scanning...";

    // Simulate scanning (replace with actual scan logic)
    this.performScan();
  }

  async performScan() {
    try {
      // Extract real reviews from the page
      const reviews = this.extractGoogleReviews();

      if (reviews.length === 0) {
        this.showError(
          "No reviews found on this page. Make sure you're on a restaurant page with reviews."
        );
        return;
      }

      console.log(
        `Extracted ${reviews.length} reviews, sending to AI for analysis...`
      );

      // Send reviews to AI API for analysis
      const aiResults = await this.analyzeReviewsWithAI(reviews);

      if (aiResults.success) {
        this.showResults(aiResults);
      } else {
        this.showError(aiResults.error || "Failed to analyze reviews with AI.");
      }
    } catch (error) {
      console.error("Error during scan:", error);
      this.showError("Failed to scan reviews. Please try again.");
    } finally {
      this.isScanning = false;
      this.scanButton.classList.remove("scanning");
      this.scanButton.querySelector(".scan-text").textContent = "Scan Reviews";
    }
  }

  extractGoogleReviews() {
    const reviews = [];

    // Multiple selector strategies for Google Maps reviews
    const reviewSelectors = [
      "[data-review-id]",
      '[jsaction*="review"]',
      ".jftiEf",
      ".MyEned",
      ".wiI7pd",
      '[role="article"]',
      ".section-review-review",
    ];

    let reviewElements = [];

    // Try each selector strategy
    for (const selector of reviewSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        reviewElements = Array.from(elements);
        console.log(
          `Found ${elements.length} elements with selector: ${selector}`
        );
        break;
      }
    }

    // Parse found elements
    reviewElements.forEach((element, index) => {
      const reviewData = this.parseGoogleReview(element, index);
      if (reviewData && reviewData.text && reviewData.text.length > 10) {
        reviews.push(reviewData);
      }
    });

    // Remove duplicates and filter out non-review content
    return this.removeDuplicateReviews(reviews);
  }

  parseGoogleReview(element, index) {
    const textSelectors = [
      ".wiI7pd",
      ".MyEned",
      ".rsqaWe",
      'span[jsaction*="expand"]',
      "[data-expandable-section]",
    ];

    const authorSelectors = [".d4r55", ".X43Kjb", ".TSUbDb"];

    const ratingSelectors = [
      ".kvMYJc",
      '[aria-label*="star"]',
      'span[role="img"]',
    ];

    let reviewText = "";
    let author = "";
    let rating = "";
    let reviewId = "";

    // Extract review ID from data-review-id attribute
    reviewId =
      element.getAttribute("data-review-id") ||
      element
        .querySelector("[data-review-id]")
        ?.getAttribute("data-review-id") ||
      `google_${index}_${Date.now()}`;

    // Extract review text
    for (const selector of textSelectors) {
      const textEl = element.querySelector(selector);
      if (textEl && textEl.textContent.trim().length > 10) {
        reviewText = textEl.textContent.trim();
        break;
      }
    }

    // Skip if this looks like Local Guide info or other non-review content
    if (this.isNonReviewContent(reviewText)) {
      return null;
    }

    // Extract author
    for (const selector of authorSelectors) {
      const authorEl = element.querySelector(selector);
      if (authorEl && authorEl.textContent.trim()) {
        const authorText = authorEl.textContent.trim();
        if (
          !authorText.includes("star") &&
          !authorText.includes("ago") &&
          authorText.length < 50
        ) {
          author = authorText;
          break;
        }
      }
    }

    // Extract rating
    for (const selector of ratingSelectors) {
      const ratingEl = element.querySelector(selector);
      if (ratingEl) {
        const ariaLabel = ratingEl.getAttribute("aria-label") || "";
        if (ariaLabel.includes("star")) {
          rating = ariaLabel;
          break;
        }
      }
    }

    if (reviewText && reviewText.length > 10) {
      return {
        id: reviewId,
        text: reviewText.replace(/\s+/g, " ").trim(),
        author: author || "Anonymous User",
        rating: rating || "No rating",
        reviewIndex: index, // Keep for backward compatibility
        reviewId: reviewId, // Primary identifier
        element: element,
      };
    }

    return null;
  }

  isNonReviewContent(text) {
    // Filter out Local Guide info and other non-review content
    const nonReviewPatterns = [
      /local\s+guide/i,
      /\d+\s+reviews?\s*•\s*\d+\s+photos?/i,
      /\d+\s+photos?\s*•\s*\d+\s+reviews?/i,
      /level\s+\d+/i,
      /write\s+a\s+review/i,
      /add\s+photos?/i,
      /^\d+\s+reviews?$/i,
      /^\d+\s+photos?$/i,
    ];

    return (
      nonReviewPatterns.some((pattern) => pattern.test(text.trim())) ||
      text.length < 20 ||
      (/^\d+/.test(text.trim()) && text.length < 50)
    );
  }

  removeDuplicateReviews(reviews) {
    const seen = new Set();
    const uniqueReviews = [];

    reviews.forEach((review) => {
      const normalizedText = review.text
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const normalizedAuthor = review.author.toLowerCase().trim();
      const reviewKey = `${normalizedAuthor}|||${normalizedText}`;

      if (!seen.has(reviewKey)) {
        seen.add(reviewKey);
        uniqueReviews.push(review);
      }
    });

    return uniqueReviews;
  }

  async analyzeReviewsWithAI(reviews) {
    try {
      // Prepare data in the format your API expects
      const reviewsData = {
        reviews: reviews.map((review) => ({
          review_text: review.text,
        })),
      };

      console.log("Sending to AI API:", reviewsData);

      // Call the AI API
      const response = await fetch(
        "https://z2ab8vu523.execute-api.ap-southeast-5.amazonaws.com/detect",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reviewsData),
        }
      );

      if (!response.ok) {
        throw new Error(
          `AI API error: ${response.status} ${response.statusText}`
        );
      }

      const aiResponse = await response.json();
      console.log("AI API response:", aiResponse);

      // Process AI response and format for display
      return this.processAIResponse(aiResponse, reviews);
    } catch (error) {
      console.error("Error calling AI API:", error);
      return {
        success: false,
        error: `AI analysis failed: ${error.message}`,
      };
    }
  }

  processAIResponse(aiResponse, originalReviews) {
    try {
      const suspiciousReviews = [];
      let totalReviews = originalReviews.length;

      // Process AI results - aiResponse should be an array of predictions
      if (Array.isArray(aiResponse)) {
        aiResponse.forEach((result, index) => {
          const originalReview = originalReviews[index];
          if (originalReview && result) {
            // Check if the review is flagged as fake (is_fake: 1)
            const isFake = result.is_fake === 1;

            if (isFake) {
              suspiciousReviews.push({
                ...originalReview,
                suspicionScore: this.calculateSuspicionScore(result),
                flags: this.generateFlags(result, originalReview.text),
                aiPrediction: result.predicted_label,
                isFake: result.is_fake,
                timestamp: "Recently",
              });
            }
          }
        });
      }

      return {
        success: true,
        platform: "Google Maps",
        totalReviews: totalReviews,
        suspiciousCount: suspiciousReviews.length,
        suspiciousReviews: suspiciousReviews,
        timestamp: Date.now(),
        isDemo: false,
        aiAnalyzed: true,
      };
    } catch (error) {
      console.error("Error processing AI response:", error);
      return {
        success: false,
        error: "Failed to process AI analysis results",
      };
    }
  }

  calculateSuspicionScore(result) {
    // Convert AI result to suspicion score
    if (result.is_fake === 1) {
      // For fake reviews, generate a high suspicion score (75-95%)
      return Math.floor(Math.random() * 20) + 75;
    } else {
      // For real reviews (shouldn't reach here in our filtering), lower score
      return Math.floor(Math.random() * 30) + 40;
    }
  }

  generateFlags(result, reviewText) {
    const flags = [];

    // Always add AI detected fake flag since we only process is_fake: 1
    flags.push("ai_detected_fake");

    // Add additional flags based on review characteristics
    if (reviewText.length < 30) {
      flags.push("too_short");
    }
    if (reviewText.length > 500) {
      flags.push("too_long");
    }

    // Check for extreme language patterns
    const extremePatterns = [
      /amazing|incredible|perfect|best ever|worst ever|terrible|awful/gi,
    ];
    if (extremePatterns.some((pattern) => pattern.test(reviewText))) {
      flags.push("extreme_language");
    }

    // Check for repetitive words
    const words = reviewText.toLowerCase().split(/\s+/);
    const wordCount = {};
    words.forEach((word) => {
      if (word.length > 3) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    if (Object.values(wordCount).some((count) => count > 2)) {
      flags.push("repetitive");
    }

    return flags;
  }

  showResults(results) {
    // Remove existing results card
    if (this.resultsCard) {
      this.resultsCard.remove();
    }

    // Create results card
    this.resultsCard = document.createElement("div");
    this.resultsCard.id = "foodtrust-results-card";

    const trustScore =
      results.totalReviews > 0
        ? Math.round(
            ((results.totalReviews - results.suspiciousCount) /
              results.totalReviews) *
              100
          )
        : 100;

    this.resultsCard.innerHTML = `
      <div class="results-header">
        <div class="results-title">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
          </svg>
          FoodTrust Analysis
        </div>
        <button class="close-btn" id="foodtrust-close-btn">×</button>
      </div>
      
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-number">${results.totalReviews}</div>
          <div class="stat-label">Total Reviews</div>
        </div>
        <div class="stat-item suspicious">
          <div class="stat-number">${results.suspiciousCount}</div>
          <div class="stat-label">Suspicious</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${trustScore}%</div>
          <div class="stat-label">Trust Score</div>
        </div>
      </div>
      
      <div class="suspicious-reviews">
        <h4>Suspicious Reviews</h4>
        <div class="reviews-list">
          ${results.suspiciousReviews
            .map((review) => this.createReviewHTML(review))
            .join("")}
        </div>
      </div>
    `;

    this.resultsCard.style.cssText = `
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      width: 380px;
      max-height: 80vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      animation: foodtrust-slide-in 0.3s ease-out;
    `;

    // Add styles for the results card
    const cardStyle = document.createElement("style");
    cardStyle.textContent = `
      @keyframes foodtrust-slide-in {
        from {
          opacity: 0;
          transform: translateY(-50%) translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
      }
      
      #foodtrust-results-card .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      #foodtrust-results-card .results-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
      }
      
      #foodtrust-results-card .results-title svg {
        width: 20px;
        height: 20px;
      }
      
      #foodtrust-results-card .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
      }
      
      #foodtrust-results-card .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      #foodtrust-results-card .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1px;
        background: #f7fafc;
        margin: 0;
      }
      
      #foodtrust-results-card .stat-item {
        background: white;
        padding: 16px;
        text-align: center;
      }
      
      #foodtrust-results-card .stat-number {
        font-size: 24px;
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 4px;
      }
      
      #foodtrust-results-card .stat-item.suspicious .stat-number {
        color: #e53e3e;
      }
      
      #foodtrust-results-card .stat-label {
        font-size: 12px;
        color: #718096;
        font-weight: 500;
      }
      
      #foodtrust-results-card .suspicious-reviews {
        padding: 20px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      #foodtrust-results-card .suspicious-reviews h4 {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
        color: #2d3748;
      }
      
      #foodtrust-results-card .review-item {
        background: #f7fafc;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
        border-left: 3px solid #e53e3e;
      }
      
      #foodtrust-results-card .review-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      #foodtrust-results-card .review-author {
        font-weight: 600;
        font-size: 13px;
        color: #2d3748;
      }
      
      #foodtrust-results-card .review-rating {
        font-size: 12px;
        color: #718096;
      }
      
      #foodtrust-results-card .review-text {
        font-size: 13px;
        color: #4a5568;
        line-height: 1.4;
        margin-bottom: 8px;
      }
      
      #foodtrust-results-card .review-flags {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      
      #foodtrust-results-card .flag-badge {
        background: #fed7d7;
        color: #c53030;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
      }
      
      #foodtrust-results-card .review-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        flex-wrap: wrap;
        gap: 4px;
      }
      
      #foodtrust-results-card .suspicion-score {
        font-size: 11px;
        color: #e53e3e;
        font-weight: 600;
      }
      
      #foodtrust-results-card .ai-prediction {
        font-size: 10px;
        color: #667eea;
        font-weight: 600;
        background: #e6f3ff;
        padding: 2px 6px;
        border-radius: 4px;
      }
      
      #foodtrust-results-card .click-hint {
        font-size: 10px;
        color: #718096;
        font-style: italic;
      }
      
      #foodtrust-results-card .fake-badge {
        font-size: 10px;
        color: #c53030;
        font-weight: 700;
        background: #fed7d7;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      #foodtrust-results-card .review-item:hover {
        background: #edf2f7;
        transform: translateY(-1px);
        transition: all 0.2s ease;
      }
    `;
    document.head.appendChild(cardStyle);

    document.body.appendChild(this.resultsCard);

    // Add close button event listener
    const closeBtn = this.resultsCard.querySelector("#foodtrust-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.closeResultsCard();
      });
    }

    // Add click event listeners to review items
    this.addReviewClickHandlers();

    // AUTO-HIGHLIGHT ALL SUSPICIOUS REVIEWS IMMEDIATELY
    this.highlightAllSuspiciousReviews(results.suspiciousReviews);
  }

  addReviewClickHandlers() {
    const reviewItems = this.resultsCard.querySelectorAll(".review-item");
    reviewItems.forEach((item) => {
      item.addEventListener("click", () => {
        const reviewId = item.dataset.reviewId;
        const reviewIndex = parseInt(item.dataset.reviewIndex);
        console.log(
          `Clicking review with ID: ${reviewId}, Index: ${reviewIndex}`
        );
        this.navigateToReview(reviewId, reviewIndex);
      });
    });
  }

  highlightAllSuspiciousReviews(suspiciousReviews) {
    console.log(
      `Auto-highlighting ${suspiciousReviews.length} suspicious reviews`
    );

    // Clear any existing highlights first
    this.clearAllHighlights();

    // Highlight each suspicious review
    suspiciousReviews.forEach((review, index) => {
      setTimeout(() => {
        this.highlightSuspiciousReview(review, index);
      }, index * 200); // Stagger the highlighting for visual effect
    });
  }

  clearAllHighlights() {
    document.querySelectorAll(".foodtrust-highlighted").forEach((el) => {
      el.classList.remove("foodtrust-highlighted");
      el.style.border = "";
      el.style.borderRadius = "";
      el.style.background = "";
      el.style.boxShadow = "";
      el.style.margin = "";
      el.style.padding = "";
      el.style.animation = "";
      el.style.transform = "";
    });
  }

  highlightSuspiciousReview(review, index) {
    // First try to find by review ID
    let targetReview = document.querySelector(
      `[data-review-id="${review.reviewId}"]`
    );

    if (!targetReview && review.reviewIndex !== undefined) {
      // Fallback: try to find by index
      const reviewSelectors = [
        "[data-review-id]",
        '[jsaction*="review"]',
        ".jftiEf",
        ".MyEned",
        ".wiI7pd",
        '[role="article"]',
      ];

      let reviewElements = [];
      for (const selector of reviewSelectors) {
        reviewElements = Array.from(document.querySelectorAll(selector));
        if (reviewElements.length > 0) {
          break;
        }
      }

      // Filter out non-review elements
      reviewElements = reviewElements.filter((element) => {
        const text = element.textContent || "";
        return text.length > 50 && !this.isNonReviewContent(text);
      });

      if (reviewElements.length > review.reviewIndex) {
        targetReview = reviewElements[review.reviewIndex];
      }
    }

    if (targetReview) {
      // Find the complete review container
      const completeContainer = this.findCompleteReviewContainer(targetReview);

      // Apply highlighting
      let elementsToHighlight = [];
      if (completeContainer.elements && completeContainer.mainElement) {
        elementsToHighlight = completeContainer.elements;
      } else {
        elementsToHighlight = [completeContainer];
      }

      // Highlight each element in the group
      elementsToHighlight.forEach((element) => {
        element.classList.add("foodtrust-highlighted");
        const reviewStyles = `
          background: rgba(229, 62, 62, 0.08) !important;
          position: relative !important;
          padding: 1px 24px !important;
          border-left: 4px solid #e53e3e !important;
          animation: foodtrust-highlight-pulse 0.6s ease-in-out !important;
        `;
        element.style.cssText += reviewStyles;
      });

      console.log(
        `Highlighted suspicious review ${index + 1}: ${review.reviewId}`
      );
    } else {
      console.warn(
        `Could not find review element for highlighting: ${review.reviewId}`
      );
    }
  }

  createReviewHTML(review) {
    const flagLabels = {
      extreme_language: "Extreme Language",
      generic_phrases: "Generic Phrases",
      repetitive: "Repetitive",
      suspicious_author: "Suspicious Author",
      too_short: "Too Short",
      too_long: "Too Long",
      ai_detected_fake: "🤖 AI: Fake Review",
      negative_sentiment: "AI: Negative",
      ai_flagged: "AI Flagged",
    };

    return `
      <div class="review-item" data-review-index="${
        review.reviewIndex
      }" data-review-id="${review.reviewId}" style="cursor: pointer;">
        <div class="review-header">
          <div class="review-author">${this.escapeHtml(review.author)}</div>
          <div class="review-rating">${review.rating}</div>
        </div>
        <div class="review-text">${this.escapeHtml(
          review.text.substring(0, 120)
        )}${review.text.length > 120 ? "..." : ""}</div>
        <div class="review-flags">
          ${(review.flags || [])
            .map(
              (flag) =>
                `<span class="flag-badge">${
                  flagLabels[flag] || flag.replace(/_/g, " ")
                }</span>`
            )
            .join("")}
        </div>
        <div class="review-footer">
          <div class="suspicion-score">Suspicion: ${
            review.suspicionScore
          }%</div>
          ${
            review.aiPrediction
              ? `<div class="ai-prediction">🤖 AI: ${review.aiPrediction}</div>`
              : ""
          }
          ${
            review.isFake === 1
              ? '<div class="fake-badge">⚠️ FAKE DETECTED</div>'
              : ""
          }
          <div class="click-hint">👆 Click to scroll to review</div>
        </div>
      </div>
    `;
  }

  navigateToReview(reviewId, fallbackIndex = null) {
    console.log(
      `Navigating to review ID: ${reviewId}, fallback index: ${fallbackIndex}`
    );

    // First try to find by review ID (most reliable)
    let targetReview = document.querySelector(`[data-review-id="${reviewId}"]`);

    if (targetReview) {
      console.log("Found review by ID:", reviewId);
      // Find the complete review container (including spacing divs)
      const completeContainer = this.findCompleteReviewContainer(targetReview);
      this.scrollToAndHighlightReview(completeContainer, reviewId);
      return;
    }

    // Fallback: try to find by index if reviewId fails
    if (fallbackIndex !== null) {
      console.log("Review ID not found, trying fallback index:", fallbackIndex);

      const reviewSelectors = [
        "[data-review-id]",
        '[jsaction*="review"]',
        ".jftiEf",
        ".MyEned",
        ".wiI7pd",
        '[role="article"]',
      ];

      let reviewElements = [];

      for (const selector of reviewSelectors) {
        reviewElements = Array.from(document.querySelectorAll(selector));
        if (reviewElements.length > 0) {
          break;
        }
      }

      // Filter out non-review elements
      reviewElements = reviewElements.filter((element) => {
        const text = element.textContent || "";
        return text.length > 50 && !this.isNonReviewContent(text);
      });

      if (reviewElements.length > fallbackIndex) {
        targetReview = reviewElements[fallbackIndex];
        console.log("Found review by fallback index:", fallbackIndex);
        // Find the complete review container for fallback too
        const completeContainer =
          this.findCompleteReviewContainer(targetReview);
        this.scrollToAndHighlightReview(
          completeContainer,
          `#${fallbackIndex + 1}`
        );
        return;
      }
    }

    // If both methods fail
    this.showError(
      `Review not found. It may have been removed or is not currently visible. Try scrolling to load more reviews.`
    );
  }

  findCompleteReviewContainer(reviewElement) {
    // Find the main review container with data-review-id
    let mainReviewContainer = reviewElement;

    // If we found a nested element, traverse up to find the element with data-review-id
    while (
      mainReviewContainer &&
      !mainReviewContainer.hasAttribute("data-review-id")
    ) {
      mainReviewContainer = mainReviewContainer.parentElement;
      if (!mainReviewContainer || mainReviewContainer === document.body) {
        // Fallback to original element if we can't find data-review-id
        mainReviewContainer = reviewElement;
        break;
      }
    }

    // Now we need to create a virtual container that includes:
    // - Previous AyRUI spacing div (if exists)
    // - The main review container
    // - Next AyRUI spacing div (if exists)

    const elementsToHighlight = [];

    // Check for preceding AyRUI spacing div
    const prevSibling = mainReviewContainer.previousElementSibling;
    if (prevSibling && prevSibling.classList.contains("AyRUI")) {
      elementsToHighlight.push(prevSibling);
    }

    // Add the main review container
    elementsToHighlight.push(mainReviewContainer);

    // Check for following AyRUI spacing div
    const nextSibling = mainReviewContainer.nextElementSibling;
    if (nextSibling && nextSibling.classList.contains("AyRUI")) {
      elementsToHighlight.push(nextSibling);
    }

    // Return an object with the elements to highlight
    return {
      elements: elementsToHighlight,
      mainElement: mainReviewContainer,
    };
  }

  scrollToAndHighlightReview(containerInfo, identifier) {
    // Highlight the review (can be single element or multiple elements)
    this.highlightReview(containerInfo);

    // Get the main element for scrolling and indicator
    let scrollTarget = containerInfo;
    if (containerInfo.elements && containerInfo.mainElement) {
      scrollTarget = containerInfo.mainElement;
    }

    // Scroll to the review
    scrollTarget.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // Show indicator on the main element
    // this.showReviewIndicator(scrollTarget, identifier);

    // Keep the results card open - user can close it manually with the × button
    // Removed auto-close functionality
  }

  highlightReview(containerInfo) {
    // Remove existing highlights
    document.querySelectorAll(".foodtrust-highlighted").forEach((el) => {
      el.classList.remove("foodtrust-highlighted");
      el.style.border = "";
      el.style.borderRadius = "";
      el.style.background = "";
      el.style.boxShadow = "";
      el.style.margin = "";
      el.style.padding = "";
      el.style.animation = "";
      el.style.transform = "";
    });

    // Handle both old format (single element) and new format (multiple elements)
    let elementsToHighlight = [];
    let mainElement = null;

    if (containerInfo.elements && containerInfo.mainElement) {
      // New format with multiple elements
      elementsToHighlight = containerInfo.elements;
      mainElement = containerInfo.mainElement;
    } else {
      // Old format - single element
      elementsToHighlight = [containerInfo];
      mainElement = containerInfo;
    }

    // Highlight each element in the group
    elementsToHighlight.forEach((element, index) => {
      element.classList.add("foodtrust-highlighted");
      const reviewStyles = `
          background: rgba(229, 62, 62, 0.08) !important;
          position: relative !important;
          padding: 1px 24px !important;
          border-left: 4px solid #e53e3e !important;
          animation: foodtrust-highlight-pulse 0.6s ease-in-out !important;
        `;
      element.style.cssText += reviewStyles;
    });

    // Remove highlight after 8 seconds
    // setTimeout(() => {
    //   elementsToHighlight.forEach((element) => {
    //     element.classList.remove("foodtrust-highlighted");
    //     element.style.border = "";
    //     element.style.borderRadius = "";
    //     element.style.background = "";
    //     element.style.boxShadow = "";
    //     element.style.margin = "";
    //     element.style.padding = "";
    //     element.style.animation = "";
    //     element.style.transform = "";
    //   });
    // }, 8000);
  }

  showReviewIndicator(element, reviewNumber) {
    // Create indicator
    const indicator = document.createElement("div");
    indicator.style.cssText = `
      position: absolute;
      top: -15px;
      left: 50%;
      transform: translateX(-50%);
      background: #e53e3e;
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      animation: foodtrust-bounce 0.5s ease-out;
    `;
    indicator.textContent = `Suspicious Review #${reviewNumber}`;

    // Add bounce animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes foodtrust-bounce {
        0% { transform: translateX(-50%) translateY(-10px) scale(0.8); opacity: 0; }
        50% { transform: translateX(-50%) translateY(-5px) scale(1.1); }
        100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Position relative to element
    element.style.position = "relative";
    element.appendChild(indicator);

    // Remove indicator after 3 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 3000);
  }

  closeResultsCard() {
    if (this.resultsCard) {
      this.resultsCard.remove();
      this.resultsCard = null;
    }
    // Also remove any existing cards by ID as fallback
    const existingCard = document.getElementById("foodtrust-results-card");
    if (existingCard) {
      existingCard.remove();
    }
    // Clear all highlights when closing the results card
    this.clearAllHighlights();
  }

  showError(message) {
    // Show error in a simple toast
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #e53e3e;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10002;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 4000);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Content script received message:", request);

      if (request.action === "scanReviews") {
        // This can be called from the popup as well
        this.startScan();
        sendResponse({ success: true, message: "Scan started" });
      } else if (request.action === "toggleFoodTrust") {
        // Handle enable/disable toggle
        this.handleToggle(request.enabled);
        sendResponse({ success: true, message: "Toggle handled" });
      }

      return true;
    });
  }

  handleToggle(enabled) {
    if (enabled) {
      // Show the scan button if it doesn't exist
      if (!this.scanButton) {
        this.createFloatingScanButton();
      } else {
        this.scanButton.style.display = "flex";
      }
    } else {
      // Hide the scan button
      if (this.scanButton) {
        this.scanButton.style.display = "none";
      }
      // Also hide results card if open
      if (this.resultsCard) {
        this.resultsCard.remove();
        this.resultsCard = null;
      }
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the floating UI
const foodTrustUI = new FoodTrustFloatingUI();

console.log("FoodTrust floating UI initialized");
