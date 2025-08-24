import React, { useEffect, useState } from 'react';
import { Form, FormItem, Input, Select, Switch, InputNumber, Row, Col, Button, Alert } from '@kubed/components';
import { StepComponentProps } from '../types';
import styled from 'styled-components';
import { Add, Trash } from '@kubed/icons';
import { request } from '../../../../../utils/request';

declare const t: (key: string, options?: any) => string;

const StepContainer = styled.div`
  padding: 24px;
  min-height: 400px;
`;

const StepTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #242e42;
  margin-bottom: 8px;
`;

const StepDescription = styled.p`
  font-size: 14px;
  color: #79879c;
  margin-bottom: 24px;
`;

const ConfigSection = styled.div<{ disabled?: boolean }>`
  opacity: ${props => props.disabled ? 0.5 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};
  transition: opacity 0.3s ease;
`;

const TargetItem = styled.div`
  border: 1px solid #e3e9ef;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 16px;
  background-color: #f9fbfd;
  position: relative;
`;

const RemoveButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #ca2621;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  
  &:hover {
    background-color: #fff2f2;
  }
`;

const AddTargetButton = styled.button`
  background: none;
  border: 1px dashed #d8dee5;
  color: #3385ff;
  padding: 12px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    border-color: #3385ff;
    background-color: #f8faff;
  }
`;

interface Target {
  path: string;
  replicas: number;
}

const POLICY_OPTIONS = [
  { label: 'Once', value: 'Once' },
  { label: 'Cron', value: 'Cron' },
  { label: 'OnEvent', value: 'OnEvent' },
];

const DataLoadStep: React.FC<StepComponentProps> = ({
  formData,
  onDataChange,
  onValidationChange,
  isIndependent = false
}) => {
  const [targets, setTargets] = useState<Target[]>([
    { path: '/', replicas: 1 },
  ]);
  const [formValues, setFormValues] = useState({
    enableDataLoad: formData.enableDataLoad || false,
    loadMetadata: formData.dataLoadConfig?.loadMetadata || false,
    policy: formData.dataLoadConfig?.policy || 'Once',
    schedule: formData.dataLoadConfig?.schedule || '',
    target: formData.dataLoadConfig?.target || [{ path: '/', replicas: 1 }],
  });
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [isLoadingNamespaces, setIsLoadingNamespaces] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);

  // 获取命名空间列表
  useEffect(() => {
    if (isIndependent) {
      const fetchNamespaces = async () => {
        try {
          setIsLoadingNamespaces(true);
          const response = await request('/api/v1/namespaces');

          if (response.ok) {
            const data = await response.json();
            if (data && data.items) {
              const namespaceList = data.items.map((item: any) => item.metadata.name);
              setNamespaces(namespaceList);
            }
          }
        } catch (error) {
          console.error('获取命名空间列表失败:', error);
        } finally {
          setIsLoadingNamespaces(false);
        }
      };
      fetchNamespaces();
    }
  }, [isIndependent]);

  // 获取数据集列表
  useEffect(() => {
    if (isIndependent && formData.namespace) {
      const fetchDatasets = async () => {
        try {
          setIsLoadingDatasets(true);
          const url = `/kapis/data.fluid.io/v1alpha1/namespaces/${formData.namespace}/datasets`;
          const response = await request(url);

          if (response.ok) {
            const data = await response.json();
            if (data && data.items) {
              setDatasets(data.items);
            }
          }
        } catch (error) {
          console.error('获取数据集列表失败:', error);
        } finally {
          setIsLoadingDatasets(false);
        }
      };
      fetchDatasets();
    }
  }, [isIndependent, formData.namespace]);

  // 初始化表单数据
  useEffect(() => {
    const dataLoadConfig = formData.dataLoadConfig;

    setFormValues({
      enableDataLoad: isIndependent ? true : (formData.enableDataLoad || false), // 独立模式默认启用
      loadMetadata: dataLoadConfig?.loadMetadata || false,
      policy: dataLoadConfig?.policy || 'Once',
      schedule: dataLoadConfig?.schedule || '',
      target: dataLoadConfig?.target || [{ path: '/', replicas: 1 }],
    });

    if (dataLoadConfig?.target && dataLoadConfig.target.length > 0) {
      setTargets(dataLoadConfig.target.map(t => ({ ...t, replicas: t.replicas || 1 })));
    }
  }, [formData, isIndependent]);

  // TODO
  // 独立模式下监听表单数据变化并触发验证
  // useEffect(() => {
  //   if (isIndependent) {
  //     // updateFormData();
  //     这里有bug，先注释掉后面再来排查
  //   }
  // }, [formData.dataLoadName, formData.namespace, formData.selectedDataset, isIndependent]);

  // 更新表单数据
  const updateFormData = (newTargets?: Target[], newFormValues?: any) => {
    const targetsToUse = newTargets || targets;
    const valuesToUse = newFormValues || formValues;

    // 只更新DataLoad基本配置，保留完整的dataLoadSpec
    onDataChange({
      enableDataLoad: valuesToUse.enableDataLoad,
      dataLoadConfig: valuesToUse.enableDataLoad ? {
        loadMetadata: valuesToUse.loadMetadata,
        target: targetsToUse,
        policy: valuesToUse.policy,
        schedule: valuesToUse.policy === 'Cron' ? valuesToUse.schedule : undefined,
      } : undefined,
      // 保留现有的dataLoadSpec配置
    });

    // 验证逻辑
    if (isIndependent) {
      // 独立模式：验证必填字段
      const hasDataLoadName = !!(formData.dataLoadName && formData.dataLoadName.trim() !== '');
      const hasNamespace = !!(formData.namespace && formData.namespace.trim() !== '');
      const hasSelectedDataset = !!(formData.selectedDataset && formData.selectedDataset.trim() !== '');
      const hasValidTarget = targetsToUse.some(target => target.path);

      const isValid = hasDataLoadName && hasNamespace && hasSelectedDataset && hasValidTarget;
      onValidationChange(isValid);
    } else {
      // 非独立模式：如果启用了数据预热，验证至少有一个有效的目标路径
      if (valuesToUse.enableDataLoad) {
        const hasValidTarget = targetsToUse.some(target => target.path);
        onValidationChange(hasValidTarget);
      } else {
        onValidationChange(true); // 如果未启用数据预热，则总是有效
      }
    }
  };

  // 表单值变化处理
  const handleFormChange = (field: string, value: any) => {
    const newValues = { ...formValues, [field]: value };
    setFormValues(newValues);
    updateFormData(undefined, newValues);
  };

  // 更新目标路径
  const updateTarget = (index: number, field: keyof Target, value: any) => {
    const newTargets = [...targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setTargets(newTargets);
    updateFormData(newTargets);
  };

  // 添加目标路径
  const addTarget = () => {
    const newTarget: Target = {
      path: '',
      replicas: 1,
    };
    const newTargets = [...targets, newTarget];
    setTargets(newTargets);
    updateFormData(newTargets);
  };

  // 删除目标路径
  const removeTarget = (index: number) => {
    if (targets.length > 1) {
      const newTargets = targets.filter((_, i) => i !== index);
      setTargets(newTargets);
      updateFormData(newTargets);
    }
  };

  const enableDataLoad = formValues.enableDataLoad;
  const policy = formValues.policy;

  return (
    <StepContainer>
      {!isIndependent ? (
        <Alert
          type="info"
          title={t('DATA_PRELOAD_OPTIONAL')}
          style={{ marginBottom: 24 }}
        >
          {t('DATA_PRELOAD_OPTIONAL_DESC')}
        </Alert>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {/* <Alert
            type="info"
            title={t('CREATE_DATALOAD_INFO')}
            style={{ marginBottom: 16 }}
          >
            {t('CREATE_DATALOAD_INFO_DESC')}
          </Alert> */}

          {/* DataLoad名称输入框 */}
          <Row gutter={[16, 0]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {t('DATALOAD_NAME')} *
                </label>
                <Input
                  placeholder={t('DATALOAD_NAME_PLACEHOLDER')}
                  value={formData.dataLoadName || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onDataChange({ dataLoadName: e.target.value })
                  }
                />
              </div>
            </Col>
            <Col span={6}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {t('NAMESPACE')} *
                </label>
                <Select
                  placeholder={t('SELECT_NAMESPACE')}
                  value={formData.namespace}
                  onChange={(value) => onDataChange({ namespace: value })}
                  loading={isLoadingNamespaces}
                  style={{ width: '100%' }}
                >
                  {namespaces.map(ns => (
                    <Select.Option key={ns} value={ns}>
                      {ns}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </Col>
          </Row>

          {/* 数据集选择器 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              {t('SELECT_DATASET')} *
            </label>
            <Select
              placeholder={t('SELECT_DATASET_PLACEHOLDER')}
              value={formData.selectedDataset || ''}
              onChange={(value) => onDataChange({ selectedDataset: value })}
              loading={isLoadingDatasets}
              disabled={!formData.namespace}
              style={{ width: '100%' }}
              inputMode='text'
            >
              {datasets.map(dataset => (
                <Select.Option key={dataset.metadata.name} value={dataset.metadata.name}>
                  {dataset.metadata.name}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {!isIndependent && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            {t('ENABLE_DATA_PRELOAD')}
          </label>
          <Switch
            checked={formValues.enableDataLoad}
            onChange={(checked) => handleFormChange('enableDataLoad', checked)}
          />
        </div>
      )}

      <div>
        <ConfigSection disabled={!enableDataLoad}>
          <Row gutter={[16, 0]}>
            <Col span={3}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {t('LOAD_METADATA')}
                </label>
                <Switch
                  checked={formValues.loadMetadata}
                  onChange={(checked) => handleFormChange('loadMetadata', checked)}
                />
              </div>
            </Col>
            <Col span={3} >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {t('PRELOAD_POLICY')}
                </label>
                <Select
                  placeholder={t('SELECT_POLICY')}
                  value={formValues.policy}
                  onChange={(value) => handleFormChange('policy', value)}
                >
                  {POLICY_OPTIONS.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {t(option.label)}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </Col>
          </Row>

          {policy === 'Cron' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                {t('CRON_SCHEDULE')}
              </label>
              <Input
                placeholder="0 2 * * *"
                value={formValues.schedule}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange('schedule', e.target.value)}
              />
              <div style={{ fontSize: '12px', color: '#79879c', marginTop: '4px' }}>
                {t('CRON_SCHEDULE_HELP')}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              {t('TARGET_PATHS')}
            </label>
            {targets.map((target, index) => (
              <TargetItem key={index}>
                {targets.length > 1 && (
                  <RemoveButton onClick={() => removeTarget(index)}>
                    <Trash size={25} />
                  </RemoveButton>
                )}

                <Row gutter={[16, 0]}>
                  <Col span={8}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        {t('PATH')}
                      </label>
                      <Input
                        value={target.path}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTarget(index, 'path', e.target.value)}
                        placeholder={t('TARGET_PATH_PLACEHOLDER')}
                      />
                    </div>
                  </Col>
                  <Col span={3}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        {t('REPLICAS')}
                      </label>
                      <InputNumber
                        value={target.replicas}
                        onChange={(value) => updateTarget(index, 'replicas', value || 1)}
                        min={1}
                        max={100}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </Col>
                </Row>
              </TargetItem>
            ))}

            <AddTargetButton onClick={addTarget}>
              <Add size={16} />
              {t('ADD_TARGET_PATH')}
            </AddTargetButton>
          </div>
        </ConfigSection>
      </div>
    </StepContainer>
  );
};

export default DataLoadStep;
