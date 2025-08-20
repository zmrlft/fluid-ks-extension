import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Input, Select, Textarea, Row, Col } from '@kubed/components';
import { StepComponentProps } from '../types';
import styled from 'styled-components';
import { Trash } from '@kubed/icons';

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

const LabelInput = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  
  .label-key, .label-value {
    flex: 1;
  }
`;

const AddLabelButton = styled.button`
  background: none;
  border: 1px dashed #d8dee5;
  color: #3385ff;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    border-color: #3385ff;
    background-color: #f8faff;
  }
`;

const ErrorMessage = styled.div`
  color: #ca2621;
  fontSize: 12px;
  marginTop: 4px;
`;

const FieldLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: #ca2621;
  cursor: pointer;
  padding: 8px;

  &:hover {
    background-color: #ffeaea;
    border-radius: 4px;
  }
`;

const BasicInfoStep: React.FC<StepComponentProps> = ({
  formData,
  onDataChange,
  onValidationChange,
}) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [labels, setLabels] = useState<Array<{ key: string; value: string }>>([]);
  const [formValues, setFormValues] = useState({
    name: '',
    namespace: 'default',
    description: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 构建标签对象的通用函数
  const buildLabelsObject = useCallback((labelArray: Array<{ key: string; value: string }>): Record<string, string> | undefined => {
    const labelsObj: Record<string, string> = {};
    labelArray.forEach(({ key, value }) => {
      if (key && value) {
        labelsObj[key] = value;
      }
    });
    return Object.keys(labelsObj).length > 0 ? labelsObj : undefined;
  }, []);

  // 验证数据集名称
  const validateDatasetName = useCallback((name: string): Record<string, boolean | string> => {
    if (!name) return { isValid: false, message: t('DATASET_NAME_REQUIRED') };

    // Kubernetes 资源名称规则：小写字母、数字、连字符，不能以连字符开头或结尾
    const nameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!nameRegex.test(name)) {
      return {
        isValid: false,
        message: t('DATASET_NAME_INVALID_FORMAT')
      };
    }

    if (name.length > 63) {
      return {
        isValid: false,
        message: t('DATASET_NAME_TOO_LONG')
      };
    }

    return { isValid: true, message: '' };
  }, []);

  // 计算名称验证结果
  const nameValidation = useMemo(() => validateDatasetName(formValues.name), [formValues.name, validateDatasetName]);

  // 获取命名空间列表
  useEffect(() => {
    const fetchNamespaces = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/v1/namespaces');
        
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data && data.items) {
          const namespaceList = data.items.map((item: any) => item.metadata.name);
          setNamespaces(namespaceList);
        }
      } catch (error) {
        console.error('获取命名空间列表失败:', error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchNamespaces();
  }, []);

  // 监听formValues状态变化，用于调试
  useEffect(() => {
    console.log('formValues状态已更新:', formValues);
  }, [formValues]);

  // 初始化表单数据
  useEffect(() => {
    // 只在真正需要初始化时才执行
    console.log('formData变化时的状态:', formData);
    console.log('formValues变化时的状态:', formValues);
    if (formData.name !== formValues.name ||
        formData.namespace !== formValues.namespace ||
        formData.description !== formValues.description) {
          console.log('执行初始化表单数据');

      const newFormValues = {
        name: formData.name || '',
        namespace: formData.namespace || 'default',
        description: formData.description || '',
      };
      setFormValues(newFormValues);
      console.log('调用setFormValues，新值为:', newFormValues);
      // 注意：这里的formValues还是旧值，因为状态更新是异步的
      console.log('当前formValues（异步更新前）:', formValues);

      // 使用setTimeout验证状态是否在下一个事件循环中更新
      setTimeout(() => {
        console.log('验证：状态更新后的formValues应该已经改变');
      }, 0);
    }

    // 初始化时进行验证 - 使用formData作为权威数据源
    const nameValid = validateDatasetName(formData.name || '');
    const isValid = nameValid.isValid && (formData.namespace || 'default');
    onValidationChange(!!isValid);
  }, [formData.name, formData.namespace, formData.description]);

  // 单独处理标签初始化，避免与用户输入冲突
  useEffect(() => {
    if (formData.labels && Object.keys(formData.labels).length > 0) {
      // 检查是否需要从formData重新初始化标签
      const formDataLabels = Object.entries(formData.labels).map(([key, value]) => ({
        key,
        value,
      }));

      // 比较当前标签和formData标签是否相同
      const currentValidLabels = labels.filter(label => label.key && label.value);
      const isLabelsEqual = formDataLabels.length === currentValidLabels.length &&
        formDataLabels.every((formLabel, index) => {
          const currentLabel = currentValidLabels[index];
          return currentLabel && formLabel.key === currentLabel.key && formLabel.value === currentLabel.value;
        });

      // 只有在标签不相等时才重新初始化
      if (!isLabelsEqual) {
        setLabels(formDataLabels);
      }
    }
  }, [formData.labels]);

  // 表单值变化处理
  const handleFormChange = useCallback((field: string, value: string) => {
    console.log('handleFormChange 执行时的状态:', {
      currentFormValues: formValues,
      currentLabels: labels,
      field,
      value
    });
    
    const newValues = { ...formValues, [field]: value };
    setFormValues(newValues);

    // 只更新基本信息字段，保留其他字段（如annotations、runtimeSpec等）
    onDataChange({
      name: newValues.name,
      namespace: newValues.namespace,
      description: newValues.description,
      labels: buildLabelsObject(labels),
    });

    // 验证表单
    const nameValid = validateDatasetName(newValues.name);
    const isValid = nameValid.isValid && newValues.namespace;
    onValidationChange(!!isValid);
  }, [formValues, labels, buildLabelsObject, onDataChange, onValidationChange, validateDatasetName]);

  // 添加标签
  const addLabel = useCallback(() => {
    setLabels(prev => [...prev, { key: '', value: '' }]);
  }, []);

  // 删除标签
  const removeLabel = useCallback((index: number) => {
    setLabels(prev => {
      const newLabels = prev.filter((_, i) => i !== index);
      onDataChange({
          labels: buildLabelsObject(newLabels),
      });
      return newLabels;
    });
  }, [buildLabelsObject, onDataChange]);

  // 更新标签
  const updateLabel = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setLabels(prev => {
      const newLabels = [...prev];
      newLabels[index][field] = value;   
        onDataChange({
          labels: buildLabelsObject(newLabels),
        });
      return newLabels;
    });
  }, [buildLabelsObject, onDataChange]);



  return (
    <StepContainer>
      <StepTitle>{t('BASIC_INFORMATION')}</StepTitle>

      <div>
        {error && (
          <ErrorMessage style={{ marginBottom: '16px' }}>
            {t('FETCH_NAMESPACES_ERROR')}: {error}
          </ErrorMessage>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: '16px', display: 'flex', gap : '16px' }}>
          <Col span={12} style={{ flex: 1 }}>
            <FieldLabel>
              {t('NAME')} *
            </FieldLabel>
            <Input
              placeholder={t('DATASET_NAME_PLACEHOLDER')}
              value={formValues.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormChange('name', e.target.value)}
              status={!nameValidation.isValid && formValues.name ? 'error' : undefined}
            />
            {!nameValidation.isValid && (
              <ErrorMessage>
                {nameValidation.message}
              </ErrorMessage>
            )}
          </Col>
          <Col span={12} style={{ flex: 1 }}>
            <FieldLabel>
              {t('PROJECT')} *
            </FieldLabel>
            <Select
              style={{ width: '100%' }}
              placeholder={t('SELECT_PROJECT')}
              value={formValues.namespace}
              onChange={(value) => handleFormChange('namespace', value)}
              loading={isLoading}
              disabled={isLoading}
            >
              {namespaces.map(ns => (
                <Select.Option key={ns} value={ns}>
                  {ns}
                </Select.Option>
              ))}
            </Select>
          </Col>
        </Row>

        <div style={{ marginBottom: '16px' }}>
          <FieldLabel>
            {t('DESCRIPTION')}
          </FieldLabel>
          <Textarea
            placeholder={t('DATASET_DESCRIPTION_PLACEHOLDER')}
            rows={3}
            maxLength={256}
            value={formValues.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFormChange('description', e.target.value)}
            showCount
          />
        </div>

        <div style={{ marginBottom: '16px', display: 'none' }}>
          <FieldLabel>
            {t('LABELS')}
          </FieldLabel>
          {labels.map((label, index) => (
            <LabelInput key={`label-${index}`}>
              <Input
                className="label-key"
                placeholder={t('LABEL_KEY')}
                value={label.key}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLabel(index, 'key', e.target.value)}
              />
              <Input
                className="label-value"
                placeholder={t('LABEL_VALUE')}
                value={label.value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLabel(index, 'value', e.target.value)}
              />
              <RemoveButton
                type="button"
                onClick={() => removeLabel(index)}
                title={t('REMOVE_LABEL')}
                aria-label={`${t('REMOVE_LABEL')} ${index + 1}`}
              >
                <Trash size={16} />
              </RemoveButton>
            </LabelInput>
          ))}
          <AddLabelButton type="button" onClick={addLabel}>
            + {t('ADD_LABEL')}
          </AddLabelButton>
        </div>
      </div>
    </StepContainer>
  );
};

export default BasicInfoStep;
