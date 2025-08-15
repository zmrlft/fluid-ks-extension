import React, { useState, useCallback } from 'react';
import { Button, Modal, Switch, notify } from '@kubed/components';
import styled from 'styled-components';
import StepIndicator from './components/StepIndicator';
import BasicInfoStep from './components/BasicInfoStep';
import RuntimeStep from './components/RuntimeStep';
import DataSourceStep from './components/DataSourceStep';
import DataLoadStep from './components/DataLoadStep';
import YamlEditor from './components/YamlEditor';
import { CreateDatasetModalProps, DatasetFormData, StepConfig } from './types';
import { getCurrentCluster } from '../../../../utils/request';

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
    const dataset = {
      apiVersion: 'data.fluid.io/v1alpha1',
      kind: 'Dataset',
      metadata: {
        name: data.name,
        namespace: data.namespace,
        labels: data.labels || {},
        ...(data.description && {
          annotations: {
            'data.fluid.io/description': data.description,
          },
        }),
      },
      spec: {
        mounts: data.mounts || [],
        runtimes: [
          {
            name: data.runtimeName || data.name,
            namespace: data.namespace,
          },
        ],
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
      spec: {
        replicas: data.replicas || 1,
        tieredstore: data.tieredStore || {
          levels: [
            {
              level: 0,
              mediumtype: 'MEM',
              quota: '2Gi',
            },
          ],
        },
      },
    };
    resources.push(runtime);

    // 如果启用了数据预热，创建DataLoad资源
    if (data.enableDataLoad && data.dataLoadConfig) {
      const dataLoad = {
        apiVersion: 'data.fluid.io/v1alpha1',
        kind: 'DataLoad',
        metadata: {
          name: `${data.name}-dataload`,
          namespace: data.namespace,
        },
        spec: {
          dataset: {
            name: data.name,
            namespace: data.namespace,
          },
          loadMetadata: data.dataLoadConfig.loadMetadata,
          target: data.dataLoadConfig.target || [],
          policy: data.dataLoadConfig.policy || 'Once',
          ...(data.dataLoadConfig.schedule && { schedule: data.dataLoadConfig.schedule }),
        },
      };
      resources.push(dataLoad);
    }

    return resources;
  };

  // 从YAML内容创建资源
  const createFromYaml = async (yamlContent: string) => {
    const yaml = await import('js-yaml');
    const documents = yamlContent.split('---').filter(doc => doc.trim());
    const resources = documents.map(doc => yaml.load(doc.trim()));

    // 按顺序创建资源
    for (const resource of resources) {
      if (resource && typeof resource === 'object' && 'kind' in resource && 'metadata' in resource) {
        console.log(`Creating ${resource.kind}:`, resource);
        await createResource(resource, resource.metadata.namespace || formData.namespace);
        console.log(`Successfully created ${resource.kind}: ${resource.metadata.name}`);
      }
    }
  };

  // 创建数据集
  const handleCreate = async () => {
    setIsCreating(true);
    try {
      console.log('Creating dataset with data:', formData);

      if (isYamlMode) {
        // YAML模式：从YamlEditor获取YAML内容并创建
        // 注意：这里需要从YamlEditor组件获取当前的YAML内容
        // 由于YamlEditor已经验证了YAML并更新了formData，我们可以重新生成YAML
        const yaml = await import('js-yaml');
        const resources = formDataToResources(formData);
        const yamlContent = resources.map(resource => yaml.dump(resource)).join('---\n');
        await createFromYaml(yamlContent);
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

  const currentStepValid = stepValidations[currentStep] !== false;
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
                onChange={setIsYamlMode}
              />
            </YamlModeContainer>
          </HeaderActions>
        </ModalHeader>

        <ModalBody>
          {isYamlMode ? (
            <YamlEditor
              formData={formData}
              onDataChange={handleDataChange}
              onValidationChange={(isValid) => handleValidationChange(-1, isValid)}
            />
          ) : (
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
    </Modal>
  );
};

export default CreateDatasetModal;
