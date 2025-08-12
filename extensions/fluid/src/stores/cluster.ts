import { create } from 'zustand';

interface ClusterInfo {
  name: string;
  displayName: string;
}

interface ClusterState {
  currentCluster: string;
  clusters: ClusterInfo[];
  isLoading: boolean;
  error: string | null;
  setCurrentCluster: (cluster: string) => void;
  fetchClusters: () => Promise<void>;
}

export const useClusterStore = create<ClusterState>((set, get) => ({
  currentCluster: localStorage.getItem('current-cluster') || 'host',
  clusters: [],
  isLoading: false,
  error: null,
  
  setCurrentCluster: (cluster: string) => {
    localStorage.setItem('current-cluster', cluster);
    set({ currentCluster: cluster });
  },
  
  fetchClusters: async () => {
    set({ isLoading: true, error: null });
    try {
      // 使用正确的KubeSphere集群API端点
      const response = await fetch('/kapis/cluster.kubesphere.io/v1alpha1/clusters');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch clusters: ${response.statusText}`);
      }
      
      const data = await response.json();
      const clusters: ClusterInfo[] = data.items?.map((item: any) => ({
        name: item.metadata.name,
        displayName: item.spec?.displayName || item.metadata.name
      })) || [];
      
      set({ 
        clusters,
        isLoading: false 
      });
    } catch (error) {
      console.error('获取集群列表失败:', error);
      set({ 
        error: error instanceof Error ? error.message : '获取集群列表失败',
        isLoading: false 
      });
    }
  }
}));
