import React, { useState, useCallback } from 'react';
import { Button, Modal, Switch, notify } from '@kubed/components';
import styled from 'styled-components';
import StepIndicator from './components/StepIndicator';
import BasicInfoStep from './components/BasicInfoStep';
import RuntimeStep from './components/RuntimeStep';
import DataSourceStep from './components/DataSourceStep';
import DataLoadStep from './components/DataLoadStep';
import { EditYamlModal } from '@ks-console/shared';
import { CreateDatasetModalProps, DatasetFormData, StepConfig } from './types';
import { getCurrentCluster } from '../../../../utils/request';
import yaml from 'js-yaml';

declare const t: (key: string, options?: any) => string;

const ModalContent = styled.div`
  width: 910px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px 24px;
  background-color: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const HeaderTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #242e42;
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const YamlModeLabel = styled.span`
  font-size: 14px;
  color: #79879c;
  font-weight: 500;
`;

const YamlModeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background-color: #f5f7fa;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
`;

const StepIndicatorContainer = styled.div`
  position: sticky;
  top: 0;
  background-color: #fff;
  z-index: 9;
`;

const StepContent = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background-color: #fff;
`;

const FooterLeft = styled.div``;

const FooterRight = styled.div`
  display: flex;
  gap: 12px;
`;



const STEPS: StepConfig[] = [
  {
    key: 'basic',
    title: 'BASIC_INFORMATION',
    description: 'BASIC_INFO_DESC',
    component: BasicInfoStep,
  },
  {
    key: 'datasource',
    title: 'DATA_SOURCE_CONFIGURATION',
    description: 'DATA_SOURCE_CONFIG_DESC',
    component: DataSourceStep,
  },
  {
    key: 'runtime',
    title: 'RUNTIME_CONFIGURATION',
    description: 'RUNTIME_CONFIG_DESC',
    component: RuntimeStep,
  },
  {
    key: 'dataload',
    title: 'DATA_PRELOAD_CONFIGURATION',
    description: 'DATA_PRELOAD_CONFIG_DESC',
    component: DataLoadStep,
    optional: true,
  },
];

const CreateDatasetModal: React.FC<CreateDatasetModalProps> = ({
  visible,
  onCancel,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepValidations, setStepValidations] = useState<Record<number, boolean>>({});
  const [isYamlMode, setIsYamlMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState<DatasetFormData>({
    name: '',
    namespace: 'default',
    runtimeType: 'AlluxioRuntime',
    runtimeName: '',
    replicas: 1,
    enableDataLoad: false,
  });

  // EditYamlModal状态管理
  const [editYamlConfig, setEditYamlConfig] = useState({
    visible: false,
    yaml: '',
    readOnly: false,
  });

  // 将表单数据转换为YAML
  const formDataToYaml = (data: DatasetFormData) => {
    // 构建annotations对象
    const annotations: Record<string, string> = {
      ...(data.annotations || {}), // 保留所有现有的annotations
    };

    // 如果有description，确保它在annotations中
    // if (data.description) {
    //   annotations['data.fluid.io/description'] = data.description;
    // }

    const dataset = {
      apiVersion: 'data.fluid.io/v1alpha1',
      kind: 'Dataset',
      metadata: {
        name: data.name || '',
        namespace: data.namespace || 'default',
        labels: data.labels || {},
        ...(Object.keys(annotations).length > 0 && { annotations }),
      },
      spec: {
        mounts: data.mounts || [],
        runtimes: [
          {
            name: data.runtimeName || data.name || '',
            namespace: data.namespace || 'default',
          },
        ],
        // 添加Dataset的高级字段
        ...(data.owner && { owner: data.owner }),
        ...(data.nodeAffinity && { nodeAffinity: data.nodeAffinity }),
        ...(data.tolerations && { tolerations: data.tolerations }),
        ...(data.accessModes && { accessModes: data.accessModes }),
        ...(data.placement && { placement: data.placement }),
        ...(data.dataRestoreLocation && { dataRestoreLocation: data.dataRestoreLocation }),
        ...(data.sharedOptions && { sharedOptions: data.sharedOptions }),
        ...(data.sharedEncryptOptions && { sharedEncryptOptions: data.sharedEncryptOptions }),
      },
    };

    const runtime = {
      apiVersion: 'data.fluid.io/v1alpha1',
      kind: data.runtimeType || 'AlluxioRuntime',
      metadata: {
        name: data.runtimeName || data.name || '',
        namespace: data.namespace || 'default',
      },
      spec: data.runtimeSpec || {
        replicas: data.replicas || 1,
        tieredstore: data.tieredStore || {
          levels: [
            {
              level: 0,
              mediumtype: 'MEM',
              quota: '1Gi',
            },
          ],
        },
      },
    };

    const resources = [dataset, runtime];

    // 如果启用了数据预热，添加DataLoad资源
    if (data.enableDataLoad && (data.dataLoadConfig || data.dataLoadSpec)) {
      const dataLoad: any = {
        apiVersion: 'data.fluid.io/v1alpha1',
        kind: 'DataLoad',
        metadata: {
          name: `${data.name}-dataload`,
          namespace: data.namespace || 'default',
          labels: {},
        },
        spec: data.dataLoadSpec || {
          dataset: {
            name: data.name || '',
            namespace: data.namespace || 'default',
          },
          loadMetadata: data.dataLoadConfig?.loadMetadata || true,
          target: data.dataLoadConfig?.target || [],
          policy: data.dataLoadConfig?.policy || 'Once',
          ...(data.dataLoadConfig?.schedule && { schedule: data.dataLoadConfig.schedule }),
        },
      };
      resources.push(dataLoad);
    }

    return resources.map(resource => yaml.dump(resource)).join('---\n');
  };

  // 将YAML转换为表单数据
  const yamlToFormData = (yamlStr: string): DatasetFormData | null => {
    try {
      const documents = yamlStr.split('---').filter(doc => doc.trim());
      const resources = documents.map(doc => yaml.load(doc.trim()));

      const dataset = resources.find(r => r.kind === 'Dataset');
      const runtime = resources.find(r => r.kind?.endsWith('Runtime'));
      const dataLoad = resources.find(r => r.kind === 'DataLoad');

      if (!dataset) {
        throw new Error('Dataset resource not found');
      }

      // 处理annotations，确保description和annotations的一致性
      const allAnnotations = dataset.metadata?.annotations || {};
      const description = allAnnotations['data.fluid.io/description'] || '';

      const formData: DatasetFormData = {
        name: dataset.metadata?.name || '',
        namespace: dataset.metadata?.namespace || 'default',
        description,
        labels: dataset.metadata?.labels || {},
        annotations: allAnnotations, // 保存所有annotations
        runtimeType: runtime?.kind || 'AlluxioRuntime',
        runtimeName: runtime?.metadata?.name || '',
        replicas: runtime?.spec?.replicas || 1,
        tieredStore: runtime?.spec?.tieredstore,
        mounts: dataset.spec?.mounts || [],
        enableDataLoad: !!dataLoad,
        dataLoadConfig: dataLoad ? {
          loadMetadata: dataLoad.spec?.loadMetadata || true,
          target: dataLoad.spec?.target || [],
          policy: dataLoad.spec?.policy || 'Once',
          schedule: dataLoad.spec?.schedule,
        } : undefined,

        // 保存Dataset的高级字段
        owner: dataset.spec?.owner,
        nodeAffinity: dataset.spec?.nodeAffinity,
        tolerations: dataset.spec?.tolerations,
        accessModes: dataset.spec?.accessModes,
        placement: dataset.spec?.placement,
        dataRestoreLocation: dataset.spec?.dataRestoreLocation,
        sharedOptions: dataset.spec?.sharedOptions,
        sharedEncryptOptions: dataset.spec?.sharedEncryptOptions,

        // 保存完整的Runtime spec（用于高级配置）
        runtimeSpec: runtime?.spec,

        // 保存完整的DataLoad spec（用于高级配置）
        dataLoadSpec: dataLoad?.spec,
      };

      return formData;
    } catch (err) {
      console.error('YAML parsing error:', err);
      return null;
    }
  };

  // 更新表单数据
  const handleDataChange = useCallback((data: Partial<DatasetFormData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...data };
      // 确保运行时名称与数据集名称一致
      if (data.name) {
        newData.runtimeName = data.name;
      }
      return newData;
    });
  }, []);

  // 更新步骤验证状态
  const handleValidationChange = useCallback((stepIndex: number, isValid: boolean) => {
    setStepValidations(prev => ({
      ...prev,
      [stepIndex]: isValid,
    }));
  }, []);

  // 处理YAML模式切换
  const handleYamlModeChange = (yamlMode: boolean) => {
    setIsYamlMode(yamlMode);
    if (yamlMode) {
      // 切换到YAML模式时，生成YAML并显示EditYamlModal
      const yamlContent = formDataToYaml(formData);
      setEditYamlConfig({
        visible: true,
        yaml: yamlContent,
        readOnly: false,
      });
    } else {
      // 切换回表单模式时，关闭EditYamlModal
      setEditYamlConfig(prev => ({ ...prev, visible: false }));
    }
  };

  // 处理YAML保存
  const handleYamlSave = (yamlContent: string) => {
    try {
      const newFormData = yamlToFormData(yamlContent);
      if (newFormData) {
        setFormData(newFormData);
        setEditYamlConfig(prev => ({ ...prev, visible: false }));
        // 关闭YAML模式，回到表单模式
        setIsYamlMode(false);
        // 设置YAML模式验证为有效
        setStepValidations(prev => ({ ...prev, [-1]: true }));
      } else {
        notify.error(t('YAML_PARSE_ERROR') || 'YAML parsing failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      notify.error(`${t('YAML_PARSE_ERROR') || 'YAML parsing failed'}: ${errorMessage}`);
    }
  };

  // 处理YAML取消
  const handleYamlCancel = () => {
    setEditYamlConfig(prev => ({ ...prev, visible: false }));
    setIsYamlMode(false);
  };

  // 下一步
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  };

  // 上一步
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCompletedSteps(prev => {prev.delete(currentStep);return prev;});
      setCurrentStep(currentStep - 1);
    }
  };

  // 跳过当前步骤（仅对可选步骤有效）
  const handleSkip = () => {
    if (STEPS[currentStep].optional) {
      handleNext();
    }
  };

  // 获取集群名称（使用当前选择的集群）
  const getClusterName = () => {
    return getCurrentCluster();
  };

  // 创建单个资源的API调用
  const createResource = async (resource: any, namespace: string) => {
    const clusterName = getClusterName();

    let url: string;
    if (resource.kind === 'Dataset') {
      url = `/clusters/${clusterName}/apis/data.fluid.io/v1alpha1/namespaces/${namespace}/datasets`;
    } else if (resource.kind === 'DataLoad') {
      url = `/clusters/${clusterName}/apis/data.fluid.io/v1alpha1/namespaces/${namespace}/dataloads`;
    } else if (resource.kind.endsWith('Runtime')) {
      // 处理各种Runtime类型：AlluxioRuntime -> alluxioruntimes
      const runtimeType = resource.kind.toLowerCase() + 's';
      url = `/clusters/${clusterName}/apis/data.fluid.io/v1alpha1/namespaces/${namespace}/${runtimeType}`;
    } else {
      throw new Error(`Unsupported resource kind: ${resource.kind}`);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resource),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create ${resource.kind}: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return response.json();
  };

  // 将表单数据转换为资源对象
  const formDataToResources = (data: DatasetFormData) => {
    const resources: any[] = [];

    // 创建Dataset资源
    // 构建annotations对象，包含所有用户自定义的annotations
    const annotations: Record<string, string> = {
      ...(data.annotations || {}), // 保留所有现有的annotations
    };

    // 如果有description，确保它在annotations中
    if (data.description) {
      annotations['data.fluid.io/description'] = data.description;
    }

    const dataset = {
      apiVersion: 'data.fluid.io/v1alpha1',
      kind: 'Dataset',
      metadata: {
        name: data.name,
        namespace: data.namespace,
        labels: data.labels || {},
        ...(Object.keys(annotations).length > 0 && { annotations }),
      },
      spec: {
        mounts: data.mounts || [],
        runtimes: [
          {
            name: data.runtimeName || data.name,
            namespace: data.namespace,
          },
        ],
        // 添加Dataset的高级字段
        ...(data.owner && { owner: data.owner }),
        ...(data.nodeAffinity && { nodeAffinity: data.nodeAffinity }),
        ...(data.tolerations && { tolerations: data.tolerations }),
        ...(data.accessModes && { accessModes: data.accessModes }),
        ...(data.placement && { placement: data.placement }),
        ...(data.dataRestoreLocation && { dataRestoreLocation: data.dataRestoreLocation }),
        ...(data.sharedOptions && { sharedOptions: data.sharedOptions }),
        ...(data.sharedEncryptOptions && { sharedEncryptOptions: data.sharedEncryptOptions }),
      },
    };
    resources.push(dataset);

    // 创建Runtime资源
    const runtime = {
      apiVersion: 'data.fluid.io/v1alpha1',
      kind: data.runtimeType,
      metadata: {
        name: data.runtimeName || data.name,
        namespace: data.namespace,
      },
      spec: data.runtimeSpec || {
        replicas: data.replicas || 1,
        tieredstore: data.tieredStore || {
          levels: [
            {
              level: 0,
              mediumtype: 'MEM',
              quota: '1Gi',
            },
          ],
        },
      },
    };
    resources.push(runtime);

    // 如果启用了数据预热，创建DataLoad资源
    if (data.enableDataLoad && (data.dataLoadConfig || data.dataLoadSpec)) {
      const dataLoad = {
        apiVersion: 'data.fluid.io/v1alpha1',
        kind: 'DataLoad',
        metadata: {
          name: `${data.name}-dataload`,
          namespace: data.namespace,
        },
        spec: data.dataLoadSpec || {
          dataset: {
            name: data.name,
            namespace: data.namespace,
          },
          loadMetadata: data.dataLoadConfig?.loadMetadata || true,
          target: data.dataLoadConfig?.target || [],
          policy: data.dataLoadConfig?.policy || 'Once',
          ...(data.dataLoadConfig?.schedule && { schedule: data.dataLoadConfig.schedule }),
        },
      };
      resources.push(dataLoad);
    }

    return resources;
  };



  // 创建数据集
  const handleCreate = async () => {
    setIsCreating(true);
    try {
      console.log('Creating dataset with data:', formData);

      if (isYamlMode) {
        // YAML模式：使用当前的formData生成资源并创建
        const resources = formDataToResources(formData);

        // 按顺序创建资源：先创建Dataset，再创建Runtime，最后创建DataLoad
        for (const resource of resources) {
          console.log(`Creating ${resource.kind}:`, resource);
          await createResource(resource, formData.namespace);
          console.log(`Successfully created ${resource.kind}: ${resource.metadata.name}`);
        }
      } else {
        // 表单模式：将表单数据转换为资源对象
        const resources = formDataToResources(formData);

        // 按顺序创建资源：先创建Dataset，再创建Runtime，最后创建DataLoad
        for (const resource of resources) {
          console.log(`Creating ${resource.kind}:`, resource);
          await createResource(resource, formData.namespace);
          console.log(`Successfully created ${resource.kind}: ${resource.metadata.name}`);
        }
      }

      console.log('All resources created successfully');
      notify.success(t('CREATE_DATASET_SUCCESS') || 'Dataset created successfully');
      onSuccess?.();
      onCancel();
    } catch (error) {
      console.error('Failed to create dataset:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      notify.error(`${t('CREATE_DATASET_FAILED') || 'Failed to create dataset'}: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setStepValidations({});
    setIsYamlMode(false);
    setFormData({
      name: '',
      namespace: 'default',
      runtimeType: 'AlluxioRuntime',
      runtimeName: '',
      replicas: 1,
      enableDataLoad: false,
    });
  };

  // 关闭Modal
  const handleClose = () => {
    handleReset();
    onCancel();
  };

  const currentStepValid = isYamlMode ? stepValidations[-1] !== false : stepValidations[currentStep] !== false;
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const currentStepConfig = STEPS[currentStep];

  return (
    <Modal
      title={t('CREATE_DATASET')}
      visible={visible}
      onCancel={handleClose}
      width="auto"
      footer={null}
      closable={true}
      maskClosable={false}
    >
      <ModalContent>
        <ModalHeader>
          <HeaderLeft>
            <HeaderTitle>{t('API_REFERENCE')}</HeaderTitle>
            <a href="https://github.com/fluid-cloudnative/fluid/blob/master/docs/en/dev/api_doc.md" target="_blank">^_^</a>
          </HeaderLeft>
          <HeaderActions>
            <YamlModeContainer>
              <YamlModeLabel>{t('YAML_MODE')}</YamlModeLabel>
              <Switch
                checked={isYamlMode}
                onChange={handleYamlModeChange}
              />
            </YamlModeContainer>
          </HeaderActions>
        </ModalHeader>

        <ModalBody>
          {!isYamlMode && (
            <>
              <StepIndicatorContainer>
                <StepIndicator
                  steps={STEPS}
                  currentStep={currentStep}
                  completedSteps={completedSteps}
                />
              </StepIndicatorContainer>
              <StepContent>
                {(() => {
                  const Component = currentStepConfig.component;
                  return (
                    <Component
                      formData={formData}
                      onDataChange={handleDataChange}
                      onValidationChange={(isValid: boolean) => handleValidationChange(currentStep, isValid)}
                    />
                  );
                })()}
              </StepContent>
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <FooterLeft>
            {!isYamlMode && currentStepConfig.optional && (
              <Button variant="text" onClick={handleSkip}>
                {t('SKIP_STEP')}
              </Button>
            )}
          </FooterLeft>
          <FooterRight>
            <Button variant="outline" onClick={handleClose}>
              {t('CANCEL')}
            </Button>
            {!isYamlMode && !isFirstStep && (
              <Button variant="outline" onClick={handlePrevious}>
                {t('PREVIOUS')}
              </Button>
            )}
            {!isYamlMode && !isLastStep && (
              <Button
                variant="filled"
                onClick={handleNext}
                disabled={!currentStepValid}
              >
                {t('NEXT')}
              </Button>
            )}
            {(isYamlMode || isLastStep) && (
              <Button
                variant="filled"
                color="success"
                onClick={handleCreate}
                disabled={!currentStepValid}
                loading={isCreating}
              >
                {t('CREATE')}
              </Button>
            )}
          </FooterRight>
        </ModalFooter>
      </ModalContent>

      {/* EditYamlModal for YAML editing */}
      {editYamlConfig.visible && (
        <EditYamlModal
          visible={editYamlConfig.visible}
          yaml={editYamlConfig.yaml}
          readOnly={editYamlConfig.readOnly}
          onOk={handleYamlSave}
          onCancel={handleYamlCancel}
          confirmLoading={isCreating}
        />
      )}
    </Modal>
  );
};

export default CreateDatasetModal;
