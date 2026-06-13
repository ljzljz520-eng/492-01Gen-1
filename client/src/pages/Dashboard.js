import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Space, Progress, Button, Alert
} from 'antd';
import {
  HomeOutlined, UserOutlined, BellOutlined, CalendarOutlined,
  WarningOutlined, CheckCircleOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getStats, getBookings, getRooms, getReminders } from '../api';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [recentBookings, setRecentBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, b, r, rm] = await Promise.all([
        getStats(),
        getBookings('active'),
        getRooms(),
        getReminders()
      ]);
      setStats(s);
      setRecentBookings(b.slice(0, 5));
      setRooms(r);
      setReminders(rm.filter(x => !x.is_read).slice(0, 3));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statusColor = {
    active: 'blue',
    overdue: 'red',
    completed: 'green',
    cancelled: 'default'
  };

  const statusText = {
    active: '寄养中',
    overdue: '已超期',
    completed: '已完成',
    cancelled: '已取消'
  };

  const bookingColumns = [
    {
      title: '预约号',
      dataIndex: 'booking_no',
      key: 'booking_no',
      width: 160,
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/bookings/${record.id}`)}>
          {text}
        </Button>
      )
    },
    { title: '宠物名', dataIndex: 'pet_name', key: 'pet_name' },
    { title: '房间', dataIndex: 'room_name', key: 'room_name' },
    { title: '主人', dataIndex: 'owner_name', key: 'owner_name' },
    {
      title: '入住',
      dataIndex: 'check_in_date',
      key: 'check_in_date',
      render: (t) => dayjs(t).format('MM-DD')
    },
    {
      title: '预计离店',
      dataIndex: 'check_out_date',
      key: 'check_out_date',
      render: (t, record) => (
        <Space>
          <span>{dayjs(t).format('MM-DD')}</span>
          {record.status === 'overdue' && <Tag color="red">已超期</Tag>}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColor[s]}>{statusText[s]}</Tag>
    }
  ];

  const catRooms = rooms.filter(r => r.type === 'cat');
  const dogRooms = rooms.filter(r => r.type === 'dog');
  const catOccupied = catRooms.filter(r => r.realtime_status === 'occupied').length;
  const dogOccupied = dogRooms.filter(r => r.realtime_status === 'occupied').length;

  return (
    <div>
      {reminders.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
          message={`您有 ${reminders.length} 条待处理提醒`}
          description={
            <Space direction="vertical">
              {reminders.map(r => (
                <div key={r.id}>
                  <b>{r.title}</b> - {r.message}
                </div>
              ))}
            </Space>
          }
          action={
            <Button size="small" type="primary" onClick={() => navigate('/records')}>
              去处理
            </Button>
          }
          closable
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            onClick={() => navigate('/bookings')}
            hoverable
          >
            <Statistic
              title="在寄养宠物"
              value={stats.totalActive || 0}
              prefix={<UserOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
            <div style={{ marginTop: 12, color: '#999', fontSize: 13 }}>
              今日离店: <b style={{ color: '#faad14' }}>{stats.todayCheckout || 0}</b> 只
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            onClick={() => navigate('/rooms')}
            hoverable
          >
            <Statistic
              title="房间使用率"
              value={stats.totalRooms ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0}
              suffix="%"
              prefix={<HomeOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress
              percent={stats.totalRooms ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0}
              showInfo={false}
              style={{ marginTop: 12 }}
              strokeColor="#52c41a"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 12,
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              background: stats.overdueBookings > 0 ? '#fff2f0' : '#fff'
            }}
            hoverable
          >
            <Statistic
              title="超期寄养"
              value={stats.overdueBookings || 0}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div style={{ marginTop: 12, color: '#999', fontSize: 13 }}>
              请及时联系主人确认
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 12,
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              background: stats.vaccineWarnings > 0 ? '#fff7e6' : '#fff'
            }}
            hoverable
          >
            <Statistic
              title="疫苗异常"
              value={stats.vaccineWarnings || 0}
              prefix={<BellOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 12, color: '#999', fontSize: 13 }}>
              已过期或未提供疫苗证明
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>当前寄养预约</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/bookings')}>
                查看全部 <ArrowRightOutlined />
              </Button>
            }
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Table
              size="small"
              columns={bookingColumns}
              dataSource={recentBookings}
              rowKey="id"
              loading={loading}
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <HomeOutlined />
                <span>房间状态</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/rooms')}>
                房间管理 <ArrowRightOutlined />
              </Button>
            }
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  🐱 猫房（{catOccupied}/{catRooms.length}）
                </div>
                <Space wrap>
                  {catRooms.map(r => (
                    <Tag
                      key={r.id}
                      color={r.realtime_status === 'occupied' ? 'red' : r.realtime_status === 'maintenance' ? 'orange' : 'green'}
                      style={{ padding: '4px 12px', borderRadius: 6 }}
                    >
                      {r.name} {r.realtime_status === 'occupied' ? '占用' : r.realtime_status === 'maintenance' ? '维护' : '空闲'}
                    </Tag>
                  ))}
                </Space>
              </div>
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  🐕 犬舍（{dogOccupied}/{dogRooms.length}）
                </div>
                <Space wrap>
                  {dogRooms.map(r => (
                    <Tag
                      key={r.id}
                      color={r.realtime_status === 'occupied' ? 'red' : r.realtime_status === 'maintenance' ? 'orange' : 'green'}
                      style={{ padding: '4px 12px', borderRadius: 6 }}
                    >
                      {r.name} {r.realtime_status === 'occupied' ? '占用' : r.realtime_status === 'maintenance' ? '维护' : '空闲'}
                    </Tag>
                  ))}
                </Space>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
