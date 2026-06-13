import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Space, Form, Input, Switch, Modal,
  message, Empty, Row, Col, Alert, Divider, Tabs, List, Avatar, Badge
} from 'antd';
import {
  CheckCircleOutlined, SaveOutlined, WarningOutlined,
  CalendarOutlined, UserOutlined, HomeOutlined, BellOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getBookings, getTodayRecords, saveDailyRecord,
  getReminders, markAllRead
} from '../api';

const { TextArea } = Input;

function DailyRecords() {
  const navigate = useNavigate();
  const [activeBookings, setActiveBookings] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordModal, setRecordModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [recordForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [b, r, rm] = await Promise.all([
        getBookings('active'),
        getTodayRecords(),
        getReminders()
      ]);
      const overdue = await getBookings('overdue');
      setActiveBookings([...b, ...overdue]);
      setTodayRecords(r);
      setReminders(rm.filter(x => !x.is_read));
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openRecordModal = (booking) => {
    setSelectedBooking(booking);
    const existing = todayRecords.find(r => r.booking_id === booking.id);
    if (existing) {
      recordForm.setFieldsValue({
        feeding: existing.feeding,
        walking: existing.walking,
        abnormal: existing.abnormal,
        staff_name: existing.staff_name,
        return_confirmed: !!existing.return_confirmed
      });
    } else {
      recordForm.resetFields();
    }
    setRecordModal(true);
  };

  const handleSaveRecord = async (values) => {
    setSaving(true);
    try {
      await saveDailyRecord({
        booking_id: selectedBooking.id,
        ...values
      });
      message.success('记录已保存');
      setRecordModal(false);
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      message.success('已全部标记为已读');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const getRecordStatus = (bookingId) => {
    const record = todayRecords.find(r => r.booking_id === bookingId);
    if (!record) return { color: 'orange', text: '未记录', completed: false };
    const hasContent = record.feeding || record.walking;
    return {
      color: hasContent ? 'green' : 'orange',
      text: hasContent ? '已记录' : '部分记录',
      completed: !!record.return_confirmed
    };
  };

  const columns = [
    {
      title: '宠物',
      key: 'pet',
      width: 180,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Space>
            <span style={{ fontSize: 18 }}>{r.species === 'cat' ? '🐱' : '🐕'}</span>
            <b>{r.pet_name}</b>
            {r.status === 'overdue' && <Tag color="red">超期</Tag>}
          </Space>
          <span style={{ color: '#999', fontSize: 12 }}>{r.breed || '-'}</span>
        </Space>
      )
    },
    {
      title: '房间',
      dataIndex: 'room_name',
      key: 'room_name',
      width: 120,
      render: (t) => <HomeOutlined /> + ' ' + t
    },
    {
      title: '主人',
      key: 'owner',
      width: 160,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <span><UserOutlined /> {r.owner_name}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{r.owner_phone}</span>
        </Space>
      )
    },
    {
      title: '寄养日期',
      key: 'dates',
      width: 200,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <span>入住: {dayjs(r.check_in_date).format('MM-DD')}</span>
          <span>
            离店: {dayjs(r.check_out_date).format('MM-DD')}
            {r.status === 'overdue' && (
              <Tag color="red" style={{ marginLeft: 8 }}>
                超期 {dayjs().diff(r.check_out_date, 'day')} 天
              </Tag>
            )}
          </span>
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
      title: '今日记录',
      key: 'status',
      width: 120,
      render: (_, r) => {
        const s = getRecordStatus(r.id);
        return (
          <Space>
            <Badge status={s.color} text={s.text} />
            {s.completed && <Tag color="green"><CheckCircleOutlined /> 已确认</Tag>}
          </Space>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="primary" size="small" onClick={() => openRecordModal(r)}>
            <SaveOutlined /> 记录
          </Button>
          <Button size="small" onClick={() => navigate(`/bookings/${r.id}`)}>
            详情
          </Button>
        </Space>
      )
    }
  ];

  const reminderTypeColors = {
    overdue: 'red',
    vaccine_expired: 'red',
    checkout_today: 'orange',
    vaccine_soon: 'orange'
  };

  return (
    <div>
      <Row gutter={16}>
        <Col xs={24} lg={17}>
          <Card
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            title={
              <Space>
                <CalendarOutlined />
                <span>今日日常记录</span>
                <Tag color="blue">{dayjs().format('YYYY-MM-DD dddd')}</Tag>
                <Tag>需记录: {activeBookings.length}</Tag>
                <Tag color="green">已记录: {todayRecords.length}</Tag>
              </Space>
            }
            bodyStyle={{ padding: 0 }}
          >
            {activeBookings.length === 0 ? (
              <Empty description="今日暂无在寄养宠物" style={{ padding: 40 }} />
            ) : (
              <Table
                columns={columns}
                dataSource={activeBookings}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1000 }}
                pagination={false}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Card
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            title={
              <Space>
                <BellOutlined />
                <span>消息提醒</span>
                {reminders.length > 0 && <Badge count={reminders.length} color="red" />}
              </Space>
            }
            extra={
              reminders.length > 0 && (
                <Button type="link" size="small" onClick={handleMarkAllRead}>
                  全部已读
                </Button>
              )
            }
          >
            {reminders.length === 0 ? (
              <Empty description="暂无待处理提醒" style={{ padding: 20 }} />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={reminders}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: '12px 8px',
                      background: '#fff7e6',
                      borderRadius: 8,
                      marginBottom: 8,
                      borderLeft: `3px solid ${reminderTypeColors[item.type] === 'red' ? '#ff4d4f' : '#faad14'}`
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{
                            backgroundColor: reminderTypeColors[item.type] === 'red' ? '#ff4d4f' : '#faad14'
                          }}
                          icon={<WarningOutlined />}
                        />
                      }
                      title={
                        <Space>
                          <b style={{ fontSize: 14 }}>{item.title}</b>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <span style={{ color: '#666', fontSize: 12 }}>{item.message}</span>
                          <Space>
                            <Tag style={{ fontSize: 11 }}>{dayjs(item.created_at).format('HH:mm')}</Tag>
                            {item.booking_no && <Tag color="blue" style={{ fontSize: 11 }}>{item.booking_no}</Tag>}
                          </Space>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card
            style={{
              borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              marginTop: 16
            }}
            title={
              <Space>
                <span>📝 今日已记录</span>
              </Space>
            }
          >
            {todayRecords.length === 0 ? (
              <Empty description="还没有任何记录" style={{ padding: 20 }} />
            ) : (
              <List
                size="small"
                dataSource={todayRecords}
                renderItem={(r) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <b>{r.pet_name}</b>
                          <Tag>{r.room_name}</Tag>
                          {r.return_confirmed && <Tag color="green">已确认</Tag>}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          {r.feeding && <span style={{ fontSize: 12 }}>🍚 {r.feeding}</span>}
                          {r.walking && <span style={{ fontSize: 12 }}>🐾 {r.walking}</span>}
                          {r.abnormal && (
                            <span style={{ fontSize: 12, color: '#cf1322' }}>⚠️ {r.abnormal}</span>
                          )}
                          <span style={{ fontSize: 11, color: '#999' }}>
                            {r.staff_name || '匿名'} 记录
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={selectedBooking ? `📝 记录 - ${selectedBooking.pet_name} (${selectedBooking.room_name})` : ''}
        open={recordModal}
        onCancel={() => setRecordModal(false)}
        footer={null}
        width={700}
      >
        {selectedBooking && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              message={
                <Space>
                  <span>主人: {selectedBooking.owner_name} ({selectedBooking.owner_phone})</span>
                  <Tag>入住: {dayjs(selectedBooking.check_in_date).format('MM-DD')}</Tag>
                  <Tag>离店: {dayjs(selectedBooking.check_out_date).format('MM-DD')}</Tag>
                  {selectedBooking.medication && (
                    <Tag color="purple">💊 需喂药</Tag>
                  )}
                  {!selectedBooking.vaccine_valid && (
                    <Tag color="red">疫苗过期</Tag>
                  )}
                </Space>
              }
            />

            {selectedBooking.medication && (
              <Alert
                type="warning"
                showIcon
                message="💊 喂药提醒"
                description={selectedBooking.medication}
              />
            )}

            <Form
              form={recordForm}
              layout="vertical"
              onFinish={handleSaveRecord}
              initialValues={{ return_confirmed: false }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="🍚 喂食情况" name="feeding">
                    <TextArea rows={3} placeholder="请记录喂食时间、食物种类、食量、食欲情况等" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="🐾 遛宠/活动情况" name="walking">
                    <TextArea rows={3} placeholder="请记录遛宠时长、运动情况、精神状态、排便等" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="⚠️ 异常情况" name="abnormal">
                    <TextArea
                      rows={2}
                      placeholder="如有食欲不佳、精神萎靡、呕吐腹泻、皮肤异常等情况请详细记录，如无异常可不填"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="记录人姓名" name="staff_name">
                    <Input placeholder="请输入您的姓名" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="✅ 接回物品确认" name="return_confirmed" valuePropName="checked">
                    <Switch checkedChildren="已确认" unCheckedChildren="未确认" />
                  </Form.Item>
                </Col>
              </Row>
              <Divider />
              <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                <Button onClick={() => setRecordModal(false)}>取消</Button>
                <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                  保存记录
                </Button>
              </Space>
            </Form>
          </Space>
        )}
      </Modal>
    </div>
  );
}

export default DailyRecords;
