import React from 'react';
import styled from 'styled-components';
import { Check } from '@kubed/icons';

declare const t: (key: string, options?: any) => string;

interface StepIndicatorProps {
  steps: Array<{
    key: string;
    title: string;
    description: string;
    optional?: boolean;
  }>;
  currentStep: number;
  completedSteps: Set<number>;
}

const StepContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 32px;
  padding: 0 24px;
`;

const StepItem = styled.div<{ isCompleted: boolean }>`
  display: flex;
  align-items: center;
  flex: 1;
  position: relative;
`;

const StepIcon = styled.div<{ isActive: boolean; isCompleted: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${props => {
    if (props.isCompleted) return '#00aa72';
    if (props.isActive) return '#3385ff';
    return '#e3e9ef';
  }};
  color: white;
  font-size: 16px;
  font-weight: 650;
  margin-right: 8px;
  position: relative;
  z-index: 2;
`;

const StepContent = styled.div`
  flex: 1;
`;

const StepTitle = styled.div<{ isActive: boolean; isCompleted: boolean }>`
  font-size: 14px;
  font-weight: 600;
  color: ${props => {
    if (props.isCompleted || props.isActive) return '#242e42';
    return '#79879c';
  }};
  margin-bottom: 4px;
`;

const StepDescription = styled.div<{ isActive: boolean; isCompleted: boolean }>`
  font-size: 12px;
  color: ${props => {
    if (props.isCompleted || props.isActive) return '#79879c';
    return '#c1c9d1';
  }};
`;

const OptionalBadge = styled.span`
  font-size: 10px;
  color: #79879c;
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 8px;
  margin-left: 8px;
`;

const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  completedSteps,
}) => {
  return (
    <StepContainer>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = completedSteps.has(index);
        
        return (
          <StepItem
            key={step.key}
            isCompleted={isCompleted}
          >
            <StepIcon isActive={isActive} isCompleted={isCompleted}>
              {isCompleted ? (
                <Check size={16} />
              ) : (
                <span>{index + 1}</span>
              )}
            </StepIcon>
            <StepContent>
              <StepTitle isActive={isActive} isCompleted={isCompleted}>
                {t(step.title)}
                {step.optional && (
                  <OptionalBadge>{t('OPTIONAL')}</OptionalBadge>
                )}
              </StepTitle>
              <StepDescription isActive={isActive} isCompleted={isCompleted}>
                {t(step.description)}
              </StepDescription>
            </StepContent>
          </StepItem>
        );
      })}
    </StepContainer>
  );
};

export default StepIndicator;
