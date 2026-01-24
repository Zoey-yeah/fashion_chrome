// Background Service Worker for Virtual Try-On Extension

const tabProducts = new Map<number, any[]>()

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
