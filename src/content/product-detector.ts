// Content Script - Product Detection for E-commerce Sites

type GarmentType = 'top' | 'shirt' | 'sweater' | 'cardigan' | 'jacket' | 'dress' | 'pants' | 'jeans' | 'shorts' | 'skirt' | 'other'

interface DetectedProduct {
  id: string
  imageUrl: string
  thumbnailUrl?: string
  title: string
  price?: string
  garmentType: GarmentType
  sourceUrl: string
  sourceDomain: string
  detectedAt: number
}

interface SiteConfig {
  domain: string
  selectors: {
    container: string
    image: string
    title: string
    price: string
  }
}

const SUPPORTED_SITES: SiteConfig[] = [
  // Lululemon - get main product image (not color swatches)
  { 
    domain: 'lululemon.com', 
    selectors: { 
      container: 'body', 
      // Target the main product gallery images - look for large images, exclude small swatches
      image: '[data-testid="pdp-image-panel"] img, [class*="gallery"] img[src*="/images/"], .product-gallery img, [class*="MediaCarousel"] img, picture source[srcset*="productImage"], img[src*="/images/"][src*="productImage"]',
      title: 'h1, [class*="product-name"], [data-testid="product-title"]',
      price: '[data-testid="price"], [class*="price-container"] span, [class*="Price"]'
    } 
  },
  // Amazon
  { 
    domain: 'amazon.com', 
    selectors: { 
      container: '#dp-container, #ppd', 
      image: '#landingImage, #imgTagWrapperId img, #main-image-container img', 
      title: '#productTitle, #title', 
      price: '.a-price .a-offscreen, #priceblock_ourprice, .a-price-whole' 
    } 
  },
  // ASOS
  { 
    domain: 'asos.com', 
    selectors: { 
      container: '[data-test-id="product-page"], main', 
      image: '[data-test-id="gallery-image"] img, .gallery-image img, img[src*="asos-media"]', 
      title: '[data-test-id="product-title"], h1', 
      price: '[data-test-id="current-price"], [class*="price"]' 
    } 
  },
  // Zara
  { 
    domain: 'zara.com', 
    selectors: { 
      container: '.product-detail, main', 
      image: '.media-image__image, picture img, [class*="product-media"] img', 
      title: '.product-detail-info__header-name, h1', 
      price: '.price__amount, [class*="price"]' 
    } 
  },
  // H&M
  { 
    domain: 'hm.com', 
    selectors: { 
      container: '.product-detail, main', 
      image: '.product-detail-main-image img, [class*="product-image"] img', 
      title: '.product-item-headline, h1', 
      price: '.price-value, [class*="price"]' 
    } 
  },
  // Nordstrom
  { 
    domain: 'nordstrom.com', 
    selectors: { 
      container: '[data-element="product-page"], main', 
      image: '[data-element="hero-image"] img, [class*="product-image"] img', 
      title: '[data-element="product-title"], h1', 
      price: '[data-element="product-price"], [class*="price"]' 
    } 
  },
  // Gap
  { 
    domain: 'gap.com', 
    selectors: { 
      container: 'main, .product-page', 
      image: '[class*="product-image"] img, .carousel img', 
      title: 'h1, [class*="product-name"]', 
      price: '[class*="product-price"], [class*="price"]' 
    } 
  },
  // Uniqlo
  { 
    domain: 'uniqlo.com', 
    selectors: { 
      container: 'main', 
      image: '[class*="product-image"] img, .pdp-image img', 
      title: 'h1, [class*="product-name"]', 
      price: '[class*="price"]' 
    } 
  },
  // Nike
  { 
    domain: 'nike.com', 
    selectors: { 
      container: 'main, [class*="product-detail"]', 
      image: '[class*="hero-image"] img, [data-test="hero-image"] img', 
      title: 'h1, [data-test="product-title"]', 
      price: '[data-test="product-price"], [class*="product-price"]' 
    } 
  },
  // Adidas
  { 
    domain: 'adidas.com', 
    selectors: { 
      container: 'main', 
      image: '[class*="product-gallery"] img, [class*="slider"] img', 
      title: 'h1, [data-auto-id="product-title"]', 
      price: '[class*="product-price"], [data-auto-id="product-price"]' 
    } 
  }
]

function getCurrentSiteConfig(): SiteConfig | undefined {
  const hostname = window.location.hostname.toLowerCase()
  return SUPPORTED_SITES.find(site => hostname.includes(site.domain))
}

function inferGarmentType(title: string): GarmentType {
  const lower = title.toLowerCase()
  
  // Check specific types first (more specific before less specific)
  if (['cardigan'].some(k => lower.includes(k))) return 'cardigan'
  if (['sweater', 'sweatshirt', 'hoodie', 'pullover', 'fleece'].some(k => lower.includes(k))) return 'sweater'
  if (['jacket', 'coat', 'blazer', 'parka'].some(k => lower.includes(k))) return 'jacket'
  if (['t-shirt', 'tee', 'tshirt', 'tank', 'top', 'blouse', 'crop'].some(k => lower.includes(k))) return 'top'
  if (['shirt', 'button-up', 'button up', 'oxford'].some(k => lower.includes(k))) return 'shirt'
  if (['dress', 'gown', 'romper', 'jumpsuit'].some(k => lower.includes(k))) return 'dress'
  if (['short'].some(k => lower.includes(k))) return 'shorts'
  if (['skirt'].some(k => lower.includes(k))) return 'skirt'
  if (['jean', 'denim'].some(k => lower.includes(k))) return 'jeans'
  if (['pant', 'trouser', 'legging', 'jogger', 'chino', 'slack'].some(k => lower.includes(k))) return 'pants'
  
  return 'other'
}

function findLargestImage(): string | null {
  // Find the main product image, filtering out swatches and small images
  const images = Array.from(document.querySelectorAll('img'))
    .map(img => {
      const rect = img.getBoundingClientRect()
      const src = img.src || img.dataset.src || img.getAttribute('data-srcset')?.split(' ')[0] || ''
      const srcset = img.srcset || img.getAttribute('data-srcset') || ''
      
      // Try to get highest resolution from srcset
      let bestSrc = src
      if (srcset) {
        const srcsetParts = srcset.split(',').map(s => s.trim().split(' '))
        const largest = srcsetParts
          .filter(parts => parts.length >= 1 && parts[0].startsWith('http'))
          .sort((a, b) => {
            const aSize = parseInt(a[1] || '0')
            const bSize = parseInt(b[1] || '0')
            return bSize - aSize
          })[0]
        if (largest) bestSrc = largest[0]
      }
      
      return { img, rect, src: bestSrc }
    })
    .filter(({ rect, src }) => {
      // Filter out small images (likely swatches or icons)
      if (rect.width < 150 || rect.height < 150) return false
      
      // Filter out tiny aspect ratios (likely color swatches which are square and small)
      const aspectRatio = rect.width / rect.height
      if (rect.width < 200 && rect.height < 200 && aspectRatio > 0.8 && aspectRatio < 1.2) return false
      
      // Filter out common non-product patterns
      const srcLower = src.toLowerCase()
      if (srcLower.includes('icon')) return false
      if (srcLower.includes('logo')) return false
      if (srcLower.includes('avatar')) return false
      if (srcLower.includes('tracking')) return false
      if (srcLower.includes('pixel')) return false
      if (srcLower.includes('swatch')) return false
      if (srcLower.includes('color-chip')) return false
      if (srcLower.includes('thumbnail') && rect.width < 200) return false
      
      return true
    })
    .sort((a, b) => {
      // Prioritize images with product-related keywords in URL
      const aScore = getProductImageScore(a.src, a.rect)
      const bScore = getProductImageScore(b.src, b.rect)
      return bScore - aScore
    })
  
  if (images.length > 0) {
    console.log('[TryOn] Found best product image:', images[0].src, 'size:', images[0].rect.width, 'x', images[0].rect.height)
    return images[0].src
  }
  return null
}

function getProductImageScore(src: string, rect: DOMRect): number {
  let score = rect.width * rect.height // Base score is image size
  
  const srcLower = src.toLowerCase()
  
  // Boost for product-related keywords
  if (srcLower.includes('product')) score *= 2
  if (srcLower.includes('hero')) score *= 2
  if (srcLower.includes('main')) score *= 1.5
  if (srcLower.includes('gallery')) score *= 1.5
  if (srcLower.includes('large')) score *= 1.3
  if (srcLower.includes('zoom')) score *= 1.3
  if (srcLower.includes('/images/')) score *= 1.2
  
  // Penalize small images
  if (rect.width < 300 || rect.height < 300) score *= 0.5
  
  // Penalize images that look like thumbnails
  if (srcLower.includes('thumb')) score *= 0.3
  if (srcLower.includes('small')) score *= 0.3
  if (srcLower.includes('mini')) score *= 0.3
  
  return score
}

function findProductTitle(): string {
  // Try multiple approaches to find the product title
  const selectors = [
    'h1',
    '[class*="product-name"]',
    '[class*="ProductName"]',
    '[class*="product-title"]',
    '[class*="ProductTitle"]',
    '[itemprop="name"]',
    'meta[property="og:title"]'
  ]
  
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) {
      if (el.tagName === 'META') {
        return (el as HTMLMetaElement).content || ''
      }
      const text = el.textContent?.trim()
      if (text && text.length > 3 && text.length < 200) {
        return text
      }
    }
  }
  
  // Fallback to document title
  const docTitle = document.title.split('|')[0].split('-')[0].trim()
  return docTitle || 'Product'
}

function findProductPrice(): string | undefined {
  const selectors = [
    '[class*="price"]',
    '[class*="Price"]',
    '[itemprop="price"]',
    '[data-price]',
    'meta[property="product:price:amount"]'
  ]
  
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) {
      if (el.tagName === 'META') {
        return (el as HTMLMetaElement).content
      }
      const text = el.textContent?.trim()
      if (text && (text.includes('$') || text.includes('€') || text.includes('£'))) {
        return text
      }
    }
  }
  return undefined
}

function detectProducts(): DetectedProduct[] {
  const products: DetectedProduct[] = []
  
  console.log('[TryOn] Starting product detection on:', window.location.hostname)
  
  const siteConfig = getCurrentSiteConfig()
  
  // Try site-specific detection first
  if (siteConfig) {
    console.log('[TryOn] Using site config for:', siteConfig.domain)
    
    // Try to find image using site-specific selectors
    const imageSelectors = siteConfig.selectors.image.split(',').map(s => s.trim())
    let imageUrl: string | null = null
    
    for (const sel of imageSelectors) {
      const imageEl = document.querySelector(sel)
      if (imageEl) {
        if (imageEl.tagName === 'IMG') {
          const img = imageEl as HTMLImageElement
          imageUrl = img.src || img.dataset.src || img.getAttribute('data-srcset')?.split(' ')[0] || null
        } else if (imageEl.tagName === 'PICTURE') {
          const sourceEl = imageEl.querySelector('source, img')
          imageUrl = sourceEl?.getAttribute('srcset')?.split(' ')[0] || (sourceEl as HTMLImageElement)?.src || null
        }
        if (imageUrl && imageUrl.startsWith('http')) break
      }
    }
    
    // Get title
    const titleSelectors = siteConfig.selectors.title.split(',').map(s => s.trim())
    let title = ''
    for (const sel of titleSelectors) {
      const titleEl = document.querySelector(sel)
      if (titleEl) {
        title = titleEl.textContent?.trim() || ''
        if (title) break
      }
    }
    
    // Get price
    const priceSelectors = siteConfig.selectors.price.split(',').map(s => s.trim())
    let price: string | undefined
    for (const sel of priceSelectors) {
      const priceEl = document.querySelector(sel)
      if (priceEl) {
        const priceText = priceEl.textContent?.trim()
        if (priceText && (priceText.includes('$') || priceText.includes('€') || priceText.includes('£'))) {
          price = priceText
          break
        }
      }
    }
    
    console.log('[TryOn] Site-specific detection:', { imageUrl, title, price })
    
    if (imageUrl && title) {
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
    }
  }

  // Fallback: generic detection using multiple strategies
  if (products.length === 0) {
    console.log('[TryOn] Using generic detection fallback')
    
    // Strategy 1: Open Graph meta tags
    const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement
    
    if (ogImage?.content) {
      console.log('[TryOn] Found OG image:', ogImage.content)
      const title = ogTitle?.content || findProductTitle()
      products.push({
        id: crypto.randomUUID(),
        imageUrl: ogImage.content,
        thumbnailUrl: ogImage.content,
        title,
        price: findProductPrice(),
        garmentType: inferGarmentType(title),
        sourceUrl: window.location.href,
        sourceDomain: window.location.hostname,
        detectedAt: Date.now()
      })
    }
    
    // Strategy 2: Find largest image
    if (products.length === 0) {
      const largestImage = findLargestImage()
      if (largestImage) {
        console.log('[TryOn] Found largest image:', largestImage)
        const title = findProductTitle()
        products.push({
          id: crypto.randomUUID(),
          imageUrl: largestImage,
          thumbnailUrl: largestImage,
          title,
          price: findProductPrice(),
          garmentType: inferGarmentType(title),
          sourceUrl: window.location.href,
          sourceDomain: window.location.hostname,
          detectedAt: Date.now()
        })
      }
    }
    
    // Strategy 3: Schema.org structured data
    if (products.length === 0) {
      const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]')
      for (const script of schemaScripts) {
        try {
          const data = JSON.parse(script.textContent || '{}')
          if (data['@type'] === 'Product' || data.product) {
            const product = data['@type'] === 'Product' ? data : data.product
            if (product.image) {
              const imageUrl = Array.isArray(product.image) ? product.image[0] : product.image
              console.log('[TryOn] Found Schema.org product:', product.name)
              products.push({
                id: crypto.randomUUID(),
                imageUrl,
                thumbnailUrl: imageUrl,
                title: product.name || findProductTitle(),
                price: product.offers?.price ? `$${product.offers.price}` : findProductPrice(),
                garmentType: inferGarmentType(product.name || ''),
                sourceUrl: window.location.href,
                sourceDomain: window.location.hostname,
                detectedAt: Date.now()
              })
              break
            }
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }
  }

  console.log('[TryOn] Detection complete. Found products:', products.length)
  return products
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DETECT_PRODUCTS') {
    console.log('[TryOn] Received DETECT_PRODUCTS message')
    const products = detectProducts()
    chrome.runtime.sendMessage({ type: 'PRODUCTS_DETECTED', products })
    sendResponse({ success: true, count: products.length })
  }
  return true
})

// Auto-detect on page load with retry
function initDetection() {
  console.log('[TryOn] Initializing detection...')
  
  // First attempt after short delay
  setTimeout(() => {
    const products = detectProducts()
    if (products.length > 0) {
      chrome.runtime.sendMessage({ type: 'PRODUCTS_DETECTED', products })
    } else {
      // Retry after more time for slow-loading pages
      setTimeout(() => {
        const retryProducts = detectProducts()
        if (retryProducts.length > 0) {
          chrome.runtime.sendMessage({ type: 'PRODUCTS_DETECTED', products: retryProducts })
        }
      }, 2000)
    }
  }, 1000)
}

// Run detection when page is ready
if (document.readyState === 'complete') {
  initDetection()
} else {
  window.addEventListener('load', initDetection)
}

// Also watch for dynamic content changes (SPA navigation)
const observer = new MutationObserver((mutations) => {
  const hasSignificantChanges = mutations.some(m => 
    m.addedNodes.length > 5 || 
    (m.target as Element).matches?.('main, [class*="product"]')
  )
  
  if (hasSignificantChanges) {
    clearTimeout((window as any).__tryonDetectTimeout)
    ;(window as any).__tryonDetectTimeout = setTimeout(() => {
      const products = detectProducts()
      if (products.length > 0) {
        chrome.runtime.sendMessage({ type: 'PRODUCTS_DETECTED', products })
      }
    }, 1500)
  }
})

observer.observe(document.body, { childList: true, subtree: true })

console.log('[TryOn] Content script loaded on:', window.location.hostname)
