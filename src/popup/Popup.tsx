import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shirt, Scan, History, Settings, User, Sparkles, ChevronRight, ChevronLeft,
  Camera, Ruler, CheckCircle2, Upload, Check, X, RotateCcw, Heart, Download,
  Share2, ExternalLink, Package, ZoomIn, Loader2, AlertCircle, Trash2, Clock, Mail, Info, Zap
} from 'lucide-react'

// Types
type AppView = 'home' | 'onboarding' | 'profile' | 'try-on' | 'history' | 'settings'
type OnboardingStep = 'welcome' | 'photo-upload' | 'measurements' | 'complete'
type GarmentType = 'top' | 'shirt' | 'dress' | 'pants' | 'jeans' | 'other'

interface UserMeasurements {
  height: number | null
  weight: number | null
  chest: number | null
  waist: number | null
  hips: number | null
  inseam: number | null
  shoulderWidth: number | null
  armLength: number | null
}

interface UserProfile {
  id: string
  photo: string | null
  photoThumbnail: string | null
  measurements: UserMeasurements
  createdAt: number
  updatedAt: number
}

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

interface TryOnResult {
  id: string
  userPhotoId: string
  productId: string
  product: DetectedProduct
  resultImageUrl: string
  generatedAt: number
  isFavorite: boolean
}

// API Configuration
const API_BASE_URL = 'http://localhost:8000'

// Health check cache
let healthCache: { available: boolean; aiEnabled: boolean; timestamp: number } | null = null
const HEALTH_CACHE_TTL = 30000 // 30 seconds

// API Client
const api = {
  // Check if backend is available (cached for 30 seconds)
  async checkHealth(forceRefresh = false): Promise<{ available: boolean; aiEnabled: boolean }> {
    // Return cached result if still valid
    if (!forceRefresh && healthCache && Date.now() - healthCache.timestamp < HEALTH_CACHE_TTL) {
      return { available: healthCache.available, aiEnabled: healthCache.aiEnabled }
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000) // Reduced timeout
      })
      if (response.ok) {
        const data = await response.json()
        healthCache = { available: true, aiEnabled: data.ai_enabled || false, timestamp: Date.now() }
        return { available: true, aiEnabled: data.ai_enabled || false }
      }
      healthCache = { available: false, aiEnabled: false, timestamp: Date.now() }
      return { available: false, aiEnabled: false }
    } catch {
      healthCache = { available: false, aiEnabled: false, timestamp: Date.now() }
      return { available: false, aiEnabled: false }
    }
  },

  // Proxy image through backend to bypass CORS
  async proxyImage(url: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/proxy/image/base64?url=${encodeURIComponent(url)}`)
    const data = await response.json()
    if (data.success) {
      return data.dataUri
    }
    throw new Error(data.error || 'Failed to proxy image')
  },

  // Generate try-on via backend
  async generateTryOn(params: {
    userPhoto: string
    productImage: string
    measurements: UserMeasurements
    garmentType: string
    fastMode?: boolean
    aiMode?: 'free' | 'paid'  // free = Kolors, paid = Fal.ai
  }): Promise<{ success: boolean; resultImage?: string; error?: string; method?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/tryon/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPhoto: params.userPhoto,
        productImage: params.productImage,
        fastMode: params.fastMode ?? true,
        aiMode: params.aiMode ?? 'paid',  // Default to paid (Fal.ai)
        measurements: params.measurements,
        garmentType: params.garmentType
      })
    })
    return response.json()
  }
}

// Chrome Storage API for persistent profile data
const STORAGE_KEY = 'fashionTryOnData'

// Theme definitions
type ThemeId = 'champagne-gold' | 'midnight-rose' | 'ocean-dusk' | 'autumn-ember' | 'tokyo-night' | 'sage-blush'

interface ThemeOption {
  id: ThemeId
  name: string
  description: string
  colors: { primary: string; secondary: string; tertiary: string; bg: string }
}

const THEMES: ThemeOption[] = [
  { id: 'champagne-gold', name: 'Champagne Gold', description: 'Luxe fashion palette', colors: { primary: '#d4ad75', secondary: '#d06d4c', tertiary: '#bf708c', bg: '#1a1b1d' } },
  { id: 'midnight-rose', name: 'Midnight Rose', description: 'Deep purples & rose gold', colors: { primary: '#e8b4b8', secondary: '#c77dff', tertiary: '#7b2cbf', bg: '#0d0d12' } },
  { id: 'ocean-dusk', name: 'Ocean Dusk', description: 'Teal meets warm coral', colors: { primary: '#64dfdf', secondary: '#ff9f7f', tertiary: '#5e60ce', bg: '#0a1628' } },
  { id: 'autumn-ember', name: 'Autumn Ember', description: 'Warm rusts & forest', colors: { primary: '#f4a261', secondary: '#e76f51', tertiary: '#2a9d8f', bg: '#1a1512' } },
  { id: 'tokyo-night', name: 'Tokyo Night', description: 'Neon pink on indigo', colors: { primary: '#ff79c6', secondary: '#bd93f9', tertiary: '#8be9fd', bg: '#0d0e1c' } },
  { id: 'sage-blush', name: 'Sage & Blush', description: 'Earthy green & soft pink', colors: { primary: '#a7c4bc', secondary: '#e8b4bc', tertiary: '#d4a373', bg: '#181d1a' } },
]

type AiMode = 'free' | 'paid'  // free = Kolors (slow but free), paid = Fal.ai (fast)

interface StorageData {
  userProfile: UserProfile | null
  tryOnHistory: TryOnResult[]
  theme?: ThemeId
  aiMode?: AiMode
}

const loadFromStorage = async (): Promise<StorageData> => {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const data = result[STORAGE_KEY]
        resolve(data || { userProfile: null, tryOnHistory: [], theme: 'champagne-gold', aiMode: 'paid' })
      })
    } else {
      // Fallback to localStorage for development
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        resolve(stored ? JSON.parse(stored) : { userProfile: null, tryOnHistory: [], theme: 'champagne-gold', aiMode: 'paid' })
      } catch {
        resolve({ userProfile: null, tryOnHistory: [], theme: 'champagne-gold', aiMode: 'paid' })
      }
    }
  })
}

const saveToStorage = async (data: StorageData): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        console.log('[TryOn] Data saved to Chrome storage')
        resolve()
      })
    } else {
      // Fallback to localStorage for development
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {}
      resolve()
    }
  })
}

// Apply theme to document
const applyTheme = (themeId: ThemeId) => {
  document.documentElement.setAttribute('data-theme', themeId)
}

// Button Component
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const sizeClasses = { sm: 'px-3 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
const variantClasses = {
  primary: 'relative overflow-hidden bg-gradient-to-r from-champagne-400 to-champagne-500 text-noir-950 hover:from-champagne-300 hover:to-champagne-400 shadow-glow-sm hover:shadow-glow font-semibold',
  secondary: 'border border-noir-600 text-noir-100 hover:border-champagne-400 hover:text-champagne-300 bg-noir-900/50',
  ghost: 'text-noir-300 hover:text-champagne-400 hover:bg-noir-800/50'
}

function Button({ variant = 'primary', size = 'md', loading = false, icon, iconPosition = 'left', children, className = '', disabled, onClick }: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <motion.button type="button" whileHover={{ scale: isDisabled ? 1 : 1.02 }} whileTap={{ scale: isDisabled ? 1 : 0.98 }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={isDisabled} onClick={onClick}>
      {loading ? <span className="loading-dots"><span /><span /><span /></span> : (
        <>{icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
        {children && <span>{children}</span>}
        {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}</>
      )}
    </motion.button>
  )
}

// Card Component
function Card({ variant = 'default', children, className = '' }: { variant?: 'default' | 'glass'; children: React.ReactNode; className?: string }) {
  const variants = { default: 'bg-noir-900/60 backdrop-blur-xl border border-noir-800 shadow-lg', glass: 'bg-white/5 backdrop-blur-lg border border-white/10' }
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-5 ${variants[variant]} ${className}`}>{children}</motion.div>
}

// Compress and resize image for faster upload
async function compressImage(dataUrl: string, maxSize = 800, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      
      // Scale down if larger than maxSize
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width *= ratio
        height *= ratio
      }
      
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

// Photo Uploader
function PhotoUploader({ currentPhoto, onPhotoSelect }: { currentPhoto?: string | null; onPhotoSelect: (photo: string) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentPhoto || null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setIsProcessing(true)
    const reader = new FileReader()
    reader.onload = async (e) => { 
      const result = e.target?.result as string
      // Compress image to reduce storage and upload size
      const compressed = await compressImage(result, 1024, 0.9)
      setPreview(compressed)
      onPhotoSelect(compressed)
      setIsProcessing(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="w-full">
      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" id="photo-upload" />
      {preview ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative aspect-[3/4] rounded-xl overflow-hidden group">
          <img src={preview} alt="Your photo" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-noir-950/80 via-transparent to-transparent" />
          <motion.div className="absolute inset-0 flex items-center justify-center gap-3 bg-noir-950/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="secondary" size="sm" icon={<RotateCcw className="w-4 h-4" />} onClick={() => document.getElementById('photo-upload')?.click()}>Change</Button>
            <Button variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={() => setPreview(null)}>Remove</Button>
          </motion.div>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
            <Check className="w-4 h-4 text-white" />
          </motion.div>
        </motion.div>
      ) : (
        <motion.div onDrop={(e) => { e.preventDefault(); setIsDragging(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
          onClick={() => document.getElementById('photo-upload')?.click()}
          className={`relative aspect-[3/4] rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ease-out ${isDragging ? 'border-champagne-400 bg-champagne-500/10' : 'border-noir-700 hover:border-champagne-500/50 bg-noir-900/50'}`}>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            {isProcessing ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><div className="w-12 h-12 rounded-full border-2 border-champagne-400 border-t-transparent" /></motion.div> : (
              <>
                <motion.div animate={isDragging ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }} className={`w-20 h-20 rounded-2xl mb-4 flex items-center justify-center ${isDragging ? 'bg-champagne-500/20' : 'bg-noir-800'}`}>
                  {isDragging ? <Upload className="w-8 h-8 text-champagne-400" /> : <User className="w-8 h-8 text-noir-500" />}
                </motion.div>
                <p className="text-noir-200 font-medium mb-1">{isDragging ? 'Drop your photo here' : 'Upload your photo'}</p>
                <p className="text-noir-500 text-sm mb-4">Drag & drop or click to browse</p>
                <div className="flex items-center gap-2 text-xs text-noir-600"><Camera className="w-3 h-3" /><span>Front-facing, form-fitting clothes</span></div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// Measurement Field
function MeasurementField({ label, value, onChange, unit }: { label: string; value: number | null; onChange: (v: number | null) => void; unit: string }) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-noir-800/50 border border-noir-700 hover:border-noir-600 focus-within:border-champagne-500 transition-all duration-200">
      <Ruler className="w-4 h-4 text-noir-500 flex-shrink-0" />
      <label className="flex-1 text-sm text-noir-300 cursor-pointer">{label}</label>
      <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} placeholder="0"
        className="w-16 bg-transparent text-right text-champagne-300 font-mono focus:outline-none placeholder-noir-600" />
      <span className="text-xs text-noir-500 w-6">{unit}</span>
    </motion.div>
  )
}

// Main Popup Component
export default function Popup() {
  const [currentView, setView] = useState<AppView>('home')
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('welcome')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [detectedProducts, setDetectedProducts] = useState<DetectedProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<DetectedProduct | null>(null)
  const [currentTryOn, setCurrentTryOn] = useState<TryOnResult | null>(null)
  const [tryOnHistory, setTryOnHistory] = useState<TryOnResult[]>([])
  const [isGenerating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [isDetecting, setIsDetecting] = useState(true)
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('champagne-gold')
  const [aiMode, setAiMode] = useState<AiMode>('paid')  // 'free' = Kolors, 'paid' = Fal.ai

  const [isLoading, setIsLoading] = useState(true)

  // Pre-warm backend connection on popup open
  useEffect(() => {
    api.checkHealth().then(health => {
      console.log('[TryOn] Backend pre-check:', health)
    })
  }, [])

  // Listen for product detection from content script
  useEffect(() => {
    const handleMessage = (message: { type: string; products?: DetectedProduct[] }) => {
      if (message.type === 'PRODUCTS_DETECTED' && message.products) {
        console.log('[TryOn Popup] Received products:', message.products.length)
        setDetectedProducts(message.products)
        setIsDetecting(false)
      }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage)
      
      // Request product detection from current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'DETECT_PRODUCTS' }, (response) => {
            console.log('[TryOn Popup] Detection request sent, response:', response)
            // Give it some time then stop detecting animation
            setTimeout(() => setIsDetecting(false), 2000)
          })
        }
      })

      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage)
      }
    } else {
      // Not in extension context
      setTimeout(() => setIsDetecting(false), 1500)
    }
  }, [])

  // Load stored profile and theme on mount
  useEffect(() => {
    const init = async () => {
      try {
        const { userProfile: stored, tryOnHistory: history, theme, aiMode: savedAiMode } = await loadFromStorage()
        console.log('[TryOn] Loaded profile from storage:', stored ? 'found' : 'not found')
        
        // Apply saved theme
        const savedTheme = theme || 'champagne-gold'
        setCurrentTheme(savedTheme)
        applyTheme(savedTheme)
        
        // Apply saved AI mode
        setAiMode(savedAiMode || 'paid')
        
        if (stored) {
          setUserProfile(stored)
          setTryOnHistory(history || [])
          // Only require photo for onboarding completion (measurements are now optional)
          const isComplete = stored.photo
          setView(isComplete ? 'home' : 'onboarding')
        } else {
          setView('onboarding')
        }
      } catch (err) {
        console.error('[TryOn] Error loading profile:', err)
        setView('onboarding')
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Save profile, theme, and AI mode whenever they change
  useEffect(() => {
    if (!isLoading) {
      saveToStorage({ userProfile, tryOnHistory, theme: currentTheme, aiMode })
    }
  }, [userProfile, tryOnHistory, currentTheme, aiMode, isLoading])

  // Handle theme change
  const handleThemeChange = (themeId: ThemeId) => {
    setCurrentTheme(themeId)
    applyTheme(themeId)
  }

  const updateMeasurements = (updates: Partial<UserMeasurements>) => {
    setUserProfile(prev => {
      if (!prev) return { id: crypto.randomUUID(), photo: null, photoThumbnail: null, measurements: { height: null, weight: null, chest: null, waist: null, hips: null, inseam: null, shoulderWidth: null, armLength: null, ...updates }, createdAt: Date.now(), updatedAt: Date.now() }
      return { ...prev, measurements: { ...prev.measurements, ...updates }, updatedAt: Date.now() }
    })
  }

  const setUserPhoto = (photo: string) => {
    setUserProfile(prev => {
      if (!prev) return { id: crypto.randomUUID(), photo, photoThumbnail: photo, measurements: { height: null, weight: null, chest: null, waist: null, hips: null, inseam: null, shoulderWidth: null, armLength: null }, createdAt: Date.now(), updatedAt: Date.now() }
      return { ...prev, photo, photoThumbnail: photo, updatedAt: Date.now() }
    })
  }

  const toggleFavorite = (resultId: string) => {
    setTryOnHistory(prev => prev.map(r => r.id === resultId ? { ...r, isFavorite: !r.isFavorite } : r))
    if (currentTryOn?.id === resultId) setCurrentTryOn(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null)
  }

  return (
    <div className="w-[380px] h-[580px] overflow-hidden" style={{ background: 'var(--surface-bg)' }}>
      <AnimatePresence mode="wait">
        {currentView === 'onboarding' && <OnboardingView key="onboarding" step={onboardingStep} setStep={setOnboardingStep} userProfile={userProfile} setUserPhoto={setUserPhoto} updateMeasurements={updateMeasurements} onComplete={() => setView('home')} />}
        {currentView === 'home' && <HomeView key="home" userProfile={userProfile} detectedProducts={detectedProducts} isDetecting={isDetecting} setSelectedProduct={setSelectedProduct} setView={setView} />}
        {currentView === 'try-on' && <TryOnView key="try-on" userProfile={userProfile} selectedProduct={selectedProduct} currentTryOn={currentTryOn} setCurrentTryOn={setCurrentTryOn} isGenerating={isGenerating} setGenerating={setGenerating} generationProgress={generationProgress} setGenerationProgress={setGenerationProgress} setTryOnHistory={setTryOnHistory} toggleFavorite={toggleFavorite} setView={setView} aiMode={aiMode} setAiMode={setAiMode} />}
        {currentView === 'profile' && <ProfileView key="profile" userProfile={userProfile} setUserPhoto={setUserPhoto} updateMeasurements={updateMeasurements} setView={setView} />}
        {currentView === 'history' && <HistoryView key="history" tryOnHistory={tryOnHistory} setTryOnHistory={setTryOnHistory} setCurrentTryOn={setCurrentTryOn} setSelectedProduct={setSelectedProduct} toggleFavorite={toggleFavorite} setView={setView} />}
        {currentView === 'settings' && <SettingsView key="settings" setView={setView} currentTheme={currentTheme} onThemeChange={handleThemeChange} />}
      </AnimatePresence>
    </div>
  )
}

// Measurement validation helper
function validateMeasurements(measurements: UserMeasurements): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []
  
  // Height validation (reasonable range: 100-250 cm)
  if (measurements.height !== null) {
    if (measurements.height < 100 || measurements.height > 250) {
      warnings.push(`Height ${measurements.height}cm seems unusual (expected 100-250cm)`)
    }
  }
  
  // Chest validation (reasonable range: 60-150 cm)
  if (measurements.chest !== null) {
    if (measurements.chest < 60 || measurements.chest > 150) {
      warnings.push(`Chest ${measurements.chest}cm seems unusual (expected 60-150cm)`)
    }
  }
  
  // Waist validation (reasonable range: 50-140 cm)
  if (measurements.waist !== null) {
    if (measurements.waist < 50 || measurements.waist > 140) {
      warnings.push(`Waist ${measurements.waist}cm seems unusual (expected 50-140cm)`)
    }
  }
  
  // Hips validation (reasonable range: 60-160 cm)
  if (measurements.hips !== null) {
    if (measurements.hips < 60 || measurements.hips > 160) {
      warnings.push(`Hips ${measurements.hips}cm seems unusual (expected 60-160cm)`)
    }
  }
  
  // Logical checks
  if (measurements.chest !== null && measurements.waist !== null) {
    if (measurements.waist > measurements.chest * 1.2) {
      warnings.push(`Waist larger than chest seems unusual`)
    }
  }
  
  if (measurements.waist !== null && measurements.hips !== null) {
    if (measurements.waist > measurements.hips * 1.3) {
      warnings.push(`Waist larger than hips seems unusual`)
    }
  }
  
  return { valid: warnings.length === 0, warnings }
}

// Size recommendation based on measurements
function getSizeRecommendation(measurements: UserMeasurements, garmentType: GarmentType): string | null {
  const { chest, waist, hips } = measurements
  
  if (garmentType === 'pants' || garmentType === 'jeans') {
    if (!waist) return null
    if (waist < 68) return 'XS'
    if (waist < 76) return 'S'
    if (waist < 84) return 'M'
    if (waist < 92) return 'L'
    if (waist < 100) return 'XL'
    return 'XXL'
  }
  
  // For tops, use chest measurement
  if (!chest) return null
  if (chest < 84) return 'XS'
  if (chest < 92) return 'S'
  if (chest < 100) return 'M'
  if (chest < 108) return 'L'
  if (chest < 116) return 'XL'
  return 'XXL'
}

// Onboarding View
function OnboardingView({ step, setStep, userProfile, setUserPhoto, updateMeasurements, onComplete }: { step: OnboardingStep; setStep: (s: OnboardingStep) => void; userProfile: UserProfile | null; setUserPhoto: (p: string) => void; updateMeasurements: (u: Partial<UserMeasurements>) => void; onComplete: () => void }) {
  const steps = [{ id: 'welcome' as const, icon: Sparkles }, { id: 'photo-upload' as const, icon: Camera }, { id: 'measurements' as const, icon: Ruler }, { id: 'complete' as const, icon: CheckCircle2 }]
  const currentIndex = steps.findIndex(s => s.id === step)
  const goNext = () => currentIndex < steps.length - 1 && setStep(steps[currentIndex + 1].id)
  const goBack = () => currentIndex > 0 && setStep(steps[currentIndex - 1].id)
  const hasPhoto = !!userProfile?.photo
  
  // Validate measurements
  const measurementValidation = userProfile?.measurements ? validateMeasurements(userProfile.measurements) : { valid: true, warnings: [] }
  const hasSomeMeasurements = userProfile?.measurements.height || userProfile?.measurements.chest || userProfile?.measurements.waist || userProfile?.measurements.hips

  return (
    <div className="min-h-[500px] flex flex-col mesh-bg">
      <div className="px-6 pt-6"><div className="flex items-center justify-between mb-2">
        {steps.map((s, idx) => (
          <div key={s.id} className="flex items-center">
            <motion.div animate={{ scale: idx === currentIndex ? 1.1 : 1, backgroundColor: idx <= currentIndex ? '#d4ad75' : '#3f4147' }} className="w-8 h-8 rounded-full flex items-center justify-center">
              <s.icon className={`w-4 h-4 ${idx <= currentIndex ? 'text-noir-950' : 'text-noir-500'}`} />
            </motion.div>
            {idx < steps.length - 1 && <div className={`w-12 h-0.5 mx-1 ${idx < currentIndex ? 'bg-champagne-500' : 'bg-noir-700'}`} />}
          </div>
        ))}
      </div></div>
      <div className="flex-1 p-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center text-center h-full justify-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-24 h-24 rounded-3xl bg-gradient-to-br from-champagne-400 to-runway-500 flex items-center justify-center mb-6 shadow-glow">
                <Shirt className="w-12 h-12 text-noir-950" />
              </motion.div>
              <h1 className="font-display text-3xl text-noir-50 mb-3">Virtual Try-On</h1>
              <p className="text-noir-400 mb-8 max-w-xs">See how clothes look on you before you buy. Upload your photo and shop with confidence.</p>
              <Button onClick={goNext} icon={<ChevronRight className="w-4 h-4" />} iconPosition="right">Get Started</Button>
            </motion.div>
          )}
          {step === 'photo-upload' && (
            <motion.div key="photo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="text-center"><h2 className="font-display text-2xl text-noir-50 mb-2">Your Photo</h2><p className="text-noir-400 text-sm">Upload a full-body photo</p></div>
              <div className="max-w-[240px] mx-auto"><PhotoUploader currentPhoto={userProfile?.photo} onPhotoSelect={setUserPhoto} /></div>
              <div className="flex gap-3"><Button variant="secondary" onClick={goBack} icon={<ChevronLeft className="w-4 h-4" />}>Back</Button><Button className="flex-1" onClick={goNext} disabled={!hasPhoto} icon={<ChevronRight className="w-4 h-4" />} iconPosition="right">Continue</Button></div>
            </motion.div>
          )}
          {step === 'measurements' && (
            <motion.div key="measurements" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="text-center">
                <h2 className="font-display text-2xl text-noir-50 mb-2">Your Measurements</h2>
                <p className="text-noir-400 text-sm">Optional - helps with size recommendations</p>
              </div>
              <div className="space-y-3">
                <MeasurementField label="Height" value={userProfile?.measurements.height ?? null} onChange={(v) => updateMeasurements({ height: v })} unit="cm" />
                <MeasurementField label="Chest" value={userProfile?.measurements.chest ?? null} onChange={(v) => updateMeasurements({ chest: v })} unit="cm" />
                <MeasurementField label="Waist" value={userProfile?.measurements.waist ?? null} onChange={(v) => updateMeasurements({ waist: v })} unit="cm" />
                <MeasurementField label="Hips" value={userProfile?.measurements.hips ?? null} onChange={(v) => updateMeasurements({ hips: v })} unit="cm" />
              </div>
              {/* Measurement warnings */}
              {measurementValidation.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-300">
                      <p className="font-medium mb-1">Please check your measurements:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-400/80">
                        {measurementValidation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={goBack} icon={<ChevronLeft className="w-4 h-4" />}>Back</Button>
                <Button className="flex-1" onClick={goNext} icon={<ChevronRight className="w-4 h-4" />} iconPosition="right">
                  {hasSomeMeasurements ? 'Continue' : 'Skip'}
                </Button>
              </div>
              {!hasSomeMeasurements && (
                <p className="text-center text-xs text-noir-500">You can add measurements later in your profile</p>
              )}
            </motion.div>
          )}
          {step === 'complete' && (
            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center text-center h-full justify-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-6 shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="font-display text-2xl text-noir-50 mb-3">You're All Set!</h2>
              <p className="text-noir-400 mb-8 max-w-xs">Your profile is ready. Start browsing clothing sites!</p>
              <Button onClick={onComplete} size="lg" icon={<Sparkles className="w-4 h-4" />}>Start Trying On</Button>
              <Button variant="ghost" onClick={goBack} className="mt-3">Edit Profile</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Home View
function HomeView({ userProfile, detectedProducts, isDetecting, setSelectedProduct, setView }: { userProfile: UserProfile | null; detectedProducts: DetectedProduct[]; isDetecting: boolean; setSelectedProduct: (p: DetectedProduct | null) => void; setView: (v: AppView) => void }) {
  const handleTryOn = (product: DetectedProduct) => {
    setSelectedProduct(product)
    setView('try-on')
  }

  return (
    <div className="min-h-[500px] flex flex-col mesh-bg">
      <header className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-10 h-10 rounded-xl bg-gradient-to-br from-champagne-400 to-runway-500 flex items-center justify-center shadow-glow-sm">
              <Shirt className="w-5 h-5 text-noir-950" />
            </motion.div>
            <div><h1 className="font-display text-lg text-noir-50">Virtual Try-On</h1><p className="text-xs text-noir-500">Ready to shop</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('history')} className="p-2 rounded-lg text-noir-400 hover:text-champagne-400 hover:bg-noir-800/50 transition-colors"><History className="w-5 h-5" /></button>
            <button onClick={() => setView('profile')} className="p-2 rounded-lg text-noir-400 hover:text-champagne-400 hover:bg-noir-800/50 transition-colors"><User className="w-5 h-5" /></button>
            <button onClick={() => setView('settings')} className="p-2 rounded-lg text-noir-400 hover:text-champagne-400 hover:bg-noir-800/50 transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
        </div>
      </header>
      {userProfile?.photoThumbnail && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-5 mb-4">
          <Card variant="glass" className="p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={userProfile.photoThumbnail} alt="Profile" className="w-12 h-12 rounded-lg object-cover border border-noir-700" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-noir-900"><CheckCircle2 className="w-2.5 h-2.5 text-white" /></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-noir-200 font-medium">Profile Ready</p>
                <p className="text-xs text-noir-500 truncate">
                  {userProfile.measurements.height || userProfile.measurements.chest ? (
                    <>
                      {userProfile.measurements.height ? `${userProfile.measurements.height}cm` : ''}
                      {userProfile.measurements.height && (userProfile.measurements.chest || userProfile.measurements.waist || userProfile.measurements.hips) ? ' • ' : ''}
                      {[userProfile.measurements.chest, userProfile.measurements.waist, userProfile.measurements.hips].filter(Boolean).join('/')}
                    </>
                  ) : 'No measurements set'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setView('profile')}>Edit</Button>
            </div>
          </Card>
        </motion.div>
      )}
      <div className="flex-1 px-5 pb-5 overflow-y-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Scan className={`w-4 h-4 ${isDetecting ? 'text-champagne-400 animate-pulse' : detectedProducts.length > 0 ? 'text-emerald-400' : 'text-noir-500'}`} />
            <span className="text-sm text-noir-300">{isDetecting ? 'Scanning page...' : `Detected Items`}</span>
            {!isDetecting && detectedProducts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-champagne-500/20 text-champagne-400 border border-champagne-500/30">{detectedProducts.length}</span>
            )}
          </div>
        </motion.div>

        {/* Show detected products */}
        {!isDetecting && detectedProducts.length > 0 && (
          <div className="space-y-3">
            {detectedProducts.map((product, index) => {
              const sizeRec = userProfile?.measurements ? getSizeRecommendation(userProfile.measurements, product.garmentType) : null
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="rounded-xl overflow-hidden ring-1 ring-noir-700 hover:ring-champagne-500 transition-all duration-300 cursor-pointer"
                  onClick={() => handleTryOn(product)}
                >
                  <div className="flex gap-3 p-3 bg-noir-900/60">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-noir-800">
                      {product.thumbnailUrl || product.imageUrl ? (
                        <img src={product.thumbnailUrl || product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-noir-600" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <p className="text-sm text-noir-200 font-medium line-clamp-2 mb-1">{product.title}</p>
                      <div className="flex items-center gap-2 text-xs text-noir-500 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-noir-800 text-noir-400">{product.garmentType}</span>
                        {product.price && <span className="text-champagne-400 font-medium">{product.price}</span>}
                        {sizeRec && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Ruler className="w-3 h-3" />
                            Size {sizeRec}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col justify-center">
                      <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); handleTryOn(product) }}>Try On</Button>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-gradient-to-t from-noir-950/80 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-noir-500">
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate">{product.sourceDomain}</span>
                      </div>
                      {sizeRec && (
                        <span className="text-[10px] text-noir-500">Based on your measurements</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {!isDetecting && detectedProducts.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-noir-800/50 flex items-center justify-center mb-4"><Scan className="w-8 h-8 text-noir-600" /></div>
            <h3 className="font-display text-lg text-noir-300 mb-2">No Items Detected</h3>
            <p className="text-sm text-noir-500 max-w-xs mb-4">Browse a clothing website and we'll automatically detect items you can try on.</p>
            <p className="text-xs text-champagne-500/70">Lululemon, Amazon, ASOS, Zara, H&M, Nordstrom + more</p>
          </motion.div>
        )}
        {isDetecting && <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-noir-800/50 animate-pulse" />)}</div>}
      </div>
    </div>
  )
}

// Create composite image of user + product
async function createTryOnComposite(userPhotoUrl: string, productImageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject('Canvas not supported'); return }

    const userImg = new Image()
    const productImg = new Image()
    userImg.crossOrigin = 'anonymous'
    productImg.crossOrigin = 'anonymous'

    let loadedCount = 0
    const onLoad = () => {
      loadedCount++
      if (loadedCount < 2) return

      // Set canvas to user image size
      canvas.width = userImg.width
      canvas.height = userImg.height

      // Draw user photo as base
      ctx.drawImage(userImg, 0, 0)

      // Calculate product overlay position (centered on upper body area)
      const productAspect = productImg.width / productImg.height
      const overlayHeight = canvas.height * 0.55 // Product takes ~55% of height
      const overlayWidth = overlayHeight * productAspect
      const overlayX = (canvas.width - overlayWidth) / 2
      const overlayY = canvas.height * 0.12 // Start at ~12% from top

      // Apply blending for try-on effect
      ctx.globalAlpha = 0.85
      ctx.globalCompositeOperation = 'multiply'
      
      // Draw product with slight shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 20
      ctx.shadowOffsetY = 10
      ctx.drawImage(productImg, overlayX, overlayY, overlayWidth, overlayHeight)
      
      // Overlay product again with normal blend for visibility
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 0.7
      ctx.shadowBlur = 0
      ctx.drawImage(productImg, overlayX, overlayY, overlayWidth, overlayHeight)

      // Reset context
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      // Add "AI Preview" badge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(10, canvas.height - 40, 120, 30)
      ctx.fillStyle = '#d4ad75'
      ctx.font = 'bold 14px system-ui'
      ctx.fillText('✨ AI Preview', 20, canvas.height - 18)

      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }

    userImg.onload = onLoad
    productImg.onload = onLoad
    userImg.onerror = () => reject('Failed to load user image')
    productImg.onerror = () => {
      // If product image fails to load (CORS), use just user photo with overlay text
      loadedCount = 2
      canvas.width = userImg.width
      canvas.height = userImg.height
      ctx.drawImage(userImg, 0, 0)
      
      // Add gradient overlay to suggest clothing placement
      const gradient = ctx.createLinearGradient(0, canvas.height * 0.1, 0, canvas.height * 0.7)
      gradient.addColorStop(0, 'rgba(212, 173, 117, 0.2)')
      gradient.addColorStop(0.5, 'rgba(212, 173, 117, 0.1)')
      gradient.addColorStop(1, 'rgba(212, 173, 117, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(canvas.width * 0.15, canvas.height * 0.1, canvas.width * 0.7, canvas.height * 0.6)
      
      // Add info text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(10, canvas.height - 70, canvas.width - 20, 60)
      ctx.fillStyle = '#d4ad75'
      ctx.font = 'bold 14px system-ui'
      ctx.fillText('✨ Try-On Preview', 20, canvas.height - 48)
      ctx.fillStyle = '#999'
      ctx.font = '12px system-ui'
      ctx.fillText('Full AI generation requires backend', 20, canvas.height - 28)
      
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }

    userImg.src = userPhotoUrl
    productImg.src = productImageUrl
  })
}

// Try-On View
function TryOnView({ userProfile, selectedProduct, currentTryOn, setCurrentTryOn, isGenerating, setGenerating, generationProgress, setGenerationProgress, setTryOnHistory, toggleFavorite, setView, aiMode, setAiMode }: any) {
  const [generationMethod, setGenerationMethod] = useState<'checking' | 'api' | 'local'>('checking')

  useEffect(() => {
    if (selectedProduct && userProfile?.photo && !currentTryOn && !isGenerating) {
      setGenerating(true)
      setGenerationMethod('checking')
      let progress = 0
      const interval = setInterval(() => { 
        progress = Math.min(progress + Math.random() * 10, 85)
        setGenerationProgress(progress) 
      }, 300)

      const generateTryOn = async () => {
        try {
          // Check if backend is available
          const health = await api.checkHealth()
          console.log('[TryOn] Backend status:', health)

          if (health.available) {
            setGenerationMethod('api')
            setGenerationProgress(30)

            // Use backend API for try-on
            const response = await api.generateTryOn({
              userPhoto: userProfile.photo,
              productImage: selectedProduct.imageUrl,
              measurements: userProfile.measurements,
              garmentType: selectedProduct.garmentType,
              aiMode: aiMode  // 'free' = Kolors, 'paid' = Fal.ai
            })

            clearInterval(interval)
            setGenerationProgress(100)

            if (response.success && response.resultImage) {
              console.log('[TryOn] API generation successful, method:', response.method)
              const result: TryOnResult = { 
                id: crypto.randomUUID(), 
                userPhotoId: userProfile.id, 
                productId: selectedProduct.id, 
                product: selectedProduct, 
                resultImageUrl: response.resultImage, 
                generatedAt: Date.now(), 
                isFavorite: false 
              }
              setCurrentTryOn(result)
              setTryOnHistory((prev: TryOnResult[]) => [result, ...prev].slice(0, 50))
              setGenerating(false)
              return
            } else {
              console.warn('[TryOn] API returned error:', response.error)
              throw new Error(response.error || 'API generation failed')
            }
          } else {
            console.log('[TryOn] Backend not available, using local composite')
            throw new Error('Backend not available')
          }
        } catch (apiError) {
          // Fall back to local composite
          console.log('[TryOn] Falling back to local composite:', apiError)
          setGenerationMethod('local')
          
          try {
            const compositeUrl = await createTryOnComposite(userProfile.photo, selectedProduct.imageUrl)
            clearInterval(interval)
            setGenerationProgress(100)
            
            const result: TryOnResult = { 
              id: crypto.randomUUID(), 
              userPhotoId: userProfile.id, 
              productId: selectedProduct.id, 
              product: selectedProduct, 
              resultImageUrl: compositeUrl, 
              generatedAt: Date.now(), 
              isFavorite: false 
            }
            setCurrentTryOn(result)
            setTryOnHistory((prev: TryOnResult[]) => [result, ...prev].slice(0, 50))
            setGenerating(false)
          } catch (compositeError) {
            console.error('[TryOn] Composite error:', compositeError)
            clearInterval(interval)
            setGenerationProgress(100)
            
            // Final fallback to user photo
            const result: TryOnResult = { 
              id: crypto.randomUUID(), 
              userPhotoId: userProfile.id, 
              productId: selectedProduct.id, 
              product: selectedProduct, 
              resultImageUrl: userProfile.photo!, 
              generatedAt: Date.now(), 
              isFavorite: false 
            }
            setCurrentTryOn(result)
            setTryOnHistory((prev: TryOnResult[]) => [result, ...prev].slice(0, 50))
            setGenerating(false)
          }
        }
      }

      generateTryOn()
    }
  }, [selectedProduct, userProfile, currentTryOn, isGenerating])

  const sizeRec = selectedProduct && userProfile?.measurements ? getSizeRecommendation(userProfile.measurements, selectedProduct.garmentType) : null

  return (
    <div className="min-h-[500px] flex flex-col mesh-bg">
      <header className="px-5 pt-5 pb-4 flex items-center gap-3">
        <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-lg text-noir-400 hover:text-noir-200 hover:bg-noir-800/50 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="font-display text-lg text-noir-50">Virtual Try-On</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-noir-500 truncate">{selectedProduct?.title || 'No product'}</p>
            {sizeRec && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                <Ruler className="w-2.5 h-2.5" />
                {sizeRec}
              </span>
            )}
          </div>
        </div>
      </header>
      
      {/* AI Mode Toggle */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-center gap-1 p-1 bg-noir-800/50 rounded-lg border border-noir-700/50">
          <button
            onClick={() => setAiMode('free')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              aiMode === 'free'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-noir-400 hover:text-noir-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Free
            <span className="text-[9px] opacity-70">(~60s)</span>
          </button>
          <button
            onClick={() => setAiMode('paid')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              aiMode === 'paid'
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'text-noir-400 hover:text-noir-200'
            }`}
          >
            <Zap className="w-3 h-3" />
            Fast
            <span className="text-[9px] opacity-70">(~15s)</span>
          </button>
        </div>
        <p className="text-[10px] text-center text-noir-500 mt-1">
          {aiMode === 'free' ? '🆓 Kolors AI (Hugging Face)' : '⚡ Fal.ai (~$0.01/image)'}
        </p>
      </div>
      <div className="flex-1 px-5 pb-5 flex flex-col">
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="relative mb-6"><motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 w-28 h-28 -m-4 rounded-full border-2 border-champagne-500/30" />
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-noir-800 shadow-glow flex items-center justify-center"><Loader2 className="w-8 h-8 text-champagne-400 animate-spin" /></div></div>
            <h3 className="font-display text-xl text-noir-50 mb-2">
              {generationMethod === 'checking' ? 'Connecting...' : 
               generationMethod === 'api' ? '✨ AI Generation' : 'Creating Preview'}
            </h3>
            <p className="text-xs text-noir-400 mb-3">
              {generationMethod === 'checking' ? 'Checking AI backend...' :
               generationMethod === 'api' ? 'Using advanced AI model' : 'Using local preview'}
            </p>
            <div className="w-48 h-1.5 bg-noir-800 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${generationProgress}%` }} className="h-full bg-gradient-to-r from-champagne-500 to-runway-500 rounded-full" /></div>
            <p className="text-xs text-noir-500 mt-2">{Math.round(generationProgress)}%</p>
          </div>
        ) : currentTryOn ? (
          <>
            <div className="flex-1 relative rounded-xl overflow-hidden bg-noir-800 group">
              <img src={currentTryOn.resultImageUrl} alt="Try-on result" className="w-full h-full object-contain" />
              <div className="absolute top-3 right-3 flex gap-2">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => toggleFavorite(currentTryOn.id)}
                  className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${currentTryOn.isFavorite ? 'bg-red-500/80 text-white' : 'bg-noir-900/60 text-noir-300 hover:text-white'}`}>
                  <Heart className={`w-4 h-4 ${currentTryOn.isFavorite ? 'fill-current' : ''}`} />
                </motion.button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" icon={<RotateCcw className="w-4 h-4" />}>Regenerate</Button>
              <Button variant="secondary" icon={<Download className="w-4 h-4" />} />
              <Button variant="secondary" icon={<Share2 className="w-4 h-4" />} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-noir-800/50 flex items-center justify-center mb-4"><AlertCircle className="w-8 h-8 text-noir-500" /></div>
            <h3 className="font-display text-lg text-noir-200 mb-2">No Product Selected</h3>
            <Button onClick={() => setView('home')} icon={<ChevronLeft className="w-4 h-4" />}>Back to Home</Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Profile View
function ProfileView({ userProfile, setUserPhoto, updateMeasurements, setView }: { userProfile: UserProfile | null; setUserPhoto: (p: string) => void; updateMeasurements: (u: Partial<UserMeasurements>) => void; setView: (v: AppView) => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-[500px] flex flex-col mesh-bg">
      <header className="px-5 pt-5 pb-4 flex items-center gap-3">
        <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-lg text-noir-400 hover:text-noir-200 hover:bg-noir-800/50 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="font-display text-lg text-noir-50">Your Profile</h1>
      </header>
      <div className="flex-1 px-5 pb-5 overflow-y-auto space-y-6">
        <div className="max-w-[200px] mx-auto"><PhotoUploader currentPhoto={userProfile?.photo} onPhotoSelect={setUserPhoto} /></div>
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-noir-500 uppercase tracking-wider px-1">Measurements</h4>
          <MeasurementField label="Height" value={userProfile?.measurements.height ?? null} onChange={(v) => updateMeasurements({ height: v })} unit="cm" />
          <MeasurementField label="Chest" value={userProfile?.measurements.chest ?? null} onChange={(v) => updateMeasurements({ chest: v })} unit="cm" />
          <MeasurementField label="Waist" value={userProfile?.measurements.waist ?? null} onChange={(v) => updateMeasurements({ waist: v })} unit="cm" />
          <MeasurementField label="Hips" value={userProfile?.measurements.hips ?? null} onChange={(v) => updateMeasurements({ hips: v })} unit="cm" />
        </div>
      </div>
    </motion.div>
  )
}

// History View
function HistoryView({ tryOnHistory, setTryOnHistory, setCurrentTryOn, setSelectedProduct, toggleFavorite, setView }: any) {
  const favorites = tryOnHistory.filter((r: TryOnResult) => r.isFavorite)
  const recent = tryOnHistory.filter((r: TryOnResult) => !r.isFavorite).slice(0, 20)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-[500px] flex flex-col mesh-bg">
      <header className="px-5 pt-5 pb-4 flex items-center gap-3">
        <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-lg text-noir-400 hover:text-noir-200 hover:bg-noir-800/50 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="font-display text-lg text-noir-50 flex-1">History</h1>
        {tryOnHistory.length > 0 && <Button variant="ghost" size="sm" className="text-red-400" onClick={() => confirm('Clear all history?') && setTryOnHistory([])}><Trash2 className="w-4 h-4" /></Button>}
      </header>
      <div className="flex-1 px-5 pb-5 overflow-y-auto">
        {tryOnHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-noir-800/50 flex items-center justify-center mb-4"><Clock className="w-8 h-8 text-noir-600" /></div>
            <h3 className="font-display text-lg text-noir-300 mb-2">No History Yet</h3>
          </div>
        ) : (
          <div className="space-y-6">
            {favorites.length > 0 && <div><h3 className="text-xs font-medium text-champagne-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Heart className="w-3 h-3 fill-current" />Favorites</h3>
              <div className="grid grid-cols-2 gap-2">{favorites.map((r: TryOnResult) => <HistoryCard key={r.id} result={r} onView={() => { setSelectedProduct(r.product); setCurrentTryOn(r); setView('try-on') }} onToggleFavorite={() => toggleFavorite(r.id)} />)}</div></div>}
            {recent.length > 0 && <div><h3 className="text-xs font-medium text-noir-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Clock className="w-3 h-3" />Recent</h3>
              <div className="grid grid-cols-2 gap-2">{recent.map((r: TryOnResult) => <HistoryCard key={r.id} result={r} onView={() => { setSelectedProduct(r.product); setCurrentTryOn(r); setView('try-on') }} onToggleFavorite={() => toggleFavorite(r.id)} />)}</div></div>}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function HistoryCard({ result, onView, onToggleFavorite }: { result: TryOnResult; onView: () => void; onToggleFavorite: () => void }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onView} className="relative rounded-lg overflow-hidden bg-noir-800/50 cursor-pointer group">
      <div className="aspect-[3/4]"><img src={result.resultImageUrl} alt={result.product.title} className="w-full h-full object-cover" /></div>
      <div className="absolute inset-0 bg-gradient-to-t from-noir-950/80 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2"><p className="text-xs text-noir-200 line-clamp-1">{result.product.title}</p><p className="text-[10px] text-noir-500">{new Date(result.generatedAt).toLocaleDateString()}</p></div>
      <button onClick={(e) => { e.stopPropagation(); onToggleFavorite() }} className={`absolute top-2 right-2 p-1.5 rounded-md backdrop-blur-sm ${result.isFavorite ? 'bg-red-500/80 text-white' : 'bg-noir-900/60 text-noir-400'} opacity-0 group-hover:opacity-100 transition-opacity`}>
        <Heart className={`w-3 h-3 ${result.isFavorite ? 'fill-current' : ''}`} />
      </button>
    </motion.div>
  )
}

// Settings View
function SettingsView({ setView, currentTheme, onThemeChange }: { setView: (v: AppView) => void; currentTheme: ThemeId; onThemeChange: (t: ThemeId) => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-[500px] flex flex-col mesh-bg">
      <header className="px-5 pt-5 pb-4 flex items-center gap-3">
        <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-card/50 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="font-display text-lg text-theme-primary">Settings</h1>
      </header>
      <div className="flex-1 px-5 pb-5 space-y-4 overflow-y-auto">
        {/* Theme Selector */}
        <Card variant="glass" className="p-4">
          <h3 className="text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            Color Theme
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((theme) => (
              <motion.button
                key={theme.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onThemeChange(theme.id)}
                className={`relative rounded-xl overflow-hidden transition-all duration-200 ${
                  currentTheme === theme.id 
                    ? 'ring-2 ring-offset-2' 
                    : 'ring-1 ring-white/10 hover:ring-white/20'
                }`}
                style={{
                  ['--tw-ring-color' as string]: currentTheme === theme.id ? theme.colors.primary : undefined,
                  ['--tw-ring-offset-color' as string]: theme.colors.bg,
                }}
              >
                {/* Theme preview gradient */}
                <div 
                  className="h-12 w-full"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.bg} 0%, ${theme.colors.bg} 40%, ${theme.colors.primary} 70%, ${theme.colors.secondary} 85%, ${theme.colors.tertiary} 100%)`
                  }}
                />
                <div 
                  className="px-2 py-1.5 text-left"
                  style={{ background: theme.colors.bg }}
                >
                  <p className="text-xs font-medium truncate" style={{ color: theme.colors.primary }}>
                    {theme.name}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: `${theme.colors.primary}80` }}>
                    {theme.description}
                  </p>
                </div>
                {currentTheme === theme.id && (
                  <div 
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: theme.colors.primary }}
                  >
                    <Check className="w-3 h-3" style={{ color: theme.colors.bg }} />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </Card>
        
        <Card variant="glass" className="p-4">
          <h3 className="text-sm font-medium text-theme-primary mb-3">Supported Sites</h3>
          <div className="space-y-2 text-sm text-theme-secondary">
            <p>• Lululemon.com</p>
            <p>• Amazon.com</p>
            <p>• ASOS.com</p>
            <p>• Zara.com</p>
            <p>• H&M.com</p>
            <p>• Nordstrom.com</p>
          </div>
        </Card>
        
        <Card variant="glass" className="p-4">
          <h3 className="text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />About
          </h3>
          <p className="text-sm text-theme-secondary mb-3">
            Virtual Try-On uses AI to help you visualize how clothes will look on you.
          </p>
          <p className="text-xs text-theme-muted">Version 1.0.0</p>
        </Card>
        
        <div className="space-y-2">
          <Button variant="secondary" className="w-full justify-start" icon={<Mail className="w-4 h-4" />} onClick={() => window.open('mailto:support@fashiontryon.com')}>Contact Support</Button>
          <Button variant="secondary" className="w-full justify-start" icon={<ExternalLink className="w-4 h-4" />} onClick={() => window.open('https://fashiontryon.com/privacy')}>Privacy Policy</Button>
        </div>
      </div>
    </motion.div>
  )
}
