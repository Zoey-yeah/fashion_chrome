import type { PlasmoMessaging } from '@plasmohq/messaging'

// Track detected products per tab
const tabProducts = new Map<number, any[]>()

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PRODUCTS_DETECTED' && sender.tab?.id) {
    console.log('[Background] Products detected:', message.products?.length || 0)
    tabProducts.set(sender.tab.id, message.products || [])
    
    // Update badge to show product count
    const count = message.products?.length || 0
    if (count > 0) {
      chrome.action.setBadgeText({ 
        text: count.toString(), 
        tabId: sender.tab.id 
      })
      chrome.action.setBadgeBackgroundColor({ 
        color: '#d4ad75', 
        tabId: sender.tab.id 
      })
    } else {
      chrome.action.setBadgeText({ text: '', tabId: sender.tab.id })
    }
  }

  if (message.type === 'GET_PRODUCTS') {
    // Get products for current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (tabId) {
        sendResponse({ products: tabProducts.get(tabId) || [] })
      }
    })
    return true // Keep channel open for async response
  }
})

// Clear tab data when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabProducts.delete(tabId)
})

// Clear badge when navigating away
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId })
    tabProducts.delete(tabId)
  }
})

// Check if current page is a supported site
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const supportedDomains = [
      'amazon.com',
      'asos.com',
      'zara.com',
      'hm.com',
      'nordstrom.com',
      'shopify.com'
    ]

    const isSupportedSite = supportedDomains.some(domain => 
      tab.url?.includes(domain)
    )

    // Update icon appearance based on site support
    if (isSupportedSite) {
      chrome.action.setTitle({ 
        title: 'Virtual Try-On - Click to try on items!', 
        tabId 
      })
    } else {
      chrome.action.setTitle({ 
        title: 'Virtual Try-On - Browse a clothing site to try on items', 
        tabId 
      })
    }
  }
})

// Handle side panel behavior
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false })

// Welcome message on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed!')
    // Could open onboarding page
    // chrome.tabs.create({ url: chrome.runtime.getURL('tabs/welcome.html') })
  }
})

console.log('[Background] Service worker initialized')

export {}
