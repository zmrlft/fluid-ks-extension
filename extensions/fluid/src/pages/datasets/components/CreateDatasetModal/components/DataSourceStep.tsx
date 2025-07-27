import React, { useEffect, useState } from 'react';
import { Form, FormItem, Input, Select, Switch, Row, Col, Button } from '@kubed/components';
import { StepComponentProps } from '../types';
import styled from 'styled-components';
import { Add, Trash } from '@kubed/icons';

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

const MountItem = styled.div`
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

const AddMountButton = styled.button`
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

const OptionsContainer = styled.div`
  margin-top: 16px;
`;

const OptionItem = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
`;

interface Mount {
  mountPoint: string;
  name: string;
  path: string;
  readOnly: boolean;
  shared: boolean;
  options: Array<{ key: string; value: string }>;
}

const DataSourceStep: React.FC<StepComponentProps> = ({
  formData,
  onDataChange,
  onValidationChange,
}) => {
  const [mounts, setMounts] = useState<Mount[]>([
    {
      mountPoint: '',
      name: '',
      path: '',
      readOnly: false,
      shared: true,
      options: [],
    },
  ]);

  // 初始化挂载点数据
  useEffect(() => {
    if (formData.mounts && formData.mounts.length > 0) {
      const mountsData = formData.mounts.map(mount => ({
        mountPoint: mount.mountPoint,
        name: mount.name,
        path: mount.path || '',
        readOnly: mount.readOnly || false,
        shared: mount.shared !== undefined ? mount.shared : true,
        options: mount.options ? Object.entries(mount.options).map(([key, value]) => ({ key, value })) : [],
      }));
      setMounts(mountsData);
    }
  }, [formData.mounts]);

  useEffect(() => {
    const hasValidMount = mounts.some(mount =>
      mount.mountPoint
    );
    onValidationChange(hasValidMount);
  }, [mounts])

  // 更新表单数据
  const updateFormData = (newMounts: Mount[]) => {
    const mountsData = newMounts.map(mount => ({
      mountPoint: mount.mountPoint,
      name: mount.name,
      path: mount.path,
      readOnly: mount.readOnly,
      shared: mount.shared,
      options: mount.options.reduce((acc, { key, value }) => {
        if (key || value) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>),
    }));

    onDataChange({
      mounts: mountsData,
    });
  };

  // 更新挂载点
  const updateMount = (index: number, field: keyof Mount, value: any) => {
    const newMounts = [...mounts];
    newMounts[index] = { ...newMounts[index], [field]: value };
    setMounts(newMounts);
    updateFormData(newMounts);
  };

  // 添加挂载点
  const addMount = () => {
    const newMount: Mount = {
      mountPoint: '/',
      name: `mount-${mounts.length}`,
      path: '',
      readOnly: false,
      shared: true,
      options: [],
    };
    const newMounts = [...mounts, newMount];
    setMounts(newMounts);
    updateFormData(newMounts);
  };

  // 删除挂载点
  const removeMount = (index: number) => {
    if (mounts.length > 1) {
      const newMounts = mounts.filter((_, i) => i !== index);
      setMounts(newMounts);
      updateFormData(newMounts);
    }
  };

  // 添加选项
  const addOption = (mountIndex: number) => {
    const newMounts = [...mounts];
    newMounts[mountIndex].options.push({ key: '', value: '' });
    setMounts(newMounts);
    // 不立即调用 updateFormData，避免空选项被过滤
  };

  // 删除选项
  const removeOption = (mountIndex: number, optionIndex: number) => {
    const newMounts = [...mounts];
    newMounts[mountIndex].options = newMounts[mountIndex].options.filter((_, i) => i !== optionIndex);
    setMounts(newMounts);
    updateFormData(newMounts);
  };

  // 更新选项
  const updateOption = (mountIndex: number, optionIndex: number, field: 'key' | 'value', value: string) => {
    const newMounts = [...mounts];
    newMounts[mountIndex].options[optionIndex][field] = value;
    setMounts(newMounts);
    updateFormData(newMounts);
  };

  return (
    <StepContainer>
      {mounts.map((mount, mountIndex) => (
        <MountItem key={mountIndex}>
          {mounts.length > 1 && (
            <RemoveButton onClick={() => removeMount(mountIndex)}>
              <Trash size={25} />
            </RemoveButton>
          )}
          
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {t('DATA_SOURCE')}
                </label>
                <Input
                  value={mount.mountPoint}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMount(mountIndex, 'mountPoint', e.target.value)}
                  placeholder="数据源路径 (如: s3://bucket/path)"
                />
              </div>
            </Col>
            <Col span={4}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {t('NAME')}
                </label>
                <Input
                  value={mount.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMount(mountIndex, 'name', e.target.value)}
                  placeholder="default"
                />
              </div>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {t('MOUNT_PATH')}
                  <span style={{ color: '#79879c', fontWeight: 400, marginLeft: '8px' }}>
                    (可选，如果不设置将是 /{mount.name || 'Name'})
                  </span>
                </label>
                <Input
                  value={mount.path}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMount(mountIndex, 'path', e.target.value)}
                  placeholder={`/${mount.name || 'Name'}`}
                />
              </div>
            </Col>

            
          </Row>

          <Row gutter={[16, 16]}>
            <Col span={4}>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontWeight: 600, display: 'flex' }}>
                  {t('READ_ONLY')}
                </label>
                <Switch
                  checked={mount.readOnly}
                  onChange={(checked) => updateMount(mountIndex, 'readOnly', checked)}
                />
              </div>
            </Col>
            <Col span={4}>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontWeight: 600, display: 'flex' }}>
                  {t('SHARED')}
                </label>
                <Switch
                  checked={mount.shared}
                  onChange={(checked) => updateMount(mountIndex, 'shared', checked)}
                />
              </div>
            </Col>
          </Row>

          <OptionsContainer>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                {t('OPTIONS')}
              </label>
              {mount.options.map((option, optionIndex) => (
                <OptionItem key={optionIndex}>
                  <Input
                    placeholder={t('OPTION_KEY')}
                    value={option.key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateOption(mountIndex, optionIndex, 'key', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Input
                    placeholder={t('OPTION_VALUE')}
                    value={option.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateOption(mountIndex, optionIndex, 'value', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="text"
                    onClick={() => removeOption(mountIndex, optionIndex)}
                    style={{ color: '#ca2621' }}
                  >
                    <Trash size={40} />
                  </Button>
                </OptionItem>
              ))}
              <Button
                variant="text"
                onClick={() => addOption(mountIndex)}
                style={{ color: '#3385ff' }}
              >
                <Add size={16} /> {t('ADD_OPTION')}
              </Button>
            </div>
          </OptionsContainer>
        </MountItem>
      ))}

      <AddMountButton onClick={addMount}>
        <Add size={18} />
        {t('ADD_MOUNT_POINT')}
      </AddMountButton>
    </StepContainer>
  );
};

export default DataSourceStep;
