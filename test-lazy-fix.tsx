import React from 'react';
import { View, Text } from 'react-native';
import { Tabs } from './src';

// 测试组件，用于验证 lazy={false} 修复
const LazyTestComponent: React.FC<{ tabName: string }> = ({ tabName }) => {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    console.log(`[LazyTest] Tab ${tabName} mounted at ${new Date().toISOString()}`);
    setMounted(true);
    
    return () => {
      console.log(`[LazyTest] Tab ${tabName} unmounted at ${new Date().toISOString()}`);
    };
  }, [tabName]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>{`${tabName} - Mounted: ${mounted}`}</Text>
      <Text>{`Mount time: ${new Date().toLocaleTimeString()}`}</Text>
    </View>
  );
};

export const LazyTestTabs = () => {
  return (
    <Tabs.Container
      lazy={false} // 测试 lazy={false} 是否立即挂载所有标签页
      renderHeader={() => (
        <View style={{ height: 100, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }}>
          <Text>Test Header - All tabs should mount immediately</Text>
        </View>
      )}
    >
      <Tabs.Tab name="tab1">
        <LazyTestComponent tabName="Tab 1" />
      </Tabs.Tab>
      <Tabs.Tab name="tab2">
        <LazyTestComponent tabName="Tab 2" />
      </Tabs.Tab>
      <Tabs.Tab name="tab3">
        <LazyTestComponent tabName="Tab 3" />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export const LazyTestTabsWithLazyTrue = () => {
  return (
    <Tabs.Container
      lazy={true} // 测试 lazy={true} 是否只挂载当前标签页
      renderHeader={() => (
        <View style={{ height: 100, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }}>
          <Text>Test Header - Only focused tab should mount</Text>
        </View>
      )}
    >
      <Tabs.Tab name="tab1">
        <LazyTestComponent tabName="Tab 1 (Lazy)" />
      </Tabs.Tab>
      <Tabs.Tab name="tab2">
        <LazyTestComponent tabName="Tab 2 (Lazy)" />
      </Tabs.Tab>
      <Tabs.Tab name="tab3">
        <LazyTestComponent tabName="Tab 3 (Lazy)" />
      </Tabs.Tab>
    </Tabs.Container>
  );
};