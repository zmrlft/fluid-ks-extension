import React, { useMemo } from 'react';
import { Banner, Card } from '@kubed/components';
import { Book2Duotone, RocketDuotone, FluentdDuotone } from '@kubed/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import styled from 'styled-components';

declare const t: (key: string, options?: any) => string;

// 由于 Layout 不在 @kubed/components 中，我们自己创建一个简单的 Layout
const Layout = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
`;

const Sider = styled.div`
  flex: 0 0 220px;
  width: 220px;
  background: #fff;
  box-shadow: 0 4px 8px rgba(36, 46, 66, 0.06);
  z-index: 2;
  overflow: auto;
`;

const Content = styled.div`
  flex: 1;
  overflow: auto;
`;

const FluidLayout = styled(Layout)`
  height: 100vh;
`;

const LogoWrapper = styled.div`
  height: 40px;
  padding: 0 20px;
  margin: 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Logo = styled.div`
  font-size: 18px;
  font-weight: bold;
  color: #00aa72;
`;

const ContentWrapper = styled.div`
  padding: 24px;
  background-color: #f5f7fa;
  height: 100%;
  overflow: auto;
`;

const StyledMenu = styled.div`
  .menu-item {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    margin: 4px 0;
    cursor: pointer;
    transition: all 0.3s ease;
    
    .menu-icon {
      margin-right: 10px;
    }
    
    &:hover {
      background-color: #f5f7fa;
    }
    
    &.selected {
      background-color: #f9fbfd;
      border-right: 3px solid #00aa72;
      
      .menu-icon {
        color: #00aa72;
      }
    }
  }
`;

const PageHeader = styled(Banner)`
  margin-bottom: 20px;
`;

const menuItems = [
  {
    key: 'datasets',
    icon: <Book2Duotone />,
    label: 'DATASETS'
  },
  {
    key: 'runtimes',
    icon: <RocketDuotone />,
    label: 'RUNTIMES'
  }
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const selectedKeys = useMemo(() => {
    if (location.pathname.includes('/datasets')) {
      return 'datasets';
    }
    if (location.pathname.includes('/runtimes')) {
      return 'runtimes';
    }
    return '';
  }, [location]);

  const handleMenuClick = (key: string) => {
    navigate(`/fluid/${key}`);
  };

  return (
    <FluidLayout>
      <Sider>
        <LogoWrapper>
          <FluentdDuotone style={{ fontSize: '24px', color: '#00aa72' }} />
          <Logo>Fluid</Logo>
        </LogoWrapper>
        <StyledMenu>
          {menuItems.map((item) => (
            <div
              key={item.key}
              className={`menu-item ${selectedKeys === item.key ? 'selected' : ''}`}
              onClick={() => handleMenuClick(item.key)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span>{t(item.label)}</span>
            </div>
          ))}
        </StyledMenu>
      </Sider>
      <Content>
        <ContentWrapper>
          
          <Outlet />
        </ContentWrapper>
      </Content>
    </FluidLayout>
  );
}
