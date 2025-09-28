import { useCallback, useRef, useEffect } from 'react'
import { InteractionManager } from 'react-native'
import { runOnJS, runOnUI, useSharedValue } from 'react-native-reanimated'
import { scrollToImpl } from './helpers'

/**
 * 高性能Tab切换Hook
 * 提供更好的性能优化策略
 */
export function useHighPerformanceTabSync(
  refMap: Record<string, any>,
  scrollYCurrent: any,
  contentInset: number,
  isScrolling: any,
  tabNames: string[]
) {
  const syncQueue = useRef(new Map<string, number>()).current
  const isProcessing = useRef(false)
  const lastProcessTime = useRef(0)
  const performanceStrategy = useRef<'normal' | 'moderate' | 'aggressive'>('normal')
  
  // 性能监控
  const switchTimes = useRef<number[]>([])
  
  const getThrottleInterval = useCallback(() => {
    switch (performanceStrategy.current) {
      case 'aggressive': return 50  // 20fps for better performance
      case 'moderate': return 33    // 30fps
      default: return 16            // 60fps
    }
  }, [])

  const processBatch = useCallback(() => {
    if (isScrolling.value || syncQueue.size === 0 || isProcessing.current) return
    
    isProcessing.current = true
    const now = Date.now()
    
    // 批量处理同步请求
    const syncEntries = Array.from(syncQueue.entries())
    syncQueue.clear()
    
    // 使用InteractionManager延迟非关键操作
    InteractionManager.runAfterInteractions(() => {
      syncEntries.forEach(([tabName, scrollY]) => {
        if (refMap[tabName]) {
          runOnUI(() => {
            scrollToImpl(refMap[tabName], 0, scrollY - contentInset, false)
          })()
        }
      })
      
      isProcessing.current = false
      lastProcessTime.current = now
    })
  }, [refMap, contentInset, syncQueue, isScrolling])

  const requestSync = useCallback((tabName: string, scrollY: number) => {
    // 虚拟化：只同步相邻的tab
    const currentIndex = tabNames.findIndex(name => name === tabName)
    const focusedIndex = tabNames.findIndex(name => refMap[name]?.current)
    
    if (Math.abs(currentIndex - focusedIndex) > 1) {
      return // 跳过距离太远的tab
    }
    
    syncQueue.set(tabName, scrollY)
    
    const now = Date.now()
    const timeSinceLastProcess = now - lastProcessTime.current
    const throttleInterval = getThrottleInterval()
    
    if (timeSinceLastProcess >= throttleInterval) {
      processBatch()
    } else {
      // 使用setTimeout而不是requestAnimationFrame，避免阻塞渲染
      setTimeout(processBatch, throttleInterval - timeSinceLastProcess)
    }
  }, [tabNames, refMap, syncQueue, processBatch, getThrottleInterval])

  const recordTabSwitch = useCallback((duration: number) => {
    switchTimes.current.push(duration)
    
    // 保持最近10次切换记录
    if (switchTimes.current.length > 10) {
      switchTimes.current.shift()
    }
    
    // 动态调整性能策略
    if (switchTimes.current.length >= 3) {
      const avgTime = switchTimes.current.reduce((a, b) => a + b, 0) / switchTimes.current.length
      
      if (avgTime > 100) {
        performanceStrategy.current = 'aggressive'
      } else if (avgTime > 50) {
        performanceStrategy.current = 'moderate'  
      } else {
        performanceStrategy.current = 'normal'
      }
    }
  }, [])

  const smartTabSwitch = useCallback((targetIndex: number, containerRef: any) => {
    const startTime = Date.now()
    
    // 预清理同步队列，避免冲突
    syncQueue.clear()
    
    // 执行tab切换
    containerRef.current?.setPage(targetIndex)
    
    // 延迟启动同步，给切换动画时间
    const delay = performanceStrategy.current === 'aggressive' ? 100 : 50
    
    setTimeout(() => {
      const endTime = Date.now()
      recordTabSwitch(endTime - startTime)
    }, delay)
    
    return { startTime }
  }, [syncQueue, recordTabSwitch])

  // 清理资源
  useEffect(() => {
    return () => {
      syncQueue.clear()
      switchTimes.current = []
    }
  }, [syncQueue])

  return {
    requestSync,
    smartTabSwitch,
    getPerformanceMetrics: () => ({
      strategy: performanceStrategy.current,
      averageSwitchTime: switchTimes.current.length > 0 
        ? switchTimes.current.reduce((a, b) => a + b, 0) / switchTimes.current.length 
        : 0
    })
  }
}

/**
 * 懒加载Tab内容Hook
 * 只在需要时渲染tab内容
 */
export function useLazyTabContent(tabName: string, isActive: boolean, preloadDistance: number = 1) {
  const shouldRender = useSharedValue(false)
  const hasRendered = useRef(false)
  
  useEffect(() => {
    // 一旦渲染过就保持渲染状态，避免重复渲染开销
    if (isActive && !hasRendered.current) {
      shouldRender.value = true
      hasRendered.current = true
    }
  }, [isActive, shouldRender])
  
  return {
    shouldRender: shouldRender.value || hasRendered.current,
    isActive
  }
}

/**
 * 内存优化Hook
 * 自动清理不再需要的资源
 */
export function useTabMemoryOptimization(activeTabIndex: number, totalTabs: number) {
  const visibleRange = useRef({ start: 0, end: Math.min(2, totalTabs - 1) })
  const memoryCache = useRef(new Map()).current
  
  useEffect(() => {
    // 更新可见范围
    const newStart = Math.max(0, activeTabIndex - 1)
    const newEnd = Math.min(totalTabs - 1, activeTabIndex + 1)
    
    visibleRange.current = { start: newStart, end: newEnd }
    
    // 清理不在可见范围内的缓存
    for (const [index, data] of memoryCache.entries()) {
      if (index < newStart || index > newEnd) {
        memoryCache.delete(index)
      }
    }
  }, [activeTabIndex, totalTabs, memoryCache])
  
  return {
    isInVisibleRange: (index: number) => 
      index >= visibleRange.current.start && index <= visibleRange.current.end,
    cacheData: (index: number, data: any) => memoryCache.set(index, data),
    getCachedData: (index: number) => memoryCache.get(index)
  }
}