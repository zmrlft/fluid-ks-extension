import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@kubed/components';

declare const t: (key: string, options?: any) => string;

const Container = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Title = styled.h2`
  margin-bottom: 1.5rem;
  text-align: center;
`;

const Description = styled.p`
  margin-bottom: 2rem;
  text-align: center;
  color: #79879c;
  font-size: 14px;
`;

const CardWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 2rem;
`;

const StyledCard = styled(Card)`
  display: flex;
  flex-direction: column;
  height: 220px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-4px);
  }
`;

const CardTitle = styled.h3`
  margin: 0 0 1rem 0;
`;

const CardDesc = styled.p`
  color: #79879c;
  flex-grow: 1;
  margin-bottom: 1rem;
`;

export default function App() {
  const navigate = useNavigate();

  const handleNavigateToDatasets = () => {
    navigate('/fluid/datasets');
  };

  return (
    <Container>
      <Title>Fluid</Title>
      <Description>
        Fluid, elastic data abstraction and acceleration for BigData/AI applications in cloud.
      </Description>

      <CardWrapper>
        <StyledCard onClick={handleNavigateToDatasets}>
          <CardTitle>{t('DATASETS')}</CardTitle>
          <CardDesc>{t('DATASET_DESC')}</CardDesc>
          <Button>{t('MANAGE_DATASETS')}</Button>
        </StyledCard>
      </CardWrapper>
    </Container>
  );
}
