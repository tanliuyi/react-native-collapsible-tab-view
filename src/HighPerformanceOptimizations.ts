// 高性能Tab切换优化方案
import React from 'react'
import { InteractionManager } from 'react-native'
import { useSharedValue, runOnUI, runOnJS } from 'react-native-reanimated'

/**
 * 高性能Tab同步管理器
 * 使用以下优化策略：
 * 1. 懒加载：只初始化可见的tab
 * 2. 虚拟化：只同步相邻的tab
 * 3. 批量处理：合并多个滚动操作
 * 4. 智能缓存：缓存滚动位置，避免重复计算
 */
export class HighPerformanceTabSync {
  private syncQueue: Map<string, number> = new Map()
  private isProcessing = false
  private lastProcessTime = 0
  private readonly PROCESS_INTERVAL = 16 // 60fps
  
  constructor(
    private refMap: Record<string, any>,
    private scrollYCurrent: any,
    private contentInset: number,
    private isScrolling: any
  ) {}

  /**
   * 智能同步：批量处理同步请求
   */
  requestSync(tabName: string, scrollY: number) {
    this.syncQueue.set(tabName, scrollY)
    
    if (!this.isProcessing) {
      this.scheduleBatchProcess()
    }
  }

  private scheduleBatchProcess() {
    const now = Date.now()
    const timeSinceLastProcess = now - this.lastProcessTime
    
    if (timeSinceLastProcess < this.PROCESS_INTERVAL) {
      // 使用RAF进行节流
      requestAnimationFrame(() => this.processBatch())
    } else {
      this.processBatch()
    }
  }

  private processBatch() {
    if (this.isScrolling.value || this.syncQueue.size === 0) return
    
    this.isProcessing = true
    this.lastProcessTime = Date.now()
    
    // 批量处理所有同步请求
    const syncPromises: Promise<void>[] = []
    
    for (const [tabName, scrollY] of this.syncQueue.entries()) {
      if (this.refMap[tabName]) {
        syncPromises.push(this.performSync(tabName, scrollY))
      }
    }
    
    Promise.all(syncPromises).finally(() => {
      this.syncQueue.clear()
      this.isProcessing = false
    })
  }

  private async performSync(tabName: string, scrollY: number): Promise<void> {
    return new Promise((resolve) => {
      // 使用InteractionManager确保在交互完成后执行
      InteractionManager.runAfterInteractions(() => {
        runOnUI(() => {
          if (this.refMap[tabName]) {
            scrollToImpl(this.refMap[tabName], 0, scrollY - this.contentInset, false)
          }
          runOnJS(resolve)()
        })()
      })
    })
  }

  destroy() {
    this.syncQueue.clear()
    this.isProcessing = false
  }
}

/**
 * 虚拟化Tab管理器
 * 只渲染和维护可见范围内的tab
 */
export class VirtualizedTabManager {
  private visibleTabs = new Set<string>()
  private tabCache = new Map<string, any>()
  
  constructor(
    private windowSize: number = 3 // 保持3个tab在内存中
  ) {}

  updateVisibility(currentIndex: number, tabNames: string[]) {
    const newVisible = new Set<string>()
    
    // 计算可见范围
    const start = Math.max(0, currentIndex - Math.floor(this.windowSize / 2))
    const end = Math.min(tabNames.length - 1, start + this.windowSize - 1)
    
    for (let i = start; i <= end; i++) {
      newVisible.add(tabNames[i])
    }
    
    // 清理不再可见的tab缓存
    for (const tabName of this.visibleTabs) {
      if (!newVisible.has(tabName)) {
        this.tabCache.delete(tabName)
      }
    }
    
    this.visibleTabs = newVisible
  }

  isVisible(tabName: string): boolean {
    return this.visibleTabs.has(tabName)
  }

  cacheTab(tabName: string, data: any) {
    if (this.visibleTabs.has(tabName)) {
      this.tabCache.set(tabName, data)
    }
  }

  getCache(tabName: string): any {
    return this.tabCache.get(tabName)
  }

  destroy() {
    this.visibleTabs.clear()
    this.tabCache.clear()
  }
}

/**
 * 性能监控器
 * 监控tab切换性能并自动调整策略
 */
export class PerformanceMonitor {
  private metrics: Array<{ timestamp: number; duration: number }> = []
  private readonly MAX_METRICS = 10
  
  recordTabSwitch(startTime: number) {
    const duration = Date.now() - startTime
    this.metrics.push({ timestamp: startTime, duration })
    
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift()
    }
    
    return this.getOptimalStrategy()
  }

  private getOptimalStrategy() {
    if (this.metrics.length < 3) return 'normal'
    
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length
    
    if (avgDuration > 100) return 'aggressive' // 激进优化
    if (avgDuration > 50) return 'moderate'   // 适中优化
    return 'normal' // 正常模式
  }

  getAveragePerformance(): number {
    if (this.metrics.length === 0) return 0
    return this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length
  }
}