import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Space, Input, Select, DatePicker, Popconfirm,
  message, Modal, Descriptions
} from 'antd';
import { PlusOutlined, SearchOutlined, CalendarOutlined, EyeOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getBookings, checkoutBooking, cancelBooking } from '../api';

const { RangePicker } = DatePicker;

function Bookings() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const status = statusFilter === 'all' ? null : statusFilter;
      const list = await getBookings(status);
      setData(list);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleCheckout = async (id) => {
    try {
      await checkoutBooking(id);
      message.success('结账成功，房间已释放');
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleCancel = async (id) => {
    try {
      await cancelBooking(id);
      message.success('预约已取消');
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

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

  const filteredData = data.filter(b => {
    const matchSearch = !searchText ||
      b.booking_no.toLowerCase().includes(searchText.toLowerCase()) ||
      b.pet_name.includes(searchText) ||
      b.owner_name.includes(searchText) ||
      b.owner_phone.includes(searchText);

    const matchDate = !dateRange || dateRange.length !== 2 || (
      dayjs(b.check_in_date).isAfter(dateRange[0].subtract(1, 'day')) &&
      dayjs(b.check_in_date).isBefore(dateRange[1].add(1, 'day'))
    );

    return matchSearch && matchDate;
  });

  const columns = [
    {
      title: '预约号',
      dataIndex: 'booking_no',
      key: 'booking_no',
      width: 170,
      fixed: 'left',
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/bookings/${record.id}`)}>
          {text}
        </Button>
      )
    },
    {
      title: '宠物信息',
      key: 'pet',
      width: 180,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <span>
            {r.species === 'cat' ? '🐱' : '🐕'} <b>{r.pet_name}</b>
          </span>
          <span style={{ color: '#999', fontSize: 12 }}>{r.breed || '-'}</span>
        </Space>
      )
    },
    { title: '房间', dataIndex: 'room_name', key: 'room_name', width: 120 },
    {
      title: '主人',
      key: 'owner',
      width: 150,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <span>{r.owner_name}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{r.owner_phone}</span>
        </Space>
      )
    },
    {
      title: '入住日期',
      dataIndex: 'check_in_date',
      key: 'check_in_date',
      width: 110,
      render: (t) => dayjs(t).format('YYYY-MM-DD')
    },
    {
      title: '预计离店',
      dataIndex: 'check_out_date',
      key: 'check_out_date',
      width: 110,
      render: (t, record) => (
        <Space direction="vertical" size={2}>
          <span>{dayjs(t).format('YYYY-MM-DD')}</span>
          {record.status === 'overdue' && <Tag color="red">已超期 {dayjs().diff(t, 'day')} 天</Tag>}
        </Space>
      )
    },
    {
      title: '疫苗',
      key: 'vaccine',
      width: 100,
      render: (_, r) => r.vaccine_valid ? (
        <Tag color="green">有效</Tag>
      ) : (
        <Tag color="red">已过期</Tag>
      )
    },
    {
      title: '附加服务',
      key: 'services',
      width: 150,
      render: (_, r) => (
        <Space size={4}>
          {r.medication && <Tag color="purple">喂药</Tag>}
          {r.grooming && <Tag color="cyan">洗护</Tag>}
          {r.pickup_service && <Tag color="orange">接送</Tag>}
          {!r.medication && !r.grooming && !r.pickup_service && <span style={{ color: '#999' }}>无</span>}
        </Space>
      )
    },
    {
      title: '预估费用',
      dataIndex: 'total_price',
      key: 'total_price',
      width: 100,
      render: (v) => `¥${v}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      fixed: 'right',
      render: (s) => <Tag color={statusColor[s]}>{statusText[s]}</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/bookings/${record.id}`)}>
            详情
          </Button>
          {['active', 'overdue'].includes(record.status) && (
            <Popconfirm
              title="确认结账并释放房间？"
              onConfirm={() => handleCheckout(record.id)}
              okText="确认结账"
              cancelText="取消"
            >
              <Button size="small" type="primary" icon={<CheckOutlined />}>
                结账
              </Button>
            </Popconfirm>
          )}
          {['active'].includes(record.status) && (
            <Popconfirm
              title="确认取消此预约？"
              onConfirm={() => handleCancel(record.id)}
              okText="确认取消"
              cancelText="返回"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger>
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <Space wrap size="middle">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/bookings/new')}>
              新建预约
            </Button>
            <Select
              style={{ width: 140 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'active', label: '寄养中' },
                { value: 'overdue', label: '已超期' },
                { value: 'completed', label: '已完成' },
                { value: 'cancelled', label: '已取消' }
              ]}
            />
            <Input
              placeholder="搜索预约号/宠物名/主人/电话"
              prefix={<SearchOutlined />}
              style={{ width: 260 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['入住开始', '入住结束']}
            />
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条预约`
          }}
        />
      </Card>
    </div>
  );
}

export default Bookings;
