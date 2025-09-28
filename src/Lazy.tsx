import React, { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated'

import { ScrollView } from './ScrollView'
import { useScroller, useTabNameContext, useTabsContext } from './hooks'

/**
 * Typically used internally, but if you want to mix lazy and regular screens you can wrap the lazy ones with this component.
 */
export const Lazy: React.FC<{
  /**
   * Whether to cancel the lazy fade in animation. Defaults to false.
   */
  cancelLazyFadeIn?: boolean
  /**
   * How long to wait before mounting the children.
   */
  mountDelayMs?: number
  /**
   * Whether to start mounted. Defaults to true if we are the focused tab.
   */
  startMounted?: boolean
  children: React.ReactElement
}> = ({
  children,
  cancelLazyFadeIn,
  startMounted: _startMounted,
  mountDelayMs = 50,
}) => {
  const name = useTabNameContext()
  const { focusedTab, refMap } = useTabsContext()

  /**
   * We keep track of whether a layout has been triggered
   */
  const didTriggerLayout = useSharedValue(false)

  /**
   * We start mounted if we are the focused tab, or if props.startMounted is true.
   */
  const shouldStartMounted =
    typeof _startMounted === 'boolean'
      ? _startMounted
      : focusedTab.value === name

  /**
   * This is used to control when children are mounted
   * Initialize based on startMounted prop or focused state
   */
  const [canMount, setCanMount] = React.useState(() => {
    // 如果 _startMounted 是 boolean 类型，直接使用它的值
    if (typeof _startMounted === 'boolean') {
      // console.log(`[Lazy] Tab ${name}: startMounted=${_startMounted}, initialCanMount=${_startMounted}`)
      return _startMounted
    }
    // 否则检查是否是当前聚焦的标签页
    const isFocused = focusedTab.value === name
    // console.log(`[Lazy] Tab ${name}: no startMounted prop, focusedTab=${focusedTab.value}, isFocused=${isFocused}`)
    return isFocused
  })
  /**
   * Ensure we don't mount after the component has been unmounted
   */
  const isSelfMounted = React.useRef(true)
  let initialOpacity = 1
  if (!cancelLazyFadeIn && !shouldStartMounted) {
    initialOpacity = 0
  }
  const opacity = useSharedValue(initialOpacity)

  React.useEffect(() => {
    return () => {
      isSelfMounted.current = false
    }
  }, [])

  // 监听 startMounted 属性变化，确保 lazy={false} 立即生效
  React.useEffect(() => {
    // 如果明确设置了 startMounted 为 true（即 lazy={false}），立即挂载
    if (_startMounted === true && !canMount) {
      setCanMount(true)
    }
    // 如果明确设置了 startMounted 为 false（即强制懒加载），只在聚焦时挂载
    else if (_startMounted === false && canMount && focusedTab.value !== name) {
      // 如果当前不是聚焦标签页且强制设置为 false，则不挂载
      // 注意：这里不设置 setCanMount(false)，因为一旦挂载就不应该卸载
    }
  }, [_startMounted, canMount, focusedTab.value, name])

  const startMountTimer = React.useCallback(
    (focusedTab: string) => {
      // wait the scene to be at least mountDelay ms focused, before mounting
      setTimeout(() => {
        if (focusedTab === name) {
          if (isSelfMounted.current) setCanMount(true)
        }
      }, mountDelayMs)
    },
    [mountDelayMs, name]
  )

  useAnimatedReaction(
    () => {
      return focusedTab.value === name
    },
    (focused, wasFocused) => {
      if (focused && !wasFocused && !canMount) {
        if (cancelLazyFadeIn) {
          opacity.value = 1
          setCanMount(true)
        } else {
          startMountTimer(focusedTab.value)
        }
      }
    },
    [canMount, focusedTab]
  )

  const scrollTo = useScroller()

  const ref = name ? refMap[name] : null

  useAnimatedReaction(
    () => {
      return didTriggerLayout.value
    },
    (isMounted, wasMounted) => {
      if (isMounted && !wasMounted) {
        if (!cancelLazyFadeIn && opacity.value !== 1) {
          opacity.value = withTiming(1)
        }
      }
    },
    [ref, cancelLazyFadeIn, name, didTriggerLayout, scrollTo]
  )

  const stylez = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    }
  }, [opacity])

  const onLayout = useCallback(() => {
    didTriggerLayout.value = true
  }, [didTriggerLayout])

  return canMount ? (
    cancelLazyFadeIn ? (
      children
    ) : (
      <Animated.View
        pointerEvents="box-none"
        style={[styles.container, !cancelLazyFadeIn ? stylez : undefined]}
        onLayout={onLayout}
      >
        {children}
      </Animated.View>
    )
  ) : (
    <ScrollView />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
