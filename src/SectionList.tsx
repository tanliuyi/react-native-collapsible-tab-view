import React from 'react'
import { SectionList as RNSectionList, SectionListProps } from 'react-native'

import { AnimatedSectionList } from './helpers'
import {
  useAfterMountEffect,
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
const SectionListMemo = React.memo(
  React.forwardRef(
    <ItemT,>(
      props: React.PropsWithChildren<SectionListProps<ItemT>>,
      passRef: React.Ref<RNSectionList<ItemT>>
    ) => {
      return (
        <AnimatedSectionList
          // @ts-expect-error reanimated types are broken on ref
          ref={passRef}
          {...props}
        />
      )
    }
  )
) as <ItemT>(
  p: React.PropsWithChildren<SectionListProps<ItemT>> & {
    ref?: React.Ref<RNSectionList<ItemT>>
  }
) => React.ReactElement

function SectionListImpl<R>(
  {
    contentContainerStyle,
    style,
    onContentSizeChange,
    refreshControl,
    ...rest
  }: Omit<SectionListProps<R>, 'onScroll'>,
  passRef: React.Ref<RNSectionList<R>>
): React.ReactElement {
  const name = useTabNameContext()
  const { setRef, contentInset } = useTabsContext()
  const ref = useSharedAnimatedRef<RNSectionList<R>>(passRef)

  const { scrollHandler, enable } = useScrollHandlerY(name)
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet'
    // we enable the scroll event after mounting
    // otherwise we get an `onScroll` call with the initial scroll position which can break things
    enable(true)
  })

  const {
    style: _style,
    contentContainerStyle: _contentContainerStyle,
    progressViewOffset,
  } = useCollapsibleStyle()

  React.useEffect(() => {
    setRef(name, ref)
  }, [name, ref, setRef])

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
    () => [_contentContainerStyle, contentContainerStyle],
    [_contentContainerStyle, contentContainerStyle]
  )
  const memoStyle = React.useMemo(() => [_style, style], [_style, style])

  return (
    <SectionListMemo
      {...rest}
      onLayout={onLayout}
      ref={ref}
      bouncesZoom={false}
      style={memoStyle}
      contentContainerStyle={memoContentContainerStyle}
      progressViewOffset={progressViewOffset}
      onScroll={scrollHandler}
      onContentSizeChange={scrollContentSizeChangeHandlers}
      scrollEventThrottle={16}
      contentInset={memoContentInset}
      contentOffset={memoContentOffset}
      automaticallyAdjustContentInsets={false}
      refreshControl={memoRefreshControl}
      // workaround for: https://github.com/software-mansion/react-native-reanimated/issues/2735
      onMomentumScrollEnd={() => {}}
    />
  )
}

/**
 * Use like a regular SectionList.
 */
export const SectionList = React.forwardRef(SectionListImpl) as <T>(
  p: SectionListProps<T> & { ref?: React.Ref<RNSectionList<T>> }
) => React.ReactElement
