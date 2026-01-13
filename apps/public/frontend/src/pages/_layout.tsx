import { ExtraHeaderLayout, LargePaneLayout, SidebarPane } from '@metorial-io/layout';
import { Logo } from '@metorial-io/ui';
import {
  RiBriefcaseLine,
  RiGroup3Line,
  RiIdCardLine,
  RiProfileLine,
  RiServerFill,
  RiServerLine,
  RiUser2Line,
  RiUserCommunityLine,
  RiUserFollowLine,
  RiUserLine,
  RiUserStarLine
} from '@remixicon/react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';

export let Layout = () => {
  let { pathname } = useLocation();

  let accountItems = [
    { icon: <RiUserLine />, label: 'Users', to: '/users' },
    {
      icon: <RiUserCommunityLine />,
      label: 'Organizations',
      to: '/organizations'
    }
  ];

  let managementItems = [
    { icon: <RiUser2Line />, label: 'Admins', to: '/admins' },
    { icon: <RiUser2Line />, label: 'Plans', to: '/plans' },
    { icon: <RiUserStarLine />, label: 'Handoff', to: '/handoff' },
    { icon: <RiUserStarLine />, label: 'Plan Campaigns', to: '/plan-campaigns' }
  ];

  let authItems = [
    { icon: <RiUserFollowLine />, label: 'Invites', to: '/invites' },
    { icon: <RiIdCardLine />, label: 'Auth Config', to: '/auth-config' }
  ];

  let enterpriseItems = [{ icon: <RiBriefcaseLine />, label: 'Companies', to: '/companies' }];

  let communityItems = [
    { icon: <RiServerLine />, label: 'Server Listings', to: '/server-listings' },
    { icon: <RiProfileLine />, label: 'Profiles', to: '/profiles' },
    { icon: <RiGroup3Line />, label: 'Server Collections', to: '/server-collections' },
    { icon: <RiServerFill />, label: 'Server Sync', to: '/server-syncs' },
    { icon: <RiServerFill />, label: 'Deployment Sync', to: '/server-deployment-syncs' }
  ];

  let items = [
    ...accountItems,
    ...managementItems,
    ...authItems,
    ...enterpriseItems,
    ...communityItems
  ];

  let currentItem = items.find(i => pathname.startsWith(i.to));

  return (
    <LargePaneLayout Nav={AdminNav}>
      <SidebarPane
        id="account"
        groups={[
          {
            label: 'Account',
            items: accountItems
          },
          {
            label: 'Management',
            items: managementItems
          },
          {
            label: 'Auth',
            items: authItems
          },
          {
            label: 'Enterprise',
            items: enterpriseItems
          },
          {
            label: 'Community',
            items: communityItems
          }
        ]}
      >
        <ExtraHeaderLayout
          header={
            <div style={{ fontWeight: 'bold' }}>{currentItem?.label ?? 'Metorial Admin'}</div>
          }
        >
          <div style={{ padding: 20 }}>
            <Outlet />
          </div>
        </ExtraHeaderLayout>
      </SidebarPane>
    </LargePaneLayout>
  );
};

let Wrapper = styled.header`
  padding: 5px 15px 5px 5px;
`;

let Inner = styled.nav`
  display: grid;
  gap: 15px;
  height: 50px;
`;

let Part = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
`;

let LogoPart = styled(Part)`
  justify-content: flex-start;
  color: #222;

  h1 {
    font-size: 18px;
    margin-left: 10px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
`;

export let AdminNav = () => {
  return (
    <Wrapper>
      <Inner
        style={{
          gridTemplateColumns: '1fr  1fr'
        }}
      >
        <LogoPart>
          <Logo size={30} />

          <h1>
            <span>Metorial Admin</span>
          </h1>
        </LogoPart>
      </Inner>
    </Wrapper>
  );
};
