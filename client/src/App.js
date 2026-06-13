import React, { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Button, Drawer, List, Avatar, Space, Tag, Popover } from 'antd';
import {
  DashboardOutlined, HomeOutlined, CalendarOutlined,
  FileTextOutlined, BellOutlined, PlusOutlined, CheckCircleOutlined,
  MenuUnfoldOutlined, MenuFoldOutlined
} from '@ant-design/icons';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import NewBooking from './pages/NewBooking';
import DailyRecords from './pages/DailyRecords';
import { getUnreadCount, getReminders, markReminderRead, markAllRead } from './api';

const { Header, Sider, Content } = Layout;

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reminders, setReminders] = useState([]);
  const [reminderDrawer, setReminderDrawer] = useState(false);

  const selectedKey = location.pathname.startsWith('/bookings/new')
    ? '/bookings/new'
    : location.pathname.startsWith('/bookings/')
    ? '/bookings'
    : location.pathname === '/' ? '/dashboard' : location.pathname;

  const fetchUnread = async () => {
    try {
      const data = await getUnreadCount();
      setUnreadCount(data.count);
    } catch (e) {
      console.error(e);
    }
  };

  const openReminders = async () => {
    try {
      const data = await getReminders();
      setReminders(data);
      setReminderDrawer(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markReminderRead(id);
      setReminders(prev => prev.map(r => r.id === id ? { ...r, is_read: 1 } : r));
      await fetchUnread();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      setReminders(prev => prev.map(r => ({ ...r, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUnread();
    const timer = setInterval(fetchUnread, 30000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">数据概览</Link> },
    { key: '/rooms', icon: <HomeOutlined />, label: <Link to="/rooms">房间管理</Link> },
    {
      key: '/bookings-group',
      icon: <CalendarOutlined />,
      label: '寄养预约',
      children: [
        { key: '/bookings', label: <Link to="/bookings">预约列表</Link> },
        { key: '/bookings/new', label: <Link to="/bookings/new"><PlusOutlined /> 新建预约</Link> }
      ]
    },
    { key: '/records', icon: <FileTextOutlined />, label: <Link to="/records">日常记录</Link> }
  ];

  const getTypeIcon = (type) => {
    const colors = {
      overdue: '#ff4d4f',
      vaccine_expired: '#ff4d4f',
      checkout_today: '#faad14',
      vaccine_soon: '#faad14'
    };
    return <Avatar style={{ backgroundColor: colors[type] || '#1677ff' }} icon={<BellOutlined />} />;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light" width={220}>
        <div style={{
          height: 64,
          margin: 16,
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 12 : 18,
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(22,119,255,0.3)'
        }}>
          🐾 {collapsed ? '寄养' : '宠物寄养系统'}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['/bookings-group']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          zIndex: 10
        }}>
          <Space>
            <Button
              type="text"
              size="large"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              {selectedKey === '/dashboard' && '数据概览'}
              {selectedKey === '/rooms' && '房间管理'}
              {selectedKey === '/bookings' && '预约列表'}
              {selectedKey === '/bookings/new' && '新建预约'}
              {selectedKey === '/records' && '日常记录'}
            </h2>
          </Space>
          <Space>
            <Badge count={unreadCount} offset={[-6, 4]} size="small">
              <Button
                type="text"
                size="large"
                icon={<BellOutlined style={{ fontSize: 20 }} />}
                onClick={openReminders}
              />
            </Badge>
          </Space>
        </Header>
        <Content style={{ margin: '24px', background: '#f0f2f5', minHeight: 'calc(100vh - 112px)' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/bookings/new" element={<NewBooking />} />
            <Route path="/bookings/:id" element={<BookingDetail />} />
            <Route path="/records" element={<DailyRecords />} />
          </Routes>
        </Content>
      </Layout>

      <Drawer
        title={
          <Space>
            <span>消息提醒</span>
            <Button type="link" size="small" onClick={handleMarkAll}>
              <CheckCircleOutlined /> 全部已读
            </Button>
          </Space>
        }
        placement="right"
        onClose={() => setReminderDrawer(false)}
        open={reminderDrawer}
        width={420}
      >
        <List
          itemLayout="horizontal"
          dataSource={reminders}
          locale={{ emptyText: '暂无提醒消息' }}
          renderItem={(item) => (
            <List.Item
              style={{
                opacity: item.is_read ? 0.6 : 1,
                background: item.is_read ? 'transparent' : '#f6ffed',
                borderRadius: 8,
                marginBottom: 8,
                padding: '12px 8px'
              }}
              onClick={() => !item.is_read && handleMarkRead(item.id)}
            >
              <List.Item.Meta
                avatar={getTypeIcon(item.type)}
                title={
                  <Space>
                    <span style={{ fontWeight: 500 }}>{item.title}</span>
                    {!item.is_read && <Tag color="red">未读</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ color: '#666', marginBottom: 4 }}>{item.message}</div>
                    <Tag>{dayjs(item.created_at).format('MM-DD HH:mm')}</Tag>
                    {item.booking_no && <Tag color="blue">预约: {item.booking_no}</Tag>}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </Layout>
  );
}

export default App;
