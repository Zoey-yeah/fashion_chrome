/**
 * Side Panel - Extended try-on experience
 * Provides a larger view for try-on results with more features
 */

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { 
  Shirt, 
  Heart, 
  Download, 
  Share2, 
  History,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  X
} from 'lucide-react'
import { useStore } from '~/store/useStore'
import { Button, Card } from '~/components/ui'
import '~/styles/globals.css'

function SidePanel() {
  const { 
    userProfile,
    currentTryOn, 
    tryOnHistory,
    selectedProduct,
    toggleFavorite,
    setCurrentTryOn,
    selectProduct,
    initialize
  } = useStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Navigate through history
  const currentIndex = tryOnHistory.findIndex(r => r.id === currentTryOn?.id)
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < tryOnHistory.length - 1 && currentIndex >= 0

  const goToPrev = () => {
    if (canGoPrev) {
      const prev = tryOnHistory[currentIndex - 1]
      setCurrentTryOn(prev)
      selectProduct(prev.product)
    }
  }

  const goToNext = () => {
    if (canGoNext) {
      const next = tryOnHistory[currentIndex + 1]
      setCurrentTryOn(next)
      selectProduct(next.product)
    }
  }

  return (
    <div className="h-screen flex flex-col mesh-bg overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-noir-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-champagne-400 to-runway-500 
                           flex items-center justify-center shadow-glow-sm">
              <Shirt className="w-5 h-5 text-noir-950" />
            </div>
            <div>
              <h1 className="font-display text-xl text-noir-50">Virtual Try-On</h1>
              <p className="text-xs text-noir-500">Side Panel View</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-noir-400 hover:text-champagne-400 
                               hover:bg-noir-800/50 transition-colors">
              <History className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Result View */}
        <div className="flex-1 p-6 flex flex-col">
          {currentTryOn ? (
            <>
              {/* Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canGoPrev}
                  onClick={goToPrev}
                  icon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <span className="text-sm text-noir-500">
                  {currentIndex + 1} of {tryOnHistory.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canGoNext}
                  onClick={goToNext}
                  icon={<ChevronRight className="w-4 h-4" />}
                  iconPosition="right"
                >
                  Next
                </Button>
              </div>

              {/* Image Display */}
              <div className="flex-1 relative rounded-2xl overflow-hidden bg-noir-900 group">
                <img
                  src={currentTryOn.resultImageUrl}
                  alt="Try-on result"
                  className="w-full h-full object-contain"
                />
                
                {/* Overlay Actions */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleFavorite(currentTryOn.id)}
                    className={`
                      p-3 rounded-xl backdrop-blur-sm transition-colors
                      ${currentTryOn.isFavorite 
                        ? 'bg-red-500/80 text-white' 
                        : 'bg-noir-900/60 text-noir-300 hover:text-white'
                      }
                    `}
                  >
                    <Heart className={`w-5 h-5 ${currentTryOn.isFavorite ? 'fill-current' : ''}`} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-3 rounded-xl bg-noir-900/60 backdrop-blur-sm text-noir-300 
                               hover:text-white transition-colors"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-3">
                <Button variant="secondary" className="flex-1" icon={<Download className="w-4 h-4" />}>
                  Download
                </Button>
                <Button variant="secondary" className="flex-1" icon={<Share2 className="w-4 h-4" />}>
                  Share
                </Button>
                <Button 
                  className="flex-1" 
                  icon={<ExternalLink className="w-4 h-4" />}
                  onClick={() => window.open(selectedProduct?.sourceUrl, '_blank')}
                >
                  Buy Now
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-noir-800/50 flex items-center justify-center mx-auto mb-4">
                  <Shirt className="w-10 h-10 text-noir-600" />
                </div>
                <h3 className="font-display text-xl text-noir-300 mb-2">No Try-On Selected</h3>
                <p className="text-sm text-noir-500 max-w-xs">
                  Click on a clothing item while browsing to see your try-on here
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Product Info & History */}
        <div className="w-80 border-l border-noir-800 flex flex-col overflow-hidden">
          {/* Product Info */}
          {selectedProduct && (
            <div className="p-4 border-b border-noir-800">
              <h3 className="text-xs font-medium text-noir-500 uppercase tracking-wider mb-3">
                Current Item
              </h3>
              <Card variant="glass" className="p-3">
                <div className="flex gap-3">
                  <img
                    src={selectedProduct.thumbnailUrl || selectedProduct.imageUrl}
                    alt={selectedProduct.title}
                    className="w-16 h-16 rounded-lg object-cover bg-noir-800"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-noir-200 font-medium line-clamp-2">
                      {selectedProduct.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-noir-500">{selectedProduct.garmentType}</span>
                      {selectedProduct.price && (
                        <span className="text-xs text-champagne-400 font-medium">
                          {selectedProduct.price}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* History */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-xs font-medium text-noir-500 uppercase tracking-wider mb-3">
              Recent Try-Ons
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {tryOnHistory.slice(0, 10).map((result) => (
                <motion.div
                  key={result.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setCurrentTryOn(result)
                    selectProduct(result.product)
                  }}
                  className={`
                    relative rounded-lg overflow-hidden cursor-pointer
                    ${currentTryOn?.id === result.id ? 'ring-2 ring-champagne-500' : ''}
                  `}
                >
                  <div className="aspect-[3/4]">
                    <img
                      src={result.resultImageUrl}
                      alt={result.product.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {result.isFavorite && (
                    <div className="absolute top-1 right-1">
                      <Heart className="w-3 h-3 text-red-500 fill-current" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
            
            {tryOnHistory.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-noir-500">No try-ons yet</p>
              </div>
            )}
          </div>

          {/* User Profile Mini */}
          {userProfile?.photoThumbnail && (
            <div className="p-4 border-t border-noir-800">
              <div className="flex items-center gap-3">
                <img
                  src={userProfile.photoThumbnail}
                  alt="Your profile"
                  className="w-10 h-10 rounded-lg object-cover border border-noir-700"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-noir-200 font-medium">Your Profile</p>
                  <p className="text-xs text-noir-500 truncate">
                    {userProfile.measurements.height}cm
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SidePanel
