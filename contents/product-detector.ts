import type { PlasmoCSConfig } from 'plasmo'
import { SUPPORTED_SITES, type DetectedProduct, type GarmentType } from '~/types'

export const config: PlasmoCSConfig = {
  matches: [
    'https://*.amazon.com/*',
    'https://*.asos.com/*',
    'https://*.zara.com/*',
    'https://*.hm.com/*',
    'https://*.nordstrom.com/*',
    'https://*.shopify.com/*',
    'https://*/*'
  ],
  all_frames: false
}

// Detect current site configuration
function getCurrentSiteConfig() {
  const hostname = window.location.hostname.toLowerCase()
  return SUPPORTED_SITES.find(site => 
    hostname.includes(site.domain.replace('*.', ''))
  )
}

// Infer garment type from title/keywords
function inferGarmentType(title: string): GarmentType {
  const lowercased = title.toLowerCase()
  
  const typeMap: [string[], GarmentType][] = [
    [['t-shirt', 'tee', 'tshirt'], 't-shirt'],
    [['shirt', 'button'], 'shirt'],
    [['blouse'], 'blouse'],
    [['sweater', 'sweatshirt', 'hoodie', 'pullover', 'cardigan'], 'sweater'],
    [['jacket', 'blazer'], 'jacket'],
    [['coat', 'parka', 'overcoat'], 'coat'],
    [['dress', 'gown'], 'dress'],
    [['jean', 'denim'], 'jeans'],
    [['pant', 'trouser', 'chino', 'slack'], 'pants'],
    [['short'], 'shorts'],
    [['skirt'], 'skirt'],
    [['suit'], 'suit'],
    [['jumpsuit', 'romper'], 'jumpsuit'],
    [['top', 'tank', 'cami'], 'top'],
  ]

  for (const [keywords, type] of typeMap) {
    if (keywords.some(kw => lowercased.includes(kw))) {
      return type
    }
  }

  return 'other'
}

// Generic product detection for unknown sites
function detectProductsGeneric(): DetectedProduct[] {
  const products: DetectedProduct[] = []

  // Look for common product page patterns
  const productImageSelectors = [
    // Generic e-commerce patterns
    '[data-zoom-image]',
    '.product-image img',
    '.product-gallery img',
    '#product-image',
    '.pdp-image img',
    '[itemprop="image"]',
    '.main-product-image img',
    // Open Graph and Schema.org
    'meta[property="og:image"]',
  ]

  const productTitleSelectors = [
    'h1',
    '[itemprop="name"]',
    '.product-title',
    '.product-name',
    '#product-name',
    '.pdp-title',
  ]

  const productPriceSelectors = [
    '[itemprop="price"]',
    '.product-price',
    '.price',
    '.current-price',
    '[data-price]',
  ]

  // Try to find product image
  let productImage: string | null = null
  for (const selector of productImageSelectors) {
    const el = document.querySelector(selector)
    if (el) {
      if (el.tagName === 'META') {
        productImage = (el as HTMLMetaElement).content
      } else if (el.tagName === 'IMG') {
        productImage = (el as HTMLImageElement).src || (el as HTMLImageElement).dataset.src || null
      } else {
        const img = el.querySelector('img')
        productImage = img?.src || img?.dataset?.src || null
      }
      if (productImage) break
    }
  }

  // Try to find product title
  let productTitle: string | null = null
  for (const selector of productTitleSelectors) {
    const el = document.querySelector(selector)
    if (el && el.textContent?.trim()) {
      productTitle = el.textContent.trim()
      break
    }
  }

  // Try to find product price
  let productPrice: string | null = null
  for (const selector of productPriceSelectors) {
    const el = document.querySelector(selector)
    if (el) {
      productPrice = (el as HTMLElement).getAttribute('content') || el.textContent?.trim() || null
      if (productPrice) break
    }
  }

  if (productImage && productTitle) {
    products.push({
      id: crypto.randomUUID(),
      imageUrl: productImage,
      thumbnailUrl: productImage,
      title: productTitle,
      price: productPrice || undefined,
      garmentType: inferGarmentType(productTitle),
      sourceUrl: window.location.href,
      sourceDomain: window.location.hostname,
      detectedAt: Date.now()
    })
  }

  return products
}

// Site-specific product detection
function detectProductsForSite(siteConfig: typeof SUPPORTED_SITES[0]): DetectedProduct[] {
  const products: DetectedProduct[] = []
  const { selectors } = siteConfig

  // Check if we're on a product page
  const container = document.querySelector(selectors.productContainer)
  if (!container) {
    console.log('[TryOn] No product container found')
    return detectProductsGeneric()
  }

  // Get product image
  const imageEl = document.querySelector(selectors.productImage)
  const imageUrl = imageEl?.tagName === 'IMG' 
    ? (imageEl as HTMLImageElement).src || (imageEl as HTMLImageElement).dataset.src
    : imageEl?.getAttribute('src') || imageEl?.getAttribute('data-src')

  if (!imageUrl) {
    console.log('[TryOn] No product image found')
    return detectProductsGeneric()
  }

  // Get product title
  const titleEl = document.querySelector(selectors.productTitle)
  const title = titleEl?.textContent?.trim() || 'Unknown Product'

  // Get product price
  const priceEl = document.querySelector(selectors.productPrice)
  const price = priceEl?.textContent?.trim()

  products.push({
    id: crypto.randomUUID(),
    imageUrl,
    thumbnailUrl: imageUrl,
    title,
    price,
    garmentType: inferGarmentType(title),
    sourceUrl: window.location.href,
    sourceDomain: siteConfig.domain,
    detectedAt: Date.now()
  })

  return products
}

// Main detection function
function detectProducts(): DetectedProduct[] {
  const siteConfig = getCurrentSiteConfig()
  
  if (siteConfig) {
    console.log(`[TryOn] Detected supported site: ${siteConfig.name}`)
    return detectProductsForSite(siteConfig)
  }
  
  console.log('[TryOn] Using generic detection')
  return detectProductsGeneric()
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DETECT_PRODUCTS') {
    console.log('[TryOn] Starting product detection...')
    const products = detectProducts()
    console.log(`[TryOn] Found ${products.length} products`)
    
    // Send products back via runtime message
    chrome.runtime.sendMessage({
      type: 'PRODUCTS_DETECTED',
      products
    })
    
    sendResponse({ success: true, count: products.length })
  }
  
  return true
})

// Initial detection on page load
window.addEventListener('load', () => {
  // Delay to allow dynamic content to load
  setTimeout(() => {
    const products = detectProducts()
    if (products.length > 0) {
      chrome.runtime.sendMessage({
        type: 'PRODUCTS_DETECTED',
        products
      })
    }
  }, 1500)
})

// Observe for dynamic content changes (SPAs)
const observer = new MutationObserver((mutations) => {
  const hasSignificantChanges = mutations.some(m => 
    m.addedNodes.length > 0 || 
    (m.target as Element).matches?.('img, [itemprop="image"]')
  )
  
  if (hasSignificantChanges) {
    // Debounce detection
    clearTimeout((window as any).__tryonDetectTimeout)
    ;(window as any).__tryonDetectTimeout = setTimeout(() => {
      const products = detectProducts()
      if (products.length > 0) {
        chrome.runtime.sendMessage({
          type: 'PRODUCTS_DETECTED',
          products
        })
      }
    }, 1000)
  }
})

observer.observe(document.body, {
  childList: true,
  subtree: true
})

console.log('[TryOn] Content script loaded')
