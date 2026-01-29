// Background Service Worker for Virtual Try-On Extension

const tabProducts = new Map<number, any[]>()

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id })
    } catch (error) {
      console.error('[Background] Error opening side panel:', error)
    }
  }
})

// Enable side panel for all tabs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PRODUCTS_DETECTED' && sender.tab?.id) {
    console.log('[Background] Products detected:', message.products?.length || 0)
    tabProducts.set(sender.tab.id, message.products || [])
    
    const count = message.products?.length || 0
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString(), tabId: sender.tab.id })
      chrome.action.setBadgeBackgroundColor({ color: '#d4ad75', tabId: sender.tab.id })
    } else {
      chrome.action.setBadgeText({ text: '', tabId: sender.tab.id })
    }
  }

  if (message.type === 'GET_PRODUCTS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (tabId) sendResponse({ products: tabProducts.get(tabId) || [] })
    })
    return true
  }
})

chrome.tabs.onRemoved.addListener((tabId) => { tabProducts.delete(tabId) })

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId })
    tabProducts.delete(tabId)
  }
})

console.log('[Background] Service worker initialized')
