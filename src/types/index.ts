export interface UserProfile {
  id: string
  photo: string | null
  photoThumbnail: string | null
  measurements: UserMeasurements
  bodyType: BodyType | null
  createdAt: number
  updatedAt: number
}

export interface UserMeasurements {
  height: number | null // cm
  weight: number | null // kg
  chest: number | null // cm
  waist: number | null // cm
  hips: number | null // cm
  inseam: number | null // cm
  shoulderWidth: number | null // cm
  armLength: number | null // cm
}

export type BodyType = 
  | 'hourglass' 
  | 'pear' 
  | 'apple' 
  | 'rectangle' 
  | 'inverted-triangle'
  | 'athletic'

export type GarmentType = 
  | 'top' 
  | 'shirt' 
  | 'blouse'
  | 't-shirt'
  | 'sweater'
  | 'jacket'
  | 'coat'
  | 'dress'
  | 'pants'
  | 'jeans'
  | 'shorts'
  | 'skirt'
  | 'suit'
  | 'jumpsuit'
  | 'other'

export interface DetectedProduct {
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

export interface TryOnResult {
  id: string
  userPhotoId: string
  productId: string
  product: DetectedProduct
  resultImageUrl: string
  thumbnailUrl?: string
  generatedAt: number
  isFavorite: boolean
}

export interface TryOnRequest {
  userPhoto: string
  productImage: string
  measurements: UserMeasurements
  garmentType: GarmentType
}

export interface TryOnResponse {
  success: boolean
  resultImage?: string
  error?: string
  processingTime?: number
}

export type AppView = 
  | 'home'
  | 'onboarding'
  | 'profile'
  | 'try-on'
  | 'results'
  | 'history'
  | 'settings'

export type OnboardingStep = 
  | 'welcome'
  | 'photo-upload'
  | 'measurements'
  | 'complete'

export interface AppState {
  // UI State
  currentView: AppView
  onboardingStep: OnboardingStep
  isLoading: boolean
  error: string | null
  
  // User Data
  userProfile: UserProfile | null
  isProfileComplete: boolean
  
  // Detection & Try-On
  detectedProducts: DetectedProduct[]
  selectedProduct: DetectedProduct | null
  currentTryOn: TryOnResult | null
  tryOnHistory: TryOnResult[]
  
  // Processing
  isDetecting: boolean
  isGenerating: boolean
  generationProgress: number
}

export interface SupportedSite {
  domain: string
  name: string
  selectors: ProductSelectors
  enabled: boolean
}

export interface ProductSelectors {
  productContainer: string
  productImage: string
  productTitle: string
  productPrice: string
  addToCartButton?: string
}

export const SUPPORTED_SITES: SupportedSite[] = [
  {
    domain: 'amazon.com',
    name: 'Amazon',
    selectors: {
      productContainer: '#dp-container, #ppd',
      productImage: '#landingImage, #imgTagWrapperId img',
      productTitle: '#productTitle',
      productPrice: '.a-price .a-offscreen, #priceblock_ourprice'
    },
    enabled: true
  },
  {
    domain: 'asos.com',
    name: 'ASOS',
    selectors: {
      productContainer: '[data-test-id="product-page"]',
      productImage: '[data-test-id="gallery-image"] img, .gallery-image img',
      productTitle: '[data-test-id="product-title"], h1',
      productPrice: '[data-test-id="current-price"]'
    },
    enabled: true
  },
  {
    domain: 'zara.com',
    name: 'Zara',
    selectors: {
      productContainer: '.product-detail',
      productImage: '.media-image__image, picture img',
      productTitle: '.product-detail-info__header-name',
      productPrice: '.price__amount'
    },
    enabled: true
  },
  {
    domain: 'hm.com',
    name: 'H&M',
    selectors: {
      productContainer: '.product-detail',
      productImage: '.product-detail-main-image img',
      productTitle: '.product-item-headline',
      productPrice: '.price-value'
    },
    enabled: true
  },
  {
    domain: 'nordstrom.com',
    name: 'Nordstrom',
    selectors: {
      productContainer: '[data-element="product-page"]',
      productImage: '[data-element="hero-image"] img',
      productTitle: '[data-element="product-title"]',
      productPrice: '[data-element="product-price"]'
    },
    enabled: true
  }
]

export const DEFAULT_MEASUREMENTS: UserMeasurements = {
  height: null,
  weight: null,
  chest: null,
  waist: null,
  hips: null,
  inseam: null,
  shoulderWidth: null,
  armLength: null
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: '',
  photo: null,
  photoThumbnail: null,
  measurements: DEFAULT_MEASUREMENTS,
  bodyType: null,
  createdAt: 0,
  updatedAt: 0
}
