import { FlashListProps, FlashListRef } from '@shopify/flash-list'
import React, { useCallback } from 'react'
import Animated, {
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated'

import {
  useChainCallback,
  useCollapsibleStyle,
  useScrollHandlerY,
  useSharedAnimatedRef,
  useTabNameContext,
  useTabsContext,
  useUpdateScrollViewContentSize,
} from './hooks'

/**
 * Used as a memo to prevent rerendering too often when the context changes.
 * See: https://github.com/facebook/react/issues/15156#issuecomment-474590693
 */

type MasonryFlashListMemoProps = React.PropsWithChildren<
  FlashListProps<unknown>
>
type MasonryFlashListMemoRef = FlashListRef<any>

let AnimatedMasonry: React.ComponentClass<FlashListProps<any>> | null = null

const ensureMasonry = () => {
  if (AnimatedMasonry) {
    return
  }

  try {
    const flashListModule = require('@shopify/flash-list')
    AnimatedMasonry = Animated.createAnimatedComponent(
      flashListModule.MasonryFlashList
    ) as unknown as React.ComponentClass<FlashListProps<any>>
  } catch {
    console.error(
      'The optional dependency @shopify/flash-list is not installed. Please install it to use the FlashList component.'
    )
  }
}

const MasonryFlashListMemo = React.memo(
  React.forwardRef<MasonryFlashListMemoRef, MasonryFlashListMemoProps>(
    (props, passRef) => {
      ensureMasonry()
      return AnimatedMasonry ? (
        // @ts-expect-error
        <AnimatedMasonry ref={passRef} {...props} />
      ) : (
        <></>
      )
    }
  )
)

function MasonryFlashListImpl<R>(
  {
    style,
    onContentSizeChange,
    contentContainerStyle: _contentContainerStyle,
    refreshControl,
    ...rest
  }: Omit<FlashListProps<R>, 'onScroll'>,
  passRef: React.Ref<MasonryFlashListMemoRef>
) {
  const name = useTabNameContext()
  const { setRef, contentInset } = useTabsContext()
  const recyclerRef = useSharedAnimatedRef<any>(null)
  const ref = useSharedAnimatedRef<any>(passRef)

  const { scrollHandler, enable } = useScrollHandlerY(name)

  const hadLoad = useSharedValue(false)

  const onLoad = useCallback(() => {
    hadLoad.value = true
  }, [hadLoad])

  useAnimatedReaction(
    () => {
      return hadLoad.value
    },
    (ready) => {
      if (ready) {
        enable(true)
      }
    }
  )

  const { progressViewOffset, contentContainerStyle } = useCollapsibleStyle()

  React.useEffect(() => {
    setRef(name, recyclerRef)
  }, [name, recyclerRef, setRef])

  const scrollContentSizeChange = useUpdateScrollViewContentSize({
    name,
  })

  const scrollContentSizeChangeHandlers = useChainCallback(
    React.useMemo(
      () => [scrollContentSizeChange, onContentSizeChange],
      [onContentSizeChange, scrollContentSizeChange]
    )
  )

  const memoRefreshControl = React.useMemo(
    () =>
      refreshControl &&
      React.cloneElement(refreshControl, {
        progressViewOffset,
        ...refreshControl.props,
      }),
    [progressViewOffset, refreshControl]
  )

  const memoContentInset = React.useMemo(
    () => ({ top: contentInset }),
    [contentInset]
  )

  const memoContentOffset = React.useMemo(
    () => ({ x: 0, y: -contentInset }),
    [contentInset]
  )

  const memoContentContainerStyle = React.useMemo(
    () => ({
      paddingTop: contentContainerStyle.paddingTop,
    }),
    [contentContainerStyle.paddingTop]
  )

  const refWorkaround = useCallback(
    (value: MasonryFlashListMemoRef | null): void => {
      // https://github.com/Shopify/flash-list/blob/2d31530ed447a314ec5429754c7ce88dad8fd087/src/FlashList.tsx#L829
      // We are not accessing the right element or view of the Flashlist (recyclerlistview). So we need to give
      // this ref the access to it
      // @ts-expect-error
      ;(recyclerRef as any)(value?.recyclerlistview_unsafe)
      ;(ref as any)(value)
    },
    [recyclerRef, ref]
  )

  return (
    // @ts-expect-error typescript complains about `unknown` in the memo, it should be T
    <MasonryFlashListMemo
      {...rest}
      onLoad={onLoad}
      contentContainerStyle={[
        memoContentContainerStyle,
        _contentContainerStyle,
      ]}
      ref={refWorkaround}
      bouncesZoom={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentInset={memoContentInset}
      contentOffset={memoContentOffset}
      refreshControl={memoRefreshControl}
      progressViewOffset={progressViewOffset}
      automaticallyAdjustContentInsets={false}
      onContentSizeChange={scrollContentSizeChangeHandlers}
    />
  )
}

/**
 * Use like a regular MasonryFlashList.
 */
export const MasonryFlashList = React.forwardRef(MasonryFlashListImpl) as <T>(
  p: FlashListProps<T> & { ref?: React.Ref<MasonryFlashListMemoRef> }
) => React.ReactElement
